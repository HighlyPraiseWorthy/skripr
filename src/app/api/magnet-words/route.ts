import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase";
import { getMagnetTitleStats } from "@/lib/magnet-insights";

export async function GET() {
  if (!supabaseAdmin) return NextResponse.json({ words: [] });
  
  // Fetch all active words
  const { data } = await supabaseAdmin
    .from("magnet_words")
    .select("id, word, grade, lift_range, why_it_works, category")
    .eq("is_active", true)
    .order("grade", { ascending: true });

  const words = data || [];
  
  // Shuffle within each grade, then return a diverse random set
  const byGrade: Record<string, typeof words> = { S: [], A: [], B: [], C: [] };
  words.forEach((w: any) => { if (byGrade[w.grade]) byGrade[w.grade].push(w); });
  
  // Fisher-Yates shuffle per grade
  const shuffle = (arr: typeof words) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  Object.keys(byGrade).forEach(g => shuffle(byGrade[g]));

  // Return all words grouped: S first, then A, B, C — randomized within each tier
  const result = [
    ...byGrade["S"],
    ...byGrade["A"],
    ...byGrade["B"],
    ...byGrade["C"],
  ];

  // #2 Ground in real data: attach how many captured titles each word appears
  // in (and the top views), so the UI can show honest proof + a trending strip.
  const stats: Record<string, { count: number; topViews: number }> =
    await getMagnetTitleStats(result.map((w: any) => w.word)).catch(() => ({}));
  const withProof = result.map((w: any) => {
    const s = stats[String(w.word).toLowerCase()];
    return { ...w, proofCount: s?.count ?? 0, topViews: s?.topViews ?? 0 };
  });
  const trending = withProof
    .filter((w: any) => w.proofCount > 0)
    .sort((a: any, b: any) => b.proofCount - a.proofCount || b.topViews - a.topViews)
    .slice(0, 8);

  return NextResponse.json({ words: withProof, trending });
}
