import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase";

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

  return NextResponse.json({ words: result });
}
