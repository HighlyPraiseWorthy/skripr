import { YoutubeTranscript } from "youtube-transcript";

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const YT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export async function getVideoMeta(videoId: string): Promise<{ title: string; thumbnail: string; channelTitle: string }> {
  const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  // Method 1: noembed (more reliable than YouTube's own oEmbed)
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`,
      { headers: { "User-Agent": YT_HEADERS["User-Agent"] } }
    );
    if (res.ok) {
      const d = await res.json();
      if (d.title && !d.error) {
        return { title: d.title, thumbnail, channelTitle: d.author_name || "Unknown" };
      }
    }
  } catch {}

  // Method 2: YouTube oEmbed
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (res.ok) {
      const d = await res.json();
      if (d.title) return { title: d.title, thumbnail, channelTitle: d.author_name || "Unknown" };
    }
  } catch {}

  // Method 3: Scrape YouTube page (same approach as youtube-transcript.io)
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { headers: YT_HEADERS });
    if (res.ok) {
      const html = await res.text();
      const titleMatch = html.match(/"title":\s*"((?:[^"\\]|\\.)*)"/);
      const channelMatch = html.match(/"ownerChannelName":\s*"((?:[^"\\]|\\.)*)"/);
      if (titleMatch) {
        return {
          title: titleMatch[1]
            .replace(/\\u0026/g, "&")
            .replace(/\\n/g, "")
            .replace(/\\"/g, '"'),
          thumbnail,
          channelTitle: channelMatch ? channelMatch[1] : "Unknown",
        };
      }
    }
  } catch {}

  throw new Error("Could not fetch video metadata");
}

// Robust JSON extraction from ytInitialPlayerResponse
function extractPlayerResponse(html: string): any {
  const key = "ytInitialPlayerResponse";
  const idx = html.indexOf(key);
  if (idx === -1) throw new Error("ytInitialPlayerResponse not found");

  const braceStart = html.indexOf("{", idx + key.length);
  if (braceStart === -1) throw new Error("JSON start not found");

  let depth = 0;
  for (let i = braceStart; i < Math.min(html.length, braceStart + 500000); i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) return JSON.parse(html.slice(braceStart, i + 1));
    }
  }
  throw new Error("JSON end not found");
}

export async function getTranscript(videoId: string): Promise<string> {
  // Method 1: youtube-transcript package (English)
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
    if (segments?.length) return segments.map((s) => s.text).join(" ");
  } catch {}

  // Method 2: youtube-transcript package — no language constraint (picks first track)
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (segments?.length) return segments.map((s) => s.text).join(" ");
  } catch {}

  // Method 3: Direct ytInitialPlayerResponse — the same approach youtube-transcript.io uses
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: YT_HEADERS,
    });
    if (!pageRes.ok) throw new Error(`YouTube page returned ${pageRes.status}`);

    const html = await pageRes.text();
    const playerData = extractPlayerResponse(html);

    const captionTracks: any[] =
      playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

    if (captionTracks.length === 0) throw new Error("No caption tracks found");

    // Prefer manual English, then auto-generated English, then first available
    const track =
      captionTracks.find((t: any) => t.languageCode === "en" && !t.kind) ||
      captionTracks.find((t: any) => t.languageCode === "en") ||
      captionTracks.find((t: any) => t.languageCode?.startsWith("en")) ||
      captionTracks[0];

    const captionRes = await fetch(`${track.baseUrl}&fmt=json3`, { headers: YT_HEADERS });
    if (!captionRes.ok) throw new Error(`Caption fetch returned ${captionRes.status}`);

    const captionData = await captionRes.json();
    return (captionData.events ?? [])
      .filter((e: any) => e.segs)
      .map((e: any) =>
        e.segs
          .map((s: any) => s.utf8 ?? "")
          .join("")
          .replace(/\n/g, " ")
      )
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } catch (e: any) {
    throw new Error(`No transcript available for this video. ${e?.message ?? ""}`);
  }
}

// Supadata-first transcript fetch: direct YouTube scraping is IP-blocked from
// Vercel, so prefer the Supadata API (same approach the viral-remixer route
// uses) and fall back to the direct methods for local/dev environments.
export async function getTranscriptRobust(videoId: string): Promise<string> {
  const supaKey = process.env.SUPADATA_API_KEY;
  if (supaKey) {
    // lang=en first: multi-language channels (e.g. Kurzgesagt) can otherwise
    // return a non-English caption track as the default
    for (const langParam of ["&lang=en", ""]) {
      try {
        const r = await fetch(
          `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=true${langParam}`,
          { headers: { "x-api-key": supaKey }, signal: AbortSignal.timeout(15000) }
        );
        if (r.ok) {
          const d = await r.json();
          const t = typeof d === "string" ? d : (d.content ?? d.transcript ?? d.text ?? "");
          if (typeof t === "string" && t.trim()) return t;
        }
      } catch { /* try next */ }
    }
  }
  return getTranscript(videoId);
}
