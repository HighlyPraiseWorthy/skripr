import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const maxDuration = 30;

function extractVideoId(url: string): string | null {
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
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { youtubeUrl } = await req.json();
    if (!youtubeUrl) return NextResponse.json({ error: "YouTube URL is required" }, { status: 400 });

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) return NextResponse.json({ error: "Invalid YouTube URL." }, { status: 400 });

    const apiKey = process.env.SUPADATA_API_KEY;
    if (!apiKey) {
      console.error("[transcript] SUPADATA_API_KEY not set");
      return NextResponse.json({ error: "Transcript service not configured." }, { status: 500 });
    }

    // Fetch video title in parallel (no API key needed)
    let title = "Unknown Title";
    try {
      const embedRes = await fetch(
        `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`,
        { signal: AbortSignal.timeout(5000) }
      );
      const embedData = await embedRes.json().catch(() => ({}));
      if (embedData.title) title = embedData.title;
    } catch {
      // noembed is best-effort — don't block transcript on title fetch failure
    }

    console.log("[transcript] Fetching via Supadata for videoId:", videoId, "title:", title);

    const res = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=true`,
      { headers: { "x-api-key": apiKey } }
    );

    console.log("[transcript] Supadata status:", res.status);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[transcript] Supadata error body:", errBody);

      if (res.status === 404) {
        return NextResponse.json({
          error: "No transcript found. This video may not have captions. Try pasting manually."
        }, { status: 422 });
      }
      if (res.status === 402) {
        return NextResponse.json({
          error: "Transcript service limit reached. Try again later."
        }, { status: 503 });
      }
      return NextResponse.json({
        error: "Could not extract transcript. Try pasting manually."
      }, { status: 422 });
    }

    const data = await res.json();
    const rawTranscript: string = typeof data === "string"
      ? data
      : data.content ?? data.transcript ?? data.text ?? "";

    if (!rawTranscript.trim()) {
      return NextResponse.json({
        error: "Empty transcript returned. Try pasting manually."
      }, { status: 422 });
    }

    const transcript = rawTranscript.replace(/\s+/g, " ").trim();
    const wordCount = transcript.split(/\s+/).length;

    console.log("[transcript] Success — words:", wordCount);

    return NextResponse.json({
      videoId,
      title,
      transcript,
      wordCount,
      estimatedDuration: Math.round(wordCount / 150),
    });

  } catch (error: any) {
    console.error("[transcript] Unexpected error:", error);
    return NextResponse.json({ error: error.message || "Failed to extract transcript" }, { status: 500 });
  }
}
