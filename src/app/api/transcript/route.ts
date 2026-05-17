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

async function fetchCaptionTrack(trackUrl: string): Promise<string> {
  const res = await fetch(trackUrl);
  const xml = await res.text();
  // Parse the XML caption format
  const texts = xml.match(/<text[^>]*>([^<]*)<\/text>/g) || [];
  return texts
    .map(t => t.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"'))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { youtubeUrl } = await req.json();
    if (!youtubeUrl) return NextResponse.json({ error: "YouTube URL is required" }, { status: 400 });

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) return NextResponse.json({ error: "Invalid YouTube URL." }, { status: 400 });

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "YouTube API not configured." }, { status: 500 });

    console.log("[transcript] Fetching captions for videoId:", videoId);

    // Step 1: List available caption tracks via YouTube Data API
    const captionListUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
    const captionListRes = await fetch(captionListUrl);
    const captionList = await captionListRes.json();

    console.log("[transcript] Caption list status:", captionListRes.status);
    console.log("[transcript] Captions found:", captionList.items?.length || 0);

    if (!captionList.items || captionList.items.length === 0) {
      // Fall back to youtube-transcript package as backup
      try {
        const { YoutubeTranscript } = await import("youtube-transcript");
        const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
        if (segments && segments.length > 0) {
          const transcript = segments.map((s: any) => s.text).join(" ").replace(/\s+/g, " ").trim();
          const wordCount = transcript.split(/\s+/).length;
          return NextResponse.json({
            videoId,
            transcript,
            wordCount,
            estimatedDuration: Math.round(wordCount / 150),
            segmentCount: segments.length,
          });
        }
      } catch (e) {
        console.log("[transcript] Fallback also failed");
      }
      return NextResponse.json({ error: "No captions available for this video." }, { status: 422 });
    }

    // Step 2: Find English caption track
    const tracks = captionList.items;
    const englishTrack = tracks.find((t: any) =>
      t.snippet.language === "en" || t.snippet.language.startsWith("en-")
    ) || tracks[0]; // fall back to first available track

    console.log("[transcript] Using track:", englishTrack.snippet.language, englishTrack.snippet.trackKind);

    // Step 3: Download the caption track
    // Note: This requires OAuth for private captions, but auto-generated captions
    // on public videos can be fetched via a known URL pattern
    const captionDownloadUrl = `https://www.googleapis.com/youtube/v3/captions/${englishTrack.id}?tfmt=srv3&key=${apiKey}`;
    const captionRes = await fetch(captionDownloadUrl);

    if (!captionRes.ok) {
      console.log("[transcript] Caption download failed:", captionRes.status);
      // Try youtube-transcript as backup
      try {
        const { YoutubeTranscript } = await import("youtube-transcript");
        const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
        if (segments && segments.length > 0) {
          const transcript = segments.map((s: any) => s.text).join(" ").replace(/\s+/g, " ").trim();
          const wordCount = transcript.split(/\s+/).length;
          return NextResponse.json({
            videoId,
            transcript,
            wordCount,
            estimatedDuration: Math.round(wordCount / 150),
            segmentCount: segments.length,
          });
        }
      } catch (e) { /* ignore */ }
      return NextResponse.json({ error: "Could not download captions. The video may have restricted captions." }, { status: 422 });
    }

    const captionText = await captionRes.text();
    const transcript = captionText
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();

    const wordCount = transcript.split(/\s+/).length;

    return NextResponse.json({
      videoId,
      transcript,
      wordCount,
      estimatedDuration: Math.round(wordCount / 150),
      segmentCount: Math.ceil(wordCount / 10),
    });

  } catch (error: any) {
    console.error("[transcript] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to extract transcript" }, { status: 500 });
  }
}
