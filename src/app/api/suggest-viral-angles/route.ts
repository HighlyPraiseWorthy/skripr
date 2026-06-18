import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { getNicheHookExamplesBlock, getNicheTitleFormulasBlock } from "@/lib/viral-frameworks";
import { getPickedAnglesBlock } from "@/lib/angle-picks";
import { extractTrailingExpert, stripCarriedExpert } from "@/lib/title-utils";

const client = new Anthropic();
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { hookType, hookAnalysis, remixFramework, selectedTitle, selectedTitleDescription, selectedTitleAudience, titleFormula, videoTitle, niche } = await req.json();

    // Trim remixFramework to prevent transcript bleed into prompt
    const framework = (remixFramework || "").slice(0, 600);
    const whyItWorks = (hookAnalysis?.whyItWorks || "").slice(0, 300);
    const chosenTitle = (selectedTitle || "").slice(0, 150);

    // Self-improving layer: read proven hooks/titles + picked angles for the
    // source video's niche. Time-boxed, null-safe — never blocks suggestions.
    const [pickedAngles, hookExamples, titleFormulas] = await Promise.all([
      getPickedAnglesBlock(niche).catch(() => null),
      getNicheHookExamplesBlock(niche, 4).catch(() => null),
      getNicheTitleFormulasBlock(niche, 4).catch(() => null),
    ]);
    const learning = [
      pickedAngles ? `ANGLES CREATORS PICKED IN THIS NICHE — lean toward this framing (never copy wording):\n${pickedAngles}` : "",
      hookExamples ? `PROVEN HOOKS IN THIS NICHE:\n${hookExamples}` : "",
      titleFormulas ? `PROVEN TITLES IN THIS NICHE — model "titleSuggestion" on these formulas:\n${titleFormulas}` : "",
    ].filter(Boolean).join("\n\n");

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
${learning ? `\n${learning}\n` : ""}

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
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    // Hard guarantee: strip a carried-over source expert from each angle title.
    const sourceExpert = extractTrailingExpert(videoTitle);
    const angles = Array.isArray(parsed)
      ? parsed.map((a: any) => ({ ...a, titleSuggestion: stripCarriedExpert(a?.titleSuggestion || "", sourceExpert) }))
      : parsed;
    return NextResponse.json({ angles });
  } catch (e: any) {
    console.error("[suggest-viral-angles]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to generate angles" }, { status: 500 });
  }
}
