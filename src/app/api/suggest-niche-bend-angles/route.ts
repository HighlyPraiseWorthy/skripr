import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { videoTitle, hookType, titleFormula, remixFramework, bridgeSubNiche } = await req.json();
    const formula = (titleFormula?.formula || "").slice(0, 200);
    const framework = (remixFramework || "").slice(0, 400);

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      system: "You output ONLY valid JSON arrays. No prose, no markdown. Start with [ and end with ].",
      messages: [{
        role: "user",
        content: `Generate 5 YouTube angles that blend a creator’s niche with a bridge sub-niche.\n\nCREATOR VIDEO: "${(videoTitle || "").slice(0, 120)}"\nBRIDGE SUB-NICHE: ${bridgeSubNiche?.name || "Unknown"} (under ${bridgeSubNiche?.parentNiche || "Unknown"})\nHOOK TYPE: ${hookType}\nTITLE FORMULA: ${formula}\nVIDEO FRAMEWORK: ${framework}\n\nEach angle must explicitly BLEND BOTH niches together. Not just one or the other.\nThe title must apply the formula above to the blended topic.\n\nRequired JSON keys per item:\n- "angle": punchy 8-word name showing the blend\n- "description": one sentence on exactly how both niches fuse\n- "audience": who from BOTH communities would click\n- "titleSuggestion": full title using the formula above\n- "blendExplained": "X audience discovers it through Y lens" (one short sentence)\n\n[`,
      }, {
        role: "assistant",
        content: "[",
      }],
    });

    const raw = "[" + (msg.content[0].type === "text" ? msg.content[0].text : "");
    const angles = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json({ angles });
  } catch (e: any) {
    console.error("[suggest-niche-bend-angles]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to generate angles" }, { status: 500 });
  }
}
