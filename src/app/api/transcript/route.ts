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
    if (!videoId) return NextResponse.json({ error: "Invalid YouTube URL. Supported formats: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/" }, { status: 400 });

    console.log("[transcript] Fetching transcript for videoId:", videoId);

    let segments: any[] = [];

    // Try English first, then fall back to any available language
    const languagesToTry = ["en", "en-US", "en-GB"];
    let lastError: any = null;

    for (const lang of languagesToTry) {
      try {
        segments = await YoutubeTranscript.fetchTranscript(videoId, { lang });
        if (segments && segments.length > 0) {
          console.log(`[transcript] Success with lang=${lang}, segments:`, segments.length);
          break;
        }
      } catch (e: any) {
        console.log(`[transcript] Failed with lang=${lang}:`, e.message);
        lastError = e;
      }
    }

    // If language-specific attempts failed, try without lang param
    if (segments.length === 0) {
      try {
        console.log("[transcript] Trying without language param...");
        segments = await YoutubeTranscript.fetchTranscript(videoId);
        console.log("[transcript] Success without lang, segments:", segments.length);
      } catch (e: any) {
        console.error("[transcript] All attempts failed:", e.message);
        const msg = e?.message || "";
        if (msg.includes("disabled") || msg.includes("Could not get") || msg.includes("No transcripts")) {
          return NextResponse.json({
            error: "This video does not have English captions available. Try a video with English captions enabled.",
          }, { status: 422 });
        }
        return NextResponse.json({
          error: "Transcript extraction failed",
          detail: msg,
        }, { status: 422 });
      }
    }

    if (!segments || segments.length === 0) {
      return NextResponse.json({
        error: "No transcript found for this video.",
      }, { status: 422 });
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
