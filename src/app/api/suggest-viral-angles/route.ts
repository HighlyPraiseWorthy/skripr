import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { getNicheHookExamplesBlock, getNicheTitleFormulasBlock } from "@/lib/viral-frameworks";
import { getPickedAnglesBlock } from "@/lib/angle-picks";
import { extractTrailingExpert, stripCarriedExpert } from "@/lib/title-utils";
import { PROVENANCE_RULE } from "@/lib/ai/claude";
import { buildGroundingBlock, type GroundingContext } from "@/lib/research";

const client = new Anthropic();
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { hookType, hookAnalysis, remixFramework, selectedTitle, selectedTitleDescription, selectedTitleAudience, titleFormula, videoTitle, niche, grounding } = await req.json();
    const groundingBlock = buildGroundingBlock(grounding as GroundingContext | undefined);

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
      titleFormulas && !chosenTitle ? `PROVEN TITLES IN THIS NICHE — model "titleSuggestion" on these formulas:\n${titleFormulas}` : "",
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

Generate 5 different angles INTO this exact topic — different entry points, framings, or sub-stories WITHIN "${chosenTitle}". Do NOT change the subject or jump to other niches. Every angle must still be recognizably about this chosen topic.

TITLE LOCK (critical): Every "titleSuggestion" MUST use the exact same title formula as the chosen title. Formula: "${titleFormula?.formula || chosenTitle}". The chosen title "${chosenTitle}" is your style template. Keep that structure. Change only the variable that fits each angle. Do NOT invent a different title shape, and do NOT add tag phrases like "Here's What Happened", "Here's Why", or "(It's Insane)".`
  : `Generate 5 YouTube content angles using this viral framework.

WHITE-SPACE SWAPS: Make 2 of the 5 angles SINGLE-VARIABLE SWAPS of the source title — keep the proven formula and change EXACTLY ONE variable (the subject, the timeframe, the quantity, or the outcome) to claim an under-served sibling angle. Example: "...from Mom..." -> "...from Dad...". This is how the creator differentiates from everyone copying the original video. CRITICAL: the swapped claim MUST stay genuinely true and defensible — never swap into a claim that is false or unsupported just because it's structurally neat. The other 3 angles are normal angles (no swap).`}

SOURCE VIDEO (framework origin): "${(videoTitle || "Unknown").slice(0, 100)}"
HOOK TYPE: ${hookType}
HOOK PSYCHOLOGY: ${whyItWorks}
TITLE FORMULA: ${titleFormula?.formula || ""}
FRAMEWORK SUMMARY: ${framework}
${learning ? `\n${learning}\n` : ""}

${PROVENANCE_RULE}

The source video grounds the ORIGINAL topic only. It is not evidence for the new topic you are angling toward, so never carry its documents, figures, or named sources onto a different subject, and never invent new ones.
${groundingBlock ? `\nTHIS VIDEO IS ABOUT A REAL, RESOLVED CASE. Every angle must be about it and use only its facts:\n${groundingBlock}` : ""}

Output a JSON array of exactly 5 objects. Each object must have these exact keys:
- "angle": punchy topic name, max 8 words
- "description": one sentence describing what the video covers
- "audience": who would specifically click on this
- "titleSuggestion": full title${chosenTitle ? ` — MUST follow the TITLE LOCK formula above, only the variable changed for this angle. Do not change the title shape.` : " using the formula above"}. TITLE MUST BE COHERENT ENGLISH FIRST, formula second. Apply the formula's SPIRIT (the "How [subject] [verb] [target]" curiosity structure), but choose a verb and phrasing that are ACCURATE and read naturally. Never jam the source's key word in backwards if it produces nonsense: "How the FBI Infiltrated Its Own Informant" is broken because the FBI did not infiltrate its own informant. If the exact formula word does not fit, use a true verb that keeps the same click ("How the FBI Ran a Killer for 30 Years", "How the FBI Protected a Mob Hitman"). A title a viewer cannot parse gets no clicks, so coherence and accuracy beat literal formula-matching every time.
- "swap": ${chosenTitle ? `null (not applicable here)` : `if this angle is a single-variable swap of the source title, the change written as "X → Y" (e.g. "Mom → Dad"); otherwise null`}

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
