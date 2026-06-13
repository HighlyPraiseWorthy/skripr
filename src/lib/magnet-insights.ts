import { supabaseAdmin } from "@/lib/db/supabase";

// #2 Real-data grounding: how often each magnet word actually appears in the
// titles Skripr has captured (viral_frameworks.video_title), tracking the top
// view count it showed up on. Honest proof — counts of real proven titles, not
// invented multipliers. Time-boxed and empty-safe; grows as the pool grows.

export interface MagnetWordStat { count: number; topViews: number; }

export async function getMagnetTitleStats(vocab: string[]): Promise<Record<string, MagnetWordStat>> {
  const out: Record<string, MagnetWordStat> = {};
  if (!supabaseAdmin || vocab.length === 0) return out;
  try {
    const query = supabaseAdmin
      .from("viral_frameworks")
      .select("video_title, source_views")
      .not("video_title", "is", null)
      .limit(1000);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const result = (await Promise.race([query, timeout])) as { data: any[] | null } | null;
    const rows = result?.data;
    if (!rows || rows.length === 0) return out;

    // Precompile one word-boundary regex per magnet word
    const matchers = vocab.map(w => ({
      key: w.toLowerCase(),
      re: new RegExp(`\\b${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
    }));

    for (const row of rows) {
      const title = String(row.video_title || "");
      if (!title) continue;
      const views = Number(row.source_views || 0);
      for (const m of matchers) {
        if (m.re.test(title)) {
          const cur = out[m.key] || { count: 0, topViews: 0 };
          cur.count += 1;
          cur.topViews = Math.max(cur.topViews, views);
          out[m.key] = cur;
        }
      }
    }
    return out;
  } catch {
    return out;
  }
}
