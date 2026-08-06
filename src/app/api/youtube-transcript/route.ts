import { NextResponse, after } from "next/server";
import { extractVideoId, getVideoMeta, getTranscriptRobust } from "@/lib/youtube-transcript";
import { captureFrameworkInBackground } from "@/lib/framework-capture";

export const maxDuration = 30;

// Best-effort in-memory IP rate limit (per serverless instance). The tool is
// ungated, so this keeps a scraper from draining the Supadata quota.
const hits = new Map<string, { count: number; reset: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.reset) {
    hits.set(ip, { count: 1, reset: now + 3_600_000 });
    return false;
  }
  e.count++;
  return e.count > 25;
}

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  if (limited(ip)) {
    return NextResponse.json(
      { error: "You have used this a lot in the last hour. Try again later, or sign up to keep going." },
      { status: 429 }
    );
  }

  try {
    const { youtubeUrl } = await req.json();
    if (!youtubeUrl || !String(youtubeUrl).trim()) {
      return NextResponse.json({ error: "Paste a YouTube link first." }, { status: 400 });
    }
    const videoId = extractVideoId(String(youtubeUrl));
    if (!videoId) {
      return NextResponse.json({ error: "That does not look like a YouTube link. Paste a full video URL." }, { status: 400 });
    }

    const [transcript, meta] = await Promise.all([
      getTranscriptRobust(videoId),
      getVideoMeta(videoId).catch(() => ({ title: "", thumbnail: "", channelTitle: "" })),
    ]);

    if (!transcript || transcript.trim().length < 20) {
      return NextResponse.json(
        { error: "No captions found for that video. Some videos have captions turned off." },
        { status: 404 }
      );
    }

    // Learn from every proven video that comes through: extract the hook and
    // structure once per video (deduped, bounded cost) so future scripts are
    // written on a wider pool of what actually works. Runs via after() so it
    // executes AFTER the response is sent: never blocks or fails the user's
    // transcript, and is not killed when the function returns (a bare
    // fire-and-forget promise IS killed here, since this route returns in ~2s).
    // Analyzes public YouTube video content only, no user data.
    after(async () => {
      try {
        await captureFrameworkInBackground({ videoId, transcript, title: meta.title || null });
      } catch {}
    });

    const words = transcript.trim().split(/\s+/).length;
    return NextResponse.json({
      transcript: transcript.trim(),
      title: meta.title || "",
      channelTitle: meta.channelTitle || "",
      words,
      readingMinutes: Math.max(1, Math.round(words / 150)),
    });
  } catch (e: any) {
    // getTranscriptRobust THROWS when a video has no caption track, so the
    // empty-transcript check above never sees that case. Without this, a video
    // with captions turned off returned a 500 carrying the raw internal string
    // ("No transcript available for this video. No caption tracks found"), which
    // reads like our bug rather than a normal fact about that video, and buried
    // real faults in error monitoring.
    const raw = String(e?.message || "");
    const noCaptions = /no caption tracks|no transcript available|captions? (are )?(disabled|unavailable)|transcript is disabled/i.test(raw);
    if (noCaptions) {
      return NextResponse.json(
        { error: "No captions found for that video. Some videos have captions turned off, and very new uploads are sometimes not processed yet." },
        { status: 404 }
      );
    }
    console.error("[youtube-transcript]", raw);
    return NextResponse.json(
      { error: "Could not get that transcript, please try again" },
      { status: 500 }
    );
  }
}
