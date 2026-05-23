import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Anthropic } from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getAnthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return client;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { topic, niche } = await req.json();
    if (!topic) return NextResponse.json({ error: "Topic required" }, { status: 400 });

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

Respond with ONLY a JSON array of 4 strings. No preamble, no markdown.
["angle 1", "angle 2", "angle 3", "angle 4"]`,
      }],
    });

    const raw = response.content[0];
    if (raw.type !== "text") return NextResponse.json({ error: "Bad response" }, { status: 500 });

    const match = raw.text.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ error: "Could not parse angles" }, { status: 500 });

    const angles: string[] = JSON.parse(match[0]);
    return NextResponse.json({ angles });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to suggest angles" }, { status: 500 });
  }
}
