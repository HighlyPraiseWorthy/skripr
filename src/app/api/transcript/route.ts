import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTranscript } from "@/lib/youtube-transcript";

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

async function fetchTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const d = await res.json().catch(() => ({}));
    if (d.title) return d.title;
  } catch {}
  return "Unknown Title";
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

    // ── No API key: use robust direct method ──────────────────────────────
    if (!apiKey) {
      console.log("[transcript] No SUPADATA_API_KEY — using direct method");
      const [title, transcript] = await Promise.all([
        fetchTitle(videoId),
        getTranscript(videoId),
      ]);
      const wordCount = transcript.split(/\s+/).length;
      console.log("[transcript] Direct method success — words:", wordCount);
      return NextResponse.json({ videoId, title, transcript, wordCount, estimatedDuration: Math.round(wordCount / 150) });
    }

    // ── Primary: Supadata ─────────────────────────────────────────────────
    const [title, supaRes] = await Promise.all([
      fetchTitle(videoId),
      fetch(`https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=true`, {
        headers: { "x-api-key": apiKey },
      }),
    ]);

    console.log("[transcript] Supadata status:", supaRes.status);

    if (!supaRes.ok) {
      console.log("[transcript] Supadata failed — falling back to direct method");
      try {
        const fallbackText = await getTranscript(videoId);
        const wordCount = fallbackText.split(/\s+/).length;
        console.log("[transcript] Fallback success — words:", wordCount);
        return NextResponse.json({ videoId, title, transcript: fallbackText, wordCount, estimatedDuration: Math.round(wordCount / 150) });
      } catch (fbErr: any) {
        console.error("[transcript] Fallback also failed:", fbErr?.message);
      }
      if (supaRes.status === 404) return NextResponse.json({ error: "No transcript found. This video may not have captions. Try pasting manually." }, { status: 422 });
      if (supaRes.status === 402) return NextResponse.json({ error: "Transcript service limit reached. Try again later." }, { status: 503 });
      return NextResponse.json({ error: "Could not extract transcript. Try pasting manually." }, { status: 422 });
    }

    const data = await supaRes.json();
    const rawTranscript: string = typeof data === "string" ? data : data.content ?? data.transcript ?? data.text ?? "";

    if (!rawTranscript.trim()) {
      return NextResponse.json({ error: "Empty transcript returned. Try pasting manually." }, { status: 422 });
    }

    const transcript = rawTranscript.replace(/\s+/g, " ").trim();
    const wordCount = transcript.split(/\s+/).length;
    console.log("[transcript] Supadata success — words:", wordCount);
    return NextResponse.json({ videoId, title, transcript, wordCount, estimatedDuration: Math.round(wordCount / 150) });

  } catch (error: any) {
    console.error("[transcript] Unexpected error:", error);
    return NextResponse.json({ error: error.message || "Failed to extract transcript" }, { status: 500 });
  }
}
