import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase";

export async function GET() {
  if (!supabaseAdmin) return NextResponse.json({ words: [] });
  const { data } = await supabaseAdmin
    .from("magnet_words")
    .select("id, word, grade, lift_range, why_it_works, category")
    .eq("is_active", true)
    .order("grade", { ascending: true })
    .limit(24);

  const words = data || [];
  const byGrade: Record<string, typeof words> = { S: [], A: [], B: [], C: [] };
  words.forEach((w: any) => { if (byGrade[w.grade]) byGrade[w.grade].push(w); });

  // Return 2 S, 2 A, 1 B, 1 C — variety across grades
  const diverse = [
    ...byGrade["S"].slice(0, 2),
    ...byGrade["A"].slice(0, 2),
    ...byGrade["B"].slice(0, 1),
    ...byGrade["C"].slice(0, 1),
  ];

  return NextResponse.json({ words: diverse });
}
