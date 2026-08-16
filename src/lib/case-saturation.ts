// Case saturation. Before a creator commits a case, the single most decision-changing
// fact is how thoroughly YouTube has already covered it — and whether the "case" is
// really a famous film in disguise (Stallworth is BlacKkKlansman, Henry Hill is
// Goodfellas, Donnie Brasco is a 1997 Depp/Pacino movie). Those dead ends cost several
// runs before anyone noticed, and the signal is cheap to compute from data we already
// have. No other scripting tool can show this without the same YouTube access.
import { supabaseAdmin } from "@/lib/db/supabase";

const YT = "https://www.googleapis.com/youtube/v3";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days — coverage moves slowly

export interface CaseSaturation {
  // Roughly how many videos exist on this case (YouTube's own estimate, capped).
  videoCount: number;
  topViews: number;
  topTitle: string;
  // The top few real titles already on this case. Three retellings that all say the same
  // thing reveal at a glance that the obvious angle is taken and a different one is open —
  // the Tylenol case where every top result was the same suspect.
  topTitles?: string[];
  // "wide open" | "covered" | "saturated" — what the creator should actually do.
  // "unknown" = the lookup returned no usable signal (failed query, or zero views/
  // videos). This is NOT the same as an uncovered case, and must never read as "wide
  // open" — on a trust feature, a false "no competition" is worse than saying nothing.
  tier: "open" | "covered" | "saturated" | "unknown";
  label: string;
  // A well-known film/TV dramatization of this case, when the top results look like
  // one. A creator should know they are competing with a movie's audience.
  adaptationWarning?: string;
}

const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(n));

// Famous dramatizations that repeatedly turned out to be what a "case" search was
// really surfacing. Keyed on distinctive case terms, not the film title.
const ADAPTATIONS: { test: RegExp; note: string }[] = [
  { test: /\bron stallworth\b|\bblackkklansman\b/i, note: "This case is the basis of Spike Lee's BlacKkKlansman (2018), so most coverage is about the film." },
  { test: /\bhenry hill\b|\bgoodfellas\b/i, note: "This case is the basis of Goodfellas (1990), so most coverage is about the film." },
  { test: /\bdonnie brasco\b|\bjoe pistone\b/i, note: "This case is the basis of Donnie Brasco (1997), so most coverage is about the film." },
  { test: /\bfrank abagnale\b|\bcatch me if you can\b/i, note: "This case is the basis of Catch Me If You Can (2002), and parts of the story are disputed." },
  { test: /\bwhitey bulger\b|\bblack mass\b/i, note: "This case is the basis of Black Mass (2015), so much coverage is about the film." },
  { test: /\bjordan belfort\b|\bwolf of wall street\b/i, note: "This case is the basis of The Wolf of Wall Street (2013), so most coverage is about the film." },
  { test: /\bchristopher boyce\b|\bfalcon and the snowman\b/i, note: "This case is the basis of The Falcon and the Snowman (1985)." },
];

async function cacheGet(key: string): Promise<CaseSaturation | null | undefined> {
  if (!supabaseAdmin) return undefined;
  try {
    const { data } = await supabaseAdmin.from("bend_proof_cache").select("result, created_at").eq("query_key", key).maybeSingle();
    if (data && Date.now() - new Date(data.created_at).getTime() < CACHE_TTL_MS) return data.result as CaseSaturation;
  } catch { /* table may not exist — skip cache */ }
  return undefined;
}
async function cacheSet(key: string, value: CaseSaturation): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from("bend_proof_cache").upsert({ query_key: key, result: value, created_at: new Date().toISOString() }, { onConflict: "query_key" });
  } catch { /* skip */ }
}

export function labelForSaturation(tier: CaseSaturation["tier"], count: number, topViews: number): string {
  if (tier === "unknown") return "Coverage unknown — Skripr couldn't measure how much YouTube already covers this. Check manually before committing.";
  if (tier === "saturated") return `Heavily covered — about ${count} videos, top one ${fmt(topViews)} views. You need a sharper angle than the obvious retelling.`;
  if (tier === "covered") return `Covered — about ${count} videos, top one ${fmt(topViews)} views. There is room, but not for a general overview.`;
  return `Wide open — only about ${count} videos, top one ${fmt(topViews)} views. Little competition on this case.`;
}

export function adaptationFor(caseName: string): string | undefined {
  return ADAPTATIONS.find((a) => a.test.test(caseName))?.note;
}

export async function fetchCaseSaturation(caseName: string): Promise<CaseSaturation | null> {
  const key = process.env.YOUTUBE_API_KEY;
  const q = (caseName || "").trim();
  if (!key || !q) return null;
  const cacheKey = `sat::${q.toLowerCase().replace(/\s+/g, " ")}`;
  const cached = await cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const sRes = await fetch(
      `${YT}/search?part=snippet&type=video&order=viewCount&maxResults=5&q=${encodeURIComponent(q)}&key=${key}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!sRes.ok) return null;
    const sData = await sRes.json();
    const items = sData?.items ?? [];
    const videoCount = Math.min(Number(sData?.pageInfo?.totalResults ?? 0), 1000);
    const ids = items.map((i: any) => i.id?.videoId).filter(Boolean);
    let topViews = 0;
    let topTitle = "";
    let topTitles: string[] = [];
    if (ids.length) {
      const vRes = await fetch(`${YT}/videos?part=statistics,snippet&id=${ids.join(",")}&key=${key}`, { signal: AbortSignal.timeout(6000) });
      if (vRes.ok) {
        const vData = await vRes.json();
        const rows = (vData?.items ?? []).map((v: any) => ({ views: Number(v.statistics?.viewCount ?? 0), title: v.snippet?.title || "" }));
        rows.sort((a: any, b: any) => b.views - a.views);
        topViews = rows[0]?.views ?? 0;
        topTitle = rows[0]?.title ?? "";
        topTitles = rows.map((r: any) => r.title).filter(Boolean).slice(0, 3);
      }
    }
    // Zero views (no stats retrieved) or zero videos means we got no usable read, not a
    // wide-open case — the search either failed silently or returned nothing rankable.
    // Report "unknown" rather than a "wide open / little competition" verdict we can't stand behind.
    const noSignal = topViews <= 0 || videoCount <= 0;
    const tier: CaseSaturation["tier"] = noSignal
      ? "unknown"
      : topViews >= 1_000_000 || videoCount >= 200 ? "saturated" : topViews >= 100_000 || videoCount >= 40 ? "covered" : "open";
    const result: CaseSaturation = {
      videoCount, topViews, topTitle, topTitles, tier,
      label: labelForSaturation(tier, videoCount, topViews),
      adaptationWarning: adaptationFor(q),
    };
    await cacheSet(cacheKey, result);
    return result;
  } catch { return null; }
}
