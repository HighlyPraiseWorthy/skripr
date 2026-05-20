import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Anthropic } from "@anthropic-ai/sdk";

export const maxDuration = 60;

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
    const { nicheA, nicheB, viralMagnetWord } = await req.json();
    if (!nicheA || !nicheB) return NextResponse.json({ error: "Two niches required" }, { status: 400 });

    const magnetInstruction = viralMagnetWord
      ? `\n\nVIRAL MAGNET REQUIREMENT: Every single title MUST naturally incorporate the word "${viralMagnetWord}". Weave it in so it feels organic and compelling — not forced. Position it where it creates the most curiosity or urgency in the title.`
      : "";

    const response = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `Generate 10 YouTube video ideas that bridge two niches: "${nicheA}" and "${nicheB}".

These should be "niche bend" ideas — videos that intentionally cross-pollinate between the two niches to break out of algorithmic bubbles.${magnetInstruction}

For each idea, provide:
- Title: MUST pass all three: (1) searchable keyword present, (2) emotional trigger word present (quietly/secretly/actually/everyone gets wrong/hidden/nobody mentions/cost you/revealed), (3) curiosity gap present (implies hidden answer or counterintuitive truth). NEVER start with "How to", "The best", "Complete guide", "Overview". Use openers like: "the problem nobody talks about with...", "why this stopped working", "what nobody tells you about...", "the part everyone misses"
- Description (2-3 sentences explaining the concept)
- Viral potential score (0-100)
- Format (list, challenge, comparison, story, experiment, reaction, educational, documentary)
- Why it works (brief reasoning)

Respond with ONLY a valid JSON array. No preamble, no explanation, no markdown code fences. Start your response with [ and end with ]. Sort by viralPotential descending.

[
  {
    "title": "string",
    "description": "string",
    "viralPotential": number,
    "competitionLevel": "low|medium|high",
    "format": "string",
    "reasoning": "string"
  }
]`,
      }],
    });

    const rawContent = response.content[0];
    if (rawContent.type !== "text") {
      return NextResponse.json({ error: "Unexpected response type from Claude" }, { status: 500 });
    }

    const codeBlock = rawContent.text.match(/\s*\`\`\`(?:json)?\s*\n([\s\S]*?)\n\`\`\`/);
    const jsonText = codeBlock ? codeBlock[1]
      : (rawContent.text.match(/\[[\s\S]*\]/) || [null])[0];
    if (!jsonText) {
      return NextResponse.json({ error: "Could not parse ideas from response", debug: rawContent.text.slice(0, 500) }, { status: 500 });
    }
    let ideas: any[];
    try { ideas = JSON.parse(jsonText); }
    catch (e: any) {
      return NextResponse.json({ error: "Generated response was malformed JSON — try again" }, { status: 500 });
    }

    return NextResponse.json({ ideas, viralMagnetWord: viralMagnetWord || null });
  } catch (error: any) {
    console.error("Niche bend ideas error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate ideas" }, { status: 500 });
  }
}
