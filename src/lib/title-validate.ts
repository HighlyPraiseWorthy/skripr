// Universal, DETERMINISTIC title/scoring validator for Viral Magnet (and reusable
// by Metadata/Titles later). The point: never let the LLM discover that the cheapest
// path to a high score is to exaggerate. Accuracy + Story Fit are hard gates, Pull
// can never rescue a bad title, and unsupported exclusivity / institutional-victory
// framing get flagged in code rather than trusted to the model.

export interface TitleScores {
  pull?: number;
  naturalness?: number;
  accuracy?: number;
  curiosity?: number;
  storyFit?: number;
  specificity?: number;
}

// Overall weighting. Specificity is a real driver ("23 years" beats "quietly"), so it
// carries weight; Pull stays the smallest so click-power never outweighs truth + fit.
// weightedOverall renormalizes over whatever dimensions are present, so magnet scores
// (which may omit specificity) rank consistently against title scores that include it.
export function weightedOverall(s: TitleScores | undefined): number | null {
  if (!s) return null;
  const w: [keyof TitleScores, number][] = [
    ["curiosity", 0.22],
    ["storyFit", 0.22],
    ["naturalness", 0.18],
    ["accuracy", 0.18],
    ["specificity", 0.12],
    ["pull", 0.08],
  ];
  let sum = 0;
  let weight = 0;
  for (const [k, wt] of w) {
    const v = s[k];
    if (typeof v === "number") {
      sum += v * wt;
      weight += wt;
    }
  }
  if (weight === 0) return null;
  // Renormalize if some dimensions are missing so the scale stays 0-10.
  return Math.round((sum / weight) * 10) / 10;
}

// Hard gates: a title failing any of these CANNOT be ranked #1 (Best Overall).
export function passesGates(s: TitleScores | undefined): boolean {
  if (!s) return false;
  const gate = (v: number | undefined) => typeof v === "number" && v >= 8;
  return gate(s.accuracy) && gate(s.naturalness) && gate(s.storyFit);
}

// Unsupported exclusivity/superlative claims. Not inherently wrong, but they assert
// something about the whole world that the research usually hasn't established.
const EXCLUSIVITY: { re: RegExp; label: string }[] = [
  { re: /\bnobody (?:knows|talks about|remembers|noticed)\b/i, label: "“nobody…” claim" },
  { re: /\bno one (?:knows|saw (?:this |it )?coming|noticed|talks about)\b/i, label: "“no one…” claim" },
  { re: /\bthe (?:only|first|last)\b/i, label: "only/first/last claim" },
  { re: /\bnever before\b/i, label: "“never before” claim" },
  { re: /\b(?:everyone|everybody) (?:knows|missed|got (?:it )?wrong)\b/i, label: "“everyone…” claim" },
  { re: /\bcompletely (?:changed|destroyed|impossible|unknown)\b/i, label: "absolute “completely…” claim" },
  { re: /\bnobody expected\b/i, label: "“nobody expected” claim" },
  { re: /\bnobody (?:knew|realized|suspected)\b/i, label: "“nobody knew” claim" },
  { re: /\bnobody (?:thought|bothered|cared|wanted|knew) to (?:look|check|ask)\b/i, label: "“nobody thought to look” claim" },
  { re: /\bno one (?:thought|bothered|cared) to (?:look|check|ask)\b/i, label: "“no one thought to look” claim" },
  { re: /\bwithout (?:anyone|anybody) (?:knowing|noticing|realizing)\b/i, label: "“without anyone knowing” claim" },
  { re: /\b(?:completely |totally )?undetected\b/i, label: "“undetected” absolute" },
  { re: /\b(?:completely |totally )?invisible\b/i, label: "“invisible” absolute" },
  { re: /\bno one suspected\b/i, label: "“no one suspected” claim" },
  { re: /\bnever (?:found|caught|arrested|identified|discovered)\b/i, label: "“never found/caught” claim (contradicted if they were eventually caught)" },
  { re: /\bfooled (?:the )?(?:fbi|cia|police|everyone|the world)\b/i, label: "“fooled the…” claim" },
  { re: /\boutsmart(?:ed)? (?:the )?authorities\b/i, label: "“outsmarted authorities” claim" },
  { re: /\bmost (?:forgotten|unknown|mysterious|shocking)\b/i, label: "“most…” superlative" },
  { re: /\bmost \w+ imaginable\b/i, label: "“most … imaginable” superlative" },
  { re: /\bthe (?:whole|entire) time\b/i, label: "“the whole time” temporal absolute" },
  { re: /\ball (?:along|the while)\b/i, label: "“all along” temporal absolute" },
  { re: /\bit was all (?:a|an|just a|one big)\b/i, label: "“it was all a…” fabrication absolute" },
  { re: /\bnever left (?:the )?(?:country|the us|the u\.s\.|the states|america|town|the city)\b/i, label: "“never left…” geographic absolute" },
  { re: /\b(?:looking|searched|hunting|hunted|looked) (?:for (?:her|him|them) )?everywhere\b/i, label: "“everywhere” absolute" },
  { re: /\b(?:biggest|greatest|worst|strangest|craziest|deadliest)\b.*\bin (?:history|the world|america)\b/i, label: "“…in history” superlative" },
];

// Institutional framing, GRADED. "Beat the FBI" is a fair interpretive packaging of a
// legal win; "defeated / outsmarted / humiliated the FBI" asserts more than the record
// usually shows and is potentially misleading.
const INST_INTERPRETIVE = /\b(?:beat|won against|prevailed over)\s+(?:the\s+)?(?:fbi|cia|nsa|dea|police|cops|feds|government|court|system|law|military|army|navy|state|prosecution|prosecutors?)\b/i;
const INST_MISLEADING = /\b(?:defeated?|outsmart(?:ed)?|outwitted?|humiliated?|destroyed?|took down|crushed|embarrassed)\s+(?:the\s+)?(?:fbi|cia|nsa|dea|police|cops|feds|government|court|system|law|military|army|navy|state|prosecution|prosecutors?)\b/i;

// "The FBI forgot / the world forgot" — institutional forgetfulness is a NEW factual
// proposition (he stayed at large != the agency literally forgot him).
const INST_FORGOT = /\b(?:the\s+)?(?:fbi|cia|police|government|world|america|everyone|history)\s+forgot\b/i;

// "investigators failed to find her" — evaluative institutional-failure framing the
// record rarely supports (they DID eventually locate her). "couldn't find" is softer;
// "failed" asserts a judgment.
const INST_FAILED = /\b(?:investigators?|police|detectives?|fbi|cia|authorities|the feds)\s+failed to\b/i;

// Affirmative-grant framing: a court "letting him keep his freedom" / "setting him free"
// implies the court actively GAVE freedom, rather than ruling against extradition.
const AFFIRMATIVE_GRANT = /\b(?:court|judge|jury)\b.*\b(?:let (?:him|her|them)|gave (?:him|her|them)|granted|allowed (?:him|her|them) to keep|set (?:him|her|them) free)\b/i;

// Adjective describing a PERSON/crime jammed onto an OBJECT ("infamous plane").
const ADJ_ON_OBJECT = /\b(infamous|notorious|legendary|convicted|wanted|fugitive|criminal)\s+(plane|flight|jet|aircraft|car|boat|ship|train|bus|van|truck|weapon|gun|bag|briefcase|money)\b/i;

// High-risk intensifiers: literal words that overstate unless the story truly earns them.
const HIGH_RISK = /\b(impossible|literally impossible|unhackable|unbeatable|flawless|perfect)\b/i;

// High-risk ENTITY LABELS (label ladder): these assert a strong characterization that
// needs explicit evidence — the record must support the label, not merely the conduct.
const HIGH_RISK_LABEL = /\b(terrorist|mastermind|extremist|kingpin|serial killer|cartel boss|crime lord)\b/i;

// Causal-compression: narrative shorthand that invents a NEW causal claim. "A TV show
// found her" compresses (show aired → viewer recognized → police investigated → arrest)
// into the show literally finding her.
// Note: "exposed" is NOT here — "the broadcast exposed her identity" is the accurate
// verb. What overstates is the program literally FINDING/CATCHING/ENDING someone. And a
// bare "ended" is flagged, but "helped end" escapes (the qualifier makes it honest).
const CAUSAL_COMPRESSION = /\b(?:a |the )?(?:tv show|show|documentary|podcast|video|episode|broadcast|program(?:me)?)\s+(?:found|caught|tracked down|hunted down|solved|nabbed|ended|caught up with)\b/i;

// Titles that overrun YouTube's display width get truncated. Convention: under 65 chars.
const MAX_TITLE_CHARS = 65;

export interface TitleWarning {
  type: "exclusivity" | "institutional" | "misleading" | "high-risk" | "attachment" | "label" | "causal" | "length" | "number";
  note: string;
}

// Pull the numeric tokens out of a string: bare integers (23, 1972), and numbers with
// separators (1,000,000). Returns the normalized digit strings. Word-numbers are not
// extracted — the generator emits digits, and the source usually does too.
function extractNumbers(s: string): Set<string> {
  const out = new Set<string>();
  if (!s) return out;
  const matches = s.match(/\d[\d,]*/g) || [];
  for (const m of matches) out.add(m.replace(/,/g, ""));
  return out;
}

// Return deterministic warnings for a title. `source` should be the original title plus
// the script/context — every number in the generated title must trace back to it.
export function validateTitle(title: string, source?: string): TitleWarning[] {
  const out: TitleWarning[] = [];
  if (!title) return out;

  // NUMERIC CONSISTENCY GATE: a number in the title that does not appear in the source
  // is a fabrication (the "23 years" → "28 years" bug). Only run when we have a source.
  if (source) {
    const allowed = extractNumbers(source);
    const used = extractNumbers(title);
    const unverified: string[] = [];
    for (const n of used) {
      // ignore trivially small counts that are usually structural, not factual claims
      if (n.length <= 1 && Number(n) <= 3) continue;
      // ignore 4-digit years (1000-2099): these are almost always legitimate real dates
      // that a short/thin source simply may not restate, and they are NOT the target of
      // this gate. The gate exists to catch an altered DURATION/AGE (the 23 -> 28 bug),
      // which is a small number. Flagging real years produces heavy false positives.
      const num = Number(n);
      if (n.length === 4 && num >= 1000 && num <= 2099) continue;
      if (!allowed.has(n)) unverified.push(n);
    }
    if (unverified.length) {
      out.push({ type: "number", note: `Unverified number(s): ${unverified.join(", ")} — not found in your title or script. Every number must trace to the source; fix or remove it.` });
    }
  }
  for (const { re, label } of EXCLUSIVITY) {
    if (re.test(title)) {
      out.push({ type: "exclusivity", note: `Unsupported exclusivity: ${label} needs research to back it.` });
      break; // one exclusivity flag is enough
    }
  }
  if (INST_MISLEADING.test(title)) {
    out.push({ type: "misleading", note: "Potentially misleading — “defeated/outsmarted/humiliated the agency” claims more than winning a specific legal point; use only if the record supports it." });
  } else if (INST_INTERPRETIVE.test(title)) {
    out.push({ type: "institutional", note: "Institutional framing — “beat the agency” is interpretive packaging of a legal win, not a documented fact. Fair if labeled as framing." });
  }
  if (INST_FORGOT.test(title)) {
    out.push({ type: "institutional", note: "New factual claim — “the agency forgot him” is not the same as him staying at large; the story likely doesn’t establish institutional forgetfulness." });
  }
  if (INST_FAILED.test(title)) {
    out.push({ type: "misleading", note: "Institutional-failure judgment — “investigators failed to…” is evaluative; they eventually located the subject. Prefer “couldn’t locate for two decades”." });
  }
  if (AFFIRMATIVE_GRANT.test(title)) {
    out.push({ type: "misleading", note: "Certainty inflation — a court “letting him keep his freedom” implies an affirmative grant; “ruled in his favor / against extradition” is the accurate framing." });
  }
  if (ADJ_ON_OBJECT.test(title)) {
    const m = title.match(ADJ_ON_OBJECT)!;
    out.push({ type: "attachment", note: `Attachment error — “${m[1]} ${m[2]}” attaches the adjective to the object; it should describe the person or crime, not the ${m[2]}.` });
  }
  if (HIGH_RISK.test(title)) {
    out.push({ type: "high-risk", note: "High-risk intensifier — only accurate if the story establishes literal impossibility, else prefer improbable/extraordinary." });
  }
  if (HIGH_RISK_LABEL.test(title)) {
    const m = title.match(HIGH_RISK_LABEL)!;
    out.push({ type: "label", note: `High-risk label — “${m[1]}” requires the record to support the label itself, not just the conduct; prefer the documented descriptor (fugitive, suspect, convicted) unless the source states it.` });
  }
  if (CAUSAL_COMPRESSION.test(title)) {
    out.push({ type: "causal", note: "Causal compression — a program “finding/catching” someone invents a causal claim; the accurate version is it exposed / led to identifying them." });
  }
  if (title.length > MAX_TITLE_CHARS) {
    out.push({ type: "length", note: `${title.length} characters — over the ${MAX_TITLE_CHARS}-char limit; YouTube truncates it. Tighten to under ${MAX_TITLE_CHARS}.` });
  }
  return out;
}
