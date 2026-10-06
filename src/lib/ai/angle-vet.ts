// Vet proposed angles against the grounding facts BEFORE they are shown. Angle
// cards used to reach the creator unchecked, so a fabricated salary ("$140 a
// week"), an unsupported superlative ("the CIA's greatest failure"), a misstated
// event ("arrested for an unrelated reason"), or a false relationship (calling the
// Australia grievance and the Rhyolite material "two different things" when Pine
// Gap is Rhyolite's ground station) could be picked and seed the whole script.
//
// Two layers, same split as the script guards:
//   - deterministic: dates and dollar figures in an angle not in the facts
//   - LLM: superlatives, misstated events, and false relationships the facts
//     contradict, which regex cannot see
//
// Honest ceiling: the LLM check can only catch a relationship error when the facts
// actually establish the relationship. Thin facts mean subtle errors still pass.

import { Anthropic } from "@anthropic-ai/sdk";
import { factCheckAgainstSource } from "@/lib/fact-check";
import { unsourcedQuotes, superlativeMismatches, ageYearMismatches, foreverContradicted, minorsInFacts } from "@/lib/script-compliance";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return _client;
}

/**
 * Returns a parallel array of warning lists, one per angle. An empty list means
 * the angle looked sound. Never throws: on any failure it returns only whatever
 * the deterministic scan found (or all-empty), so vetting can't block angles.
 */
export async function vetAngles(angles: string[], sourceText: string): Promise<string[][]> {
  const warnings: string[][] = angles.map(() => []);
  if (!angles.length) return warnings;

  // Layer 1: deterministic number scan (needs facts to check against).
  if (sourceText && sourceText.trim()) {
    angles.forEach((a, i) => {
      const { unverified } = factCheckAgainstSource(a, sourceText);
      for (const u of unverified) warnings[i].push(`Unverified figure: ${u}`);
      // Recency check: "just ended" / "recently" on a case whose latest dated fact is over a year old.
      const years = (sourceText.match(/\b(1[89]\d{2}|20\d{2})\b/g) || []).map(Number);
      const latest = years.length ? Math.max(...years) : 0;
      const rec = a.match(/\bjust (?:ended|happened|closed|caught|found|released|got|been)\b|\brecently\b|\bthis (?:week|month|year)\b|\bright now\b|\bbreaking\b/i);
      if (rec && latest && latest < new Date().getFullYear() - 1) warnings[i].push(`"${rec[0]}" implies this is recent, but the latest date in your research is ${latest}`);
      // Superlative check: the scope of "longest/biggest/..." must match the research's exact wording.
      for (const sm of superlativeMismatches(a, sourceText)) warnings[i].push(sm.source ? `"${sm.said}" changes the source's wording: it says "${sm.source}". Keep its exact words and say who said it` : `"${sm.said}" is a superlative your research doesn't state`);
      // "Vanished forever" when the research has him found later.
      { const fv = foreverContradicted(a, sourceText); if (fv) warnings[i].push(`"${fv}" isn't true: your research has him found later`); }
      // A minor named on a card: use the relationship instead.
      for (const mn of minorsInFacts(sourceText)) if (new RegExp(`\\b${mn.first}\\b`).test(a)) warnings[i].push(`names ${mn.first}, who was a minor at the time: say "${mn.relation}" instead`);
      // Age at a date: "In May 2008, a 73-year-old" when the research puts him at 73 in 2012.
      for (const am of ageYearMismatches([a], sourceText)) warnings[i].push(`"${am.said}-year-old" in ${am.year} doesn't fit your research: by its ages and dates the person was about ${am.expected} then`);
      // Quote check: words in quotation marks must exist verbatim in the research.
      for (const q of unsourcedQuotes(a, sourceText)) warnings[i].push(`"${q.length > 80 ? q.slice(0, 80) + "…" : q}" is shown as a quote but isn't in your research word for word`);
    });
  }

  // Layer 2: LLM check for the errors regex can't see. Only runs with facts to check against.
  // EVIDENCE-GATED (seen live: the checker warned an arrest happened "in Tenerife, Spain", a place in
  // no source, i.e. the fact-checker itself fabricated). The model may no longer write free-text
  // warnings. It must return (a) the exact phrase from the angle it objects to and (b) for a
  // contradiction, the exact sentence from the facts that contradicts it. Code verifies BOTH quotes
  // literally and builds the displayed warning from them, so an invented fact can never be shown.
  if (sourceText && sourceText.trim()) {
    try {
      const list = angles.map((a, i) => `[${i}] ${a}`).join("\n\n");
      // Opus: the cards decide the whole video, and Sonnet missed invented events and memoir-as-scene
      // claims even with the exact example in its instructions (seen live).
      // Opus rejects `temperature` (400 "deprecated for this model", seen live); only Sonnet gets it.
      const ask = (model: string) => client().messages.create({
        model,
        max_tokens: 3500,
        ...(model.includes("sonnet") ? { temperature: 0 } : {}),
        messages: [{
          role: "user",
          content: `You are fact-checking proposed YouTube video angles against an APPROVED FACT SHEET. Flag ONLY real problems the facts establish. Do not flag taste, emphasis, or interpretation. Use ONLY the fact sheet — never your own knowledge of the case.

Problem kinds:
- "contradiction": the angle states something a SPECIFIC fact sentence contradicts (a misstated event, a wrong place/date/charge, a relationship the facts contradict, an anachronistic name, a mischaracterized charge or verdict).
- IMPLIED contradictions count too: a sweeping claim one specific fact disproves. "For 56 years nobody could find him" is contradicted by a fact saying he was arrested in 1975; "lived in Florida the entire time" is contradicted by a fact placing him in another state; "nobody knows why" is contradicted by a fact giving the reason. Check every absolute ("nobody", "never", "the entire time", "no one knows", "for N years straight") against EVERY fact, and quote the one fact sentence that breaks it.
- Claims about what a REAL PERSON thought, felt, or intended ("seemed to have genuinely moved on", "he never looked back") and claims about what an agency or investigators KNEW, intended, or FAILED to do, or how long their work took ("had no idea where he was", "nobody pursued him", "closed his file", "in a matter of months"), and a fact RELOCATED in paraphrase ("family connections in Florida" when the son was in another state) are "unsupported" unless a fact says exactly that.
- DISTANCES AND LOCATIONS: "three miles away", "across town", "next door", "in another country" are specifics; flag any the facts don't give or contradict.
- A DURATION TIED TO A PLACE, PERSON, OR SIDE EVENT must be true for THAT place or person, not just for the whole story: "32 years in Las Vegas" is contradicted by a fact placing him in California and Florida first; a victim "suffering for 32 years" is contradicted by a fact dating that victim's trouble to 1995. The date arithmetic below does NOT excuse these.
- WHAT SOMEONE KNEW: "neither knew", "had no idea", "never suspected", "nobody knew" are claims about real people's knowledge; flag them when the facts don't state it or show otherwise (a man who knowingly bought another person's number knew).
- An AGE at a date ("a 73-year-old man" in 2008) must fit the research's ages and dates.
- A SWEEPING GROUP claim that lumps in someone the facts don't put in that group: "these were the people he was stealing from" right after quoting his son and his church secretary (the facts make neither an investor); "everyone who trusted him lost everything".
- A MEMOIR IMAGE STAGED AS A LIVE SCENE: the facts only say his memoir "describes" or "opens with" an image, and the angle stages it as something that happened in front of us ("sitting near a foreign border, he opened a notebook and started writing"). Flag it; it must be framed as what he later wrote.
- AN EVENT THE FACTS DON'T HAVE, anywhere in the text including the payoff ("the manuscript surfaces at sentencing", "the prosecution used it against him").
- TIMING: roles or events the facts place at different times stated as simultaneous ("a beloved pastor, a missionary, and an FBI fugitive, all at the same time" when he left the pulpit years before he fled); "most-wanted" read as the FBI's Ten Most Wanted list when the facts only say "one of their most wanted fugitives".
- IMPLIED INVOLVEMENT OF A PRIVATE PERSON: wording that suggests a named private person (a neighbor, a house seller, a spouse, a coworker) helped, knew about, or took part in a crime or the hiding, when no fact says so ("how many people helped him" right after naming the man who sold him his house). Flag it as "unsupported" and quote the suggestive words.
- INTENT or a choice the facts don't give: "let his family have him declared dead", "planned it for years", "meant to come back", "boarded a ferry to disappear" / "to die" (only his own account says why; it must be attributed).
- A DESCRIPTIVE WORD the facts don't give, even a small one: "a beat-up 2001 Dodge Durango" when the facts only say he drove a 2001 Dodge Durango for years.
- FEELINGS OR REACTIONS of real people the facts don't give: "stunned everyone who thought they knew him", "shocked the whole town", "his family was devastated".
- A GROUP'S SIZE OR MEMBERSHIP changed from the source's wording, in the TITLE as much as the hook: the facts say "many of whom had come through his church" and the angle says "his congregation", "his flock", "Church Members Lost Everything", "his whole church", "all of them". Also "lost everything" when the facts say lost most of it.
- The FIRST SENTENCE opening on a side character (a teacher, a neighbor) instead of the main event or subject.
- A step of an event the facts don't describe: "the ferry docked and he simply walked off" when the facts only say he boarded and threw things overboard.
- The SUBJECT'S OWN ACCOUNT stated as fact: what the research gives only from his memoir, an interview, or his letters ("sitting on a rock near a foreign border", "contemplated jumping") is his claim; flag it when the angle states it as plain fact. Facts tagged [his own account] or [family account] are exactly these; quote that tagged fact as the contradicting "fact".
- "unsupported": the angle states a specific (number, date, name, place, distance) or a superlative ("the first", "the biggest") that NO fact supports.
- "mismatch" (only when the angle has a "VIEWER ASKS:" question): (a) the payoff ("The payoff lands on ...") does not answer that question (the question asks how she hid; the payoff is how she was caught), or (b) the question gives a figure that differs from the hook's figure for the same thing ("35 years" in the question, "about 30 years" in the hook), or (c) the question already GIVES the payoff's answer ("...before fingerprints gave her away?" when the payoff is the fingerprint match). Quote the question's words as the phrase.
- STATUS IN THE PRESENT TENSE: "is a registered nonprofit", "is still running", "remains open", "still operates", "is still wanted" are claims about TODAY. Flag them as "unsupported" unless a fact states that status as current or gives a recent date for it; the past tense with the year the facts give ("in 2017 he registered...") is fine.

DO THE ARITHMETIC FIRST: a duration or count that equals the difference between two dates/numbers in the facts IS supported (facts say 1975 and 2015 -> "40 years" is supported) as a duration of the WHOLE story. Never flag that. It does not make a duration tied to a specific place or person true (see above).

For each problem return:
- "phrase": the EXACT words from the angle you object to, copied character for character (short, 2-12 words).
- "kind": "contradiction", "unsupported", or "mismatch".
- "fact": for a contradiction, the SHORTEST exact span from the APPROVED FACTS that contradicts it (the specific clause, e.g. "he was later arrested in West Virginia in 1975"), copied character for character. Omit for unsupported.
If you cannot quote the angle phrase exactly, or cannot quote a contradicting fact exactly, do NOT report it.

APPROVED FACTS:
"""
${sourceText.slice(0, 40000)}
"""

ANGLES:
${list}

Output ONLY JSON, one entry per angle index with a problem (omit sound angles):
[{"i":0,"issues":[{"phrase":"...","kind":"contradiction","fact":"..."}]}]`,
        }],
      // Hard cap per call: the card route has 240s in total (seen: one topic took 497s through SDK retries).
      }, { timeout: model.includes("opus") ? 60_000 : 40_000, maxRetries: 0 });
      let msg: Awaited<ReturnType<typeof ask>>;
      try { msg = await ask("claude-opus-5-5"); } catch (e: any) { console.error(`[angle-vet] opus failed: ${e?.message || e}`); msg = await ask("claude-sonnet-4-6"); }
      const text = msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
      const m = text.match(/\[[\s\S]*\]/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            const i = Number(entry?.i);
            if (!(Number.isInteger(i) && i >= 0 && i < warnings.length && Array.isArray(entry.issues))) continue;
            for (const issue of entry.issues) {
              const w = verifiedWarning(issue, angles[i], sourceText);
              if (w && !warnings[i].includes(w)) warnings[i].push(w);
            }
          }
        }
      }
    } catch { /* LLM vet failed: keep the deterministic warnings only */ }
  }

  return warnings;
}

// Literal-quote verification (whitespace/quote/case-insensitive). Returns the display string only
// when every quoted piece really exists where it claims to; otherwise null (the warning is dropped).
const squash = (t: string) => t.toLowerCase().replace(/[‘’“”"']/g, "").replace(/\s+/g, " ").trim();
export function verifiedWarning(issue: any, angle: string, sourceText: string): string | null {
  const phrase = typeof issue?.phrase === "string" ? issue.phrase.trim() : "";
  if (phrase.length < 3 || !squash(angle).includes(squash(phrase))) return null; // must really be in the angle
  const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t);
  if (issue?.kind === "contradiction") {
    const fact = typeof issue?.fact === "string" ? issue.fact.trim() : "";
    if (fact.length < 12 || !squash(sourceText).includes(squash(fact))) return null; // must really be in the facts
    return `"${clip(phrase, 80)}" conflicts with your research: "${clip(fact, 220)}"`;
  }
  if (issue?.kind === "mismatch") return `the "Viewer asks" question ("${clip(phrase, 80)}") doesn't match this card: make it the question the payoff answers, with the hook's own figures`;
  if (issue?.kind === "unsupported") {
    if (durationFromFactDates(phrase, sourceText)) return null; // e.g. "forty years" = 2015 - 1975
    return `"${clip(phrase, 80)}" isn't in your research`;
  }
  return null;
}

// Deterministic arithmetic guard (the model was told to do this and didn't): a "N years" span is
// SUPPORTED when two years in the facts differ by N (±1 for partial years). Handles digits and
// spelled numbers up to ninety-nine.
const ONES: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
function spanYears(phrase: string): number | null {
  const t = phrase.toLowerCase();
  const d = t.match(/\b(\d{1,2})\s*(?:-\s*)?years?\b/);
  if (d) return Number(d[1]);
  const w = t.match(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)?[\s-]?(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)?\s+(?:more\s+|another\s+)?years?\b/);
  if (w && (w[1] || w[2])) return (w[1] ? TENS[w[1]] : 0) + (w[2] ? ONES[w[2]] : 0);
  return null;
}
export function durationFromFactDates(phrase: string, sourceText: string): boolean {
  const n = spanYears(phrase);
  if (!n) return false;
  const years = [...new Set((sourceText.match(/\b(1[6-9]\d{2}|20\d{2})\b/g) || []).map(Number))];
  return years.some((a) => years.some((b) => b > a && Math.abs(b - a - n) <= 1));
}

// Build the fact string an angle is checked against, from the grounding context
// the angle routes already carry.
export function groundingToSourceText(grounding: any): string {
  if (!grounding) return "";
  const parts: string[] = [];
  if (grounding.caseName) parts.push(String(grounding.caseName));
  if (grounding.caseSummary) parts.push(String(grounding.caseSummary));
  if (Array.isArray(grounding.facts)) parts.push(...grounding.facts.map((f: any) => String(f)));
  return parts.filter(Boolean).join("\n");
}
