import { supabaseAdmin } from "@/lib/db/supabase";

export type MagnetGrade = "S" | "A" | "B" | "C";

export interface MagnetWord {
  id: string;
  word: string;
  grade: MagnetGrade;
  category: string;
  lift_range: string;
  why_it_works: string;
  example_before: string;
  example_after: string;
  niches: string[];
}

export interface MagnetSuggestion {
  word: MagnetWord;
  injectedTitle: string;
  score: number;
}

async function fetchActiveWords(): Promise<MagnetWord[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("magnet_words")
    .select("*")
    .eq("is_active", true)
    .order("grade", { ascending: true });
  if (error) { console.error("magnet_words fetch error:", error); return []; }
  return data || [];
}

function titleAlreadyHasWord(title: string, words: MagnetWord[]): boolean {
  const lower = title.toLowerCase();
  return words.some(w => lower.includes(w.word.toLowerCase()));
}

function scoreWord(word: MagnetWord, niche: string): number {
  const gradeScore: Record<MagnetGrade, number> = { S: 100, A: 75, B: 50, C: 25 };
  const nicheBonus = word.niches.length === 0 ? 10
    : word.niches.some(n => niche.toLowerCase().includes(n.toLowerCase())) ? 20 : 0;
  return gradeScore[word.grade] + nicheBonus;
}

function injectWord(title: string, word: string): string {
  if (title.toLowerCase().includes(word.toLowerCase())) return title;
  if (/^how to /i.test(title)) return title.replace(/^(how to )/i, `$1${word} `);
  if (/^why /i.test(title)) return title.replace(/^(why )/i, `$1${word} `);
  return `${word}: ${title}`;
}

export async function getMagnetSuggestions(
  title: string,
  niche: string = "general"
): Promise<MagnetSuggestion[]> {
  const words = await fetchActiveWords();
  if (titleAlreadyHasWord(title, words)) return [];
  return words
    .map(w => ({
      word: w,
      injectedTitle: injectWord(title, w.word),
      score: scoreWord(w, niche),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
