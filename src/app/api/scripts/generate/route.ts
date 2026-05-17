import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateScript } from "@/lib/ai/claude";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { transcript, niche, topic, sourceVideoId } = await req.json();
    if (!transcript) return NextResponse.json({ error: "Transcript is required" }, { status: 400 });

    const script = await generateScript({
      sourceTranscript: transcript,
      sourceTitle: sourceVideoId ? `YouTube video ${sourceVideoId}` : "Source video",
      sourceNiche: niche || "general",
      targetTopic: topic || "Same topic as source video",
      targetNiche: niche || "general",
      videoLength: "medium",
      tone: "educational",
      ttsOptimized: false,
    });

    return NextResponse.json(script);
  } catch (error: any) {
    console.error("Script generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate script" }, { status: 500 });
  }
}
