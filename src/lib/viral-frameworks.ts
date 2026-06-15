import { supabaseAdmin } from "@/lib/db/supabase";
import { NICHES } from "@/lib/data/niches";

// Collective learning layer: every Viral Remixer analysis is captured as a
// framework, and script generation injects the best matching frameworks for
// the script's niche as few-shot examples. More remixer usage -> smarter
// generation for everyone.

// Map a freeform niche string ("Psychology × Self-Improvement", "Cooking")
// onto a canonical NICHES id. Exact-match equality between two freeform
// sources would almost never fire — this normalization is what makes the
// capture side and the injection side actually meet.
export function normalizeNiche(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (!s) return null;
  for (const n of NICHES) {
    if (n.id === s || n.name.toLowerCase() === s) return n.id;
  }
  for (const n of NICHES) {
    if (s.includes(n.id) || s.includes(n.name.toLowerCase()) || n.name.toLowerCase().includes(s)) return n.id;
  }
  return null;
}

export interface ViralFrameworkRow {
  video_id: string;
  video_title: string | null;
  niche: string | null;
  hook_type: string | null;
  hook_text: string | null;
  why_it_works: string | null;
  structure: unknown;
  retention_triggers: unknown;
  title_formula: unknown;
  remix_framework: string | null;
  source_views: number | null;
}

// Error-swallowed but awaited: on Vercel an unawaited promise can be killed
// when the response returns, so "fire-and-forget" means swallow, not detach.
export async function saveViralFramework(row: ViralFrameworkRow): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const { error } = await supabaseAdmin
      .from("viral_frameworks")
      .upsert(row, { onConflict: "video_id" });
    if (error) console.error("[frameworks] save failed:", error.message);
    else console.log(`[frameworks] captured video=${row.video_id} niche=${row.niche}`);
  } catch (e: any) {
    console.error("[frameworks] save threw:", e?.message);
  }
}

// Outlier Finder learning: outlier videos are proven over-performers, so their
// TITLES are a high-quality signal for the title pool. We only have titles +
// view counts here (no transcript), so we bank title-only rows. ignoreDuplicates
// means we NEVER clobber a richer row already captured for that video from a
// full analysis — we only add titles the pool doesn't have yet.
export interface OutlierTitleRow { videoId: string; title: string; views: number }
export async function captureOutlierTitles(
  rawNiche: string | null | undefined,
  videos: OutlierTitleRow[]
): Promise<number> {
  if (!supabaseAdmin) return 0;
  const niche = normalizeNiche(rawNiche);
  if (!niche) return 0;
  const rows = videos
    .filter((v) => v.videoId && v.title && v.title.trim())
    .map((v) => ({
      video_id: v.videoId,
      video_title: v.title.slice(0, 300),
      niche,
      source_views: Number.isFinite(v.views) ? Math.round(v.views) : null,
    }));
  if (rows.length === 0) return 0;
  try {
    const { error } = await supabaseAdmin
      .from("viral_frameworks")
      .upsert(rows, { onConflict: "video_id", ignoreDuplicates: true });
    if (error) { console.error("[outliers] capture failed:", error.message); return 0; }
    console.log(`[outliers] captured ${rows.length} titles niche=${niche}`);
    return rows.length;
  } catch (e: any) {
    console.error("[outliers] capture threw:", e?.message);
    return 0;
  }
}

export async function fetchSourceViews(videoId: string): Promise<number | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${key}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const views = d?.items?.[0]?.statistics?.viewCount;
    return views ? Number(views) : null;
  } catch {
    return null;
  }
}

const clip = (s: unknown, n: number) =>
  typeof s === "string" ? (s.length > n ? s.slice(0, n).trimEnd() + "..." : s) : "";

// Build the few-shot examples block for the generation prompt, or null when
// there is nothing useful. Time-boxed so a slow query never delays generation.
const MAX_BLOCK_CHARS = 3200; // ~800 tokens
export async function getNicheFrameworksBlock(rawNiche: string | null | undefined): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const nicheId = normalizeNiche(rawNiche);
  if (!nicheId) return null;
  try {
    const query = supabaseAdmin
      .from("viral_frameworks")
      .select("hook_type, hook_text, why_it_works, structure, remix_framework, source_views")
      .eq("niche", nicheId)
      .order("source_views", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(10);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const result = (await Promise.race([query, timeout])) as { data: any[] | null } | null;
    const rows = result?.data;
    if (!rows || rows.length === 0) return null;

    // Skip title-only rows (e.g. captured from the Outlier Finder, which has no
    // transcript): they carry no hook or structure, so they'd inject empty
    // framework examples. They still feed the TITLE block via video_title.
    const usable = rows.filter((r: any) => r.hook_text || (Array.isArray(r.structure) && r.structure.length));
    if (usable.length === 0) return null;

    // Sample from the pool instead of always taking the same top entries, so
    // every script in a niche doesn't converge on identical structure
    const shuffled = [...usable].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, 3);

    const parts: string[] = [];
    let total = 0;
    for (let i = 0; i < picked.length; i++) {
      const fw = picked[i];
      const sections = Array.isArray(fw.structure)
        ? fw.structure.map((s: any) => s?.section).filter(Boolean).join(" → ")
        : "";
      const entry = [
        `EXAMPLE ${i + 1}${fw.source_views ? ` (${Math.round(fw.source_views / 1000)}K+ views)` : ""}:`,
        fw.hook_text ? `- Hook (${fw.hook_type || "unknown"}): "${clip(fw.hook_text, 200)}"` : "",
        fw.why_it_works ? `- Why it works: ${clip(fw.why_it_works, 150)}` : "",
        sections ? `- Structure: ${clip(sections, 200)}` : "",
        fw.remix_framework ? `- Replication framework: ${clip(fw.remix_framework, 300)}` : "",
      ].filter(Boolean).join("\n");
      if (total + entry.length > MAX_BLOCK_CHARS) break;
      parts.push(entry);
      total += entry.length;
    }
    if (parts.length === 0) return null;
    console.log(`[frameworks] injected n=${parts.length} niche=${nicheId}`);
    return parts.join("\n\n");
  } catch (e: any) {
    console.error("[frameworks] fetch failed:", e?.message);
    return null;
  }
}

// Hook Engine learning block: a denser, hook-only version of the frameworks
// block. Where getNicheFrameworksBlock is built for script generation (and
// carries structure / remix-framework noise), this returns more real hooks
// with just the fields a hook writer needs — and deliberately spreads across
// hook TYPES so the model learns varied openers, not five of the same pattern.
// Time-boxed and empty-safe so it never delays generation.
const MAX_HOOK_BLOCK_CHARS = 3000;
export async function getNicheHookExamplesBlock(
  rawNiche: string | null | undefined,
  limit = 6
): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const nicheId = normalizeNiche(rawNiche);
  if (!nicheId) return null;
  try {
    const query = supabaseAdmin
      .from("viral_frameworks")
      .select("hook_type, hook_text, why_it_works, source_views")
      .eq("niche", nicheId)
      .not("hook_text", "is", null)
      .order("source_views", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(40);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const result = (await Promise.race([query, timeout])) as { data: any[] | null } | null;
    const rows = result?.data;
    if (!rows || rows.length === 0) return null;

    // Dedupe identical hooks (same video can be captured across surfaces, and
    // near-duplicates add no signal), keeping the highest-view copy first.
    const seen = new Set<string>();
    const unique: any[] = [];
    for (const r of rows) {
      const key = String(r.hook_text || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(r);
    }
    if (unique.length === 0) return null;

    // Spread across hook types: take the strongest example of each type first
    // (one pass per type by view rank), then backfill with the next best until
    // we hit the limit. This guarantees pattern variety when the pool allows it.
    const byTypeFirst: any[] = [];
    const usedTypes = new Set<string>();
    for (const r of unique) {
      const t = String(r.hook_type || "").toLowerCase().trim() || "unknown";
      if (usedTypes.has(t)) continue;
      usedTypes.add(t);
      byTypeFirst.push(r);
    }
    const rest = unique.filter((r) => !byTypeFirst.includes(r));
    const picked = [...byTypeFirst, ...rest].slice(0, limit);

    const parts: string[] = [];
    let total = 0;
    for (const fw of picked) {
      const views = fw.source_views ? ` · ${Math.round(fw.source_views / 1000)}K+ views` : "";
      const entry = [
        `- [${fw.hook_type || "unknown"}${views}] "${clip(fw.hook_text, 220)}"`,
        fw.why_it_works ? `  Why it works: ${clip(fw.why_it_works, 160)}` : "",
      ].filter(Boolean).join("\n");
      if (total + entry.length > MAX_HOOK_BLOCK_CHARS) break;
      parts.push(entry);
      total += entry.length;
    }
    if (parts.length === 0) return null;
    console.log(`[hooks] injected n=${parts.length} niche=${nicheId}`);
    return parts.join("\n");
  } catch (e: any) {
    console.error("[hooks] examples fetch failed:", e?.message);
    return null;
  }
}

// Title learning block: Skripr captures a title_formula (the reusable template
// a video's title implies) for every analyzed video, but the script-frameworks
// block leaves it out. This surfaces the real proven TITLES for a niche plus
// their formulas, so generation can model new titles on what actually worked.
// Time-boxed and empty-safe.
const MAX_TITLE_BLOCK_CHARS = 2600;
export async function getNicheTitleFormulasBlock(
  rawNiche: string | null | undefined,
  limit = 6
): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const nicheId = normalizeNiche(rawNiche);
  if (!nicheId) return null;
  try {
    const query = supabaseAdmin
      .from("viral_frameworks")
      .select("video_title, title_formula, source_views")
      .eq("niche", nicheId)
      .order("source_views", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(40);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const result = (await Promise.race([query, timeout])) as { data: any[] | null } | null;
    const rows = result?.data;
    if (!rows || rows.length === 0) return null;

    // Pull the formula string out of the JSONB ({ formula } from capture, or a
    // richer object from the remixer). Keep only rows that carry a real title
    // or a formula, and dedupe by title.
    const seen = new Set<string>();
    const cleaned: { title: string; formula: string; views: number | null }[] = [];
    for (const r of rows) {
      const tf = r.title_formula;
      const formula = typeof tf === "string" ? tf : (tf && typeof tf === "object" ? String((tf as any).formula || "") : "");
      const title = String(r.video_title || "").trim();
      if (!title && !formula) continue;
      const key = (title || formula).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      cleaned.push({ title, formula, views: r.source_views ?? null });
    }
    if (cleaned.length === 0) return null;

    const parts: string[] = [];
    let total = 0;
    for (const c of cleaned.slice(0, limit)) {
      const views = c.views ? ` (${Math.round(c.views / 1000)}K+ views)` : "";
      const entry = c.title
        ? `- "${clip(c.title, 110)}"${views}${c.formula ? ` → formula: ${clip(c.formula, 120)}` : ""}`
        : `- formula: ${clip(c.formula, 140)}${views}`;
      if (total + entry.length > MAX_TITLE_BLOCK_CHARS) break;
      parts.push(entry);
      total += entry.length;
    }
    if (parts.length === 0) return null;
    console.log(`[titles] injected n=${parts.length} niche=${nicheId}`);
    return parts.join("\n");
  } catch (e: any) {
    console.error("[titles] formulas fetch failed:", e?.message);
    return null;
  }
}

// Niche Bend (#3): inject proven frameworks from BOTH the source niche and the
// bridge niche, so a blended script inherits retention mechanics from each
// community. Falls back gracefully when one or both have no captured frameworks.
export async function getBendFrameworksBlock(
  sourceNiche: string | null | undefined,
  bridgeNiche: string | null | undefined
): Promise<string | null> {
  const [a, b] = await Promise.all([
    getNicheFrameworksBlock(sourceNiche).catch(() => null),
    normalizeNiche(bridgeNiche) !== normalizeNiche(sourceNiche)
      ? getNicheFrameworksBlock(bridgeNiche).catch(() => null)
      : Promise.resolve(null),
  ]);
  const parts: string[] = [];
  if (a) parts.push(`PROVEN FRAMEWORKS FROM THE SOURCE NICHE:\n${a}`);
  if (b) parts.push(`PROVEN FRAMEWORKS FROM THE BRIDGE NICHE — borrow these communities' retention mechanics:\n${b}`);
  return parts.length ? parts.join("\n\n") : null;
}

// Niche Bend learning loop: which niches Skripr has actually collected proven
// frameworks for, ranked by top view count. Lets bridge suggestions prefer
// niches we have real data on — so the more people upload, the smarter the
// blend recommendations get. Time-boxed and empty-safe.
export interface PoolNicheStat { niche: string; count: number; topViews: number; }
export async function getPoolNicheStats(): Promise<PoolNicheStat[]> {
  if (!supabaseAdmin) return [];
  try {
    const query = supabaseAdmin
      .from("viral_frameworks")
      .select("niche, source_views")
      .not("niche", "is", null)
      .limit(1000);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const result = (await Promise.race([query, timeout])) as { data: any[] | null } | null;
    const rows = result?.data;
    if (!rows || rows.length === 0) return [];
    const map = new Map<string, { count: number; topViews: number }>();
    for (const r of rows) {
      if (!r.niche) continue;
      const cur = map.get(r.niche) || { count: 0, topViews: 0 };
      cur.count += 1;
      cur.topViews = Math.max(cur.topViews, Number(r.source_views || 0));
      map.set(r.niche, cur);
    }
    return [...map.entries()]
      .map(([niche, v]) => ({ niche, count: v.count, topViews: v.topViews }))
      .sort((a, b) => b.topViews - a.topViews);
  } catch {
    return [];
  }
}
