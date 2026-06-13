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

    // Sample from the pool instead of always taking the same top entries, so
    // every script in a niche doesn't converge on identical structure
    const shuffled = [...rows].sort(() => Math.random() - 0.5);
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
