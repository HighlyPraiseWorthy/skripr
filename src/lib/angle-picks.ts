import { supabaseAdmin } from "@/lib/db/supabase";
import { normalizeNiche } from "@/lib/viral-frameworks";

// Angle feedback loop. When a creator generates a script from an angle, we bank
// it as a positive signal. "Suggest Angles" then injects recently/frequently
// picked angles for the niche, so suggestions converge on the kinds of framing
// creators actually choose — and a "most-picked hook type / emotion" hint.

export interface AnglePickRow {
  user_id: string | null;
  niche: string | null;
  topic: string | null;
  angle_text: string;
  hook_type: string | null;
  audience_emotion: string | null;
}

// Awaited-but-swallowed: on Vercel an unawaited promise can be killed when the
// response returns, so we await and swallow rather than detach.
export async function saveAnglePick(row: AnglePickRow): Promise<void> {
  if (!supabaseAdmin) return;
  if (!row.angle_text || !row.angle_text.trim()) return;
  try {
    const { error } = await supabaseAdmin.from("angle_picks").insert({
      ...row,
      angle_text: row.angle_text.slice(0, 600),
      niche: normalizeNiche(row.niche) || row.niche,
    });
    if (error) console.error("[angle-picks] save failed:", error.message);
    else console.log(`[angle-picks] saved niche=${row.niche}`);
  } catch (e: any) {
    console.error("[angle-picks] save threw:", e?.message);
  }
}

const clip = (s: unknown, n: number) =>
  typeof s === "string" ? (s.length > n ? s.slice(0, n).trimEnd() + "..." : s) : "";

// Build the "angles creators picked" block + a most-picked type/emotion hint.
// Time-boxed and empty-safe so it never delays angle suggestion.
const MAX_ANGLE_BLOCK_CHARS = 2200;
export async function getPickedAnglesBlock(
  rawNiche: string | null | undefined,
  limit = 6
): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const nicheId = normalizeNiche(rawNiche);
  if (!nicheId) return null;
  try {
    const query = supabaseAdmin
      .from("angle_picks")
      .select("angle_text, hook_type, audience_emotion, created_at")
      .eq("niche", nicheId)
      .order("created_at", { ascending: false })
      .limit(60);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
    const result = (await Promise.race([query, timeout])) as { data: any[] | null } | null;
    const rows = result?.data;
    if (!rows || rows.length === 0) return null;

    const seen = new Set<string>();
    const unique: any[] = [];
    const typeCounts = new Map<string, number>();
    const emoCounts = new Map<string, number>();
    for (const r of rows) {
      const t = String(r.hook_type || "").toLowerCase().trim();
      if (t) typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
      const e = String(r.audience_emotion || "").toLowerCase().trim();
      if (e) emoCounts.set(e, (emoCounts.get(e) || 0) + 1);
      const key = String(r.angle_text || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(r);
    }
    if (unique.length === 0) return null;

    const parts: string[] = [];
    let total = 0;
    for (const r of unique.slice(0, limit)) {
      const tag = r.hook_type ? `[${String(r.hook_type).toUpperCase()}] ` : "";
      const entry = `- ${tag}${clip(r.angle_text, 200)}`;
      if (total + entry.length > MAX_ANGLE_BLOCK_CHARS) break;
      parts.push(entry);
      total += entry.length;
    }
    if (parts.length === 0) return null;

    const top = (m: Map<string, number>) => {
      const e = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      return e && e[1] >= 2 ? e[0] : null;
    };
    const hints: string[] = [];
    const tt = top(typeCounts);
    const te = top(emoCounts);
    if (tt) hints.push(`hook type "${tt}"`);
    if (te) hints.push(`the emotion "${te}"`);
    const hint = hints.length ? `\nCreators in this niche most often pick ${hints.join(" and ")} — favor that unless the topic calls for another.` : "";

    console.log(`[angle-picks] injected n=${parts.length} niche=${nicheId}`);
    return parts.join("\n") + hint;
  } catch (e: any) {
    console.error("[angle-picks] block fetch failed:", e?.message);
    return null;
  }
}
