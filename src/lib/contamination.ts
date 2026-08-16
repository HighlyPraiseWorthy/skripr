// Contamination store. Cross-case leakage is silent: "Boyce's forty years" read
// perfectly fine inside the Scarpa script, and Dobyns' Arizona/Black Biscuit bled into
// a Queen fact set. The in-request review pass now drops facts that don't match the
// case, but that only works when it knows what to watch for. This store gives it that:
// on every deepen we record the case's proper nouns, and on the next deepen we hand the
// review the entities from the user's OTHER recent cases as an explicit do-not-confuse
// watchlist.
//
// Mirrors the bend_proof_cache pattern (supabaseAdmin + graceful skip when the table is
// absent), so it ships before the DDL and no-ops until the table exists.
import { supabaseAdmin } from "@/lib/db/supabase";
import { caseKey } from "@/lib/case-cache";

// Common capitalized words that start sentences or are generic, not case entities.
const PN_STOP = new Set([
  "The", "A", "An", "In", "On", "At", "By", "For", "His", "Her", "Their", "He", "She", "They", "It",
  "This", "That", "These", "Those", "After", "Before", "During", "When", "While", "Then", "But", "And",
  "ATF", "FBI", "DEA", "US", "U.S", "American", "America", "Motorcycle", "Club", "Operation", "Agent",
  "Special", "Federal", "Undercover", "Nation", "Chapter", "Members", "Member", "Queen", "January",
  "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
]);

// Extract distinctive proper nouns (people, places, orgs, operations) from the fact
// text: runs of Capitalized Words, plus quoted aliases like "Billy St. John". Rough by
// design — a heuristic watchlist, not a parser.
export function extractProperNouns(text: string): string[] {
  const found = new Set<string>();
  const t = text || "";
  // Quoted aliases: 'Billy St. John', "Bird"
  for (const m of t.matchAll(/['"“”]([A-Z][A-Za-z.\s]{2,40}?)['"“”]/g)) {
    const v = m[1].trim();
    if (v.length >= 3) found.add(v);
  }
  // Capitalized multi-word runs: "San Fernando Valley", "Hells Angels", "Black Biscuit"
  for (const m of t.matchAll(/\b([A-Z][a-zA-Z]+(?:\s+(?:of\s+)?[A-Z][a-zA-Z]+){0,3})\b/g)) {
    const phrase = m[1].trim();
    const words = phrase.split(/\s+/).filter((w) => !PN_STOP.has(w));
    if (words.length === 0) continue;
    // Keep multi-word phrases, or a single distinctive capitalized token (a name/place).
    if (phrase.split(/\s+/).length >= 2 || (!PN_STOP.has(phrase) && phrase.length >= 4)) found.add(phrase);
  }
  return [...found].slice(0, 40);
}

// Record this case's entities for the user, so later generations can diff against it.
export async function recordCaseEntities(userId: string, canonicalCaseName: string, factText: string): Promise<void> {
  if (!supabaseAdmin || !userId || !canonicalCaseName) return;
  try {
    const entities = extractProperNouns(`${canonicalCaseName}. ${factText}`);
    if (!entities.length) return;
    await supabaseAdmin.from("script_case_entities").insert({
      user_id: userId,
      case_key: caseKey(canonicalCaseName),
      case_name: canonicalCaseName,
      entities,
      created_at: new Date().toISOString(),
    });
  } catch { /* table may not exist yet — skip */ }
}

// The do-not-confuse list: proper nouns from the user's recent OTHER cases (different
// case_key), minus anything that also belongs to the current case. Capped and recent so
// it stays a tight, relevant watchlist rather than an ever-growing blocklist.
export async function getContaminationWatchlist(userId: string, canonicalCaseName: string): Promise<string[]> {
  if (!supabaseAdmin || !userId || !canonicalCaseName) return [];
  try {
    const key = caseKey(canonicalCaseName);
    const { data } = await supabaseAdmin
      .from("script_case_entities")
      .select("case_key, entities, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6);
    if (!Array.isArray(data)) return [];
    const currentEntities = new Set(extractProperNouns(canonicalCaseName).map((e) => e.toLowerCase()));
    const others = new Set<string>();
    let otherCases = 0;
    for (const row of data) {
      if (row.case_key === key) continue; // same case, not contamination
      if (++otherCases > 3) break; // only the last 3 distinct other cases
      for (const e of (Array.isArray(row.entities) ? row.entities : [])) {
        if (typeof e === "string" && e.trim() && !currentEntities.has(e.toLowerCase())) others.add(e.trim());
      }
    }
    return [...others].slice(0, 30);
  } catch { return []; /* table may not exist yet */ }
}
