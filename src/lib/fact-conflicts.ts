// RESEARCH CONFLICT RESOLUTION (Evidence Integrity step 2, 2026-10-07; OFF unless a caller opts in).
// Research often carries two sources that disagree on the same point (3 vs 5 years of probation; 26% vs 19.8% for
// the same CPI span; $70,000 at the plea vs $90,000 ordered at sentencing). Whichever the writer picks, the other
// makes the line look wrong, and the writer may even state both. This step picks ONE canonical fact per conflict for
// generation, and keeps every losing fact in a provenance record (never silently deleted).
//
// The model only FINDS conflicts and groups facts into sides; it is reliable at that. It is NOT trusted to pick the
// winner (live test: it kept a plea-time $70,000 from a .gov release over the $90,000 ordered at sentencing). A
// winner is chosen only when the EXPLICIT hierarchy below decides it in code AND the model's own pick agrees;
// otherwise every side is marked DISPUTED and the writer must attribute the figure or leave it out. A wrong
// "canonical" value would plant a new error, which is worse than an unresolved conflict.
//
// DECISION HIERARCHY (reviewed 2026-10-07; "later" alone never means "truer": a later source can repeat an error):
//   1 explicit_supersession  a side carries an explicit correction ("corrected", "revised", "amended", "superseded"),
//                            or both sides are stages of the SAME proceeding and one is strictly later
//                            (charge < plea/conviction < sentencing < appeal), read from fact text and source URL
//   2 authoritative_source   one side holds a strictly higher source tier (sourceTier)
//   3 later_state            the model asserts the later record is a later STATE of the fact (not a retelling) and
//                            code confirms both sides are dated and one is strictly later
//   4 corroboration          one side is backed by strictly more independent sources (distinct sites, not facts), 2+
//   5 otherwise              disputed
// Each rule must single out one side; a tie falls through. Temporal pairs (both true at different times) and facts
// that measure different things are NOT conflicts and are kept. No more than a third of facts can be superseded.
import { Anthropic } from "@anthropic-ai/sdk";
import { sourceTier, type ResearchFact } from "@/lib/research";

export const CONFLICT_BASIS = ["explicit_supersession", "authoritative_source", "later_state", "corroboration"] as const;
export type CodeBasis = (typeof CONFLICT_BASIS)[number] | "disputed";
export interface ConflictRecord {
  topic: string;                // what the sources disagree about
  canonicalValue: string;       // the value the writer must use
  losingValues: string[];       // the values the losing sides stated
  canonical: number[];          // facts on the winning side (all kept)
  superseded: number[];         // facts on losing sides
  dropped: number[];            // losers removed from the writer's material (their other content exists elsewhere)
  annotated: number[];          // losers kept, because they carry unique details, with an inline note naming the canonical value
  basis: CodeBasis;                     // what code decided ("disputed" = no safe winner)
  modelBasis: string;                   // the rule the model claimed
  reason: string;
  canonicalFacts: string[];
  supersededFacts: string[];
}

const TIER_RANK = { high: 3, neutral: 2, low: 1 } as const;
// Full source path (trimmed): dates and document names in URLs ("2011-09-28-...pleads-guilty", "...sentenced-to-probation")
// are often the only evidence of which figure came later.
const srcLabel = (u: string | null) => { try { if (!u) return "none"; const x = new URL(u); return `${x.hostname.replace(/^www\./, "")}${x.pathname}`.slice(0, 140); } catch { return "unknown"; } };

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
// Latest full date (y-m-d) evidenced for a fact: in its text, its source URL, or any fact sharing its source URL.
function dateOf(i: number, facts: ResearchFact[]): number | null {
  const texts = facts.filter((f, k) => k === i || (f.source && f.source === facts[i].source)).flatMap((f) => [f.fact, f.source || ""]);
  let best: number | null = null;
  for (const t of texts) {
    for (const m of t.matchAll(/\b((?:19|20)\d{2})[-/](\d{2})[-/](\d{2})\b/g)) { const v = Date.UTC(+m[1], +m[2] - 1, +m[3]); if (!isNaN(v)) best = Math.max(best ?? 0, v); }
    for (const m of t.toLowerCase().matchAll(new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{1,2}),?\\s+((?:19|20)\\d{2})\\b`, "g"))) { const v = Date.UTC(+m[3], MONTHS.indexOf(m[1]), +m[2]); best = Math.max(best ?? 0, v); }
  }
  return best;
}

// What a fact itself says: its own text plus its source URL (separators as spaces: ".../pleads-guilty-felony",
// ".../sentenced-to-probation"). Sibling facts from a shared URL are NOT included: a generic page (bls.gov/cpi/) would
// lend one fact another fact's words. Stage keywords are a coarse signal; the model-agreement check backstops them.
const textsOf = (i: number, facts: ResearchFact[]) => `${facts[i].fact} \n ${(facts[i].source || "").replace(/[-_/.]+/g, " ")}`.toLowerCase();
const CORRECTION_RE = /\b(corrected|correction|revised|revision|amended|superseded|retracted|updated (?:figure|total|estimate)|later (?:reduced|increased|lowered|raised))\b/;
// Stage of a legal/official proceeding a fact speaks from (0 = none stated).
export function stageOf(i: number, facts: ResearchFact[]): number {
  const t = textsOf(i, facts);
  if (/\b(appeal|appeals court|affirmed|overturned|resentenc\w*|supreme court)\b/.test(t)) return 4;
  if (/\b(sentenc\w*|judgment imposed)\b/.test(t)) return 3;
  if (/\b(plea|pleads?|pleaded|pled|convicted|conviction|verdict|found guilty)\b/.test(t)) return 2;
  if (/\b(charged|charges|indicted|indictment|complaint|alleged|accused|arrested)\b/.test(t)) return 1;
  return 0;
}
const hostOf = (u: string | null) => { try { return u ? new URL(u).hostname.replace(/^www\./, "") : ""; } catch { return ""; } };

export async function resolveFactConflicts(facts: ResearchFact[], opts: { model?: string } = {}): Promise<{ writerFacts: ResearchFact[]; conflicts: ConflictRecord[]; failed?: boolean }> {
  if (!Array.isArray(facts) || facts.length < 2) return { writerFacts: facts, conflicts: [] };
  const numbered = facts.map((f, i) => `F${i}: ${f.fact} [source: ${srcLabel(f.source)} · tier: ${sourceTier(f.source)}]`).join("\n");
  let groups: any[] = [];
  for (let attempt = 0; attempt < 2; attempt++) try {
    const msg = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "", timeout: 180_000, maxRetries: 1 }).messages.create({
      model: opts.model || "claude-sonnet-4-6", max_tokens: 6000, temperature: 0,
      messages: [{ role: "user", content: `You are the research editor for a documentary script. Find CONFLICTS: two or more facts that state INCOMPATIBLE values for the SAME thing about the SAME event, person, period and population (e.g. "sentenced to three years of probation" vs "five years' probation"; one source says a CPI category rose 26% from 2019 to 2024, another says 19.8% for the same span).

NOT a conflict (leave these alone): values true at different times ("13 charged initially, 27 later"); different documents, cases, indictments or studies (a 2009 indictment and a 2015 superseding indictment can seek different amounts; two Berkeley studies can find different pass-through rates); different measures or populations (net vs gross returns, wages of all workers vs fast-food workers, one chain vs ten chains); different spans; a rounded and an exact version of the same number; a less specific vs more specific statement. When unsure, it is NOT a conflict.

Group the facts into SIDES by the value they state (facts that agree go on the same side), and pick the canonical SIDE using the FIRST rule that decides it:
1. explicit_supersession: one side explicitly corrects or supersedes the other, or both describe the SAME proceeding at different stages and one is the later stage (the amount ordered at sentencing supersedes the plea-time figure; a conviction supersedes the charge). Use dates and document names in the facts and source URLs.
2. authoritative_source: one side comes from a more authoritative source (court record, government release) than the other.
3. later_state: the later record reflects a later STATE of the fact (a final count after an early count). A later article that merely retells the event is NOT a later state.
4. corroboration: more independent sources (different publications) agree on one value. A 1-vs-1 split has no winner.
If no rule decides it, do not list the conflict.

FACTS:
${numbered}

Output ONLY JSON: {"conflicts":[{"topic":"length of Jones's probation","sides":[{"value":"three years","facts":["F23","F30"]},{"value":"five years","facts":["F5"]}],"canonical":0,"basis":"corroboration","reason":"short: two separate sentencing reports say three years; F5 is a single later report"}]}
If there are no conflicts output {"conflicts":[]}.` }],
    });
    const t = msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    groups = Array.isArray(j?.conflicts) ? j.conflicts : [];
    break;
  } catch (e: any) {
    if (attempt === 0) continue;
    console.warn(`[fact-conflicts] resolver failed, research passed through unchanged: ${e?.message || e}`);
    return { writerFacts: facts, conflicts: [], failed: true };
  }

  const idx = (id: any) => { const m = String(id || "").match(/^F(\d+)$/); const n = m ? Number(m[1]) : NaN; return Number.isInteger(n) && n >= 0 && n < facts.length ? n : -1; };
  const supersededAll = new Set<number>(); const canonicalAll = new Set<number>(); const disputedAll = new Set<number>(); const conflicts: ConflictRecord[] = [];
  const cap = Math.floor(facts.length / 3);
  for (const g of groups) {
    const sides = (Array.isArray(g?.sides) ? g.sides : []).map((sd: any) => ({ value: String(sd?.value || "").slice(0, 120), facts: [...new Set((Array.isArray(sd?.facts) ? sd.facts : []).map(idx).filter((n: number) => n >= 0))] as number[] })).filter((sd: any) => sd.value && sd.facts.length);
    const modelBasis = String(g?.basis || "");
    const modelWin = Number(g?.canonical);
    const all = sides.flatMap((sd: any) => sd.facts);
    if (sides.length < 2 || new Set(all).size !== all.length) continue; // a fact on two sides = malformed
    let reason = String(g?.reason || "").slice(0, 240);
    // Code decides. Each rule must single out ONE side; ties fall through to the next rule.
    const pickBy = (score: (sd: any) => number | null): number => {
      const sc = sides.map(score); if (sc.some((x: number | null) => x === null)) return -1;
      const top = Math.max(...(sc as number[])); const at = sc.filter((x: number | null) => x === top).length;
      return at === 1 ? sc.indexOf(top) : -1;
    };
    let basis: CodeBasis = "disputed"; let win = -1;
    const sideTexts = sides.map((sd: any) => sd.facts.map((m: number) => textsOf(m, facts)).join(" \n "));
    const corrected = sides.map((_: any, k: number) => CORRECTION_RE.test(sideTexts[k]));
    const stages = sides.map((sd: any) => Math.max(...sd.facts.map((m: number) => stageOf(m, facts))));
    const rules: [CodeBasis, () => number][] = [
      ["explicit_supersession", () => {
        if (corrected.filter(Boolean).length === 1) return corrected.indexOf(true);
        return stages.every((x: number) => x > 0) ? pickBy((_: any) => stages[sides.indexOf(_)]) : -1; // both sides must name a stage
      }],
      ["authoritative_source", () => pickBy((sd: any) => Math.max(...sd.facts.map((m: number) => TIER_RANK[sourceTier(facts[m].source)])))],
      ["later_state", () => modelBasis !== "later_state" ? -1 : pickBy((sd: any) => { const ds = sd.facts.map((m: number) => dateOf(m, facts)).filter((d: number | null) => d !== null); return ds.length ? Math.max(...ds) : null; })],
      ["corroboration", () => { const k = pickBy((sd: any) => new Set(sd.facts.map((m: number) => hostOf(facts[m].source) || `F${m}`)).size); return k >= 0 && new Set(sides[k].facts.map((m: number) => hostOf(facts[m].source) || `F${m}`)).size >= 2 ? k : -1; }],
    ];
    for (const [name, rule] of rules) { const k = rule(); if (k >= 0) { win = k; basis = name; break; } }
    // The model must independently agree; if it doesn't, nobody wins.
    if (win >= 0 && win !== modelWin) { reason = `${reason} [code picked "${sides[win].value}" by ${basis}; model picked "${sides[modelWin]?.value ?? "?"}"; left disputed]`; win = -1; basis = "disputed"; }
    if (win < 0) {
      const facIdx = all as number[];
      if (supersededAll.size + facIdx.length > cap) break;
      facIdx.forEach((m) => disputedAll.add(m));
      conflicts.push({ topic: String(g?.topic || "").slice(0, 120), canonicalValue: "", losingValues: sides.map((sd: any) => sd.value), canonical: [], superseded: [], dropped: [], annotated: facIdx,
        basis, modelBasis, reason, canonicalFacts: [], supersededFacts: facIdx.map((m) => facts[m].fact), sides: sides.map((sd: any) => ({ value: sd.value, facts: sd.facts })) } as any);
      continue;
    }
    const winners: number[] = sides[win].facts; const losers: number[] = sides.filter((_: any, k: number) => k !== win).flatMap((sd: any) => sd.facts);
    // No contradictory decisions across groups: a fact can't win in one conflict and lose in another.
    if (losers.some((m) => canonicalAll.has(m) || disputedAll.has(m)) || winners.some((m) => supersededAll.has(m) || disputedAll.has(m))) continue;
    if (supersededAll.size + losers.length > cap) break; // runaway output is a model failure, not a cascade
    losers.forEach((m) => supersededAll.add(m)); winners.forEach((m) => canonicalAll.add(m));
    conflicts.push({ topic: String(g?.topic || "").slice(0, 120), canonicalValue: sides[win].value, losingValues: sides.filter((_: any, k: number) => k !== win).map((sd: any) => sd.value), canonical: winners, superseded: losers, dropped: [], annotated: [], basis, modelBasis, reason,
      canonicalFacts: winners.map((m) => facts[m].fact), supersededFacts: losers.map((m) => facts[m].fact) });
  }
  // A losing fact is dropped only when everything else it says (its names and numbers, minus the disputed value)
  // is already in the kept facts. Otherwise it stays, with a note naming the canonical value, so unique details
  // (a victim's name, a city) are never lost to settle one number.
  const specificsOf = (t: string) => [...new Set((t.match(/\$?\d[\d,.]*%?|\b[A-Z][a-z]{2,}(?:\s[A-Z][a-z]+)*/g) || []).map((x) => x.toLowerCase().replace(/[.,]$/, "")))];
  const keptText = facts.filter((_, k) => !supersededAll.has(k)).map((x) => x.fact.toLowerCase()).join(" \n ");
  const writerFacts: ResearchFact[] = [];
  facts.forEach((f, i) => {
    if (disputedAll.has(i) && !supersededAll.has(i)) {
      const c = conflicts.find((k) => k.basis === "disputed" && k.annotated.includes(i))!;
      writerFacts.push({ ...f, fact: `${f.fact} [DISPUTED: sources disagree on ${c.topic || "this point"} (${c.losingValues.map((v) => `"${v}"`).join(" vs ")}). Do not state this figure as settled: attribute it to its source or leave it out.]` });
      return;
    }
    if (!supersededAll.has(i)) { writerFacts.push(f); return; }
    const c = conflicts.find((k) => k.superseded.includes(i))!;
    const disputed = specificsOf(c.losingValues.join(" "));
    const unique = specificsOf(f.fact).filter((x) => !keptText.includes(x) && !disputed.includes(x));
    if (!unique.length) { c.dropped.push(i); return; }
    c.annotated.push(i);
    writerFacts.push({ ...f, fact: `${f.fact} [DISPUTED: on ${c.topic || "this point"}, the confirmed value is "${c.canonicalValue}"; use that value, not this source's.]` });
  });
  return { writerFacts, conflicts };
}
