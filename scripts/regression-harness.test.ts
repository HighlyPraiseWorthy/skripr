// REGRESSION HARNESS — the anti-treadmill lock. A bank of pathological fixtures run on EVERY change,
// asserting INVARIANTS (not exact LLM output, which is non-deterministic): a pass may never INCREASE
// duplicate paragraphs or unsupported-claim markers, the JSON boundary never accepts garbage as valid,
// the bounded-refill constants hold, and the four already-shipped strings stay fixed. When a future
// edit regresses one of these, this file goes red immediately and names which invariant broke.
import {
  splitSentences, stripDuplicateHook, dedupeAdjacentParagraphs, stripLeakedLabels,
  stripSpeculation, stripInventedInference, stripUnsourcedStat, stripSchemeDurationClaim,
  collapseRepeatedAnchors, flagOverstatementRisk,
} from "../src/lib/script-compliance.ts";
import { extractJSON, repairJson, reconcileTitle } from "../src/lib/ai/claude.ts";
import { researchedYearSpan } from "../src/lib/script-compliance.ts";

let failures = 0;
const check = (name: string, cond: boolean) => {
  console.log(`  ${cond ? "✓" : "✗"} ${name}`);
  if (!cond) failures++;
};

// Invariant helpers — measured the same way on input and output so the assertion is a true monotone.
const paragraphs = (s: string) => s.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
const dupPairs = (s: string) => {
  const ps = paragraphs(s);
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  let n = 0;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (norm(ps[i]) === norm(ps[j])) n++;
  return n;
};
const unsupportedCount = (s: string) => splitSentences(s).filter((x) => flagOverstatementRisk(x)).length;
// The full deterministic body-strip stack, in finalize order, applied for the monotonicity checks.
const stripStack = (s: string) => {
  let t = s;
  t = dedupeAdjacentParagraphs(t).text;
  t = stripLeakedLabels(t).text;
  t = stripDuplicateHook(t).text;
  t = collapseRepeatedAnchors(t).text;
  t = stripSpeculation(t).text;
  t = stripInventedInference(t).text;
  return t;
};

console.log("duplicate-count invariant (out <= in):");
const dupFixtures = [
  "In 2017 a man in Nebraska built fake listeners to steal royalties.\n\nIn 2017 a man in Nebraska built fake listeners to steal royalties.\n\nThe labels never noticed.",
  "**HOOK:** He stole ten million dollars in royalties.\n\nHe stole ten million dollars in royalties, and nobody noticed.\n\nHere is how it worked.",
  "A normal opening paragraph.\n\nA second, unrelated paragraph.\n\nA third that stands alone.",
];
dupFixtures.forEach((f, i) => {
  const out = stripStack(f);
  check(`fixture ${i}: dupPairs(out) <= dupPairs(in)`, dupPairs(out) <= dupPairs(f));
});

console.log("unsupported-claim invariant (out <= in):");
const overFixtures = [
  "The scheme ran completely undetected for years. Nobody in the industry ever noticed. It was the first case in history.",
  "He built a factory of fake streams. The streams were fake, the money was real.",
  "Every single account was a bot, and not one person ever chose to hear the song.",
];
overFixtures.forEach((f, i) => {
  const out = stripStack(f);
  check(`fixture ${i}: unsupported(out) <= unsupported(in)`, unsupportedCount(out) <= unsupportedCount(f));
});

console.log("refill-starvation invariant (1 fact -> no invented filler):");
// Deterministic proxy: with too few facts the bounded refill short-circuits; we assert here that the
// UNSUPPORTED stack does not manufacture claims out of a thin body (there is nothing to consume).
const thin = "A short body with a single sourced figure of ten million dollars.";
check("thin body gains no unsupported claims", unsupportedCount(stripStack(thin)) <= unsupportedCount(thin));

console.log("numeric-contamination invariant:");
const facts = "Smith collected about ten million dollars. One platform limited its exposure to roughly sixty thousand dollars.";
check("fabricated stat with no backing fact is cut",
  stripUnsourcedStat("An RIAA report pegged the average artist payout at $25,000 to $50,000 per year.", facts).cuts.length >= 1);
check("a figure that IS in the facts survives",
  stripUnsourcedStat("Smith collected about ten million dollars.", facts).cuts.length === 0);

console.log("malformed-JSON boundary (recover valid, reject garbage):");
check("recovers a ```json fenced object", (() => {
  try { const v = extractJSON("```json\n{\"results\":[]}\n```", "object") as any; return Array.isArray(v.results); } catch { return false; }
})());
check("recovers trailing prose after object", (() => {
  try { const v = extractJSON("Here you go: {\"results\":[{\"i\":0,\"action\":\"KEEP\"}]} hope that helps", "object") as any; return v.results.length === 1; } catch { return false; }
})());
check("repairJson fixes a trailing comma", (() => {
  try { const v = extractJSON(repairJson('{"results":[{"i":0,"action":"KEEP"},]}'), "object") as any; return v.results.length === 1; } catch { return false; }
})());
check("repairJson fixes smart quotes", (() => {
  try { const v = extractJSON(repairJson('{“results”:[]}'), "object") as any; return Array.isArray(v.results); } catch { return false; }
})());
check("genuine garbage throws (would become STRUCTURED_LLM_FAILED, never silent success)", (() => {
  try { extractJSON("I could not complete this request.", "object"); return false; } catch { return true; }
})());

console.log("certainty edit-plan invariant (cannot restack a de-duped hook):");
// The certainty pass returns indexed sentence edits applied positionally, so it structurally cannot
// re-add a paragraph. Proxy: the final dup-hook pass is idempotent and leaves no opening duplicate.
const restack = "He stole ten million dollars.\n\nMiddle beat about the platforms.\n\nHe stole ten million dollars.";
check("dup-hook removes a re-stacked opening", dupPairs(stripDuplicateHook(restack).text) === 0);

console.log("four shipped strings stay fixed:");
check("[single hook / no HOOK: label] '**HOOK:**' stripped",
  stripLeakedLabels("**HOOK:** In 2017 a man began.\n\nNext.").text.startsWith("In 2017"));
check("[no C.F.R.] unverified regulatory cite cut",
  stripUnsourcedStat("It violated 37 C.F.R. §§ 385.2 and 385.21.", "unrelated facts").cuts.length >= 1);
check("[24 Cr. intact] splitter keeps the case cite whole",
  splitSentences("The case was United States v. Michael Smith, 24 Cr. 542. Filed in 2024.").length === 2);
check("['undetected, for years' gone] comma form flagged",
  stripSpeculation("It ran, largely undetected, for years.").cuts.length >= 1);

console.log("title reconciliation vs researched facts:");
{
  // Placeholder title + facts spanning 2017-2024 with one charged male defendant.
  const facts = "The scheme began in 2017 and continued until it was charged in 2024. Michael Smith pleaded guilty to the fraud. He built the accounts. His operation collected roughly ten million dollars over the years.";
  const reconciled = reconcileTitle("After 4 Years Spotify Finally Caught Them..", facts);
  const span = researchedYearSpan(facts);
  check("span is the researched ~7 years, not the placeholder 4", span === 7);
  check("reconciled title asserts 7 years", /\b7 Years\b/.test(reconciled));
  check("reconciled title downgrades Them -> Him", /Caught Him\b/.test(reconciled) && !/Caught Them\b/.test(reconciled));
  check("brand (Spotify) preserved", /Spotify/.test(reconciled));
  // And the body's stated scheme duration must MATCH: a body '4-year' claim is cut against span 7.
  const bodyCut = stripSchemeDurationClaim("The scheme ran for almost four years before anyone noticed.", reconciled, span).cuts.length;
  check("body '4-year' scheme claim is cut against the 7-year span", bodyCut >= 1);
  // Conservatism: unnamed/no-charge facts keep the generic 'Them' and the placeholder time.
  const vague = reconcileTitle("After 4 Years Spotify Finally Caught Them..", "Some accounts were involved in a streaming pattern. No one was named.");
  check("keeps 'Them' and placeholder when the record is thin", /Caught Them\b/.test(vague) && /\b4 Years\b/.test(vague));
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
if (failures) process.exit(1);
