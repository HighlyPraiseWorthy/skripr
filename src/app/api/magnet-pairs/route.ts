import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserPlan } from "@/lib/usage";
import { supabaseAdmin } from "@/lib/db/supabase";
import { getMagnetTitleStats } from "@/lib/magnet-insights";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// #1 Word pairing: given a primary magnet word (+ optional topic), pick the
// words from the curated vocabulary that AMPLIFY it when combined in a title,
// with a short reason why they compound. Enriched with real-data proof (#2).
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await getUserPlan(userId);
  if (plan === "free") return NextResponse.json({ error: "Starter plan required" }, { status: 403 });

  try {
    const body = await req.json();
    const topic = body.topic;
    // Accept the full current selection (words[]) — fall back to single `word`
    const picked: string[] = Array.isArray(body.words)
      ? body.words.filter(Boolean).map(String)
      : (body.word ? [String(body.word)] : []);
    if (picked.length === 0) return NextResponse.json({ pairs: [] });
    if (!supabaseAdmin) return NextResponse.json({ pairs: [] });

    const pickedLower = new Set(picked.map(w => w.toLowerCase()));
    const { data } = await supabaseAdmin
      .from("magnet_words")
      .select("word")
      .eq("is_active", true);
    const vocab: string[] = (data || []).map((w: any) => w.word).filter((w: string) => !pickedLower.has(w.toLowerCase()));
    if (vocab.length === 0) return NextResponse.json({ pairs: [] });

    const stack = picked.join(" + ");
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: `You output ONLY a valid JSON array. No prose, no markdown. Start with [ and end with ].`,
      messages: [{
        role: "user",
        content: `A creator is stacking these viral title words: "${stack}"${topic ? ` for a video about: "${String(topic).slice(0, 120)}"` : ""}.

From this list of proven title words, pick the 4 that would most AMPLIFY this combination if added — words that compound the curiosity, emotion, or stakes of "${stack}" rather than overlap with what's already there:
${vocab.join(", ")}

For each, return: {"word": "exact word from the list", "why": "one short clause on why it strengthens the ${stack} combination"}.
Return a JSON array of exactly 4 objects, best addition first.`,
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "[]";
    let pairs: { word: string; why: string }[] = [];
    try { pairs = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { pairs = []; }
    pairs = (Array.isArray(pairs) ? pairs : []).filter(p => p?.word).slice(0, 4);

    // Attach honest proof from the captured-title pool
    const stats = await getMagnetTitleStats([...picked, ...pairs.map(p => p.word)]).catch(() => ({} as any));
    const enriched = pairs.map(p => {
      const s = stats[p.word.toLowerCase()];
      return { ...p, proofCount: s?.count ?? 0 };
    });

    return NextResponse.json({ pairs: enriched });
  } catch (e: any) {
    console.error("[magnet-pairs]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to find pairings" }, { status: 500 });
  }
}
