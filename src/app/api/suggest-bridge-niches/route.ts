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
      max_tokens: 1000,
      system: `You output ONLY valid JSON arrays. No prose, no markdown. Start with [ and end with ].
Each object must have EXACTLY these keys: "name", "parentNiche", "hook", "algorithmNote", "titlePreview".`,
      messages: [{
        role: "user",
        content: `A YouTube creator made a video about: "${(videoTitle || "Unknown").slice(0, 120)}"
Channel: ${channelTitle || "Unknown"}
Hook type: ${hookType}
Title formula: ${formula}
Framework signals: ${framework.slice(0, 150)}

STEP 1 — Detect source niche: Based on the video title, channel name, and framework keywords, determine exactly what content niche this creator is in (e.g. "health & weight loss", "personal finance", "gaming", "psychology", "fitness", "true crime", "technology", "cooking").

STEP 2 — Find bridge niches that are COMPLETELY DIFFERENT from that detected niche. If health/medicine → pick from: gaming, finance, crime, philosophy, science, history, technology. If finance → pick from: gaming, psychology, history, crime, tech, sports. Do NOT suggest anything adjacent to the detected source niche.

Find 5 BRIDGE SUB-NICHES from COMPLETELY DIFFERENT content categories than this video.

CRITICAL RULE: Bridge niches must NOT be from the same niche as the source video.

EXAMPLES OF WRONG (too similar):
- Ozempic/health video → "Metabolic Health", "Fitness Supplements", "Workout Routines" ✗
- Finance video → "Investing", "Stock Market", "Crypto" ✗
- Psychology video → "Mental Wellness", "Therapy Tips", "Mindfulness" ✗

EXAMPLES OF RIGHT (true bridge — completely different community):
- Ozempic/health video → "True Crime Psychology" [True Crime], "Financial Anxiety" [Personal Finance], "Biohacking" [Technology], "Dark Psychology" [Psychology], "FIRE Movement" [Finance] ✓
- Finance video → "Speedrunning" [Gaming], "Stoicism" [Philosophy], "True Crime" [Crime], "Neuroscience" [Science] ✓

SUB-NICHES must be SPECIFIC, not broad categories:
- NOT "Gaming" → YES "Speedrunning" or "Indie Game Dev"
- NOT "Psychology" → YES "Dark Psychology" or "Cognitive Biases"
- NOT "Finance" → YES "Financial Anxiety" or "FIRE Movement"
- NOT "Science" → YES "Neuroscience" or "Quantum Physics"

For each bridge sub-niche return EXACTLY these JSON fields:
- "name": specific sub-niche name (2-4 words, e.g. "Dark Psychology")
- "parentNiche": broader category (e.g. "True Crime", "Gaming", "Personal Finance")
- "hook": one sentence on how BOTH audiences connect with this blend
- "algorithmNote": why YouTube recommends this to BOTH communities simultaneously
- "titlePreview": apply EXACTLY this formula "${formula}" to the blended topic

[`,
      }, {
        role: "assistant",
        content: "[",
      }],
    });

    const raw = "[" + (msg.content[0].type === "text" ? msg.content[0].text : "");
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    // Strict field mapping — system prompt enforces exact keys
    const niches = parsed.map((n: any) => ({
      name: n.name || "Unknown",
      parentNiche: n.parentNiche || "",
      hook: n.hook || "",
      algorithmNote: n.algorithmNote || "",
      titlePreview: n.titlePreview || "",
    }));
    return NextResponse.json({ niches });
  } catch (e: any) {
    console.error("[suggest-bridge-niches]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to generate bridge niches" }, { status: 500 });
  }
}
