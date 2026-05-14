import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { youtubeUrl } = await req.json();

    if (!youtubeUrl) {
      return NextResponse.json(
        { error: "YouTube URL is required" },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid YouTube URL or video ID" },
        { status: 400 }
      );
    }

    let transcriptLines;
    try {
      transcriptLines = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: "en",
      });
    } catch {
      // Try without language preference as fallback
      try {
        transcriptLines = await YoutubeTranscript.fetchTranscript(videoId);
      } catch (fallbackErr) {
        return NextResponse.json(
          {
            error:
              "Could not fetch transcript. The video may not have captions enabled.",
          },
          { status: 404 }
        );
      }
    }

    const fullText = transcriptLines.map((line: { text: string }) => line.text).join(" ");
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    const estimatedDurationMinutes = Math.round(wordCount / 150); // ~150 words/min speaking rate

    // Try to extract title from first few seconds of transcript
    const previewText = transcriptLines
      .slice(0, 10)
      .map((line: { text: string }) => line.text)
      .join(" ");

    return NextResponse.json({
      success: true,
      videoId,
      transcript: fullText,
      preview: previewText,
      wordCount,
      estimatedDuration: estimatedDurationMinutes,
      segmentCount: transcriptLines.length,
    });
  } catch (error) {
    console.error("Transcript extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract transcript" },
      { status: 500 }
    );
  }
}
