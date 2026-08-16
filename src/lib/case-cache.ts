// Fact-set cache. deepenCaseFacts is non-deterministic: the same case, re-derived,
// can come back richer one run and thin the next (missing the aftermath/climax slots),
// and a manual "Name it" pin re-runs it fresh and often WORSE than a prior run. Caching
// a case's BEST (richest) fact set and reusing it removes that variance: the same case
// resolves to the same, best-so-far facts every time, and a thin cache heals upward as
// better runs replace it.
//
// Mirrors the bend_proof_cache access pattern (supabaseAdmin + graceful skip when the
// table is absent), so the code ships before the DDL is run and simply no-ops until then.
import { supabaseAdmin } from "@/lib/db/supabase";
import type { ResearchFact, DeepenResult } from "@/lib/research";

export interface CachedFactSet {
  caseName?: string;
  when?: string;
  facts: ResearchFact[];
  conflicts: DeepenResult["conflicts"];
}

// A fact set with at least this many facts is considered good enough to reuse without
// re-deriving. Below it, we still run a fresh deepen and keep whichever is richer, so a
// thin first cache does not lock the case into permanent thinness.
export const CACHE_GOOD_ENOUGH = 5;

// SAFETY GATE (temporary, until the reconciliation/supersession pass — move #2 — lands).
// The accumulate design is union-only: nothing ever removes a fact, so once a superseded
// number ($10M alleged, an age from a 2-year-old indictment) enters the cache it is served
// on every future run and never shed. The permanent fix is reconciliation, but until then
// this bounds the damage: a cached set older than this can no longer short-circuit fresh
// research or dominate the union, so the pipeline re-checks the web at least daily and the
// current number ($8M forfeiture) is at least fetched and present alongside the stale one.
// This does NOT touch the per-user fact LIBRARY (topic_fact_library) — that shed is move #2.
export const CACHE_TTL_MS = 1000 * 60 * 60 * 20; // 20h — a cached set can't outlive the day
const isFresh = (updatedAt?: string | null): boolean =>
  !!updatedAt && Date.now() - new Date(updatedAt).getTime() < CACHE_TTL_MS;

// Normalize a canonical case name to a stable key so different phrasings of the same
// case ("Billy Queen — ATF infiltration of the Mongols MC" vs a pinned variant) collide
// on the same row once the deepen pass has canonicalized them.
export function caseKey(canonicalCaseName: string): string {
  return (canonicalCaseName || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(the|of|a|an|and|atf|fbi|dea|operation|case|mc|motorcycle|club|infiltration|undercover)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getCachedFactSet(key: string): Promise<CachedFactSet | null> {
  if (!supabaseAdmin || !key) return null;
  try {
    const { data } = await supabaseAdmin
      .from("case_fact_cache")
      .select("case_name, when_range, facts, conflicts, updated_at")
      .eq("case_key", key)
      .maybeSingle();
    if (!data || !Array.isArray(data.facts)) return null;
    // Stale cache no longer short-circuits fresh research (safety gate; see CACHE_TTL_MS).
    if (!isFresh(data.updated_at)) return null;
    return {
      caseName: data.case_name || undefined,
      when: data.when_range || undefined,
      facts: data.facts as ResearchFact[],
      conflicts: Array.isArray(data.conflicts) ? data.conflicts : [],
    };
  } catch { return null; /* table may not exist yet — skip cache */ }
}

// Dedupe a merged fact list by a normalized signature (a bump in the brief version
// re-fetches, and we union old + new rather than overwrite, so the case never LOSES a
// good fact — the 54/53 numbers survive a run that added quotes). Earlier facts win ties,
// so pass the run you most want preserved first.
export function unionFacts(lists: ResearchFact[]): ResearchFact[] {
  const seen = new Set<string>();
  const out: ResearchFact[] = [];
  for (const f of lists) {
    if (!f || typeof f.fact !== "string") continue;
    const sig = f.fact.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (!sig || seen.has(sig)) continue;
    seen.add(sig);
    out.push(f);
  }
  return out;
}

// The richest fact set for this case across ALL brief versions (the current versioned
// key AND any older unversioned/other-version rows), so a version bump can UNION the
// prior best in rather than discard it. baseKey is caseKey() with no version suffix.
export async function getBestAcrossVersions(baseKey: string): Promise<CachedFactSet | null> {
  if (!supabaseAdmin || !baseKey) return null;
  try {
    // A simple prefix LIKE matches BOTH the bare key (pre-versioning rows) and every
    // "<key>::vN" row. An .or() filter here was fragile: the key contains spaces and
    // "::", which PostgREST's or() syntax mangles, so it silently errored to null —
    // which is why the union appeared not to run at all.
    const { data } = await supabaseAdmin
      .from("case_fact_cache")
      .select("case_name, when_range, facts, conflicts, fact_count, case_key, updated_at")
      .like("case_key", `${baseKey}%`)
      .order("fact_count", { ascending: false })
      .limit(5);
    if (!Array.isArray(data) || !data.length) return null;
    // Only FRESH rows contribute to the union (safety gate; see CACHE_TTL_MS). A stale row
    // must not keep a superseded number alive in every future run's fact set.
    const fresh = data.filter((r: any) => isFresh(r.updated_at));
    if (!fresh.length) return null;
    // Union every fresh version's facts, richest row first, so nothing a prior brief found
    // in-window is lost when a later brief adds new material.
    const merged = unionFacts(fresh.flatMap((r: any) => (Array.isArray(r.facts) ? r.facts : [])));
    if (!merged.length) return null;
    const best: any = fresh[0];
    return {
      caseName: best.case_name || undefined,
      when: best.when_range || undefined,
      facts: merged,
      conflicts: Array.isArray(best.conflicts) ? best.conflicts : [],
    };
  } catch { return null; }
}

// Upsert only when the incoming set is at least as rich as what's stored, so the cached
// row only ever moves toward the best fact set seen for this case.
export async function putCachedFactSet(key: string, value: CachedFactSet): Promise<void> {
  if (!supabaseAdmin || !key || !value.facts.length) return;
  try {
    const existing = await getCachedFactSet(key);
    if (existing && existing.facts.length > value.facts.length) return; // keep the richer set
    await supabaseAdmin.from("case_fact_cache").upsert({
      case_key: key,
      case_name: value.caseName || null,
      when_range: value.when || null,
      facts: value.facts,
      conflicts: value.conflicts,
      fact_count: value.facts.length,
      updated_at: new Date().toISOString(),
    }, { onConflict: "case_key" });
  } catch { /* table may not exist yet — skip cache */ }
}
