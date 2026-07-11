import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { fetchChannelLongform } from "@/lib/youtube-channel";

export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Best-effort in-memory IP rate limit (per serverless instance), same pattern
// as the other ungated free tools. Protects YouTube quota + Anthropic budget.
const hits = new Map<string, { count: number; reset: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.reset) {
    hits.set(ip, { count: 1, reset: now + 3_600_000 });
    return false;
  }
  e.count++;
  return e.count > 20;
}

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  if (limited(ip)) {
    return NextResponse.json(
      { error: "You have used this a lot in the last hour. Try again later, or use the numbers-only mode below." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    // Action 1: load a channel's recent long-form videos so the user can pick
    // the one that flopped. Public data only, no OAuth, no login.
    if (body.action === "channel") {
      const channel = String(body.channel || "").trim();
      if (!channel) return NextResponse.json({ error: "Paste your channel link or @handle first." }, { status: 400 });

      const scan = await fetchChannelLongform(channel);
      if (!scan.videos.length) {
        return NextResponse.json({ error: "No long-form videos found on that channel. Use the numbers-only mode instead." }, { status: 422 });
      }

      const now = Date.now();
      const videos = scan.videos.map((v) => {
        const days = Math.max((now - new Date(v.publishedAt).getTime()) / 86400000, 1);
        return { videoId: v.videoId, title: v.title, thumbnail: v.thumbnail, views: v.views, publishedAt: v.publishedAt, ageDays: Math.round(days), viewsPerDay: v.views / days };
      });
      const sorted = [...videos].sort((a, b) => a.views - b.views);
      const medianViews = sorted[Math.floor(sorted.length / 2)]?.views || 0;

      return NextResponse.json({ channel: scan.channel, medianViews, videos });
    }

    // Action 2: a short personalized read on the user's actual title, aligned
    // with the deterministic verdict the widget already computed.
    if (body.action === "critique") {
      const title = String(body.title || "").slice(0, 150);
      const verdict = String(body.verdict || "").slice(0, 20);
      const channelName = String(body.channelName || "").slice(0, 80);
      if (!title) return NextResponse.json({ error: "Missing title." }, { status: 400 });

      const focus =
        verdict === "reach"
          ? "The diagnosis is a reach leak: the video never earned a bigger test. Focus on question breadth: run the strip-the-nouns test on the title (remove every proper noun and niche-specific term; does the remaining question still pull a stranger?). If it collapses, say so plainly and show what the universal question underneath could be."
          : verdict === "click"
            ? "The diagnosis is a click leak: people saw it and did not click. Focus on the promise: does the title lead with the most interesting part, open a curiosity gap, and stay under about 60 characters? Name the single weakest part of this title."
            : verdict === "open"
              ? "The diagnosis is an open leak: people clicked and left in the first 30 seconds. Focus on the promise handoff: what exact payoff does this title promise, and what should the first spoken line be so it pays that promise off immediately instead of setting it up?"
              : "Give a short honest read on how well this title earns a click from a stranger, using the strip-the-nouns test for breadth and the promise test for curiosity.";

      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `You are reviewing a YouTube video title for a small creator${channelName ? ` (channel: ${channelName})` : ""}.

TITLE: "${title}"

${focus}

Write 2 short paragraphs, 2 to 3 sentences each. Plain words a 12 year old follows. Warm but direct, like a creator who learned it the hard way. Speak to "you". Be specific about THIS title, quote fragments of it. End with one concrete rewrite direction (a direction, not a list of titles).

Hard rules: no em dashes or en dashes anywhere, no exclamation points, no emojis, no bullet lists, never mention any tool or product. Return ONLY the two paragraphs as plain text.`,
        }],
      });

      const critique = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
      return NextResponse.json({ critique });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Something went wrong, try again" }, { status: 500 });
  }
}
