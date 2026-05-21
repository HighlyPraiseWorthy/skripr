import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateScript } from "@/lib/ai/claude";
import { checkScriptLimit } from "@/lib/usage";
import { getMagnetSuggestions } from "@/lib/magnet-word";

export const maxDuration = 60;

function truncateTranscript(text: string, maxWords = 400): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "...";
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Hard block — check limit before burning API credits
  const { allowed, plan, used, limit } = await checkScriptLimit(userId);
  if (!allowed) {
    return NextResponse.json({
      error: `Your free trial has ended (${used}/${limit} scripts used). Subscribe to keep generating.`,
      limitReached: true,
      plan,
    }, { status: 403 });
  }

  const startTime = Date.now();

  try {
    const { transcript, niche, topic, sourceVideoId, videoLength = "long", viralMagnetWord } = await req.json();

    const maxWords: Record<string, number> = { short: 200, medium: 400, long: 500, ultraLong: 600 };
    const cap = maxWords[videoLength] ?? 400;
    const truncated = truncateTranscript(transcript || "", cap);
    console.log(`[generate] length=${videoLength}`);

    const scriptPromise = generateScript({
      sourceTranscript: truncated,
      targetTopic: topic || "",
      targetNiche: niche || "general",
      sourceTitle: topic || "",
      sourceNiche: niche || "general",
      videoLength: videoLength as any,
      tone: "entertaining",
      ttsOptimized: false,
      viralMagnetWord: viralMagnetWord || undefined,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Script generation timed out — Claude is slow on this request. Could you wait a moment and then try again?")), 58000)
    );

    const script = await Promise.race([scriptPromise, timeoutPromise]) as any;
    const elapsed = Date.now() - startTime;
    console.log(`[generate] done in ${elapsed}ms`);

    let magnetSuggestions: import("@/lib/magnet-word").MagnetSuggestion[] = [];
    try {
      magnetSuggestions = await getMagnetSuggestions(script.title || "", niche || "general");
    } catch (e) {
      console.error("[magnet] suggestion error:", e);
    }
    return NextResponse.json({ ...script, magnetSuggestions });
  } catch (error: any) {
    console.error("Script generation error:", error.message);
    return NextResponse.json({ error: error.message || "Failed to generate script" }, { status: 500 });
  }
}
