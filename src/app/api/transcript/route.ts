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

    let segments;
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (transcriptError: any) {
      const msg = transcriptError?.message || "";
      if (msg.includes("disabled") || msg.includes("Could not get")) {
        return NextResponse.json({ error: "This video does not have captions/transcript available. Try a different video." }, { status: 422 });
      }
      if (msg.includes("private") || msg.includes("unavailable")) {
        return NextResponse.json({ error: "This video is private or unavailable." }, { status: 422 });
      }
      throw transcriptError;
    }

    if (!segments || segments.length === 0) {
      return NextResponse.json({ error: "No transcript found for this video. The video may not have captions enabled." }, { status: 422 });
    }

    const transcript = segments.map(s => s.text).join(" ").replace(/\s+/g, " ").trim();
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
    console.error("Transcript extraction error:", error);
    return NextResponse.json({ error: error.message || "Failed to extract transcript" }, { status: 500 });
  }
}
