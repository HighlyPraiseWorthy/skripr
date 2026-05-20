import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Anthropic } from "@anthropic-ai/sdk";
import { getMagnetSuggestions } from "@/lib/magnet-word";

// Allow up to 60 seconds for the Anthropic call to complete.
// Vercel Hobby plan supports 60s when explicitly set.
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
    const { nicheA, nicheB } = await req.json();
    if (!nicheA || !nicheB) return NextResponse.json({ error: "Two niches required" }, { status: 400 });

    const response = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
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

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response type from Claude" }, { status: 500 });
    }

    // Extract JSON array — Claude often wraps in code blocks or adds explanatory text
    const codeBlock = content.text.match(/\s*```(?:json)?\s*\n([\s\S]*?)\n```/);
    const jsonText = codeBlock ? codeBlock[1]
      : (content.text.match(/\[[\s\S]*\]/) || [null])[0];
    if (!jsonText) {
      console.error("No JSON array found in Claude response (last 300):", content.text.slice(-300));
      return NextResponse.json({
        error: "Could not parse ideas from response",
        debug: content.text.slice(0, 500)
      }, { status: 500 });
    }
    let ideas: any[];
    try { ideas = JSON.parse(jsonText); }
    catch (e: any) {
      console.error("JSON parse error:", e.message, "\nText (last 200):", jsonText.slice(-200));
      return NextResponse.json({ error: "Generated response was malformed JSON — try again" }, { status: 500 });
    }
    const ideasWithMagnets = await Promise.all(
      ideas.map(async (idea: any) => {
        try {
          const suggestions = await getMagnetSuggestions(idea.title || "", nicheA);
          return { ...idea, viralMagnet: suggestions[0] || null };
        } catch {
          return { ...idea, viralMagnet: null };
        }
      })
    );
    return NextResponse.json({ ideas: ideasWithMagnets });
  } catch (error: any) {
    console.error("Niche bend ideas error:", error);
    return NextResponse.json({
      error: error.message || "Failed to generate ideas",
      type: error.constructor?.name
    }, { status: 500 });
  }
}
