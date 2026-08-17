// Offline test for the retry-prone research path. The Perplexity leg cannot run
// locally (PERPLEXITY_API_KEY is production-only), so this exercises the pure
// parse+filter over a recorded refusal-heavy fixture instead. Run:
//   node --experimental-strip-types scripts/research-parse.test.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parsePerplexityAnswers, isNonAnswer, dedupeCandidates, sourceTier, reconcileDuration, deriveWhenFromFacts, cleanFact, capFact, toCaseIdentity, dropSuperseded, attributionFor, mechanismIsGeneric, factBudgetForMinutes, honestMinutes, FACTS_PER_MINUTE, MAX_FACTS } from "../src/lib/research.ts";

const here = dirname(fileURLToPath(import.meta.url));
let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) { failures++; console.log("  ✗ " + name); } else { console.log("  ✓ " + name); }
}

// --- isNonAnswer unit cases (the deterministic first line) ---
console.log("isNonAnswer:");
for (const s of [
  "I could not verify a real source in the provided results for the patch ceremony date.",
  "There is no documented connection between the Hells Angels and the KKK in the available records.",
  "No verifiable source was found for the exact verbatim threat used during the operation.",
  "Unknown.",
]) check("drops: " + s.slice(0, 40), isNonAnswer(s) === true);
for (const s of [
  "Jay Dobyns was a University of Arizona football player before joining the ATF in 1987.",
  "World War I ended in 1918 with the Armistice signed on November 11.",
  "The My Lai massacre in 1968 was cited by prosecutors during the trial.",
]) check("keeps: " + s.slice(0, 40), isNonAnswer(s) === false);

// --- parse+filter over the refusal-heavy fixture ---
console.log("parsePerplexityAnswers (refusal-heavy fixture):");
const fx = JSON.parse(readFileSync(join(here, "fixtures/perplexity-roundone-refusal-heavy.json"), "utf8"));
const out = parsePerplexityAnswers(fx.content, fx.citations, fx.questions);
const facts = out.map((o: { fact: string }) => o.fact);

check("keeps only the 5 real facts (drops 4 non-answers)", out.length === 5);
check("kept the University of Arizona biography", facts.some((f: string) => f.includes("University of Arizona")));
check("kept the Solo Angeles front club", facts.some((f: string) => f.includes("Solo Angeles")));
check("kept the arson/lawsuit aftermath", facts.some((f: string) => f.toLowerCase().includes("arson") || f.toLowerCase().includes("sued")));
check("dropped the patch-ceremony refusal", !facts.some((f: string) => f.includes("patching ceremony")));
check("dropped the unsourced threat refusal", !facts.some((f: string) => f.includes("verbatim threat")));
check("dropped the 'Unknown.' answer", !facts.includes("Unknown."));
check("dropped the negative-bridge (no KKK connection)", !facts.some((f: string) => f.includes("no documented connection")));

// The 5 unanswered questions here are exactly what retry-on-refusal would reformulate.
const answered = new Set(out.map((o: { question: string }) => o.question));
const unanswered = (fx.questions as string[]).filter((q) => !answered.has(q));
check("identifies 4 unanswered questions for the retry round", unanswered.length === 4);

// --- picker dedupe: the same case offered under two names collapses to one ---
console.log("dedupeCandidates:");
const merged = dedupeCandidates([
  { name: "ATF Operation Rough Rider / Jay 'Dobyns' infiltration of the Hells Angels", summary: "ATF Special Agent Jay Dobyns spent nearly two years undercover infiltrating the Hells Angels, the operation known as Rough Rider.", when: "2002-2003", whyItFits: "", sources: ["https://en.wikipedia.org/wiki/Operation_Black_Biscuit"] },
  { name: "ATF Operation Black Biscuit", summary: "Operation Black Biscuit was the ATF undercover operation in Arizona in which Jay Dobyns infiltrated the Hells Angels Mesa chapter.", when: "2002-2003", whyItFits: "", sources: ["https://themobmuseum.org/notable_names/jay-dobyns/"] },
]);
check("merges the two Dobyns cards into one", merged.length === 1);
check("keeps the canonical Black Biscuit name, not Rough Rider", merged[0]?.name === "ATF Operation Black Biscuit");
check("unions the sources across both cards", merged[0]?.sources.length === 2);
const distinct = dedupeCandidates([
  { name: "Operation Black Biscuit", summary: "Jay Dobyns infiltrated the Hells Angels in Arizona.", when: "2002-2003", whyItFits: "", sources: ["https://a.com"] },
  { name: "The Falcon and the Snowman", summary: "Christopher Boyce sold satellite secrets to the Soviet Union via Andrew Daulton Lee.", when: "1977", whyItFits: "", sources: ["https://b.com"] },
]);
check("does NOT merge two genuinely distinct cases", distinct.length === 2);

// --- source tiering ---
console.log("sourceTier:");
check("blogspot is low", sourceTier("http://whiteprisongangs.blogspot.com/2009/11/operation-black-biscuit.html") === "low");
check("merch blog (bobberbrothers) is low", sourceTier("https://bobberbrothers.com/pages/5-most-notorious-motorcycle-clubs-in-arizona/") === "low");
check("null source is low", sourceTier(null) === "low");
check("LA Times is high", sourceTier("https://www.latimes.com/archives/la-xpm-2003-dec-05-me-hells5-story.html") === "high");
check("NY Post is high", sourceTier("https://nypost.com/2024/04/14/us-news/x") === "high");
check("Mob Museum is high", sourceTier("https://themobmuseum.org/notable_names/jay-dobyns/") === "high");
check("a regional/unknown domain is neutral, not dropped", sourceTier("https://www.azfamily.com/story/x") === "neutral");
check("youtube is low (not a source for factual claims)", sourceTier("https://www.youtube.com/watch?v=abc") === "low");

// --- duration vs date-range consistency (the "nearly three years" / 1998-2000 bug) ---
console.log("reconcileDuration:");
check("strips a duration that exceeds the dated span", !/three years/i.test(reconcileDuration("Queen spent nearly three years undercover inside the Mongols.", "1998-2000")));
check("keeps a duration consistent with the span", /two years/i.test(reconcileDuration("Queen spent nearly two years undercover.", "1998-2000")));
check("keeps duration when there is no range to check", reconcileDuration("He spent nearly three years undercover.", "") === "He spent nearly three years undercover.");
check("leaves months alone", /months/i.test(reconcileDuration("He was under for 18 months.", "1998-2000")));
check("cleans up spacing after stripping", !/ {2,}/.test(reconcileDuration("He spent nearly three years undercover there.", "1998-2000")));

// --- date derived from facts, not the resolver's guess ---
console.log("deriveWhenFromFacts:");
check("reads an explicit 'from 1998 to 2000' range", deriveWhenFromFacts([{ fact: "Operation Ivan ran from 1998 to 2000 in the San Fernando Valley." }]) === "1998-2000");
check("reads a 1998-2000 dash range", deriveWhenFromFacts([{ fact: "The 1998-2000 infiltration led to 54 arrests." }]) === "1998-2000");
check("returns undefined when no explicit range (won't invent from scattered years)", deriveWhenFromFacts([{ fact: "He joined the ATF in 1980." }, { fact: "The memoir was published in 2005." }]) === undefined);
check("discards an insane span (typo protection)", deriveWhenFromFacts([{ fact: "records from 1998 to 2099" }]) === undefined);

console.log("cleanFact strips research metadata:");
check("strips 'the most vividly documented episode ... is' preamble",
  cleanFact("The most vividly documented episode in the public record is the night the safehouse was raided.") === "The night the safehouse was raided.");
check("strips 'according to the record' preamble",
  cleanFact("According to the public record, the operation ran for 28 months.") === "The operation ran for 28 months.");
check("leaves a plain fact untouched",
  cleanFact("The 2000 takedown resulted in 54 arrests.") === "The 2000 takedown resulted in 54 arrests.");
check("capFact never cuts a word in half", (() => { const c = capFact("word ".repeat(120), 400); return !/\S$/.test(c) === false && !c.endsWith("wor") && c.length <= 400; })());

console.log("toCaseIdentity keeps a name, not prose:");
check("reduces a pasted paragraph to a short identity",
  toCaseIdentity("Michael Smith, and honestly I think the whole streaming-fraud angle is the strongest one here because the numbers are wild").length <= 100);
check("keeps the identity part at the front", /^Michael Smith/.test(toCaseIdentity("Michael Smith, and honestly I think this is the best angle")));
check("leaves a clean short name untouched", toCaseIdentity("Greg Scarpa Sr.") === "Greg Scarpa Sr.");

// Move #2 — supersession application (the pure half; the LLM adjudication is prod-only).
console.log("dropSuperseded:");
const factSet = [
  { fact: "Prosecutors alleged a loss of $10 million.", source: "https://nytimes.com/x" },
  { fact: "The court ordered an $8 million forfeiture.", source: "https://justice.gov/x" },
  { fact: "He deployed 1,040 bot accounts.", source: "https://justice.gov/y" },
];
const survived = dropSuperseded(factSet, [1]); // drop the $10M allegation
check("drops the superseded fact by 1-indexed position", survived.length === 2 && !survived.some((f) => /10 million/.test(f.fact)));
check("keeps the authoritative and unrelated facts", survived.some((f) => /8 million/.test(f.fact)) && survived.some((f) => /1,040/.test(f.fact)));
check("ignores out-of-range indices", dropSuperseded(factSet, [0, 99]).length === 3);

console.log("attributionFor returns a named ACTOR, never machinery:");
check("justice.gov attributes to the DOJ", attributionFor("https://www.justice.gov/opa/pr/x") === "the DOJ");
check("a court source attributes to the court", attributionFor("https://www.courtlistener.com/x") === "the court");
check("a named outlet attributes to itself", attributionFor("https://www.nytimes.com/x") === "The New York Times");
check("a blog yields no attribution (never invents authority)", attributionFor("https://someblog.blogspot.com/x") === undefined);

// Move #3 — generic-mechanism detection triggers the targeted dig.
console.log("mechanismIsGeneric:");
check("flags a mechanism described without numbers",
  mechanismIsGeneric([{ fact: "The scheme used thousands of bot accounts to stream the songs.", source: "x" }]) === true);
check("does NOT flag a quantified mechanism",
  mechanismIsGeneric([{ fact: "He ran 1,040 bot accounts generating 661,440 streams a day.", source: "x" }]) === false);
check("does NOT flag facts with no mechanism at all",
  mechanismIsGeneric([{ fact: "He was born in 1975 and grew up in Michigan.", source: "x" }]) === false);
check("one quantified fact in the set clears the flag",
  mechanismIsGeneric([
    { fact: "The scheme relied on bot accounts.", source: "x" },
    { fact: "Investigators counted 1,040 accounts across 52 cloud servers.", source: "y" },
  ]) === false);

// Move #5 — honest length. Budget is per-minute (2-3 load-bearing facts/min); the honesty
// ceiling reports the runtime a fact set actually supports.
console.log("honest length budget + ceiling:");
check("10 minutes needs ~25 facts", factBudgetForMinutes(10) === Math.round(10 * FACTS_PER_MINUTE));
check("20 minutes needs ~50 facts", factBudgetForMinutes(20) === 50);
check("budget is capped at MAX_FACTS", factBudgetForMinutes(1000) === MAX_FACTS);
check("a tiny ask still researches a floor of 6", factBudgetForMinutes(1) === 6);
check("no minutes defaults to a 10-minute budget", factBudgetForMinutes(undefined) === factBudgetForMinutes(10));
check("12 facts honestly supports about 5 minutes", honestMinutes(12) === 5);
check("50 facts supports about 20 minutes", honestMinutes(50) === 20);
// The ceiling case: a 20-min ask on a 12-fact case must report ~5, never claim 20.
check("thin case reports its honest length, not the ask", honestMinutes(12) < 20);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
