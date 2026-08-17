import { Anthropic } from "@anthropic-ai/sdk";
import { caseKey, getCachedFactSet, getBestAcrossVersions, putCachedFactSet, unionFacts, CACHE_GOOD_ENOUGH } from "@/lib/case-cache";
import { getContaminationWatchlist, recordCaseEntities } from "@/lib/contamination";
import { addToLibrary, activeFacts } from "@/lib/fact-library";

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
}

// MOVE #5 — HONEST LENGTH. Length is an OUTPUT of the evidence, not an input: never force a
// runtime onto thin facts (that is the padding/fabrication the checks were built to catch).
// A load-bearing fact (a name, number, date, turn of events, or quote) carries roughly one
// narrated span; at Anton's ~166 wpm that is about 2 to 3 facts per minute. So the budget is
// per-minute, and when the case cannot meet it we tell the truth about the supportable length.
export const FACTS_PER_MINUTE = 2.5;
export const MAX_FACTS = 60; // ceiling (~24 honest minutes); also the hard cap on the fact set
// Facts a runtime honestly needs. Floored so even a 1-minute ask researches a real minimum.
export function factBudgetForMinutes(minutes?: number): number {
  const m = minutes && minutes > 0 ? minutes : 10;
  return Math.min(MAX_FACTS, Math.max(6, Math.round(m * FACTS_PER_MINUTE)));
}
// The runtime a given number of sourced facts honestly supports.
export function honestMinutes(factCount: number): number {
  return Math.max(1, Math.round((factCount || 0) / FACTS_PER_MINUTE));
}

// Bump whenever the deepen question brief changes materially. It is part of the
// fact-cache key, so incrementing it invalidates every previously cached fact set and
// forces a re-derive under the new brief. v2 added: verbatim quotes, physical
// description + nickname, and one vivid scene in full.
export const RESEARCH_BRIEF_VERSION = 2;

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
    if (kind === "event") {
      // Anchor case resolution on the ANGLE when there is one, not just the topic.
      // The angle is the real subject ("How a Mobster Infiltrated the FBI for 30
      // Years"); the topic is often the angle's framing ("The Double Life Nobody
      // Suspected"). Passing topic alone made Claude resolve the framing and return
      // psychological-profile cases while Perplexity, which got the angle, returned
      // the correct mob-informant facts. The two must key off the same subject.
      const resolveSubject = input.angle ? `${input.angle}. ${input.topic}` : input.topic;
      const resolved = await resolveSubjects({ topic: resolveSubject, niche: input.niche }).catch(() => null);
      if (resolved?.ok) {
        candidates = resolved.candidates;
        // Claude's classification is also more reliable; if it says this is not an
        // event after all, trust that and drop the (now irrelevant) event verdict.
        if (resolved.kind !== "event") kind = resolved.kind;
      }
    }

    return { ok: true, kind, verdict, verdictNote, facts, citations, candidates };
  } catch (e: any) {
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
    if (kind === "event" && candidates.length) {
      candidates = await rankAndGuardCandidates(topic, candidates);
    }
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
    lines.push(...g.facts.slice(0, 12).map((f) => `- ${f}`));
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
async function fetchPerplexityAnswers(
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
): Promise<{ keep: ResearchFact[]; conflicts: DeepenResult["conflicts"] }> {
  const keepAll = () => ({ keep: pairs.map((p) => ({ fact: p.fact, source: p.source })), conflicts: [] as DeepenResult["conflicts"] });
  if (!pairs.length) return { keep: [], conflicts: [] };
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
      } else {
        keep.push({ fact: p.fact, source: p.source });
      }
    }
    // A malformed judgement that kept nothing is more likely a parse miss than a
    // real "everything is bad", so fall back to the deterministically-filtered set.
    if (!keep.length && !conflicts.length) return keepAll();
    return { keep, conflicts };
  } catch { return keepAll(); }
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
export async function deepenCaseFacts(input: { caseName: string; summary?: string; niche?: string; sourcePayoff?: string; sourceSubject?: string; userId?: string; kind?: TopicKind; topicAnchor?: string; targetFacts?: number; targetMinutes?: number }): Promise<DeepenResult> {
  const t0 = Date.now();
  // Sanitize the case identity first: arbitrary prose in this field drifts retrieval.
  const caseName = toCaseIdentity(input.caseName || "");
  if (!caseName.trim()) return { facts: [], conflicts: [], status: "no-facts" };
  // MOVE #5 — the per-minute fact budget the requested runtime honestly needs, and the hard
  // cap on how many facts we will collect for it. targetFacts (if a caller passes it) wins;
  // otherwise it is derived from the length slider's minutes.
  const requestedMinutes = input.targetMinutes && input.targetMinutes > 0 ? Math.round(input.targetMinutes) : undefined;
  const budget = input.targetFacts && input.targetFacts > 0 ? Math.min(MAX_FACTS, Math.round(input.targetFacts)) : factBudgetForMinutes(input.targetMinutes);
  const factCap = Math.min(MAX_FACTS, Math.max(16, budget));
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
- the documented procedural history and how the story actually RESOLVED, with dates
- the DOCUMENTED AFTERMATH for the central figure (threats, retaliation, litigation, personal cost) — this is often the strongest material
- the KEY HUMAN RELATIONSHIP: the specific, named person the central figure grew closest to, trusted, befriended, or ultimately betrayed — the emotional core a documentary lives on. Ask for it by name where the record supports it
- DIRECT VERBATIM QUOTES (high value): 2 or 3 of the most striking things the central figure (or a key figure) actually SAID, word for word, with a source. Ask for quotes from PUBLISHED INTERVIEWS, PRESS PIECES, or COURT TESTIMONY FIRST — those transcripts are indexed and searchable (an NPR segment, a newspaper interview) — and only fall back to a memoir. A memoir's interior lines are poorly indexed and hard to retrieve, so lead the question at interviews and reporting. A real quote is what a strong cold open and a payoff are built on; narration cannot do the same work.
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
  const baseKey = caseKey(canonicalCaseName);
  const key = `${baseKey}::v${RESEARCH_BRIEF_VERSION}`;
  const cached = await getCachedFactSet(key);
  if (cached && cached.facts.length >= CACHE_GOOD_ENOUGH) {
    // A cache HIT must still union across brief versions. Returning the current
    // version's row verbatim was why the union "didn't land": once v2 had cached, every
    // later run short-circuited here and never reached the merge at the bottom, so the
    // v1 facts (54 indicted, 28 months, full patch) stayed invisible.
    const priorHit = await getBestAcrossVersions(baseKey);
    const mergedHit = unionFacts([...cached.facts, ...(priorHit?.facts || [])]).slice(0, factCap);
    const whenHit = deriveWhenFromFacts(mergedHit) || cached.when || correction.when;
    if (mergedHit.length > cached.facts.length) {
      await putCachedFactSet(key, { caseName: cached.caseName || correction.caseName, when: whenHit, facts: mergedHit, conflicts: cached.conflicts });
    }
    // Cache hits feed the library too, and return it — otherwise a cached run would
    // hand back a smaller set than the user has already accumulated for this topic.
    let returnHit: ResearchFact[] = mergedHit;
    if (input.userId) {
      const lib = await addToLibrary(input.userId, libraryAnchor, mergedHit, { topicLabel: canonicalCaseName });
      const all = activeFacts(lib);
      if (all.length) returnHit = all.map((f) => ({ fact: f.fact, source: f.source }));
    }
    // MOVE #2: supersede stale/weaker facts before returning — including any the LIBRARY
    // accumulated on an earlier run (the $10M the safety-gate TTL couldn't shed), so the
    // angle page and script never see a superseded number.
    const reconciledHit = (await reconcileFacts(returnHit)).facts.slice(0, factCap);
    return withHonesty({ facts: reconciledHit, conflicts: cached.conflicts, status: "ok", caseName: cached.caseName || correction.caseName, when: whenHit });
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
  const { keep, conflicts } = await reviewDeepenedFacts(canonicalCaseName, pairs, input.summary, watchlist);

  // 5) Source tiering. Drop facts carried only by a low-tier (self-published /
  // merch-SEO) source WHEN better-sourced facts remain, so a blogspot page never
  // stands behind a claim while a wire story is available. If low-tier is all we
  // have, keep it rather than return nothing — the fact card already warns to verify.
  const strong = keep.filter((f) => sourceTier(f.source) !== "low");
  let freshFacts = (strong.length >= 2 ? strong : keep).slice(0, factCap);

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
      freshFacts = unionFacts([...freshFacts, ...reviewed.keep]).slice(0, factCap);
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
  let askPool = [...questions];
  for (let round = 0; (freshFacts.length < target || (conflicts.length > 0 && round === 0)) && round < 2 && Date.now() - t0 < 60_000; round++) {
    const gaps = (await reformulateQuestions(canonicalCaseName, askPool.slice(0, 8))).filter((q) => !askPool.includes(q));
    if (!gaps.length) break;
    askPool = askPool.concat(gaps);
    const morePairs = await fetchPerplexityAnswers(pkey, canonicalCaseName, input.summary, canonical, gaps);
    if (!morePairs.length) break;
    const reviewed = await reviewDeepenedFacts(canonicalCaseName, morePairs, input.summary, watchlist);
    const before = freshFacts.length;
    freshFacts = unionFacts([...freshFacts, ...reviewed.keep]).slice(0, factCap);
    if (freshFacts.length <= before) break; // nothing new — retrieval gravity; stop rather than loop
  }

  // MOVE #5(c) — CONTEXTUAL-FACT EXPANSION. The core case is now tapped (the depth loop above
  // stopped adding case facts), but the budget may still be unmet. Rather than PAD, fetch real
  // SURROUNDING CONTEXT — how the system/industry works, how this kind of thing is normally
  // detected or prosecuted, what makes it a first, the closest prior cases. These are sourced
  // and adjudicated like any other fact, marked context:true, and add honest minutes instead
  // of filler. Capped and time-guarded like the depth loop.
  if (freshFacts.length < target && Date.now() - t0 < 60_000) {
    const contextQs = [
      `What is the essential BACKGROUND CONTEXT for understanding ${canonicalCaseName}: how does the system, industry, technology, or mechanism it involves normally work?`,
      `How is this kind of activity normally DETECTED, prevented, or prosecuted, and what makes ${canonicalCaseName} notable, unprecedented, or a first of its kind?`,
      `What are the closest PRIOR or SIMILAR documented cases to ${canonicalCaseName}, and how does it compare to them in scale or method?`,
    ];
    let cAsk = [...contextQs];
    for (let round = 0; freshFacts.length < target && round < 2 && Date.now() - t0 < 60_000; round++) {
      const qs = round === 0 ? contextQs : await reformulateQuestions(canonicalCaseName, cAsk.slice(0, 6));
      const fresh = qs.filter((q) => round === 0 || !cAsk.includes(q));
      if (!fresh.length) break;
      cAsk = cAsk.concat(fresh);
      const cPairs = await fetchPerplexityAnswers(pkey, canonicalCaseName, input.summary, canonical, fresh);
      if (!cPairs.length) break;
      const reviewed = await reviewDeepenedFacts(canonicalCaseName, cPairs, input.summary, watchlist);
      const ctx = reviewed.keep.map((f) => ({ ...f, context: true as const }));
      const before = freshFacts.length;
      freshFacts = unionFacts([...freshFacts, ...ctx]).slice(0, factCap);
      if (freshFacts.length <= before) break; // context well is dry too — honesty ceiling will speak
    }
  }

  // Union with the case's best prior fact set (any brief version) rather than
  // overwriting it. A version bump re-fetches to add new asks (quotes, a scene), but the
  // earlier run's hard facts — 54 indicted, 53 convicted, 28 months, full patch — must
  // NOT be lost. Fresh facts lead (they carry the new material); prior uniques fill in.
  const prior = await getBestAcrossVersions(caseKey(canonicalCaseName));
  const facts = unionFacts([...freshFacts, ...(prior?.facts || [])]).slice(0, factCap);

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
  if (input.userId && facts.length) {
    const lib = await addToLibrary(input.userId, libraryAnchor, facts, { topicLabel: canonicalCaseName });
    const all = activeFacts(lib);
    if (all.length) returnFacts = all.map((f) => ({ fact: f.fact, source: f.source, context: f.context }));
  }
  // MOVE #2: reconcile before returning, so a superseded number (this run's or one the
  // library accumulated earlier) is dropped and the angle page states one authoritative
  // figure — the "$8M beats $10M, age-52 drops" adjudication, with zero human intervention.
  const reconciled = (await reconcileFacts(returnFacts)).facts.slice(0, factCap);
  return withHonesty({ facts: reconciled, conflicts, status: "ok", caseName: correction.caseName, when: finalWhen });
}
