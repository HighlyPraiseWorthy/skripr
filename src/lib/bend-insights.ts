import { NICHES, getNicheById, type Niche } from "@/lib/data/niches";
import { normalizeNiche } from "@/lib/viral-frameworks";
import { supabaseAdmin } from "@/lib/db/supabase";

// ── RPM arbitrage (#2) ──────────────────────────────────────────────────────
// Resolve a freeform niche/parentNiche string to a NICHES entry so we can quote
// real RPM numbers from the dataset already in the repo.
export function resolveNiche(raw: string | null | undefined): Niche | null {
  if (!raw) return null;
  const id = normalizeNiche(raw);
  if (id) return getNicheById(id) ?? null;
  const s = raw.toLowerCase().trim();
  // word-overlap fallback for things like "Personal Finance" vs "personal-finance"
  return NICHES.find((n) => s.includes(n.name.toLowerCase()) || n.name.toLowerCase().includes(s)) ?? null;
}

export interface RpmInsight {
  bridgeRpm: number | null;
  label: string;
}

export function rpmArbitrage(sourceRaw: string | null | undefined, bridgeParent: string | null | undefined): RpmInsight | null {
  const bridge = resolveNiche(bridgeParent);
  if (!bridge) return null;
  const source = resolveNiche(sourceRaw);
  const bridgeRpm = bridge.avgRPM;

  if (source && source.avgRPM > 0) {
    const ratio = bridgeRpm / source.avgRPM;
    if (ratio >= 1.25) {
      return { bridgeRpm, label: `≈ ${ratio.toFixed(1)}x higher RPM than your niche (~$${bridgeRpm} vs ~$${source.avgRPM})` };
    }
    if (ratio <= 0.8) {
      return { bridgeRpm, label: `Lower RPM (~$${bridgeRpm}) but a fresh, larger audience pool` };
    }
    return { bridgeRpm, label: `Similar RPM (~$${bridgeRpm}) with a brand-new audience` };
  }
  return { bridgeRpm, label: `~$${bridgeRpm} estimated RPM audience` };
}

// ── Blend proof (#1) ─────────────────────────────────────────────────────────
// Search YouTube for the intersection topic and label it proven / emerging /
// blue-ocean from the top videos' view counts. Cached, quota-friendly, and
// degrades to null on any error so the bridge card always renders.
const YT = "https://www.googleapis.com/youtube/v3";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface BlendProof {
  tier: "proven" | "emerging" | "blue_ocean";
  topViews: number;
  hitsOver100k: number;
  label: string;
}

const fmtViews = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(n);

async function cacheGet(key: string): Promise<BlendProof | null | undefined> {
  if (!supabaseAdmin) return undefined;
  try {
    const { data } = await supabaseAdmin.from("bend_proof_cache").select("result, created_at").eq("query_key", key).maybeSingle();
    if (data && Date.now() - new Date(data.created_at).getTime() < CACHE_TTL_MS) return data.result as BlendProof;
  } catch { /* table may not exist yet — skip cache */ }
  return undefined;
}

async function cacheSet(key: string, value: BlendProof): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from("bend_proof_cache").upsert({ query_key: key, result: value, created_at: new Date().toISOString() }, { onConflict: "query_key" });
  } catch { /* table may not exist yet — skip cache */ }
}

function labelFor(tier: BlendProof["tier"], topViews: number, hits: number): string {
  if (tier === "proven") return `Proven blend — top video ${fmtViews(topViews)} views${hits > 1 ? `, ${hits} hits over 100K` : ""}`;
  if (tier === "emerging") return `Lightly explored — top video ${fmtViews(topViews)} views, room to dominate`;
  return "Blue ocean — almost nobody has made this yet";
}

export async function fetchBlendProof(query: string): Promise<BlendProof | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  const cacheKey = query.toLowerCase().replace(/\s+/g, " ").trim();
  const cached = await cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const sRes = await fetch(
      `${YT}/search?part=snippet&type=video&order=viewCount&maxResults=5&q=${encodeURIComponent(query)}&key=${key}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!sRes.ok) return null;
    const sData = await sRes.json();
    const ids = (sData?.items ?? []).map((i: any) => i.id?.videoId).filter(Boolean);
    if (ids.length === 0) {
      const proof: BlendProof = { tier: "blue_ocean", topViews: 0, hitsOver100k: 0, label: labelFor("blue_ocean", 0, 0) };
      await cacheSet(cacheKey, proof);
      return proof;
    }
    const vRes = await fetch(`${YT}/videos?part=statistics&id=${ids.join(",")}&key=${key}`, { signal: AbortSignal.timeout(5000) });
    if (!vRes.ok) return null;
    const vData = await vRes.json();
    const views: number[] = (vData?.items ?? []).map((v: any) => Number(v.statistics?.viewCount ?? 0));
    const topViews = views.length ? Math.max(...views) : 0;
    const hitsOver100k = views.filter((v) => v >= 100_000).length;
    const tier: BlendProof["tier"] = topViews >= 300_000 ? "proven" : topViews >= 30_000 ? "emerging" : "blue_ocean";
    const proof: BlendProof = { tier, topViews, hitsOver100k, label: labelFor(tier, topViews, hitsOver100k) };
    await cacheSet(cacheKey, proof);
    return proof;
  } catch {
    return null;
  }
}
