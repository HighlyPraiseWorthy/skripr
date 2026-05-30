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

export async function getTranscript(videoId: string): Promise<string> {
  const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
  return segments.map(s => s.text).join(" ");
}

export async function getVideoMeta(videoId: string): Promise<{ title: string; thumbnail: string; channelTitle: string }> {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  );
  if (!res.ok) throw new Error("Could not fetch video metadata");
  const d = await res.json();
  return {
    title: d.title,
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    channelTitle: d.author_name,
  };
}
