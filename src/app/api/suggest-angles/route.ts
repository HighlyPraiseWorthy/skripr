import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Anthropic } from "@anthropic-ai/sdk";
import { EXPERT_ATTRIBUTION_RULE, PROVENANCE_RULE } from "@/lib/ai/claude";
import { buildGroundingBlock, type GroundingContext } from "@/lib/research";
import { vetAngles, groundingToSourceText } from "@/lib/ai/angle-vet";

export const maxDuration = 120;

let client: Anthropic | null = null;
function getAnthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return client;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { topic, niche, grounding } = await req.json();
    if (!topic) return NextResponse.json({ error: "Topic required" }, { status: 400 });

    const groundingBlock = buildGroundingBlock(grounding as GroundingContext | undefined);

    const response = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `Generate 4 sharp, counterintuitive angles for a YouTube script about: "${topic}"${niche ? ` in the ${niche} niche` : ""}.

Each angle must be:
- A specific counterintuitive truth or unexpected perspective (NOT generic)
- 1-2 sentences max
- Something that makes a viewer think "I never thought about it that way"
- Concrete enough that a script could be built entirely around it

Bad example: "Coffee has surprising health effects"
Good example: "Most people drink coffee during the 90-minute cortisol window after waking — the exact window where caffeine has zero effect and just builds tolerance"

${EXPERT_ATTRIBUTION_RULE}\n\n${PROVENANCE_RULE}\n\n${groundingBlock || "GROUNDING: you have no source document here, so do NOT invent a documented incident, date, name, agency, dollar figure, or leaked/declassified document to make an angle sound concrete. Build angles on mechanism, incentive, stakes, or question instead."}

NUMBERS IN ANGLES (strict): do not put a specific number, salary, wage, dollar amount, date, or count in an angle unless that exact figure appears in the facts above. A number that "sounds right" is the fastest way to ship a fabrication. If the facts do not give a figure, make the point without one.

Respond with ONLY a JSON array of 4 strings. No preamble, no markdown.
["angle 1", "angle 2", "angle 3", "angle 4"]`,
      }],
    });

    const raw = response.content[0];
    if (raw.type !== "text") return NextResponse.json({ error: "Bad response" }, { status: 500 });

    const match = raw.text.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ error: "Could not parse angles" }, { status: 500 });

    const angles: string[] = JSON.parse(match[0]);
    const cleanAngles = angles.map((a: string) => a.replace(/—/g, ", ").replace(/\s,\s/g, ", "));
    // Vet each angle against the grounding facts before it reaches the creator.
    const warnings = await vetAngles(cleanAngles, groundingToSourceText(grounding)).catch(() => cleanAngles.map(() => []));
    return NextResponse.json({ angles: cleanAngles, warnings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to suggest angles" }, { status: 500 });
  }
}
