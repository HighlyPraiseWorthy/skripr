import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Best-effort in-memory IP rate limit (per serverless instance). Ungated tool,
// so this keeps a scraper from draining the Anthropic budget.
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

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  if (limited(ip)) {
    return NextResponse.json(
      { error: "You have used this a lot in the last hour. Try again later, or sign up to keep going." },
      { status: 429 }
    );
  }

  try {
    const { niche, exclude } = await req.json();
    if (!niche || !String(niche).trim()) {
      return NextResponse.json({ error: "Add your niche or topic first." }, { status: 400 });
    }
    const n = String(niche).slice(0, 160);
    const excludeList: string[] = Array.isArray(exclude) ? exclude.filter(Boolean).slice(-40) : [];
    const excludeLine = excludeList.length
      ? `\nAlready shown, do NOT repeat these or close variants: ${excludeList.join(" | ")}.`
      : "";

    const prompt = `Generate 8 YouTube video ideas for this niche or topic: ${n}.${excludeLine}

For each idea return:
- "title": a click-worthy video title under 70 characters. Open a real curiosity gap or promise a clear payoff. No clickbait it cannot deliver, no emojis.
- "why": one short sentence on the angle, the reason a viewer would click and stay (the hook or tension behind it).

Rules:
- Build on proven structures that already work on YouTube (curiosity gaps, stakes, contrarian takes, specific numbers, transformation). Each idea uses a different angle.
- Concrete and specific to the niche, not generic. No made-up statistics or fake view counts. These are ideas, not predictions.

Return ONLY a valid JSON object, no markdown fences: { "ideas": [ { "title": "...", "why": "..." } ] }`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      temperature: 1,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const data = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not generate, please try again" }, { status: 500 });
  }
}
