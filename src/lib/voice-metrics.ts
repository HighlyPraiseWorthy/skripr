// MEASURABLE VOICE.
//
// A prose description of a voice cannot be enforced — it competes against facts,
// structure, techniques and director's notes during generation, and it loses every time.
// The evidence was in the output: the same narrator constructions appeared in every
// script this session regardless of which voice profile was selected.
//
// Numbers can be checked. Adjectives cannot. This module turns a voice into a numeric
// fingerprint that can be measured on a transcript, targeted during a rewrite pass, and
// verified in the compliance panel.

export interface VoiceFingerprint {
  avgSentenceWords: number;
  sentenceVariance: number;   // stdev of sentence length — rhythm, not just pace
  secondPersonRate: number;   // "you" per 1,000 words
  contractionRate: number;    // contractions per 1,000 words
  questionRate: number;       // rhetorical questions per 1,000 words
  fragmentRate: number;       // share of sentences under 5 words
  avgParagraphSentences: number;
  words: number;
}

// HOUSE TICS — the highest-value fix in the whole voice system.
//
// These constructions appeared in every script this session, across different topics,
// niches, frameworks AND voice profiles. That makes them house style leaking through,
// not any creator's voice. Negative space identifies a creator faster than positive
// traits: what someone NEVER says is more distinctive than what they do say. Banning
// these produces a bigger perceptual difference than any positive instruction, because
// right now they are the loudest thing in the output and they belong to nobody.
export const HOUSE_TICS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(?:pause|sit|stay) (?:on|with) that (?:for a (?:second|moment)|split)?/i, label: '"pause on that for a second"' },
  { pattern: /\bthink about what that (?:means|actually means|looks like|requires)\b/i, label: '"think about what that means"' },
  { pattern: /\bread that (?:again|one more time)\b/i, label: '"read that again"' },
  { pattern: /\bthat'?s not (?:a )?[a-z ]{2,24}\.\s*(?:that'?s|it'?s)\b/i, label: '"That\'s not X. That\'s Y."' },
  { pattern: /\blet that (?:sink in|land)\b/i, label: '"let that sink in"' },
  { pattern: /\bhere'?s (?:the thing|what(?:'s| is) wild|where it gets)\b/i, label: '"here\'s the thing"' },
  { pattern: /\bnow (?:slow down|let'?s slow down)\b/i, label: '"now slow down"' },
  { pattern: /\bwhich is (?:exactly )?(?:the point|why)\b.{0,40}$/im, label: '"which is exactly the point"' },
  { pattern: /\bthat is not (?:a metaphor|hyperbole|an exaggeration)\b/i, label: '"that\'s not a metaphor"' },
  { pattern: /\bthe (?:uncomfortable|inconvenient) (?:truth|part)\b/i, label: '"the uncomfortable truth"' },
];

const SENT_SPLIT = /(?<=[.!?])\s+/;

export function measureVoice(text: string): VoiceFingerprint {
  const clean = (text || "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const n = words.length || 1;
  const paras = clean.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const sentences = clean.split(SENT_SPLIT).map((s) => s.trim()).filter(Boolean);
  const lens = sentences.map((s) => s.split(/\s+/).filter(Boolean).length).filter((l) => l > 0);
  const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const variance = lens.length
    ? Math.sqrt(lens.reduce((a, l) => a + (l - avg) ** 2, 0) / lens.length)
    : 0;
  const per1k = (count: number) => (count / n) * 1000;

  return {
    avgSentenceWords: Number(avg.toFixed(1)),
    sentenceVariance: Number(variance.toFixed(1)),
    secondPersonRate: Number(per1k((clean.match(/\byou(?:r|'re|'ve|'ll|'d)?\b/gi) || []).length).toFixed(1)),
    contractionRate: Number(per1k((clean.match(/\b\w+['’](?:s|t|re|ve|ll|d|m)\b/gi) || []).length).toFixed(1)),
    questionRate: Number(per1k((clean.match(/\?/g) || []).length).toFixed(1)),
    fragmentRate: Number((lens.filter((l) => l < 5).length / (lens.length || 1)).toFixed(2)),
    avgParagraphSentences: Number((sentences.length / (paras.length || 1)).toFixed(1)),
    words: n,
  };
}

// Which house tics are present, so they can be named rather than vaguely flagged.
export function findHouseTics(text: string): string[] {
  return HOUSE_TICS.filter((t) => t.pattern.test(text || "")).map((t) => t.label);
}

// DETERMINISTIC TIC REMOVAL — the guaranteed fix.
//
// The LLM voice pass is probabilistic and time-budget-limited, so on long section-wise
// scripts it silently gets skipped and the tics survive ("Read that again" in a
// Kurzgesagt-voiced script). These specific constructions are throwaway SENTENCES that
// carry no information — they only instruct the viewer how to feel — so deleting the
// whole sentence is safe and loses nothing. This runs unconditionally at the end of
// generation, so these tics can never reach output no matter what the model did.
const STANDALONE_TICS: RegExp[] = [
  /\s*\b(?:so\s+|and\s+)?read that (?:again|one more time)\.(?=\s|$)/gi,
  /\s*\b(?:so\s+|now\s+)?pause on that(?: for a (?:second|moment))?\.(?=\s|$)/gi,
  /\s*\b(?:so\s+|now\s+)?sit with (?:that|this)(?: for a (?:second|moment)| split)?\.(?=\s|$)/gi,
  /\s*\b(?:so\s+|now\s+)?stay with (?:that|this)(?: for a (?:second|moment))?\.(?=\s|$)/gi,
  /\s*\b(?:so\s+|now\s+)?let (?:that|this) (?:sink in|land|breathe)\.(?=\s|$)/gi,
  /\s*\bthink about what (?:that|this) (?:means|actually means|looks like|requires)\.(?=\s|$)/gi,
  /\s*\bhold (?:that|this)(?: thought| for a second)?\.(?=\s|$)/gi,
];

export function stripStandaloneTics(text: string): string {
  if (!text) return text;
  let out = text;
  for (const re of STANDALONE_TICS) out = out.replace(re, "");
  // Repair the seams the deletions leave: doubled spaces, a space before punctuation,
  // indented line starts, and any paragraph left empty.
  out = out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,!?;:])/g, "$1")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

// A compact, promptable target derived from the creator's own transcripts. This is what
// the voice rewrite pass aims at — concrete numbers instead of adjectives.
export function fingerprintToBrief(fp: VoiceFingerprint, name?: string): string {
  const rhythm = fp.sentenceVariance >= 8 ? "highly varied (mix very short punches with long sentences)"
    : fp.sentenceVariance >= 5 ? "moderately varied" : "fairly even";
  return [
    `MEASURED VOICE TARGETS${name ? ` for ${name}` : ""} — match these numerically, they were measured from this creator's own videos:`,
    `- Average sentence length: about ${fp.avgSentenceWords} words. Rhythm: ${rhythm} (stdev ~${fp.sentenceVariance}).`,
    `- Direct address: about ${fp.secondPersonRate} uses of "you" per 1,000 words.`,
    `- Contractions: about ${fp.contractionRate} per 1,000 words — ${fp.contractionRate > 25 ? "this creator speaks casually, use contractions freely" : "this creator is more formal, use contractions sparingly"}.`,
    `- Rhetorical questions: about ${fp.questionRate} per 1,000 words.`,
    `- Short punches: about ${Math.round(fp.fragmentRate * 100)}% of sentences run under 5 words.`,
    `- Paragraphs: about ${fp.avgParagraphSentences} sentences each.`,
  ].join("\n");
}

// The NEVER-DOES section of a voice profile is the most distinctive thing in it —
// negative space identifies a creator faster than positive traits. It also OUTRANKS the
// generic craft rules: Fern never addresses the viewer as "you", while the explainer form
// says to. When a creator's profile forbids something, the creator wins, and any generic
// check for that behaviour must stand down rather than mark a correct script wrong.
export interface VoiceProhibitions {
  noSecondPerson: boolean;
  noRhetoricalQuestions: boolean;
}

export function readProhibitions(styleGuide?: string): VoiceProhibitions {
  const g = (styleGuide || "").toLowerCase();
  return {
    noSecondPerson: /never\s+(?:address\w*|speaks?\s+to)\s+the\s+viewer(?:\s+as)?\s*["“']?you|never\s+uses?\s+["“']?you["”']?\b|not\s+addressed?\s+directly/.test(g),
    noRhetoricalQuestions: /never\s+uses?\s+rhetorical\s+questions?|no\s+rhetorical\s+questions?/.test(g),
  };
}

// Voice checks for the compliance panel: enforceable the moment voice is measurable.
export function voiceChecks(script: string, target?: VoiceFingerprint) {
  const out: { id: string; label: string; pass: boolean; detail: string }[] = [];
  const tics = findHouseTics(script);
  out.push({
    id: "house-tics",
    label: "No generic narrator tics",
    pass: tics.length === 0,
    detail: tics.length === 0
      ? "None of the stock narrator constructions appear."
      : `Contains stock phrasing that belongs to no creator: ${tics.slice(0, 4).join(", ")}. These appear in every generic AI script and are the fastest way an audience senses the voice is not yours.`,
  });
  if (!target) return out;
  const fp = measureVoice(script);
  const within = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
  out.push({
    id: "voice-sentence-length",
    label: "Sentence length matches your voice",
    pass: within(fp.avgSentenceWords, target.avgSentenceWords, Math.max(3, target.avgSentenceWords * 0.3)),
    detail: `Script averages ${fp.avgSentenceWords} words per sentence; your videos average ${target.avgSentenceWords}.`,
  });
  out.push({
    id: "voice-direct-address",
    label: "Direct address matches your voice",
    pass: within(fp.secondPersonRate, target.secondPersonRate, Math.max(6, target.secondPersonRate * 0.5)),
    detail: `Script says "you" ${fp.secondPersonRate} times per 1,000 words; your videos average ${target.secondPersonRate}.`,
  });
  return out;
}
