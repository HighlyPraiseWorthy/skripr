import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/db/supabase";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  }
  return anthropicClient;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let magnetWord: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    magnetWord = body.magnetWord;
  } catch { /* no body */ }

  const { data: script } = await supabaseAdmin!
    .from("scripts")
    .select("content, title, niche")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!script) return NextResponse.json({ error: "Script not found" }, { status: 404 });

  const preview = (script.content || "").slice(0, 1800);

  const magnetInstruction = magnetWord
    ? `\nCRITICAL: Every title MUST be built around the magnet word "${magnetWord}". Build the title around this word — don't just append it.`
    : "";

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    messages: [{
      role: "user",
      content: `You are a YouTube title expert. Generate exactly 5 viral title variations for this script using these proven patterns from 3M–10M+ view videos.${magnetInstruction}

PATTERN 1 — BOLD DECLARATION (2–6 words, strong verb or adjective):
"AI Slop Is Destroying The Internet" · "Pregnancy is Insane" · "GERMANY IS OVER"
→ Subject + strong verb/adjective. Short. One word carries all the weight.

PATTERN 2 — "ACTUALLY" (challenges what viewer already believes):
"Ozzy Osbourne Is Actually the GREATEST Frontman Ever" · "The Uncomfortable Truth About Ozempic"
→ "Actually" signals the viewer has been wrong. Instantly creates tension.

PATTERN 3 — DIRECT ADDRESS (You / Your / We):
"You're More Stressed Than Ever" · "You Need To Quit Weed." · "We Found a Loophole"
→ Names their specific situation. Full stop = conviction.

PATTERN 4 — SUPERLATIVE + STAKES:
"This Is the Scariest Place in The Universe" · "The Dumbest Animal Alive"
→ THE (not A). Civilization-scale or deeply personal stakes.

PATTERN 5 — TWO UNEXPECTED THINGS COLLIDING:
"How Nuclear Flies Protect You from Flesh-Eating Parasites"
→ Bizarre juxtaposition forces a click.

HARD RULES:
- Under 65 characters
- ONE strong emotional word (Insane, Scariest, Actually, Destroying, Worst, Dead, Real, Weird, Truth, Wrong)
- NEVER: "How to use", "The best", "Complete guide", "Top 10", colons splitting two weak halves
- Must directly reflect the script — no misleading clickbait
- Sound like a human said it out loud
- Use a different pattern for each of the 5 titles

Current title: "${script.title}"
Niche: ${script.niche || "general"}
Script opening:
${preview}

Return ONLY a valid JSON array of exactly 5 title strings. No explanation, no markdown fences, just the raw JSON array.`,
    }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";

  let titles: string[] = [];
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) titles = parsed.slice(0, 5).map(String);
  } catch {
    titles = raw
      .split("\n")
      .map(l => l.replace(/^[\s"\[\]\d\.\-\*,]+/, "").replace(/[",\]]+$/, "").trim())
      .filter(l => l.length > 10)
      .slice(0, 5);
  }

  return NextResponse.json({ titles });
}
