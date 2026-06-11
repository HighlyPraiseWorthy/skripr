import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { hookType, hookAnalysis, remixFramework, selectedTitle, selectedTitleDescription, selectedTitleAudience, titleFormula, videoTitle } = await req.json();

    // Trim remixFramework to prevent transcript bleed into prompt
    const framework = (remixFramework || "").slice(0, 600);
    const whyItWorks = (hookAnalysis?.whyItWorks || "").slice(0, 300);
    const chosenTitle = (selectedTitle || "").slice(0, 150);

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: "You output ONLY valid JSON arrays. No prose, no markdown, no explanation. Start your response with [ and end with ].",
      messages: [{
        role: "user",
        content: `${chosenTitle
  ? `The creator has CHOSEN this video topic: "${chosenTitle}"
${selectedTitleDescription ? `What it covers: ${String(selectedTitleDescription).slice(0, 200)}` : ""}
${selectedTitleAudience ? `Target audience: ${String(selectedTitleAudience).slice(0, 150)}` : ""}

Generate 5 different angles INTO this exact topic — different entry points, framings, or sub-stories WITHIN "${chosenTitle}". Do NOT change the subject or jump to other niches. Every angle must still be recognizably about this chosen topic.`
  : `Generate 5 YouTube content angles using this viral framework.`}

SOURCE VIDEO (framework origin): "${(videoTitle || "Unknown").slice(0, 100)}"
HOOK TYPE: ${hookType}
HOOK PSYCHOLOGY: ${whyItWorks}
TITLE FORMULA: ${titleFormula?.formula || ""}
FRAMEWORK SUMMARY: ${framework}

Output a JSON array of exactly 5 objects. Each object must have these exact keys:
- "angle": punchy topic name, max 8 words
- "description": one sentence describing what the video covers
- "audience": who would specifically click on this
- "titleSuggestion": full title${chosenTitle ? ` — a refinement of the chosen title for this specific angle, keeping the formula and the chosen subject` : " using the formula above"}

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
