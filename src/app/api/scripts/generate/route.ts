import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateScript } from "@/lib/ai/claude";

export const maxDuration = 60;

function truncateTranscript(text: string, maxWords = 400): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "...";
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startTime = Date.now();

  try {
    const { transcript, niche, topic, sourceVideoId } = await req.json();
    if (!transcript) return NextResponse.json({ error: "Transcript is required" }, { status: 400 });

    const truncated = truncateTranscript(transcript);
    console.log(`[generate] words: ${transcript.split(/\s+/).length} → ${truncated.split(/\s+/).length}`);

    // Race against a 58s timeout (Vercel Hobby hard cap is 60s; Claude averages 47-58s)
    const scriptPromise = generateScript({
      sourceTranscript: truncated,
      sourceTitle: sourceVideoId ? `YouTube video ${sourceVideoId}` : "Source video",
      sourceNiche: niche || "general",
      targetTopic: topic || "Same topic as source video",
      targetNiche: niche || "general",
      videoLength: "medium",
      tone: "educational",
      ttsOptimized: false,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Script generation timed out — Claude is slow on this request. Could you wait a moment and then try again?")), 58000)
    );

    const script = await Promise.race([scriptPromise, timeoutPromise]);
    console.log(`[generate] completed in ${Date.now() - startTime}ms`);

    return NextResponse.json(script);
  } catch (error: any) {
    console.error("[generate] Error after", Date.now() - startTime, "ms:", error?.message);
    return NextResponse.json(
      { error: error.message || "Failed to generate script" },
      { status: 500 }
    );
  }
}
