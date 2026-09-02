import { voiceChecks } from "@/lib/voice-metrics";
// Post-generation compliance check.
//
// The Remixer extracts a spec from the source video — hook type, 7 sections with
// timestamps, 9 retention triggers with positions — and then never compares the script
// it produced against that spec. Six runs of a flattened climax were caught by a human
// reading the output; every one of them was detectable here automatically.
//
// These checks are deterministic (no model call) and report rather than block: a script
// can be good and still miss a beat, so the creator gets a checklist, not a rejection.

export interface ComplianceCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
  // "structure" beats matter most for retention; "accuracy" are the leak guards.
  kind: "structure" | "accuracy";
}

export interface ComplianceInput {
  fullScript: string;
  hook?: string;
  sections?: { title?: string; content?: string }[];
  // Extracted source spec.
  sourceHookType?: string;
  // The source video's actual hook text, so a stat hook can be checked against the
  // real thing — its length and its mechanics — rather than the category label alone.
  sourceHookText?: string;
  sourceSectionCount?: number;
  targetWords?: number;
  // Sourced facts, used to check whether an available quote was actually used.
  facts?: string[];
  // Non-event topics are judged against the explainer form instead of the story form.
  topicKind?: "event" | "explainer" | "hypothetical" | "claim";
  // The SOURCE video's own longest-to-median section ratio, measured from its extracted
  // timestamps. A remix should match the shape of the video it was modeled on, so when
  // this is known it replaces the generic weighting threshold.
  sourceWeightRatio?: number;
  // What the creator's voice profile says they NEVER do. These outrank the generic
  // craft checks — a Fern-voiced script that never says "you" is correct, not wrong.
  voiceProhibitions?: { noSecondPerson?: boolean; noRhetoricalQuestions?: boolean };
  // Distinctive terms from the SOURCE video's own story (Nike, Memphis, shipping labels).
  // The Remixer copies structure, never content, so any of these appearing in the remix
  // without a supporting fact is imported content and must be flagged.
  sourceEntities?: string[];
  // "Now" for the stale-date check, injectable for tests. Defaults to Date.now().
  now?: number;
}

// Longest-to-median section ratio from the source video's extracted timestamps, so a
// remix can be judged against the actual video it copies rather than a fixed number.
export function sourceSectionRatio(structure?: { timestamp?: string }[]): number | undefined {
  if (!Array.isArray(structure) || structure.length < 3) return undefined;
  const secs = structure
    .map((s) => {
      const m = String(s?.timestamp || "").match(/^(?:(\d+):)?(\d+):(\d{2})$/);
      return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
    })
    .filter((n): n is number => n !== null);
  if (secs.length < 3) return undefined;
  const spans: number[] = [];
  for (let i = 0; i < secs.length - 1; i++) spans.push(Math.max(1, secs[i + 1] - secs[i]));
  if (spans.length < 2) return undefined;
  const sorted = [...spans].sort((a, b) => b - a);
  const median = sorted[Math.floor(sorted.length / 2)];
  return median > 0 ? sorted[0] / median : undefined;
}

const words = (s: string) => (s || "").split(/\s+/).filter(Boolean).length;

// ---- UNIVERSAL NUMERIC NORMALIZATION (voice-independent) --------------------------------
// The figure-check must not care how a voice renders a number — digits, spelled out, or
// abbreviated ("$8M"). It normalizes BOTH the script and the facts to numeric VALUES and
// matches on value, and it parses a WHOLE spelled number ("six hundred sixty-one thousand
// four hundred forty" = 661440) instead of fragmenting it into "six hundred" + "four hundred"
// (the bug that flagged real, correctly-spelled figures as invented).
const _ONES: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const _TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const _SCALE: Record<string, number> = { hundred: 100, thousand: 1000, million: 1e6, billion: 1e9, trillion: 1e12 };

// Precision = the least-significant nonzero place (trailing-zeros heuristic): "$8M"
// (8,000,000) → 1e6, "8,091,843" → 1, "1,200,000" → 1e5.
function precisionOf(v: number): number {
  let n = Math.floor(Math.abs(v));
  if (n === 0) return 1;
  let p = 1;
  while (n % 10 === 0) { n /= 10; p *= 10; }
  return p;
}
// Two numbers match if they agree once BOTH are rounded to the COARSER one's precision, so
// "$8M" matches "$8,091,843.64" (both → 8 at 1e6) but "$9M" does not (9 vs 8). Symmetric, so a
// precise figure also matches the abbreviated fact and vice versa.
export function numbersMatch(a: number, b: number): boolean {
  const P = Math.max(precisionOf(a), precisionOf(b));
  return Math.round(Math.floor(Math.abs(a)) / P) === Math.round(Math.floor(Math.abs(b)) / P);
}
// Spelled-out cardinal numbers → values, whole phrases (never fragmented). Standard
// words-to-number accumulation; "and" is a mid-number connector.
export function spelledNumbersIn(text: string): { value: number; surface: string }[] {
  const toks = (text.toLowerCase().match(/[a-z]+/g)) || [];
  const out: { value: number; surface: string }[] = [];
  let total = 0, current = 0, active = false, phrase: string[] = [];
  const flush = () => { if (active && total + current > 0) out.push({ value: total + current, surface: phrase.join(" ") }); total = 0; current = 0; active = false; phrase = []; };
  for (const t of toks) {
    if (t in _ONES) { current += _ONES[t]; active = true; phrase.push(t); }
    else if (t in _TENS) { current += _TENS[t]; active = true; phrase.push(t); }
    else if (t === "hundred") { current = (current || 1) * 100; active = true; phrase.push(t); }
    else if (t in _SCALE) { total += (current || 1) * _SCALE[t]; current = 0; active = true; phrase.push(t); }
    else if (t === "and" && active) { phrase.push(t); }
    else flush();
  }
  flush();
  return out;
}
// Digit and abbreviated numbers → values with their surface text: "$8M", "1.2M", "8 million",
// "661,440", "8,091,843.64", "42%".
export function digitNumbersIn(text: string): { value: number; surface: string; unit: boolean }[] {
  const out: { value: number; surface: string; unit: boolean }[] = [];
  const re = /(?:[$£€]\s?)?(\d[\d,]*(?:\.\d+)?)\s*(k|m|bn|b|thousand|million|billion|trillion|%|percent|dollars?|hours?|minutes?|years?|days?|people|users)?\b/gi;
  for (const m of text.matchAll(re)) {
    const base = parseFloat(m[1].replace(/,/g, ""));
    if (!isFinite(base)) continue;
    const suf = (m[2] || "").toLowerCase();
    const mult = suf === "k" || suf === "thousand" ? 1e3 : suf === "m" || suf === "million" ? 1e6 : (suf === "b" || suf === "bn" || suf === "billion") ? 1e9 : suf === "trillion" ? 1e12 : 1;
    const unit = /[$£€]/.test(m[0]) || /^(k|m|bn|b|thousand|million|billion|trillion|%|percent|dollar|hour|minute|year|day|people|user)/.test(suf);
    out.push({ value: base * mult, surface: m[0].trim(), unit });
  }
  return out;
}
// Every numeric value present in a text, from all three renderings — the fact set's canonical form.
function allNumberValues(text: string): number[] {
  return [...digitNumbersIn(text).map((d) => d.value), ...spelledNumbersIn(text).map((s) => s.value)];
}

// A verbatim quote of 3+ words inside quotation marks (straight or curly).
// Min 6 chars, not 12: the strongest quotes are short ("You a cop?"), and those are
// exactly the ones worth opening on and putting on a thumbnail.
// Single quotes only count as delimiters when they open at a word boundary and close
// before space/punctuation — otherwise the apostrophe in "Queen's" reads as a quote and
// swallows half the paragraph.
const QUOTE_RE = /["“]([^"”\n]{6,240})["”]|(?:^|[\s(\[])['‘]([^'’\n]{6,240})['’](?=$|[\s.,!?)\]])/;

// PERSON-INSINUATION detection — shared by the compliance check AND the silent auto-cut in
// generation, so both use one source of truth. Matches the LANGUAGE of insinuated guilt/
// knowledge/complicity about a real person ("someone else was collecting", "not the kind of thing
// you sign without asking", "had to have known"). This is about a real, IDENTIFIABLE person —
// which includes a person named only by ROLE ("the CEO of the unnamed AI music company"), since
// that still points at one real human. The 20-min build insinuated exactly that: a roled CEO had
// "reasons not to look too hard" and was "the right person in the right agreement while bots
// quietly ran" — an unsupported complicity argument from a bare contract + revenue share. Those
// role-based shapes are added below.
export const INSINUATION_RE = /\b(not the kind of thing (?:you|anyone|someone|people) (?:sign|do|build|set up)\w*\s+without (?:asking|knowing|realizing|questions)|(?:had to have|must have|could\s?n'?t (?:not )?have|would have) known|knew (?:exactly )?(?:what|where|how|who|that)|beneficiary (?:built|baked) (?:right )?into|looked the other way|turned a blind eye|\bcomplicit\b|(?:was|were|had to be) in on it|cover(?:ing)? (?:for (?:him|her|them)| it up)|no coincidence that|someone (?:else )?was (?:collecting|profiting|benefiting|pulling)|does(?:n'?t| not) happen without someone (?:knowing|noticing)|reasons? not to (?:look|ask|dig|question)(?: too)?(?: hard| closely| deep\w*| many questions)?|(?:did|does)(?:n'?t| not) (?:want to |care to )?(?:look|ask|dig)(?: too)? (?:hard|closely|deep\w*|many questions)|paid (?:not to ask|to look away|to stay quiet)|the right (?:person|man|woman|name) in the right (?:agreement|place|position|deal|contract|room)|(?:profit\w*|benefit\w*|paid|collect\w*)[^.]{0,40}\bwhile [^.]{0,40}\b(?:quietly|secretly)\b|(?:chose|preferred) not to (?:know|ask|look)|asked no questions)\b/i;
export function looksLikeInsinuation(s: string): boolean { return INSINUATION_RE.test(s || ""); }

// GOVERNING PRINCIPLE — silent fix. Cut sentences that insinuate a real person's guilt beyond the
// facts, before the script is ever returned. A CUT is the safe default: removing a sentence can't
// introduce a new problem. Returns the cleaned text and an INTERNAL record of what was cut (never
// shown to the user — for preview verification + self-learning telemetry only).
export function stripInsinuations(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  const outParas = text.split(/\n\n+/).map((p) => {
    const kept = p.split(/(?<=[.!?])\s+/).filter((s) => {
      if (looksLikeInsinuation(s)) { cuts.push(s.trim()); return false; }
      return true;
    });
    return kept.join(" ").trim();
  }).filter((p) => p.length > 0);
  return { text: outParas.join("\n\n"), cuts };
}

// GOVERNING PRINCIPLE — silent fix (DEFAMATION). Cut a sentence that EQUATES a party the record
// left unnamed (a co-conspirator, "CC-N", an unindicted co-conspirator, "the unnamed CEO/company")
// with a specific NAMED living person or company. The richer primary-source mining surfaces real
// names near "CC-N" designations, and a script that fills the blank ("the unnamed AI company CEO
// was Alex Mitchell", "Alex Mitchell was the co-conspirator") is asserting an identity the record
// does NOT establish AND naming a living, uncharged person in a crime — the sharpest defamation
// risk in the whole pipeline. Two-signal by design: fires ONLY when a designation is EQUATED to a
// proper name (copula/appositive), so "Michael Smith worked with an unnamed co-conspirator" (the
// charged defendant, no identification of the unnamed party) is left alone.
const _DESIG = "(?:un(?:named|identified)[^.]{0,25}?(?:ceo|executive|officer|company|firm|founder|owner|distributor|promoter|publicist|individual|conspirator)|co-?conspirators?|cc-?\\d+|(?:an? )?unindicted co-?conspirator)";
const _NAME = "[A-Z][a-zA-Z.'’-]+(?:\\s+[A-Z][a-zA-Z.'’-]+)+";
const UNNAMED_ID_RE_A = new RegExp(`\\b(?:the )?${_DESIG}\\b[^.]{0,30}?(?:\\bwas\\b|\\bis\\b|\\bwere\\b|identified as|turned out to be|revealed to be|none other than|namely|,\\s*)\\s*(${_NAME})`, "i");
const UNNAMED_ID_RE_B = new RegExp(`(${_NAME})\\b[^.]{0,35}?(?:\\bwas\\b|\\bis\\b|,\\s*(?:the\\s+)?)\\s*(?:the\\s+)?${_DESIG}\\b`, "i");
export function namesAnUnnamedParty(s: string): boolean { return UNNAMED_ID_RE_A.test(s || "") || UNNAMED_ID_RE_B.test(s || ""); }
export function stripUnnamedPartyNaming(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  const outParas = text.split(/\n\n+/).map((p) => {
    const kept = p.split(/(?<=[.!?])\s+/).filter((s) => {
      if (namesAnUnnamedParty(s)) { cuts.push(s.trim()); return false; }
      return true;
    });
    return kept.join(" ").trim();
  }).filter((p) => p.length > 0);
  return { text: outParas.join("\n\n"), cuts };
}

// INFERENCE / SPECULATION-AS-FACT detection. Distinct from INSINUATION_RE (a real person's guilt)
// and the claim check (an invented FACT): this catches invented REASONING — a cause, motive, or
// conclusion asserted as established when the record doesn't support it. An outside review of a
// Skripr script flagged exactly this: "sealed cooperation, ongoing investigation, or both" (a guess
// at why a co-conspirator is unnamed), "Smith did not build this entirely alone" (accomplices
// inferred from silence), a totalizing "that gap was the entire business", and necessity inferences
// ("must have required coordination"). For an investigative script this is a credibility risk, so
// the safe default is to CUT the speculating sentence (never soften into a new claim).
export const SPECULATION_RE = /\b((?:must|would|could|had to) have (?:been|required|involved|known|meant|taken|needed|had|coordinated|demanded)|had to have (?:been|required|involved|meant|known|taken)|which (?:can|could) only mean|could only (?:have )?mean(?:t)?(?:\s+(?:one thing|that))?|(?:did(?:n'?t| not)|could(?:n'?t| not) have|had(?:n'?t| not)) (?:do|done|build|built|run|ran|orchestrate|orchestrated|pull off|pulled off|manage|managed|create|created|mastermind|masterminded|set up|pull|pulled|act|acted|operate|operated)[^.]{0,40}?\b(?:alone|on (?:his|her|their) own|by (?:him|her|them)\s?self|single-handedly|without help)\b|\bwas the entire (?:business|scheme|point|story|operation|game|plan|thing|fraud)\b|(?:points to|all but confirms|is clear evidence of|strongly (?:implies|suggests)|can only be explained by)\b|(?:sealed (?:cooperation|plea|deal)|an? ongoing investigation|a cooperating (?:witness|deal)|cooperation deal|a plea deal)[^.]{0,60}\bor both\b|the (?:most likely|only plausible) (?:explanation|reason|scenario) is|(?:nobody|no one|not (?:one|a single) (?:person|executive|analyst|investigator))[^.]{0,40}\b(?:could (?:explain|say|agree|figure out|account for|tell)|knew|noticed|understood|had (?:an? )?answer)|(?:no one|nobody|few people|not everyone)[^.]{0,30}\b(?:in the (?:industry|business|company)|at the (?:platforms?|labels?|company))[^.]{0,30}\b(?:could|knew|agreed|understood|noticed)|(?:was|were) (?:treated as|considered|thought to be|assumed) (?:essentially |basically |all but )?(?:airtight|foolproof|impossible|unbeatable|bulletproof)|(?:the (?:royalty pools?|numbers?|books?|figures?)) (?:just |simply |never )?(?:did(?:n'?t| not) add up|made no sense))\b/i;
export function looksLikeSpeculation(s: string): boolean { return SPECULATION_RE.test(s || ""); }
export function stripSpeculation(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  const outParas = text.split(/\n\n+/).map((p) => {
    const kept = p.split(/(?<=[.!?])\s+/).filter((s) => {
      if (looksLikeSpeculation(s)) { cuts.push(s.trim()); return false; }
      return true;
    });
    return kept.join(" ").trim();
  }).filter((p) => p.length > 0);
  return { text: outParas.join("\n\n"), cuts };
}

// TRAILING IMPLIED-REVELATION detection — the closing cliffhanger the facts never pay off
// ("what investigators found when they pulled the thread was not simply one man", "the trail
// did not end with Smith", "almost more surprising than the scheme itself", "that's where this
// takes a turn"). Distinct from INSINUATION_RE: this is about an unresolved PAYOFF tease, not a
// real person's guilt. Only meaningful at the END of the script, so it is applied to the trailing
// block, never mid-body (a mid-script tease may legitimately resolve later).
export const TRAILING_TEASE_RE = /\b(what (?:investigators|prosecutors|authorities|agents|they|the fbi|the doj|the sec)\s+(?:found|discovered|uncovered|learned|traced)\b|the (?:trail|money|story|thread|truth)\s+(?:did|does)(?:n'?t| not)\s+end\b|(?:almost )?more (?:surprising|shocking|disturbing|interesting|unsettling|damning|important)\s+than(?:\s+anything)?|(?:and )?(?:that|this|here|now)(?:'?s| is| was) where (?:this story|the story|it|this|things?)\s+(?:takes?|took|turns?|turned|gets?|got|begins?|began)\b|not (?:simply|just|merely|only) one (?:man|woman|person|name|scheme|story)|was(?:n'?t| not) what it seemed|not what (?:anyone|everyone|you|they|the world|the public)\s*(?:had\s*)?(?:ever\s*)?expected|the truth (?:was|turned out|is)\s+(?:far\s+)?(?:stranger|worse|darker|bigger|more|nothing like)|(?:far\s+)?(?:stranger|darker|worse|bigger)\s+than (?:anyone|fiction|expected|imagined)|(?:this|it|that|the story)\s+(?:was|is)\s+only the beginning|would (?:change|reveal|rewrite) everything|the (?:biggest|real|bigger) (?:twist|secret|surprise|question|story)\b|(?:the (?:real |full |whole )?(?:story|part|truth|answer)\b[^.]{0,40}\b)?has(?:n'?t| not) (?:yet )?been (?:told|revealed|written|heard)|(?:the answer|the rest|what (?:comes|came|happened) next)\b[^.]{0,30}?\bgoing to (?:be|surprise|shock)|going to be more (?:surprising|shocking|disturbing)|(?:still|may (?:never|still))\s+(?:out there|be (?:out there|found|known)|know|remain)|we may never (?:know|find out))\b/i;
export function looksLikeTrailingTease(s: string): boolean { return TRAILING_TEASE_RE.test(s || ""); }

// GOVERNING PRINCIPLE — silent fix. Cut the trailing cliffhanger the evidence doesn't deliver.
// The ending usually lands the callback/sourced beat CORRECTLY and then appends the tease, so the
// fix walks from the end, dropping trailing tease sentences (and wholly-tease trailing paragraphs)
// and STOPS at the first real sourced sentence — leaving the script to end on that beat. A cut is
// the safe default; the internal record is returned for preview verification, never surfaced.
export function stripImpliedRevelation(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const paras = text.split(/\n\n+/);
  const cuts: string[] = [];
  let i = paras.length - 1;
  while (i >= 0) {
    const p = paras[i].trim();
    if (!p) { paras.splice(i, 1); i--; continue; }
    const sentences = p.split(/(?<=[.!?])\s+/);
    while (sentences.length && looksLikeTrailingTease(sentences[sentences.length - 1])) {
      cuts.push(sentences.pop()!.trim());
    }
    if (sentences.length === 0) {
      // The whole trailing paragraph was tease — drop it and inspect the now-last paragraph,
      // since the real callback often sits one paragraph back.
      paras.splice(i, 1);
      i--;
      continue;
    }
    // Hit a real sourced sentence; the script should stop here. Don't dig into earlier content.
    paras[i] = sentences.join(" ").trim();
    break;
  }
  return { text: paras.filter((p) => p.trim().length > 0).join("\n\n"), cuts };
}

// GOVERNING PRINCIPLE — silent fix. Remove near-duplicate ADJACENT paragraphs. Chunked generation
// (each section written against a similar brief) can restate the same paragraph back to back — the
// live 20-min build repeated the "the indictment makes explicit ... trick royalty systems" block
// almost verbatim in consecutive positions. This is padding, not elaboration, so the later copy is
// dropped. Conservative: only fires on a HIGH token-overlap between adjacent paragraphs of similar
// length, so paragraphs that merely share a phrase are left alone.
function normalizeForCompare(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalizeForCompare(a).split(" ").filter((w) => w.length > 2));
  const tb = new Set(normalizeForCompare(b).split(" ").filter((w) => w.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  return shared / Math.min(ta.size, tb.size); // fraction of the SHORTER paragraph reproduced
}
export function dedupeAdjacentParagraphs(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const paras = text.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
  const cuts: string[] = [];
  const kept: string[] = [];
  for (const p of paras) {
    const prev = kept[kept.length - 1];
    if (prev) {
      const lenRatio = Math.min(p.length, prev.length) / Math.max(p.length, prev.length);
      // Near-verbatim adjacent block: >=80% of the shorter paragraph's words appear in the other,
      // and they are within 40% in length. Keep the LONGER of the two (more elaboration survives).
      if (lenRatio >= 0.6 && tokenOverlap(p, prev) >= 0.8) {
        if (p.length > prev.length) { cuts.push(prev); kept[kept.length - 1] = p; }
        else { cuts.push(p); }
        continue;
      }
    }
    kept.push(p);
  }
  return { text: kept.join("\n\n"), cuts };
}

// GOVERNING PRINCIPLE — silent fix (CORRECTNESS). Cut a stated SCHEME-DURATION count. Two failure
// shapes from the live build: a bare "Three years." fragment immediately followed by "That's how
// long this ran", and the locked title's number ("3 Years") leaking into the body as a stated
// fact. A computed span is a fabrication risk (the scheme ran ~2017-2024, not "three years"); the
// sourced date range should carry it, so the claim sentence is cut. Sentence-level cut only, so it
// can never shatter prose the way the reverted token-replace did. Niche-agnostic.
const DURATION_CLAIM_RE = /\b(?:that|this)(?:'?s| is| was) (?:exactly )?how long (?:it|this|that|the scheme|the operation|the fraud|the whole thing) (?:ran|lasted|went on|continued|kept going|took|had been running)\b/i;
const BARE_DURATION_RE = /^(?:for\s+)?(?:about|nearly|almost|roughly|over|more than)?\s*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:years?|months?|weeks?|days?|decades?)\.?$/i;
const _DURWORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
// The number of YEARS a duration phrase asserts (decades x10), or null. Used to spot the title's
// number leaking into the body and internal "seven years" vs "eight years" contradictions.
function durationYears(s: string): number | null {
  const m = s.toLowerCase().match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(years?|decades?)\b/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : _DURWORDS[m[1]];
  if (!n) return null;
  return /decade/.test(m[2]) ? n * 10 : n;
}
export function stripSchemeDurationClaim(text: string, title?: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  // The locked title's number is a hook device, never a sourced fact — so a bare body fragment
  // repeating it ("Eight years." from a "8 Years" title) is a leak. Also collect every distinct
  // year-duration stated in the body, so a bare fragment that CONTRADICTS another ("seven years"
  // elsewhere vs a bare "Eight years.") is caught as an internal inconsistency.
  const titleYears = title ? durationYears(title) : null;
  const bodyYearVals = new Set<number>();
  for (const raw of text.split(/(?<=[.!?])\s+/)) { const y = durationYears(raw); if (y !== null) bodyYearVals.add(y); }
  const outParas = text.split(/\n\n+/).map((para) => {
    const sentences = para.split(/(?<=[.!?])\s+/);
    const kept: string[] = [];
    for (const s of sentences) {
      if (DURATION_CLAIM_RE.test(s)) {
        cuts.push(s.trim());
        // Also drop an immediately-preceding bare duration fragment ("Three years.") that the
        // claim was elaborating — it is the same false count with no sentence of its own.
        if (kept.length && BARE_DURATION_RE.test(kept[kept.length - 1].trim())) cuts.push(kept.pop()!.trim());
        continue;
      }
      // A BARE standalone duration fragment ("Eight years.") is a dramatic stated span. Cut it when
      // it either repeats the title's number (a title-leak, never a sourced fact) OR conflicts with
      // a different year-duration stated elsewhere in the body (internal contradiction). A duration
      // mentioned INSIDE a full sentence (contextualized) is left alone — only the bare beat is cut.
      const t = s.trim();
      if (BARE_DURATION_RE.test(t)) {
        const y = durationYears(t);
        if (y !== null && ((titleYears !== null && y === titleYears) || [...bodyYearVals].some((v) => v !== y))) {
          cuts.push(t);
          continue;
        }
      }
      kept.push(s);
    }
    return kept.join(" ").trim();
  }).filter((p) => p.length > 0);
  return { text: outParas.join("\n\n"), cuts };
}

// Detector for a future-FRAMED calendar date that is now in the past (shared by the compliance
// check and the silent cut below). DAY granularity ("July 29, 2026", "7/29/2026") or MONTH
// granularity ("July 2026", stale only once the whole month has passed).
const STALE_MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
function staleDateFrameRe(): RegExp {
  return new RegExp(
    `\\b(?:scheduled|set|slated|due|expected|awaiting|pending|upcoming|will (?:be )?(?:sentenc|appear|stand trial|face|go on trial)\\w*)\\b[^.]{0,50}?` +
    `(${STALE_MONTH}\\.?\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}/\\d{1,2}/\\d{4}|${STALE_MONTH}\\.?\\s+\\d{4})`,
    "gi",
  );
}
export function isStaleFutureDate(raw: string, now: number): boolean {
  const monthYearRe = new RegExp(`^${STALE_MONTH}\\.?\\s+\\d{4}$`, "i");
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const cleaned = raw.replace(/(\d)(st|nd|rd|th)/, "$1").trim();
  let when: number;
  if (monthYearRe.test(cleaned)) {
    const first = new Date(Date.parse(cleaned));
    when = Number.isNaN(first.getTime()) ? NaN : new Date(first.getFullYear(), first.getMonth() + 1, 0, 23, 59, 59).getTime();
  } else {
    when = Date.parse(cleaned);
  }
  return !Number.isNaN(when) && when < todayStart.getTime();
}

// GOVERNING PRINCIPLE — silent fix. Cut a sentence that presents a now-PAST date as still upcoming
// ("sentencing was scheduled for July 2026" read in September 2026). We can't know the real
// outcome, so the safe default is to cut the stale forward-looking sentence rather than assert a
// wrong one. Fires only on a FUTURE-FRAMED date that has passed, so a normal past-tense historical
// date is never touched. Month-level dates (the live miss) are covered.
export function stripStaleFutureDates(text: string, now: number): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  const outParas = text.split(/\n\n+/).map((para) => {
    const sentences = para.split(/(?<=[.!?])\s+/);
    const kept = sentences.filter((s) => {
      const re = staleDateFrameRe();
      let m: RegExpExecArray | null;
      while ((m = re.exec(s)) !== null) {
        if (isStaleFutureDate(m[1], now)) { cuts.push(s.trim()); return false; }
      }
      return true;
    });
    return kept.join(" ").trim();
  }).filter((p) => p.length > 0);
  return { text: outParas.join("\n\n"), cuts };
}

// GOVERNING PRINCIPLE — silent fix (CRITICAL: a leak here is a FABRICATION). A remix copies the
// source video's STRUCTURE, never its CONTENT — but the 20-min build leaked "It's almost like that
// Project Blitz situation", a proper noun from the Nike source video that has nothing to do with
// this case. That is both a copied-content leak AND an invented fact about the subject. The
// source-leak compliance check only DISPLAYED this (and the panels are hidden), so it reached the
// user. This CUTS any sentence carrying a source-specific term (name/place/object from the source
// video's story) that the user's OWN facts do not support — a term the facts carry is legitimately
// theirs and is kept. Cut the whole sentence (safe default); reworded seams heal downstream.
export function stripSourceLeaks(text: string, sourceEntities: string[] | undefined, factBlob: string | undefined): { text: string; cuts: string[] } {
  if (!text || !sourceEntities || sourceEntities.length === 0) return { text, cuts: [] };
  const factLc = (factBlob || "").toLowerCase();
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Precompute the leak matchers: a source term is a leak only when the CURRENT case's facts do
  // not carry it (or a significant word of it).
  const leakTerms = sourceEntities
    .map((raw) => String(raw || "").trim())
    .filter((t) => t.length >= 3)
    .filter((t) => {
      const tl = t.toLowerCase();
      const tokens = tl.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
      const supported = factLc.includes(tl) || tokens.some((w) => factLc.includes(w));
      return !supported;
    })
    .map((t) => ({ term: t, re: new RegExp(`(?:^|[^a-z0-9])${escapeRe(t.toLowerCase())}(?:[^a-z0-9]|$)`, "i") }));
  if (!leakTerms.length) return { text, cuts: [] };
  const cuts: string[] = [];
  const outParas = text.split(/\n\n+/).map((para) => {
    const kept = para.split(/(?<=[.!?])\s+/).filter((s) => {
      const sl = s.toLowerCase();
      if (leakTerms.some((lt) => lt.re.test(sl))) { cuts.push(s.trim()); return false; }
      return true;
    });
    return kept.join(" ").trim();
  }).filter((p) => p.length > 0);
  return { text: outParas.join("\n\n"), cuts };
}

// GOVERNING PRINCIPLE — silent fix. Collapse an ANCHOR fact restated 3+ times, non-adjacent, across
// the assembled body. Elaboration (deepening a fact) is good and stays; the failure this catches is
// a fact that DRUMS — "661,440 streams a day" 5-6x, the Damian Williams quote 3-4x, "not a tech
// executive, not a hedge fund manager" 3x, the royalty-pool mechanism twice. dedupeAdjacentParagraphs
// handles adjacent copies and the anaphora guard handles repeated section-openers; neither catches
// an anchor spread across sections 2, 4 and 6 — this does.
//
// CRITICAL: keep the ELABORATED instance(s), cut the bare restatements — not the reverse. A fact
// should land once or twice with depth; it shouldn't drum. So among a cluster's occurrences the two
// LONGEST (most surrounding depth) are kept and protected; only the shorter bare restatements are
// cut. Conservative/under-fire: fires only on clear 3+ repeats, always leaves >= 2 instances, never
// strips a fact entirely, and never touches a sentence kept as elaborated by another anchor.
export function collapseRepeatedAnchors(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const paras = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  type Flat = { p: number; s: string };
  const flat: Flat[] = [];
  paras.forEach((p, pi) => {
    for (const raw of p.split(/(?<=[.!?])\s+/)) { const s = raw.trim(); if (s) flat.push({ p: pi, s }); }
  });
  const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const remove = new Set<number>();
  const protectKeep = new Set<number>();
  const cuts: string[] = [];
  // A restatement is cut-eligible when it is either a SHORT bare beat OR it near-duplicates one of
  // the kept (elaborated) occurrences — the latter catches a figure/name drummed across sections
  // inside full sentences that merely reword the same point (the outside-review finding: repeated
  // anchors in long sentences slipped the old short-only rule). A long sentence that carries
  // genuinely DISTINCT content around the anchor has low overlap and is left alone.
  const restatesAKept = (idx: number, keepIdxs: number[]) => keepIdxs.some((k) => tokenOverlap(flat[idx].s, flat[k].s) >= 0.5);
  // Cut a non-kept occurrence when it near-duplicates a kept one (any length — catches a drummed
  // anchor reworded across long sentences) OR it is a tiny bare beat (< 10 words, almost certainly a
  // restatement, e.g. "661,440 streams a day."). A medium/long sentence with DISTINCT content around
  // the anchor has low overlap and is left alone, so genuine elaboration is never lost.
  const cutEligible = (idx: number, keepIdxs: number[]) => wc(flat[idx].s) < 10 || restatesAKept(idx, keepIdxs);

  // DETECTOR B (runs FIRST) — a distinctive FIGURE repeated 3+ times. Normalizes spelled/digit forms
  // and matches on value (numbersMatch). Excludes plausible bare years so "2017" recurring is never
  // an anchor. Keeps the two LONGEST occurrences (the elaborated ones) and cuts the short bare
  // restatements. Runs before the phrase detector so bare figure-restatements can't be protected as
  // a near-verbatim cluster of each other.
  const isDistinctive = (v: number) => Math.abs(v) >= 1000 && !(Number.isInteger(v) && v >= 1900 && v <= 2100);
  const sentVals: number[][] = flat.map((f) =>
    [...digitNumbersIn(f.s).map((d) => d.value), ...spelledNumbersIn(f.s).map((s) => s.value)].filter(isDistinctive),
  );
  const figHandled: number[] = [];
  for (let i = 0; i < flat.length; i++) {
    for (const v of sentVals[i]) {
      if (figHandled.some((h) => numbersMatch(h, v))) continue;
      const occ = flat.map((_, idx) => idx).filter((idx) => sentVals[idx].some((x) => numbersMatch(x, v)));
      if (occ.length >= 3) {
        figHandled.push(v);
        const byLen = [...occ].sort((a, b) => flat[b].s.length - flat[a].s.length);
        const keepArr = byLen.slice(0, 2); // keep the two most elaborated occurrences
        const keep = new Set(keepArr);
        for (const k of occ) {
          if (keep.has(k)) { protectKeep.add(k); continue; }
          // Cut a bare restatement OR a long one that just rewords a kept occurrence; leave a long
          // sentence that carries distinct content around the figure.
          if (!cutEligible(k, keepArr)) continue;
          remove.add(k); cuts.push(`repetition (figure): ${flat[k].s}`);
        }
      }
    }
  }

  // DETECTOR C — a QUOTE restated 3+ times. A verbatim quote (the Feb-2024 email boast) tends to
  // recur inside DIFFERENT surrounding sentences, so its sentences may not hit the near-verbatim
  // threshold in detector A — but the quoted string itself is the anchor. Key each sentence by the
  // normalized first 6 words of its longest quoted span (>= 5 words); cluster by shared key.
  const quoteKey = (s: string): string | null => {
    let best = "";
    const re = /["“]([^"”\n]{12,240})["”]|(?:^|[\s(\[])['‘]([^'’\n]{12,240})['’]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) { const q = (m[1] || m[2] || "").trim(); if (q.length > best.length) best = q; }
    if (!best) return null;
    const words = normalizeForCompare(best).split(" ").filter(Boolean);
    return words.length >= 5 ? words.slice(0, 6).join(" ") : null;
  };
  const keys = flat.map((f, idx) => (remove.has(idx) ? null : quoteKey(f.s)));
  const usedC = new Set<number>();
  for (let i = 0; i < flat.length; i++) {
    if (usedC.has(i) || remove.has(i) || !keys[i]) continue;
    const occ = flat.map((_, idx) => idx).filter((idx) => !remove.has(idx) && keys[idx] === keys[i]);
    if (occ.length >= 3) {
      occ.forEach((k) => usedC.add(k));
      const byLen = [...occ].sort((a, b) => flat[b].s.length - flat[a].s.length);
      const keep = new Set(byLen.slice(0, 2));
      for (const k of occ) {
        if (keep.has(k)) protectKeep.add(k);
        else { remove.add(k); cuts.push(`repetition (quote): ${flat[k].s}`); }
      }
    }
  }

  // DETECTOR A — near-verbatim sentence clusters (a repeated quote/phrase/mechanism sentence). Skips
  // sentences the figure pass already removed, so it can't resurrect a bare restatement.
  const usedA = new Set<number>();
  for (let i = 0; i < flat.length; i++) {
    if (usedA.has(i) || remove.has(i) || wc(flat[i].s) < 6) continue;
    const cluster = [i];
    for (let j = i + 1; j < flat.length; j++) {
      if (usedA.has(j) || remove.has(j)) continue;
      if (tokenOverlap(flat[i].s, flat[j].s) >= 0.8) cluster.push(j);
    }
    if (cluster.length >= 3) {
      cluster.forEach((k) => usedA.add(k));
      const byLen = [...cluster].sort((a, b) => flat[b].s.length - flat[a].s.length);
      const keep = new Set(byLen.slice(0, 2)); // keep the two most elaborated
      for (const k of cluster) {
        if (keep.has(k)) protectKeep.add(k);
        else { remove.add(k); cuts.push(`repetition (phrase): ${flat[k].s}`); }
      }
    }
  }

  // DETECTOR D — a repeated PROPER-NOUN TITLE/PHRASE embedded in DIFFERENT sentences. Detectors A/C
  // work at whole-sentence level, so a title restated across varying sentences slips them — the
  // 20-min build repeated "Christie M. Curtis, Acting Assistant Director in Charge of the FBI's New
  // York Field Office" 3x and "Complex Frauds and Cybercrime Unit" 4x. Extract multi-word proper-
  // noun spans (>= 3 words), and for any appearing in 3+ sentences, keep the two longest occurrences
  // and cut the rest ONLY when the sentence is a SHORT bare restatement (< 22 words), never a long
  // one carrying real content around the name.
  const properNounSpans = (s: string): string[] => {
    const out: string[] = [];
    const re = /\b[A-Z][a-zA-Z.'’-]+(?:\s+(?:of|and|the|in|for|de|&|[A-Z][a-zA-Z.'’-]+)){2,}/g;
    let m: RegExpExecArray | null;
    const CONNECT = new Set(["the", "a", "an", "of", "and", "in", "for", "de"]);
    while ((m = re.exec(s)) !== null) {
      let span = normalizeForCompare(m[0]).split(" ").filter((w) => w.length > 1);
      // Trim leading/trailing connector words so "The Complex Frauds..." (sentence start) and
      // "the Complex Frauds..." (mid-sentence) normalize to the SAME anchor key.
      while (span.length && CONNECT.has(span[0])) span = span.slice(1);
      while (span.length && CONNECT.has(span[span.length - 1])) span = span.slice(0, -1);
      if (span.length >= 3) out.push(span.join(" "));
    }
    return out;
  };
  const spanCounts = new Map<string, number[]>(); // span -> sentence indices
  flat.forEach((f, idx) => {
    if (remove.has(idx)) return;
    for (const span of new Set(properNounSpans(f.s))) {
      const arr = spanCounts.get(span) || [];
      arr.push(idx);
      spanCounts.set(span, arr);
    }
  });
  for (const [, occ] of spanCounts) {
    if (occ.length < 3) continue;
    const live = occ.filter((k) => !remove.has(k));
    if (live.length < 3) continue;
    const byLen = [...live].sort((a, b) => flat[b].s.length - flat[a].s.length);
    const keepArr = byLen.slice(0, 2);
    const keep = new Set(keepArr);
    for (const k of live) {
      if (keep.has(k)) { protectKeep.add(k); continue; }
      if (protectKeep.has(k)) continue;
      if (!cutEligible(k, keepArr)) continue; // long sentence with distinct content = leave it
      remove.add(k); cuts.push(`repetition (title): ${flat[k].s}`);
    }
  }

  for (const k of protectKeep) remove.delete(k); // an elaborated instance is never cut
  if (remove.size === 0) return { text: paras.join("\n\n"), cuts: [] };

  const rebuilt: string[] = [];
  paras.forEach((_, pi) => {
    const kept = flat.filter((f, idx) => f.p === pi && !remove.has(idx)).map((f) => f.s);
    if (kept.length) rebuilt.push(kept.join(" "));
  });
  return { text: rebuilt.join("\n\n"), cuts };
}

// GOVERNING PRINCIPLE — silent fix. Merge an ORPHANED sentence fragment back into its neighbor. A
// chunked build joins sections, and a modifier fragment can end up stranded as its own paragraph —
// the 20-min build produced a floating "Fifty-two years old." right after the hook and a stranded
// "Every single day." split from the "661,440 streams" it modifies. These are appositive/adverbial
// fragments (no finite verb) that read as broken when isolated. Only a paragraph that is EXACTLY one
// such short fragment is merged (into the previous paragraph, else the next), so a deliberate
// verbed one-line beat ("No human ever chose to play it.") is untouched.
const ORPHAN_FRAGMENT_RE = /^(?:[A-Za-z][\w-]*(?:[\s-][\w-]+)?\s+years?\s+old|every (?:single )?day|day after day|year after year|night after night|again and again|over and over|month after month|(?:for\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:years?|months?|weeks?|days?|decades?))\.?$/i;
export function mergeOrphanFragments(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const paras = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const isOrphan = (p: string) => {
    const parts = p.split(/(?<=[.!?])\s+/).filter(Boolean);
    return parts.length === 1 && ORPHAN_FRAGMENT_RE.test(parts[0].trim()) && parts[0].split(/\s+/).length <= 6;
  };
  const out: string[] = [];
  const cuts: string[] = [];
  for (const p of paras) {
    if (isOrphan(p) && out.length > 0) {
      out[out.length - 1] = `${out[out.length - 1]} ${p}`.replace(/\s+/g, " ").trim();
      cuts.push(p);
    } else {
      out.push(p);
    }
  }
  // A leading orphan (nothing before it) attaches to the paragraph that follows.
  if (out.length >= 2 && isOrphan(out[0])) {
    const merged = `${out[0]} ${out[1]}`.replace(/\s+/g, " ").trim();
    cuts.push(out[0]);
    out.splice(0, 2, merged);
  }
  return { text: out.join("\n\n"), cuts };
}

export function checkCompliance(input: ComplianceInput): ComplianceCheck[] {
  const out: ComplianceCheck[] = [];
  const script = input.fullScript || "";
  const total = words(script);
  const paras = script.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const opening = paras.slice(0, 2).join(" ");
  const closing = paras.slice(-3).join(" ");

  // 1) SECTION WEIGHTING — the peak scene must dominate. This is the check that would
  // have caught the flattened climax on every run.
  const sectionWords = (input.sections || []).map((s) => words(s?.content || "")).filter((n) => n > 0);
  if (sectionWords.length >= 3) {
    const sorted = [...sectionWords].sort((a, b) => b - a);
    const top = sorted[0];
    const median = sorted[Math.floor(sorted.length / 2)];
    const ratio = median > 0 ? top / median : 0;
    // Judge against the SOURCE video's own weighting when we measured it (a remix should
    // match the shape it copies), with a small tolerance; fall back to a generic 1.8x.
    const target = input.sourceWeightRatio && input.sourceWeightRatio > 1.2 ? input.sourceWeightRatio * 0.7 : 1.8;
    const vs = input.sourceWeightRatio && input.sourceWeightRatio > 1.2
      ? ` (the source video's peak runs ${input.sourceWeightRatio.toFixed(1)}x its median)`
      : "";
    out.push({
      id: "section-weighting", kind: "structure",
      label: "One section carries the weight",
      pass: ratio >= target,
      detail: ratio >= target
        ? `Longest section is ${ratio.toFixed(1)}x the median${vs} — the peak is carrying real weight.`
        : `Every section is about the same length (longest is only ${ratio.toFixed(1)}x the median)${vs}. The peak should dominate the way it does in the video you modeled this on; flat weighting is what makes a climax feel summarized.`,
    });
  } else {
    // Always emit, so the per-kind check set has a fixed size (a moving denominator makes
    // scores incomparable across runs). Not enough sections to measure is not a fault.
    out.push({
      id: "section-weighting", kind: "structure",
      label: "One section carries the weight",
      pass: true,
      detail: "Not enough sections to measure weighting.",
    });
  }

  // 2) QUOTE-LED HOOK — when the facts contain a usable quote, the cold open should
  // strongly consider it; a quote in the opening is the single strongest hook shape.
  // 1a) HOOK MATCHES THE SCRIPT. The hook field and the body used to be independent
  // generations, so the displayed hook and the script's actual opening could be two
  // different things — a mismatch a user sees immediately and the panel never caught.
  if (input.hook && input.hook.trim()) {
    const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const hookStart = norm(input.hook).split(" ").slice(0, 8).join(" ");
    const startsWithHook = !!hookStart && norm(script).startsWith(hookStart);
    out.push({
      id: "hook-matches-script", kind: "structure",
      label: "Script opens with its hook",
      pass: startsWithHook,
      detail: startsWithHook
        ? "The script begins with the hook shown above — one opening, not two."
        : "The hook and the script's first line are different openings. The viewer hears whichever one you record, so they must be the same text.",
    });
  }

  // 1b) HOOK ARCHETYPE — the source's opening type was extracted and displayed but never
  // verified. A remix that opens on a different archetype than the video it copies has
  // already broken the thing it promised to reproduce.
  const hookType = (input.sourceHookType || "").toLowerCase();
  const firstTwo = script.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  if (hookType) {
    const wantsStat = /stat|data|number|controvers|figure/.test(hookType);
    const wantsQuote = /quote|line|said/.test(hookType);
    const wantsScene = /media.?res|scene|story|cold.?open/.test(hookType);
    if (wantsStat) {
      // A stat/controversy hook is not "has a number". Its engine is a SUPERLATIVE claim
      // plus a STACKED COMPARISON, delivered short. Check the mechanics, not the category.
      const hasNum = /\d/.test(firstTwo);
      const hasSuperlative = /\b(most|least|worst|best|deadliest|biggest|largest|greatest|only|first|highest|more (?:\w+ )?than (?:any|every|all))\b|\b\w+est\b/i.test(firstTwo);
      const hasStackedComparison = /\b(?:more|less|bigger|greater|worse|deadlier) than\b[^.]*\b(?:and|plus|,)[^.]*\bcombined\b|\b(?:than|as much as)\b[^.]*\band\b[^.]*\bcombined\b/i.test(firstTwo);
      // Length: at most ~1.6x the source hook, or ~35 words when we don't have the source.
      const hookWords = words(firstTwo);
      const srcWords = input.sourceHookText ? words(input.sourceHookText) : 0;
      const lenCap = srcWords > 0 ? Math.max(30, Math.round(srcWords * 1.6)) : 35;
      const short = hookWords <= lenCap;
      // The ENGINE is a superlative claim; the PROOF is either a stacked comparison or a
      // concrete figure (Kurzgesagt's own hook has no digit — "more than X and Y
      // combined" carries it). Pass needs the superlative, some proof, and brevity.
      const strong = hasSuperlative && (hasStackedComparison || hasNum) && short;
      const missing: string[] = [];
      if (!hasSuperlative) missing.push("a superlative claim about the subject (\"the most…\", \"the deadliest…\") — this is the engine of the hook");
      if (hasSuperlative && !hasStackedComparison && !hasNum) missing.push("proof for the claim — a stacked comparison (\"more than X, Y and Z combined\") or the biggest documented figure");
      if (!short) missing.push(`brevity (it runs ${hookWords} words; the source's hook is ${srcWords || "~25"})`);
      out.push({
        id: "hook-archetype", kind: "structure",
        label: `Opens with a ${input.sourceHookType} hook, like the source`,
        pass: strong,
        detail: strong
          ? "The opening lands a figure with a superlative or stacked comparison, short — the source's actual hook shape."
          : `The source's ${input.sourceHookType} hook works through a superlative claim and a stacked comparison, delivered in a couple of sentences. This opening is missing: ${missing.join("; ")}.`,
      });
    } else if (wantsQuote) {
      out.push({
        id: "hook-archetype", kind: "structure",
        label: "Opens with a quote, like the source",
        pass: QUOTE_RE.test(firstTwo),
        detail: QUOTE_RE.test(firstTwo) ? "Real quoted speech opens the script, matching the source." : "The source opened on a quote; this script opens on narration.",
      });
    } else if (wantsScene) {
      const sceneish = /\b(is|are|stands?|sits?|walks?|holds?|presses?|opens?|steps?)\b/i.test(firstTwo);
      out.push({
        id: "hook-archetype", kind: "structure",
        label: "Opens mid-scene, like the source",
        pass: sceneish,
        detail: sceneish ? "The opening drops into a moment, matching the source's hook." : "The source opened mid-scene; this script opens on framing rather than an action.",
      });
    }
  }

  // 2) QUOTE-LED HOOK — only relevant when the SOURCE used a quote-led open. Firing it
  // whenever a quote exists in the facts pointed away from the correct fix on a video
  // whose source opened on a statistic.
  const factBlob = (input.facts || []).join(" ");
  const factQuote = /quote|line|said/.test(hookType) ? QUOTE_RE.exec(factBlob) : null;
  if (factQuote) {
    // The quote may be spoken in the cold open WITHOUT quotation marks ("You a cop?" as
    // a bare line is the strongest form), so match on the WORDS, not the punctuation.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const quoteText = norm(factQuote[1] || factQuote[2] || "");
    const openNorm = norm(opening);
    const qWords = quoteText.split(" ").filter(Boolean);
    // A 3-word run of the quote appearing in the opening counts as using it.
    const usesQuoteWords = qWords.length >= 3 && qWords.slice(0, Math.max(1, qWords.length - 2)).some((_, i) => openNorm.includes(qWords.slice(i, i + 3).join(" ")));
    const openHasQuote = QUOTE_RE.test(opening) || usesQuoteWords;
    out.push({
      id: "quote-hook", kind: "structure",
      label: "Opens on a real quote",
      pass: openHasQuote,
      detail: openHasQuote
        ? "The cold open uses a verbatim quote — the strongest available hook shape."
        : "Your research found a usable verbatim quote, but the script opens on narration. A real voice in the first line outperforms description.",
    });
  }

  // 3) OPEN LOOP EARLY — something explicitly deferred in the first ~30 seconds
  // (~75 spoken words), which is the #1 drop-off point.
  // Widened to 90 words: a cold-open loop often lands on the third or fourth sentence,
  // just past the old 80-word cut.
  const first75 = script.split(/\s+/).slice(0, 90).join(" ");
  // An open loop is a PROMISE the opening makes and does not yet keep. The original list
  // pattern-matched explicit deferrals ("we'll get there") and missed the way generated
  // scripts actually defer — SEMANTICALLY: they name a consequence, a cost, or a
  // mechanism they are about to reveal, without delivering it. All three of these are
  // real open loops the old check called missing:
  //   "going to cost the United States something it can never fully account for"
  //   "And it has a price tag. A very specific one."
  //   "What Smith actually built ... so let us go through exactly how it worked."
  // So the set now also matches those promissory shapes. This check is recall-biased on
  // purpose: a PASS means "a loop is present", which is the good state, so a slightly
  // loose match that occasionally passes a borderline opening is far better than the old
  // failure — flagging every script and training users to ignore the panel.
  const deferRe = new RegExp([
    // Explicit "later" deferrals (documentary shape)
    /we'?ll get (?:there|to that|to it)/.source,
    /more on that|come back to|return to that|later in this video|in a moment|in a second|shortly/.source,
    /first,? you have to|before (?:we|that|any of)|but (?:first|that'?s not)/.source,
    /hold (?:that|onto that|on to that)|keep that (?:in mind|number)|remember (?:that|this) (?:number|figure|word)/.source,
    // Promised-but-withheld specificity (explainer shape)
    /\ba (?:very )?specific one\b|\ban? (?:exact|precise|specific) (?:number|figure|amount|answer|one)\b/.source,
    /and (?:it|that) (?:has|comes with|hides|leaves|carries) a (?:price|cost|number|catch|secret|twist)/.source,
    /the (?:number|answer|reason|truth|story) (?:is |will |turns out |gets )?(?:stranger|weirder|worse|darker|smaller|bigger|more)/.source,
    /there'?s (?:a|one) (?:catch|cost|price|reason|number|twist|problem|question)\b/.source,
    // Promised CONSEQUENCE without the figure — a cost/loss named but not quantified
    /(?:going to|would|will|could) cost (?:\w+ ){0,4}(?:everything|something|more than)/.source,
    /something (?:it|they|he|she|we|you) (?:can|could|would|will|'?d)? ?(?:never|not) (?:fully |ever )?(?:account for|undo|repay|take back|get back|recover|escape|forget|come back from)/.source,
    /(?:pay|paid|paying) (?:for )?(?:it|that|this) (?:for years|later|dearly|eventually|in ways)/.source,
    // Promised MECHANISM REVEAL — "let me show you exactly how it worked"
    /(?:exactly |precisely |just )?how (?:it|this|that|he|she|they) (?:actually |really )?(?:worked|works|did it|pulled|happened|got|managed|fell apart)/.source,
    /(?:so )?let(?:'?s| us| me) (?:go|walk) (?:you )?through/.source,
    /(?:go|walk) (?:you )?through (?:exactly |precisely )?(?:how|what|why)/.source,
    /what (?:\w+ ){0,3}actually (?:built|did|found|discovered|happened|wanted|knew)/.source,
    /here'?s (?:exactly )?(?:what|how|why) (?:it|that|this|they|he|she)/.source,
  ].join("|"), "i");
  out.push({
    id: "early-loop", kind: "structure",
    label: "Open loop in the first 30 seconds",
    pass: deferRe.test(first75),
    detail: deferRe.test(first75)
      ? "An open loop is planted early, before the 30-second cliff."
      : "Nothing is explicitly deferred in the opening. Tease the payoff scene early and jump away from it — the 30-second mark is where viewers leave.",
  });

  // 4) CALLBACK — a real callback is a distinctive PHRASE from the cold open that
  // returns at the end WITHOUT having been repeated throughout. Matching single common
  // words produced nonsense ("returns to the opening (between, minutes)") because topic
  // words naturally recur everywhere; a bigram that skips the middle is actual evidence.
  const bigrams = (s: string) => {
    const w = (s.toLowerCase().match(/\b[a-z]{4,}\b/g) || []);
    const out2: string[] = [];
    for (let i = 0; i < w.length - 1; i++) out2.push(`${w[i]} ${w[i + 1]}`);
    return out2;
  };
  const middle = paras.slice(2, Math.max(2, paras.length - 3)).join(" ");
  const middleBigrams = new Set(bigrams(middle));
  const openBigrams = new Set(bigrams(opening));
  const callbacks = [...new Set(bigrams(closing).filter((b) => openBigrams.has(b) && !middleBigrams.has(b)))];
  out.push({
    id: "callback", kind: "structure",
    label: "Ending calls back to the opening",
    pass: callbacks.length >= 1,
    detail: callbacks.length >= 1
      ? `The ending returns to something planted in the opening ("${callbacks[0]}").`
      : "The ending does not visibly return to anything planted in the cold open. A callback is what produces the 'that came back' moment.",
  });

  // 5) LENGTH vs the target derived from the source video.
  if (input.targetWords && input.targetWords > 0) {
    // ±15%. The old check only caught scripts that were too SHORT, so a script 46% over
    // target passed as "matches" — and overrun is worse than shortfall here, because the
    // surplus is padding, and padding is where fabrication comes from.
    const pct = total / input.targetWords;
    const onTarget = pct >= 0.85 && pct <= 1.15;
    out.push({
      id: "length", kind: "structure",
      label: "Length matches your target",
      pass: onTarget,
      detail: onTarget
        ? `${total} words against a ${input.targetWords}-word target.`
        : pct < 0.85
          ? `${total} words against a ${input.targetWords}-word target — short by ${Math.round((1 - pct) * 100)}%.`
          : `${total} words against a ${input.targetWords}-word target — over by ${Math.round((pct - 1) * 100)}%. The surplus is usually padding, and padding is where unsupported claims get added to fill space.`,
    });
  } else {
    // Fixed-size check set: emit even without a target (e.g. when scoring the source
    // video, which defines its own length rather than matching one).
    out.push({
      id: "length", kind: "structure",
      label: "Length matches your target",
      pass: true,
      detail: "No word target set for this script.",
    });
  }

  // 5b) EXPLAINER FORM. A science explainer succeeds or fails on different moves than a
  // documentary, so judge it against those: a scale ladder, numbers made physical, the
  // viewer addressed directly, and no intent assigned to a system.
  const isExplainer = input.topicKind && input.topicKind !== "event";
  if (isExplainer) {
    // Scale ladder: at least two DISTINCT magnitudes referenced. Counts the magnitude
    // word itself, since scripts write "one million" as words as often as "1,000,000".
    const magnitudes = new Set(
      (script.match(/\b(?:hundred|thousand|million|billion|trillion)s?\b/gi) || []).map((m) => m.toLowerCase().replace(/s$/, ""))
    );
    // A digits-only ladder (150 → 5,000 → 300,000) also counts: distinct digit lengths.
    const digitScales = new Set(
      (script.match(/\b\d[\d,]{2,}\b/g) || []).map((n) => n.replace(/[^\d]/g, "").length)
    );
    const hasLadder = magnitudes.size >= 2 || digitScales.size >= 2 || (magnitudes.size >= 1 && digitScales.size >= 1);
    out.push({
      id: "scale-ladder", kind: "structure",
      label: "Climbs a scale ladder",
      pass: hasLadder,
      detail: hasLadder
        ? "The script steps the same mechanism up through different orders of magnitude."
        : "The idea is explained at one size only. Start at one unit the viewer can picture, then climb — the vertigo of scale is the explainer's main engine.",
    });
    // Numbers made physical: a comparison that converts a figure into something bodily.
    const physical = /\b(that'?s (?:about |roughly |the same as )?|equivalent to|the size of|enough to (?:fill|cover|stretch)|every (?:person|human) (?:in|on)|stacked|end to end|as (?:many|much) as)\b/i.test(script);
    out.push({
      id: "numbers-physical", kind: "structure",
      label: "Big numbers made physical",
      pass: physical,
      detail: physical
        ? "Figures are converted into something the viewer can picture."
        : "The numbers are stated but never made physical. A figure a viewer cannot picture does no work — convert it into a distance, a crowd, a stack, a span of time.",
    });
    // Direct address: "you" is the explainer's entry point.
    // Density, not a flat count, so the check means the same thing on a 300-word script
    // and a 2,000-word one: roughly one direct address per 200 words, minimum two.
    //
    // UNLESS the creator's voice forbids it. Some documentary voices never say "you",
    // and their profile says so explicitly. The creator's own style outranks the generic
    // explainer form — marking a correctly-voiced script wrong would train the user to
    // ignore the panel.
    const youCount = (script.match(/\byou(?:r|'re|'ve|'ll|'d)?\b/gi) || []).length;
    const youTarget = Math.max(2, Math.round(total / 200));
    if (!input.voiceProhibitions?.noSecondPerson) out.push({
      id: "direct-address", kind: "structure",
      label: "Speaks to the viewer",
      pass: youCount >= youTarget,
      detail: youCount >= youTarget
        ? "The script addresses the viewer directly, which is how an explainer creates stakes without a protagonist."
        : "The script rarely says \"you\". An explainer has no main character, so direct address is what makes an abstract idea personal.",
    });
    // Intent assigned to a system — the explainer version of naming a villain.
    const intentRe = /\b(?:the )?(?:algorithm|platform|app|system|technology|company|evolution|nature|market)s?\s+(?:wants?|decides?|chooses?|intends?|tries to|set out to|is designed to trick|deliberately)\b/i;
    const intent = intentRe.exec(script);
    out.push({
      id: "no-system-intent", kind: "accuracy",
      label: "No intent assigned to a system",
      pass: !intent,
      detail: intent
        ? `The script gives a system motives: "${intent[0]}". Mechanisms have effects, not intentions — describe how it works instead of what it wants.`
        : "Systems are described by how they work, not by what they supposedly want.",
    });
  }

  // 5c) GROUNDING — the only check that measures whether the script is TRUE to its
  // research rather than well-shaped. Every other check makes a script feel right; this
  // one makes it be right. Deterministic and high-precision: it compares the CHECKABLE
  // SPECIFICS (figures, percentages, money, years, durations) asserted in the script
  // against the ones the research actually supplied. A number in the script with no
  // counterpart in the facts is either invented or imported from memory, which is the
  // failure behind the fabricated auditor, the invented sentence lengths, and the
  // mismatched-population comparison.
  if ((input.facts || []).length > 0) {
    // UNIVERSAL, VOICE-INDEPENDENT figure check. Normalize the facts to numeric VALUES from
    // every rendering (digits, spelled out, abbreviated), then match the script's numbers on
    // value, not surface string — so the SAME figure passes whether the voice writes "8,091,843",
    // "eight million ninety one thousand eight hundred forty three", or "$8M", and a genuinely
    // invented number still fails in any of those forms.
    const factNums = allNumberValues(factBlob);
    const factLc = factBlob.toLowerCase();
    const isSupported = (v: number) => factNums.some((f) => numbersMatch(v, f));
    const unsupported: { text: string; num: string }[] = [];
    // Digit / abbreviated numbers in the script.
    for (const d of digitNumbersIn(script)) {
      // Only judge SPECIFICS: large, decimal, or unit/currency-bearing. Bare small integers
      // ("3 ways", "two") are narration, not claims.
      const checkable = d.unit || Math.floor(d.value) >= 100 || !Number.isInteger(d.value);
      if (!checkable || isSupported(d.value)) continue;
      unsupported.push({ text: d.surface, num: String(d.value) });
    }
    // Spelled-out numbers in the script, parsed as WHOLE phrases (this is what kills the
    // fragmentation false-positive where "six hundred ... four hundred forty" got chopped).
    for (const s of spelledNumbersIn(script)) {
      if (Math.floor(s.value) < 100 || isSupported(s.value)) continue; // small spelled counts are narration
      unsupported.push({ text: s.surface, num: String(s.value) });
    }

    // PROPORTION CLAIMS. "more than half", "the majority", "most of them" are unfalsifiable
    // shapes that get a video fact-checked, and they carry NO digit so the number scan is
    // blind to them. A proportion claim is unsupported unless the facts contain some
    // proportion language of their own.
    const propRe = /\b(more than half|over half|less than half|the majority(?: of)?|most of (?:them|us|people|the time|those)|half of (?:them|us|people|all)|two[ -]thirds|a third of|three[ -]quarters|nine in ten|eight in ten|the vast majority)\b/gi;
    const factHasProportion = /%|percent|majority|half|third|quarter|fraction|\bin ten\b|most of|proportion|ratio/i.test(factLc);
    if (!factHasProportion) {
      const props = [...new Set([...script.matchAll(propRe)].map((m) => m[0].toLowerCase()))];
      for (const p of props) unsupported.push({ text: p, num: p });
    }

    const uniq = Array.from(new Map(unsupported.map((s) => [s.num.toLowerCase(), s])).values());
    out.push({
      id: "grounding", kind: "accuracy",
      label: "Every figure and quantity is in your facts",
      pass: uniq.length === 0,
      detail: uniq.length === 0
        ? "Every checkable figure, number and quantity in the script appears in your sourced facts. (Non-numeric claims like a named mechanism are checked by the deeper claim check.)"
        : `${uniq.length} figure${uniq.length === 1 ? "" : "s"}/quantit${uniq.length === 1 ? "y" : "ies"} in the script ${uniq.length === 1 ? "has" : "have"} no counterpart in your facts: ${uniq.slice(0, 6).map((u) => `"${u.text}"`).join(", ")}. Each is either invented or recalled from memory — check it before publishing.`,
    });

    // MOVE #6(3) — HEADING CLAIM-CHECK. A section HEADING is the first claim a viewer reads and
    // the one they repeat, so an unsupported number there is worse than one buried in the body.
    // The body grounding above missed a heading like "The bot army that streams 661k songs daily"
    // when 661k was never in the facts — it leaked from memory. Check each heading's figures
    // against the facts directly.
    const headingMiss: string[] = [];
    for (const s of input.sections || []) {
      const title = (s?.title || "").trim();
      if (!title) continue;
      // Same voice-independent matcher as the body figure check ("661k" heading matches a
      // "661,440" fact; a made-up "9,000,000" heading does not).
      for (const d of digitNumbersIn(title)) {
        if (Math.floor(d.value) < 10 || isSupported(d.value)) continue; // small counts are narration
        headingMiss.push(d.surface);
      }
      for (const s of spelledNumbersIn(title)) {
        if (Math.floor(s.value) < 10 || isSupported(s.value)) continue;
        headingMiss.push(s.surface);
      }
    }
    const uniqHeadings = [...new Set(headingMiss)].slice(0, 6);
    out.push({
      id: "heading-grounding", kind: "accuracy",
      label: "Section headings are backed by your facts",
      pass: uniqHeadings.length === 0,
      detail: uniqHeadings.length === 0
        ? "Every figure in a section heading traces to your sourced facts."
        : `A section heading states ${uniqHeadings.map((h) => `"${h}"`).join(", ")}, which your facts do not support. A heading is the first claim a viewer reads; fix or cut that number before publishing.`,
    });

    // MOVE #7 — QUOTE GROUNDING. A verbatim quotation is the strongest researched texture AND
    // the most dangerous to fake: a viewer takes it as the subject's actual words. So a quoted
    // line in the script must trace to a real sourced quote in the facts, never be invented or
    // paraphrased into quotation marks. Flag a quoted span with no match in the facts.
    const normQ = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const factNorm = normQ(factBlob);
    const quoteMiss: string[] = [];
    for (const m of script.matchAll(/["“]([^"”\n]{20,200})["”]/g)) {
      const q = m[1].trim();
      const nq = normQ(q);
      if (nq.length < 16) continue;
      // A genuine quote shares a solid run with its fact even if trimmed; probe both ends.
      if (!factNorm.includes(nq.slice(0, 24)) && !factNorm.includes(nq.slice(-24))) quoteMiss.push(q.slice(0, 60));
    }
    const uniqQuotes = [...new Set(quoteMiss)].slice(0, 5);
    out.push({
      id: "quote-grounding", kind: "accuracy",
      label: "Every quoted line traces to your facts",
      pass: uniqQuotes.length === 0,
      detail: uniqQuotes.length === 0
        ? "Every verbatim quotation in the script matches a sourced quote in your facts."
        : `${uniqQuotes.length} quoted line${uniqQuotes.length === 1 ? "" : "s"} in the script ${uniqQuotes.length === 1 ? "does" : "do"} not match a sourced quote in your facts: ${uniqQuotes.map((q) => `"${q}…"`).join(", ")}. A quote must be real and sourced, never invented or paraphrased into quotation marks. Trace it to a source or remove the quotation marks.`,
    });
  }

  // 5f) REPETITION / PADDING. A thin fact set stretched to a fixed length says everything
  // twice — the $135 billion four times, the mechanism explained in near-identical
  // paragraphs. It is the fact-sufficiency problem surfacing as padding rather than
  // fabrication, and a viewer feels it. Flag a distinctive figure that recurs too often.
  {
    const figureCounts = new Map<string, number>();
    for (const m of script.matchAll(/(?:[$£€]\s?)?\d[\d,.]*\s*(?:billion|million|thousand|percent|%|dollars|hours?|minutes?)/gi)) {
      const key = m[0].toLowerCase().replace(/[\s,]/g, "");
      figureCounts.set(key, (figureCounts.get(key) || 0) + 1);
    }
    const overused = [...figureCounts.entries()].filter(([, n]) => n >= 4).map(([k]) => k);

    // CONCEPTUAL REPETITION — the more common padding, and invisible to the figure count.
    // A whole explanation restated a few hundred words later (the receptor mechanism
    // explained twice) is the real tell of a thin fact set stretched to length. Compare
    // non-adjacent paragraphs on their distinctive content words; high overlap = the same
    // passage twice.
    const STOP = new Set(["about","after","again","because","before","being","between","could","every","first","really","should","something","that","their","there","these","those","through","which","while","would","actually","different","happens","system","people","around"]);
    const contentSet = (p: string) => new Set((p.toLowerCase().match(/\b[a-z]{6,}\b/g) || []).filter((w) => !STOP.has(w)));
    const bigParas = paras.map((p, idx) => ({ text: p, idx, set: contentSet(p) })).filter((p) => p.set.size >= 10);
    let repeatPair: [string, string] | null = null;
    for (let i = 0; i < bigParas.length && !repeatPair; i++) {
      for (let j = i + 1; j < bigParas.length; j++) {
        if (bigParas[j].idx - bigParas[i].idx < 2) continue; // must be non-adjacent in the ORIGINAL script
        const a = bigParas[i].set, b = bigParas[j].set;
        const shared = [...a].filter((w) => b.has(w)).length;
        const jaccard = shared / (new Set([...a, ...b]).size || 1);
        if (jaccard >= 0.5) { repeatPair = [bigParas[i].text, bigParas[j].text]; break; }
      }
    }

    // REPEATED DISTINCTIVE LINE/QUOTE — a memorable sentence (a quoted email, a signature line)
    // restated near-verbatim to fill space (the Feb 2024 email quoted 2-3x). Key each long
    // sentence on its sorted distinctive content words, so a lightly-reworded restatement still
    // collides; a distinctive line appearing 2+ times is padding.
    const lineIdx = new Map<string, number[]>();
    script.split(/(?<=[.!?])\s+/).forEach((sent, i) => {
      const norm = sent.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
      if (norm.split(" ").filter(Boolean).length < 8) return;
      const key = [...new Set(norm.match(/\b[a-z]{5,}\b/g) || [])].sort().join(" ");
      if (key.split(" ").filter(Boolean).length < 5) return;
      const arr = lineIdx.get(key) || []; arr.push(i); lineIdx.set(key, arr);
    });
    // A restated line is one that recurs at NON-ADJACENT points (spread across the script, like a
    // quote used in two sections) — not the same sentence repeated consecutively to bulk a
    // paragraph. Require a gap of >=2 between two occurrences.
    const restatedLine = [...lineIdx.values()].some((idxs) => {
      for (let k = 1; k < idxs.length; k++) if (idxs[k] - idxs[k - 1] >= 2) return true;
      return false;
    });

    const padded = overused.length > 0 || !!repeatPair || restatedLine;
    if (figureCounts.size > 0 || bigParas.length >= 2 || restatedLine) {
      out.push({
        id: "repetition", kind: "structure",
        label: "Nothing is repeated as padding",
        pass: !padded,
        detail: !padded
          ? "No figure or explanation is restated to fill space."
          : repeatPair
            ? `An explanation appears twice, a few paragraphs apart ("${repeatPair[0].slice(0, 60)}…" and "${repeatPair[1].slice(0, 60)}…"). That is a thin fact set stretched to length — cut the second telling or add material.`
            : restatedLine && !overused.length
              ? "A distinctive line or quote is restated near-verbatim more than once. Say it once, in its strongest place, then move to different material."
              : `A figure appears 4+ times (${overused.slice(0, 3).join(", ")}). The script is leaning on the same number to fill space. Add facts or let it come in shorter.`,
      });
    }
  }

  // 5d) VOICE — the stock narrator constructions that appeared in every script this
  // session regardless of which voice profile was selected. They belong to no creator,
  // and they are the fastest way an audience senses the voice is not the channel's.
  for (const vc of voiceChecks(script)) {
    out.push({ id: vc.id, kind: "structure", label: vc.label, pass: vc.pass, detail: vc.detail });
  }

  // 5e) INVENTED ASSETS. A voice profile's "CTA style" describes the channel it was
  // measured from — Kurzgesagt weaves in products, Brew thanks patrons mid-video. The
  // creator writing THIS script may have none of those, and a script that thanks
  // non-existent patrons or names a sponsor that was never sold is a fabrication the
  // creator publishes under their own name.
  const assetRe = /\b(patreon|discord|our patrons|this video'?s sponsor|sponsored by|use code|promo code|our merch|merch store|the link in the description to buy|our newsletter|our course|join our community)\b/i;
  const asset = assetRe.exec(script);
  out.push({
    id: "invented-assets", kind: "accuracy",
    label: "No invented sponsors or communities",
    pass: !asset,
    detail: asset
      ? `The script references "${asset[0]}" — an asset that was never supplied. Voice profiles describe how a channel does its CTA, not what you sell. Remove it unless you actually have one.`
      : "The script doesn't reference a sponsor, Patreon, or community that wasn't supplied.",
  });

  // 5g) IMPLIED-FACT CLIFFHANGER (Move #8's new risk). Move #8 lets the writer expand a sourced
  // fact into narrative. The failure it introduces is INVENTED IMPLICATION, not an invented fact:
  // every sentence traces to a source, but the FRAMING promises a revelation the facts don't
  // contain — "what investigators found was not what anyone expected", ending on a teased
  // money-trail twist that doesn't exist. The claim check passes it because no single sentence is
  // false. A teased loop must RESOLVE on a real sourced fact, or not be opened — so flag a
  // revelation-tease that lands in the CLOSING (an unresolved cliffhanger the script ends on).
  const teaseRe = /\b(not what (?:anyone|everyone|you|they|the world|the public)\s*(?:had\s*)?(?:ever\s*)?expected|what (?:investigators|prosecutors|authorities|agents|they|the fbi|the doj)\s+(?:found|discovered|uncovered|learned|traced)[^.]{0,90}(?:was|were|would|is)\b|the truth (?:was|turned out|is)\s+(?:far\s+)?(?:stranger|worse|darker|more|nothing like)|(?:far\s+)?(?:stranger|darker|worse)\s+than (?:anyone|fiction|expected|imagined)|wasn'?t what it seemed|the real (?:story|reason|truth)\b[^.]{0,40}\b(?:was|is|would|only now)|only the beginning|would (?:change|reveal) everything|the (?:biggest|real) (?:twist|secret|surprise|question)\b)/i;
  const tease = teaseRe.exec(closing);
  out.push({
    id: "implied-revelation", kind: "accuracy",
    label: "No teased revelation the facts don't deliver",
    pass: !tease,
    detail: tease
      ? `The ending implies a revelation the facts may not support: "${tease[0].trim()}". This is invented IMPLICATION — every sentence can be sourced while the framing promises a payoff that isn't in the material. Resolve the tease on a real sourced fact (a figure, a name, the documented outcome), or cut the framing. Don't end on a cliffhanger the evidence doesn't pay off.`
      : "The ending doesn't tease a revelation the facts don't deliver.",
  });

  // 5h) PERSON-INSINUATION — HARD GUARD (defamation risk). The dramatic-craft push can build an
  // unsupported ARGUMENT that a real, named, living or uncharged person KNEW, benefited knowingly,
  // or was complicit — from only a contract or a credit. Skripr won't fabricate a fact; it must
  // equally not fabricate an implication about a real person. This deterministic backstop flags
  // the LANGUAGE of insinuated guilt/knowledge so it is caught even when the on-demand semantic
  // (culpability) check hasn't run. Report-not-block, but HARD: rewrite or cut, not a stylistic
  // choice. (A CHARGED/CONVICTED person the facts name is fair game; the risk is implying more
  // about someone the record does not.)
  const insin = INSINUATION_RE.exec(script);
  out.push({
    id: "person-insinuation", kind: "accuracy",
    label: "No implied guilt of a real person beyond the facts",
    pass: !insin,
    detail: insin
      ? `The script uses insinuation language: "${insin[0].trim()}". If this implies the knowledge, complicity, or guilt of a NAMED living or uncharged person beyond what your facts establish, it is a defamation risk — rewrite or cut it, this is not optional. State only the documented outcome about a real person; never imply more. (Someone the facts say was charged or convicted is fair game.)`
      : "The script doesn't insinuate a real person's guilt beyond the documented facts.",
  });

  // 6) SOURCING LEAK — the narrator talking about the evidence instead of the story.
  const leakRe = /\b(what the (?:facts|record|sources) (?:establish|show|say)|that'?s the sourced version|according to the facts|what is documented|the sources (?:don'?t|do not) say|isn'?t something that gets cleaner)\b/i;
  const leak = leakRe.exec(script);
  out.push({
    id: "sourcing-leak", kind: "accuracy",
    label: "No sourcing language in the narration",
    pass: !leak,
    detail: leak ? `The narrator talks about the research: "${leak[0]}". Stay inside the story and write around the gap.` : "The narration never steps outside the story to discuss sources.",
  });

  // 6b) SOURCE CONTENT LEAK — the Remixer must reproduce the source's STRUCTURE, never its
  // CONTENT. A distinctive term from the source video's own story (Nike, Memphis, shipping
  // labels, raids) that surfaces in a remix on a different topic is copied content — the
  // one thing the feature must never do. It is only a leak when the user's OWN facts don't
  // contain the term; a fact that names it makes it legitimately theirs.
  if ((input.sourceEntities || []).length > 0) {
    const factLc = factBlob.toLowerCase();
    const scriptLc = script.toLowerCase();
    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const leaked: string[] = [];
    for (const raw of input.sourceEntities!) {
      const term = String(raw || "").trim();
      if (term.length < 3) continue;
      const tl = term.toLowerCase();
      const re = new RegExp(`(?:^|[^a-z0-9])${escapeRe(tl)}(?:[^a-z0-9]|$)`, "i");
      if (!re.test(scriptLc)) continue;
      // A term is NOT a leak when it is independently TRUE of the current case — i.e. it (or a
      // significant word of it) appears in the FACTS. "federal indictment" is not copied from the
      // source just because the source also had one: Michael Smith genuinely had a federal
      // indictment, and it's in the facts. Only flag a term the current case's facts don't carry.
      const tokens = tl.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
      const supportedByFacts = factLc.includes(tl) || tokens.some((w) => factLc.includes(w));
      if (!supportedByFacts) leaked.push(term);
    }
    const uniqLeak = [...new Set(leaked)].slice(0, 8);
    out.push({
      id: "source-leak", kind: "accuracy",
      label: "No content copied from the source video",
      pass: uniqLeak.length === 0,
      detail: uniqLeak.length === 0
        ? "The remix borrows the source's structure, not its story — no source-specific names, places, or objects leaked in."
        : `These belong to the source video's story, not your topic, and aren't in your facts: ${uniqLeak.join(", ")}. The Remixer copies structure, never content — cut them, or add a fact that supports them.`,
    });
  }

  // 6c) STALE DATE — a pending event whose date has already passed. "Sentencing scheduled
  // for July 29, 2026" shipped in a script generated after that date. Fires only on a
  // FUTURE-FRAMED date ("scheduled for", "set for", "will be sentenced on") that is now in
  // the past, so a normal past-tense historical date never trips it.
  {
    const now = input.now ?? Date.now();
    const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
    // Match a future-framed date at DAY granularity ("July 29, 2026", "7/29/2026") OR MONTH
    // granularity ("July 2026") — the month-level form was being missed.
    const frameRe = new RegExp(
      `\\b(?:scheduled|set|slated|due|expected|awaiting|pending|upcoming|will (?:be )?(?:sentenc|appear|stand trial|face|go on trial)\\w*)\\b[^.]{0,50}?` +
      `(${MONTH}\\.?\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}/\\d{1,2}/\\d{4}|${MONTH}\\.?\\s+\\d{4})`,
      "gi",
    );
    const monthYearRe = new RegExp(`^${MONTH}\\.?\\s+\\d{4}$`, "i");
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const stale: string[] = [];
    for (const m of script.matchAll(frameRe)) {
      const raw = m[1].replace(/(\d)(st|nd|rd|th)/, "$1").trim();
      let when: number;
      if (monthYearRe.test(raw)) {
        // Month-only date: stale only once the WHOLE month has passed, so a partial current
        // month is not wrongly flagged. Compare against the END of that month.
        const first = new Date(Date.parse(raw));
        when = Number.isNaN(first.getTime()) ? NaN : new Date(first.getFullYear(), first.getMonth() + 1, 0, 23, 59, 59).getTime();
      } else {
        when = Date.parse(raw);
      }
      if (!Number.isNaN(when) && when < todayStart.getTime()) stale.push(m[1]);
    }
    const uniqStale = [...new Set(stale)].slice(0, 5);
    out.push({
      id: "stale-date", kind: "accuracy",
      label: "No pending date that has already passed",
      pass: uniqStale.length === 0,
      detail: uniqStale.length === 0
        ? "No upcoming-event date in the script has already passed."
        : `The script presents ${uniqStale.map((d) => `"${d}"`).join(", ")} as still upcoming, but that date has already passed. Update the outcome or remove the date before publishing.`,
    });
  }

  // 7) CLOSING DISCIPLINE — the script should stop on its strongest beat, not explain
  // it. A quote in the final stretch followed by lots of prose is the leak.
  const lastPara = paras[paras.length - 1] || "";
  const quoteInClose = QUOTE_RE.exec(closing);
  if (quoteInClose) {
    const afterQuote = closing.slice((quoteInClose.index ?? 0) + quoteInClose[0].length);
    const trailing = words(afterQuote);
    out.push({
      id: "ends-on-line", kind: "structure",
      label: "Stops on its strongest line",
      pass: trailing <= 25,
      detail: trailing <= 25
        ? "The script ends on the quote without explaining it."
        : `About ${trailing} words follow the closing quote. Every sentence after your best line is weaker than it — cut to the quote and stop.`,
    });
  } else if (lastPara) {
    out.push({
      id: "ends-on-line", kind: "structure",
      label: "Stops on its strongest line",
      pass: words(lastPara) <= 60,
      detail: words(lastPara) <= 60 ? "The script closes tightly." : "The final block runs long. A closing beat lands hardest when it is short.",
    });
  }

  return out;
}

export function complianceScore(checks: ComplianceCheck[]): { passed: number; total: number } {
  return { passed: checks.filter((c) => c.pass).length, total: checks.length };
}

// ————————————————————————————————————————————————————————————————————————
// FIDELITY SCORING.
//
// Two problems this solves. (1) The headline count used to be `checks.length`, which
// moved run to run — quote-hook only appeared when a quote existed, explainer checks
// only on explainers, voice checks varied by profile — so 8/11 one run and 6/9 the next
// were not comparable and a user could not tell whether they were improving. (2) The
// panel implied an 11/11 target nobody can hit, when the honest target is "as close to
// the source video as the source itself scores". So the headline is now a FIXED per-kind
// STRUCTURAL set, scored against the same set on the SOURCE transcript: "you 5/6 · source
// 6/6". Any check the source itself fails is a check measuring preference, not what works.
//
// Accuracy checks (grounding, invented assets, sourcing leaks) are NOT in this score —
// they are a separate always-on safety row. You cannot ask "does the source video match
// YOUR facts", so they are not a fidelity measure; they are a publish-safety gate.
export type ScoreKind = "event" | "explainer";
export function scoreKindOf(k?: string): ScoreKind {
  return k && k !== "event" ? "explainer" : "event";
}

// The pinned structural set per kind. Every id here is emitted on every run (the
// conditional checks above degrade to a passing "not measured" rather than vanishing),
// so the denominator is fixed for a given kind + voice. Members omitted only when a voice
// prohibition removes them (e.g. a no-"you" documentary voice drops direct-address), and
// then they are removed for BOTH the script and the source, so the comparison stays fair.
export const STRUCTURAL_SET: Record<ScoreKind, string[]> = {
  event: ["section-weighting", "early-loop", "callback", "length", "ends-on-line"],
  explainer: ["section-weighting", "early-loop", "callback", "length", "ends-on-line", "scale-ladder", "numbers-physical", "direct-address"],
};

// Checks the SOURCE trivially satisfies because they are defined relative to itself: it
// matches its own length, and (with no per-section text to measure) its own weighting.
// Forced to pass for the source so its score reflects only the checks that are real
// signal — open loop, callback, closing discipline, the explainer moves.
const SOURCE_SELF_REFERENTIAL = new Set(["length", "section-weighting"]);

// Score over the fixed per-kind structural set only.
export function structuralScore(checks: ComplianceCheck[], kind?: string): { passed: number; total: number; items: ComplianceCheck[] } {
  const set = STRUCTURAL_SET[scoreKindOf(kind)];
  const items = set.map((id) => checks.find((c) => c.id === id)).filter((c): c is ComplianceCheck => !!c);
  return { passed: items.filter((c) => c.pass).length, total: items.length, items };
}

// The always-on publish-safety checks, shown separately from the fidelity score.
export function accuracyChecks(checks: ComplianceCheck[]): ComplianceCheck[] {
  return checks.filter((c) => c.kind === "accuracy");
}

// Run the same structural checks on the SOURCE video's transcript, so the panel can show
// "the source scores this too". No target and no facts: the source defines its own length
// and is not being graded against the user's research.
export function checkSourceStructural(input: {
  sourceText: string;
  topicKind?: string;
  sourceHookType?: string;
  voiceProhibitions?: ComplianceInput["voiceProhibitions"];
}): ComplianceCheck[] {
  const checks = checkCompliance({
    fullScript: input.sourceText || "",
    topicKind: input.topicKind as ComplianceInput["topicKind"],
    sourceHookType: input.sourceHookType,
    voiceProhibitions: input.voiceProhibitions,
  });
  for (const c of checks) if (SOURCE_SELF_REFERENTIAL.has(c.id)) c.pass = true;
  return checks;
}
