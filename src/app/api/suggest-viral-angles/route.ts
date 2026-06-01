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

    // Trim remixFramework to prevent transcript bleed into prompt
    const framework = (remixFramework || "").slice(0, 600);
    const whyItWorks = (hookAnalysis?.whyItWorks || "").slice(0, 300);

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: "You output ONLY valid JSON arrays. No prose, no markdown, no explanation. Start your response with [ and end with ].",
      messages: [{
        role: "user",
        content: `Generate 5 YouTube content angles using this viral framework.

VIDEO: "${(videoTitle || "Unknown").slice(0, 100)}"
HOOK TYPE: ${hookType}
HOOK PSYCHOLOGY: ${whyItWorks}
TITLE FORMULA: ${titleFormula?.formula || ""}
FRAMEWORK SUMMARY: ${framework}

Output a JSON array of exactly 5 objects. Each object must have these exact keys:
- "angle": punchy topic name, max 8 words
- "description": one sentence describing what the video covers
- "audience": who would specifically click on this
- "titleSuggestion": full title using the formula above

[`,
      }, {
        role: "assistant",
        content: "[",
      }],
    });

    const raw = "[" + (msg.content[0].type === "text" ? msg.content[0].text : "");
    const angles = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json({ angles });
  } catch (e: any) {
    console.error("[suggest-viral-angles]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to generate angles" }, { status: 500 });
  }
}
