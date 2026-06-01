import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { hookType, hookAnalysis, remixFramework, selectedTitle, titleFormula, videoTitle } = await req.json();

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `You are a YouTube content strategist. A creator just analyzed this viral video and wants to replicate its framework in their own niche.

VIRAL VIDEO: "${videoTitle || "Unknown"}"
HOOK TYPE: ${hookType}
WHY THE HOOK WORKS: ${hookAnalysis?.whyItWorks || ""}
TITLE FORMULA: ${titleFormula?.formula || ""}
SELECTED TITLE TO REMIX: ${selectedTitle || ""}
REMIX FRAMEWORK: ${remixFramework || ""}

Generate 5 completely different content angles this creator could make using the same framework. Each angle should:
- Be a specific, concrete topic (not vague categories)
- Work naturally with the ${hookType} hook type
- Apply the title formula: "${titleFormula?.formula || ""}"
- Target a clear audience who would click on it

Return ONLY valid JSON, no markdown fences:
[
  {
    "angle": "Punchy angle name (max 8 words)",
    "description": "One sentence: exactly what this video covers",
    "audience": "Who specifically would watch this",
    "titleSuggestion": "Full title applying the formula to this angle"
  }
]`,
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const angles = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json({ angles });
  } catch (e: any) {
    console.error("[suggest-viral-angles]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to generate angles" }, { status: 500 });
  }
}
