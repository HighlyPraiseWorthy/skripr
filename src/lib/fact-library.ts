// Per-topic FACT LIBRARY — the user's own accumulating research for a topic.
//
// Facts used to be a byproduct of a run: each generation re-rolled retrieval, so the
// same topic returned four sections one run, two the next, three the next. The $50
// figure vanished and came back. That variance is not a retrieval bug you can fix with a
// better cache — it is structural, because every run raced a fresh retrieval.
//
// The library removes the race. Every run ADDS to it and nothing is silently dropped;
// angle generation reads FROM it rather than from whatever this particular retrieval
// returned. Regenerating angles re-reads the library instead of re-rolling the evidence.
//
// It also changes what the product is: the user's work product stops being one script
// and becomes a researched topic they can make several videos from.
import { supabaseAdmin } from "@/lib/db/supabase";
import type { ResearchFact } from "@/lib/research";

export interface LibraryFact extends ResearchFact {
  // Stable id so a user's dismissal survives later runs adding the same fact back.
  id: string;
  addedAt?: string;
  // User-pasted facts are theirs and are never outranked by retrieval.
  manual?: boolean;
}

// Content signature: two retrievals phrase the same fact slightly differently, and we
// must not accumulate near-duplicates forever. Normalizing to letters+digits and taking
// a prefix collapses "Meta reported $135.0 billion" and "Meta reported $135 billion".
export function factId(fact: string): string {
  return (fact || "")
    .toLowerCase()
    // "$135.0 billion" and "$135 billion" are the same fact from two retrievals, so
    // drop meaningless trailing decimal zeros before collapsing to alphanumerics.
    .replace(/(\d)\.0+(?!\d)/g, "$1")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 72);
}

export function topicKey(topic: string): string {
  return (topic || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(the|a|an|and|of|is|are|why|how|what|if)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export interface FactLibrary {
  facts: LibraryFact[];
  dismissed: string[];
}

export async function getLibrary(userId: string, topic: string): Promise<FactLibrary> {
  const empty: FactLibrary = { facts: [], dismissed: [] };
  if (!supabaseAdmin || !userId || !topic) return empty;
  try {
    const { data } = await supabaseAdmin
      .from("topic_fact_library")
      .select("facts, dismissed")
      .eq("user_id", userId)
      .eq("topic_key", topicKey(topic))
      .maybeSingle();
    if (!data) return empty;
    return {
      facts: Array.isArray(data.facts) ? (data.facts as LibraryFact[]) : [],
      dismissed: Array.isArray(data.dismissed) ? (data.dismissed as string[]) : [],
    };
  } catch { return empty; /* table may not exist yet */ }
}

// ACCUMULATE. Adds anything new and never removes what is already there — the guarantee
// the whole feature rests on. Returns the merged library so callers can use it directly.
export async function addToLibrary(
  userId: string,
  topic: string,
  incoming: ResearchFact[],
  opts?: { manual?: boolean; topicLabel?: string },
): Promise<FactLibrary> {
  const current = await getLibrary(userId, topic);
  if (!supabaseAdmin || !userId || !topic || !incoming.length) return current;

  const byId = new Map(current.facts.map((f) => [f.id, f]));
  let added = 0;
  for (const f of incoming) {
    if (!f?.fact?.trim()) continue;
    const id = factId(f.fact);
    if (!id || byId.has(id)) continue;
    byId.set(id, { id, fact: f.fact.trim(), source: f.source ?? null, addedAt: new Date().toISOString(), manual: !!opts?.manual, context: (f as any).context || undefined });
    added++;
  }
  const merged: FactLibrary = { facts: [...byId.values()], dismissed: current.dismissed };
  if (!added) return merged;

  try {
    await supabaseAdmin.from("topic_fact_library").upsert({
      user_id: userId,
      topic_key: topicKey(topic),
      topic_label: opts?.topicLabel || topic,
      facts: merged.facts,
      dismissed: merged.dismissed,
      fact_count: merged.facts.length,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,topic_key" });
  } catch { /* table may not exist yet — the run still works, just uncached */ }
  return merged;
}

// Hiding is reversible and never deletes: the fact stays in the row, so a later run
// re-adding it does not resurrect something the user deliberately removed.
export async function setDismissed(userId: string, topic: string, dismissed: string[]): Promise<void> {
  if (!supabaseAdmin || !userId || !topic) return;
  try {
    const current = await getLibrary(userId, topic);
    await supabaseAdmin.from("topic_fact_library").upsert({
      user_id: userId,
      topic_key: topicKey(topic),
      facts: current.facts,
      dismissed: Array.from(new Set(dismissed)).slice(0, 400),
      fact_count: current.facts.length,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,topic_key" });
  } catch { /* best effort */ }
}

// What generation and angle-building should actually use: everything accumulated for
// this topic minus what the user hid, manual facts first because the user vouched for them.
export function activeFacts(lib: FactLibrary): LibraryFact[] {
  const hidden = new Set(lib.dismissed);
  return lib.facts
    .filter((f) => !hidden.has(f.id))
    .sort((a, b) => Number(!!b.manual) - Number(!!a.manual));
}
