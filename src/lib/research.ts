import { Anthropic } from "@anthropic-ai/sdk";
import { caseKey, getCachedFactSet, getBestAcrossVersions, putCachedFactSet, unionFacts, CACHE_GOOD_ENOUGH } from "@/lib/case-cache";
import { getContaminationWatchlist, recordCaseEntities } from "@/lib/contamination";
import { addToLibrary, activeFacts, getLibrary, setDismissed, factId, replaceInLibrary } from "@/lib/fact-library";

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return _anthropic;
}

// Auto-sourcing via Perplexity Sonar. Given a topic/angle, fetch real,
// citable facts so the script can be grounded in verifiable numbers. Returns
// facts each paired with a source URL for the user to approve/verify. Dormant
// until PERPLEXITY_API_KEY is set — callers surface the error gracefully.

export interface ResearchFact {
  fact: string;
  source: string | null;
  // MOVE #5(c): a real SURROUNDING-CONTEXT fact (how the royalty system works, how bot
  // detection operates, a prior similar case) fetched to fill honest minutes once the core
  // case is tapped out — never padding, always sourced and adjudicated like any other fact.
  context?: boolean;
  // Mined from a long-form FEATURE article about the subject (scenes, quotes, life details). Exempt
  // from the fact cap, so the richest material in the research can't be trimmed away.
  feature?: boolean;
}

// MOVE #5 — HONEST LENGTH. Length is an OUTPUT of the evidence, not an input: never force a
// runtime onto thin facts (that is the padding/fabrication the checks were built to catch).
// A load-bearing fact (a name, number, date, turn of events, or quote) carries roughly one
// narrated span; at Anton's ~166 wpm that is about 2 to 3 facts per minute. So the budget is
// per-minute, and when the case cannot meet it we tell the truth about the supportable length.
export const FACTS_PER_MINUTE = 2.5;
export const MAX_FACTS = 130; // ceiling (also the hard cap on the fact set) — raised 80 -> 130 so the
// FULL grounded pool (case + context + primary-source document facts, ~120 on a rich case) reaches
// generation. Refill quality is capped by pool size: an 80-cap threw away the deep evidence the
// re-fill needed, so a 20-min build padded a thin pool instead of consuming distinct facts. Short
// asks stay near their per-minute budget (factCap); only a long/deep ask keeps the whole ceiling.
// MOVE #8 — TWO-TIER, CRAFT-CREDITED length. Earlier framing counted only CASE facts and set
// the rate at 2.5/min, so it declared "22 facts = 9 minutes" and the ceiling fired far too
// often. That conflated PADDING (repeating/inventing a fact) with STORYTELLING CRAFT and REAL
// SOURCED CONTEXT, which are how honest long-form actually reaches 20+ minutes (Brew's airports
// is 30+ min on a modest fact core). Two changes:
//   • The RESEARCH budget gathers generously — case facts AND real sourced context facts — at
//     ~2.5/min, so a 20-min target researches ~50 facts (roughly ~22 case + ~28 context).
//   • The HONEST-LENGTH math credits craft: a skilled writer renders each fact as scene, stakes,
//     patient mechanism and context, so the ceiling counts ~1.6 facts/min, not 2.5. The ceiling
//     is now a TRUE last resort — it fires only when facts + context genuinely cannot fill the
//     runtime even with craft (a genuinely obscure subject).
export const HONEST_FACTS_PER_MINUTE = 1.6;
// Facts a runtime honestly needs RESEARCHED (case + context). Floored so even a 1-minute ask
// researches a real minimum.
export function factBudgetForMinutes(minutes?: number): number {
  const m = minutes && minutes > 0 ? minutes : 10;
  return Math.min(MAX_FACTS, Math.max(6, Math.round(m * FACTS_PER_MINUTE)));
}
// The runtime a given number of sourced facts honestly supports, crediting storytelling craft
// (scene/stakes/context expand a fact) — this drives the ceiling, which must be a last resort.
export function honestMinutes(factCount: number): number {
  return Math.max(1, Math.round((factCount || 0) / HONEST_FACTS_PER_MINUTE));
}

// Bump whenever the deepen question brief changes materially. It is part of the
// fact-cache key, so incrementing it invalidates every previously cached fact set and
// forces a re-derive under the new brief. v2 added: verbatim quotes, physical
// description + nickname, and one vivid scene in full. v3 (move #7): active primary-source
// QUOTE hunting — the subject's own words, plea/court statements, indictment language, and
// named-official quotes — as the highest-value target, each with its speaker and source.
// v4 (settled figure): explicitly retrieve the RESOLVED authoritative number (forfeiture /
// judgment / verdict / restitution / final toll / sentence) vs any earlier alleged figure, so
// supersession has the settled number to win with every run.
// v5 (primary-source DOCUMENT mining): the deep charging-document read now lands (the 403 fix +
// the mining-gate decouple + depth floor), adding the overt-acts layer — dated emails, dollar
// movements, CC-N designations. Bumping busts the stale ::v4 cache so already-researched cases
// re-derive WITH the document facts instead of serving the shallow pre-fix set. ALWAYS bump this
// when the fact-gathering pipeline changes, or cached cases silently ship the old depth.
// v6: busts the stale-SHALLOW ::v5 rows — fact sets cached by a v5 deepen that ran BEFORE the
// mining-gate decouple + depth floor (so they hold only ~23 facts). Those stale rows were being
// served on cached runs (parsedFacts=23), starving the re-fill; v6 forces re-derivation with the
// full mining (~120 facts). Combined with MAX_FACTS 80->130 so the full set survives the cap.
export const RESEARCH_BRIEF_VERSION = 8;

// Whether the record actually supports the premise the script is about to assert.
//   documented  a real, citable source describes THIS specific event or claim
//   partial     the subject area is real, but this specific framing is not documented
//   unverified  nothing found describing this specific event or claim
export type ResearchVerdict = "documented" | "partial" | "unverified";

// What KIND of question the topic is. This has to be settled before grounding,
// because "is this claim true" is only the right question for one of them.
//   event        a specific real thing that happened (documentary, true crime, history)
//   explainer    how something works, no single incident (the Kurzgesagt lane)
//   hypothetical a counterfactual, deliberately not something that happened
//   claim        an assertion about people, markets, or trends
//
// Without this, a topic like "What If the Earth Stopped Spinning" gets fact-checked
// as an event, comes back unverified because the Earth has not stopped spinning,
// and the script is then barred from stating specifics — which guts a science
// explainer, since specifics are the whole product. The no-invented-specifics gate
// applies to unresolved EVENTS only.
export type TopicKind = "event" | "explainer" | "hypothetical" | "claim";

export type ResearchResult =
  | {
      ok: true;
      kind: TopicKind;
      verdict: ResearchVerdict;
      verdictNote: string;
      facts: ResearchFact[];
      citations: string[];
      candidates: SubjectCandidate[];
    }
  | { ok: false; error: string };

// A real, documented case that a proposed video title could actually be about.
// Creators type titles ("The Hunt for the Man Who Sold America's Satellites"),
// not claims, and a title is not a falsifiable statement — so verifying it as one
// is the wrong question. The right question is "which real story is this?", which
// for that title is Christopher Boyce or William Kampiles. Resolving the subject
// turns an unsourced premise into a documented one instead of a dead end.
export interface SubjectCandidate {
  name: string;        // the person, case, or event
  summary: string;     // one or two sentences on what actually happened
  when: string;        // year or range, "" when genuinely unclear
  whyItFits: string;   // how it matches the creator's title
  sources: string[];   // citable URLs
  // Set by the authority-ranking pass (move #1). How authoritatively the web documents this
  // case, used to sort the DOJ/major-outlet case to the top of the confirm card.
  authorityTier?: "high" | "medium" | "low";
  // A living-person / named-company warning surfaced AT suggestion time, so the creator
  // sees "this centers an uncharged living individual" before they pick, not after.
  guardWarning?: string;
}
export type ResolveResult =
  | { ok: true; kind: TopicKind; candidates: SubjectCandidate[] }
  | { ok: false; error: string };

// A candidate that argues against itself. The model is asked to omit cases that do
// not fit the title and instead returns them with an explanation attached ("this
// was a corporate acquisition, not the sale of America's satellites in the sense
// implied by the title"). That admission is a reliable signal, so it is enforced
// here rather than left to the prompt, which demonstrably does not hold.
function selfNegating(c: SubjectCandidate): boolean {
  const text = `${c.summary} ${c.whyItFits}`.toLowerCase();
  return [
    /\bnot a (crime|manhunt|criminal|murder|theft|sale|case of)\b/,
    /\bnot the (sale|story|case|event)\b/,
    /\bnot in the sense\b/,
    /\bnot about\b/,
    /\bnot directly (related|connected|about)\b/,
    /\brather than a\b/,
    /\bdoes not (match|fit|involve|describe)\b/,
    /\bis a business (origin )?story\b/,
    /\bnot an? (espionage|spy|criminal)\b/,
    /\bthis is (a )?(policy|corporate|business|legal) (story|matter|dispute|debate)\b/,
    /\bonly loosely\b/,
    /\bnot the same as\b/,
  ].some((re) => re.test(text));
}

// Shared by findResearch and resolveSubjects. A candidate with no citable source
// is exactly what this feature exists to prevent, so it is dropped rather than
// offered as a "real" case the creator might trust.
// Distinctive tokens for same-case detection: lowercase alphanumerics, length >= 4,
// minus generic words that show up in every true-crime blurb.
const CAND_STOP = new Set(["operation", "case", "story", "documentary", "federal", "agent", "special", "member", "members", "motorcycle", "club", "chapter", "undercover", "infiltration", "infiltrated", "charges", "including", "which", "that", "with", "from", "into", "were", "their", "this", "about"]);
function candTokens(c: SubjectCandidate): Set<string> {
  const toks = `${c.name} ${c.summary}`.toLowerCase().match(/[a-z0-9]{4,}/g) || [];
  return new Set(toks.filter((t) => !CAND_STOP.has(t)));
}
// Prefer the candidate that reads like the canonical name: an "Operation X" without
// an alias slash, then the shorter/cleaner name. This is what lets Black Biscuit win
// over "Rough Rider / Dobyns infiltration ..." when the two collapse into one.
function moreCanonical(a: SubjectCandidate, b: SubjectCandidate): SubjectCandidate {
  const score = (c: SubjectCandidate) => (/\boperation\b/i.test(c.name) ? 2 : 0) + (c.name.includes("/") ? -2 : 0) + (c.name.length <= 60 ? 1 : 0);
  return score(b) > score(a) ? b : a;
}
// Merge candidates that describe the same underlying case under different names or
// nicknames, so the picker never offers a wrong label as a separate, selectable
// option beside the right one. Same event = strong token overlap AND an overlapping
// date, which is conservative enough not to merge genuinely distinct cases.
export function dedupeCandidates(cands: SubjectCandidate[]): SubjectCandidate[] {
  const kept: { c: SubjectCandidate; toks: Set<string> }[] = [];
  for (const c of cands) {
    const toks = candTokens(c);
    const yearsC: string[] = c.when.match(/\d{4}/g) || [];
    const dup = kept.find((k) => {
      const shared = [...toks].filter((t) => k.toks.has(t)).length;
      const union = new Set([...toks, ...k.toks]).size || 1;
      const jaccard = shared / union;
      const yearsK: string[] = k.c.when.match(/\d{4}/g) || [];
      const yearsOverlap = !yearsC.length || !yearsK.length || yearsC.some((y) => yearsK.includes(y));
      return (shared >= 3 || jaccard >= 0.5) && yearsOverlap;
    });
    if (dup) {
      // Keep the more canonical of the two, but preserve the richer summary/sources.
      const winner = moreCanonical(dup.c, c);
      const loser = winner === dup.c ? c : dup.c;
      winner.summary = winner.summary.length >= loser.summary.length ? winner.summary : loser.summary;
      winner.sources = Array.from(new Set([...winner.sources, ...loser.sources])).slice(0, 4);
      dup.c = winner;
      dup.toks = candTokens(winner);
    } else {
      kept.push({ c, toks });
    }
  }
  return kept.map((k) => k.c);
}

// Deterministic duration/date-range consistency. A card that says "1998-2000" in the
// header and "nearly three years undercover" in the body contradicts itself; the span
// is two years. No model call is needed to catch it: parse the range, parse any stated
// year-count, and if the words claim MORE years than the range allows, strip the
// bogus duration phrase and let the dated range stand as the single source of truth.
const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
export function reconcileDuration(summary: string, when: string): string {
  const years = (when.match(/\d{4}/g) || []).map(Number);
  if (years.length < 2) return summary; // no range to check against
  const span = Math.max(...years) - Math.min(...years);
  if (span <= 0) return summary;
  // "nearly three years", "over 3 years", "almost two-year", "18 months"
  const re = /\b(nearly|almost|about|roughly|over|more than|around)?\s*(one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})[\s-]+(years?|year-?long)\b/gi;
  return summary.replace(re, (match, _mod, num) => {
    const n = NUM_WORDS[String(num).toLowerCase()] ?? Number(num);
    if (!Number.isFinite(n)) return match;
    // A stated count that exceeds the dated span is the fabrication; drop the phrase.
    // Equal or fewer years is fine ("two years" for a 2-year span, "18 months" etc.).
    return n > span ? "" : match;
  }).replace(/\s{2,}/g, " ").replace(/\s+([.,])/g, "$1").trim();
}

// Derive the case's date range from the SOURCED facts rather than the resolver's guess.
// The resolver can be confidently wrong about years (1999-2001 when it was 1998-2000),
// and a confidence check can't catch a confident falsehood. But the fetched facts carry
// real dates from real sources. This reads only an EXPLICIT range ("1998 to 2000",
// "1998-2000", "from 1998 until 2000") — high precision, so it never manufactures a
// range from scattered years (a memoir's 2005 publication date, a 20-year career, etc.).
export function deriveWhenFromFacts(facts: { fact: string }[]): string | undefined {
  const re = /\b((?:19|20)\d{2})\s*(?:[-–—]|to|through|until|and)\s*((?:19|20)\d{2})\b/;
  for (const f of facts) {
    const m = (f.fact || "").match(re);
    if (m) {
      const a = Number(m[1]), b = Number(m[2]);
      if (b >= a && b - a <= 15) return `${a}-${b}`; // sane span; discard typos/outliers
    }
  }
  return undefined;
}

function normalizeCandidates(raw: any, fallbackCitations: string[], allowSourceless = false, dedupe = true): SubjectCandidate[] {
  if (!Array.isArray(raw)) return [];
  const deduped = raw
    .filter((c: any) => c && typeof c.name === "string" && c.name.trim())
    .map((c: any) => ({
      name: String(c.name).trim().slice(0, 160),
      summary: reconcileDuration(typeof c.summary === "string" ? c.summary.trim().slice(0, 500) : "", typeof c.when === "string" ? c.when.trim() : ""),
      when: typeof c.when === "string" ? c.when.trim().slice(0, 40) : "",
      whyItFits: typeof c.whyItFits === "string" ? c.whyItFits.trim().slice(0, 300) : "",
      sources: (Array.isArray(c.sources) ? c.sources : [])
        .filter((u: any) => typeof u === "string" && /^https?:\/\//.test(u))
        .slice(0, 4),
    }))
    .filter((c: SubjectCandidate) => !selfNegating(c))
    // Claude-named candidates carry no URLs; sourcing is enforced downstream when
    // the chosen case's facts are fetched from Perplexity, so allow them through.
    .filter((c: SubjectCandidate) => allowSourceless || c.sources.length > 0 || fallbackCitations.length > 0)
    .map((c: SubjectCandidate) => ({ ...c, sources: c.sources.length ? c.sources : fallbackCitations.slice(0, 2) }));
  // Case candidates get merged when two labels describe one case. SCOPE questions for
  // an explainer are deliberately about the same topic and share its vocabulary, so
  // merging them on token overlap would collapse the whole picker into one option.
  return (dedupe ? dedupeCandidates(deduped) : deduped).slice(0, 4);
}

export async function findResearch(input: { topic: string; angle?: string; niche?: string }): Promise<ResearchResult> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { ok: false, error: "Research sourcing isn't set up yet." };
  const topic = (input.topic || "").slice(0, 200);
  if (!topic.trim()) return { ok: false, error: "Add a topic first." };
  const angle = (input.angle || "").slice(0, 220);

  // VERIFY BEFORE SUBSTANTIATING. This used to ask for facts that "SUBSTANTIATE
  // this specific angle", which is confirmation-seeking: given a premise that is
  // not a real documented event, the search returns the nearest real material in
  // the topic area, and the script then wraps genuine citations around an
  // invented story. That is the most damaging failure mode for a documentary
  // channel, because the verifiable part lends its credibility to the invented
  // part. So step one is always "does the record describe this at all", and the
  // verdict travels with the facts.
  const subject = angle ? `CLAIM / ANGLE the video intends to assert: "${angle}"\nTOPIC AREA: ${topic}` : `CLAIM / TOPIC the video intends to assert: "${topic}"`;

  const prompt = `You are preparing research for a video script. Do two steps in order and do not skip step 1.

${subject}${input.niche ? `\nNICHE: ${input.niche}` : ""}

STEP 1 — CLASSIFY the topic as exactly one "kind":
- "event": a specific real thing that happened, or a specific person, case, or organisation's actions. Documentaries, true crime, history, investigations.
- "explainer": how something works or what something is, with no single incident at its centre. Science and technology explainers.
- "hypothetical": a counterfactual or thought experiment, deliberately NOT something that happened ("what if the Earth stopped spinning", "what happens if every glacier melts").
- "claim": an assertion about people, behaviour, markets, or trends rather than one incident ("why nobody can focus any more").

STEP 2 — ground it according to that kind. This matters: applying the wrong one produces a useless answer.

IF "event":
  COVER THE WHOLE STORY, not just the triggering incident. A script needs facts for every act, and research that returns only the arrest leaves the writer nothing to stand on for the setup or the aftermath, so those parts come out hedged or invented. Deliberately spread the facts across:
   - the PEOPLE: who they were, ages, jobs, employers, how they got their access, background and family details where documented
   - the MECHANISM: how it actually worked, named programs, documents, or systems involved
   - the MONEY or stakes: amounts, and who received what
   - the OUTCOME: charges, dates, verdicts, sentences
   - the AFTERMATH and what remains unknown or disputed
  A stated MOTIVE counts as a fact worth sourcing when the record documents the person claiming it, so include it and attribute it to who said it.
  Search for sources describing THIS SPECIFIC event, case, or person. Do NOT assume it is real and do NOT substitute loosely related material from the same subject area as confirmation. Set "verdict":
   - "documented": real citable sources describe this specific event.
   - "partial": the surrounding subject is real but this specific event, framing, or causal claim is not something you can source.
   - "unverified": nothing describes this specific event. Sounding plausible is not evidence.
  Be strict; if you are reaching, choose "partial" or "unverified". A wrong "documented" puts fabrication in a creator's mouth on camera.
  ALSO fill "candidates": the real, documented cases this title could actually be about, best match FIRST, up to 4. A creator types a TITLE, not a claim, so naming the real story is more useful than rejecting the title.
  HOW TO FIND THEM: do not just search the title as a keyword string. That surfaces recent, heavily indexed, loosely related material and misses the famous case. Instead, first BREAK THE TITLE INTO ITS REQUIRED ELEMENTS, then look for a case that satisfies ALL of them. For "The Hunt for the Man Who Sold America's Satellites" the elements are: one identified individual (not a company or a policy), who sold or passed satellite material to a foreign power, plus a pursuit, manhunt, escape, or investigation. A corporate technology transfer satisfies the "satellites" element and fails every other one, so it is NOT a match.

  Rules for candidates, all of them strict:
  - A candidate must satisfy EVERY element of the title, not just the subject matter. Matching only the topic area is the most common way to get this wrong.
  - A NUMBER in the title is a HARD FILTER. If the title says "30 years", a case that lasted 6 years does not qualify no matter how famous it is; drop it. Do not let a well-known case that fails the number crowd out a lesser-known case that matches it. The specific constraint outranks fame every time.
  - ONLY include a case that genuinely fits. If you would have to explain that it does not really fit, LEAVE IT OUT. One strong candidate beats four near misses, and a candidate whose own description concedes it is not really this story is worse than no candidate at all. Do NOT write summaries containing phrases like "this is not a crime or manhunt" or "not in the sense implied by the title": if that is true, the case does not belong in the list.
  - Returning an EMPTY candidates array is a valid and useful answer when nothing genuinely fits. It is much better than padding.
  - Search the WHOLE historical record, not just recent or heavily indexed events. The definitive case for a title like this is often decades old and predates most web coverage. Do not let recency bias push a minor recent case above the famous one. Ask yourself which case a well-read viewer would name if they read this title, and make sure that case is present.
  - Never invent a case to fill a slot. If the event is already fully identified, a single candidate is correct.

IF "explainer":
  Do NOT try to verify it as an event; there is no incident to confirm. Set "verdict" to "documented" when the subject genuinely exists, and return the most useful SPECIFIC sourced facts a script could state (real numbers, scales, mechanisms, named findings). Leave "candidates" empty.

IF "hypothetical":
  Do NOT judge whether the scenario happened. It is counterfactual ON PURPOSE, and marking it unverified would be wrong. Set "verdict" to "documented" when the underlying science or mechanism is real, and return real sourced facts about the mechanisms needed to reason through the scenario (the physics, biology, or economics it depends on). Leave "candidates" empty.

IF "claim":
  Return sourced evidence bearing on the claim, including evidence that complicates it. Set "verdict" by whether real evidence exists: "documented" when it does, "partial" when only adjacent evidence exists, "unverified" when none does. Leave "candidates" empty.

Only include a fact you can attribute to a real source URL. Output ONLY this JSON, no prose:
{"kind":"event|explainer|hypothetical|claim","verdict":"documented|partial|unverified","verdictNote":"one plain sentence on what the record does and does not show","facts":[{"fact":"the specific fact, including the exact number","source":"url"}],"candidates":[{"name":"person, case, or event","summary":"1-2 sentences on what actually happened","when":"year or range","whyItFits":"how it matches the title","sources":["url"]}]}`;

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      // temperature 0: the same topic should not resolve to different cases on
      // different runs. This only pins the language step, not retrieval, since
      // Sonar searches live and the retrieved pages themselves vary, which is why
      // the code below also enforces fit rather than trusting the prompt.
      body: JSON.stringify({ model: "sonar", temperature: 0, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { ok: false, error: `Research lookup failed (${res.status}).` };
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content || "";
    const citations: string[] = Array.isArray(data?.citations) ? data.citations.filter((c: any) => typeof c === "string") : [];

    let facts: ResearchFact[] = [];
    let verdict: ResearchVerdict = "unverified";
    let verdictNote = "";
    let kind: TopicKind = "event";
    let candidates: SubjectCandidate[] = [];
    try {
      // Object shape now. Fall back to a bare array so an older response shape
      // still parses rather than throwing the whole lookup away. Pick by whichever
      // delimiter comes FIRST: a greedy {...} match would otherwise grab the first
      // element out of a bare array and lose the rest.
      const objAt = content.indexOf("{");
      const arrAt = content.indexOf("[");
      const useArray = arrAt !== -1 && (objAt === -1 || arrAt < objAt);
      const m = useArray ? content.match(/\[[\s\S]*\]/) : content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : content);
      const rawFacts = Array.isArray(parsed) ? parsed : parsed?.facts;
      if (Array.isArray(parsed)) {
        // No verdict in a bare array: unknown, not confirmed.
        verdict = "partial";
      } else {
        const v = String(parsed?.verdict || "").toLowerCase();
        verdict = v === "documented" || v === "partial" ? v : "unverified";
        const k = String(parsed?.kind || "").toLowerCase();
        kind = k === "explainer" || k === "hypothetical" || k === "claim" ? k : "event";
        verdictNote = typeof parsed?.verdictNote === "string" ? parsed.verdictNote.trim().slice(0, 400) : "";
      }
      if (Array.isArray(rawFacts)) {
        facts = rawFacts
          .filter((x: any) => x && typeof x.fact === "string" && x.fact.trim())
          .map((x: any, i: number) => ({
            fact: capFact(cleanFact(String(x.fact))),
            // prefer the model's per-fact source; fall back to the citations list by index
            source: (typeof x.source === "string" && /^https?:\/\//.test(x.source)) ? x.source : (citations[i] || null),
          }))
          .slice(0, 12);
      }
    } catch { /* unparseable — treat as unverified, citations still returned */ }

    // A hypothetical or explainer is never "unverified" for the purposes of the
    // script gate: there is no event to confirm. Only an EVENT can fail to resolve.
    if (kind !== "event" && verdict === "unverified" && facts.length > 0) verdict = "partial";

    // An unverified premise is a RESULT worth reporting, not a failure. The old
    // code only failed when facts AND citations were both empty, which for any
    // plausible-sounding topic never happened, so the failure branch was
    // effectively dead and every premise looked grounded.
    if (verdict === "unverified" && facts.length === 0 && citations.length === 0 && !verdictNote && candidates.length === 0) {
      return { ok: false, error: "Nothing came back for this topic. Try more specific wording, or paste your own sources below." };
    }
    // A single-purpose prompt resolves cases far better than the combined one, so
    // Candidate resolution ALWAYS runs on Claude (see resolveSubjects), because
    // Perplexity searches live and buries famous historical cases under recent
    // coverage. Perplexity here only supplies kind, verdict, and facts.
    // PREFER CLAUDE'S CLASSIFICATION (follow-up fix). Perplexity classifies `kind` from a LIVE
    // Sonar search, so the same title flapped between event/claim/explainer run to run — which
    // flipped whether a case resolved and caused the intermittent grounded-vs-ungrounded bug.
    // Claude (temp 0) is deterministic on the same prompt, so resolveSubjects ALWAYS runs now and
    // its kind + candidates win when it succeeds; Perplexity's kind is only the fallback.
    // Anchor on the ANGLE when there is one, not just the topic: the angle is the real subject
    // ("How a Mobster Infiltrated the FBI") while the topic is often just its framing.
    const resolveSubject = input.angle ? `${input.angle}. ${input.topic}` : input.topic;
    const resolved = await resolveSubjects({ topic: resolveSubject, niche: input.niche }).catch(() => null);
    if (resolved?.ok) {
      kind = resolved.kind;
      candidates = groundCandidates(resolved.candidates, input.topic, [...facts.map((f) => f.fact), verdictNote || ""], verdictNote || "");
    }

    // Log the resolution outcome so an intermittent "0 candidates" run is diagnosable. The
    // intermittency lives HERE: Perplexity Sonar classifies `kind` from a LIVE search, so the
    // same title can come back "event" one run and "claim"/"explainer" the next, changing
    // whether resolveSubjects runs at all. (Neither the length budget nor the v3 cache touches
    // this path.) When an event yields no candidates, the client now grounds on the title
    // rather than rendering ungrounded angles — but this line shows WHY it was empty.
    console.log("[findResearch] resolved", { kind, candidates: candidates.length, verdict, factCount: facts.length, topic: (input.topic || "").slice(0, 80) });
    if (kind === "event" && candidates.length === 0) {
      console.warn("[findResearch] EVENT resolved to 0 candidates — resolveSubjects returned none or was skipped", { topic: (input.topic || "").slice(0, 80), angle: (input.angle || "").slice(0, 80) });
    }
    return { ok: true, kind, verdict, verdictNote, facts, citations, candidates };
  } catch (e: any) {
    console.error("[findResearch] threw", { error: e?.name === "TimeoutError" ? "timeout" : e?.message });
    return { ok: false, error: e?.name === "TimeoutError" ? "Research lookup timed out." : (e?.message || "Research lookup failed.") };
  }
}

/**
 * Given a proposed video topic or title, find the REAL documented cases it could
 * be about. This is the counterpart to findResearch: verification asks "is this
 * claim true", resolution asks "which true story is this". A creator typing
 * "The Hunt for the Man Who Sold America's Satellites" has not invented
 * anything, they have described Christopher Boyce (TRW satellite ciphers sold to
 * the KGB, escaped Lompoc in 1980, recaptured after a 19-month manhunt) or
 * William Kampiles (sold the KH-11 manual to the Soviets in 1978). Refusing that
 * premise as unverified would be the wrong answer; naming the real case is the
 * right one.
 */
// MOVE #1 — authority ranking + living-person/company guard, at suggestion time.
//
// Resolution names candidates from Claude's training memory only (no web, no ranking), so
// "best match first" is just Claude's output order and a Chilean musician can outrank the
// most-documented streaming-fraud case. This runs ONE Perplexity pass that RANKS the
// candidates Claude already produced by authoritative coverage and flags a candidate that
// centers a living private individual (uncharged) or names a company as the perpetrator.
// It ranks, it does not re-research — a single call over <=4 candidates, so resolution stays
// fast. Perplexity-absent or any error returns the candidates untouched (no regression).
async function rankAndGuardCandidates(topic: string, candidates: SubjectCandidate[]): Promise<SubjectCandidate[]> {
  const pkey = process.env.PERPLEXITY_API_KEY;
  if (!pkey || candidates.length === 0) return candidates;
  const list = candidates.map((c, i) => `${i + 1}. ${c.name}${c.when ? ` (${c.when})` : ""} — ${c.summary}`).join("\n");
  const prompt = `A video title points to a real documented case. Title: "${topic}".

Candidate cases:
${list}

Using AUTHORITATIVE sources (DOJ / federal court records, major news outlets), for EACH candidate return:
- "i": its number
- "authority": "high" if documented by DOJ/court records or multiple major outlets; "medium" if one reliable outlet; "low" if only blogs/obscure sources or you cannot verify it is a real documented case
- "topSource": the single most authoritative source URL you found, or ""
- "guard": a SHORT warning ONLY IF this candidate centers a LIVING private individual who has no stated criminal charge or conviction, OR names a COMPANY as the perpetrator when that company itself was not charged/convicted. Otherwise "".

ALSO: if the title clearly points to a MORE DEFINITIVE, better-documented real case that is NOT listed, return it as "missing". Only when you are confident it is the canonical case for this exact title; otherwise "missing": null.

Output ONLY JSON: {"ranked":[{"i":1,"authority":"high","topSource":"","guard":""}],"missing":null_or_{"name":"","summary":"","when":"","topSource":""}}`;
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${pkey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", temperature: 0, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(18000),
    });
    if (!res.ok) return candidates;
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content || "";
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return candidates;
    const parsed = JSON.parse(m[0]);
    const tierRank = (t: any) => (t === "high" ? 0 : t === "medium" ? 1 : 2);
    const byIdx = new Map<number, { authority?: string; topSource?: string; guard?: string }>();
    if (Array.isArray(parsed?.ranked)) {
      for (const r of parsed.ranked) {
        const i = Number(r?.i) - 1;
        if (Number.isInteger(i) && i >= 0 && i < candidates.length) byIdx.set(i, r);
      }
    }
    // Attach authority + guard to each candidate, and fold a discovered authoritative URL
    // into its sources (Claude-named candidates otherwise carry none).
    let ranked: SubjectCandidate[] = candidates.map((c, i) => {
      const r = byIdx.get(i);
      const tier = r?.authority === "high" || r?.authority === "medium" || r?.authority === "low" ? r.authority : undefined;
      const guard = typeof r?.guard === "string" ? r.guard.trim().slice(0, 200) : "";
      const topSource = typeof r?.topSource === "string" && /^https?:\/\//.test(r.topSource) ? r.topSource : "";
      return {
        ...c,
        authorityTier: tier as SubjectCandidate["authorityTier"],
        guardWarning: guard || undefined,
        sources: topSource && !c.sources.includes(topSource) ? [topSource, ...c.sources].slice(0, 4) : c.sources,
      };
    });
    // A confidently-canonical case Claude omitted (Michael Smith when the list has only a
    // musician) gets prepended so it can win the ranking rather than being unreachable.
    const miss = parsed?.missing;
    if (miss && typeof miss?.name === "string" && miss.name.trim() && !ranked.some((c) => c.name.toLowerCase() === String(miss.name).toLowerCase())) {
      const topSource = typeof miss?.topSource === "string" && /^https?:\/\//.test(miss.topSource) ? [miss.topSource] : [];
      ranked.unshift({
        name: String(miss.name).trim().slice(0, 160),
        summary: typeof miss.summary === "string" ? miss.summary.trim().slice(0, 500) : "",
        when: typeof miss.when === "string" ? miss.when.trim().slice(0, 40) : "",
        whyItFits: "Surfaced as the most authoritatively documented case for this title.",
        sources: topSource,
        authorityTier: "high",
      });
    }
    // Stable sort by authority tier: the DOJ/major-outlet case rises to the top, ties keep
    // Claude's original order.
    ranked = ranked.map((c, i) => ({ c, i })).sort((a, b) => tierRank(a.c.authorityTier) - tierRank(b.c.authorityTier) || a.i - b.i).map((x) => x.c);
    return ranked.slice(0, 4);
  } catch { return candidates; }
}

export async function resolveSubjects(input: { topic: string; niche?: string }): Promise<ResolveResult> {
  const topic = (input.topic || "").slice(0, 200);
  if (!topic.trim()) return { ok: false, error: "Add a topic first." };

  // Resolution runs on CLAUDE, not Perplexity. A video title is a recall question
  // ("which famous documented case is this?"), and Perplexity searches the live web
  // first, so it surfaces recent, heavily indexed coverage (a corporate tech-transfer
  // controversy) and buries a famous decades-old case. Claude knows these cases from
  // training and names the definitive one reliably. Sourcing is not lost: when the
  // creator picks a case, its facts are fetched from Perplexity with real citations.
  const prompt = `A creator wants to make a video with this title or topic:
"${topic}"${input.niche ? `\nNICHE: ${input.niche}` : ""}

First classify it as one "kind": "event" (a specific real thing that happened, or a specific person/case), "explainer" (how something works), "hypothetical" (a what-if), or "claim" (an assertion about people or trends).

Then, if it is an "event", identify the REAL, DOCUMENTED people or cases this title is most likely about, so the creator builds on a real story instead of an invented one. Use your own knowledge of history, true crime, espionage, and current events. The definitive case is often decades old, so do not assume the title refers to a recent story just because recent stories are easier to recall.

Break the title into its required elements and match ALL of them. For "The Hunt for the Man Who Sold America's Satellites" the elements are: one identified individual (not a company, not a policy debate), who sold or passed satellite material to a foreign power, plus a pursuit, manhunt, escape, or investigation. The definitive match is Christopher Boyce (with Andrew Daulton Lee), the TRW case behind "The Falcon and the Snowman". A corporate technology-transfer controversy matches only the subject area and fails the "one man" and "hunt" elements, so it is NOT a match.

If it is an "explainer", a "hypothetical", or a "claim", there is no case to identify — but the topic is still too broad to research well as stated, and a CLAIM in particular needs evidence more than any other kind, because an unexamined claim about people or trends is exactly where a script states a disputed finding as settled. Instead return 2 to 4 SCOPE QUESTIONS: the specific, distinct sub-questions this title could be answering, so the creator picks the one video they are actually making. For "What If the Earth Stopped Spinning" good scopes are: "The physics of the stop itself — momentum, the atmosphere, what happens in the first seconds", "The aftermath for life and climate over the following years", "Why it cannot actually happen, and what that reveals about angular momentum". Each scope must be genuinely different in what it would research and explain, not three phrasings of the same video. Put the scope question in "name", what it covers in "summary", leave "when" empty, and use "whyItFits" to say what a viewer gets from that framing.

Rules:
- Best match FIRST. Return 1 to 4 candidates for an event, and 2 to 4 SCOPE QUESTIONS for an explainer, hypothetical, or claim. Never return an empty list for those three kinds — a topic with no grounding is how a script ends up asserting contested findings as fact.
- Only name a case you are genuinely confident is real and documented. Never invent a case, a name, or a date. If you are not confident any real case fits, return an empty list.
- A candidate must satisfy EVERY element of the title, not just the subject area.
- A NUMBER in the title (like "30 years") is a HARD FILTER: a case that does not match it is disqualified even if it is more famous than the ones that do. The specific constraint outranks fame.
- Never include a case while noting it does not really fit. If it does not fit, omit it.
- ONE case, ONE candidate. If the same underlying events could be named two ways (an official operation name and a nickname or a "the X affair" phrasing), return it ONCE under its canonical name, and mention the alias inside the summary. Never list the same case twice under different labels — that lets a user pick the wrong name.
- NEVER INVENT AN OPERATION CODENAME. Do not attach an "Operation X" codename unless you are certain it is the real, documented name of this operation. A fabricated codename ("Operation Ivan", "Operation Rough Rider") is worse than none, because the user confirms it as the case identity. When you are not certain of the official codename, name the case by the PERSON and ORGANIZATION instead (e.g. "Billy Queen — ATF infiltration of the Mongols MC"), never a guessed codename.
- KEEP THE LABEL AND SUMMARY TO WHAT YOU ARE SURE OF. You are recalling from memory with no sources, and a wrong place in the label becomes the "confirmed" identity the whole script builds on. Do NOT put a location, country, or how/where the case ENDED (captured in X, died in Y, fled to Z) in the "name" descriptor or the "summary" unless you are certain of it. A plain descriptor ("— fugitive manhunt", "— prison escape") beats a specific wrong one. The sourced research fills in the specifics later.
- INTERNAL CONSISTENCY: the "when" range and any duration you state in the summary must agree. If "when" is 1998-2000, do not write "nearly three years"; two years and a 1998-2000 range must match. Get the duration and the dates consistent before returning.
- DATES: only give a "when" range you are genuinely confident is correct. A guessed range that is off by a year (1999-2001 when it was really 1998-2000) becomes the confirmed identity and misleads. If you are not sure of the exact years, return "when" as an EMPTY STRING and let the sourced facts settle the dates later. An omitted date beats a wrong one.
- Use canonical VOCABULARY, not just canonical names. Rank and status terms are facts: "prospect", "hang-around", and "full-patch member" are distinct stages and must not be blended (never write something like "fully patched prospect"). If a person reached full membership, say full-patch member.
- Ask which case a well-read viewer would name on reading this title, and make sure it is present.

Output ONLY this JSON, no prose, no markdown:
{"kind":"event|explainer|hypothetical|claim","candidates":[{"name":"the person or case","summary":"1-2 sentences on what actually happened","when":"year or range","whyItFits":"one sentence on how it matches the title"}]}`;

  try {
    const msg = await anthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    const content = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    let kind: TopicKind = "event";
    let candidates: SubjectCandidate[] = [];
    try {
      const m = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : content);
      const k = String(parsed?.kind || "").toLowerCase();
      kind = k === "explainer" || k === "hypothetical" || k === "claim" ? k : "event";
      candidates = normalizeCandidates(parsed?.candidates, [], true, kind === "event");
    } catch { /* unparseable — no candidates */ }
    // MOVE #1: rank the event candidates by authoritative coverage and attach the
    // living-person/company guard, so the confirm card leads with the DOJ-documented case
    // and flags an uncharged individual. Scope questions (other kinds) are not ranked.
    // ONE CASE, ONE CARD, enforced in code (seen live: "Frank Freshwaters · 1957-2015" and "Frank
    // Freshwaters — fugitive manhunt" listed as two cases). Same distinctive anchor (surname / core
    // entity name) = same case; keep the first (best-ranked) label.
    if (kind === "event" && candidates.length > 1) {
      const seenAnchors = new Set<string>();
      candidates = candidates.filter((c: any) => { const a = (caseAnchorToken(String(c?.name || "")) || String(c?.name || "")).toLowerCase(); if (seenAnchors.has(a)) return false; seenAnchors.add(a); return true; });
    }
    const preRank = candidates.length;
    if (kind === "event" && candidates.length) {
      candidates = await rankAndGuardCandidates(topic, candidates);
    }
    console.log("[resolveSubjects] resolved", { kind, claudeCandidates: preRank, finalCandidates: candidates.length, topic: topic.slice(0, 80) });
    return { ok: true, kind, candidates };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Subject lookup failed." };
  }
}

// Grounding carried from the topic stage into the ANGLE prompts. Angles used to be
// written before any research ran, so they had no idea Boyce existed and came back
// as "there's a story about someone who allegedly sold satellite technology". The
// specificity has to be available at the angle stage or the cards stay vague.
export interface GroundingContext {
  kind: TopicKind;
  verdict: ResearchVerdict;
  caseName?: string;
  caseSummary?: string;
  when?: string;
  facts?: string[];
  // What the research itself flagged as uncertain ("sources vary on some sentence
  // details"). Fed to the angle prompt so it does not build a load-bearing thesis
  // on a field the research just warned about.
  caveat?: string;
}

export function buildGroundingBlock(g?: GroundingContext | null): string {
  if (!g) return "";
  const lines: string[] = [];

  if (g.caseName) {
    lines.push(`GROUNDED IN A REAL, DOCUMENTED CASE — this is what the video is actually about:`);
    lines.push(`CASE: ${g.caseName}${g.when ? ` (${g.when})` : ""}`);
    if (g.caseSummary) lines.push(`WHAT HAPPENED: ${g.caseSummary}`);
  }
  if (g.facts?.length) {
    lines.push(g.caseName ? "SOURCED FACTS:" : "RESEARCHED FACTS (real, sourced):");
    lines.push(...g.facts.slice(0, 50).map((f) => `- ${f}`));
  }
  if (!lines.length) return "";

  // What to DO with it, which differs by topic kind. Without this the model treats
  // grounding as background colour instead of the substance of the angle.
  const use =
    g.kind === "hypothetical"
      ? `Use these real mechanisms as the engine of each angle. The scenario is a thought experiment, so never claim it happened, but DO reason concretely from the real science above.`
      : g.kind === "explainer"
        ? `Build each angle on a specific mechanism or number above, not on a general observation. "Most people assume X" is a weak angle; a concrete sourced detail is a strong one.`
        : `Every angle must be about THIS case and should use its real names, dates, and figures. Do not retreat into "someone allegedly did X" or "a person with access" when you have been given the actual name. Vagueness reads as not having done the research.`;

  // CLOSED WORLD. Handing over a real case does not stop invention, it relocates
  // it: with Boyce and Lee correctly identified, the model still produced "Lee
  // only received $15,000" (the split actually ran the other way) and invented a
  // reason for his arrest (he was picked up on an unrelated suspicion and found
  // carrying microfilm). Those errors are MORE dangerous than vague ones, because
  // they arrive wrapped in verifiable names and dates, so a reader who checks one
  // detail trusts the rest. Argument stays free; new specifics do not.
  const closedWorld = `USE ONLY THE FACTS ABOVE (critical). Everything factual in your angles must come from the material above. You may interpret it, argue from it, question it, and draw out what it implies. You may NOT add:
- a number, amount, percentage, date, or duration that does not appear above
- a name, place, job title, agency, or document that does not appear above
- a motive, intention, or cause stated as fact when the material above does not state it

If a point needs a figure you were not given, make the point without the figure. If you do not know why someone acted, say the record does not say, or build the angle on something you do know. Where the material above is thin, the honest move is a sharper reading of what IS there, never a plausible-sounding detail that fills the gap. An invented specific inside an otherwise accurate angle is the worst possible outcome: it inherits the credibility of everything true around it.`;

  const caveat = g.caveat
    ? `\n\nRESEARCH CAVEAT (respect this): ${g.caveat} Do NOT build an angle's central claim on any detail this caveat flags as uncertain or disputed. You may still tell the story; just do not hinge a thesis, a title, or a "the real question is..." turn on a shaky specific. Lead with what is solid.`
    : "";
  return `${lines.join("\n")}\n\n${use}\n\n${closedWorld}${caveat}`;
}

export interface DeepenResult {
  facts: ResearchFact[];
  // Answers Claude's review flagged as contradicting ANOTHER answer in the set
  // (one run said 42 defendants, another said 16). Surfaced to the creator to
  // decide, never silently resolved by shipping whichever one came back.
  conflicts: { fact: string; source: string | null; note: string }[];
  // KEPT facts flagged for a human double-check: a high-stakes, error-prone single-source
  // specific (how a named person died, where/when someone was released or arrested) that no
  // other fact corroborates. Unlike conflicts, these STAY in the script — they are shown so the
  // creator confirms the one detail most likely to be wrong and most costly if it is.
  verify?: { fact: string; source: string | null; note: string }[];
  // Three states the UI must never blur into one another. "no-key" means the
  // Perplexity leg could not run (prod-only key) — a service outage, NOT a case
  // with no findable facts. "no-facts" means research ran and genuinely found
  // nothing citable. A creator who cannot tell these apart regenerates forever.
  status: "ok" | "no-key" | "no-facts";
  // Entity locking AT THE SOURCE. resolveSubjects sometimes names the wrong
  // operation ("Rough Rider" for what is really "Black Biscuit") or a drifting date.
  // That label flows into the grounding and the finished script, where a Director's
  // note cannot override it. When the canonical resolution corrects the label, we
  // hand the corrected name/date back so the caller can relabel the case everywhere.
  caseName?: string;
  when?: string;
  // MOVE #5 — honest length. What the returned facts actually support, so the UI can tell the
  // truth ("this case honestly supports ~12 min; 20 means padding") instead of stretching.
  factCount?: number;      // load-bearing facts finally returned
  contextCount?: number;   // of those, how many are surrounding-context facts (5c)
  honestMinutes?: number;  // runtime those facts honestly support
  requestedMinutes?: number; // what the length slider asked for
  budget?: number;         // facts the requested runtime needs
}

// One Perplexity round: number the questions, get sourced answers, pair each answer
// back to its question, and drop refusals-with-citations by reading the text. Pulled
// out so retry-on-refusal can run it a second time on reformulated questions.
export async function fetchPerplexityAnswers(
  pkey: string,
  caseName: string,
  summary: string | undefined,
  canonical: string[],
  qs: string[],
): Promise<{ question: string; fact: string; source: string | null }[]> {
  if (!qs.length) return [];
  const prompt = `Case: ${caseName}.${summary ? ` ${summary}` : ""}${canonical.length ? `

CANONICAL ENTITIES (use these exact names; if a question's premise conflicts with these, trust these): ${canonical.join("; ")}.` : ""}

Answer each numbered question below with ONE specific, citable fact and its source URL. If you cannot find a real source for a question, OMIT that question entirely rather than guessing or explaining why you could not. Do NOT return a sentence about what you could not find. Accuracy matters more than completeness: a documentary reads these on camera.

QUESTIONS:
${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Output ONLY a JSON array, no prose. "q" is the question number the fact answers:
[{"q":1,"fact":"the specific fact, including any exact name, number, or date","source":"the source URL"}]`;
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${pkey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", temperature: 0, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(22000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content || "";
    const citations: string[] = Array.isArray(data?.citations) ? data.citations.filter((c: any) => typeof c === "string") : [];
    return parsePerplexityAnswers(content, citations, qs);
  } catch { return []; }
}

// Pure parse + pairing + filter, split out from the network call so the retry-prone
// path can be tested offline (the Perplexity key is prod-only, so the live fetch
// cannot run locally — see scripts/research-parse.test.ts). Pairs each answer to its
// question by the returned index, resolves the source URL, and drops sourceless
// answers and refusals-with-citations by reading the fact text.
// Strip research-framing that describes the RECORD instead of stating the fact, and
// never truncate mid-word. "The most vividly documented episode in the public record
// is X" is metadata about our own search, not a fact — the script must receive "X".
// A case identity is a NAME, not prose. Free-text input (a whole chat message pasted into
// the "Name it" box) ended up inside the retrieval anchor and made every question drift.
// Reduce arbitrary input to a short identity: first line, first sentence, capped — so the
// anchor stays stable and Perplexity searches the case, not the user's commentary.
export function toCaseIdentity(raw: string): string {
  let s = (raw || "").replace(/\s+/g, " ").trim();
  s = s.split(/[\n\r]/)[0];
  // If it reads like prose (long, multiple sentences), keep only the first clause.
  if (s.length > 90) {
    const firstSentence = s.match(/^[^.!?]{3,90}/);
    if (firstSentence) s = firstSentence[0];
  }
  // Drop a trailing dangling connective left by the cut.
  s = s.replace(/\s+(?:and|but|which|because|that|so|where|when|who)\s*$/i, "").trim();
  return s.slice(0, 100).trim();
}

export function cleanFact(raw: string): string {
  let f = (raw || "").trim();
  f = f.replace(/^(?:the (?:single )?most (?:vividly |thoroughly |extensively )?(?:documented|detailed|striking|notable|vivid) (?:episode|moment|scene|account|example|incident)[^.:]{0,80}?(?:\bis\b|\bwas\b|:)\s*)/i, "");
  f = f.replace(/^(?:according to (?:the )?(?:public )?record,?\s*|in the (?:public )?record,?\s*|the (?:public )?record (?:shows|states|indicates|reflects) that\s*|sources (?:indicate|show|say|state|report) that\s*|it is (?:well[- ])?documented that\s*|documented (?:accounts|sources) (?:say|show|indicate) that\s*)/i, "");
  f = f.trim();
  if (f) f = f[0].toUpperCase() + f.slice(1);
  return f;
}
// Cap length without cutting a word in half (a mid-word truncation shipped in a script).
export function capFact(f: string, max = 400): string {
  if (f.length <= max) return f;
  const cut = f.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

export function parsePerplexityAnswers(
  content: string,
  citations: string[],
  qs: string[],
): { question: string; fact: string; source: string | null }[] {
  let arr: any;
  try {
    const m = content.match(/\[[\s\S]*\]/);
    arr = JSON.parse(m ? m[0] : content);
  } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x: any) => x && typeof x.fact === "string" && x.fact.trim())
    .map((x: any, i: number) => {
      const fact = capFact(cleanFact(String(x.fact)));
      const qn = Number(x?.q) - 1;
      const question = Number.isInteger(qn) && qn >= 0 && qn < qs.length ? qs[qn] : (qs[i] || "");
      const source = (typeof x.source === "string" && /^https?:\/\//.test(x.source)) ? x.source : (citations[i] || null);
      return { question, fact, source };
    })
    .filter((p: { fact: string; source: string | null }) => !!p.source && !isNonAnswer(p.fact));
}

// Retry-on-refusal. A closed question that presupposes an artifact ("the patch
// ceremony date") often comes back empty even when the case has a bestselling
// memoir and federal records behind it. Rather than give up at two facts, take the
// questions that produced NOTHING and reformulate them broader, then ask once more.
async function reformulateQuestions(caseName: string, unanswered: string[]): Promise<string[]> {
  if (!unanswered.length) return [];
  try {
    const msg = await anthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      temperature: 0,
      messages: [{
        role: "user",
        content: `These research questions about the real case "${caseName}" each returned NO sourced answer, usually because they were phrased too narrowly and presupposed a specific artifact that was never separately reported. Rewrite each one BROADER and more open so it surfaces whatever IS documented, while still aiming at the same underlying fact. For example "what was the exact date of the patching ceremony?" becomes "what does the record say about when and how the infiltration ended?".

QUESTIONS:
${unanswered.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Output ONLY a JSON array of the rewritten question strings, no prose.`,
      }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const m = text.match(/\[[\s\S]*\]/);
    const arr = JSON.parse(m ? m[0] : text);
    if (Array.isArray(arr)) return arr.filter((q: any) => typeof q === "string" && q.trim()).slice(0, 8);
  } catch { /* no reformulation — keep what round one found */ }
  return [];
}

// A sourced fact is a third-person statement of something documented. Perplexity
// sometimes ignores the "omit what you can't source" instruction and returns a
// REFUSAL with a citation for the query it ran ("I could not verify a source for
// the patch ceremony date" + a URL). A URL-presence check waves that straight
// through, so the refusal has to be caught by reading the TEXT. This deterministic
// pass is the first line; the Claude review pass below is the second.
export function isNonAnswer(text: string): boolean {
  const t = (text || "").trim();
  if (t.length < 40) return true; // too short to be a documentary fact
  // First person = the model narrating, not a fact. Matched as "I <verb>" and
  // contractions so it does not trip on "World War I" or a lone Roman numeral.
  if (/\bI (?:could|can|cannot|couldn|was|am|have|had|did|do|found|note|believe|see|think|need|apolog|was unable)/i.test(t)) return true;
  if (/\bI['’](?:m|ve|d|ll)\b/i.test(t)) return true;
  const refusal = /(?:could|couldn['’]?t|can(?:not|['’]t)|unable|failed) (?:to )?(?:verify|find|locate|confirm|determine|identify)|no (?:documented|verifiable|reliable|specific|direct|known|clear|public|exact|precise) (?:source|sources|record|records|information|evidence|connection|link|answer|date|details?)|not (?:documented|found|available|specified|reported|verifiable|mentioned) (?:in|within|among|by)|no (?:such )?(?:connection|link|relationship|evidence|record|documentation) (?:exists|existed|was found|is documented|could be found)|there (?:is|was) no (?:documented|verifiable|known|direct|clear|public|evidence|record)|insufficient (?:information|sources?|evidence)|the (?:provided )?(?:search )?results? (?:do|did) not/i;
  return refusal.test(t);
}

// Source tiering. The URL-presence check let a motorcycle merch blog and a free
// blogspot stand behind biographical claims about a federal agent. "low" domains are
// self-published or commercial-SEO and should not carry a load-bearing documentary
// fact when anything better is available; "high" are wire/records/reference; the vast
// neutral middle (regional papers, trade press) is kept as-is.
export function sourceTier(url: string | null): "high" | "low" | "neutral" {
  if (!url) return "low";
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return "low"; }
  const low = ["blogspot.com", "wordpress.com", "medium.com", "substack.com", "tumblr.com", "quora.com", "reddit.com", "pinterest.com", "facebook.com", "answers.com", "ranker.com", "bobberbrothers.com", "youtube.com", "youtu.be", "tiktok.com", "x.com", "twitter.com"];
  if (low.some((d) => host === d || host.endsWith("." + d))) return "low";
  if (/\.gov$|\.gov\.|\.mil$|\.edu$|\.edu\.|(^|\.)wikipedia\.org$|(^|\.)courtlistener\.com$|(^|\.)justice\.gov$|(^|\.)fbi\.gov$/.test(host)) return "high";
  const majors = ["nytimes.com", "washingtonpost.com", "latimes.com", "apnews.com", "reuters.com", "bbc.com", "bbc.co.uk", "npr.org", "pbs.org", "theguardian.com", "wsj.com", "nypost.com", "cnn.com", "nbcnews.com", "cbsnews.com", "abcnews.go.com", "propublica.org", "themobmuseum.org", "smithsonianmag.com", "history.com", "azcentral.com"];
  if (majors.some((d) => host === d || host.endsWith("." + d))) return "high";
  return "neutral";
}

// In-voice attribution phrase for an authoritative source, so the narration can say WHERE a
// fact comes from ("according to the DOJ indictment", "court records show") — the rigor
// texture the well-researched channels have. Only high-authority sources earn one; a blog
// gets none, so the script never fabricates authority it does not have.
export function attributionFor(url: string | null): string | undefined {
  if (!url) return undefined;
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return undefined; }
  // Return a named ACTOR only ("the DOJ", "the court", "The New York Times") — the kind of
  // attribution the voice rules REQUIRE. Never return machinery ("court records", "the
  // report"), which the same rules BAN in the narrator's voice.
  if (/(^|\.)justice\.gov$/.test(host)) return "the DOJ";
  if (/(^|\.)courtlistener\.com$/.test(host) || /\.uscourts\.gov$/.test(host)) return "the court";
  if (/(^|\.)fbi\.gov$/.test(host)) return "the FBI";
  const named: Record<string, string> = {
    "apnews.com": "the Associated Press", "reuters.com": "Reuters", "nytimes.com": "The New York Times",
    "washingtonpost.com": "The Washington Post", "propublica.org": "ProPublica", "bbc.com": "the BBC", "bbc.co.uk": "the BBC",
    "npr.org": "NPR", "theguardian.com": "The Guardian", "wsj.com": "The Wall Street Journal",
  };
  for (const d in named) if (host === d || host.endsWith("." + d)) return named[d];
  return undefined; // no identifiable actor — do not invent one ("reporting", "records")
}

// MOVE #2 — reconciliation / supersession. Pure application: drop the facts a higher-
// authority or more-recent fact supersedes, so the script states ONE number, never
// "$10M... actually $8M." Split from the LLM call so the drop logic is testable offline.
export function dropSuperseded(facts: ResearchFact[], superseded: number[]): ResearchFact[] {
  const drop = new Set(superseded.filter((n) => Number.isInteger(n) && n >= 1 && n <= facts.length).map((n) => n - 1));
  return facts.filter((_, i) => !drop.has(i));
}

// MOVE #3 — generic-mechanism detection. A "how it worked" that names the machinery but
// carries NO specific numbers ("thousands of bot accounts") is an empty section: it reads
// as amateur and forces the user to paste the real figure (1,040 bots -> 661,440 streams a
// day). Detect it so the pipeline digs for the quantities automatically instead of shipping
// vague filler. True only when the mechanism is PRESENT but UNQUANTIFIED.
// MOVE #6(2) — HIGH-VALUE FACT PIN. The facts a run must never silently lose: the settled
// money outcome (a forfeiture/settlement figure) and the quantified mechanism (numbers next to
// the machinery). Run-to-run retrieval variance and the factCap slice were dropping exactly
// these, so a later run came back weaker than an earlier one on the same case.
export function isHighValueFact(fact: string): boolean {
  const f = fact || "";
  // A money / financial outcome — the figure a viewer repeats.
  if (/[$£€]\s?\d|\b\d[\d,]*(?:\.\d+)?\s*(?:million|billion|thousand)\s*(?:dollars|usd)?\b|\b(?:forfeit\w*|settlement|restitution|penalty|damages|seiz\w+|embezzl\w+|defraud\w+)\b[^.]{0,40}?\d/i.test(f)) return true;
  // A quantified mechanism — a substantial number sitting next to the machinery.
  if (/\b\d[\d,]{2,}\b[^.]{0,45}\b(bots?|accounts?|streams?|transactions?|servers?|nodes?|songs?|per day|per second|a day)\b|\b(bots?|accounts?|streams?|transactions?|servers?|nodes?)\b[^.]{0,45}\b\d[\d,]{2,}\b/i.test(f)) return true;
  // MOVE #7 — a VERBATIM PRIMARY-SOURCE QUOTE: a real quoted line (the subject's own words, a
  // plea statement, an official's statement) is the strongest researched texture, so pin it so
  // the cap never drops it. A quotation span of several words, or a "said/wrote …" quote lead.
  if (/["“][^"”\n]{15,}["”]|\b(said|wrote|told|stated|testified|declared|boasted|admitted|announced)\b[^.]{0,40}["“][^"”\n]{6,}/i.test(f)) return true;
  return false;
}
// Cap a fact list, but pin high-value facts to the FRONT so the slice can never drop them.
// Order among facts is not narrative order (the generator orders the script), so pinning is safe.
export function capFacts(facts: ResearchFact[], cap: number): ResearchFact[] {
  if (facts.length <= cap) return facts;
  const hv: ResearchFact[] = [];
  const rest: ResearchFact[] = [];
  for (const f of facts) (isHighValueFact(f.fact) ? hv : rest).push(f);
  return [...hv, ...rest].slice(0, cap);
}

export function mechanismIsGeneric(facts: ResearchFact[]): boolean {
  const blob = facts.map((f) => f.fact).join(" ");
  const MECH = /\b(bots?|accounts?|schemes?|operations?|networks?|algorithms?|laundered|routed|funnel\w*|generat\w+|streams?|transactions?|frauds?|scams?|rings?|servers?|nodes?|shell compan\w+|proxies|proxy|automat\w+|inflat\w+|manipulat\w+)\b/i;
  if (!MECH.test(blob)) return false; // no mechanism to quantify — a different failure mode
  // A quantified mechanism fact: a substantial number sitting next to the machinery.
  const QUANT = /\b\d[\d,]{2,}\b[^.]{0,45}\b(bots?|accounts?|streams?|transactions?|servers?|nodes?|proxies|proxy|per day|per second|a day|times)\b|\b(bots?|accounts?|streams?|transactions?|servers?|nodes?|proxies|proxy)\b[^.]{0,45}\b\d[\d,]{2,}\b/i;
  return !QUANT.test(blob);
}

// The "editor who knows the case": ranks the gathered facts by authority + recency and marks
// the LOSERS of a genuine supersession (a final $8M forfeiture beats a $10M allegation; a
// current age beats an age from a 2-year-old indictment). It ADJUDICATES the facts already
// held — it does NOT go back to the web. Temporal pairs (both true at different times) are
// preserved, not dropped. Graceful: <2 facts or any error returns the set untouched.
export async function reconcileFacts(facts: ResearchFact[]): Promise<{ facts: ResearchFact[]; superseded: { fact: string; reason: string }[] }> {
  if (!Array.isArray(facts) || facts.length < 2) return { facts, superseded: [] };
  try {
    const numbered = facts.map((f, i) => `${i + 1}. ${f.fact} [source: ${f.source ? (() => { try { return new URL(f.source!).hostname.replace(/^www\./, ""); } catch { return "unknown"; } })() : "none"} · tier: ${sourceTier(f.source)}]`).join("\n");
    const msg = await anthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      temperature: 0,
      messages: [{
        role: "user",
        content: `You are the fact-checking editor for a documentary script. Below are researched facts, each with its source domain and authority tier. Some CONTRADICT each other where one fact SUPERSEDES the other — a more authoritative or more current value that REPLACES a stale or weaker one. Mark the LOSERS so the script states one authoritative number and never contradicts itself.

SUPERSESSION — mark the loser to DROP when:
- A FINAL / OFFICIAL outcome replaces an ALLEGATION or ESTIMATE of the SAME metric (a court-ordered $8M forfeiture supersedes a $10M alleged loss; a conviction supersedes the charge).
- A HIGHER-tier source contradicts a lower one on the SAME fact (high beats neutral beats low).
- A CURRENT attribute replaces a stale one (a person's current age vs their age at an indictment years ago; a final total vs an early count).

DO NOT DROP when:
- The two are TEMPORAL — both true at different points in time ("13 charged initially, 27 after later indictments"). Keep both.
- They measure DIFFERENT things. Keep both.
- Nothing else in the list supersedes the fact. Keep it.

Only mark a genuine, confident supersession. When unsure, keep both.

FACTS:
${numbered}

Output ONLY JSON: {"superseded":[{"i":2,"by":5,"reason":"short: $10M alleged, $8M is the final court-ordered forfeiture"}]}`,
      }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { facts, superseded: [] };
    const parsed = JSON.parse(m[0]);
    const arr = Array.isArray(parsed?.superseded) ? parsed.superseded : [];
    const idxs: number[] = [];
    const dropped: { fact: string; reason: string }[] = [];
    for (const s of arr) {
      const i = Number(s?.i);
      if (!Number.isInteger(i) || i < 1 || i > facts.length) continue;
      // Never let the model drop MORE than half the set — a runaway response would gut the
      // research; that is a parse/model failure, not a real cascade of supersessions.
      if (idxs.length >= Math.floor(facts.length / 2)) break;
      idxs.push(i);
      dropped.push({ fact: facts[i - 1].fact, reason: typeof s?.reason === "string" ? s.reason.slice(0, 160) : "superseded" });
    }
    return { facts: dropSuperseded(facts, idxs), superseded: dropped };
  } catch { return { facts, superseded: [] }; }
}

// Second line of defence, and the one that catches what a regex cannot: a fluent,
// well-formed answer that is about the WRONG thing (asks a date, answers with a
// club name), quietly reconciles a bad premise in the question (entity drift), or
// contradicts a sibling answer. Claude never wrote a fact here — it only judges the
// pairing of its own question against Perplexity's answer.
async function reviewDeepenedFacts(
  caseName: string,
  pairs: { question: string; fact: string; source: string | null }[],
  caseSummary?: string,
  watchlist?: string[],
): Promise<{ keep: ResearchFact[]; conflicts: DeepenResult["conflicts"]; verify: DeepenResult["conflicts"] }> {
  const keepAll = () => ({ keep: pairs.map((p) => ({ fact: p.fact, source: p.source })), conflicts: [] as DeepenResult["conflicts"], verify: [] as DeepenResult["conflicts"] });
  if (!pairs.length) return { keep: [], conflicts: [], verify: [] };
  try {
    const msg = await anthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      temperature: 0,
      messages: [{
        role: "user",
        content: `You are fact-checking research answers before they go into a documentary script about this real case:
CASE: ${caseName}${caseSummary ? `\nWHAT THIS CASE IS: ${caseSummary}` : ""}${watchlist && watchlist.length ? `\n\nDO-NOT-CONFUSE WATCHLIST — these names belong to DIFFERENT cases the user recently worked on, NOT this one. Any answer whose subject is one of these is cross-case contamination and must be dropped: ${watchlist.join(", ")}.` : ""}

Each item is a QUESTION that was asked and the ANSWER that came back with a citation. Assign each a status:
- "drop": the answer refuses or does not answer ("could not verify", "no documented source"); is NON-RESPONSIVE (asks a date, answers about a different subject); states a NEGATIVE or absence (no connection exists); shows ENTITY DRIFT (silently swaps in a different operation, person, or org than the question named); or is CROSS-CASE CONTAMINATION — a well-formed fact that is actually about a DIFFERENT case, person, place, or operation than the CASE above. This is the most dangerous kind because it reads perfectly: an answer about a different undercover agent, a different infiltrator's aftermath, or the wrong chapter/city/operation must be dropped even though it is fluent and sourced. If a fact's central person, location, or operation does not match this specific case, drop it.
- "temporal": the two answers give DIFFERENT VALUES FOR THE SAME METRIC because they describe it at DIFFERENT POINTS IN TIME, so BOTH are true — e.g. "13 officers were charged" (initial indictment) and "27 officers were charged" (after later indictments), or a casualty/arrest/damage count that grew as the case developed. This is the SINGLE MOST COMMON false conflict on a legal case: a number that rose over time is not a contradiction, it is a timeline. Use "temporal" whenever a figure differs but both figures can be true at their own moment. Put a short note naming the two moments on BOTH items (e.g. "13 at first indictment, 27 after later charges"). Both items are KEPT.
- "conflict": this answer states an INCOMPATIBLE VALUE FOR THE SAME FACT AT THE SAME TIME as another answer in this set — e.g. one says 42 defendants and another says 16 for the same indictment, or two different dates for the same single event. Two answers about DIFFERENT aspects (one about how many were indicted, one about whether the case was later dismissed on appeal) are NOT a conflict; they are both keepers. And a figure that simply GREW OVER TIME is "temporal", NOT "conflict". Only use "conflict" when the two answers cannot both be true at any point in time. When you do, put the SAME note on BOTH items.
- "verify": KEEP the fact, but flag it. Use this ONLY for a HIGH-STAKES, EASILY-CONFUSED specific that NO OTHER item here corroborates AND that is a known error-prone class: (a) HOW a named person died or was injured (shot vs beaten vs stabbed), or (b) WHERE or WHEN a person was released, arrested, held, or where a key event happened (released in Miami vs Algeria). These are the details that are most often reported wrong and are most damaging when wrong. Do not "verify" ordinary figures, dates, or well-corroborated facts — cap yourself to at most the 2 or 3 riskiest single-source claims of these two kinds. The "note" is a short "Double-check: <what to confirm>" phrase.
- "keep": a specific, responsive fact safe to read on camera. This is the default; most items should be "keep".

Be strict about drops, but do not invent conflicts. If two facts are simply about different things, keep them both. If they differ only because time passed, that is "temporal", not "conflict".

The "note" is shown verbatim to a non-technical user. It MUST be a single short human-readable phrase under 12 words describing what to check (e.g. "Sources give 16 vs 42 for the number indicted"). It must NOT contain your reasoning, deliberation, self-instructions, the word "status", or any mention of a "flag". Leave it empty for "keep".

ITEMS:
${pairs.map((p, i) => `${i + 1}. Q: ${p.question}\n   A: ${p.fact}`).join("\n\n")}

Output ONLY a JSON array, no prose: [{"i":1,"status":"keep|drop|conflict|temporal","note":""}]`,
      }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const m = text.match(/\[[\s\S]*\]/);
    const arr = JSON.parse(m ? m[0] : text);
    if (!Array.isArray(arr)) return keepAll();
    const keep: ResearchFact[] = [];
    const conflicts: DeepenResult["conflicts"] = [];
    const verify: DeepenResult["conflicts"] = [];
    for (const v of arr) {
      const i = Number(v?.i) - 1;
      if (!Number.isInteger(i) || i < 0 || i >= pairs.length) continue;
      const p = pairs[i];
      const status = String(v?.status || "").toLowerCase();
      if (status === "drop") continue;
      // The note is shown verbatim to the user, so never let the model's
      // deliberation leak through: take the first clause only, cap it, and if it
      // reads like reasoning or self-instruction, replace it with a neutral line.
      let note = (typeof v?.note === "string" ? v.note : "").split(/[\n]|(?<=\.)\s/)[0].trim().slice(0, 120);
      const leaked = /\b(flag|status|keep .*(on|off)|actually consistent|item \d|i (would|will|think|note)|let me|because)\b/i.test(note);
      // Safety net for the inverted verdict: if the model filed a "conflict" but its
      // own note concludes the answers are actually consistent, trust the conclusion
      // and keep the fact rather than dropping a real one on a mislabelled status.
      const selfConsistent = /\b(consistent|not a conflict|no conflict|actually the same|agree)\b/i.test(note);
      if (status === "temporal") {
        // Same metric at two points in time — both true, so KEEP both rather than flag a
        // false conflict. Fold a clean, non-leaked time qualifier into the fact so the
        // downstream self-contradiction check reads "13 (at indictment)" and "27 (later)"
        // as a timeline, not a 13-vs-27 contradiction.
        const qualifier = note && !leaked && note.length <= 80 ? ` (${note})` : "";
        keep.push({ fact: qualifier && !p.fact.includes(note) ? `${p.fact}${qualifier}` : p.fact, source: p.source });
      } else if (status === "conflict" && !selfConsistent) {
        conflicts.push({ fact: p.fact, source: p.source, note: leaked ? "Sources give different figures for this detail." : note });
      } else if (status === "verify") {
        // KEPT in the script, but surfaced in a separate "double-check" list (NOT the
        // sources-disagree list): a high-stakes single-source specific (cause of death,
        // release/custody location) that no sibling corroborates.
        keep.push({ fact: p.fact, source: p.source });
        verify.push({ fact: p.fact, source: p.source, note: leaked || !note ? "Confirm this detail against the source before publishing." : (/^(double-?check|confirm)/i.test(note) ? note : `Double-check: ${note}`) });
      } else {
        keep.push({ fact: p.fact, source: p.source });
      }
    }
    // A malformed judgement that kept nothing is more likely a parse miss than a
    // real "everything is bad", so fall back to the deterministically-filtered set.
    if (!keep.length && !conflicts.length) return keepAll();
    return { keep, conflicts, verify };
  } catch { return keepAll(); }
}

// FINAL-SET RESOLUTION. The per-round review only sees ONE fetch round's answers, but the
// returned set is a UNION of rounds + the accumulated library + cache — so a $500k ransom from
// round A and a $1M ransom from round B both survive. Older builds FLAGGED these and made the
// creator decide; that is the opposite of what the product promises — a script you trust the way
// you trust a good answer, with no second-guessing. So this pass DECIDES. It runs ONCE over the
// FINAL facts, finds every same-metric contradiction, picks the correct value using (a) source
// authority — contemporary primary reporting and official/court records outrank a lone secondary
// page — (b) cross-source consensus, and (c) known facts of this documented case, then returns the
// 1-based indices of the WRONG facts to DROP. It never invents a value and never touches a fact
// that has no better-supported rival, so every fact that ships is still exactly what its cited
// source says — the set is just made self-consistent, and the loser of each conflict is removed.
// DETERMINISTIC numeric-conflict detector. An LLM asked to both FIND and RESOLVE conflicts across a
// 30-fact set is unreliable at the FIND half — at temp 0 it caught 4 conflicts one run and 0 the next
// on near-identical sets, silently skipping an obvious "17 years vs 17½ years". So detection is done
// in code (reliable every run) and only the JUDGMENT (which value wins / are these different
// measurements) is left to the LLM. This extracts comparable figures — money, durations in years,
// heights — tags each with a measurement CONTEXT (a prison sentence vs time as a fugitive; a fraud
// total vs one financing tranche) so genuinely different measurements never cluster together, and
// returns candidate clusters (same category+context, ≥2 distinct values across ≥2 facts) for the LLM
// to adjudicate. It NEVER drops on its own — it only guarantees the LLM SEES every numeric candidate.
const NUM_MULT: Record<string, number> = { thousand: 1e3, k: 1e3, million: 1e6, m: 1e6, billion: 1e9, bn: 1e9 };
const DECADE_WORD: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const MONTH_NUM: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
type NumSignal = { cat: "money" | "dur" | "height" | "date"; ctx: string; value: number; raw: string };

export function extractNumericSignals(fact: string): NumSignal[] {
  const out: NumSignal[] = [];
  const f = fact, low = f.toLowerCase();
  const tag = (sets: [string, RegExp][]) => { for (const [n, re] of sets) if (re.test(low)) return n; return "?"; };
  const moneyCtx = () => tag([
    ["tranche", /project star|financing|equipment financ|one program|tranche/],
    ["recovered", /trac(e|ed|ing)|frozen|froze|recover|seized|invest|stocks?/],
    ["total", /defraud|fraud|scheme|lend|loan|stole|stolen|ransom|demand|extort|out of|cost|lost|purchas/],
  ]);
  const durCtx = () => tag([
    ["sentence", /sentenc|prison|behind bars|\bterm\b/],
    ["fugitive", /fugitive|\blam\b|fled|flee|flew|evad|disappear|manhunt|on the run|at large|decades? as|years as|ever since/],
    ["age", /-year-old|years old|\baged\b|\bborn\b/],
  ]);
  let m: RegExpExecArray | null;
  const moneyRe = /\$\s?([\d,]+(?:\.\d+)?)\s*(billion|million|thousand|bn|m|k)?\b/gi;
  while ((m = moneyRe.exec(f))) { let v = parseFloat(m[1].replace(/,/g, "")); const u = (m[2] || "").toLowerCase(); if (u && NUM_MULT[u]) v *= NUM_MULT[u]; if (v >= 1000) out.push({ cat: "money", ctx: moneyCtx(), value: v, raw: m[0].trim() }); }
  const moneyWordRe = /([\d,]+(?:\.\d+)?)\s*(billion|million|thousand)\s+dollars/gi;
  while ((m = moneyWordRe.exec(f))) out.push({ cat: "money", ctx: moneyCtx(), value: parseFloat(m[1].replace(/,/g, "")) * NUM_MULT[m[2].toLowerCase()], raw: m[0].trim() });
  const rangeSpans: [number, number][] = [];
  const rangeRe = /\b\d{1,3}\s+to\s+\d{1,3}\s+years?\b/gi;
  while ((m = rangeRe.exec(f))) rangeSpans.push([m.index, m.index + m[0].length]);
  const inRange = (i: number) => rangeSpans.some(([a, b]) => i >= a && i < b);
  const yrRe = /\b(\d{1,3})\s*(½|1\s*\/\s*2|\.5)?\s*[- ]?\s*years?\b/gi;
  while ((m = yrRe.exec(f))) { if (inRange(m.index)) continue; if (/^[- ]?old\b/i.test(f.slice(m.index + m[0].length, m.index + m[0].length + 5))) continue; /* an AGE ("24-year-old"), not a duration */ const n = parseInt(m[1], 10); if (n >= 1000) continue; out.push({ cat: "dur", ctx: durCtx(), value: n + (m[2] ? 0.5 : 0), raw: m[0].trim() }); }
  const decRe = /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+decades?\b/gi;
  while ((m = decRe.exec(f))) { const n = /\d/.test(m[1]) ? parseInt(m[1], 10) : DECADE_WORD[m[1].toLowerCase()]; const c = durCtx(); out.push({ cat: "dur", ctx: c === "?" ? "fugitive" : c, value: n * 10, raw: m[0].trim() }); }
  const htRe = /(\d)\s*(?:feet|foot|ft|')\s*(\d{1,2})\s*(?:inches|inch|in|")?/gi;
  while ((m = htRe.exec(f))) out.push({ cat: "height", ctx: "height", value: parseInt(m[1], 10) * 12 + parseInt(m[2], 10), raw: m[0].trim() });
  // DATES keyed by YEAR-MONTH, value = DAY. Only day-level dates cluster, and only within the same
  // year+month — that is exactly the subtle "same event, one day off" slip the LLM misses (Feb 4 vs
  // Feb 5; Sep 26 vs 28). Gross date conflicts a month or year apart are DIFFERENT year-month buckets,
  // so they never cluster here — the LLM's own scan already catches those reliably (Jul 31 vs Aug 31).
  const dMdy = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g;
  while ((m = dMdy.exec(f))) { const mo = MONTH_NUM[m[1].toLowerCase()]; if (!mo) continue; out.push({ cat: "date", ctx: `${m[3]}-${String(mo).padStart(2, "0")}`, value: parseInt(m[2], 10), raw: m[0].trim() }); }
  const dDmy = /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/g;
  while ((m = dDmy.exec(f))) { const mo = MONTH_NUM[m[2].toLowerCase()]; if (!mo) continue; out.push({ cat: "date", ctx: `${m[3]}-${String(mo).padStart(2, "0")}`, value: parseInt(m[1], 10), raw: m[0].trim() }); }
  return out;
}

// Candidate clusters: same category+context, ≥2 distinct VALUES across ≥2 distinct FACTS (so two
// different figures inside ONE fact — "$200M traced, of which $180M invested" — never form a cluster).
export function detectNumericClusters(facts: ResearchFact[]): { label: string; members: { i: number; value: number; raw: string }[] }[] {
  const groups = new Map<string, { i: number; value: number; raw: string }[]>();
  facts.forEach((f, i) => { for (const s of extractNumericSignals(f.fact)) { const k = `${s.cat}:${s.ctx}`; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push({ i: i + 1, value: s.value, raw: s.raw }); } });
  const clusters: { label: string; members: { i: number; value: number; raw: string }[] }[] = [];
  for (const [key, members] of groups) {
    if (new Set(members.map((x) => x.value)).size < 2) continue;
    if (new Set(members.map((x) => x.i)).size < 2) continue;
    const seen = new Set<number>();
    const mem = members.filter((x) => (seen.has(x.i) ? false : (seen.add(x.i), true)));
    clusters.push({ label: key, members: mem });
  }
  return clusters;
}

export async function resolveFinalConflicts(
  caseName: string,
  facts: ResearchFact[],
  summary?: string,
): Promise<{ drop: number[]; decisions: { keep: string; dropped: string; why: string }[] }> {
  const empty = { drop: [] as number[], decisions: [] as { keep: string; dropped: string; why: string }[] };
  if (!Array.isArray(facts) || facts.length < 2) return empty;
  // Deterministic recall: hand the LLM the numeric candidate clusters so it can never silently skip
  // an obvious rounding/contradiction. Empty is fine — the LLM still free-scans for non-numeric ones.
  const clusters = detectNumericClusters(facts);
  const clusterBlock = clusters.length
    ? `\nDETECTED NUMERIC CANDIDATES (these facts state the SAME kind of measurement with different values — resolve EACH: if it is one figure rounded/mis-stated, keep the most precise/consensus value and drop the other(s); if they are genuinely DIFFERENT measurements, leave them all):\n${clusters.map((c) => `- ${c.label}: ${c.members.map((mm) => `fact ${mm.i} = "${mm.raw}"`).join(" vs ")}`).join("\n")}\n`
    : "";
  const placeP = findPlaceConflicts(facts).catch(() => ({ drop: [] as number[], why: [] as string[] })); // parallel, own job
  // EVERY exit merges the place-conflict result: the main resolver's reply is sometimes unparseable,
  // and an early return there was silently discarding a verified place drop.
  const mergePlace = async (base: number[], decisions: { keep: string; dropped: string; why: string }[]) => {
    const set = new Set(base);
    const place = await placeP;
    for (const d of place.drop) if (!set.has(d)) { set.add(d); decisions.push({ keep: "", dropped: facts[d - 1]?.fact.slice(0, 60) || "", why: place.why.join(" | ").slice(0, 160) }); }
    const cap = Math.floor(facts.length / 3);
    return { drop: [...set].sort((a, b) => a - b).slice(0, cap), decisions };
  };
  try {
    const msg = await anthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      temperature: 0,
      messages: [{
        role: "user",
        content: `You are the final fact-checking editor for a documentary about this real, documented case. Your job is to make the fact set SELF-CONSISTENT so the script never states two different numbers for the same thing. You DECIDE — you do not defer.
CASE: ${caseName}${summary ? `\nWHAT THIS CASE IS: ${summary}` : ""}

FACTS (index. text — source domain):
${facts.map((f, i) => `${i + 1}. ${f.fact}${f.source ? ` — ${(() => { try { return new URL(f.source).hostname.replace(/^www\./, ""); } catch { return f.source; } })()}` : ""}`).join("\n")}
${clusterBlock}
Find SAME-METRIC CONFLICTS — TWO kinds:
(A) INCOMPATIBLE values for the SAME thing where one is WRONG — a ransom stated as $500,000 in one and $1 million in another; one single event dated July 31 in one and August 31 in another; an arrest on Sep 26 vs Sep 28; a duration of "over 23 years" vs "more than four decades". Drop the wrong value.
(C) CONFLICTING PLACE for the SAME event — one fact says the escape/arrest/death happened at place X, another says place Y, and both cannot be true ("disappeared from the Ohio State Reformatory in Mansfield" vs "moved to an honor camp near Sandusky and was reported missing"). Keep the version MORE independent sources agree on, and among equals the more SPECIFIC one (the camp he actually walked away from, not the institution he was first sent to). Drop the other. A place mentioned only as an EARLIER step ("imprisoned at Mansfield, then moved to Sandusky") is NOT a conflict.
(B) NEAR-EQUAL ROUNDING of the SAME measurement — the SAME underlying figure written to different precision: "17 years" vs "17½ years"; "about 5 feet 10 inches" vs "5 feet 11 inches"; "more than 40 years" vs "43 years". Keep the most precise and drop the rounded DUPLICATE(S) — ALL the facts that merely restate the rounded figure — so the set states that measurement once.

DECIDE using, in order: (1) Source authority — contemporary primary reporting, official/court/agency records, and major outlets outrank a lone encyclopedia page or obscure source; a general Wikipedia article often carries a transcription slip a specialized source does not. (2) Cross-source consensus — the value most independent sources in THIS list agree on. (3) Your own knowledge of this documented case.

HARD RULES — obey exactly, they protect accuracy:
- CONSENSUS BEATS PRECISION. NEVER drop a value that MORE independent sources agree on in favor of a lone differing figure, even if the lone one looks more precise or specific. (E.g. if five sources say "$350 million" and one says "$323.5 million", the $350M is the total to keep — do NOT switch to the lone figure.)
- DIFFERENT MEASUREMENTS ARE NOT A CONFLICT. Two figures that differ by more than simple rounding may be DIFFERENT things — a total vs one tranche, an amount demanded vs recovered, a charge vs a conviction count. If they COULD be different measurements, LEAVE BOTH. ("$350 million" total vs "$323.5 million" for one financing program = different, leave both.)
- A figure that legitimately GREW over time, or two genuinely different events, is NOT a conflict.
- UNIQUE INFO IS PROTECTED. Do NOT drop a fact that carries important information found nowhere else, even if it repeats a rounded number. BUT a fact that merely RE-SUMMARIZES facts already present (e.g. a wanted-poster line restating an amount + sentence that other facts already state) is NOT unique — collapse its rounded figure too.
- Never drop BOTH sides of any conflict — one value must always survive. If you cannot tell which is right, drop nothing for that conflict.
Then list the index(es) of the LOSING fact(s) to drop.

Output ONLY JSON:
{"resolutions":[{"drop":[22],"keep":31,"why":"July 31 1972 is the contemporary/consensus date; the general-article line mis-dated it Aug 31"}]}`,
      }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : null;
    if (!parsed) return mergePlace([], []);
    const valid = (n: any) => Number.isInteger(n) && n >= 1 && n <= facts.length;
    const dropSet = new Set<number>();
    const decisions: { keep: string; dropped: string; why: string }[] = [];
    for (const r of Array.isArray(parsed.resolutions) ? parsed.resolutions : []) {
      const drops = (Array.isArray(r?.drop) ? r.drop : []).filter(valid) as number[];
      if (!drops.length) continue;
      // SAFETY: never let a resolution empty out a metric — at least one winner must survive. The
      // model returns "keep" as EITHER a single index OR an array of corroborating indices, so accept
      // both shapes (an earlier build required a single int and silently skipped every array-shaped
      // resolution, which is why nothing was ever dropped). Any valid keep index that is NOT itself in
      // the drop list proves a survivor exists; drops that overlap keep are removed defensively.
      const keepList = (Array.isArray(r?.keep) ? r.keep : [r?.keep]).filter(valid) as number[];
      const survivor = keepList.some((k) => !drops.includes(k));
      if (!survivor) continue;
      // SELF-CONTRADICTING RESOLUTION: the model sometimes explains that two values measure DIFFERENT
      // things and then drops one anyway (seen live: "two decades in Melbourne" vs "56 years as a
      // fugitive" -> "These measure different..." -> dropped). If its own reason says it isn't a
      // conflict, the drop is refused.
      const why = String(r?.why || "");
      if (/measure (?:\w+ )?different|different (?:things|measurements?|quantit|periods?|spans?|events?)|not (?:a|an actual|really a) conflict|not conflicting|both (?:can be|are) (?:true|correct)|compatible/i.test(why)) continue;
      for (const d of drops) if (!keepList.includes(d)) dropSet.add(d);
      const keptLabel = keepList.find((k) => !drops.includes(k));
      decisions.push({ keep: keptLabel ? facts[keptLabel - 1].fact.slice(0, 120) : "", dropped: drops.map((d) => facts[d - 1]?.fact.slice(0, 60)).filter(Boolean).join(" | "), why: typeof r?.why === "string" ? r.why.slice(0, 160) : "resolved conflict" });
    }
    // Hard cap: never drop more than a third of the set, no matter what the model returns — a runaway
    // resolution that guts the research is worse than a little inconsistency.
    return mergePlace([...dropSet], decisions);
  } catch { return mergePlace([], []); }
}

// Persist a resolution: the losing facts must not just be filtered out of THIS response — they
// have to leave the topic's library, or loadLibrary() on the client re-reads them and every
// future script pulls them back in. Dismissal (reversible, id-keyed) is exactly the mechanism the
// user's own "hide" uses, so a resolver-dropped loser behaves identically to one the user hid: it
// stays stored but is filtered from activeFacts forever. Best-effort; a failure just means the
// response is still resolved even if the library heals on the next run.
// PLACE CONFLICTS — their own check. The general resolver was told about place conflicts (type C) and
// caught one 0 of 3 runs (it juggles many conflict types; the rare one loses). Same fix as voice and
// fact-checking: one job, then code verifies the answer. A drop is accepted only if the dropped fact
// literally names the wrong place, a kept fact literally names the right one, and the kept place has
// at least as many supporting facts as the dropped one (consensus).
export async function findPlaceConflicts(facts: { fact: string }[]): Promise<{ drop: number[]; why: string[] }> {
  const none = { drop: [] as number[], why: [] as string[] };
  if (facts.length < 4) return none;
  try {
    const msg = await anthropic().messages.create({
      model: "claude-sonnet-4-6", max_tokens: 700, temperature: 0,
      system: 'You find facts that place the SAME single event at two DIFFERENT locations (e.g. one fact says he escaped from Prison X, another says he walked away from Camp Y). A place mentioned as an EARLIER step ("sent to X, then moved to Y, where he went missing") is NOT a conflict. For each real conflict give the place that MORE facts support (and among equals the more specific one), the facts that support it, and the facts stating the other place. Output ONLY JSON: {"conflicts":[{"event":"...","keepPlace":"exact words from the facts","keep":[n,...],"dropPlace":"exact words from the facts","drop":[n,...]}]} or {"conflicts":[]}.',
      messages: [{ role: "user", content: facts.map((f, i) => `${i + 1}. ${f.fact}`).join("\n") }],
    });
    const t = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    const has = (n: number, place: string) => !!facts[n - 1] && facts[n - 1].fact.toLowerCase().includes(String(place).toLowerCase());
    const drop: number[] = [], why: string[] = [];
    for (const c of Array.isArray(j?.conflicts) ? j.conflicts : []) {
      const kp = String(c?.keepPlace || "").trim(), dp = String(c?.dropPlace || "").trim();
      if (kp.length < 3 || dp.length < 3 || kp.toLowerCase() === dp.toLowerCase()) continue;
      const keep = (Array.isArray(c?.keep) ? c.keep : []).filter((n: number) => has(n, kp));
      const d = (Array.isArray(c?.drop) ? c.drop : []).filter((n: number) => has(n, dp) && !has(n, kp) && !keep.includes(n));
      if (!keep.length || !d.length || keep.length < d.length) continue;
      drop.push(...d); why.push(`place: "${dp}" vs "${kp}" (${keep.length} fact(s) support "${kp}")`);
    }
    return { drop: [...new Set(drop)], why };
  } catch { return none; }
}

// RESEARCH QUOTE CHECK. A research fact that puts words in quotation marks is claiming someone said
// exactly that. Summaries drift (seen live: a fact said "A Florida U.S. Marshals account said ... 'the
// longest manhunt in the history'", but the cited Guardian page says, in the REPORTER's own words,
// "the longest successful manhunt in the history of the marshal's service": wrong speaker, dropped
// word). For each fact with a quoted phrase of 2+ words, fetch its cited page; if the phrase is not on
// the page, rewrite the fact FROM the page passage (verbatim words, correct speaker), or drop it if
// the page doesn't support it. Unreadable page -> left as is (nothing to check against).
const QNORM = (t: string) => t.toLowerCase().replace(/[‘’“”"'.,!?;:—–()-]/g, " ").replace(/\s+/g, " ").trim();
// Quote FORMATTING cleanup (seen live: a correction saved as  according to Major Tod Goodyear,
// "he said he hadn't seen that guy in a long time," before admitting "'You got me.'"  -> a stray
// "he said" inside the speaker's own quote and quotes nested in quotes, which a card then copied).
export function cleanQuoteFormatting(fact: string): string {
  return fact
    .replace(/[“"]\s*[‘']([^‘’'"“”]+?)[’']\s*[”"]/g, '"$1"')
    .replace(/[‘']\s*[“"]([^“”"]+?)[”"]\s*[’']/g, '"$1"')
    .replace(/([“"])\s*(?:he|she|they)\s+said\s+(?=\S+\s+\S+)/gi, "$1");
}
export function quotedPhrases(fact: string): string[] {
  return [...fact.matchAll(/[“"]([^“”"]{6,200})[”"]|(?:^|[\s(])'([^']{6,200})'(?=[\s.,;:)]|$)/g)]
    .map((m) => (m[1] || m[2] || "").trim())
    .filter((q) => q.split(/\s+/).length >= 2);
}
function passageAround(page: string, phrase: string): string {
  const words = QNORM(phrase).split(" ").filter((w) => w.length > 3);
  const low = page.toLowerCase();
  let best = -1, bestScore = 0;
  for (let i = 0; i < low.length; i += 200) {
    const win = low.slice(i, i + 600);
    const score = words.filter((w) => win.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  if (best < 0 || bestScore < Math.min(2, words.length)) return "";
  return page.slice(Math.max(0, best - 350), best + 950);
}
export async function verifyFactQuotes<T extends { fact: string; source?: string | null }>(facts: T[], deadlineMs: number, knownPages?: Map<string, string>): Promise<{ replace: { from: T; to: T | null }[]; checked: number }> {
  const candidates = facts.filter((f) => f.source && /^https?:/.test(String(f.source)) && quotedPhrases(f.fact).length).slice(0, 10);
  if (!candidates.length) return { replace: [], checked: 0 };
  const pages = new Map<string, Promise<string>>();
  const pageText = (url: string) => {
    // Pages the caller already read (e.g. a feature article fetched via the Internet Archive because the
    // live site blocks bots) are used as-is; re-fetching them directly would get the block page.
    if (!pages.has(url) && knownPages?.has(url)) pages.set(url, Promise.resolve(knownPages.get(url) as string));
    if (!pages.has(url)) pages.set(url, fetchReadableDoc(url, deadlineMs).then((d) => (d && !d.isPdf ? String(d.text || "") : "")).catch(() => ""));
    return pages.get(url)!;
  };
  // Other pages already cited in this research: a quote credited to the WRONG article (seen live: the
  // photo quote is on a CBS page, not the ABC7 page cited) is found there instead of being lost.
  const otherUrls = [...new Set(facts.map((f) => String(f.source || "")).filter((u) => /^https?:/.test(u)))].slice(0, 12);
  const unquote = (t: string) => t.replace(/[“"]([^“”"]{6,200})[”"]/g, "$1").replace(/(^|[\s(])'([^']{6,200})'(?=[\s.,;:)]|$)/g, "$1$2");
  const results = await Promise.all(candidates.map(async (f) => {
    const page = await pageText(String(f.source));
    if (page.length < 300) return null; // unreadable: can't verify, leave it
    const missing = quotedPhrases(f.fact).filter((q) => !QNORM(page).includes(QNORM(q)));
    if (!missing.length) {
      // Quotes are real: only fix messy FORMATTING if any (and the cleaned quotes must still be on the page).
      const tidy = cleanQuoteFormatting(f.fact);
      const tidyOk = quotedPhrases(tidy).every((q) => QNORM(page).includes(QNORM(q)));
      return tidy !== f.fact && tidyOk ? { from: f, to: { ...f, fact: tidy } as T } : null;
    }
    // Find the page that actually carries this passage: the cited one first, then the others.
    let usePage = "", useUrl = "", passage = passageAround(page, missing[0]);
    if (passage) { usePage = page; useUrl = String(f.source); } // the cited page discusses it: correct against it
    if (!usePage) {
      for (const u of otherUrls) {
        if (u === f.source) continue;
        const pg = await pageText(u);
        if (pg.length > 300 && QNORM(pg).includes(QNORM(missing[0]))) { usePage = pg; useUrl = u; passage = passageAround(pg, missing[0]); break; }
      }
    }
    // Nowhere in the research: keep the detail, drop the claim of exact words.
    if (!usePage || !passage) {
      const plain = unquote(f.fact);
      return plain !== f.fact ? { from: f, to: { ...f, fact: plain } as T } : null;
    }
    const pageN = QNORM(usePage);
    try {
      const msg = await anthropic().messages.create({
        model: "claude-sonnet-4-6", max_tokens: 400, temperature: 0,
        system: 'You correct one research fact against its source passage. The fact quotes words the passage does not contain verbatim. Rewrite the fact so that: (1) any words in quotation marks are copied EXACTLY from the passage; (2) they are attributed to whoever the passage says said them, and if they are the writer\'s or publication\'s own words, attribute them to the publication (e.g. "The Guardian described it as..."), never to an agency or person who did not say them; (3) quote ONLY the spoken words, once, in plain double quotes: never nest quotes inside quotes and never put \"he said\" inside a quote; (4) nothing else is added. If the passage CONTRADICTS the fact, output {"drop":true}. Output ONLY JSON: {"fact":"..."} or {"drop":true}.',
        messages: [{ role: "user", content: `SOURCE URL: ${useUrl}\n\nFACT:\n${f.fact}\n\nSOURCE PASSAGE:\n<<<\n${passage}\n>>>` }],
      });
      const t = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
      if (j?.drop) return { from: f, to: null as T | null };
      const fixed = typeof j?.fact === "string" ? cleanQuoteFormatting(j.fact.trim()) : "";
      if (!fixed || quotedPhrases(fixed).some((q) => !pageN.includes(QNORM(q)))) return { from: f, to: { ...f, fact: unquote(f.fact) } as T };
      return { from: f, to: { ...f, fact: fixed, source: useUrl } as T };
    } catch { return null; }
  }));
  const replace = results.filter((r): r is { from: T; to: T | null } => !!r);
  return { replace, checked: candidates.length };
}

async function dismissResolvedLosers(userId: string | undefined, topic: string, losers: ResearchFact[]): Promise<void> {
  if (!userId || !topic || !losers.length) return;
  try {
    const lib = await getLibrary(userId, topic);
    const add = losers.map((f) => factId(f.fact)).filter(Boolean);
    if (!add.length) return;
    const next = Array.from(new Set([...lib.dismissed, ...add]));
    if (next.length !== lib.dismissed.length) await setDismissed(userId, topic, next);
  } catch { /* best effort */ }
}

/**
 * Deepen the facts for a chosen case. The plain fact fetch returns the surface of
 * a story (who, what, when); a documentary also needs the NAMED specifics that
 * make it credible: the program or system involved, the person's stated motive,
 * how they got their access, the settings by name, the precise outcome. Perplexity
 * on a broad query misses these. So Claude, which knows famous cases in depth,
 * generates the targeted QUESTIONS, and Perplexity answers them WITH CITATIONS.
 * Claude never supplies a fact directly: only sourced answers reach the script, so
 * the anti-fabrication guarantee holds while the grounding gets much richer.
 */

// OFF-SUBJECT / NON-FACT JUNK sanitizer for EXPLAINER (phenomenon) topics. A stats-dashboard page
// (e.g. the BLS CPI landing page) or an academic PDF leaks three shapes of noise into the context
// pool that are topic-AGNOSTIC and never the subject of a specific explainer: (1) agency admin
// chrome — office address/phone, who produces it, next-release schedules, definitional boilerplate;
// (2) raw index-table rows ("<Category> CPI 12-month percent change in <Month YYYY>: X%") and the
// seasonally-adjusted headline lines — we keep the PROSE versions of the on-subject numbers, these
// colon-table dumps are duplicative padding; (3) study methodology/provenance ("data were obtained
// from ACCRA", "the study examined…", "deflated by…"). This MUST run at the deepen RETURN path, not
// only at extraction: the cache unions facts across brief versions (getBestAcrossVersions), so junk
// cached under an older version resurfaces on every later run unless it is stripped on the way out.
// FILE/LANDING-PAGE METADATA junk — TOPIC-AGNOSTIC, applies to EVENT cases too (not just explainer).
// A primary-source URL that points at a document LANDING page (e.g. an FBI Vault "/view" listing)
// rather than the document itself yields "facts" about the FILE — its size in kB/bytes, that it is a
// PDF, its part number, that it lives in a records repository. These are never facts about the case.
// The Wayback fallback can now recover such landing pages, so this must strip their metadata for all
// topics or that noise ships (O.J. Vault run put 7 of these in the set).
export const FILE_META_JUNK_RE = /\b\d[\d,]*\s*(?:kb|mb|gb|bytes)\b|available as (?:a |an )?pdf\b|pdf (?:document|file) size|hosted on\b.{0,50}?(?:vault|repository)|\bcategorized under\b|\brecords system\b|\bis labeled\b|\bthe (?:file|document|record|subject)\b.{0,55}?\b(?:is (?:identified|available|categorized|hosted|listed))/i;
const PHENOM_JUNK_RE = /(telephone number|is located at|is produced by|office of prices|federal center|scheduled to be released|next release|news release headline|is described as a measure|indexes are available|average price data for select|monthly labor review|beyond the numbers|payroll employment was|unemployment rate was|productivity was|employment cost index|import price index|export price index|producer price index|12-month percent change in .*\d{4}\s*:|rose \d[\d.]* percent in .*\d{4}|rose \d[\d.]* percent over the last 12 months|percentage change data presented|\(preliminary\) in |index for all items less food and energy|were obtained from|was obtained from|were drawn from|data were obtained|the study (?:examined|used)|outcome variable|named in the survey|price index was computed|deflated by|weighted based on|expenditure shares|census \d{4}|\bSIC code\b|random effects model)/i;

function stripPhenomenonJunk(facts: ResearchFact[]): { kept: ResearchFact[]; dropped: number } {
  let dropped = 0;
  const kept = facts.filter((f) => {
    if (f && typeof f.fact === "string" && PHENOM_JUNK_RE.test(f.fact)) { dropped++; return false; }
    return true;
  });
  return { kept, dropped };
}

// PRIMARY-SOURCE DOCUMENT MINING. Perplexity returns the NEWS-SUMMARY layer — the big round
// numbers everyone reports — but the vivid, script-winning granularity (a $1.3M debit-card trail,
// AI-artist aliases, month-by-month milestones, the warnings-and-denials thread) lives in the
// actual charging document, which a well-read model has in memory and Perplexity's summaries omit.
// This closes that gap the only way that works: FETCH the primary-source document the citations
// already point at and extract facts straight from its text. Claude still never invents — it reads
// a real fetched document and every extracted fact carries that document's URL as its source.
// Official / primary-record domains — deliberately broad so this is not a fraud/DOJ-only feature:
// any government host (US .gov incl. state/agency, UK gov.uk, EU europa.eu), court archives, and
// standards/records bodies. On a niche with no fetchable primary doc (a philosophy explainer whose
// primary source is a book) this simply matches nothing and no-ops — never assumes a legal shape.
export const PRIMARY_SOURCE_RE = /^https?:\/\/(?:www\.)?(?:[a-z0-9-]+\.)*(?:gov(?:\.[a-z]{2})?|mil|courtlistener\.com|europa\.eu|un\.org|who\.int|nih\.gov|nasa\.gov|federalregister\.gov)(?:\/|$)/i;
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#\d+;/g, " ").replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
// Fetch and normalize ONE document to readable HTML text or PDF bytes. Returns null (with a
// telemetry line) when the document can't be read, so the caller can try a fallback or move on.
// `via` labels the attempt ("direct" vs "wayback") in the logs.
type ReadableDoc = { isPdf: boolean; text: string; pdfB64: string; docBytes: number };
async function fetchReadableDoc(url: string, deadlineMs: number, via: "direct" | "wayback" = "direct"): Promise<ReadableDoc | null> {
  if (Date.now() > deadlineMs) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    // A FULL browser User-Agent is required: .gov hosts (justice.gov confirmed) return 403 to a
    // bot-style UA but 200 to a real browser UA.
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "accept": "application/pdf,text/html,application/xhtml+xml,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timer);
    if (!res.ok) { console.error(`[primary-doc] fetch_failed ${JSON.stringify({ url, via, status: res.status, reason: "http_error", source_type: "government_doc" })}`); return null; }
    const ctype = res.headers.get("content-type") || "";
    const isPdf = /pdf/i.test(ctype) || /\.pdf(\?|$)/i.test(url);
    if (isPdf) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 24 * 1024 * 1024) { console.error(`[primary-doc] fetch_failed ${JSON.stringify({ url, via, reason: "pdf_too_large", bytes: buf.length, source_type: "government_pdf" })}`); return null; }
      return { isPdf: true, text: "", pdfB64: buf.toString("base64"), docBytes: buf.length };
    }
    if (/octet-stream|application\/(?!pdf)/i.test(ctype)) { console.error(`[primary-doc] fetch_failed ${JSON.stringify({ url, via, reason: "unreadable_binary", content_type: ctype, source_type: "government_doc" })}`); return null; }
    const text = htmlToText(await res.text()).slice(0, 50_000);
    if (text.length < 400) { console.error(`[primary-doc] fetch_failed ${JSON.stringify({ url, via, reason: "empty_after_htmlstrip", chars: text.length, source_type: "government_doc" })}`); return null; }
    return { isPdf: false, text, pdfB64: "", docBytes: text.length };
  } catch (e) {
    console.error(`[primary-doc] fetch_failed ${JSON.stringify({ url, via, reason: "fetch_threw", detail: (e as any)?.message, source_type: "government_doc" })}`);
    return null;
  }
}

// WAYBACK FALLBACK. Government primary sources (usmarshals.gov, some justice.gov pages) increasingly
// return 403/anti-bot to any automated request even with a browser UA, so the ORIGINAL wording never
// gets read and we lean on secondary coverage. The Internet Archive keeps public snapshots of those
// same pages. When the direct fetch fails, ask the availability API for the closest snapshot and read
// its RAW capture (the `id_` form returns the original resource without the Wayback toolbar/rewrites),
// so the primary document's exact language is recovered instead of lost.
async function fetchViaWayback(url: string, deadlineMs: number): Promise<ReadableDoc | null> {
  if (Date.now() > deadlineMs) return null;
  // Direct latest-snapshot form: "/web/2id_/<url>" redirects to the capture nearest to now and the
  // "id_" suffix serves the ORIGINAL bytes (PDF or clean HTML) with no Wayback toolbar or link
  // rewriting. This avoids the availability API, which rate-limits (429) under load. Some pages were
  // only ever archived AS a 403/"Access Denied" capture — fetchReadableDoc returns null for those,
  // which is an honest miss (nothing readable exists), not an error.
  const raw = `https://web.archive.org/web/2id_/${url}`;
  const doc = await fetchReadableDoc(raw, deadlineMs, "wayback");
  console.log(`[primary-doc] ${doc ? "wayback_ok" : "wayback_miss"} ${JSON.stringify({ url, kind: doc?.isPdf ? "pdf" : doc ? "html" : "none" })}`);
  return doc;
}

// CASE LABEL CHECK. The case name/descriptor and summary come from resolveSubjects, which asks Claude
// FROM MEMORY (no sources) which case a topic is about. It can mis-recall (seen live: "Frank Freshwaters
// — Ohio fugitive captured in Morocco"; he was arrested in Florida), and that label then fed the
// grounding line, the angle prompt, the angle checker, and the generator's source block, unchecked.
// Once sourced facts exist, every proper noun and year in the label must appear somewhere in them:
// a descriptor with ANY unsupported term is dropped (the bare case name stays), and each summary
// sentence with one is dropped. Deterministic: no model judges this.
export function unsupportedLabelTerms(text: string, factsText: string): string[] {
  const hay = factsText.toLowerCase();
  const words = String(text || "").match(/\b(?:[A-Z][a-zA-Z'’]{2,}|\d{4})\b/g) || [];
  const vague = (String(text || "").match(/\b(?:abroad|overseas|foreign|internationally|another country|out of the country|outside the (?:u\.?s\.?|united states|country))\b/gi) || []);
  return [...new Set([...words, ...vague])].filter((w) => !hay.includes(w.toLowerCase().replace(/['’]s$/, "")));
}
export function sanitizeCaseLabel(name: string, summary: string, facts: string[]): { name: string; summary: string; removed: string[] } {
  const factsText = facts.join("\n");
  if (!factsText.trim()) return { name, summary, removed: [] };
  const removed: string[] = [];
  const [entity, ...rest] = String(name || "").split(/\s+[—–]\s+/);
  let outName = name;
  const descriptor = rest.join(" — ");
  if (descriptor) {
    const bad = unsupportedLabelTerms(descriptor, factsText);
    if (bad.length) { outName = entity; removed.push(...bad); }
  }
  // Initials ("D.B. Cooper", "U.S.") are not sentence ends: shield their dots while splitting
  // (seen live: "D.B." split off a stray "B." that survived as the whole summary).
  const DOT = "\u2024";
  const shielded = String(summary || "").replace(/\b([A-Z])\.(?=\s?[A-Z][.\s])/g, `$1${DOT}`).replace(/\b([A-Z])\.(?=[A-Z]\.)/g, `$1${DOT}`);
  const sentences = (shielded.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || []).map((x) => x.split(DOT).join("."));
  const kept = sentences.filter((sn) => { const bad = unsupportedLabelTerms(sn, factsText); if (bad.length) removed.push(...bad); return !bad.length; });
  return { name: outName, summary: kept.join(" ").trim(), removed: [...new Set(removed)] };
}

// RELEVANCE GATE for mined primary documents. The URL lookup can return an UNRELATED official doc
// (seen live: a bankruptcy opinion, Carlson v. Carlson, mined into a Frank Freshwaters fugitive case,
// apparently because its judge is a "Frank"; 6 junk facts reached the script). A doc about the case
// names the case's DISTINCTIVE token: the last proper-noun word of the case name (a surname or
// a named entity's core name), never a first name. Generic words (case, scandal, fugitive...) never count.
const ANCHOR_GENERIC = new Set(["case","scandal","fugitive","manhunt","murder","killing","heist","fraud","scheme","trial","story","escape","disappearance","death","investigation","affair","incident","crash","collapse","rise","fall","history","mystery","attack","shooting","robbery","hunt","killer","capture","arrest","united","states","america","american","federal","county","state","city","company","inc","corp","the","market","takedown","network","group","bank","road","ring","operation","gang","cartel","empire","files","papers","leak"]);
// GROUND THE CASE CARDS. Candidates are named from model memory and the ranker can prepend a "more
// famous" case, so a card can be about the wrong story (seen live: topic "Arthur Gerald Jones", an
// identity-fraud fugitive found in 2011, got a D.B. Cooper card, and Jones's own card called him a
// Cooper suspect; no source says so). (1) A short topic that is just a name keeps only cards that
// involve that name. (2) Each card's label and summary lose any proper noun the grounded research
// and the topic don't contain; a summary emptied that way falls back to the research note.
export function groundCandidates<T extends { name: string; summary: string }>(cands: T[], topic: string, factTexts: string[], fallback: string): T[] {
  const t = String(topic || "").trim();
  const nameOnly = t.split(/\s+/).length <= 5 && (t.match(/\b[A-Z][A-Za-z'’.-]+/g) || []).length >= 2 && !/\b(?:the|how|why|what|who|when|he|she|they|his|her|a|an|of|in)\b/i.test(t);
  const anchor = nameOnly ? caseAnchorToken(t) : null;
  let out = anchor ? cands.filter((c) => c.name.toLowerCase().includes(anchor.toLowerCase())) : cands;
  if (!out.length) out = cands;
  // A "nothing found" placeholder is not a case (seen live: "Arthur Gerald Jones — identity unknown or
  // insufficiently documented" shown beside the real case, forcing a pick). Drop it when a real one exists.
  const NOT_A_CASE = /\b(?:identity unknown|identity unclear|multiple individuals|insufficiently documented|no (?:documented|verified|known) (?:historical )?(?:case|match|record)|not retrievable|cannot be confirmed|could not be (?:identified|confirmed)|unclear (?:which|who))\b/i;
  const real = out.filter((c) => !NOT_A_CASE.test(`${c.name} ${c.summary}`));
  if (real.length) out = real;
  // Only a placeholder came back (seen live: auto-picked "Arthur Gerald Jones — identity unknown or
  // insufficiently documented" as the case label). Keep the name, drop the "not found" wording, and
  // describe it from the grounded research note instead.
  else out = out.map((c) => ({ ...c, name: c.name.split(/\s+[—–-]\s+/)[0].trim() || c.name, summary: fallback || c.summary.replace(NOT_A_CASE, "").trim() }));
  // A topic that is just a name: the label IS that name. Model descriptors after the dash are where the
  // "identity unknown" / "identity unclear or multiple individuals" placeholders and invented framings
  // live (seen live, three wordings), and a phrase list can't cover them all.
  if (nameOnly) out = out.map((c) => { const entity = c.name.split(/\s+[—–]\s+/)[0].trim(); return entity && entity !== c.name ? { ...c, name: entity } : c; });
  const support = [...factTexts, t].filter(Boolean);
  if (!support.join("").trim() || factTexts.join("").trim().length < 40) return out;
  return out.map((c) => {
    const sc = sanitizeCaseLabel(c.name, c.summary, support);
    if (!sc.removed.length) return c;
    console.log(`[candidates] removed unsupported ${JSON.stringify(sc.removed)} from "${c.name.slice(0, 60)}"`);
    return { ...c, name: sc.name, summary: sc.summary || fallback || c.summary };
  });
}

export function caseAnchorToken(caseName: string): string | null {
  const entity = String(caseName || "").split(/\s+[—–-]\s+|:\s/)[0];
  const words = (entity.match(/[A-Z][A-Za-z'’.]{3,}/g) || [])
    .map((w) => w.replace(/[.'’]+$/, ""))
    .filter((w) => !ANCHOR_GENERIC.has(w.toLowerCase()));
  if (!words.length) return null;
  // The LAST distinctive word: a person's surname ("Wright", not "George"), or an entity's core name.
  return words[words.length - 1];
}
export function docMentionsAnchor(textOrFacts: string, anchor: string | null): boolean {
  if (!anchor) return true; // no distinctive token -> can't judge, don't block
  return textOrFacts.toLowerCase().includes(anchor.toLowerCase());
}

// Same gate for facts ALREADY in a topic's library (mined before the gate existed): a source that
// contributed 3+ facts, none of which names the case's anchor, is an unrelated document -> dismiss.
export function offTopicSourceFacts<T extends { fact: string; source?: string | null }>(facts: T[], anchor: string | null): T[] {
  if (!anchor) return [];
  const bySrc = new Map<string, T[]>();
  for (const f of facts) { const k = f.source || ""; if (k) (bySrc.get(k) || bySrc.set(k, []).get(k)!).push(f); }
  const out: T[] = [];
  for (const group of bySrc.values()) if (group.length >= 3 && !docMentionsAnchor(group.map((g) => g.fact).join("\n"), anchor)) out.push(...group);
  return out;
}

async function minePrimarySourceDocs(
  caseName: string,
  urls: string[],
  watchlist: string[],
  deadlineMs: number,
  pkey?: string,
  summary?: string,
  isExplainer?: boolean,
): Promise<ResearchFact[]> {
  // PDFs are now READ, not skipped — the deepest facts (aliases, milestones, quoted lines) are
  // PDF-only in a charging document, and Claude reads a PDF natively via a base64 document block,
  // so no PDF library is needed. HTML press releases / opinions are read as text as before.
  let primary = [...new Set(urls.filter((u) => typeof u === "string" && PRIMARY_SOURCE_RE.test(u)))].slice(0, 3);
  // If NO primary-source URL rode along in the fact citations, the mining would never see the
  // charging document. So actively resolve it: ask for the official document URL directly and
  // harvest the primary-source links from that answer's citations (this is where the indictment
  // PDF / DOJ release actually surfaces). Only runs when citations lacked one, so it adds no cost
  // on cases where the primary source was already cited.
  if (!primary.length && pkey && Date.now() < deadlineMs) {
    try {
      const q = [`What is the exact URL of the official PRIMARY-SOURCE document for ${caseName} — the DOJ or U.S. Attorney press release, the indictment or complaint PDF, the SEC litigation release, or the court opinion? Give the direct link.`];
      const ans = await fetchPerplexityAnswers(pkey, caseName, summary, [caseName], q);
      const resolved = ans.map((a) => a.source).filter((s): s is string => !!s && PRIMARY_SOURCE_RE.test(s));
      primary = [...new Set(resolved)].slice(0, 3);
      if (primary.length) console.log(`[primary-doc] resolved ${primary.length} primary URL(s) via lookup (none were in citations)`);
    } catch (e) {
      console.error("[primary-doc] URL resolve failed:", (e as any)?.message);
    }
  }
  if (!primary.length) { console.log("[primary-doc] no primary-source URL found (citations or lookup) — skipping"); return []; }
  // A CASE topic mines a charging document for overt acts. A PHENOMENON/EXPLAINER topic mines an
  // agency report or study, where the failure mode is the OPPOSITE: a dashboard page (e.g. the BLS
  // CPI landing page) lists dozens of numbers that have nothing to do with the subject — airline
  // fares, used-car prices, the office phone number. Enumerating those pollutes the pool with
  // off-topic "facts". So for an explainer the extraction is RELEVANCE-GATED: keep only facts that
  // materially bear on the specific subject, and explicitly drop generic/contact/unrelated rows.
  const SYSTEM = isExplainer
    ? `You extract facts from an official document (agency report, study, dataset page) that are DIRECTLY RELEVANT to a specific subject. Output ONLY facts the document literally states — never add, infer, or recall from your own knowledge. RELEVANCE IS THE ONLY FILTER THAT MATTERS: keep a fact ONLY if it is specifically about the subject given below, its direct drivers/mechanism, or a study finding about it. This is often a general statistics dashboard (e.g. a CPI landing page) that lists dozens of unrelated category values — you MUST DROP every one of those. HARD DROP LIST, no exceptions: rows for any category that is not the subject (e.g. on a fast-food subject: airline fares, used/new cars, apparel, medical/hospital/physicians, tobacco, alcohol, motor vehicle, gasoline/fuel/energy/electricity/natural gas, shelter/rent, transportation services); overall/headline index values and other-index values that are not a DIRECT comparator to the subject; generic macro indicators (unemployment rate, payroll employment, productivity, import/export price index, employment cost index); release schedules and dates-of-next-release; descriptive/definitional boilerplate ("the CPI is a measure of…", "indexes are available for…"); and all contact/office/navigation text. A DIRECT comparator IS allowed (for a fast-food subject: food away from home, limited-service meals, full-service meals, food at home, groceries, overall inflation as a single benchmark). Better to return 15 tightly on-subject facts than 60 padded with an entire statistics table. Each item ONE concrete specific with its number/date where stated.`
    : `You extract granular facts from a PRIMARY-SOURCE official document (indictment, complaint, court opinion, agency report, press release). Output ONLY facts the document literally states — never add, infer, or recall anything from your own knowledge. ENUMERATE, do not summarize or select highlights: aim for 50-80 distinct items, each ONE concrete specific. Read the WHOLE document, and mine the DETAILED-ALLEGATIONS / OVERT-ACTS / "Manner and Means" section hardest — that is where the granularity a summary drops lives: every DATED email or message with its quoted words and date (e.g. an Oct 2018 email about needing content), every DOLLAR movement (amount, date, instrument, from/to), every NAMED entity/alias/account/product/song exactly as written, every co-conspirator designation exactly as labeled (e.g. "CC-1", "CC-2", "Co-Conspirator 3"), every month-by-month milestone (streams, accounts, income), and every WARNING or challenge and the response to it. Skip navigation, boilerplate, and legal-standard disclaimers.`;
  const ASK = isExplainer
    ? `SUBJECT: ${caseName}${summary ? `\nCONTEXT: ${summary}` : ""}\n\nExtract ONLY facts specifically about the subject above, its direct drivers/mechanism, a study finding about it, or a DIRECT comparator to it — each with its number/date. This may be a statistics dashboard listing many unrelated categories; DROP every unrelated category row, overall/other index value that is not a direct comparator, generic macro indicator (unemployment, payroll, productivity, import/export prices), release schedule, definitional boilerplate, and contact/office/navigation line. Better to return 15 tightly on-subject facts than 60 padded with an unrelated statistics table. Output ONLY JSON: {"facts":["...", "..."]}`
    : `CASE: ${caseName}\n\nEnumerate EVERY granular fact this document states — read the entire document, mine the detailed-allegations / overt-acts section hardest (dated quoted emails, each dollar movement, CC-N designations, month-by-month milestones), aim for 50-80 items, the specific over the general, nothing invented. Output ONLY JSON: {"facts":["...", "..."]}`;
  const out: ResearchFact[] = [];
  for (const url of primary) {
    if (Date.now() > deadlineMs) break;
    // Read the primary document directly; if it can't be read (403/anti-bot, timeout, empty), fall
    // back to the Internet Archive's snapshot so the original wording is recovered rather than lost.
    let doc = await fetchReadableDoc(url, deadlineMs, "direct");
    if (!doc) doc = await fetchViaWayback(url, deadlineMs);
    if (!doc) continue;
    const { isPdf, text, pdfB64, docBytes } = doc;
    const anchor = isExplainer ? null : caseAnchorToken(caseName);
    if (!isPdf && text && !docMentionsAnchor(text, anchor)) {
      console.log(`[primary-doc] SKIPPED unrelated doc (never mentions "${anchor}"): ${url}`);
      continue;
    }
    // Extract EXHAUSTIVELY. Claude reads the real document (PDF natively, or the HTML text) and
    // lists what it literally states — no memory, no invention; the URL is the source for each
    // fact. This is the granular layer Perplexity summaries omit. Niche-agnostic: the same
    // instruction pulls specifics from a fraud indictment, a court opinion, or an agency report.
    try {
      // A document block (PDF) or the stripped HTML text, reused across both passes.
      const docBlock: any = pdfB64
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfB64 } }
        : null;
      const withDoc = (ask: string): any => docBlock ? [docBlock, { type: "text", text: ask }] : `${ask}\n\nSOURCE DOCUMENT URL: ${url}\n\nDOCUMENT TEXT:\n"""\n${text}\n"""`;

      // PASS A — MAP. A single "extract the key facts" call compresses the buried overt-acts away,
      // so first locate WHERE the granular allegations live. Cheap; names the evidence-dense
      // sections so pass B can be told to mine them exhaustively.
      let denseHint = "";
      try {
        const mapMsg = await anthropic().messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 600,
          temperature: 0,
          system: "You map the structure of an official document. List its section/heading names and mark which contain the DETAILED FACTUAL ALLEGATIONS — the speaking-indictment narrative, 'Manner and Means', 'Overt Acts', or the dated-events section (as opposed to legal standards, statutes, boilerplate). Output ONLY JSON: {\"denseSections\":[\"exact heading\", ...]}.",
          messages: [{ role: "user", content: withDoc("Map this document. Output ONLY JSON: {\"denseSections\":[...]}.") }],
        });
        const mc = mapMsg.content[0]?.type === "text" ? mapMsg.content[0].text : "";
        const mm = mc.match(/\{[\s\S]*\}/);
        const ds = mm ? (JSON.parse(mm[0])?.denseSections) : null;
        if (Array.isArray(ds) && ds.length) denseHint = `\n\nThe detailed allegations are concentrated in these sections — mine them the hardest: ${ds.filter((x: any) => typeof x === "string").slice(0, 8).join("; ")}.`;
      } catch { /* map is best-effort; pass B still runs exhaustively */ }

      // PASS B — EXHAUST. Enumerate every evidentiary event, not "key facts".
      const msg = await anthropic().messages.create({
        model: "claude-sonnet-4-6",
        // A PDF indictment is dense; give the enumeration room so the deep overt-acts section
        // (dated emails, dollar movements, CC-N) is not truncated out of the fact list. Capped at
        // 6000 (was 8000) because an 8000-token generation is a major time sink and the deep path
        // must land under the 300s route cap; 6000 still holds ~70 enumerated facts.
        max_tokens: pdfB64 ? 6000 : 4500,
        temperature: 0,
        system: SYSTEM,
        messages: [{ role: "user", content: withDoc(ASK + denseHint) }],
      });
      const content = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const m = content.match(/\{[\s\S]*\}/);
      const parsed = m ? JSON.parse(m[0]) : null;
      const facts: string[] = Array.isArray(parsed?.facts) ? parsed.facts.filter((f: any) => typeof f === "string" && f.trim().length > 8) : [];
      // QUALITY GATE. A substantial document that yields almost nothing was not really read (a
      // failed PDF decode, an OCR-only scan, a refusal). Do NOT pass that off as "researched" — log
      // fetch_failed so the gap is visible, and add nothing from this doc.
      if ((isPdf && docBytes > 40_000 && facts.length < 5) || (!isPdf && text.length > 8_000 && facts.length < 3)) {
        console.error(`[primary-doc] fetch_failed ${JSON.stringify({ url, reason: "extraction_too_thin", facts: facts.length, bytes: isPdf ? docBytes : text.length, source_type: isPdf ? "government_pdf" : "government_doc" })}`);
        continue;
      }
      // DETERMINISTIC BACKSTOP (explainer only). The relevance PROMPT drops most junk, but a stats
      // dashboard (e.g. the BLS CPI landing page) still tempts the model to enumerate its whole
      // category table and administrative chrome as "context". These patterns are topic-AGNOSTIC
      // garbage — office/contact lines, next-release schedules, definitional boilerplate, and generic
      // macro indicators — that can never be the SUBJECT of a specific explainer, so drop them
      // outright regardless of what the model returned. (Category-row over-inclusion is handled by
      // the strengthened prompt; this catches only the unambiguous non-facts.)
      let droppedJunk = 0;
      if (!docMentionsAnchor(facts.join("\n"), anchor)) {
        console.log(`[primary-doc] DROPPED ${facts.length} facts from unrelated doc (no fact mentions "${anchor}"): ${url}`);
        continue;
      }
      for (const f of facts.slice(0, 80)) {
        // Guard the living-person watchlist the same way the other paths do.
        if (watchlist.some((w) => f.toLowerCase().includes(w.toLowerCase()))) continue;
        if (isExplainer && PHENOM_JUNK_RE.test(f)) { droppedJunk++; continue; }
        // File/landing-page metadata is junk for EVERY topic type, not just explainers.
        if (FILE_META_JUNK_RE.test(f)) { droppedJunk++; continue; }
        out.push({ fact: f.trim(), source: url, context: true });
      }
      if (droppedJunk) console.log(`[primary-doc] backstop dropped ${droppedJunk} administrative/off-subject line(s) from ${url}`);
      // EVIDENTIARY-DENSITY PROVENANCE SIGNAL (niche-agnostic). The overt-acts layer is made of
      // dated events, dollar movements, quoted lines, and co-conspirator designations. Counting how
      // many extracted facts carry each tells us — without any case-specific anchor list — whether
      // the deep section actually came through or got summarized away. Near-zero here on a real
      // charging document = the extraction is still compressing (or the doc wasn't truly read).
      const dated = facts.filter((f) => /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}?,?\s*\d{4}\b|\b\d{4}\b/i.test(f)).length;
      const dollar = facts.filter((f) => /[$£€]\s?\d|\b\d[\d,]*(?:\.\d+)?\s*(?:million|thousand|billion|dollars)\b/i.test(f)).length;
      const quoted = facts.filter((f) => /["“][^"”]{6,}["”]|wrote|stated|said|emailed|texted/i.test(f)).length;
      const ccN = facts.filter((f) => /\bC\.?C\.?-?\s?\d\b|co-?conspirator\s*\d/i.test(f)).length;
      console.log(`[primary-doc] extracted ${facts.length} facts from ${isPdf ? "PDF" : "HTML"} ${url} — evidentiary density: dated=${dated} dollar=${dollar} quoted=${quoted} ccN=${ccN}`);
    } catch (e) {
      console.error(`[primary-doc] extraction failed for ${url}:`, (e as any)?.message);
    }
  }
  return out;
}
export async function deepenCaseFacts(input: { caseName: string; summary?: string; niche?: string; sourcePayoff?: string; sourceSubject?: string; userId?: string; kind?: TopicKind; topicAnchor?: string; targetFacts?: number; targetMinutes?: number }): Promise<DeepenResult> {
  const t0 = Date.now();
  // Sanitize the case identity first: arbitrary prose in this field drifts retrieval.
  const caseName = toCaseIdentity(input.caseName || "");
  if (!caseName.trim()) return { facts: [], conflicts: [], status: "no-facts" };
  // MOVE #5 — the per-minute fact budget the requested runtime honestly needs, and the hard
  // cap on how many facts we will collect for it. targetFacts (if a caller passes it) wins;
  // otherwise it is derived from the length slider's minutes.
  const requestedMinutes = input.targetMinutes && input.targetMinutes > 0 ? Math.round(input.targetMinutes) : undefined;
  // DEPTH FLOOR for the reordered flow. Research now runs BEFORE the length page, so targetMinutes
  // is undefined at grounding — and factBudgetForMinutes(undefined) defaulted to 10 min (budget 25),
  // which made `deep` false and capped the whole set (mined document facts included) at 25. Since the
  // fact set is gathered ONCE up front and cached for the angle + the eventual build, research it at
  // real depth: floor the budget minutes to 20 when no length was given. A short final video simply
  // draws on fewer of the cached facts; it never needs a shallower research pass.
  const budgetMinutes = input.targetMinutes && input.targetMinutes > 0 ? input.targetMinutes : 20;
  const budget = input.targetFacts && input.targetFacts > 0 ? Math.min(MAX_FACTS, Math.round(input.targetFacts)) : factBudgetForMinutes(budgetMinutes);
  // A long (deep) ask keeps the FULL ceiling so the granular document facts survive alongside the
  // narrative set; a short ask stays near its per-minute budget so it isn't over-stuffed.
  const factCap = budget >= 40 ? MAX_FACTS : Math.min(MAX_FACTS, Math.max(16, budget));
  // Attach the honest-length reckoning to any ok-result: what the final facts support vs what
  // was asked, so the UI can tell the truth about the supportable length (5d).
  const withHonesty = (r: DeepenResult): DeepenResult => {
    if (r.status !== "ok") return r;
    const contextCount = r.facts.filter((f) => f.context).length;
    return { ...r, factCount: r.facts.length, contextCount, honestMinutes: honestMinutes(r.facts.length), requestedMinutes, budget };
  };
  const pkey = process.env.PERPLEXITY_API_KEY;
  // No Perplexity means no citable answers, and Claude-only facts would be
  // unsourced, which is exactly what must not reach the script. This is an OUTAGE,
  // not an empty case — report it as such so the UI shows a different state.
  if (!pkey) return { facts: [], conflicts: [], status: "no-key" };

  // 1) Claude corrects the case label AND locks the canonical entities AND writes
  // the questions, in one call. Entity locking kills a whole failure class: if the
  // label says "Operation Rough Rider" but the real case is "Operation Black
  // Biscuit", every question inherits the wrong name, Perplexity papers over it,
  // and the wrong name reaches the finished script where a Director's note cannot
  // override it. Correcting it here, at the source, fixes it everywhere downstream.
  // An explainer/hypothetical grounds on a BODY OF EVIDENCE about a subject, not a
  // dated case: there is no operation codename to correct, no defendants, no aftermath.
  // The mechanism, the real numbers, and what is still unsettled are what a science
  // script actually runs on, so the brief swaps to those.
  const isExplainer = input.kind === "explainer" || input.kind === "hypothetical" || input.kind === "claim";
  let questions: string[] = [];
  let canonical: string[] = [];
  let correctedName = "";
  let correctedWhen = "";
  try {
    const msg = await anthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1300,
      temperature: 0,
      messages: [{
        role: "user",
        content: `You are a documentary researcher preparing a script about this ${isExplainer ? "subject" : "real case"}:
${isExplainer ? "SUBJECT / SCOPE" : "CASE"}: ${caseName}${input.summary ? `\nCONTEXT: ${input.summary}` : ""}${input.sourcePayoff ? `\n\nPAYOFF TO REPRODUCE: this video is modeled on one that worked because of this: "${input.sourcePayoff}". PRIORITIZE questions whose answers would let the script deliver that same kind of payoff on this case. Still cover the basics, but lead with the facts that serve this payoff.` : ""}

${isExplainer ? `FIRST, restate the subject precisely. Give the standard scientific/technical name for what this video is actually about in "caseName", and leave "when" as an EMPTY STRING (a phenomenon has no date range). Do not invent a project or program name.

SECOND, lock the canonical TERMINOLOGY: the correct technical terms, units, and named effects/laws/models for this subject. Every question must use them exactly — a wrong term returns the wrong literature.` : `FIRST, correct the case identity. From your own knowledge, give the CANONICAL name of the operation/case and its correct date range. If the CASE label above names the wrong operation, uses a nickname, or has a wrong or drifting date, fix it — this becomes the name and date the finished script uses, so it must be right. IMPORTANT no-op rule: if the label already looks correct, OR you are not genuinely confident of the canonical name, return an EMPTY STRING for caseName and we keep the original untouched. A confident wrong rename is worse than leaving the original label, because it looks authoritative. Only return a corrected name when you are sure.

SECOND, lock the canonical entities: the CORRECT official strings for the key people, organizations, and the central program or document. This is the ground truth every question must use.`}

THIRD, write the 8 to 10 most important research questions a strong documentary must answer, each seeking ONE citable fact. Use ONLY the canonical strings above — never a variant, nickname, or the possibly-wrong label. Phrase them OPEN, not closed: an open question returns what exists, a closed one that presupposes a specific artifact ("the exact verbatim threat", "each defendant's sentence separately") forces a refusal or a confabulation when that artifact was never separately reported. Cover:
${isExplainer ? `- the CORE MECHANISM: how the thing actually works, step by step, in causal order. This is the spine of the whole video and deserves 2 or 3 separate questions on its own — the specific process, what drives it, and what would change it
- REAL NUMBERS WITH UNITS: the measured quantities that make the topic concrete (masses, speeds, temperatures, timescales, energies, probabilities). Ask for the figure AND its unit AND what was measured
- SCALE COMPARISONS: a documented comparison that makes a number feel real (how it compares to something a viewer knows). Ask for published comparisons, never invent one
- THE STACKED-COMPARISON HOOK FACT (highest value for the opening): the single most striking figure measured against TWO OR THREE FAMILIAR THINGS people already have a scale for, so it can carry a "more than X, Y and Z combined" hook. This is the exact ingredient a Kurzgesagt-style cold open is built on ("kills more people than terrorism, wars, homicides and car accidents combined"). Ask specifically for the biggest number in the story set beside a few recognizable reference points that make it land as shocking — only if such a documented comparison genuinely exists
- WHAT WOULD ACTUALLY HAPPEN, in order: the documented sequence of consequences, earliest first, with timescales
- THE COUNTERINTUITIVE PART: the finding that most people get wrong, or that surprised researchers
- WHERE THE SCIENCE IS UNSETTLED: what is genuinely debated, modelled rather than observed, or still unknown. This must be marked as such, never smoothed into consensus
- WHAT IS RULED OUT: the common assumption the evidence actually contradicts` : `- the named programs, systems, documents, or operations at the center of the case
- the person's stated motive, attributed to them, and relevant biography (real background, prior career)`}
${isExplainer ? "" : `- how they obtained their access, position, or clearance, including any named front or cover
- the real names of the key settings or locations
- the case outcomes for the named defendants (ask broadly, not one presupposing question per person)
- THE SETTLED / RESOLVED FIGURE (high value — ask for this explicitly). The final, authoritative number the case actually resolved on, AS OPPOSED TO any earlier alleged or estimated figure: a court-ordered forfeiture, a judgment or verdict amount, restitution, a settlement, a final confirmed toll or count, or the sentence handed down. Ask for the exact settled figure, what it represents, and who set it, so the script leads with the resolved number and not a superseded allegation. (This generalizes across niches: a forfeiture in a fraud case, a verdict amount in a lawsuit, a final death toll in a disaster, a sentence in a criminal case.)
- the documented procedural history and how the story actually RESOLVED, with dates
- the DOCUMENTED AFTERMATH for the central figure (threats, retaliation, litigation, personal cost) — this is often the strongest material
- the KEY HUMAN RELATIONSHIP: the specific, named person the central figure grew closest to, trusted, befriended, or ultimately betrayed — the emotional core a documentary lives on. Ask for it by name where the record supports it
- DIRECT VERBATIM QUOTES / PRIMARY-SOURCE LINES (HIGHEST VALUE — dedicate 2 SEPARATE questions to this). The single strongest texture of a well-researched script is a real primary-source line quoted word for word, then analyzed. Actively hunt the quotable lines a viewer could not get anywhere else, each WITH the SPEAKER named and a SOURCE: (a) the SUBJECT'S OWN WORDS — a documented email, text, social post, or interview line they actually wrote or said (e.g. an incriminating email boast); (b) COURT / PLEA statements — what a defendant said in a plea allocution or on the stand; (c) INDICTMENT or complaint LANGUAGE — a striking phrase prosecutors actually used; (d) a NAMED OFFICIAL'S statement — the U.S. Attorney, an FBI agent, a judge, quoted from the press release or hearing. Phrase these to return the EXACT words plus who said them and where. Lead at indexed, searchable sources (DOJ press releases, court filings, news interviews) over a memoir's interior lines. A real quote honestly extends length and carries a cold open and a payoff that narration cannot.
- PHYSICAL DESCRIPTION AND NICKNAME: what the central figure looked like (build, height, distinctive features) and any documented nickname or moniker they went by. This makes the person real on screen in the first 30 seconds.
- THE ONE VIVID SCENE: the single most vividly documented episode of the story, with everything the sources record about it — the sequence of actions, the sensory detail, what was said. Ask for the fullest account of that one scene, because one scene told in full carries more than five summarized.`}
- what remains disputed, sealed, or unknown${input.sourceSubject ? `
- THE BRIDGE (highest value): this script remixes a video about "${input.sourceSubject}". Ask 1 question hunting for a DOCUMENTED, real connection between THIS case and that subject, a shared event or crossover. Only ask if such a link might genuinely exist; a fabricated bridge is worse than none, and a "no connection" answer will be dropped rather than shown.` : ""}

Each question seeks a single concrete, citable fact. Output ONLY this JSON, no prose:
{"caseName":"the canonical operation/case name","when":"YYYY or YYYY-YYYY","canonical":["key person full name","organization","named front or program",...],"questions":["...","..."]}`,
      }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    if (Array.isArray(parsed?.questions)) questions = parsed.questions.filter((q: any) => typeof q === "string" && q.trim()).slice(0, 10);
    if (Array.isArray(parsed?.canonical)) canonical = parsed.canonical.filter((c: any) => typeof c === "string" && c.trim()).slice(0, 12);
    if (typeof parsed?.caseName === "string" && parsed.caseName.trim()) correctedName = parsed.caseName.trim().slice(0, 200);
    if (typeof parsed?.when === "string" && parsed.when.trim()) correctedWhen = parsed.when.trim().slice(0, 40);
  } catch { /* no questions — nothing to deepen */ }
  // The corrected name is what the script must use. Prefer it for the Perplexity
  // anchor too, and pass it back to the caller to relabel the case everywhere.
  const canonicalCaseName = correctedName || caseName;
  // The library must key on something STABLE across runs. For a real case, the canonical
  // name is stable. For a claim/explainer, the resolver returns a fresh scope question
  // each run, so canonicalCaseName drifts and the library never accumulates — key on the
  // user's chosen remix TITLE instead, which is constant for the same video.
  const libraryAnchor = (input.topicAnchor && input.topicAnchor.trim()) ? input.topicAnchor.trim() : canonicalCaseName;
  if (correctedName && !canonical.some((c) => c.toLowerCase() === correctedName.toLowerCase())) canonical.unshift(correctedName);
  const correction = { caseName: correctedName || undefined, when: correctedWhen || undefined };

  // Fact-set cache. Keyed on the CANONICAL name (so a picker pick and a "Name it" pin
  // for the same case collide), and only consulted once the name is canonicalized. A
  // rich cached set is reused verbatim — this is what makes the same case deterministic
  // across runs and stops the pin path from re-deriving a worse set. A thin cache does
  // NOT short-circuit; we still deepen and keep whichever ends up richer.
  //
  // The key carries RESEARCH_BRIEF_VERSION so that changing what we ask for (adding
  // quotes, a nickname, a vivid scene) INVALIDATES old cached sets. Without this, every
  // brief improvement silently fails on already-researched cases — exactly the cases
  // you test on. Bump the version whenever the deepen question brief changes materially.
  // MOVE #6(1) — STABLE CACHE KEY. The cache used to key on caseKey(canonicalCaseName), but
  // canonicalCaseName DRIFTS run to run (Claude's canonical label varies), so the cache missed
  // and each run re-researched a non-deterministic set. Key on the STABLE topicAnchor (the
  // remix title, constant for the same video) when we have it, exactly like the per-user
  // library does, so cache hits are as reliable as library hits and the known-best set is
  // re-surfaced instead of re-rolled.
  const stableAnchor = (input.topicAnchor && input.topicAnchor.trim()) ? input.topicAnchor.trim() : canonicalCaseName;
  const baseKey = caseKey(stableAnchor);
  const key = `${baseKey}::v${RESEARCH_BRIEF_VERSION}`;
  const cached = await getCachedFactSet(key);
  if (cached && cached.facts.length >= CACHE_GOOD_ENOUGH) {
    // A cache HIT must still union across brief versions. Returning the current
    // version's row verbatim was why the union "didn't land": once v2 had cached, every
    // later run short-circuited here and never reached the merge at the bottom, so the
    // v1 facts (54 indicted, 28 months, full patch) stayed invisible.
    const priorHit = await getBestAcrossVersions(baseKey);
    const mergedHit = capFacts(unionFacts([...cached.facts, ...(priorHit?.facts || [])]), factCap);
    const whenHit = deriveWhenFromFacts(mergedHit) || cached.when || correction.when;
    if (mergedHit.length > cached.facts.length) {
      await putCachedFactSet(key, { caseName: cached.caseName || correction.caseName, when: whenHit, facts: mergedHit, conflicts: cached.conflicts });
    }
    // Cache hits feed the library too, and return it — otherwise a cached run would
    // hand back a smaller set than the user has already accumulated for this topic.
    let returnHit: ResearchFact[] = mergedHit;
    let featureHit: ResearchFact[] = [];
    if (input.userId) {
      let lib = await addToLibrary(input.userId, libraryAnchor, mergedHit, { topicLabel: canonicalCaseName });
      // LONG-FORM FEATURES, once per topic: a cached case (researched before feature mining existed)
      // gets its features read on the next load, then they live in the library like any fact.
      if (!isExplainer && !lib.facts.some((f) => (f as any).feature)) {
        const cur = activeFacts(lib);
        const mined = await mineFeatureArticles(canonicalCaseName, cur.map((f) => f.source || ""), cur.map((f) => f.fact), Date.now() + 150_000).catch(() => []);
        if (mined.length) lib = await addToLibrary(input.userId, libraryAnchor, mined, { topicLabel: canonicalCaseName });
      }
      const all = activeFacts(lib);
      if (all.length) returnHit = all.map((f) => ({ fact: f.fact, source: f.source, ...((f as any).feature ? { feature: true } : {}) }));
      featureHit = returnHit.filter((f) => f.feature);
    }
    // MOVE #2: supersede stale/weaker facts before returning — including any the LIBRARY
    // accumulated on an earlier run (the $10M the safety-gate TTL couldn't shed), so the
    // angle page and script never see a superseded number.
    const reconciledHitRaw = capFacts((await reconcileFacts(returnHit)).facts, factCap);
    // Sanitize on the way out. The union across brief versions (getBestAcrossVersions) can drag in
    // junk cached under an older version, so a cache HIT must be cleaned here or the phone number /
    // CPI-table dump resurfaces forever even after the extraction gate was fixed.
    const hitStrip = isExplainer ? stripPhenomenonJunk(reconciledHitRaw) : { kept: reconciledHitRaw, dropped: 0 };
    // File/landing-page metadata is junk for all topics — strip on the way out too, so a case that
    // cached it before this guard existed (e.g. the O.J. Vault run) heals on its next run.
    const reconciledHit = hitStrip.kept.filter((f) => !FILE_META_JUNK_RE.test(f.fact));
    // CACHE HIT — the context loop is SKIPPED entirely. If a phenomenon brief returns a small set,
    // this line proves it came from a stale/shallow cached row (bump RESEARCH_BRIEF_VERSION to bust).
    console.log(`[deepen] CACHE-HIT isExplainer=${isExplainer ? "T" : "F"} kind=${input.kind ?? "undef"} budget=${budget} cached=${cached.facts.length} junkStripped=${hitStrip.dropped} final=${reconciledHit.length} finalContext=${reconciledHit.filter((f) => f.context).length} — context loop SKIPPED`);
    // A cache HIT skips the whole context loop AND its per-round review, so the final-set
    // RESOLUTION MUST run here too. CRITICAL: it runs on `returnHit` — the ACTIVE LIBRARY set the
    // UI actually displays — NOT on reconciledHit (a reconciled/capped/stripped derivative). The UI
    // renders activeFacts(library) after loadLibrary(), so a fact only disappears from the screen (and
    // from future scripts) when it is DISMISSED from that active set. Judging a different, smaller set
    // meant the resolver's indices and content did not line up with what the user saw — it evaluated
    // 24 facts while 29 were on screen, found one conflict, and left the rest. Judge exactly what is
    // shown, dismiss the losers, and both the screen and the response drop them.
    const hitResolution = await resolveFinalConflicts(canonicalCaseName, returnHit, input.summary);
    // File/landing-page metadata junk must be DISMISSED from the library (not just filtered from the
    // response), or loadLibrary re-shows it — same reason the resolver losers are dismissed.
    const hitAnchor = isExplainer ? null : caseAnchorToken(canonicalCaseName);
    const hitJunk = [...returnHit.filter((f) => FILE_META_JUNK_RE.test(f.fact)), ...offTopicSourceFacts(returnHit, hitAnchor)];
    const hitLosers = [...hitResolution.drop.map((n) => returnHit[n - 1]).filter(Boolean), ...hitJunk];
    await dismissResolvedLosers(input.userId, libraryAnchor, hitLosers);
    const hitLoserIds = new Set(hitLosers.map((f) => factId(f.fact)));
    let resolvedHit = hitLoserIds.size ? reconciledHit.filter((f) => !hitLoserIds.has(factId(f.fact))) : reconciledHit;
    const hitQ = await verifyFactQuotes(resolvedHit, Date.now() + 20_000).catch(() => ({ replace: [] as any[], checked: 0 }));
    if (hitQ.replace.length) {
      await dismissResolvedLosers(input.userId, libraryAnchor, hitQ.replace.filter((r: any) => !r.to).map((r: any) => r.from));

      const fixedhit = hitQ.replace.map((r: any) => r.to).filter(Boolean) as ResearchFact[];
      if (fixedhit.length && input.userId) await replaceInLibrary(input.userId, libraryAnchor, hitQ.replace.filter((r: any) => r.to).map((r: any) => ({ from: r.from.fact, to: r.to }))).catch(() => null);
      const swaphit = new Map(hitQ.replace.map((r: any) => [r.from.fact, r.to]));
      resolvedHit = resolvedHit.flatMap((f) => (swaphit.has(f.fact) ? (swaphit.get(f.fact) ? [swaphit.get(f.fact) as ResearchFact] : []) : [f]));
      console.log(`[deepen] QUOTE-CHECK checked=${hitQ.checked} corrected=${fixedhit.length} dropped=${hitQ.replace.length - fixedhit.length} :: ${hitQ.replace.map((r: any) => r.to ? r.to.fact.slice(0, 140) : "DROPPED " + r.from.fact.slice(0, 80)).join(" || ")}`);
    }
    console.log(`[deepen] CACHE-HIT RESOLVE judged=${returnHit.length} resolutions=${hitResolution.decisions.length} dropped=${hitLosers.length}${hitResolution.decisions.length ? " :: " + hitResolution.decisions.map((d) => `[${d.dropped}] ${d.why}`).join(" || ") : ""}`);
    // Feature facts are exempt from the cap: append any the capped set trimmed away (minus losers).
    { const have = new Set(resolvedHit.map((f) => factId(f.fact))); const lose = new Set(hitLosers.map((f) => factId(f.fact)));
      resolvedHit = [...resolvedHit, ...featureHit.filter((f) => !have.has(factId(f.fact)) && !lose.has(factId(f.fact)))]; }
    return withHonesty({ facts: resolvedHit, conflicts: [], verify: [], status: "ok", caseName: cached.caseName || correction.caseName, when: whenHit });
  }

  if (!questions.length) return { facts: [], conflicts: [], status: "no-facts", ...correction };

  // 2) Perplexity answers, paired back to each question.
  let pairs = await fetchPerplexityAnswers(pkey, canonicalCaseName, input.summary, canonical, questions);

  // 3) Retry-on-refusal. Any question that produced NO surviving answer gets
  // reformulated broader and asked once more, so a case with a memoir and court
  // records behind it does not bottom out at two facts because the questions were
  // phrased too narrowly the first time.
  const answered = new Set(pairs.map((p) => p.question));
  const unanswered = questions.filter((q) => !answered.has(q));
  if (unanswered.length) {
    const reworded = await reformulateQuestions(canonicalCaseName, unanswered);
    if (reworded.length) {
      const more = await fetchPerplexityAnswers(pkey, canonicalCaseName, input.summary, canonical, reworded);
      pairs = pairs.concat(more);
    }
  }
  pairs = pairs.slice(0, 16);
  if (!pairs.length) return { facts: [], conflicts: [], status: "no-facts", ...correction };

  // 4) Claude reads its own questions against the answers: drops non-responsive
  // answers, entity drift, and CROSS-CASE CONTAMINATION (an aftermath that belongs to a
  // different infiltrator). The watchlist is the proper nouns from the user's other
  // recent cases, so the review can name exactly what must not bleed in.
  const watchlist = input.userId ? await getContaminationWatchlist(input.userId, canonicalCaseName) : [];
  const { keep, conflicts, verify: verify0 } = await reviewDeepenedFacts(canonicalCaseName, pairs, input.summary, watchlist);
  // Accumulate the "double-check this" flags from every review round; filtered to surviving facts at return.
  const verifyFlags: DeepenResult["conflicts"] = [...(verify0 || [])];

  // 5) Source tiering. Drop facts carried only by a low-tier (self-published /
  // merch-SEO) source WHEN better-sourced facts remain, so a blogspot page never
  // stands behind a claim while a wire story is available. If low-tier is all we
  // have, keep it rather than return nothing — the fact card already warns to verify.
  const strong = keep.filter((f) => sourceTier(f.source) !== "low");
  let freshFacts = capFacts(strong.length >= 2 ? strong : keep, factCap);

  // MOVE #3 — GENERIC-MECHANISM DIG. When the "how" is present but number-free, dig
  // specifically for the quantities FIRST, with targeted questions (not broad reformulations
  // that return more of the same colour). This is what turns "thousands of bots" into
  // "1,040 bots generating 661,440 streams a day" without waiting for the user to paste it.
  if (mechanismIsGeneric(freshFacts) && Date.now() - t0 < 60_000) {
    const mechQs = [
      `Exactly how did ${canonicalCaseName} work, in concrete numbers: how many bots, accounts, units, servers, or transactions were involved, and at what rate — per day or in total?`,
      `What are the precise quantities behind the mechanism of ${canonicalCaseName}: the specific counts, totals, and rates that show how the scheme actually operated and scaled?`,
    ];
    const mechPairs = await fetchPerplexityAnswers(pkey, canonicalCaseName, input.summary, canonical, mechQs);
    if (mechPairs.length) {
      const reviewed = await reviewDeepenedFacts(canonicalCaseName, mechPairs, input.summary, watchlist);
      verifyFlags.push(...(reviewed.verify || []));
      freshFacts = capFacts(unionFacts([...freshFacts, ...reviewed.keep]), factCap);
    }
  }

  // DEPTH LOOP — run MORE retrieval when the set is thin OR conflicting, not only when the
  // video is long. The original trigger (facts-vs-word-count) let a case with "enough" vague
  // facts for the runtime never dig; the real trigger is research quality, period. A floor of
  // MIN_FACTS means even a short video digs when genuinely thin, and a live conflict earns one
  // reconciling round. The gap between evidence and demand is where fabrication is born.
  //
  // Retrieval gravity is the caveat: on a topic that is 95% the same suspect material
  // (Tylenol), "fetch more" returns more of the same. So this is CAPPED at two extra rounds,
  // time-guarded, and STOPS EARLY when a round adds nothing genuinely new (fact overlap).
  // MOVE #5(b): the depth loop now digs toward the per-minute BUDGET (a 20-min ask wants ~50
  // facts, a 5-min ask ~12), not a flat 12. Same caps so retrieval gravity can't run away.
  const MIN_FACTS = 6;
  const target = Math.min(MAX_FACTS, Math.max(budget, MIN_FACTS));
  // TARGET-DRIVEN DEPTH. The length the user asked for drives how hard/long research digs: a
  // long ask (~16+ min, budget >= 40 facts) needs far more genuinely-new context to be filled by
  // ELABORATION rather than padding, so it earns more rounds and a longer time window. A short ask
  // keeps the old tight caps. This is what closes the gap the honest-length ceiling used to warn
  // about — the answer is to research harder, not to shorten the video. (Route maxDuration=300.)
  // TIME BUDGET (route maxDuration=300s): the deep path must finish end-to-end under ~270s or
  // Vercel 504s and silently falls back to shallow facts. The high-value step is the primary-doc
  // MINING, so cap the Perplexity gap+context rounds to finish by ~120s, leaving the miner a bounded
  // window before the final reconcile — measured: gap+context had been eating 186s, pushing totals
  // to 4.6-5.2min. Tightened here so gap+context+mine+reconcile stays ~250s.
  const deep = target >= 40;
  const gapRounds = deep ? 3 : 2;
  const gapDeadline = deep ? 70_000 : 55_000;
  const ctxRounds = deep ? 5 : 4;
  const ctxDeadline = deep ? 120_000 : 70_000;
  let askPool = [...questions];
  for (let round = 0; (freshFacts.length < target || (conflicts.length > 0 && round === 0)) && round < gapRounds && Date.now() - t0 < gapDeadline; round++) {
    const gaps = (await reformulateQuestions(canonicalCaseName, askPool.slice(0, 8))).filter((q) => !askPool.includes(q));
    if (!gaps.length) break;
    askPool = askPool.concat(gaps);
    const morePairs = await fetchPerplexityAnswers(pkey, canonicalCaseName, input.summary, canonical, gaps);
    if (!morePairs.length) break;
    const reviewed = await reviewDeepenedFacts(canonicalCaseName, morePairs, input.summary, watchlist);
      verifyFlags.push(...(reviewed.verify || []));
    const before = freshFacts.length;
    freshFacts = capFacts(unionFacts([...freshFacts, ...reviewed.keep]), factCap);
    if (freshFacts.length <= before) break; // nothing new — retrieval gravity; stop rather than loop
  }

  // MOVE #8(2) — AGGRESSIVE CONTEXTUAL RESEARCH (heavy upgrade of #5c). Honest long-form reaches
  // 20+ minutes through storytelling craft plus REAL SOURCED CONTEXT, not more case facts — so
  // once the core case is tapped, actively gather substantial background across MANY categories:
  // how the system/industry works, the history and precedent (prior similar cases), the broader
  // moment or trend it belongs to, the stakes and who it affects, and how the response/regulation
  // works. Each is sourced and adjudicated like any other fact, marked context:true — never
  // padding, never invention. This is what lets the honest-length math clear a 20-min target.
  // INSTRUMENTATION for the two-tier fill: which stage the phenomenon pool breaks at. Summarized in
  // one [deepen] line at the end.
  let poolBCount = 0, ctxGathered = 0, ctxSurvived = 0, ctxRoundsRun = 0;
  let ctxStop = freshFacts.length >= target ? "target-already-met" : (Date.now() - t0 >= ctxDeadline ? "deadline-before-context" : "entered");
  if (freshFacts.length < target && Date.now() - t0 < ctxDeadline) {
    // MOVE #9(3) — CONTEXT DEPTH. The earlier set was too shallow: an 11-min build still padded by
    // repeating five numbers. Beating ChatGPT means bringing the SOURCED version of the breadth it
    // fills 20 minutes with, so ask across MANY distinct, specific angles that each return NEW
    // material, not restatements of the case facts.
    // PRIMARY-SOURCE COMPLETENESS (highest value, asked FIRST). When a charging document / court
    // filing / official report exists, it usually contains ~2x the facts a headline carries — the
    // full dated timeline, every dollar movement, every named entity and alias, every warning and
    // the response to it, and how it unraveled. The head-to-head Skripr lost was lost HERE: it
    // stopped at ~14 top-line facts while the DOJ indictment held the $1.3M debit-card trail, the
    // AI-artist alias names, the month-by-month streaming milestones, the platform warnings and
    // denials, and the payment halt that ended it. Mine the primary source to completeness so the
    // script is MORE detailed than a well-read model's memory, not less.
    // TWO-TIER CONTEXT POOL. Case topics mine the primary source (indictment/court filing) — that is
    // where their length lives. PHENOMENON topics (isExplainer) have no charging document and only a
    // handful of hard stats, so the case-shaped questions returned almost nothing and the set stopped
    // at ~7. They get a purpose-built Pool B instead — history, mechanism, economics, comparisons,
    // cultural/psychological context — each seeking NEW sourced facts, so the length-scaled fill loop
    // below can actually reach ~2.5 facts/min (~40-50 for a 20-min brief) on sourced context.
    const primaryQs = isExplainer ? [] : [
      `From the PRIMARY SOURCE on ${canonicalCaseName} (the indictment, complaint, charging document, plea agreement, or official report), extract the FULL CHRONOLOGICAL TIMELINE: every dated milestone, month by month or year by year, each with the specific figures attached (streams, dollars, accounts, dates). List them in order, sourced.`,
      `Trace EVERY MOVEMENT OF MONEY documented in the ${canonicalCaseName} primary source: each transfer, the amounts and dates, the accounts or instruments used (bank accounts, debit cards, shell entities, payment processors), how funds were funneled or laundered, and the per-day or per-month rate where stated.`,
      `List EVERY NAMED ENTITY, ALIAS, PRODUCT, ACCOUNT, or CODE-NAME in the ${canonicalCaseName} primary source — the specific names of fronts, shell companies, fake artists or products, aliases, platforms, and counterparties, exactly as written, with what each was used for.`,
      `What WARNINGS, red flags, audits, or challenges did ${canonicalCaseName} receive from platforms, distributors, regulators, or partners BEFORE it ended — the dates, who raised them, and exactly how the subject responded or denied each one? This "they were warned and lied to keep it running" thread is documented; retrieve it in detail.`,
      `Exactly HOW DID ${canonicalCaseName} UNRAVEL and get caught — the specific event, audit, halt, or investigation that ended it, who acted, on what date, and the concrete step-by-step of the detection and takedown?`,
    ];
    // Pool B for a PHENOMENON / explainer subject: every question seeks NEW, cited context material.
    // These carry real citations exactly like hard facts (reviewed + adjudicated below) — context is
    // not a hallucination backdoor.
    const phenomenonContextQs = [
      `HISTORY & BACKGROUND of ${canonicalCaseName}: how it developed over time, the key dated shifts and turning points, each with specific figures and a source. Give the timeline of how it got to where it is now.`,
      `THE MECHANISM of ${canonicalCaseName}: explain step by step, in causal order, HOW it actually works and what drives it — the specific process and the factors behind it, sourced.`,
      `ECONOMIC / INDUSTRY CONTEXT of ${canonicalCaseName}: the market structure, costs, margins, wages, prices, or spending involved — the concrete sourced figures that show the economics, and how they have changed with dates.`,
      `DOCUMENTED COMPARISONS for ${canonicalCaseName}: published comparisons that make the scale real — then vs now, vs other categories, vs other countries, vs inflation or wages — each with the numbers and a source. Never invent a comparison; retrieve reported ones.`,
      `CULTURAL & PSYCHOLOGICAL CONTEXT of ${canonicalCaseName}: what surveys, studies, or documented sentiment show about how people perceive it and behave around it, with named sources and figures.`,
      `SCALE & STAKES of ${canonicalCaseName}: who is affected and by how much — the population, the dollar totals, the rates — the sourced figures that show how big and who it hits hardest.`,
      `WHAT EXPERTS, economists, analysts, or officials have SAID about ${canonicalCaseName} — named commentary and sourced analysis of why it is happening and what it means, not generalities.`,
      `The COUNTERINTUITIVE or DISPUTED part of ${canonicalCaseName}: the finding most people get wrong, or what is genuinely debated among experts, with sources; mark clearly what is contested vs settled.`,
      `BROADER TREND ${canonicalCaseName} belongs to — the larger economic, technological, or social shift it is part of, and why it accelerated when it did. Sourced specifics.`,
      `REGULATION, POLICY, or INDUSTRY RESPONSE relevant to ${canonicalCaseName}: what has been proposed or done about it, by whom, with dates and figures, sourced.`,
    ];
    const contextQs = isExplainer ? phenomenonContextQs : [
      ...primaryQs,
      `Explain in concrete, sourced detail HOW THE SYSTEM WORKS that ${canonicalCaseName} exploited or operated within — the mechanics of the industry, technology, market, payment or royalty flow, step by step.`,
      `Name the closest PRIOR OR SIMILAR documented cases to ${canonicalCaseName} SPECIFICALLY, by name, with their own dates, figures, and outcomes, and how each compares in scale and method.`,
      `How is this kind of activity DETECTED and PREVENTED in practice — the specific technology, methods, or audits used to catch it — and what did ${canonicalCaseName} expose about the gaps?`,
      `Who were the VICTIMS or PARTIES HARMED by ${canonicalCaseName} — named companies, artists, or people — and what specifically did each lose, with figures?`,
      `What was the full LAW-ENFORCEMENT and REGULATORY response to ${canonicalCaseName}: the agencies involved, the charges, the legal theory, statements from officials, and any policy or industry change that followed?`,
      `What BROADER TREND, technology shift, or economic moment does ${canonicalCaseName} belong to (for example the streaming economy, AI, or platform incentives), and why did it become possible when it did? Sourced specifics.`,
      `Where did the MONEY actually go in ${canonicalCaseName} — the financial forensics, the accounts, the flow, what was recovered or forfeited and what was not?`,
      `What have EXPERTS, journalists, or officials SAID about why ${canonicalCaseName} matters or what it reveals — sourced analysis and named commentary, not generalities?`,
    ];
    poolBCount = contextQs.length;
    let cAsk = [...contextQs];
    // Up to 4 rounds (time-guarded): the first asks the full category set at once for breadth,
    // later rounds broaden whatever is still thin. Stops early when a round adds nothing new.
    let round = 0;
    for (; freshFacts.length < target && round < ctxRounds && Date.now() - t0 < ctxDeadline; round++) {
      const qs = round === 0 ? contextQs : await reformulateQuestions(canonicalCaseName, cAsk.slice(0, 8));
      const fresh = qs.filter((q) => round === 0 || !cAsk.includes(q));
      if (!fresh.length) { ctxStop = "no-new-questions"; break; }
      cAsk = cAsk.concat(fresh);
      const cPairs = await fetchPerplexityAnswers(pkey, canonicalCaseName, input.summary, canonical, fresh);
      ctxGathered += cPairs.length;
      if (!cPairs.length) { ctxStop = "perplexity-returned-nothing"; break; }
      const reviewed = await reviewDeepenedFacts(canonicalCaseName, cPairs, input.summary, watchlist);
      verifyFlags.push(...(reviewed.verify || []));
      ctxSurvived += reviewed.keep.length;
      const ctx = reviewed.keep.map((f) => ({ ...f, context: true as const }));
      const before = freshFacts.length;
      freshFacts = capFacts(unionFacts([...freshFacts, ...ctx]), factCap);
      if (freshFacts.length <= before) { ctxStop = "no-new-facts-after-review"; break; } // context well is dry too
    }
    ctxRoundsRun = round;
    if (ctxStop === "entered") ctxStop = freshFacts.length >= target ? "target-reached" : (round >= ctxRounds ? "rounds-max" : "deadline");
  }

  // PRIMARY-SOURCE DOCUMENT MINING (the depth fix). Perplexity gave the summary layer; now read the
  // actual charging document, where the vivid granularity lives. DECOUPLED FROM `deep`: reading the
  // primary source is THE depth lever and must never depend on how long the video will be. The old
  // `deep` gate (target >= 40) silently disabled this in the research-before-angle flow, where
  // targetMinutes is undefined at grounding so target defaults to 25 (< 40) and mining never ran —
  // that is why zero [primary-doc] lines printed. It now runs whenever the case has a fetchable
  // primary source (or one is resolvable), on its own generous deadline independent of the shallow
  // context-round budget, under the 300s route cap. minePrimarySourceDocs itself no-ops gracefully
  // when no PRIMARY_SOURCE_RE URL exists (a niche whose primary source is a book, etc.).
  const _pdElapsed = Date.now() - t0;
  const _pdDeadline = t0 + 200_000; // own budget, not the deep/shallow ctxDeadline
  const _pdEligible = _pdElapsed < 200_000; // leaves ~100s under the 300s route cap for reconcile + response
  console.log(`[primary-doc] gate: deep=${deep} target=${target} targetMinutes=${input.targetMinutes ?? "undefined"} elapsedMs=${_pdElapsed} -> ${_pdEligible ? "MINING" : "SKIPPED (out of time budget)"}`);
  if (_pdEligible) {
    const citedUrls = freshFacts.map((f) => f.source).filter((s): s is string => !!s);
    const docFacts = await minePrimarySourceDocs(canonicalCaseName, citedUrls, watchlist, _pdDeadline, pkey, input.summary, isExplainer);
    // Existing facts lead the union so a flood of newly-mined doc facts can't push an established
    // high-value figure (e.g. the $1.3M forfeiture) out when capFacts trims to the cap.
    if (docFacts.length) freshFacts = capFacts(unionFacts([...freshFacts, ...docFacts]), factCap);
  }

  // Union with the case's best prior fact set (any brief version) rather than
  // overwriting it. A version bump re-fetches to add new asks (quotes, a scene), but the
  // earlier run's hard facts — 54 indicted, 53 convicted, 28 months, full patch — must
  // NOT be lost. Fresh facts lead (they carry the new material); prior uniques fill in.
  const prior = await getBestAcrossVersions(baseKey);
  // Sanitize the cross-version union BEFORE caching it: prior versions may hold junk (phone number,
  // CPI-table dump) cached before the extraction gate existed, and line 1662 would otherwise persist
  // it right back under the new version. For explainer topics, strip it here so the cache heals.
  const _unioned = capFacts(unionFacts([...freshFacts, ...(prior?.facts || [])]), factCap);
  const _freshStrip = isExplainer ? stripPhenomenonJunk(_unioned) : { kept: _unioned, dropped: 0 };
  const facts = _freshStrip.kept;
  if (_freshStrip.dropped) console.log(`[deepen] junk-stripped ${_freshStrip.dropped} off-subject/admin line(s) from union before caching`);

  // Prefer a date range the SOURCED FACTS state explicitly over the resolver's guess,
  // so a confidently-wrong 1999-2001 gives way to the 1998-2000 the record actually says.
  const factWhen = deriveWhenFromFacts(facts);
  const finalWhen = factWhen || correction.when;

  // Persist: cache this set if it beats the stored one (keeps the case's best), and
  // record its entities so later generations of OTHER cases can diff against them.
  // Both are best-effort and no-op when their tables are absent.
  if (facts.length) {
    await putCachedFactSet(key, { caseName: correction.caseName, when: finalWhen, facts, conflicts });
    if (input.userId) await recordCaseEntities(input.userId, canonicalCaseName, facts.map((f) => f.fact).join(" "));
  }

  // FACT LIBRARY. This run's findings are added to the user's accumulating library for
  // the topic, and what we RETURN is the library — not just this retrieval. That is what
  // stops the fact set shrinking between runs: a thin retrieval can only ever add to what
  // is already known, never replace it.
  let returnFacts: ResearchFact[] = facts;
  // LONG-FORM FEATURES (fresh research): read the in-depth articles among the cited sources.
  let featureFresh: ResearchFact[] = [];
  if (!isExplainer && Date.now() - t0 < 200_000) {
    featureFresh = await mineFeatureArticles(canonicalCaseName, facts.map((f) => f.source || ""), facts.map((f) => f.fact), t0 + 265_000).catch(() => []);
  }
  if (input.userId && facts.length) {
    if (featureFresh.length) await addToLibrary(input.userId, libraryAnchor, featureFresh, { topicLabel: canonicalCaseName });
    const lib = await addToLibrary(input.userId, libraryAnchor, facts, { topicLabel: canonicalCaseName });
    const all = activeFacts(lib);
    if (all.length) returnFacts = all.map((f) => ({ fact: f.fact, source: f.source, context: f.context }));
  }
  // MOVE #2: reconcile before returning, so a superseded number (this run's or one the
  // library accumulated earlier) is dropped and the angle page states one authoritative
  // figure — the "$8M beats $10M, age-52 drops" adjudication, with zero human intervention.
  const reconciledRaw = capFacts((await reconcileFacts(returnFacts)).facts, factCap);
  // Final return guard: the user's LIBRARY (returnFacts) can carry junk accumulated on prior runs,
  // so strip once more on the way out — same clean set the cache-hit path returns.
  const freshOutStrip = isExplainer ? stripPhenomenonJunk(reconciledRaw) : { kept: reconciledRaw, dropped: 0 };
  const reconciled = freshOutStrip.kept.filter((f) => !FILE_META_JUNK_RE.test(f.fact));
  // ONE-LINE DIAGNOSIS of the two-tier fill: classification, the fill target, how many Pool-B
  // questions ran, context facts gathered vs survived the reviewer, rounds run, why it stopped, and
  // the final count. This single line says exactly where the phenomenon pool breaks.
  console.log(`[deepen] isExplainer=${isExplainer ? "T" : "F"} kind=${input.kind ?? "undef"} target=${target} budget=${budget} poolB-questions=${poolBCount} context-gathered=${ctxGathered} context-survived=${ctxSurvived} ctx-rounds=${ctxRoundsRun} stopped=${ctxStop} final=${reconciled.length} finalContext=${reconciled.filter((f) => f.context).length}`);
  // FINAL-SET RESOLUTION over the assembled union (rounds + library + cache), which no per-round
  // review ever saw as a whole — this DECIDES the $500k-vs-$1M ransom split and the July-31-vs-Aug-31
  // date split rather than asking the creator to. It drops the losing side so the script sees one
  // self-consistent set. Best-effort; time-boxed by the call. We surface NO conflict/verify panels:
  // the promise is a script you trust without second-guessing, so resolution happens silently and the
  // decisions are logged, not shown.
  // Judge the ACTIVE LIBRARY set (returnFacts) — the exact facts the UI shows via loadLibrary() —
  // not the reconciled/stripped derivative, so the resolver's indices line up with what is on screen
  // and every loser it dismisses actually leaves the display and future scripts. (Same lesson as the
  // cache-hit path: judging a smaller derived set left the on-screen contradictions untouched.)
  const judgeSet = returnFacts.length ? returnFacts : reconciled;
  const resolution = await resolveFinalConflicts(canonicalCaseName, judgeSet, input.summary);
  // File/landing-page metadata junk must be dismissed from the library too (loadLibrary re-shows it
  // otherwise), the same way the resolver's losers are dismissed.
  const junkLosers = [...judgeSet.filter((f) => FILE_META_JUNK_RE.test(f.fact)), ...offTopicSourceFacts(judgeSet, isExplainer ? null : caseAnchorToken(canonicalCaseName))];
  const resolvedLosers = [...resolution.drop.map((n) => judgeSet[n - 1]).filter(Boolean), ...junkLosers];
  await dismissResolvedLosers(input.userId, libraryAnchor, resolvedLosers);
  const loserIds = new Set(resolvedLosers.map((f) => factId(f.fact)));
  let resolvedFacts = loserIds.size ? reconciled.filter((f) => !loserIds.has(factId(f.fact))) : reconciled;
  const freshQ = await verifyFactQuotes(resolvedFacts, Date.now() + 20_000).catch(() => ({ replace: [] as any[], checked: 0 }));
  if (freshQ.replace.length) {
    await dismissResolvedLosers(input.userId, libraryAnchor, freshQ.replace.filter((r: any) => !r.to).map((r: any) => r.from));

    const fixedfresh = freshQ.replace.map((r: any) => r.to).filter(Boolean) as ResearchFact[];
    if (fixedfresh.length && input.userId) await replaceInLibrary(input.userId, libraryAnchor, freshQ.replace.filter((r: any) => r.to).map((r: any) => ({ from: r.from.fact, to: r.to }))).catch(() => null);
    const swapfresh = new Map(freshQ.replace.map((r: any) => [r.from.fact, r.to]));
    resolvedFacts = resolvedFacts.flatMap((f) => (swapfresh.has(f.fact) ? (swapfresh.get(f.fact) ? [swapfresh.get(f.fact) as ResearchFact] : []) : [f]));
    console.log(`[deepen] QUOTE-CHECK checked=${freshQ.checked} corrected=${fixedfresh.length} dropped=${freshQ.replace.length - fixedfresh.length} :: ${freshQ.replace.map((r: any) => r.to ? r.to.fact.slice(0, 140) : "DROPPED " + r.from.fact.slice(0, 80)).join(" || ")}`);
  }
  console.log(`[deepen] RESOLVE judged=${judgeSet.length} resolutions=${resolution.decisions.length} dropped=${resolvedLosers.length}${resolution.decisions.length ? " :: " + resolution.decisions.map((d) => `[${d.dropped}] ${d.why}`).join(" || ") : ""}`);
  { const have = new Set(resolvedFacts.map((f) => factId(f.fact))); const lose = new Set(resolvedLosers.map((f) => factId(f.fact)));
    resolvedFacts = [...resolvedFacts, ...featureFresh.filter((f) => !have.has(factId(f.fact)) && !lose.has(factId(f.fact)))]; }
  return withHonesty({ facts: resolvedFacts, conflicts: [], verify: [], status: "ok", caseName: correction.caseName, when: finalWhen });
}

// CENTRAL-SCENE RESEARCH (concept mode). Once the planner names the video's central moment, the
// writer must render that moment as a SCENE, and with no scene detail in the research it invents one
// (seen live, three runs, three different stagings: "laid down", "slid across the table"; CBS's real
// account is that he was confronted as he left his trailer after a week of surveillance, identity
// confirmed by a fingerprint ruse). One targeted research call pulls the documented specifics of that
// moment: where, how it came about, who was there, what was said, what happened next. Each answer is
// relevance-gated to the case and quote-checked against its page before it can be used.
export async function researchCentralScene(caseName: string, concept: string, existing: string[], momentYear?: number | null): Promise<ResearchFact[]> {
  const pkey = process.env.PERPLEXITY_API_KEY;
  if (!pkey || !caseName || !concept) return [];
  // Scope every question to the moment's YEAR (seen live: a 1975 governor concept pulled four facts about
  // the 2015 Florida arrest, the most-reported "how they found him" answer, and the script told the
  // wrong scene in its opening, then again later).
  const moment = `${concept.slice(0, 300)}${momentYear ? ` (this moment happened in ${momentYear}; answer ONLY about what happened in ${momentYear}, not about earlier or later events)` : ""}`;
  const qs = [
    `Exactly where, physically, did this moment happen, and what was the setting? Moment: ${moment}`,
    `What directly led up to this moment: how did investigators find the person and confirm who they were (surveillance, tips, fingerprints, ruses)? Moment: ${moment}`,
    `Who was present at this moment, and what did each person say or do, verbatim where a source quotes them? Moment: ${moment}`,
    `What happened in the minutes and hours immediately after this moment? Moment: ${moment}`,
    `What specific, documented physical details of this moment (objects, place, time of day, how the person reacted) do news reports or official sources describe? Moment: ${moment}`,
  ];
  try {
    const answers = await fetchPerplexityAnswers(pkey, caseName, undefined, [caseName], qs);
    const seen = new Set(existing.map((f) => factId(f)));
    const fresh: ResearchFact[] = answers
      // The questions are already scoped to this case and moment, so scene answers often say "him"
      // instead of repeating the name; requiring the name dropped 4 of 5 real, sourced scene facts.
      .filter((a) => a.fact && a.fact.length > 20)
      .filter((a) => !seen.has(factId(a.fact)))
      .filter((a) => !FILE_META_JUNK_RE.test(a.fact))
      // Year gate: a dated answer about a DIFFERENT year is a different scene.
      .filter((a) => { if (!momentYear) return true; const ys = (a.fact.match(/\b(1[89]\d{2}|20\d{2})\b/g) || []).map(Number); return !ys.length || ys.some((y) => Math.abs(y - momentYear) <= 1); })
      .map((a) => ({ fact: a.fact.trim(), source: a.source }));
    if (!fresh.length) return [];
    const q = await verifyFactQuotes(fresh, Date.now() + 20_000).catch(() => ({ replace: [] as any[], checked: 0 }));
    const swap = new Map(q.replace.map((r: any) => [r.from.fact, r.to]));
    const out = fresh.flatMap((f) => (swap.has(f.fact) ? (swap.get(f.fact) ? [swap.get(f.fact) as ResearchFact] : []) : [f]));
    console.log(`[scene-research] ${out.length} scene fact(s) for "${moment.slice(0, 80)}" :: ${out.map((f) => f.fact.slice(0, 90)).join(" || ")}`);
    return out.slice(0, 8);
  } catch (e: any) {
    console.error("[scene-research] failed:", e?.message);
    return [];
  }
}

// LONG-FORM FEATURE MINING. The best script material for a real case lives in long feature articles
// (a newspaper series or in-depth profile): scenes, verbatim quotes, the people around the subject,
// their jobs and daily life. Skripr's research collects short facts from many sources and never READ
// those pieces (seen on Freshwaters: one Florida Today feature held the cubicle under the sink, the
// trooper's quote, the governor's letter, "Cowboy", the mobile library, Joyce Wade, his sons, and the
// victim's son's words; none of it was in the research). This finds such articles among the cited
// sources plus a targeted search, reads each in full (direct, then the Internet Archive), keeps only
// genuine long-form pieces about the subject, and extracts granular facts with the article as source.
// Every extracted quote is then checked against the page it came from.
const FEATURE_SKIP_HOST = /(?:^|\.)(?:wikipedia\.org|justice\.gov|\.gov|fbi\.gov|youtube\.com|facebook\.com|twitter\.com|x\.com|reddit\.com|instagram\.com|tiktok\.com)$/i;
export async function mineFeatureArticles(caseName: string, candidateUrls: string[], existing: string[], deadlineMs: number): Promise<ResearchFact[]> {
  const anchor = caseAnchorToken(caseName);
  if (!anchor || Date.now() > deadlineMs) return [];
  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  // 1) Candidates: cited sources, plus a search for in-depth pieces.
  let urls = [...new Set(candidateUrls.filter((u) => /^https?:/.test(u) && !FEATURE_SKIP_HOST.test(host(u))))];
  const pkey = process.env.PERPLEXITY_API_KEY;
  if (pkey) {
    try {
      const qs = [
        `What in-depth newspaper feature, multi-part series, or long-form profile tells the life story of ${caseName}? Give the URL of that article.`,
        `Which long-form magazine or newspaper article describes ${caseName}'s daily life, family, jobs, and the people around him or her? Give its URL.`,
        `What local newspaper published the most detailed narrative account of ${caseName}'s case? Give the article URL.`,
      ];
      const ans = await fetchPerplexityAnswers(pkey, caseName, undefined, [caseName], qs);
      urls = [...new Set([...ans.map((a) => a.source || "").filter((u) => /^https?:/.test(u) && !FEATURE_SKIP_HOST.test(host(u))), ...urls])];
    } catch { /* search is optional */ }
  }
  urls = urls.slice(0, 10);
  // 2) Read them; keep only genuine long-form pieces that are about the subject.
  const read = await Promise.all(urls.map(async (u) => {
    if (Date.now() > deadlineMs) return null;
    let d = await fetchReadableDoc(u, deadlineMs).catch(() => null);
    if (!d || d.isPdf || (d.text || "").split(/\s+/).length < 1500) d = (await fetchViaWayback(u, deadlineMs).catch(() => null)) || d;
    if (!d || d.isPdf) return null;
    const words = (d.text || "").split(/\s+/).length;
    const mentions = (d.text.match(new RegExp(`\\b${anchor}\\b`, "gi")) || []).length;
    return words >= 1500 && mentions >= 6 ? { url: u, text: d.text, words, mentions } : null;
  }));
  const features = read.filter((x): x is { url: string; text: string; words: number; mentions: number } => !!x)
    .sort((a, b) => b.mentions - a.mentions).slice(0, 2);
  if (!features.length) { console.log(`[feature] no long-form feature found for "${caseName}" (checked ${urls.length})`); return []; }
  // 3) Extract granular, sourced facts from each.
  const seen = new Set(existing.map((f) => factId(f)));
  const out: ResearchFact[] = [];
  for (const f of features) {
    if (Date.now() > deadlineMs) break;
    try {
      const msg = await anthropic().messages.create({
        model: "claude-sonnet-4-6", max_tokens: 6000, temperature: 0,
        system: `You extract facts from a long-form feature article for a documentary script. Output ONLY facts the article literally states, never inference or outside knowledge. Prioritize what a summary drops: SCENES (where, what happened, physical details), VERBATIM QUOTES with exactly who said them and to whom, the PEOPLE around the subject (names, relationships), JOBS, places lived, DAILY LIFE, and DATES. Each fact is ONE self-contained sentence that names ${anchor} (or the person quoted) so it reads correctly on its own. Quotes must be copied character for character inside double quotes. 25 to 45 facts. Skip navigation, ads, captions, and related-link text. Output ONLY JSON: {"facts":["...","..."]}`,
        messages: [{ role: "user", content: `SUBJECT: ${caseName}\nARTICLE URL: ${f.url}\n\nARTICLE TEXT:\n<<<\n${f.text.slice(0, 48000)}\n>>>` }],
      });
      const t = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
      for (const fact of (Array.isArray(j?.facts) ? j.facts : []).filter((x: any) => typeof x === "string" && x.trim().length > 20)) {
        const id = factId(fact);
        if (seen.has(id) || FILE_META_JUNK_RE.test(fact)) continue;
        seen.add(id);
        out.push({ fact: fact.trim(), source: f.url, feature: true });
      }
    } catch (e: any) { console.error(`[feature] extract failed for ${f.url}:`, e?.message); }
  }
  // 4) Quotes checked against the article itself (the pages are already known to be readable).
  const q = await verifyFactQuotes(out, Math.min(deadlineMs, Date.now() + 25_000), new Map(features.map((x) => [x.url, x.text]))).catch(() => ({ replace: [] as any[], checked: 0 }));
  const swap = new Map(q.replace.map((r: any) => [r.from.fact, r.to]));
  const final = out.flatMap((f) => (swap.has(f.fact) ? (swap.get(f.fact) ? [{ ...(swap.get(f.fact) as ResearchFact), feature: true }] : []) : [f]));
  console.log(`[feature] ${final.length} fact(s) from ${features.length} long-form feature(s): ${features.map((x) => `${host(x.url)} (${x.words}w, ${x.mentions} mentions)`).join(", ")}`);
  return final;
}

// MIXED SUBJECTS: research that describes unrelated things sharing a name or keyword (seen live: "The
// Phantom of the Open Source" returned a credential tool AND an astrophysics code, both called Phantom,
// and the cards compared their licenses). One cheap call groups the facts by subject; the research page
// asks which one the video is about. Different aspects of ONE story (the crime, the trial, the manhunt)
// are never "mixed". Best effort: any failure means "not mixed".
export interface SubjectGroup { label: string; idx: number[] }
export async function detectMixedSubjects(topic: string, facts: string[]): Promise<{ mixed: boolean; subjects: SubjectGroup[]; note: string }> {
  const none = { mixed: false, subjects: [] as SubjectGroup[], note: "" };
  if (facts.length < 4) return none;
  try {
    const list = facts.slice(0, 120).map((f, i) => `${i}. ${String(f).slice(0, 300)}`).join("\n");
    const msg = await anthropic().messages.create({
      model: "claude-sonnet-4-6", max_tokens: 1500, temperature: 0,
      messages: [{ role: "user", content: `A YouTube creator's video topic: "${String(topic).slice(0, 160)}".
These facts were researched for it. Do they describe ONE subject (one case, person, company, project, event, or phenomenon), or do they MIX DIFFERENT, UNRELATED subjects that only share a name or keyword (two different software projects both called "Phantom"; two different people with the same name)?
Only answer "mixed" when the subjects are genuinely unrelated. Different parts of one story (the crime, the trial, the escape, the people involved, the wider context) are ONE subject.

FACTS:
${list}

Output ONLY JSON: {"mixed":false,"subjects":[{"label":"short name of the subject, 2-6 words","idx":[0,1,2]}],"note":"one plain sentence a creator would understand"}` }],
    }, { timeout: 30_000, maxRetries: 0 });
    const text = msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return none;
    const j = JSON.parse(m[0]);
    const n = Math.min(facts.length, 120);
    const subjects: SubjectGroup[] = (Array.isArray(j?.subjects) ? j.subjects : []).map((s: any) => ({
      label: String(s?.label || "").slice(0, 60),
      idx: [...new Set<number>((Array.isArray(s?.idx) ? s.idx : []).map(Number).filter((k: number) => Number.isInteger(k) && k >= 0 && k < n))],
    })).filter((s: SubjectGroup) => s.label && s.idx.length >= 2);
    // Mixed only when at least two real groups exist; a stray fact or two isn't a second subject.
    const mixed = !!j?.mixed && subjects.length >= 2;
    return { mixed, subjects: mixed ? subjects : [], note: mixed ? String(j?.note || "").slice(0, 240) : "" };
  } catch (e: any) {
    console.error("[research] mixed-subject check failed:", e?.message || e);
    return none;
  }
}
