import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Best-effort in-memory IP rate limit (per serverless instance). The tools are
// ungated, so this keeps a scraper from draining the Anthropic budget.
const hits = new Map<string, { count: number; reset: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.reset) {
    hits.set(ip, { count: 1, reset: now + 3_600_000 });
    return false;
  }
  e.count++;
  return e.count > 40;
}

function prompt(tool: string, topic: string, opts: { keywords?: string; style?: string; keyPoints?: string; excludeLine: string }): string {
  const t = topic.slice(0, 160);
  if (tool === "tags") {
    const kw = opts.keywords ? ` Work in these themes if they fit: ${opts.keywords.slice(0, 120)}.` : "";
    return `Generate YouTube tags for a video about: ${t}.${kw}${opts.excludeLine}

Rules:
- Return 18 to 22 tags. Each is a short search phrase of 1 to 4 words that a real person would type.
- Put the most important, exact-match keyword first.
- Mix a few broad tags with several specific long-tail ones.
- No hashtags, no numbering, no quotes, no unrelated filler.

Return ONLY a valid JSON object, no markdown fences: { "tags": ["tag one", "tag two"] }`;
  }
  if (tool === "title") {
    const style = opts.style ? ` Preferred vibe: ${opts.style.slice(0, 40)}.` : "";
    return `Generate 10 high-CTR YouTube titles for a video about: ${t}.${style}${opts.excludeLine}

Rules:
- Each title is under 60 characters.
- Open a real curiosity gap or promise a clear payoff. Never overpromise or lie.
- Lead with the interesting part. Avoid generic openers like How To or Top 10.
- One strong word per title, no emojis, no clickbait that the video could not deliver.

Return ONLY a valid JSON object, no markdown fences: { "titles": ["Title one", "Title two"] }`;
  }
  if (tool === "hook") {
    const style = opts.style ? ` Preferred tone: ${opts.style.slice(0, 40)}.` : "";
    return `Generate 8 scroll-stopping opening hooks for a YouTube video about: ${t}.${style}${opts.excludeLine}

Rules:
- Each hook is one or two short spoken sentences a creator would actually say in the first 10 seconds.
- Use real angles: open a curiosity gap, raise the stakes, say something that sounds wrong until explained, or name the viewer's exact problem.
- Vary the angle across the 8. No generic openers like In this video or Hey guys.
- Honest. Never promise something the video could not deliver. No emojis, no numbering, no quotes.

Return ONLY a valid JSON object, no markdown fences: { "hooks": ["hook one", "hook two"] }`;
  }
  // description
  const points = opts.keyPoints ? ` Key points to include: ${opts.keyPoints.slice(0, 300)}.` : "";
  return `Write a YouTube video description for a video about: ${t}.${points}

Rules:
- Start with two strong lines that put the main keyword and the core promise up front.
- Then a short paragraph on what the video covers, written for humans, not keyword stuffing.
- End with 3 to 5 relevant hashtags on their own line.
- Around 90 to 140 words total. Natural and honest, never spammy.

Return ONLY a valid JSON object, no markdown fences: { "description": "the full description text with line breaks" }`;
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
    const { tool, topic, keywords, style, keyPoints, exclude } = await req.json();
    if (!topic || !String(topic).trim()) {
      return NextResponse.json({ error: "Add a video topic first." }, { status: 400 });
    }
    if (!["tags", "title", "hook", "description"].includes(tool)) {
      return NextResponse.json({ error: "Unknown tool." }, { status: 400 });
    }

    const excludeList: string[] = Array.isArray(exclude) ? exclude.filter(Boolean).slice(-40) : [];
    const excludeLine = excludeList.length
      ? `\nAlready shown, do NOT repeat these or close variants: ${excludeList.join(", ")}.`
      : "";

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      temperature: 1,
      messages: [{ role: "user", content: prompt(tool, String(topic), { keywords, style, keyPoints, excludeLine }) }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const data = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not generate, please try again" }, { status: 500 });
  }
}
