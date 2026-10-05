import { supabaseAdmin } from "@/lib/db/supabase";
import { rankHookFamilies, type HookRank } from "@/lib/hook-families";
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

// Deeper Outlier learning: bank the DNA PATTERNS themselves (the recurring story engines
// and packaging templates found across a channel's outliers), not just titles. These are
// the transferable STRUCTURES the generators should imitate. Stored in the same table under
// a synthetic "pat:<niche>:<slug>" id so re-scans refresh (not ignore) the same pattern row,
// and so the per-video title/framework readers can exclude them.
export interface OutlierPatternRow {
  name: string; kind: "story" | "packaging"; why: string; confidence: string;
  examples: string[]; maxViews: number;
  // universal = the pattern is a subject-independent PSYCHOLOGICAL / STORY mechanism that would work
  // in any niche (e.g. "outcome known, mechanism withheld", "second-person address"). niche-bound
  // (the default, false) = the pattern only coheres because of THIS niche's subject matter. Only
  // universal patterns are allowed to cross niches; everything else stays siloed. Conservative by
  // design: the LLM defaults to false and promotes to true only when the shape is unmistakably structural.
  universal?: boolean;
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

export async function captureOutlierPatterns(
  rawNiche: string | null | undefined,
  patterns: OutlierPatternRow[]
): Promise<number> {
  if (!supabaseAdmin) return 0;
  const niche = normalizeNiche(rawNiche);
  if (!niche || !patterns?.length) return 0;
  const rows = patterns
    .filter((p) => p.name && p.why)
    .map((p) => ({
      video_id: `pat:${niche}:${p.kind}:${slug(p.name)}`,
      video_title: p.examples?.[0] || null,
      niche,
      hook_type: p.kind,
      why_it_works: p.why.slice(0, 600),
      remix_framework: p.name.slice(0, 200),
      // jsonb column reused to carry the transferable detail for this pattern. "universal" gates
      // whether getNicheOutlierPatterns is allowed to surface this pattern in OTHER niches.
      title_formula: { confidence: p.confidence, examples: (p.examples || []).slice(0, 3), universal: !!p.universal },
      source_views: Number.isFinite(p.maxViews) ? Math.round(p.maxViews) : null,
    }));
  if (!rows.length) return 0;
  try {
    // onConflict without ignoreDuplicates: a fresh scan REFRESHES the pattern (confidence,
    // examples, strength) rather than freezing the first capture.
    const { error } = await supabaseAdmin.from("viral_frameworks").upsert(rows, { onConflict: "video_id" });
    if (error) { console.error("[outliers] pattern capture failed:", error.message); return 0; }
    console.log(`[outliers] captured ${rows.length} patterns niche=${niche}`);
    return rows.length;
  } catch (e: any) {
    console.error("[outliers] pattern capture threw:", e?.message);
    return 0;
  }
}

// Read the banked outlier DNA patterns for a niche and format a compact block the
// generators can imitate the STRUCTURE of (never the wording). Time-boxed like the others.
const PATTERN_STOP = new Set(["or", "and", "the", "of", "a", "an", "as", "to", "with", "into", "through", "versus", "vs", "plus", "subject", "framing", "frame", "pattern"]);
export function patternTokens(name: unknown): Set<string> {
  return new Set(
    String(name || "").toLowerCase().split(/[^a-z]+/)
      .filter((w) => w.length > 2 && !PATTERN_STOP.has(w))
      .map((w) => w.replace(/(ies)$/, "y").replace(/s$/, ""))
  );
}
export function samePattern(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size) return false;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared >= 2 && shared / Math.min(a.size, b.size) >= 0.6;
}

// Pick which universal patterns from other niches to import into this one. Ranked by CROSS-NICHE
// CONFIRMATION first: how many distinct niches independently surfaced the same idea (any tag, own
// niche included). An idea three niches found on their own beats one a single scan called universal,
// so one over-generous tag can't dominate. Ties fall back to peak views. Skips anything this niche
// already has, and near-duplicates among the imports themselves.
export function rankUniversalImports(ownRows: any[], crossRows: any[], max: number): any[] {
  const all = [...ownRows, ...crossRows].map((r) => ({ niche: r.niche, t: patternTokens(r.remix_framework), tag: r?.title_formula?.universal }));
  const own = ownRows.map((r) => patternTokens(r.remix_framework));
  // VOTE across every tagged row describing the same idea: each re-scan names patterns slightly
  // differently, so an old mis-tag survives as its own row. It only transfers when universal votes
  // strictly outnumber niche-bound votes; a tie stays put (conservative). Untagged legacy rows don't vote.
  const passesVote = (t: Set<string>) => {
    let yes = 0, no = 0;
    for (const a of all) if (samePattern(a.t, t)) { if (a.tag === true) yes++; else if (a.tag === false) no++; }
    return yes > no;
  };
  const candidates = crossRows
    .filter((r) => r?.title_formula?.universal === true)
    .filter((r) => passesVote(patternTokens(r.remix_framework)))
    .map((r) => {
      const t = patternTokens(r.remix_framework);
      const niches = new Set(all.filter((a) => samePattern(a.t, t)).map((a) => a.niche));
      niches.add(r.niche);
      return { r, t, confirm: niches.size, views: Number(r.source_views) || 0 };
    })
    .sort((a, b) => b.confirm - a.confirm || b.views - a.views);
  const picked: typeof candidates = [];
  for (const c of candidates) {
    if (own.some((k) => samePattern(k, c.t))) continue;
    if (picked.some((p) => samePattern(p.t, c.t))) continue;
    picked.push(c);
    if (picked.length >= max) break;
  }
  return picked.map((p) => ({ ...p.r, confirmedNiches: p.confirm }));
}

// Canonical pattern vocabulary handed to the Outlier scan so it REUSES an existing name when it
// finds the same idea, instead of inventing a fresh synonym every scan (which piled up 35+ rows of
// ~8 ideas in one niche, and let old mis-tags survive as separate rows). Near-duplicate rows are
// clustered with samePattern; each cluster is represented by its most-used name (ties: peak views).
// Returns this niche's ideas (any tag) and other niches' universal ideas, so cross-niche confirmation
// counts land on one shared name too.
export type CanonicalName = { name: string; kind: string };
export function canonicalizeNames(rows: any[], max: number): CanonicalName[] {
  const clusters: { t: Set<string>; names: Map<string, number>; kind: string; views: number; size: number }[] = [];
  for (const r of rows) {
    const name = String(r.remix_framework || "").trim();
    if (!name) continue;
    const t = patternTokens(name);
    let c = clusters.find((c) => samePattern(c.t, t));
    if (!c) { c = { t, names: new Map(), kind: r.hook_type, views: 0, size: 0 }; clusters.push(c); }
    c.names.set(name, (c.names.get(name) || 0) + 1);
    c.views = Math.max(c.views, Number(r.source_views) || 0);
    c.size++;
  }
  return clusters
    .sort((a, b) => b.size - a.size || b.views - a.views)
    .slice(0, max)
    .map((c) => ({ name: [...c.names.entries()].sort((a, b) => b[1] - a[1])[0][0], kind: c.kind }));
}

export async function getCanonicalPatternNames(rawNiche: string | null | undefined): Promise<{ own: CanonicalName[]; universal: CanonicalName[] }> {
  const empty = { own: [], universal: [] };
  if (!supabaseAdmin) return empty;
  const niche = normalizeNiche(rawNiche);
  if (!niche) return empty;
  try {
    const query = supabaseAdmin
      .from("viral_frameworks")
      .select("niche, hook_type, remix_framework, source_views, title_formula")
      .like("video_id", "pat:%")
      .limit(600);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
    const res = (await Promise.race([query, timeout])) as { data: any[] | null } | null;
    const rows = res?.data || [];
    const ownRows = rows.filter((r) => r.niche === niche);
    return {
      own: canonicalizeNames(ownRows, 16),
      // Same gate as the actual transfer: vote-passing, not already known to this niche, no synonyms.
      // Offering a vote-blocked name would invite the scan to revive it.
      universal: rankUniversalImports(ownRows, rows.filter((r) => r.niche !== niche), 10)
        .map((r) => ({ name: String(r.remix_framework).trim(), kind: r.hook_type })),
    };
  } catch {
    return empty;
  }
}

export async function getNicheOutlierPatterns(rawNiche: string | null | undefined): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const niche = normalizeNiche(rawNiche);
  if (!niche) return null;
  try {
    // In-niche patterns: everything banked for THIS niche.
    const nicheQuery = supabaseAdmin
      .from("viral_frameworks")
      .select("hook_type, why_it_works, remix_framework, source_views, title_formula, niche")
      .eq("niche", niche)
      .like("video_id", "pat:%")
      .order("source_views", { ascending: false, nullsFirst: false })
      // Fetch the niche's FULL pattern list (rows are tiny): the display only uses the top 4+4, but the
      // cross-niche duplicate check must see every name the niche already knows, not just the top 10.
      .limit(80);
    // Cross-niche transfer: pull the highest-performing patterns banked in OTHER niches, then keep
    // ONLY the ones tagged universal (subject-independent psychology). These are added as clearly
    // labeled, capped extras — they BIAS the framing, never override the niche's own proven shapes.
    const crossQuery = supabaseAdmin
      .from("viral_frameworks")
      .select("hook_type, why_it_works, remix_framework, source_views, title_formula, niche")
      .neq("niche", niche)
      .like("video_id", "pat:%")
      .order("source_views", { ascending: false, nullsFirst: false })
      // Every banked pattern, not just the top few: the confirmation ranking needs to see which
      // ideas recur across niches (including untagged/niche-bound rows, which still count as evidence).
      .limit(500);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
    const [nicheRes, crossRes] = (await Promise.race([
      Promise.all([nicheQuery, crossQuery]),
      timeout.then(() => [null, null] as const),
    ])) as [{ data: any[] | null } | null, { data: any[] | null } | null];

    const rows = nicheRes?.data || [];
    // De-dupe by pattern name so a universal pattern already proven in THIS niche isn't
    // re-listed as a foreign import; keep only clearly-universal cross-niche patterns.
    // Near-duplicate check, not exact-name: different scans name the same idea differently
    // ("Extreme ranking or extreme characterization" vs "Extreme characterization anchor").
    // Two names are the same pattern when they share >=2 meaningful words covering >=60% of the shorter.
    const universal = rankUniversalImports(rows, crossRes?.data || [], 3);

    if (rows.length === 0 && universal.length === 0) return null;
    const story = rows.filter((r) => r.hook_type === "story").slice(0, 4);
    const pack = rows.filter((r) => r.hook_type === "packaging").slice(0, 4);
    const line = (r: any) => `- ${r.remix_framework}: ${r.why_it_works}`;
    const parts: string[] = [];
    if (story.length) parts.push(`STORY structures:\n${story.map(line).join("\n")}`);
    if (pack.length) parts.push(`PACKAGING structures:\n${pack.map(line).join("\n")}`);
    if (universal.length) parts.push(`UNIVERSAL structures (proven in other niches; transfer the psychological SHAPE only, never the subject):\n${universal.map(line).join("\n")}`);
    if (!parts.length) return null;
    return `PROVEN PATTERNS FROM REAL OVER-PERFORMERS IN THIS NICHE (learned from Outlier Finder scans — imitate the STRUCTURE, never the wording or subject):\n${parts.join("\n")}`;
  } catch {
    return null;
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
      .not("video_id", "like", "pat:%") // exclude banked DNA-pattern rows; those feed getNicheOutlierPatterns
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

// Which of the 8 user-facing hook types pull the most views — in THIS niche when it has enough
// banked hooks, otherwise across all niches (scope tells the UI which). Feeds the angle picker's
// "top in your niche" badge and the one-click auto-pick. Time-boxed and null-safe like the others.
export async function getHookFamilyRanking(rawNiche: string | null | undefined): Promise<{ scope: "niche" | "all"; ranks: HookRank[] } | null> {
  if (!supabaseAdmin) return null;
  const niche = normalizeNiche(rawNiche);
  try {
    const query = supabaseAdmin
      .from("viral_frameworks")
      .select("niche, hook_type, source_views")
      .not("video_id", "like", "pat:%")
      .not("hook_text", "is", null)
      .limit(3000);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const res = (await Promise.race([query, timeout])) as { data: any[] | null } | null;
    const rows = res?.data || [];
    const own = niche ? rankHookFamilies(rows.filter((r) => r.niche === niche)) : [];
    // A niche ranking needs at least 2 ranked types to say anything comparative.
    if (own.length >= 2) return { scope: "niche", ranks: own };
    const all = rankHookFamilies(rows);
    return all.length ? { scope: "all", ranks: all } : null;
  } catch {
    return null;
  }
}
