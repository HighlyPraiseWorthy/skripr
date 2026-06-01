import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { videoTitle, channelTitle, remixFramework, hookType, titleFormula } = await req.json();
    const formula = (titleFormula?.formula || "").slice(0, 200);
    const framework = (remixFramework || "").slice(0, 400);

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      system: "You output ONLY valid JSON arrays. No prose, no markdown. Start with [ and end with ].",
      messages: [{
        role: "user",
        content: `A creator made a video in their niche and wants to blend it with a bridge sub-niche to break out of the algorithmic bubble.\n\nVIDEO: "${(videoTitle || "Unknown").slice(0, 120)}"\nCHANNEL: ${channelTitle || "Unknown"}\nHOOK TYPE: ${hookType}\nTITLE FORMULA: ${formula}\nFRAMEWORK: ${framework}\n\nSuggest 5 bridge sub-niches to blend with this content. CRITICAL RULES:\n- Return SPECIFIC SUB-NICHES, not broad categories\n  e.g. "Financial Anxiety" not "Finance", "Speedrunning" not "Gaming", "Stoicism" not "Philosophy"\n- Sub-niches must have dedicated YouTube search communities\n- The blend must feel natural, not forced\n- For each, generate a titlePreview using EXACTLY the title formula above applied to the blend\n\n[`,
      }, {
        role: "assistant",
        content: "[",
      }],
    });

    const raw = "[" + (msg.content[0].type === "text" ? msg.content[0].text : "");
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    // Ensure fields: name, parentNiche, hook, algorithmNote, titlePreview
    const niches = parsed.map((n: any) => ({
      name: n.name || n.subNiche || n.niche || "Unknown",
      parentNiche: n.parentNiche || n.parent || n.category || "",
      hook: n.hook || n.blend || n.why || "",
      algorithmNote: n.algorithmNote || n.algorithm || n.searchNote || "",
      titlePreview: n.titlePreview || n.title || n.titleSuggestion || "",
    }));
    return NextResponse.json({ niches });
  } catch (e: any) {
    console.error("[suggest-bridge-niches]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to generate bridge niches" }, { status: 500 });
  }
}
