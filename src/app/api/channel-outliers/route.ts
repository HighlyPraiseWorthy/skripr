import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const maxDuration = 60;

const YT = "https://www.googleapis.com/youtube/v3";

function parseChannelInput(raw: string): { channelId?: string; handle?: string; username?: string } {
  const s = raw.trim();
  const idMatch = s.match(/(?:youtube\.com\/channel\/)?(UC[\w-]{20,})/);
  if (idMatch) return { channelId: idMatch[1] };
  const handleMatch = s.match(/youtube\.com\/@([\w.\-]+)/) || s.match(/^@([\w.\-]+)$/);
  if (handleMatch) return { handle: handleMatch[1] };
  const userMatch = s.match(/youtube\.com\/(?:c|user)\/([\w.\-]+)/);
  if (userMatch) return { username: userMatch[1] };
  // bare text: treat as a handle
  if (/^[\w.\-]+$/.test(s)) return { handle: s };
  return {};
}

function parseDuration(iso: string): number {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return NextResponse.json({ error: "YouTube API not configured" }, { status: 500 });

  try {
    const { channel } = await req.json();
    if (!channel) return NextResponse.json({ error: "Channel URL or @handle required" }, { status: 400 });

    const parsed = parseChannelInput(String(channel));
    let lookup = "";
    if (parsed.channelId) lookup = `id=${parsed.channelId}`;
    else if (parsed.handle) lookup = `forHandle=${encodeURIComponent(parsed.handle)}`;
    else if (parsed.username) lookup = `forUsername=${encodeURIComponent(parsed.username)}`;
    else return NextResponse.json({ error: "Couldn't read that — paste the channel URL or @handle" }, { status: 400 });

    const chRes = await fetch(`${YT}/channels?part=snippet,statistics,contentDetails&${lookup}&key=${key}`);
    const chData = await chRes.json();
    const ch = chData?.items?.[0];
    if (!ch) return NextResponse.json({ error: "Channel not found — try the full URL or @handle" }, { status: 404 });

    const uploadsId = ch.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) return NextResponse.json({ error: "Channel has no public uploads" }, { status: 404 });

    const plRes = await fetch(`${YT}/playlistItems?part=contentDetails&playlistId=${uploadsId}&maxResults=50&key=${key}`);
    const plData = await plRes.json();
    const videoIds = (plData?.items ?? []).map((i: any) => i.contentDetails?.videoId).filter(Boolean);
    if (videoIds.length === 0) return NextResponse.json({ error: "No recent uploads found" }, { status: 404 });

    const vRes = await fetch(`${YT}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&key=${key}`);
    const vData = await vRes.json();

    // Long-form only — shorts have a different views economy and poison the baseline
    const videos = (vData?.items ?? [])
      .map((v: any) => ({
        videoId: v.id,
        title: v.snippet?.title ?? "",
        thumbnail: v.snippet?.thumbnails?.medium?.url ?? "",
        publishedAt: v.snippet?.publishedAt ?? "",
        views: Number(v.statistics?.viewCount ?? 0),
        durationSec: parseDuration(v.contentDetails?.duration ?? ""),
      }))
      .filter((v: any) => v.durationSec >= 180 && v.views > 0);

    if (videos.length < 4) {
      return NextResponse.json({ error: "Not enough long-form videos on this channel to compute outliers (needs 4+)" }, { status: 422 });
    }

    const sorted = [...videos].sort((a, b) => a.views - b.views);
    const median = sorted[Math.floor(sorted.length / 2)].views || 1;

    const result = videos
      .map((v: any) => ({ ...v, outlierX: Math.round((v.views / median) * 10) / 10 }))
      .sort((a: any, b: any) => b.outlierX - a.outlierX);

    return NextResponse.json({
      channel: {
        title: ch.snippet?.title ?? "",
        thumbnail: ch.snippet?.thumbnails?.medium?.url ?? "",
        subscribers: Number(ch.statistics?.subscriberCount ?? 0),
      },
      medianViews: median,
      videos: result,
    });
  } catch (e: any) {
    console.error("[channel-outliers]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to scan channel" }, { status: 500 });
  }
}
