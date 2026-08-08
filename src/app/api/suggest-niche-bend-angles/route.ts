import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { getNicheHookExamplesBlock, getNicheTitleFormulasBlock } from "@/lib/viral-frameworks";
import { getPickedAnglesBlock } from "@/lib/angle-picks";
import { EXPERT_ATTRIBUTION_RULE, PROVENANCE_RULE } from "@/lib/ai/claude";
import { extractTrailingExpert, stripCarriedExpert } from "@/lib/title-utils";

const client = new Anthropic();
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { videoTitle, hookType, titleFormula, remixFramework, bridgeSubNiche } = await req.json();
    const formula = (titleFormula?.formula || "").slice(0, 200);
    const framework = (remixFramework || "").slice(0, 400);

    // Self-improving layer: read proven hooks/titles + picked angles for the
    // niche being bent INTO (the bridge's parent niche). Time-boxed, null-safe.
    const bendNiche = bridgeSubNiche?.parentNiche || bridgeSubNiche?.name || null;
    const [pickedAngles, hookExamples, titleFormulas] = await Promise.all([
      getPickedAnglesBlock(bendNiche).catch(() => null),
      getNicheHookExamplesBlock(bendNiche, 4).catch(() => null),
      getNicheTitleFormulasBlock(bendNiche, 4).catch(() => null),
    ]);
    const learning = [
      pickedAngles ? `ANGLES CREATORS PICKED IN THE BRIDGE NICHE — lean toward this framing (never copy wording):\n${pickedAngles}` : "",
      hookExamples ? `PROVEN HOOKS IN THE BRIDGE NICHE:\n${hookExamples}` : "",
      titleFormulas ? `PROVEN TITLES IN THE BRIDGE NICHE — model "titleSuggestion" on these formulas:\n${titleFormulas}` : "",
    ].filter(Boolean).join("\n\n");

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      system: "You output ONLY valid JSON arrays. No prose, no markdown. Start with [ and end with ].",
      messages: [{
        role: "user",
        content: `Generate 5 YouTube angles that blend a creator’s niche with a bridge sub-niche.\n\nCREATOR VIDEO: "${(videoTitle || "").slice(0, 120)}"\nBRIDGE SUB-NICHE: ${bridgeSubNiche?.name || "Unknown"} (under ${bridgeSubNiche?.parentNiche || "Unknown"})\nHOOK TYPE: ${hookType}\nTITLE FORMULA: ${formula}\nVIDEO FRAMEWORK: ${framework}\n${learning ? `\n${learning}\n` : ""}\nEach angle must explicitly BLEND BOTH niches together. Not just one or the other.\nThe title must apply the formula above to the blended topic.\n${EXPERT_ATTRIBUTION_RULE}\n\n${PROVENANCE_RULE}\n\nGROUNDING: you have no source document here, so do NOT invent a documented incident, date, name, agency, dollar figure, or leaked/declassified document to make an angle sound concrete. Build angles on mechanism, incentive, stakes, or question instead.\n\nRequired JSON keys per item:\n- "angle": punchy 8-word name showing the blend\n- "description": one sentence on exactly how both niches fuse\n- "audience": who from BOTH communities would click\n- "titleSuggestion": full title using the formula above\n- "blendExplained": "X audience discovers it through Y lens" (one short sentence)\n\n[`,
      }, {
        role: "assistant",
        content: "[",
      }],
    });

    const raw = "[" + (msg.content[0].type === "text" ? msg.content[0].text : "");
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    // Hard guarantee: strip a carried-over source expert from each blend title.
    const sourceExpert = extractTrailingExpert(videoTitle);
    const angles = Array.isArray(parsed)
      ? parsed.map((a: any) => ({ ...a, titleSuggestion: stripCarriedExpert(a?.titleSuggestion || "", sourceExpert) }))
      : parsed;
    return NextResponse.json({ angles });
  } catch (e: any) {
    console.error("[suggest-niche-bend-angles]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to generate angles" }, { status: 500 });
  }
}
