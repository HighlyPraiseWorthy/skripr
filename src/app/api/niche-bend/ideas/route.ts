import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Anthropic } from "@anthropic-ai/sdk";

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  }
  return anthropicClient;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { nicheA, nicheB } = await req.json();
    if (!nicheA || !nicheB) return NextResponse.json({ error: "Two niches required" }, { status: 400 });

    const response = await getAnthropic().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Generate 10 YouTube video ideas that bridge two niches: "${nicheA}" and "${nicheB}".

These should be "niche bend" ideas — videos that intentionally cross-pollinate between the two niches to break out of algorithmic bubbles.

For each idea, provide:
- Title (catchy, clickable)
- Description (2-3 sentences explaining the concept)
- Viral potential score (0-100)
- Format (list, challenge, comparison, story, experiment, reaction, educational, documentary)
- Why it works (brief reasoning)

Output JSON array:
[
  {
    "title": "string",
    "description": "string",
    "viralPotential": number,
    "competitionLevel": "low|medium|high",
    "format": "string",
    "reasoning": "string"
  }
]

Sort by viralPotential descending.`,
      }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected response");

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found");

    const ideas = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ ideas });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate ideas" }, { status: 500 });
  }
}
