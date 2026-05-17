import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { YoutubeTranscript } from "youtube-transcript";

export const maxDuration = 30;

function extractVideoId(url: string): string | null {
  try {
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
      /(?:youtu\.be\/)([^&\n?#]+)/,
      /(?:youtube\.com\/shorts\/)([^&\n?#]+)/,
      /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { youtubeUrl } = await req.json();
    if (!youtubeUrl) return NextResponse.json({ error: "YouTube URL is required" }, { status: 400 });

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) return NextResponse.json({ error: "Invalid YouTube URL." }, { status: 400 });

    console.log("[transcript] Fetching for videoId:", videoId);

    let segments: any[] = [];

    // Strategy 1: try lang=en directly
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
      console.log("[transcript] lang=en success, segments:", segments.length);
    } catch (e1: any) {
      console.log("[transcript] lang=en failed:", e1.message?.slice(0, 80));

      // Strategy 2: fetch default (no lang), filter for English segments
      try {
        const all = await YoutubeTranscript.fetchTranscript(videoId);
        console.log("[transcript] no-lang success, segments:", all.length, "lang:", all[0]?.lang);

        // If we got segments, check if they contain English-like text
        // by checking if any segment's lang is 'en' or starts with 'en'
        const hasEnglish = all.some((s: any) =>
          s.lang && (s.lang === "en" || s.lang.startsWith("en-"))
        );

        if (hasEnglish) {
          segments = all.filter((s: any) =>
            s.lang && (s.lang === "en" || s.lang.startsWith("en-"))
          );
        } else {
          // Use whatever we got — it's still a transcript even if not English
          // We'll pass it to Claude which can work with it
          segments = all;
        }
        console.log("[transcript] using segments:", segments.length);
      } catch (e2: any) {
        console.error("[transcript] all attempts failed:", e2.message);
        const msg = e2?.message || "";
        if (msg.includes("disabled") || msg.includes("Could not get") || msg.includes("No transcripts")) {
          return NextResponse.json({
            error: "This video does not have captions available. Try a different video.",
          }, { status: 422 });
        }
        return NextResponse.json({
          error: "Could not extract transcript from this video.",
          detail: msg,
        }, { status: 422 });
      }
    }

    if (!segments || segments.length === 0) {
      return NextResponse.json({ error: "No transcript found for this video." }, { status: 422 });
    }

    const transcript = segments.map((s: any) => s.text).join(" ").replace(/\s+/g, " ").trim();
    const wordCount = transcript.split(/\s+/).length;
    const estimatedDuration = Math.round(wordCount / 150);

    return NextResponse.json({
      videoId,
      transcript,
      wordCount,
      estimatedDuration,
      segmentCount: segments.length,
    });
  } catch (error: any) {
    console.error("[transcript] Unexpected error:", error);
    return NextResponse.json({ error: error.message || "Failed to extract transcript" }, { status: 500 });
  }
}
