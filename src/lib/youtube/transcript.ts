import { z } from "zod";

const YT_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function extractVideoId(url: string): string | null {
  const match = url.match(YT_REGEX);
  return match ? match[1] : null;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export interface VideoTranscript {
  videoId: string;
  title: string;
  channelName: string;
  duration: number;
  segments: TranscriptSegment[];
  fullText: string;
}

/**
 * Extract transcript using YouTube's timedtext API.
 * This is a best-effort approach that works for videos with captions.
 * For production, consider using a service like AssemblyAI or Deepgram.
 */
export async function extractTranscript(videoId: string): Promise<VideoTranscript> {
  // First, get video metadata via noembed (no API key needed)
  const embedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
  const embedData = await embedRes.json();

  if (embedData.error) {
    throw new Error("Could not fetch video metadata");
  }

  // Try to get transcript via YouTube's caption track
  const videoPageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  const videoPageHtml = await videoPageRes.text();

  // Extract caption track URL from the page
  const captionMatch = videoPageHtml.match(/"captions":\s*\{[^}]*"playerCaptionsTracklistCaptionRenderer":\s*\{[^}]*"baseUrl":\s*"([^"]+)"/);
  
  let segments: TranscriptSegment[] = [];
  
  if (captionMatch) {
    const captionUrl = captionMatch[1].replace(/\\u0026/g, "&");
    const captionRes = await fetch(captionUrl);
    const captionXml = await captionRes.text();
    
    // Parse XML transcript
    const textMatches = captionXml.matchAll(/<text start="([\d.]+)" dur="([\d.]+)">([^<]+)<\/text>/g);
    for (const m of textMatches) {
      segments.push({
        text: m[3].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
        start: parseFloat(m[1]),
        duration: parseFloat(m[2]),
      });
    }
  }

  const fullText = segments.map(s => s.text).join(" ");

  return {
    videoId,
    title: embedData.title || "Unknown Title",
    channelName: embedData.author_name || "Unknown Channel",
    duration: segments.length > 0 ? segments[segments.length - 1].start + segments[segments.length - 1].duration : 0,
    segments,
    fullText,
  };
}