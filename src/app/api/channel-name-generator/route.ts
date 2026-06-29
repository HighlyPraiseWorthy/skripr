import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Best-effort in-memory IP rate limit (per serverless instance). The tool is
// ungated, so this keeps a scraper from draining the Anthropic budget. It is
// not perfect across instances, but it is enough of a speed bump for an MVP.
const hits = new Map<string, { count: number; reset: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.reset) {
    hits.set(ip, { count: 1, reset: now + 3_600_000 });
    return false;
  }
  e.count++;
  return e.count > 30;
}

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  if (limited(ip)) {
    return NextResponse.json(
      { error: "You have generated a lot of names this hour. Try again later, or sign up to keep going." },
      { status: 429 }
    );
  }

  try {
    const { niche, keywords, style, exclude } = await req.json();
    const nicheLine = niche ? `Channel niche or format: ${String(niche).slice(0, 60)}.` : "";
    const kwLine = keywords ? `Words, names, or themes to work in if they fit naturally: ${String(keywords).slice(0, 120)}.` : "";
    const styleLine = style ? `Preferred vibe: ${String(style).slice(0, 40)}.` : "";
    const excludeList: string[] = Array.isArray(exclude) ? exclude.filter(Boolean).slice(-40) : [];
    const excludeLine = excludeList.length
      ? `\nAlready shown to this user, so do NOT repeat these or close variants. Give 12 completely fresh ones: ${excludeList.join(", ")}.`
      : "";

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      temperature: 1,
      messages: [{
        role: "user",
        content: `Generate 12 YouTube channel name ideas.
${nicheLine}
${kwLine}
${styleLine}${excludeLine}

Rules:
- Each name is 1 to 3 words. Easy to say, easy to spell, easy to remember.
- Mix a few clear niche-fitting names with a few clever or unexpected ones.
- Avoid generic one-word tech or startup names like Nexus, Catalyst, Prism, Momentum, Vault, Core, or Flow, unless the niche clearly calls for it. Favor names with personality or a concrete hook.
- No numbers and no special characters unless the user asked for them.
- Do not copy a famous brand or a well-known creator's name.
- Keep every name clean and broadly usable.

Return ONLY a valid JSON array, no markdown fences, of objects with this exact shape:
[{ "name": "The Name", "vibe": "3 to 6 word note on the feel or who it suits" }]`,
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "[]";
    const names = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json({ names });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not generate names, please try again" }, { status: 500 });
  }
}
