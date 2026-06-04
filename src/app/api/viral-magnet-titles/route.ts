import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserPlan } from "@/lib/usage";
import { getUserPlan } from "@/lib/usage";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Locked — Starter plan or above required
  const plan = await getUserPlan(userId);
  if (plan === "free") {
    return NextResponse.json(
      { error: "Viral Magnet Titles requires a Starter plan or above. Upgrade at skripr.vercel.app/dashboard/settings" },
      { status: 403 }
    );
  }

  // Locked — Starter plan or above required
  const plan = await getUserPlan(userId);
  if (plan === "free") {
    return NextResponse.json(
      { error: "Viral Magnet Titles requires a Starter plan or above. Upgrade at skripr.vercel.app/dashboard/settings" },
      { status: 403 }
    );
  }

  const { title, script, magnetWords } = await req.json();
  if (!title?.trim() || !magnetWords?.length) {
    return NextResponse.json({ error: "title and magnetWords required" }, { status: 400 });
  }

  const prompt = `You are an expert YouTube title strategist with deep knowledge of what drives clicks and views.

ORIGINAL TITLE: "${title}"
${script?.trim() ? `VIDEO CONTEXT: ${script.trim().slice(0, 600)}` : ""}
SELECTED VIRAL MAGNET WORDS: ${magnetWords.join(", ")}

YouTube title formulas to reference:
- How-to: "How to [verb] [outcome] in [timeframe]"
- Curiosity gap: "The [thing] Nobody Talks About"
- Personal result: "I [did X] for [N days/times]: Here's what happened"
- Shock/contrast: "[Expected thing] vs [Surprising thing]: [result]"
- List: "[N] [adjective] [things] that [outcome]"
- POV/immersive: "POV: [vivid situation]"
- Reveal: "The truth about [X] (it's not what you think)"
- Challenge: "I tried [X] every day for [N days] so you don't have to"
- Confession: "I've [done X for N years]. Here's what I actually learned"
- Before/after: "How I went from [before] to [after] in [timeframe]"

TASK: Generate exactly 8 viral-optimized titles using the provided magnet words.

GROUP 1 — "same-formula" (exactly 3 titles):
Identify the structural formula/pattern of the original title. Generate 3 variations that preserve that exact formula but with the magnet word naturally woven in. These should feel like upgraded versions of the original — same DNA, higher CTR.

GROUP 2 — "new-formula" (exactly 5 titles):
Use different YouTube title formulas from the list above. Keep the same topic/niche. Each must naturally incorporate at least one of the magnet words. Use at least 3 different formula types across the 5 titles.

RULES:
- Every title must contain exactly ONE of the selected magnet words (use them all if possible, spread across the 8)
- 6-12 words per title for optimal CTR
- Specific > vague. Numbers and concrete details beat abstractions
- The magnet word must feel INEVITABLE — like it belongs there — not inserted
- No title should start with the same word as another title

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "detectedFormula": "brief name of the original title's formula type",
  "titles": [
    {
      "title": "string",
      "type": "same-formula",
      "formula": "string — which formula pattern was used",
      "magnetWord": "string — which magnet word appears in this title",
      "whyItWorks": "string — one tight sentence on why this title will perform"
    }
  ]
}`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
    const data = JSON.parse(clean);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("viral-magnet-titles error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
