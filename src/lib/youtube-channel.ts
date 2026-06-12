// Shared YouTube channel scanning: resolve a channel from URL/@handle and
// fetch its recent long-form uploads with stats. Used by the Outlier Finder
// and by Voice Match channel ingestion.

const YT = "https://www.googleapis.com/youtube/v3";

export type ChannelVideo = {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  views: number;
  durationSec: number;
};

export type ChannelScan = {
  channel: { title: string; thumbnail: string; subscribers: number };
  videos: ChannelVideo[]; // long-form (3min+) only
};

function parseChannelInput(raw: string): { channelId?: string; handle?: string; username?: string } {
  const s = raw.trim();
  const idMatch = s.match(/(?:youtube\.com\/channel\/)?(UC[\w-]{20,})/);
  if (idMatch) return { channelId: idMatch[1] };
  const handleMatch = s.match(/youtube\.com\/@([\w.\-]+)/) || s.match(/^@([\w.\-]+)$/);
  if (handleMatch) return { handle: handleMatch[1] };
  const userMatch = s.match(/youtube\.com\/(?:c|user)\/([\w.\-]+)/);
  if (userMatch) return { username: userMatch[1] };
  if (/^[\w.\-]+$/.test(s)) return { handle: s };
  return {};
}

function parseDuration(iso: string): number {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

export async function fetchChannelLongform(channelInput: string): Promise<ChannelScan> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YouTube API not configured");

  const parsed = parseChannelInput(String(channelInput));
  let lookup = "";
  if (parsed.channelId) lookup = `id=${parsed.channelId}`;
  else if (parsed.handle) lookup = `forHandle=${encodeURIComponent(parsed.handle)}`;
  else if (parsed.username) lookup = `forUsername=${encodeURIComponent(parsed.username)}`;
  else throw new Error("Couldn't read that — paste the channel URL or @handle");

  const chRes = await fetch(`${YT}/channels?part=snippet,statistics,contentDetails&${lookup}&key=${key}`);
  const chData = await chRes.json();
  const ch = chData?.items?.[0];
  if (!ch) throw new Error("Channel not found — try the full URL or @handle");

  const uploadsId = ch.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error("Channel has no public uploads");

  const plRes = await fetch(`${YT}/playlistItems?part=contentDetails&playlistId=${uploadsId}&maxResults=50&key=${key}`);
  const plData = await plRes.json();
  const videoIds = (plData?.items ?? []).map((i: any) => i.contentDetails?.videoId).filter(Boolean);
  if (videoIds.length === 0) throw new Error("No recent uploads found");

  const vRes = await fetch(`${YT}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&key=${key}`);
  const vData = await vRes.json();

  const videos: ChannelVideo[] = (vData?.items ?? [])
    .map((v: any) => ({
      videoId: v.id,
      title: v.snippet?.title ?? "",
      thumbnail: v.snippet?.thumbnails?.medium?.url ?? "",
      publishedAt: v.snippet?.publishedAt ?? "",
      views: Number(v.statistics?.viewCount ?? 0),
      durationSec: parseDuration(v.contentDetails?.duration ?? ""),
    }))
    .filter((v: ChannelVideo) => v.durationSec >= 180 && v.views > 0);

  return {
    channel: {
      title: ch.snippet?.title ?? "",
      thumbnail: ch.snippet?.thumbnails?.medium?.url ?? "",
      subscribers: Number(ch.statistics?.subscriberCount ?? 0),
    },
    videos,
  };
}
