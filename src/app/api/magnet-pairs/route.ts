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
    const { word, topic } = await req.json();
    if (!word?.trim()) return NextResponse.json({ error: "word required" }, { status: 400 });
    if (!supabaseAdmin) return NextResponse.json({ pairs: [] });

    const { data } = await supabaseAdmin
      .from("magnet_words")
      .select("word")
      .eq("is_active", true);
    const vocab: string[] = (data || []).map((w: any) => w.word).filter((w: string) => w.toLowerCase() !== String(word).toLowerCase());
    if (vocab.length === 0) return NextResponse.json({ pairs: [] });

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: `You output ONLY a valid JSON array. No prose, no markdown. Start with [ and end with ].`,
      messages: [{
        role: "user",
        content: `A creator is using the viral title word "${word}"${topic ? ` for a video about: "${String(topic).slice(0, 120)}"` : ""}.

From this list of proven title words, pick the 4 that most AMPLIFY "${word}" when combined in the same title — words that compound the curiosity, emotion, or stakes rather than overlap with it:
${vocab.join(", ")}

For each, return: {"word": "exact word from the list", "why": "one short clause on why it compounds with ${word}"}.
Return a JSON array of exactly 4 objects, best pairing first.`,
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "[]";
    let pairs: { word: string; why: string }[] = [];
    try { pairs = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { pairs = []; }
    pairs = (Array.isArray(pairs) ? pairs : []).filter(p => p?.word).slice(0, 4);

    // Attach honest proof from the captured-title pool
    const stats = await getMagnetTitleStats([word, ...pairs.map(p => p.word)]).catch(() => ({} as any));
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
