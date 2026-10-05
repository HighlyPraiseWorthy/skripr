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

// ABBREVIATION-AWARE sentence split. A period inside "U.S.", "Mr.", or an initial ("Damian A.") is
// NOT a sentence boundary — the naive /(?<=[.!?])\s+/ split treated it as one, so a silent cut that
// removed the real sentence ("Former U.S. Attorney Damian Williams said X.") left an orphan fragment
// ("Former U.S."). This merges a fragment ending in a known abbreviation back into the next piece,
// so every cut is SENTENCE-ATOMIC — a strip removes a whole sentence, never a dangling clause.
const _ABBR_TAIL = /(?:\b(?:U\.S|U\.K|U\.N|E\.U|D\.C|Mr|Mrs|Ms|Dr|Jr|Sr|St|Inc|Corp|Ltd|Co|vs|etc|No|Nos|Vol|Sen|Rep|Gov|Gen|Lt|Col|Sgt|Adm|Rev|Hon|Prof|Ave|Blvd|Dept|a\.m|p\.m|Pub|Stat|Cong|Sess|Reg|art|sec|§|Cr|Cir|v)\.|\b[A-Z]\.)["'”’)\]]?\s*$/;
export function splitSentences(text: string): string[] {
  const rough = (text || "").split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  for (const s of rough) {
    if (out.length && _ABBR_TAIL.test(out[out.length - 1])) out[out.length - 1] = `${out[out.length - 1]} ${s}`;
    else out.push(s);
  }
  return out;
}

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
    const kept = splitSentences(p).filter((s) => {
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
// The name a matching sentence equates to a designation (RE_A: name is group 1; RE_B: name is group 1).
function equatedName(s: string): string | null {
  const clean = (n: string) => n.replace(/[.\s]+$/, "").trim(); // _NAME can capture a trailing period
  const a = (s || "").match(UNNAMED_ID_RE_A); if (a && a[1]) return clean(a[1]);
  const b = (s || "").match(UNNAMED_ID_RE_B); if (b && b[1]) return clean(b[1]);
  return null;
}
// The PRIMARY subject of the story: the proper name that recurs most and co-occurs with a charge/
// conviction verb. A public, charged/convicted person (Michael Smith pleaded guilty) is NOT an
// "unnamed party" — describing them is not insinuation — so the person-id guard must EXEMPT them.
export function primarySubjectName(facts: string | undefined): string | null {
  if (!facts) return null;
  const CHARGE = /\b(?:pleaded? guilty|plead(?:ed)? guilty|convicted|indicted|charged|sentenced|arrested|found guilty)\b/i;
  const counts = new Map<string, number>();
  for (const m of facts.matchAll(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g)) counts.set(m[0], (counts.get(m[0]) || 0) + 1);
  let best: string | null = null, bestScore = 0;
  for (const [name, n] of counts) {
    // require the name to sit near a charge verb at least once, and score by frequency
    const near = [...facts.matchAll(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"))]
      .some((mm) => CHARGE.test(facts.slice(Math.max(0, (mm.index || 0) - 60), (mm.index || 0) + 60)));
    if (near && n > bestScore) { best = name; bestScore = n; }
  }
  return best;
}
export function stripUnnamedPartyNaming(text: string, exemptName?: string | null): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  const exempt = (exemptName || "").trim().toLowerCase();
  const outParas = text.split(/\n\n+/).map((p) => {
    const kept = splitSentences(p).filter((s) => {
      if (namesAnUnnamedParty(s)) {
        // EXEMPT the primary charged/convicted subject — equating a designation to the public
        // defendant (or a sentence that merely mentions them) is not the defamation this guard is for.
        const name = equatedName(s);
        if (exempt && name && name.toLowerCase() === exempt) return true;
        cuts.push(s.trim()); return false;
      }
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
//
// CALIBRATION (Anton's call, 2026-09, ChatGPT-endorsed at the 8.45 re-score): the guard cuts
// FABRICATIONS and DIRECT CONTRADICTIONS of the record — never reasonable narrative inference or
// dramatic framing grounded in evidence. "The system's neutrality was its vulnerability" and "the
// royalty system doesn't ask where a stream came from" STAY (grounded framing, keeps the retention
// punch); "nobody noticed for seven years" GOES (a documented contradiction: 2018/2019 warnings +
// the 2023 halt). When in doubt, keep the punch — the line is fabrication/contradiction, not drama.
export const SPECULATION_RE = /\b((?:must|would|could|had to) have (?:been|required|involved|known|meant|taken|needed|had|coordinated|demanded)|had to have (?:been|required|involved|meant|known|taken)|which (?:can|could) only mean|could only (?:have )?mean(?:t)?(?:\s+(?:one thing|that))?|(?:did(?:n'?t| not)|could(?:n'?t| not) have|had(?:n'?t| not)) (?:do|done|build|built|run|ran|orchestrate|orchestrated|pull off|pulled off|manage|managed|create|created|mastermind|masterminded|set up|pull|pulled|act|acted|operate|operated)[^.]{0,40}?\b(?:alone|on (?:his|her|their) own|by (?:him|her|them)\s?self|single-handedly|without help)\b|\bwas the entire (?:business|scheme|point|story|operation|game|plan|thing|fraud)\b|(?:points to|all but confirms|is clear evidence of|strongly (?:implies|suggests)|can only be explained by)\b|(?:sealed (?:cooperation|plea|deal)|an? ongoing investigation|a cooperating (?:witness|deal)|cooperation deal|a plea deal)[^.]{0,60}\bor both\b|the (?:most likely|only plausible) (?:explanation|reason|scenario) is|(?:nobody|no one|not (?:one|a single) (?:person|executive|analyst|investigator))[^.]{0,40}\b(?:could (?:explain|say|agree|figure out|account for|tell)|knew|noticed|understood|had (?:an? )?answer)|(?:no one|nobody|few people|not everyone)[^.]{0,30}\b(?:in the (?:industry|business|company)|at the (?:platforms?|labels?|company))[^.]{0,30}\b(?:could|knew|agreed|understood|noticed)|(?:was|were) (?:treated as|considered|thought to be|assumed) (?:essentially |basically |all but )?(?:airtight|foolproof|impossible|unbeatable|bulletproof)|(?:the (?:royalty pools?|numbers?|books?|figures?)) (?:just |simply |never )?(?:did(?:n'?t| not) add up|made no sense)|indistinguishable from (?:a |real |an actual )?(?:real |human )?(?:listener|listening|person|user|artist|human)|(?:completely |entirely |totally |essentially )?invisible (?:from the outside|to (?:everyone|anyone|the platforms?|detection)|the whole time)|(?:completely |entirely |essentially )?undetectable|(?:largely|completely|entirely|totally) uninterrupted|never (?:once )?(?:verified|audited|checked|flagged|questioned|caught|detected)|(?:nobody|no one) (?:ever )?(?:audits?|verifies|verified|checks?|checked|knew|noticed|questioned|caught it)|(?:every|each) (?:single )?(?:registration|stream|account|song|upload|play)[^.]{0,25}?(?:converted|became|turned into|generated|counted as)|(?:almost |virtually )?none of (?:them|the (?:listeners?|streams?|plays?|accounts?)) (?:were|was) (?:real|human|legitimate|genuine)|went (?:largely |completely |entirely )?unnoticed|for (?:almost |nearly |over |more than )?[\w-]+ years,?\s+(?:nobody|no one|it (?:went|stayed|kept)|nothing)\b|(?:nobody|no one) (?:ever )?(?:noticed|caught on|raised a flag|said a word|stepped in)|rumors?\b[^.]{0,20}?(?:circulat\w+|swirl\w+|spread\w*|flying|abound\w*)|industry insiders?\b|(?:law enforcement|authorities|investigators|regulators|the government|officials) (?:stayed|remained|kept|went) (?:completely |entirely |totally |largely )?(?:silent|quiet|in the dark)|(?:people|everyone|many|some) (?:were|was) (?:saying|whispering|talking about)|(?:it was |it became )?widely (?:known|believed|suspected|rumored|assumed)|(?:authorities|investigators|prosecutors|officials) (?:suspected|believed|assumed|were aware)\b(?![^.]{0,30}\b(?:said|charged|alleged|stated|according))|word (?:spread|got around|on the street)|not (?:a |one )?single [\w ]{0,45}?(?:flagged|detected|caught|noticed|questioned|audited|stopped|stepped in)|the (?:answer|truth|number|scale|reality|real (?:figure|number|answer)) (?:was|is|turned out to be|went) [\w-]+ times (?:further|farther|larger|bigger|deeper|greater|worse|higher|more)|money (?:that )?(?:had )?(?:already )?(?:moved|flowed|vanished|disappeared)[^.]{0,45}?(?:forfeiture|order|could(?:n'?t| not)|beyond|reach|recover)|the forfeiture (?:order |judgment )?(?:could|can|would)(?:n'?t| not)? (?:not )?(?:fully |ever )?(?:reach|recover|touch|account for|capture|claw back)|sealed (?:portions?|records?|documents?|filings?|parts?|sections?)[^.]{0,35}?(?:cover|hide|conceal|contain|point to|suggest|hint|mean|protect)|(?:no|not a)\s+(?:public\s+)?(?:court\s+)?(?:filing|record|document)[^.]{0,25}?(?:has |ever )?explain\w*|where (?:did|does|do|has)\s+(?:the |that |all )?(?:remaining |other |missing )?[^.]{0,30}?\b(?:go|gone|end up|disappear)|(?:a )?(?:gap|discrepancy|difference) of [^.]{0,30}?(?:remains? )?(?:unexplained|unaccounted|never explained|a mystery)|(?:largely,?\s+|completely,?\s+|entirely,?\s+|mostly,?\s+)?undetected,?\s+for (?:years|[\w-]+ years)|(?:running|operating|hiding|hidden|out)(?:,\s*[\w ]{0,30})? in plain sight|for years,?\s+undetected)\b/i;
export function looksLikeSpeculation(s: string): boolean { return SPECULATION_RE.test(s || ""); }

// GOVERNING PRINCIPLE — silent fix. INVENTED INFERENCE: confident narration that assigns a ROLE,
// MOTIVE, METHOD, or TREND the record does not establish. Distinct from a fabricated FACT (the claim
// check) and from atmospheric cliché (SPECULATION_RE) — this is the "sexy line turned into a fact"
// class: it reads like reporting but the specifics are the narrator's. It is what padding produces
// when a refill can't consume real facts. Calibration holds: evidence-grounded FRAMING stays ("the
// royalty system doesn't ask where a stream came from"); an invented ROLE/MOTIVE/METHOD goes.
// Survivors this targets: "the publicist provides the surface legitimacy", "the promoter is
// placement", "apparently unaware, or unconcerned", "someone had to go line by line through the
// royalty records", "reflects that infrastructure expanding, year over year", "we now have answers
// to essentially everything".
export const INVENTED_INFERENCE_RE = /\b(?:(?:the )?(?:publicist|promoter|manager|distributor|executive|producer|accountant|attorney|lawyer|partner|collaborator)\b[^.]{0,35}?\b(?:provides?|provided|supplies|supplied|handles?|handled|brings?|brought|is|was|means?|meant)\b[^.]{0,35}?\b(?:legitimacy|cover|the surface|placement|access|credibility|distribution|the front|plausibility|respectability)\b|(?:apparently|seemingly|evidently|presumably|either)\s+(?:unaware|unconcerned|indifferent|oblivious|untroubled)\b|\b(?:unaware|unconcerned|oblivious)\b\s*,?\s*or\s+(?:unaware|unconcerned|indifferent|oblivious)\b|(?:someone|somebody|investigators?|analysts?|agents?|they)\b[^.]{0,40}?\b(?:had to|would have had to|must have)\b[^.]{0,30}?\b(?:line by line|record by record|one by one|by hand|entry by entry)\b|\b(?:reflects?|shows?|traces?|maps?)\b[^.]{0,45}?\b(?:expanding|growing|scaling|compounding)\b[^.]{0,25}?\byear over year\b|\banswers? to (?:essentially|virtually|almost|nearly) everything\b|\b(?:a |his |the )?(?:spreadsheet|excel (?:file|sheet)|cloud dashboard|dashboard|control panel|command center)\b[^.]{0,40}?\b(?:track\w*|log\w*|record\w*|monitor\w*|manage\w*|show\w*|listing|tallied|every|attached|included|containing)\b|\bwith (?:a |the )?spreadsheet attached\b)/i;
export function looksLikeInventedInference(s: string): boolean { return INVENTED_INFERENCE_RE.test(s || ""); }

// CERTAINTY-DISCIPLINE — STAGE 1 (deterministic pre-filter, FLAG only, NEVER edit). The Dramatic
// Truth Rule: a sentence may intensify emotion, imagery, contrast, pacing, and narrative implication
// freely, but NOT the evidence's scope, certainty, causation, exclusivity, quantity, or knowledge/
// intent. This regex is intentionally LIBERAL — it only decides which sentences a downstream LLM
// judge looks at against the approved facts. It must not itself cut or swap words (that would gut the
// voice); metaphor and contrast are judged, never auto-removed. Cheap, runs on every sentence.
const OVERSTATEMENT_FLAG_RE = /\b(?:every|all|none|no one|not a single|never|always|only|completely|entirely|nothing|everything|first(?: ever)?|last|largest|biggest|unprecedented|never before|in history|proved|confirmed|definitely|certainly|undeniably|without question|no doubt|the industry|the platforms?|everyone|nobody|law enforcement|investigators|the public|caused|led directly to|resulted in|therefore|which meant|ensured|guaranteed)\b/i;
export function flagOverstatementRisk(sentence: string): boolean { return OVERSTATEMENT_FLAG_RE.test(sentence || ""); }
export function stripInventedInference(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  const outParas = text.split(/\n\n+/).map((p) => {
    const kept = splitSentences(p).filter((s) => {
      if (looksLikeInventedInference(s)) { cuts.push(s.trim()); return false; }
      return true;
    });
    return kept.join(" ").trim();
  }).filter((p) => p.length > 0);
  return { text: outParas.join("\n\n"), cuts };
}

// GOVERNING PRINCIPLE — silent fix (CORRECTNESS, light). Cut a sentence that arithmetically TIES a
// songs/files figure to a streams figure — the observed conflation where "661,440 streams/day" was
// wrongly computed from "10,000 songs". Conservative and unit-aware: fires only when a songs/files/
// tracks/uploads number and a streams/plays number appear in the SAME sentence joined by an explicit
// arithmetic relation. The correct relationship (streams tied to bot ACCOUNTS) uses different units,
// so it is never touched; and a sentence stating either figure alone is left alone.
const SONGS_FIG_RE = /\b\d[\d,]{2,}(?:\.\d+)?\s*(?:songs?|tracks?|files?|uploads?|recordings?)\b/i;
const STREAMS_FIG_RE = /\b\d[\d,]{2,}(?:\.\d+)?\s*(?:streams?|plays?)\b/i;
const CONFLATION_CUE_RE = /\b(?:times|multiplied by|per (?:song|track|file|upload)|each (?:song|track|file)|equals|comes? (?:out )?to|adds? up to|generating|generated|producing|produced|yields?|=|×|x)\b/i;
export function stripUnitConflation(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  const outParas = text.split(/\n\n+/).map((para) => {
    const kept = splitSentences(para).filter((s) => {
      if (SONGS_FIG_RE.test(s) && STREAMS_FIG_RE.test(s) && CONFLATION_CUE_RE.test(s)) { cuts.push(s.trim()); return false; }
      return true;
    });
    return kept.join(" ").trim();
  }).filter((p) => p.length > 0);
  return { text: outParas.join("\n\n"), cuts };
}
export function stripSpeculation(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  const outParas = text.split(/\n\n+/).map((p) => {
    const kept = splitSentences(p).filter((s) => {
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
    const sentences = splitSentences(p);
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

// GOVERNING PRINCIPLE — silent fix. Cut a DUPLICATE OF THE HOOK that reappears later in the body.
// A chunked build re-emitted "Imagine a song playing right now..." twice near-verbatim; it is
// non-adjacent (so dedupeAdjacentParagraphs misses it) and appears only twice (so the 3+ anchor
// collapse misses it). This compares the opening against everything after it and removes a later
// near-duplicate — both a whole restated opening paragraph, and a later paragraph that just OPENS
// by re-running the hook's first sentence. The first occurrence (the real hook) always stays.
export function stripDuplicateHook(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const paras = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (paras.length < 2) return { text, cuts: [] };
  const cuts: string[] = [];
  const hook = paras[0];
  const hookFirst = splitSentences(hook)[0]?.trim() || hook;
  const out = [paras[0]];
  for (let i = 1; i < paras.length; i++) {
    const p = paras[i];
    // Whole later paragraph is a restatement of the opening. The FIRST couple of paragraphs after
    // the hook are the most damaging place for a near-duplicate (a paraphrased re-open), so hold
    // them to a looser bar than a coincidental echo deeper in the body.
    const restateThreshold = i <= 2 ? 0.55 : 0.7;
    if (tokenOverlap(p, hook) >= restateThreshold) { cuts.push(p); continue; }
    // Later paragraph OPENS by re-running the hook's first sentence — drop just that sentence.
    const sents = splitSentences(p);
    if (sents.length > 1 && tokenOverlap(sents[0], hookFirst) >= 0.7) {
      cuts.push(sents[0].trim());
      out.push(sents.slice(1).join(" ").trim());
      continue;
    }
    out.push(p);
  }
  return { text: out.filter(Boolean).join("\n\n"), cuts };
}

// GOVERNING PRINCIPLE — silent fix. Strip a LEAKED STRUCTURAL LABEL. A section writer occasionally
// emits its slot name as a literal prefix ("HOOK: ...", "SECTION 1: ...", "INTRO —"); that label is
// production scaffolding, never spoken text. Remove it from the start of any paragraph.
const _LABEL_WORDS = "hook|intro(?:duction)?|cold open|section(?:\\s*\\d+)?|part\\s*\\d+|act\\s*\\d+|setup|mechanism|climax|aftermath|conclusion|outro|cta|beat";
// A label leaks either bracket-wrapped ("[HOOK]", "(Intro)") with no separator, or as a bold/plain
// prefix terminated by a colon or dash ("**HOOK:**", "SECTION 1 —").
const LEAKED_LABEL_RE = new RegExp(
  `^\\s*(?:[\\[\\(]\\s*(?:${_LABEL_WORDS})\\s*[\\]\\)]|[*_#>]*\\s*(?:${_LABEL_WORDS})\\s*[*_]*\\s*[:\\-–—])\\s*[*_]*\\s*`,
  "i",
);
export function stripLeakedLabels(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  const out = text.split(/\n\n+/).map((p) => {
    const m = p.match(LEAKED_LABEL_RE);
    if (m) { cuts.push(m[0].trim()); return p.replace(LEAKED_LABEL_RE, "").trim(); }
    return p.trim();
  }).filter(Boolean).join("\n\n");
  return { text: out, cuts };
}

// GOVERNING PRINCIPLE — silent fix (CORRECTNESS). Cut a FALSE EQUALITY between two figures. The build
// asserted "the forfeiture figure and the collected-royalties figure the DOJ cites are the same
// number", then used $8.09M and $10M two sentences apart — a self-contradiction. Cut a sentence that
// claims two named/dollar amounts are the same/identical when the body actually carries two DIFFERENT
// distinctive figures. Conservative: needs an equality phrase AND two figure references in the
// sentence (or a body with 2+ distinct big figures).
const EQUALITY_RE = /\b(?:the same (?:number|figure|amount|value)|identical|exactly the same|one and the same|are equal|is equal to)\b/i;
export function stripFalseEquality(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const bigFigs = new Set(digitNumbersIn(text).map((d) => d.value).filter((v) => Math.abs(v) >= 1_000_000).map((v) => Math.round(v / 1e5)));
  const bodyHasTwoBig = bigFigs.size >= 2; // e.g. $8.09M and $10M
  const cuts: string[] = [];
  const outParas = text.split(/\n\n+/).map((para) => {
    const kept = splitSentences(para).filter((s) => {
      if (!EQUALITY_RE.test(s)) return true;
      const figsHere = digitNumbersIn(s).filter((d) => Math.abs(d.value) >= 1_000_000).length;
      // Two figures in THIS sentence claimed equal, or an equality claim while the body carries two
      // different big figures the claim can't be true of.
      if (figsHere >= 2 || bodyHasTwoBig) { cuts.push(s.trim()); return false; }
      return true;
    });
    return kept.join(" ").trim();
  }).filter((p) => p.length > 0);
  return { text: outParas.join("\n\n"), cuts };
}

// GOVERNING PRINCIPLE — silent fix (no fabricated stats). Cut a sentence citing an EXTERNAL STAT that
// is not in the approved facts: a named body (RIAA, IFPI, Nielsen, a "study"/"report"/"survey") or an
// "on average"/"the average X earns/makes" claim carrying a dollar figure the facts don't contain.
// The build invented an RIAA "$25,000-$50,000 average musician" comparison with no backing fact.
const STAT_ATTR_RE = /\b(?:RIAA|IFPI|Nielsen|Luminate|MRC|Billboard|Statista|Pew|a (?:recent )?(?:study|report|survey|analysis)|studies show|reports? (?:show|found)|on average|the average \w+ (?:earns?|makes?|takes home|brings? in)|industry average)\b/i;
// An unverified LEGAL/REGULATORY citation the writer invented (the build cited "37 C.F.R. §§ 385.2
// and 385.21" with nothing behind it). A citation is a checkable claim: cut it when its distinctive
// token (the C.F.R./U.S.C. part number, the Pub. L. number) is not in the facts.
const CITATION_RE = /\b\d+\s*(?:C\.?F\.?R\.?|U\.?S\.?C\.?)\s*(?:§+\s*)?[\d.]+|\bPub\.?\s*L\.?\s*(?:No\.?)?\s*[\d-]+|\b\d+\s*Stat\.?\s*\d+/i;
export function stripUnsourcedStat(text: string, factBlob: string | undefined): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const factLc = (factBlob || "").toLowerCase();
  const cuts: string[] = [];
  const outParas = text.split(/\n\n+/).map((para) => {
    const kept = splitSentences(para).filter((s) => {
      // Unverified legal/regulatory citation: cut when its number isn't in the facts.
      const cite = s.match(CITATION_RE);
      if (cite) {
        const nums = (cite[0].match(/\d[\d.]*/g) || []);
        const supported = nums.some((n) => factLc.includes(n.toLowerCase()));
        if (!supported) { cuts.push(s.trim()); return false; }
      }
      if (!STAT_ATTR_RE.test(s)) return true;
      const figs = digitNumbersIn(s).filter((d) => d.unit || Math.abs(d.value) >= 1000);
      if (!figs.length) return true; // an attribution with no figure is not a stat claim
      // Cut when NONE of the sentence's figures appear in the facts (a fabricated external stat).
      const anySupported = figs.some((f) => {
        const surf = f.surface.toLowerCase().replace(/[$,]/g, "");
        return factLc.includes(surf) || factLc.includes(String(Math.round(f.value))) || (factBlob ? spelledNumbersIn(factBlob).some((sp) => numbersMatch(sp.value, f.value)) || digitNumbersIn(factBlob).some((d) => numbersMatch(d.value, f.value)) : false);
      });
      if (!anySupported) { cuts.push(s.trim()); return false; }
      return true;
    });
    return kept.join(" ").trim();
  }).filter((p) => p.length > 0);
  return { text: outParas.join("\n\n"), cuts };
}

// GOVERNING PRINCIPLE — silent fix (CORRECTNESS). Cut a stated SCHEME-DURATION count. Two failure
// shapes from the live build: a bare "Three years." fragment immediately followed by "That's how
// long this ran", and the locked title's number ("3 Years") leaking into the body as a stated
// fact. A computed span is a fabrication risk (the scheme ran ~2017-2024, not "three years"); the
// sourced date range should carry it, so the claim sentence is cut. Sentence-level cut only, so it
// can never shatter prose the way the reverted token-replace did. Niche-agnostic.
const DURATION_CLAIM_RE = /\b(?:that|this)(?:'?s| is| was) (?:exactly )?how long (?:it|this|that|the scheme|the operation|the fraud|the whole thing) (?:ran|lasted|went on|continued|kept going|took|had been running)\b|\bit (?:did(?:n'?t| not) take|only took|took (?:just |only )?)(?:\s*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|sixteen))\s+(?:years?|months?)\b/i;
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
// The scheme's span in YEARS as the researched facts establish it: the gap between the earliest and
// latest plausible calendar year mentioned (2017..2024 -> 7). Returns null unless at least two
// distinct in-range years appear and the gap is a sane 1..40 — so we NEVER invent a duration from a
// thin or single-year fact set. Shared by the title reconciler and the body-duration backstop.
export function researchedYearSpan(facts: string | undefined): number | null {
  if (!facts) return null;
  // The title span is the SCHEME's duration — start year to the year it was STOPPED (arrest / charge /
  // indictment / raid). Post-arrest legal-milestone years (a 2026 guilty plea or sentencing) are NOT
  // part of how long the fraud ran, and including them inflated 2017-2024 into a "9-year" title. So
  // exclude a year whose immediate context is a plea/sentencing/conviction milestone.
  const POST_ARREST = /\b(?:plead(?:ed|s)?\s+guilty|guilty\s+plea|sentenc\w*|will (?:be )?sentenc\w*|awaiting sentenc\w*|convicted|conviction)\b/i;
  const YEAR_RE = /\b(19[5-9]\d|20[0-4]\d)\b/g;
  const all: number[] = (facts.match(YEAR_RE) || []).map(Number);
  if (all.length < 2) return null;
  // Exclude a year that appears in a SENTENCE whose meaning is a post-arrest legal milestone (plea /
  // sentencing / conviction) — that year is not part of how long the scheme RAN. Sentence-scoped, so
  // a plea sentence can't taint the arrest year in the sentence before it.
  const scheme: number[] = [];
  for (const sent of facts.split(/(?<=[.!?])\s+/)) {
    if (POST_ARREST.test(sent)) continue;
    for (const y of (sent.match(YEAR_RE) || [])) scheme.push(Number(y));
  }
  const pool = scheme.length >= 2 ? scheme : all; // fall back if exclusion left too little
  const span = Math.max(...pool) - Math.min(...pool);
  return span >= 1 && span <= 40 ? span : null;
}

// A body sentence asserting the SCHEME's own duration (not just any passing mention of a number of
// years): "the scheme ran for almost four years", "over the course of four years", "a four-year
// operation". Captures the year count so it can be checked against the researched span.
const SCHEME_DURATION_ASSERT_RE = /\b(?:ran|lasted|went on|continued|operated|spanned|kept going|running|going)\s+(?:for\s+)?(?:about|nearly|almost|roughly|over|just|more than|around)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+years?\b|\bfor\s+(?:about|nearly|almost|roughly|over|just|more than|around)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+years?,?\s+(?:the\s+)?(?:scheme|operation|fraud|scam|it|this)\b|\bover the course of\s+(?:about|nearly|almost|roughly)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+years?\b|\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[\s-]year[\s-](?:long\s+)?(?:scheme|operation|fraud|scam|run|con)\b/i;

export function stripSchemeDurationClaim(text: string, title?: string, researchedSpanYears?: number | null): { text: string; cuts: string[] } {
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
    const sentences = splitSentences(para);
    const kept: string[] = [];
    for (const s of sentences) {
      if (DURATION_CLAIM_RE.test(s)) {
        cuts.push(s.trim());
        // Also drop an immediately-preceding bare duration fragment ("Three years.") that the
        // claim was elaborating — it is the same false count with no sentence of its own.
        if (kept.length && BARE_DURATION_RE.test(kept[kept.length - 1].trim())) cuts.push(kept.pop()!.trim());
        continue;
      }
      // BACKSTOP: a sentence asserting the SCHEME's duration that CONTRADICTS the researched span
      // (facts establish ~7 years 2017-2024, but the sentence says "almost four years") — the exact
      // hook/body contradiction the title reconciler prevents at the source. Cut it (±1yr tolerance).
      if (researchedSpanYears != null) {
        const m = s.match(SCHEME_DURATION_ASSERT_RE);
        if (m) {
          const tok = (m[1] || m[2] || m[3] || m[4] || "").toLowerCase();
          const n = /^\d+$/.test(tok) ? parseInt(tok, 10) : _DURWORDS[tok];
          if (n && Math.abs(n - researchedSpanYears) > 1) { cuts.push(s.trim()); continue; }
        }
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

// GOVERNING PRINCIPLE — silent fix (CORRECTNESS). Correct a case-event DATE the script shifted
// off the sourced date. The rematch script said the guilty plea was "March 20, 2026" when the DOJ
// fact says March 19 — a fabricated-by-drift date. Dates must be copied VERBATIM from the facts.
// Deterministic and conservative: only when a script date's MONTH+YEAR match EXACTLY ONE fact date
// but the DAY differs is the day corrected to the fact's day (the exact "20 vs 19" drift). A month
// or year the facts don't carry at all is left alone — we can't know the right value, so we never
// guess; the semantic pass / grounding handles those.
const _MONTHNUM: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const _MONTH_DATE_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(,)?\s+(\d{4})\b/gi;
function factDateDays(factBlob: string): Map<string, Set<number>> {
  const byMonthYear = new Map<string, Set<number>>();
  for (const m of (factBlob || "").matchAll(_MONTH_DATE_RE)) {
    const mn = _MONTHNUM[m[1].slice(0, 3).toLowerCase()];
    const day = parseInt(m[2], 10);
    const yr = m[4];
    if (!mn || !day) continue;
    const key = `${mn}-${yr}`;
    if (!byMonthYear.has(key)) byMonthYear.set(key, new Set());
    byMonthYear.get(key)!.add(day);
  }
  return byMonthYear;
}
export function correctDatesToFacts(text: string, factBlob: string | undefined): { text: string; cuts: string[] } {
  if (!text || !factBlob) return { text, cuts: [] };
  const factDays = factDateDays(factBlob);
  if (!factDays.size) return { text, cuts: [] };
  const cuts: string[] = [];
  const out = text.replace(_MONTH_DATE_RE, (whole, mon, day, comma, yr) => {
    const mn = _MONTHNUM[String(mon).slice(0, 3).toLowerCase()];
    const key = `${mn}-${yr}`;
    const days = factDays.get(key);
    if (!days || days.has(parseInt(day, 10))) return whole; // month/year not in facts, or day already correct
    if (days.size !== 1) return whole;                       // ambiguous — don't guess
    const correct = [...days][0];
    const fixed = whole.replace(/\d{1,2}(?=(,)?\s+\d{4}\b)/, String(correct));
    cuts.push(`${whole} -> ${fixed}`);
    return fixed;
  });
  return { text: out, cuts };
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
    const sentences = splitSentences(para);
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
// Silent fix — FACT-MACHINERY META-LEAK. Chunked generation gives each section its assigned facts,
// numbered; occasionally the model narrates the bookkeeping into the script itself ("Facts 3 and 4
// are duplicates of facts already delivered above and are skipped here"). That is the sourcing
// machinery leaking into the narrator's voice — never allowed. Cut any sentence that references the
// fact-numbering, the delivery order, or the act of restating/skipping the record's facts.
const FACT_META_PATTERNS: RegExp[] = [
  /\bfacts?\s+\d+\b/i,                              // "Fact 7", "Facts 3 and 4"
  /\b(?:already )?delivered above\b/i,
  /\bskipped here\b/i,
  /\b(?:to avoid|without) restating\b/i,
  /\bthe record has already (?:established|stated|covered|delivered)\b/i,
  /\bduplicates? of (?:the )?facts?\b/i,
  /\b(?:as|are) (?:noted|listed|established|delivered) (?:above|earlier)\b/i,
  /\brestating what the record\b/i,
  // Source-machinery narration: the narrator must never make "the sources/the record/the
  // file/the reporting" the SUBJECT of a sentence (banned in the system prompt; this is the
  // deterministic backstop). Catches "The sources do not document...", "What the record does
  // not itemize...", "documented in the record". Attribution to a real named actor
  // ("prosecutors alleged", "the DOJ charged") is NOT matched and stays.
  /\b(?:the\s+)?(?:sources?|record|file|documents?|reporting)\s+(?:do(?:es)?\s+not|don'?t|doesn'?t)\s+\w+/i,
  /\bwhat the (?:record|sources?)\s+(?:do(?:es)?\s+not|shows?|establishe?s?|documents?|says?|item i?zes?)\b/i,
  /\bdocumented in the record\b/i,
  /\bthe (?:record|sources?)\s+(?:does|do)\s+not\b/i,
];
// Silent fix — UNGROUNDED NAMED SPECIFIC (grounded scripts only). When a script is built on an
// approved fact set, the model sometimes reaches for a famous real-world specific that ISN'T in the
// facts — most often a named piece of legislation and its supposed aftermath ("the Sarbanes-Oxley
// Act, a direct legislative response to..."). It is true in the world but UNSOURCED here, and it
// usually drags an unsupported causal claim with it. Legislation is a clean, high-precision class to
// catch: a capitalized "... Act" (or "Act of YYYY") whose name does not appear in the fact blob is
// ungrounded, so cut the sentence. Only runs when a fact blob exists (never on ungrounded topics).
export function stripUngroundedActs(text: string, factBlob: string | undefined): { text: string; cuts: string[] } {
  if (!text || !factBlob) return { text, cuts: [] };
  const factLc = factBlob.toLowerCase();
  // Named legislation: "Sarbanes-Oxley Act", "Dodd-Frank Act", "the CARES Act", "Act of 2002".
  const ACT_RE = /\b([A-Z][A-Za-z.’'-]+(?:[- ][A-Z][A-Za-z.’'-]+){0,3}\s+Act\b|Act\s+of\s+\d{4})/g;
  const cuts: string[] = [];
  const outParas = text.split(/\n\n+/).map((para) => {
    const kept = splitSentences(para).filter((s) => {
      const matches = s.match(ACT_RE);
      if (!matches) return true;
      for (const m of matches) {
        // The distinctive part of the name (drop a leading "the"/"The" and the word "Act").
        const name = m.replace(/\bact\b/i, "").replace(/^the\s+/i, "").trim().toLowerCase();
        const tokens = name.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
        // Ungrounded if neither the full name nor any distinctive token is in the facts.
        const grounded = (name && factLc.includes(name)) || tokens.some((w) => factLc.includes(w));
        if (!grounded) { cuts.push(s.trim()); return false; }
      }
      return true;
    });
    return kept.join(" ").trim();
  }).filter((p) => p.length > 0);
  return { text: outParas.join("\n\n"), cuts };
}

// Silent fix — VERBATIM SENTENCE ECHO. A sentence (or a short sentence pair) repeated word-for-word
// non-adjacently is padding/an AI stutter ("The capture was real. The handcuffs were real." twice).
// collapseRepeatedAnchors targets a FACT drummed 3+ times; this catches an EXACT restatement on the
// 2nd occurrence. Conservative: only exact (normalized) duplicates, only sentences of real length,
// keeps the FIRST occurrence, never touches a one-off.
export function stripRepeatedSentences(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
  const seen = new Set<string>();
  const cuts: string[] = [];
  const outParas = text.split(/\n\n+/).map((para) => {
    const kept = splitSentences(para).filter((s) => {
      const k = norm(s);
      // Guard sentences of >= 4 words; 1-3 word connectives ("It was over.") can legitimately recur.
      if (k.split(" ").length < 4) return true;
      if (seen.has(k)) { cuts.push(s.trim()); return false; }
      seen.add(k);
      return true;
    });
    return kept.join(" ").trim();
  }).filter((p) => p.length > 0);
  return { text: outParas.join("\n\n"), cuts };
}

// Silent fix — PREFIX STUTTER. A rewrite pass can leave a sentence followed by a longer version of
// itself ("What they were working against was not just time. What they were working against was not
// just time, it was a case..."). stripRepeatedSentences only catches EXACT echoes, so this catches the
// prefix case: when one of two ADJACENT sentences is the opening of the other, keep the longer one.
// Only sentences of 4+ words, so a deliberate short refrain beat is never touched.
export function stripStutters(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const cuts: string[] = [];
  const outParas = text.split(/\n\n+/).map((para) => {
    const out: string[] = [];
    for (const s of splitSentences(para)) {
      const prev = out[out.length - 1];
      if (prev) {
        const a = norm(prev), b = norm(s);
        const shorter = a.length <= b.length ? a : b, longer = a.length <= b.length ? b : a;
        // Also a NEAR-duplicate: the same sentence with a phrase added or removed (seen live: "A man living
        // under an open Ohio warrant, wanted since 1959, had apparently..." followed by the same sentence
        // minus that clause plus a tail). 85%+ of the shorter one's words inside the longer, 8+ words.
        const ta = new Set(a.split(" ")), tb = new Set(b.split(" "));
        const small = ta.size <= tb.size ? ta : tb, big = ta.size <= tb.size ? tb : ta;
        const contained = [...small].filter((w) => big.has(w)).length / Math.max(1, small.size);
        // Or the same sentence re-opened and re-worded (seen live: "She was a teenager caught in an
        // undercover sting alongside her boyfriend..." then "She was a teenager who got swept into an
        // undercover sting alongside her boyfriend..."): same first three words, 70%+ of 12+ words.
        const sameStart = a.split(" ").slice(0, 3).join(" ") === b.split(" ").slice(0, 3).join(" ");
        const near = (small.size >= 8 && contained >= 0.85) || (sameStart && small.size >= 12 && contained >= 0.7);
        // A 3-word sentence restated as the lead of the next ("Four felony charges. Four felony charges:
        // identity theft and fraud") is a stutter too; a short refrain repeated whole is not.
        const rawLonger = (a.length <= b.length ? s : prev).trim();
        const leadIn = shorter.split(" ").length === 3 && longer.startsWith(shorter + " ") && new RegExp(`^[^:,]{0,${shorter.length + 4}}[:,]`).test(rawLonger);
        if ((shorter.split(" ").length >= 4 && longer.startsWith(shorter)) || leadIn || near) {
          if (b.length > a.length) { cuts.push(prev.trim()); out[out.length - 1] = s; } else cuts.push(s.trim());
          continue;
        }
      }
      out.push(s);
    }
    return out.join(" ").trim();
  }).filter((p) => p.length > 0);
  return { text: outParas.join("\n\n"), cuts };
}

// Silent fix — LEAKED DIVIDERS. Section joins can leak markdown rules ("---", "***", "___") into a
// script meant to be read aloud. Drop any paragraph that is only a divider.
export function stripDividers(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  const out = text.split(/\n\n+/).map((p) => p.trim()).filter((p) => {
    if (/^(?:[-*_=~]\s*){3,}$/.test(p)) { cuts.push(p); return false; }
    return p.length > 0;
  });
  return { text: out.join("\n\n"), cuts };
}

// Silent fix — DANGLING BACK-REFERENCE. "What it shows is..." / "What they do show is that..." only
// make sense after a "the record doesn't show X" line. When a pass cut that line, the reply is left
// pointing at nothing. If the PREVIOUS sentence has no negation to answer, strip the lead-in and keep
// the claim ("What it shows is the direction: the unit traced him to Florida." -> "The unit traced
// him to Florida."). A genuine "doesn't say X. What it shows is Y." pair is untouched.
export const BACKREF_RE = /^(?:but\s+|and\s+)?what\s+(?:it|they|this|that|the\s+(?:record|reporting|sources?|facts|documents?|file))\s+(?:does\s+|do\s+|did\s+)?(?:shows?|says?|tells?\s+us|establish(?:es)?|confirms?)\s*(?:is|are)?\s*(?:the\s+\w+\s*:\s*|that\s+|this\s*:\s*|:\s*)?/i;
// The previous sentence must be a real "the record doesn't say X" line for "What it shows..." to answer it.
// A bare "not" is not enough (seen live: "...and then he was not." hid a dangling "What it shows is...").
const NEGATION_RE = /\b(?:does not|doesn['’]t|did not|didn['’]t|do not|don['’]t|cannot|can['’]t|never)\s+(?:say|show|explain|detail|record|establish|tell|answer|reveal|describe|specify|name)\b|\b(?:record|reporting|sources?|documents?|file|facts)\b[^.]{0,60}\b(?:silent|unclear|unresolved|leaves? (?:open|unresolved)|says? (?:little|nothing|almost nothing))\b/i;
export function fixDanglingBackrefs(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  let prev = "";
  const out = text.split(/\n\n+/).map((para) => splitSentences(para).map((sn) => {
    const m = sn.match(BACKREF_RE);
    let res = sn;
    if (m && m[0].trim() && !NEGATION_RE.test(prev)) {
      const rest = sn.slice(m[0].length).trim();
      if (rest.split(/\s+/).length >= 3) {
        // "What it shows is that A, and that B" -> "A, and B": drop the parallel "that" too.
        const fixed = /\bthat\s*$/i.test(m[0].trim()) ? rest.replace(/,\s+and that\s+/i, ", and ") : rest;
        res = fixed[0].toUpperCase() + fixed.slice(1); cuts.push(sn.trim());
      }
    }
    prev = res;
    return res;
  }).join(" ").trim()).filter(Boolean);
  return { text: out.join("\n\n"), cuts };
}

// QUOTE CHECK. Text in quotation marks tells the viewer "someone said exactly this". A quoted span of
// 2+ words must appear VERBATIM (case/punctuation-insensitive) somewhere in the research; otherwise it
// is a fabricated or drifted quote (seen live: a card title "I Made a Mistake." in quote marks; a fact
// that put "the longest manhunt" in the Marshals' mouths when the source was the reporter's own words).
const qnorm = (t: string) => t.toLowerCase().replace(/[‘’“”"'.,!?;:—–-]/g, " ").replace(/\s+/g, " ").trim();
export function quotedSpans(text: string): string[] {
  const out: string[] = [];
  const t = String(text || "");
  for (const m of t.matchAll(/[“"]([^“”"]{3,240})[”"]/g)) if (!/^\s|\s$/.test(m[1]) && m[1].trim().split(/\s+/).length >= 2) out.push(m[1].trim());
  // Single quotes too (seen live: a card hook quoted with '...'). A quote opens after a space/start/
  // punctuation and closes before space/punctuation, so apostrophes inside words ("hadn't") don't count.
  for (const m of t.matchAll(/(?:^|[\s(,:—–-])[‘']([^‘’'"“”]{3,240}?(?:\w[’']\w[^‘’'"“”]*?)*)[’'](?=[\s.,;:!?)—–-]|$)/g)) if (m[1].trim().split(/\s+/).length >= 2) out.push(m[1].trim());
  return out;
}
export function unsourcedQuotes(text: string, sourceText: string): string[] {
  const hay = qnorm(sourceText || "");
  return quotedSpans(text).filter((q) => !hay.includes(qnorm(q)));
}
// In the script, an unsourced quote keeps its words but loses its quotation marks: it then reads as
// narration, not as a claim that a real person said those exact words.
export function unquoteUnsourced(text: string, sourceText: string): { text: string; cuts: string[] } {
  if (!text || !sourceText || !sourceText.trim()) return { text, cuts: [] };
  const bad = new Set(unsourcedQuotes(text, sourceText));
  if (!bad.size) return { text, cuts: [] };
  const cuts: string[] = [];
  // A span that starts or ends with whitespace is the gap BETWEEN two quotes (straight quotes pair up
  // ambiguously), not a quote; unquoting it would strip the marks off two real quotes.
  const out = text.replace(/[“"]([^“”"]{3,240})[”"]/g, (all, inner) => { if (/^\s|\s$/.test(String(inner))) return all; if (bad.has(String(inner).trim())) { cuts.push(inner); return inner; } return all; });
  return { text: out, cuts };
}

// Silent fix — QUOTE WORD COUNT. "Two words." about a quote that has three ("You got me.") is a
// checkable error. When a sentence says "N words" and a quote appears within the previous 3 sentences
// (or the same sentence), the number is corrected to the quote's real word count.
const NUMW = ["zero","one","two","three","four","five","six","seven","eight","nine","ten"];
export function fixQuoteWordCounts(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  // Work on the RAW text: sentence-splitting cuts a multi-sentence quote in half, and apostrophes
  // ("didn't") look like single quotes. Look back up to ~900 characters for the last complete
  // double-quoted span before each "N words" and count its words.
  const out = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+words\b/gi, (all, num, offset: number) => {
    // The quote can also come right AFTER the count (seen live: 'was three words: "I just hopped a
    // fence."', five words). A quote opening within a few characters ahead wins over the look-back.
    const ahead = text.slice(offset + all.length, offset + all.length + 420).match(/^[\s:,.—-]{0,4}[“"]([^“”"]{2,400})[”"]/);
    const before = text.slice(Math.max(0, offset - 900), offset);
    const spans = [...before.matchAll(/[“"]([^“”"]{2,400})[”"]/g)].map((m) => m[1]).filter((q) => !/^\s|\s$/.test(q));
    const q = ahead ? ahead[1] : spans.pop();
    if (!q) return all;
    const n = q.replace(/[^\w\s'’-]/g, " ").trim().split(/\s+/).filter(Boolean).length;
    const said = NUMW.indexOf(String(num).toLowerCase());
    const cap = (w: string) => (num[0] === num[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w);
    if (n === said) return all;
    cuts.push(all);
    if (n > 10) return `${cap("these")} words`; // "five words" before a long quote -> "these words"
    return `${cap(NUMW[n])} words`;
  });
  return { text: out, cuts };
}

// SUPERLATIVE WORDING. A superlative is a factual claim with an exact scope ("the longest SUCCESSFUL
// manhunt" is not "the longest fugitive hunt"). Seen live: the qualifier was dropped six batches in a
// row. For each superlative in the text, the research must carry the same superlative word, and the
// words right after it must match the research's phrase; otherwise report the research's exact phrase.
const SUPER_RE = /\b(longest|shortest|largest|biggest|deadliest|highest|lowest|oldest|youngest|greatest|costliest|fastest|worst|best)\b((?:[\s-]+[a-z’']+){1,3})/gi;
const SUP_STOP = new Set(["in", "of", "the", "to", "for", "ever", "and", "on", "at", "by", "that", "this", "from", "his", "her", "their", "its", "u", "s"]);
function supTail(t: string): string[] { return t.toLowerCase().split(/[\s-]+/).filter(Boolean).filter((w) => !SUP_STOP.has(w)).slice(0, 2); }
export function superlativeMismatches(text: string, sourceText: string): { said: string; source: string | null }[] {
  const out: { said: string; source: string | null }[] = [];
  const src = String(sourceText || "");
  for (const m of String(text || "").matchAll(SUPER_RE)) {
    const word = m[1].toLowerCase();
    const trimStop = (x: string) => x.trim().replace(/(?:\s+(?:in|of|the|to|for|at|on|by|ever))+$/i, "");
    const said = trimStop(m[1] + m[2]);
    const srcPhrases = [...src.matchAll(new RegExp(`\\b${word}\\b((?:[\\s-]+[a-z’']+){1,3})`, "gi"))].map((x) => trimStop(word + x[1]));
    if (!srcPhrases.length) { out.push({ said, source: null }); continue; }
    const mine = supTail(m[2]);
    const ok = srcPhrases.some((p) => { const t = supTail(p.slice(word.length)); return t.length && mine.length && t[0] === mine[0]; });
    if (!ok) out.push({ said, source: srcPhrases[0] });
  }
  return out;
}

// Silent fix — LEANING FRAGMENTS. "The full accounting is not." only works directly after the
// sentence it answers ("The cost is documented. The full accounting is not."). When a pass cut that
// partner, the fragment is left leaning on nothing (seen in the benchmark). A short sentence (<= 7
// words) ending on a bare auxiliary is kept only if the previous sentence carries the same auxiliary
// verb it is contrasting with; otherwise it is removed. The script's last sentence gets the same check.
const AUX = "is|was|were|are|am|did|does|do|had|has|have|would|could|can|will|should|might";
const LEAN_RE = new RegExp(`^[^.!?]{1,60}?\\b(${AUX})(?:\\s+not|n['’]t)?[.!]$`, "i");
export function stripLeaningFragments(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  const paras = text.split(/\n\n+/).map((p) => splitSentences(p));
  const flat: { p: number; s: number }[] = [];
  paras.forEach((ss, p) => ss.forEach((_, si) => flat.push({ p, s: si })));
  flat.forEach(({ p, s }, k) => {
    const sn = paras[p][s].trim();
    if (sn.split(/\s+/).length > 7) return;
    const m = sn.match(LEAN_RE);
    if (!m) return;
    const prevRef = flat[k - 1];
    const prev = prevRef ? paras[prevRef.p][prevRef.s] : "";
    const verb = m[1].toLowerCase();
    if (prev && new RegExp(`\\b${verb}\\b`, "i").test(prev)) return; // a real contrast pair: keep
    cuts.push(sn); paras[p][s] = "";
  });
  const out = paras.map((ss) => ss.filter(Boolean).join(" ").trim()).filter(Boolean);
  return { text: out.join("\n\n"), cuts };
}

// Silent fix — RESTORE A DROPPED SUPERLATIVE QUALIFIER. When the script says "the longest manhunt" and
// the research says "the longest SUCCESSFUL manhunt" about the SAME noun, the dropped qualifier changes
// the claim's scope. Insert it back. Only when the noun matches exactly; a different phrasing
// ("longest-running fugitive case") is left for the checkers.
export function restoreSuperlativeQualifiers(text: string, sourceText: string): { text: string; cuts: string[] } {
  if (!text || !sourceText) return { text, cuts: [] };
  const cuts: string[] = [];
  let out = text;
  const SUP = "longest|shortest|largest|biggest|deadliest|highest|lowest|oldest|youngest|greatest|costliest|fastest|worst|best";
  for (const m of sourceText.matchAll(new RegExp(`\\b(${SUP})\\s+((?:[a-z’'-]+\\s+){1,2}?)([a-z’'-]+)\\b`, "gi"))) {
    const word = m[1].toLowerCase(), quals = m[2].trim(), noun = m[3].toLowerCase();
    if (/^(?:in|of|the|to|for|ever|and|on|at|by|that|this|from)$/i.test(noun)) continue;
    if (quals.split(/\s+/).some((q) => /^(?:in|of|the|to|for|and|on|at|by|that|this|from)$/i.test(q))) continue;
    const re = new RegExp(`\\b(${word})\\s+(${noun})\\b`, "gi");
    out = out.replace(re, (all, w) => { cuts.push(all); return `${w} ${quals} ${all.slice(w.length).trim()}`; });
  }
  return { text: out, cuts };
}

// Silent fix — UNBALANCED QUOTES (seen live: `Then he said, "You got me.` with the closing mark lost).
// Per paragraph: an opening quote with no closing partner is closed right after the end of its sentence.
export function balanceQuotes(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  const fix = (para: string, open: string, close: string) => {
    let depth = 0, lastOpen = -1;
    for (let i = 0; i < para.length; i++) {
      const ch = para[i];
      if (open === close ? ch === open : ch === open) {
        if (open === close) { depth = depth ? 0 : 1; if (depth) lastOpen = i; }
        else { depth++; lastOpen = i; }
      } else if (open !== close && ch === close && depth > 0) depth--;
    }
    if (depth <= 0 || lastOpen < 0) return para;
    const after = para.slice(lastOpen + 1);
    const m = after.match(/[.!?]/);
    const at = m ? lastOpen + 1 + (m.index as number) + 1 : para.length;
    cuts.push(para.slice(lastOpen, at));
    return para.slice(0, at) + close + para.slice(at);
  };
  const out = text.split(/\n\n/).map((p) => fix(fix(p, '"', '"'), "“", "”"));
  return { text: out.join("\n\n"), cuts };
}

// Silent fix — ORPHANED "IT SAYS". "It says he vanished." only works after a sentence naming a record,
// report, or document; when that sentence was cut, "It" points at nothing (seen live). If the previous
// sentence names no such source, the lead-in is dropped: "It says he vanished." -> "He vanished."
const IT_SAYS_RE = /^(?:and\s+)?(?:it|this|that)\s+(?:says|notes|records|reports|states|shows)\s+(?:that\s+)?/i;
const SOURCE_NOUN_RE = /\b(?:record|records|report|reporting|document|documents|file|filing|statement|indictment|complaint|source|sources|article|account|letter|note|ruling|opinion|order)\b/i;
export function fixOrphanedItSays(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  let prev = "";
  const out = text.split(/\n\n+/).map((para) => splitSentences(para).map((sn) => {
    let res = sn;
    const m = sn.match(IT_SAYS_RE);
    if (m && !SOURCE_NOUN_RE.test(prev)) {
      const rest = sn.slice(m[0].length).trim();
      if (rest.split(/\s+/).length >= 2) { res = rest[0].toUpperCase() + rest.slice(1); cuts.push(sn.trim()); }
    }
    prev = res;
    return res;
  }).join(" ").trim()).filter(Boolean);
  return { text: out.join("\n\n"), cuts };
}

// Silent fix — ENDING RE-STATES A DATE. In the last three paragraphs, when the same full date
// ("June 15, 2016") is stated in two sentences, the earlier short one goes and the closing line keeps it
// (seen live: "He was actually released ... on June 15, 2016." then the final line repeating it).
export function dedupeEndingDates(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const paras = text.split(/\n\n+/).map((p) => splitSentences(p));
  const start = Math.max(0, paras.length - 3);
  const DATE_RE = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/g;
  const occ: { p: number; s: number; date: string }[] = [];
  for (let p = start; p < paras.length; p++) paras[p].forEach((sn, s) => { for (const d of sn.match(DATE_RE) || []) occ.push({ p, s, date: d }); });
  const cuts: string[] = [];
  const byDate = new Map<string, { p: number; s: number }[]>();
  occ.forEach((o) => byDate.set(o.date, [...(byDate.get(o.date) || []), o]));
  for (const list of byDate.values()) {
    if (list.length < 2) continue;
    for (const o of list.slice(0, -1)) {
      const sn = paras[o.p][o.s];
      if (sn && sn.split(/\s+/).length <= 22) { cuts.push(sn); paras[o.p][o.s] = ""; }
    }
  }
  const out = paras.map((ss) => ss.filter(Boolean).join(" ").trim()).filter(Boolean);
  return { text: out.join("\n\n"), cuts };
}

// Silent fix — PIPELINE WORDS IN NARRATION. "the sourced reporting", "the sourced facts", "the approved
// facts" are Skripr's own vocabulary leaking into what the viewer hears (seen live, twice in one script).
export function stripPipelineWords(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  // Only Skripr's own adjectives, only before a research noun: "the sourced reporting" -> "the reporting".
  // ("cited", "available" etc. are left alone: they are ordinary words, often verbs.)
  const out = text.replace(/\b(sourced|approved)\s+(?=(?:reporting|record|records|facts|material|sources|research|documents?)\b)/gi, (all) => { cuts.push(all.trim()); return ""; });
  return { text: out, cuts };
}

// ATTRIBUTION CHECK. When a sentence credits words to someone ("the Marshals called it the longest
// successful manhunt") and those words (4+ consecutive) come from a research fact, the credited party
// must be the fact's own speaker. Seen live, repeatedly: the research says "The Guardian reported ...
// 'the longest successful manhunt'", the script says the Marshals called it that.
const ATTR_VERB = "called|described|recorded|labeled|labelled|termed|dubbed|would (?:later )?call|would (?:later )?describe|characterized|said|wrote";
function factSpeaker(fact: string): string | null {
  const m = fact.match(/^(?:according to\s+)?(.{3,70}?)\s+(?:reported|said|described|called|stated|wrote|noted|told|characterized)\b/i);
  if (!m) return null;
  const who = m[1].replace(/^(?:a|an|the)\s+/i, "").trim();
  return /[A-Z]/.test(who) ? who : null;
}
// A sentence rewrite must keep the sentence's quote balance. Sentences are split inside multi-sentence
// quotes, so a rewrite that adds or drops a quote mark breaks the pairing for the whole passage (seen
// live: 'LeFevre told reporters: "...' inserted inside an open quote).
export function quoteBalanceKept(orig: string, rw: string): boolean {
  const odd = (t: string) => ((t.match(/"/g) || []).length + (t.match(/[“”]/g) || []).length) % 2;
  return odd(orig) === odd(rw);
}

// WEEKDAY + DATE. "Wednesday, May 19, 2009" is checkable: May 19, 2009 was a Tuesday (seen live: the
// release was Tuesday May 19 and the homecoming 12:15 a.m. Wednesday; the script merged them). On a
// mismatch, keep whichever half the research backs: the weekday if the facts use it, else the date.
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function fixWeekdayDates(text: string, facts: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  const re = new RegExp(`\\b(${WEEKDAYS.join("|")}),?\\s+(${MONTHS.join("|")})\\s+(\\d{1,2}),\\s+(\\d{4})\\b`, "g");
  const out = text.replace(re, (all, wd: string, mo: string, d: string, y: string) => {
    const real = WEEKDAYS[new Date(Date.UTC(Number(y), MONTHS.indexOf(mo), Number(d))).getUTCDay()];
    if (real === wd) return all;
    cuts.push(all);
    return new RegExp(`\\b${wd}\\b`, "i").test(facts || "") ? wd : `${mo} ${d}, ${y}`;
  });
  return { text: out, cuts };
}

// WHO A REWRITE CREDITS. A fix that adds an attribution must credit the right person (seen live,
// Jones: told to attribute the gambling claim, the rewrite said "According to Jones, the gambling had
// consumed everything"; the research gives that as his former WIFE's account, and Jones's own account
// is a trading loss). Find the speaker the rewrite names; if a distinctive word of the claim appears
// in a fact spoken by someone else and in NO fact spoken by the named speaker, the credit is wrong.
const ROLE_WORDS = /\b(wife|husband|son|daughter|mother|father|brother|sister|prosecutors?|police|investigators?|authorities|officials|agents?|attorney|lawyer|neighbou?rs?|friends?|judge|family)\b/i;
const SPEAKER_STOP = new Set(["his", "her", "their", "the", "former", "ex", "a", "an", "later", "also", "then"]);
function speakerKeys(who: string): string[] {
  return who.toLowerCase().replace(/[^a-z' ]+/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !SPEAKER_STOP.has(w));
}
function namedSpeaker(sentence: string): string | null {
  // A possessive speaker must be a role ("his former wife"), never "his own" (seen live: refused a fine
  // rewrite as crediting "his own").
  const ROLE = "(?:wife|husband|son|daughter|mother|father|brother|sister|attorney|lawyer|family|neighbou?rs?|friends?|employer|boss)";
  const a = sentence.match(new RegExp(`\\b[Aa]ccording to ((?:his|her|their|the) (?:former |ex-)?${ROLE}|[A-Z][\\w.'’]+(?: [A-Z][\\w.'’]+){0,3})`));
  if (a) return a[1];
  const b = sentence.match(new RegExp(`(?:^|[,;:.]\\s+|\\bbut\\s+)((?:[Hh]is|[Hh]er|[Tt]heir|[Tt]he) (?:former |ex-)?${ROLE}|[A-Z][\\w.'’]+(?: [A-Z][\\w.'’]+){0,3}) (?:later )?(?:said|says|told|claimed|claims|insisted|maintained|described|admitted)\\b`));
  return b ? b[1] : null;
}
// A late rewrite must not introduce a NAME the research never mentions (seen live, Jones: "Ed was a
// Phoenix nurse with undeclared Nevada income" appeared after the fact check had run; the nurse is
// Clifton Goodenough). A capitalized word new to the sentence whose lowercase form appears nowhere in
// the facts or the original sentence is treated as an invented name and the rewrite is refused.
// AGE AT A DATE. "In May 2008, a 73-year-old man walked into a DMV" is checkable: the research has
// "Jones, 73" at his 2012 sentencing, so in 2008 he was about 69 (seen live on an angle card). Each fact
// stating an age and a year gives a birth-year estimate (age vs the latest year in that fact); a
// sentence pairing an age with a year is flagged when it fits no estimate but sits within 5 years of
// one (same person, wrong age). Ages of other people (a 23-year-old daughter) fit their own estimate.
const AGE_RE = /\b(\d{2})[- ]years?[- ]old\b|\b(?:aged?|now)\s+(\d{2})\b|,\s(\d{2}),/g; // "73-year-old" and "73 years old"
function agesWithYear(t: string): { age: number; year: number }[] {
  const years = (t.match(/\b(19\d{2}|20\d{2})\b/g) || []).map(Number);
  if (!years.length) return [];
  return [...t.matchAll(AGE_RE)].map((m) => Number(m[1] || m[2] || m[3])).filter((a) => a >= 15 && a <= 99).map((age) => ({ age, year: Math.max(...years) }));
}
export function ageYearMismatches(sentences: string[], facts: string): { i: number; said: number; year: number; expected: number }[] {
  const births = facts.split("\n").flatMap((f) => agesWithYear(f).map((x) => x.year - x.age));
  if (births.length < 2) return [];
  const out: { i: number; said: number; year: number; expected: number }[] = [];
  sentences.forEach((sn, i) => {
    const years = (sn.match(/\b(19\d{2}|20\d{2})\b/g) || []).map(Number);
    if (!years.length) return;
    for (const m of sn.matchAll(AGE_RE)) {
      const age = Number(m[1] || m[2] || m[3]);
      if (!(age >= 15 && age <= 99)) continue;
      const year = years[0];
      const implied = year - age;
      if (births.some((b) => Math.abs(b - implied) <= 2)) continue; // fits someone in the research
      // Supported by two or more facts agreeing, and close enough to be the same person.
      const near = births.filter((b) => Math.abs(b - implied) <= 5);
      const best = near.find((b) => births.filter((x) => Math.abs(x - b) <= 1).length >= 2);
      if (best !== undefined) out.push({ i, said: age, year, expected: year - best });
    }
  });
  return out;
}

// NOUN + 'D. "The complaint'd later describe", "benefits'd carry", "documents'd finally attached":
// a contraction on a noun reads badly aloud (seen in most runs). Pronouns keep theirs ("he'd", "it'd").
// Expanded to "had" before a past participle, else "would".
const KEEP_D = new Set(["i", "you", "he", "she", "it", "we", "they", "who", "that", "there", "what", "where", "how", "why", "which", "this", "here", "nobody", "everyone", "someone", "anyone", "no one"]);
const PARTICIPLE = /^(?:\w+(?:ed|en)|been|gone|done|made|had|got|seen|left|built|paid|sold|found|bought|told|kept|spent|lost|become|come|run|put|set|cut|let|hit|read|won|met|said|heard|held|felt|brought|thought|taught|caught|fought|sought|known|grown|shown|drawn|flown|thrown|begun|sung|swum|stood|understood|won)$/i;
export function expandNounContractions(text: string): { text: string; cuts: string[] } {
  const cuts: string[] = [];
  const out = String(text || "").replace(/\b([A-Za-z]+)['’]d\b(\s+)(?:(not|never|already|finally|later|just|also|still|once|then)\s+)?([A-Za-z]+)/g, (all, w: string, sp: string, adv: string | undefined, next: string) => {
    if (KEEP_D.has(w.toLowerCase())) return all;
    cuts.push(all);
    const aux = PARTICIPLE.test(next) ? "had" : "would";
    return `${w} ${aux}${sp}${adv ? adv + " " : ""}${next}`;
  });
  return { text: out, cuts };
}

// THE SCRIPT TALKING ABOUT ITSELF. "...belongs to the next part of this story", "the question the
// second half of this story has to answer": narration about the video's own structure, never a fact.
const STORY_META_RE = /\b(?:next|second|first|final|last|other|later|coming) (?:part|half|section|chapter|act) of (?:this|the|our) (?:story|video|script)\b|\bthis (?:video|script) (?:will|has to|must|is going to)\b/i;
// "The record says almost nothing about those early stops." (seen live, from the writer) says nothing
// a viewer can use: cut. "The record shows Jones paid $800." carries a fact: drop only the lead-in.
const RECORD_EMPTY_RE = /\b(?:the|that|this) (?:record|research|reporting|sources?) (?:is silent|says (?:almost |very little|little|nothing)|doesn't say|does not say|leaves (?:open|that open)|is thin|offers (?:no|little|nothing)|goes quiet|stops)\b|\bthat's as far as the (?:facts|record) go\b|\b(?:that's |this is )?all the (?:record|research|reporting) (?:gives|has|offers|shows)\b/i;
const RECORD_LEAD_RE = /^(?:(?:but|and|yet)\s+)?(?:what )?(?:the|his|her) (?:record|research|reporting|sources?) (?:does )?(?:says?|shows?|states?|confirms?)(?: is)?(?: that)?[:,]?\s*/i;
// Source-talk as a trailing clause: "...$47,000 reported paid to the family, and reports don't explain
// the gap." (seen live). The clause goes; the sentence stays.
const SOURCE_CLAUSE_RE = /(?:[,;]\s*(?:(?:and|but|though|although)\s+)?|\s+(?:and|but|though|although)\s+)(?:the\s+|other\s+|news\s+)?(?:reports?|sources?|records?|accounts?|reporting)\s+(?:don't|do not|doesn't|does not|never|can't|cannot)\s+(?:explain|say|resolve|account for|reconcile|clarify)\b[^.;!?]*/gi;
// "January 2008. In January 2008, a little over a year..." (seen live): a dateline line echoed by the
// next sentence's opening. Keep the sentence, drop the bare dateline.
const DATELINE_RE = /^((?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:\d{1,2},?\s+)?)?(?:19|20)\d{2})\.$/;
function dropEchoedDatelines(sentences: string[], cuts: string[]): string[] {
  return sentences.filter((sn, i) => {
    const m = sn.trim().match(DATELINE_RE);
    const next = (sentences[i + 1] || "").trim();
    if (m && new RegExp(`^(?:In|On|By|Since|Until|That|By late|By early)?\\s*${m[1].replace(/\s+/g, "\\s+")}\\b`, "i").test(next)) { cuts.push(sn.trim()); return false; }
    return true;
  });
}
export function stripStoryMeta(text: string): { text: string; cuts: string[] } {
  const cuts: string[] = [];
  text = stripSourceTags(String(text || "")).replace(SOURCE_CLAUSE_RE, (m) => { cuts.push(m.trim()); return ""; });
  const out = String(text || "").split(/\n\n+/).map((p) => splitSentences(p).flatMap((sn): string[] => {
    if (STORY_META_RE.test(sn) || RECORD_EMPTY_RE.test(sn)) { cuts.push(sn.trim()); return []; }
    const lead = sn.trim().match(RECORD_LEAD_RE);
    if (lead) { const rest = sn.trim().slice(lead[0].length); if (rest.split(/\s+/).length >= 3) { cuts.push(lead[0].trim()); return [rest[0].toUpperCase() + rest.slice(1)]; } }
    return [sn];
  })).map((ss) => dropEchoedDatelines(ss, cuts).join(" ").trim()).filter(Boolean).join("\n\n");
  return { text: out, cuts };
}

// EVENT YEARS. "July 2008. State and federal investigators arrive at the Rampart... arrested him" when
// the research has the arrest in July 2011 (seen live; the day-level date fixer never checks years).
// The research gives a year for each key event; a script sentence naming that event is checked against
// the year in force there: one in the sentence itself, else the last dateline ("July 2008.") above it.
const EVENTS: [string, RegExp][] = [
  ["arrested", /\barrest(?:ed|s)?\b|\bbusted\b|\btaken into custody\b|\bpicked (?:him|her) up\b/i],
  ["pleaded guilty", /\bplead(?:ed|s)? guilty\b|\bpled guilty\b|\bguilty plea\b/i],
  ["sentenced", /\bsentenc(?:ed|ing)\b|\bhands? down (?:a |the |his |her )?sentence\b/i],
  ["declared dead", /\bdeclared (?:him |her )?(?:legally )?dead\b/i],
  ["indicted", /\bindicted\b/i],
  ["convicted", /\bconvicted\b/i],
  ["escaped", /\bescaped\b/i],
];
const YEAR_RE = /\b(19\d{2}|20\d{2})\b/g;
export function eventYearMismatches(sentences: string[], facts: string): { i: number; event: string; said: number; research: number; missingYear?: boolean }[] {
  const factYears = new Map<string, Set<number>>();
  for (const f of facts.split(/\n|(?<=[.!?])\s+/)) {
    const ys = (f.match(YEAR_RE) || []).map(Number);
    if (ys.length !== 1) continue; // one year in the sentence, so it is unambiguously the event's
    for (const [key, re] of EVENTS) if (re.test(f)) { if (!factYears.has(key)) factYears.set(key, new Set()); factYears.get(key)!.add(ys[0]); }
  }
  const out: { i: number; event: string; said: number; research: number; missingYear?: boolean }[] = [];
  let dateline: number | null = null, sinceDateline = 99, lastYear: number | null = null;
  const MONTH_DAY = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b(?!,?\s*\d{4})/;
  sentences.forEach((sn, i) => {
    const ys = (sn.match(YEAR_RE) || []).map(Number);
    const prevYear = lastYear;
    if (ys.length) lastYear = ys[ys.length - 1];
    // A month and day with no year ("arrested him on July 19") is heard in the last year the script
    // named (seen live: right after a "May 2008" section, for a July 2011 arrest).
    if (!ys.length && MONTH_DAY.test(sn) && prevYear !== null && sinceDateline > 6) {
      for (const [key, re] of EVENTS) {
        if (!re.test(sn)) continue;
        const known = factYears.get(key);
        if (known && known.size === 1 && !known.has(prevYear)) out.push({ i, event: key, said: prevYear, research: [...known][0], missingYear: true });
      }
    }
    // A short dated line ("July 2008.", "May 10, 1979.") sets the scene's year for what follows.
    if (ys.length === 1 && sn.trim().split(/\s+/).length <= 6) { dateline = ys[0]; sinceDateline = 0; return; }
    sinceDateline++;
    const year = ys.length === 1 ? ys[0] : ys.length === 0 && sinceDateline <= 6 ? dateline : null;
    if (year === null) return;
    // Relative phrasing ("three years later", "since 2008") doesn't date the event itself.
    if (/\b(?:since|before|after|until|earlier|later|ago)\b/i.test(sn) && ys.length === 0) return;
    for (const [key, re] of EVENTS) {
      if (!re.test(sn)) continue;
      const known = factYears.get(key);
      if (!known || known.size !== 1 || known.has(year)) continue;
      out.push({ i, event: key, said: year, research: [...known][0] });
    }
  });
  return out;
}

// RE-TOLD FACTS. Sections re-explain a fact an earlier section already delivered, far from it
// (seen in most runs: "Here's where Goodenough's number came from. In 1979, Jones paid $800 for three
// documents..." three paragraphs after the $800 scene; Goodenough's IRS ordeal told three times). A
// later sentence, 2+ paragraphs away, that shares 4+ distinctive stems and most of its own content
// with an earlier one is a re-telling. The final paragraph is exempt: callbacks there are intended.
const RT_STOP = new Set(["about", "after", "again", "being", "could", "every", "first", "their", "there", "these", "those", "under", "where", "which", "while", "would", "years", "still", "never", "always", "because", "before", "other", "thing", "something", "nothing", "everything", "really", "where", "whose"]);
export function retoldFacts(sentences: string[], paraOf: number[]): { i: number; same_as: number; shared: string[] }[] {
  // Words of 5+ letters (as 6-letter stems) plus figures and years ("$800", "1979"): a re-told fact
  // usually repeats its number.
  const toks = (t: string) => new Set([
    ...(t.toLowerCase().match(/[a-z]{5,}/g) || []).filter((w) => !RT_STOP.has(w)).map((w) => w.slice(0, 6)),
    ...(t.match(/\d[\d,.]{2,}/g) || []).map((n) => n.replace(/[,.]+$/, "").replace(/,/g, "")),
  ]);
  const stems = sentences.map(toks);
  const words = sentences.map((t) => t.split(/\s+/).filter(Boolean).length);
  const lastPara = Math.max(...paraOf);
  // An earlier PARAGRAPH can hold a fact across two sentences ("paid $800" / "three documents").
  const paraStems = new Map<number, Set<string>>();
  sentences.forEach((_, k) => { const p = paraOf[k]; if (!paraStems.has(p)) paraStems.set(p, new Set()); stems[k].forEach((x) => paraStems.get(p)!.add(x)); });
  const out: { i: number; same_as: number; shared: string[] }[] = [];
  for (let j = 0; j < sentences.length; j++) {
    if (words[j] < 7 || paraOf[j] === lastPara || stems[j].size < 4) continue;
    for (let p = 0; p <= paraOf[j] - 2; p++) {
      const ps = paraStems.get(p);
      if (!ps) continue;
      const shared = [...stems[j]].filter((x) => ps.has(x));
      if (shared.length < 4 || shared.length / stems[j].size < 0.55) continue;
      // Point at the earlier sentence in that paragraph that carries most of it.
      let best = -1, bestN = -1;
      sentences.forEach((_, k) => { if (paraOf[k] !== p) return; const n = shared.filter((x) => stems[k].has(x)).length; if (n > bestN) { bestN = n; best = k; } });
      out.push({ i: j, same_as: best, shared });
      break;
    }
  }
  return out;
}

// Pipeline words in narration ("...and the research doesn't explain the gap", seen live from a
// figure fix). A rewrite may not introduce them; the viewer hears a documentary, not a fact-check.
const PIPELINE_RE = /\b(?:the|our|my|its) (?:research|fact sheet|approved facts|sources?)\b|\bthis (?:script|video)\b|\b(?:the|our) facts (?:say|show|don't|do not|give)\b|\b(?:reports?|sources?|records?|accounts?) (?:don't|do not|doesn't|does not) (?:explain|say|resolve|account for|reconcile)\b/i;
export function introducesPipelineWords(original: string, rewrite: string): boolean {
  return PIPELINE_RE.test(rewrite) && !PIPELINE_RE.test(original);
}

// SAME FIGURE GAP EXPLAINED TWICE. When two passes each explain why two figures differ ("the
// court's figure... the benefits totaled $47,000" and later "what one report put at $47,000... set at
// more than $78,600"), the viewer hears the gap twice and the two versions can disagree (seen live).
// Sentences naming the same two dollar figures, grouped by that pair, where a pair appears 2+ times.
const FIG_RE = /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|thousand))?/gi;
const figKey = (f: string) => f.replace(/[\s$,]/g, "").toLowerCase();
export function figurePairsInSentence(sn: string): string[] {
  const figs = [...new Set((sn.match(FIG_RE) || []).map(figKey))].sort();
  const out: string[] = [];
  for (let a = 0; a < figs.length; a++) for (let b = a + 1; b < figs.length; b++) out.push(`${figs[a]}|${figs[b]}`);
  return out;
}
export function repeatedFigureExplanations(sentences: string[]): { pair: string; idx: number[] }[] {
  const by = new Map<string, number[]>();
  sentences.forEach((sn, i) => figurePairsInSentence(sn).forEach((k) => { if (!by.has(k)) by.set(k, []); by.get(k)!.push(i); }));
  return [...by.entries()].filter(([, idx]) => idx.length >= 2).map(([pair, idx]) => ({ pair: pair.split("|").map((x) => "$" + x).join(" vs "), idx }));
}

// VANISHED "FOREVER". "The night before Lee Price disappeared forever" (seen live, from a card into
// the script's first line) when the research has him arrested 18 months later. The research itself can
// say "left for good"; what decides it is a later finding, so check the facts for one.
const FOREVER_RE = /\b(?:(?:vanish\w*|disappear\w*|gone|left|walked out|walked away)\b[^.!?]{0,40}?\b(?:forever|for good|permanently|never to return|never to be seen again|into thin air|without a trace|into the (?:ocean|sea|gulf|water|night))|never (?:seen|heard from|found|caught) again|(?:was|is) never (?:found|caught))\b/i;
const FOUND_RE = /\b(?:arrested|captured|caught|found alive|located|apprehended|turned (?:himself|herself) in|surrendered|resurfaced|was found)\b/i;
// When the research has him found later, the adverb simply goes: "the night before he left for good"
// -> "the night before he left" (seen live: the research's own wording, carried into the script).
export function dropForeverAdverbs(text: string, facts: string): { text: string; cuts: string[] } {
  const cuts: string[] = [];
  if (!FOUND_RE.test(facts || "")) return { text, cuts };
  const out = String(text || "").replace(/\b(vanish\w*|disappear\w*|left|gone|walked out|walked away)(\s[^.!?]{0,25}?)?\s+(?:forever|for good|permanently)\b/gi, (all, verb: string, mid: string | undefined) => { cuts.push(all); return `${verb}${mid || ""}`; });
  return { text: out, cuts };
}
export function foreverContradicted(text: string, facts: string): string | null {
  const m = String(text || "").match(FOREVER_RE);
  if (!m || !FOUND_RE.test(facts || "")) return null;
  return m[0];
}

// MINORS. A person the research shows was under 18 at the time is referred to by relationship, not
// by name (seen live: a 17-year-old daughter named in a card and throughout the script). The research
// gives the age ("Hannah Price was seventeen years old") and the relationship ("her father").
const TEEN_WORDS: Record<string, number> = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17 };
export function minorsInFacts(facts: string): { name: string; first: string; relation: string }[] {
  const out = new Map<string, { name: string; first: string; relation: string }>();
  const lines = String(facts || "").split("\n");
  const ageOf = (t: string) => (/^\d+$/.test(t) ? Number(t) : TEEN_WORDS[t.toLowerCase()] ?? 99);
  const AGE = "(\\d{1,2}|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)";
  const found: { name: string }[] = [];
  for (const l of lines) {
    for (const m of l.matchAll(new RegExp(`\\b([A-Z][a-z]+(?: [A-Z][a-z]+)?)(?:,| was| who was|, who was)\\s+${AGE}(?:[- ]years?[- ]old)?\\b`, "g"))) if (ageOf(m[2]) < 18) found.push({ name: m[1] });
    for (const m of l.matchAll(new RegExp(`\\b(?:his|her|their) ${AGE}-year-old (?:daughter|son|stepdaughter|stepson|niece|nephew|granddaughter|grandson),? ([A-Z][a-z]+)`, "g"))) if (ageOf(m[1]) < 18) found.push({ name: m[2] });
  }
  for (const f of found) {
    const first = f.name.split(" ")[0];
    if (out.has(first)) continue;
    const withName = lines.filter((l) => l.includes(first));
    let relation = "";
    for (const l of withName) {
      const r1 = l.match(new RegExp(`\\b([Hh]is|[Hh]er) (daughter|son|stepdaughter|stepson|niece|nephew|granddaughter|grandson),? ${escRe(first)}\\b`));
      if (r1) { relation = `${r1[1].toLowerCase()} ${r1[2]}`; break; }
      const r2 = l.match(new RegExp(`\\b${escRe(first)}\\b[^.]{0,80}?\\b(her|his) (father|mother)\\b`));
      if (r2) { relation = `${r2[2] === "father" ? "his" : "her"} ${r2[1] === "her" ? "daughter" : "son"}`; break; }
    }
    if (relation) out.set(first, { name: f.name, first, relation });
  }
  return [...out.values()];
}
// FAMILY MEMBERS. Cards never name the subject's family (private people; seen live: his son and his
// 17-year-old daughter named in every batch, the daughter as the opening image in four cards). The
// research gives the relationship ("his oldest son Nathan", "Nathan, his son").
const REL = "son|daughter|wife|husband|mother|father|brother|sister|stepson|stepdaughter|grandson|granddaughter|fiancee|fiance|girlfriend|boyfriend|children";
export function familyInFacts(facts: string, subject = ""): { name: string; first: string; relation: string }[] {
  const out = new Map<string, { name: string; first: string; relation: string }>();
  const text = String(facts || "");
  // The subject is nobody's "family member" here ("his son Lee" is the subject, as his father's son).
  const self = new Set(String(subject).split(/\s+/).filter((w) => /^[A-Z]/.test(w)));
  // "Her husband, Charles Darby" opens a sentence too: match His/Her in either case.
  for (const m of text.matchAll(new RegExp(`\\b([Hh]is|[Hh]er) (?:oldest |eldest |youngest |middle |late |former |ex-)?(${REL}),? ([A-Z][a-z]+)(?: ([A-Z][a-z]+))?`, "g"))) {
    const first = m[3]; if (out.has(first) || m[2] === "children" || self.has(first)) continue;
    out.set(first, { name: m[4] ? `${first} ${m[4]}` : first, first, relation: `${m[1].toLowerCase()} ${m[2]}` });
  }
  for (const m of text.matchAll(new RegExp(`\\b([A-Z][a-z]+)(?: ([A-Z][a-z]+))?, (his|her) (?:oldest |eldest |youngest |middle |former |ex-)?(${REL})\\b`, "g"))) {
    const first = m[1]; if (out.has(first) || m[4] === "children" || self.has(first)) continue;
    out.set(first, { name: m[2] ? `${first} ${m[2]}` : first, first, relation: `${m[3]} ${m[4]}` });
  }
  for (const mn of minorsInFacts(text)) if (!out.has(mn.first) && !self.has(mn.first)) out.set(mn.first, mn);
  return [...out.values()];
}
// Names go into patterns: escape them (seen live: topic "The Housewife of Pulaski (The Story of Linda Darby)"
// gave the surname "Darby)" and the unescaped ")" crashed the whole card page).
const escRe = (t: string) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function replacePeople(text: string, people: { name: string; first: string; relation: string }[], cuts: string[], surname = ""): string {
  let out = String(text || "");
  for (const mn of people) {
    const forms = [...new Set([mn.name, surname ? `${mn.first} ${surname}` : "", mn.first].filter(Boolean))].sort((a, b) => b.length - a.length);
    for (const form of forms) {
      // "his oldest son Nathan": the relationship is already said, so the name just goes.
      out = out.replace(new RegExp(`\\b((?:oldest |eldest |youngest |middle )?(?:${REL}))(,)? ${escRe(form).replace(/ /g, "\\s+")}\\b`, "g"), (all, rel: string) => { cuts.push(all); return rel; });
      out = out.replace(new RegExp(`(^|[.!?]\\s+|\\n\\s*|"|“)?\\b${escRe(form).replace(/ /g, "\\s+")}(['’]s)?\\b`, "g"), (all, lead: string | undefined, poss: string | undefined) => {
        cuts.push(all.trim());
        const rel = lead !== undefined && lead !== "" ? mn.relation[0].toUpperCase() + mn.relation.slice(1) : mn.relation;
        return `${lead ?? ""}${rel}${poss ?? ""}`;
      });
    }
  }
  return out.replace(/\b(his|her) (son|daughter|wife|husband|mother|father|brother|sister)(?:,)? (?:his|her) (?:oldest |youngest )?\2\b/gi, "$1 $2");
}
// CHANNEL POLICY (user, 2026-10-05): only people who were MINORS at the time of the events are kept
// anonymous ("his daughter"). Adult family members on the public record may be named (a victim's child
// later quoted as an adult, a spouse who testified), as in any documentary. Name kept for its callers.
export function replaceFamilyNames(text: string, facts: string, subject = ""): { text: string; cuts: string[] } {
  const cuts: string[] = [];
  // Last real word of the subject, punctuation stripped ("(The Story of Linda Darby)" -> "Darby").
  const surname = (String(subject).match(/[A-Za-z][A-Za-z'’-]*/g) || []).pop() || "";
  const self = new Set(String(subject).split(/\s+/).filter((w) => /^[A-Z]/.test(w)));
  const minors = minorsInFacts(facts).filter((m) => !self.has(m.first));
  return { text: replacePeople(text, minors, cuts, /^[A-Z]/.test(surname) ? surname : ""), cuts };
}

export function replaceMinorNames(text: string, facts: string): { text: string; cuts: string[] } {
  const cuts: string[] = [];
  let out = String(text || "");
  for (const mn of minorsInFacts(facts)) {
    const forms = [...new Set([mn.name, mn.first])].sort((a, b) => b.length - a.length);
    for (const form of forms) {
      out = out.replace(new RegExp(`(^|[.!?]\\s+|\\n\\s*|"|“)?\\b${escRe(form).replace(/ /g, "\\s+")}(['’]s)?\\b`, "g"), (all, lead: string | undefined, poss: string | undefined) => {
        cuts.push(all.trim());
        const rel = lead !== undefined && lead !== "" ? mn.relation[0].toUpperCase() + mn.relation.slice(1) : mn.relation;
        return `${lead ?? ""}${rel}${poss ?? ""}`;
      });
    }
  }
  // "his daughter Hannah" style leftovers become "his daughter his daughter": collapse.
  out = out.replace(/\b(his|her) (daughter|son)(?:,)? (?:his|her) \2\b/gi, "$1 $2");
  return { text: out, cuts };
}

// SOURCE-TYPE TAGS. A fact that comes only from the subject's own account (his memoir, interviews,
// letters) or his family's account has to be attributed when it's told (seen live: "contemplated
// jumping", "a rock near a foreign border", "crossed a border" stated as established). Tag those facts
// where they enter the pipeline so every writer and checker sees it, instead of guessing from wording.
export const OWN_TAG = "[his own account]";
export const FAMILY_TAG = "[family account]";
const SAY = "(?:wrote|writes|said|says|told|tells|recalled|recalls|described|describes|claimed|claims|admitted|admits|explained|insisted|insists|later wrote|later said)";
export function tagFactSources(text: string, subject = ""): string {
  const surname = (String(subject).trim().split(/\s+/).pop() || "").replace(/[^A-Za-z'-]/g, "");
  const familyRe = new RegExp(`\\b(?:his|her|their) (?:former |ex-|late )?(?:wife|husband|son|daughter|father|mother|brother|sister|children|family)\\b[^.]{0,80}?\\b${SAY}\\b|\\b(?:wife|husband|son|daughter|father|mother|brother|sister)\\b,? [A-Z][a-z]+(?: [A-Z][a-z]+)?,? ${SAY}\\b|\\b${SAY}\\b[^.]{0,40}\\b(?:of )?(?:her|his) (?:father|mother|husband|wife|son|daughter)\\b`, "i");
  // The subject as speaker: his surname NOT preceded by another first name ("Jim Price told..." is his
  // father), or his own first/middle name before it.
  const own = String(subject).trim().split(/\s+/).filter((w) => /^[A-Z]/.test(w));
  const firsts = own.slice(0, -1).join("|");
  const subj = surname ? `(?:${firsts ? `(?:${firsts}) ` : ""}${surname}|(?<![A-Z][a-z]+ )${surname})` : "";
  const ownRe = new RegExp(`(?:${subj ? subj + "|" : ""}\\bhe|\\bshe)\\b(?:\\s+(?:later|also|then|once|himself|herself))?\\s+${SAY}\\b|\\b(?:his|her) (?:own |unpublished )?(?:memoir|diary|book|journal|manuscript)\\b|\\bby (?:his|her) (?:own )?account\\b|\\bin (?:an|his|her) interview\\b`, "i");
  return String(text || "").split("\n").map((line) => {
    const body = line.replace(/^\s*-\s*/, "");
    if (!body.trim() || /^\s*\[/.test(body) || line.includes(OWN_TAG) || line.includes(FAMILY_TAG)) return line;
    const lead = line.slice(0, line.length - body.length);
    if (familyRe.test(body)) return `${lead}${FAMILY_TAG} ${body}`;
    if (ownRe.test(body)) return `${lead}${OWN_TAG} ${body}`;
    return line;
  }).join("\n");
}
export function stripSourceTags(text: string): string {
  return String(text || "").replace(/\s*\[(?:his|her|their) own account\]\s*|\s*\[family account\]\s*/gi, " ").replace(/ {2,}/g, " ").replace(/ ([.,;:!?])/g, "$1");
}

// GROUP WORDS. "Turns a Congregation Into Victims", "Robbed His Own Flock" when the research says
// "many of whom had come through his church" (seen live, three batches). A group noun the research never
// uses is a group the research never named.
const GROUP_WORDS = ["congregation", "congregants", "flock", "parishioners", "church members", "churchgoers", "his whole church", "the whole town", "the entire town", "neighbors", "the community"];
export function unsupportedGroupWords(text: string, facts: string): string[] {
  const t = String(text || "").toLowerCase(), f = String(facts || "").toLowerCase();
  return GROUP_WORDS.filter((g) => new RegExp(`\\b${g}\\b`).test(t) && !new RegExp(`\\b${g}\\b`).test(f));
}

// LINKED FIGURES. "He raised $40 million, and by May 2012, $480,000 of it was left" (seen live): the
// $480,000 was what remained of the $36.9 million in one trading account, a different fact. Two dollar
// figures joined in one sentence must appear together in at least one research fact.
function moneyValues(t: string): number[] {
  const out: number[] = [];
  for (const m of String(t).matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)\s*(million|billion|thousand|[mbk]\b)?/gi)) {
    let v = parseFloat(m[1].replace(/,/g, ""));
    const u = (m[2] || "").toLowerCase();
    if (u.startsWith("b")) v *= 1e9; else if (u.startsWith("m")) v *= 1e6; else if (u.startsWith("t") || u === "k") v *= 1e3;
    if (v > 0) out.push(v);
  }
  return [...new Set(out)];
}
export function unlinkedFigures(text: string, facts: string): { sentence: string; figures: string[] }[] {
  const factVals = String(facts || "").split(/\n|(?<=[.!?])\s+/).map(moneyValues).filter((v) => v.length >= 2);
  const close = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b) < 0.02;
  const out: { sentence: string; figures: string[] }[] = [];
  for (const sn of String(text || "").split(/(?<=[.!?])\s+/)) {
    const vals = moneyValues(sn);
    if (vals.length < 2) continue;
    for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) {
      const fmt = (v: number) => `$${v >= 1e6 ? +(v / 1e6).toFixed(1) + " million" : v.toLocaleString("en-US")}`;
      const shared = factVals.filter((fv) => fv.some((x) => close(x, vals[i])) && fv.some((x) => close(x, vals[j])));
      if (!shared.length) { out.push({ sentence: sn.trim(), figures: [vals[i], vals[j]].map(fmt) }); i = vals.length; break; }
      // Together in a fact, but only alongside a figure BETWEEN them that the sentence leaves out ("raised
      // $40 million, $36.9 million of which went into an account; $480,000 was left"): the small figure
      // belongs to the middle one, not the total.
      const lo = Math.min(vals[i], vals[j]), hi = Math.max(vals[i], vals[j]);
      const middles = shared.map((fv) => fv.filter((x) => x > lo * 1.02 && x < hi * 0.98 && !vals.some((v) => close(v, x))));
      if (middles.every((m) => m.length)) { out.push({ sentence: sn.trim(), figures: [vals[i], vals[j]].map(fmt).concat(`(the research ties them through ${fmt(middles[0][0])})`) }); i = vals.length; break; }
    }
  }
  return out;
}

// "MOST WANTED". "The FBI placed him on their most wanted list" reads as the Ten Most Wanted list; the
// research says "one of their most wanted fugitives" (seen live). Use the research's wording.
export function fixMostWantedWording(text: string, facts: string): { text: string; cuts: string[] } {
  const cuts: string[] = [];
  if (/ten most wanted/i.test(facts || "")) return { text, cuts };
  const out = String(text || "")
    .replace(/\b(placed|put|added|listed) (him )?(?:on|to) (?:the FBI['’]s |their |its |the )?(?:ten )?most[- ]wanted list\b/gi, (all, verb: string) => { cuts.push(all); return `listed him as one of its most wanted fugitives`; })
    .replace(/\b(?:an |a )?FBI most[- ]wanted fugitive\b/gi, (all) => { cuts.push(all); return "a fugitive the FBI was hunting"; })
    .replace(/\b(?:on|to) (?:the FBI['’]s|their|its) most[- ]wanted list\b/gi, (all) => { cuts.push(all); return "among the FBI's most wanted fugitives"; });
  return { text: out, cuts };
}

// GROUNDED PHRASE. A short story beat ("the New Year's Eve traffic stop in Glynn County") is grounded when one
// research fact carries most of its content words or numbers. Used to keep a card's payoff pointing only at
// moments that exist (seen in the card benchmark: payoffs promising "sourced quotes from family", "his
// congressional testimony", "why the myth survived" when the research had none of it).
export function groundedInFacts(phrase: string, facts: string): boolean {
  const toks = (t: string) => new Set([
    ...(String(t).toLowerCase().match(/[a-z]{5,}/g) || []).filter((w) => !["about", "after", "their", "there", "which", "while", "would", "where", "before", "other", "video", "story", "moment", "lands", "middle"].includes(w)).map((w) => w.slice(0, 6)),
    ...(String(t).match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]+$/, "").replace(/,/g, "")),
  ]);
  const p = toks(phrase);
  if (p.size < 2) return true; // too short to judge
  const lines = String(facts || "").split(/\n|(?<=[.!?])\s+(?=[A-Z])/);
  return lines.some((l) => { const f = toks(l); let n = 0; p.forEach((x) => { if (f.has(x)) n++; }); return n / p.size >= 0.5; });
}

export function introducesUnsupportedName(original: string, rewrite: string, facts: string): string | null {
  const low = (facts + " " + original).toLowerCase();
  const hay = ` ${low.replace(/[^a-z0-9' ]+/g, " ")} ${low.replace(/[^a-z0-9 ]+/g, " ")} `; // "O'Hare" also counts as "hare"
  for (const w of rewrite.match(/\b[A-Z][a-z]{1,}\b/g) || []) {
    // Ordinary words that open a sentence ("Approximately", "Garnished", "Eventually") are not names.
    if (w.length > 4 && /(?:ly|ed|ing|tion|ment|ness|ous|ive|able)$/.test(w)) continue;
    if (!hay.includes(` ${w.toLowerCase()} `)) return w;
  }
  return null;
}

export function attributionMismatch(original: string, rewrite: string, factLines: string[]): string | null {
  const spoken = factLines.map((f) => ({ f: f.toLowerCase(), who: factSpeaker(f) })).filter((x) => x.who);
  const origKeys = speakerKeys(namedSpeaker(original) || "").join(" ");
  // One clause per speaker: "Jones told authorities X; his former wife told investigators Y" credits
  // two people, each with their own claim.
  for (const clause of rewrite.split(/;\s+|,\s+but\s+|\.\s+/)) {
    const who = namedSpeaker(clause);
    if (!who) continue;
    const keys = speakerKeys(who);
    if (!keys.length || keys.join(" ") === origKeys) continue; // credit unchanged
    const bySelf = spoken.filter((x) => speakerKeys(x.who!).some((k) => keys.includes(k)));
    const byOther = spoken.filter((x) => !speakerKeys(x.who!).some((k) => keys.includes(k)) && (ROLE_WORDS.test(x.who!) || /[A-Z]/.test(x.who!)));
    // The claim only: drop the attribution itself and who it was told to.
    const claim = clause.toLowerCase().replace(/\baccording to [^,]+,?/, " ").replace(/\b(?:said|says|told|claimed|claims|insisted|maintained|described|admitted)\b(?:\s+(?:investigators|authorities|police|reporters|officials|agents|the court|prosecutors))?/g, " ");
    const stems = [...new Set((claim.match(/[a-z]{7,}/g) || []).map((w) => w.slice(0, 6)))];
    for (const st of stems) {
      if (keys.some((k) => k.startsWith(st))) continue;
      const inOther = byOther.find((x) => x.f.includes(st));
      if (inOther && !bySelf.some((x) => x.f.includes(st))) return `credits "${who}" with "${st}…", which the research gives as ${inOther.who}'s account`;
    }
  }
  return null;
}

export function misattributedPhrases(sentences: string[], facts: string[]): { i: number; credited: string; phrase: string; speaker: string }[] {
  const out: { i: number; credited: string; phrase: string; speaker: string }[] = [];
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const factN = facts.map((f) => ({ f, n: norm(f), who: factSpeaker(f) })).filter((x) => x.who);
  sentences.forEach((sn, i) => {
    const m = sn.match(new RegExp(`((?:the\\s+)?(?:u\\.s\\.\\s+)?[A-Za-z][\\w.' ]{1,40}?)\\s+(?:${ATTR_VERB})\\b`, "i"));
    if (!m) return;
    const credited = m[1].trim();
    // A pronoun ("she said", "which she described") points back to whoever the narration last named;
    // it can't be judged here (seen live: "credited to she" forced a rewrite that broke a quote).
    if (/(?:^|\s)(?:he|she|they|it|we|i)(?:\s+(?:also|then|later|once|again|still|even|had|has|would))?$/i.test(credited)) return;
    const w = norm(sn).split(" ");
    for (const x of factN) {
      let phrase = "";
      for (let a = 0; a + 4 <= w.length && !phrase; a++) { const g = w.slice(a, a + 5).join(" "); if (g.split(" ").length >= 4 && x.n.includes(g)) phrase = g; }
      if (!phrase) continue;
      // Names are often short words ("Jim Cox"): any non-numeric word of 3+ letters counts. (A 4+ letter
      // filter flagged Jim Cox's own quotes as misattributed and forced garbling rewrites.)
      const whoWords = norm(x.who!).split(" ").filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !["the", "and", "for", "said", "says"].includes(t));
      const credN = norm(credited);
      if (whoWords.some((t) => credN.includes(t))) return; // credited correctly
      out.push({ i, credited, phrase, speaker: x.who! });
      return;
    }
  });
  return out;
}

export function stripFactMetaLeaks(text: string): { text: string; cuts: string[] } {
  if (!text) return { text, cuts: [] };
  const cuts: string[] = [];
  const outParas = text.split(/\n\n+/).map((para) => {
    const kept = splitSentences(para).filter((s) => {
      if (FACT_META_PATTERNS.some((re) => re.test(s))) { cuts.push(s.trim()); return false; }
      return true;
    });
    return kept.join(" ").trim();
  }).filter((p) => p.length > 0);
  return { text: outParas.join("\n\n"), cuts };
}

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
    const kept = splitSentences(para).filter((s) => {
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
    for (const raw of splitSentences(p)) { const s = raw.trim(); if (s) flat.push({ p: pi, s }); }
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
  const restatesAKept = (idx: number, keepIdxs: number[]) => keepIdxs.some((k) => tokenOverlap(flat[idx].s, flat[k].s) >= 0.6);
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
        // CAP: keep the 2 most elaborated occurrences and cut ONLY the restatements that are a bare
        // beat OR a genuine near-duplicate (cutEligible). We do NOT blanket-cut long, distinct-content
        // sentences that merely share the figure — the LLM semantic-refine pass runs BEFORE this and
        // already removed true semantic dups, so a blanket figure cut here just double-cuts distinct
        // prose and guts length below what the bounded refill can rebuild (the shortfall oscillation).
        for (const k of occ) {
          if (keep.has(k)) { protectKeep.add(k); continue; }
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

  // DETECTOR E — a repeated verbatim QUOTE or ENUMERATION (a recurring content shingle). Figures are
  // handled above, but the Williams quote ("stolen millions that should have been allocated...") and
  // the four-platform list recurred 3-4x and slipped every prior detector (not a figure, not a whole
  // near-verbatim sentence, not a single proper-noun span). This finds a distinctive 6-content-word
  // shingle appearing in 3+ sentences and caps it at first mention + one callback — the same cap as
  // figures, so a drummed quote or list collapses to two.
  const STOP = new Set(["the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "that", "this", "was", "were", "is", "are", "had", "has", "have", "it", "its", "as", "at", "by", "from", "he", "she", "they", "his", "her", "their", "which", "who", "been", "be"]);
  const shingleKey = (s: string): string[] => {
    const words = normalizeForCompare(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
    const out: string[] = [];
    for (let i = 0; i + 6 <= words.length; i++) out.push(words.slice(i, i + 6).join(" "));
    return out;
  };
  const shingleOcc = new Map<string, Set<number>>();
  flat.forEach((f, idx) => {
    if (remove.has(idx)) return;
    for (const sh of new Set(shingleKey(f.s))) {
      if (!shingleOcc.has(sh)) shingleOcc.set(sh, new Set());
      shingleOcc.get(sh)!.add(idx);
    }
  });
  const shingleHandled = new Set<number>();
  for (const [, idxSet] of shingleOcc) {
    const occ = [...idxSet].filter((k) => !remove.has(k) && !shingleHandled.has(k));
    if (occ.length < 3) continue;
    occ.forEach((k) => shingleHandled.add(k));
    const byLen = [...occ].sort((a, b) => flat[b].s.length - flat[a].s.length);
    const keep = new Set(byLen.slice(0, 2));
    for (const k of occ) {
      if (keep.has(k)) { protectKeep.add(k); continue; }
      if (protectKeep.has(k)) continue;
      remove.add(k); cuts.push(`repetition (quote/list): ${flat[k].s}`);
    }
  }

  // DETECTOR F — a recurring MULTI-NUMBER CALCULATION treated as one anchor. The "52 accounts x 20
  // bots x 636 songs -> 661,440 streams" walk was restated in the early, AI, Spotify and forfeiture
  // sections; each restatement carries the same set of small numbers (52/20/636) that the figure
  // detector (>= 1000 only) ignores, and varied wrappers that the shingle detector misses. Signature
  // = a sentence's set of numeric VALUES; sentences sharing 3+ of the same numbers cluster, capped at
  // first mention + one callback.
  const sentNums: number[][] = flat.map((f) => {
    const vals = [...digitNumbersIn(f.s).map((d) => d.value), ...spelledNumbersIn(f.s).map((s) => s.value)]
      .filter((v) => Number.isFinite(v) && !(Number.isInteger(v) && v >= 1900 && v <= 2100)); // drop bare years
    return [...new Set(vals)];
  });
  const calcHandled = new Set<number>();
  for (let i = 0; i < flat.length; i++) {
    if (remove.has(i) || calcHandled.has(i) || sentNums[i].length < 3) continue;
    const occ = flat.map((_, idx) => idx).filter((idx) => {
      if (remove.has(idx) || sentNums[idx].length < 3) return false;
      const shared = sentNums[idx].filter((v) => sentNums[i].some((x) => numbersMatch(x, v))).length;
      return shared >= 3; // same 3+ numbers => the same calculation
    });
    if (occ.length < 3) continue;
    occ.forEach((k) => calcHandled.add(k));
    const byLen = [...occ].sort((a, b) => flat[b].s.length - flat[a].s.length);
    const keep = new Set(byLen.slice(0, 2));
    for (const k of occ) {
      if (keep.has(k)) { protectKeep.add(k); continue; }
      if (protectKeep.has(k)) continue;
      remove.add(k); cuts.push(`repetition (calculation): ${flat[k].s}`);
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
    const parts = splitSentences(p).filter(Boolean);
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

// HOOK CRAFT (code checks on an angle card). The hook benchmark showed three repeat failures: the
// title or hook answers its own question (half the cards), the strongest fact stays in the research,
// and vague hedges stand in for a specific ("found a way to exploit", "bigger than most people realize").
// Each issue is phrased as an instruction the repair pass can act on.
export const VAGUE_HOOK_RE = /\b(found a way to|more than (?:most )?(?:people|anyone|you) (?:realize|think|know)|bigger than (?:most )?(?:people|you) (?:realize|think)|what (?:he|she|they) did next|nobody (?:could have )?(?:expected|saw (?:it|this) coming)|everything changed|you won'?t believe|something (?:shocking|incredible|unbelievable|strange)|the truth (?:is|was) (?:darker|stranger|worse)|more complicated than|isn'?t what you think|not what (?:it|you) (?:seems|think))\b/i;
export const WEAK_OPENING_RE = /^(?:for (?:decades|years|centuries)\b|imagine\b|this is the story of|in this video|have you ever|meet\b|what if i told you|today,? we|let'?s talk about|everyone knows|throughout history|once upon)/i;
const CRAFT_STOP = new Set(["with", "from", "that", "this", "when", "then", "they", "them", "their", "into", "over", "were", "been", "have", "than", "more", "only", "just", "what", "how", "story", "video", "about", "after", "their", "there", "these", "which", "while", "would", "years", "where", "before", "never", "every", "under", "still", "other", "first", "later", "being", "money", "million", "billion", "through"]);
const craftStems = (t: string, drop: Set<string>) => new Set((String(t).toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => !CRAFT_STOP.has(w)).map((w) => w.slice(0, 6)).filter((w) => !drop.has(w)));
export function hookCraftIssues(c: { hookPremise?: string; titleSuggestion?: string; payoffMoment?: string; hookFact?: string; reveal?: string; hookFactsText?: string[] }, topic: string, opts: { lockedTitle?: boolean } = {}): string[] {
  const out: string[] = [];
  const hook = String(c.hookPremise || "").trim();
  const title = opts.lockedTitle ? "" : String(c.titleSuggestion || "");
  const v = `${hook} ${title}`.match(VAGUE_HOOK_RE);
  if (v) out.push(`"${v[0]}" is a vague stand-in: replace it with the specific fact it hides`);
  if (WEAK_OPENING_RE.test(hook)) out.push("the hook opens with a stock phrase: open on the event, the contradiction, or the hard fact");
  // Give-away: the title or hook already contains the payoff moment (seen: "Caught at a New Year's Eve
  // Traffic Stop" whose payoff is that traffic stop). Words of the subject and of the hook fact don't count.
  const drop = new Set([...craftStems(topic, new Set()), ...craftStems(String(c.hookFact || ""), new Set())]);
  const pay = craftStems(String(c.payoffMoment || ""), drop);
  if (pay.size >= 2) {
    const inTitle = [...pay].filter((w) => craftStems(title, new Set()).has(w)).length;
    const inHook = [...pay].filter((w) => craftStems(hook, new Set()).has(w)).length;
    if (inTitle >= 2) out.push("the title gives away the ending (it names the payoff moment): name the event and the stakes, keep how it ends for the video");
    else if (inHook >= 3 && inHook / pay.size >= 0.5) out.push("the hook gives away the ending (it names the payoff moment): set up the question, keep the answer for the video");
  }
  // The spine's PAYOFF REVEAL (one research fact) stated in the title or hook. Only words the reveal has
  // and the hook facts don't count, so a hook that rightly uses its own facts is never flagged for it.
  if (c.reveal && !out.some((x) => /gives away/.test(x))) {
    const allowed = new Set([...drop, ...craftStems((c.hookFactsText || []).join(" "), new Set())]);
    const rev = craftStems(c.reveal, allowed);
    if (rev.size >= 2) {
      const inT = [...rev].filter((w) => craftStems(title, new Set()).has(w)).length;
      const inH = [...rev].filter((w) => craftStems(hook, new Set()).has(w)).length;
      if (inT >= 2) out.push(`the title gives away the payoff (${c.reveal.slice(0, 90)}): name the premise or the event instead`);
      else if (inH >= 3 && inH / rev.size >= 0.4) out.push(`the hook gives away the payoff (${c.reveal.slice(0, 90)}): cut it and keep the hook on its hook facts`);
    }
  }
  // The hook carries its strongest hard number.
  const factNums = (String(c.hookFact || "").match(/\$?\d[\d,.]*(?:\s?(?:million|billion|percent|%))?/g) || []).map((n) => n.replace(/[^\d.]/g, "").replace(/\.$/, "")).filter((n) => n.length >= 2);
  if (factNums.length && !factNums.some((n) => hook.replace(/,/g, "").includes(n))) out.push(`the hook leaves out its strongest fact (${String(c.hookFact).slice(0, 90)}): put that figure in the hook in plain words`);
  return out;
}
