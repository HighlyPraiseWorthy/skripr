import { supabaseAdmin } from "@/lib/db/supabase";
import { normalizeNiche } from "@/lib/viral-frameworks";

// Hook Engine feedback loop. When a creator copies/keeps a generated hook, we
// store it as a positive signal. Generation then injects recently-kept hooks
// for the niche as "proven by real taste" examples — so the Hook Engine learns
// what creators actually use, on top of what merely got views.

export interface HookPickRow {
  user_id: string | null;
  niche: string | null;
  topic: string | null;
  hook_text: string;
  hook_type: string | null;
  predicted_retention: number | null;
}

// Awaited-but-swallowed: on Vercel an unawaited promise can be killed when the
// response returns, so we await and swallow rather than detach.
export async function saveHookPick(row: HookPickRow): Promise<void> {
  if (!supabaseAdmin) return;
  if (!row.hook_text || !row.hook_text.trim()) return;
  try {
    const { error } = await supabaseAdmin.from("hook_picks").insert({
      ...row,
      niche: normalizeNiche(row.niche) || row.niche,
    });
    if (error) console.error("[hook-picks] save failed:", error.message);
    else console.log(`[hook-picks] saved niche=${row.niche} type=${row.hook_type}`);
  } catch (e: any) {
    console.error("[hook-picks] save threw:", e?.message);
  }
}

const clip = (s: unknown, n: number) =>
  typeof s === "string" ? (s.length > n ? s.slice(0, n).trimEnd() + "..." : s) : "";

// Build the "creators kept these" few-shot block, plus a one-line note on the
// hook type creators in this niche keep most often. Time-boxed and empty-safe.
const MAX_KEPT_BLOCK_CHARS = 2200;
export async function getKeptHooksBlock(
  rawNiche: string | null | undefined,
  limit = 5
): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const nicheId = normalizeNiche(rawNiche);
  if (!nicheId) return null;
  try {
    const query = supabaseAdmin
      .from("hook_picks")
      .select("hook_type, hook_text, created_at")
      .eq("niche", nicheId)
      .order("created_at", { ascending: false })
      .limit(60);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
    const result = (await Promise.race([query, timeout])) as { data: any[] | null } | null;
    const rows = result?.data;
    if (!rows || rows.length === 0) return null;

    // Dedupe identical kept hooks, keeping the most recent copy.
    const seen = new Set<string>();
    const unique: any[] = [];
    const typeCounts = new Map<string, number>();
    for (const r of rows) {
      const t = String(r.hook_type || "").toLowerCase().trim();
      if (t) typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
      const key = String(r.hook_text || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(r);
    }
    if (unique.length === 0) return null;

    const picked = unique.slice(0, limit);
    const parts: string[] = [];
    let total = 0;
    for (const r of picked) {
      const entry = `- [${r.hook_type || "unknown"}] "${clip(r.hook_text, 220)}"`;
      if (total + entry.length > MAX_KEPT_BLOCK_CHARS) break;
      parts.push(entry);
      total += entry.length;
    }
    if (parts.length === 0) return null;

    // Aggregate taste hint: the type creators in this niche keep most often.
    let topTypeNote = "";
    if (typeCounts.size > 0) {
      const [topType, n] = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topType && n >= 2) {
        topTypeNote = `\nCreators in this niche most often keep "${topType}" hooks — lean toward that pattern unless the topic calls for another.`;
      }
    }

    console.log(`[hook-picks] injected n=${parts.length} niche=${nicheId}`);
    return parts.join("\n") + topTypeNote;
  } catch (e: any) {
    console.error("[hook-picks] block fetch failed:", e?.message);
    return null;
  }
}
