// REGRESSION FIXTURE — the Michael Smith depth benchmark (ChatGPT's convergent 10-fact table).
// These are the granular, PRIMARY-SOURCE facts that separate an out-researched script from a
// news-summary one; they live in the DOJ indictment PDF. This file hard-codes them and provides a
// coverage matcher so any change to the research/extraction pipeline can be checked: run a live
// 20-min Michael Smith research pass, dump its fact set to JSON, and call benchmarkCoverage() on it.
// The matcher itself is proven offline here (a rich set scores high, a top-line-only set scores low),
// so it never silently rots. Michael Smith is the FIXTURE, not the target — the pipeline stays
// niche-agnostic; this test only measures whether the depth we fought for survives future changes.
//   node --experimental-strip-types --loader ./scripts/alias-loader.mjs scripts/benchmark-michael-smith.test.ts

// Each benchmark entry: a label + the anchor substrings (any one present = covered). Kept loose so
// a paraphrase still counts — we are measuring whether the FACT is present, not exact wording.
const BENCHMARK: { label: string; anchors: string[] }[] = [
  { label: "AI-artist aliases", anchors: ["calliope bloom", "calm market", "calorie screams"] },
  { label: "the 'TON of content' email (Oct 4 2018)", anchors: ["ton of content", "ton of songs"] },
  { label: "$1.3M to fund debit cards", anchors: ["1.3 million", "$1.3", "debit card"] },
  { label: "June 2019 milestone (88M streams / $110k a month)", anchors: ["88 million", "110,000", "$110,000"] },
  { label: "Oct 2018 proof of concept", anchors: ["proof of concept", "october 2018"] },
  { label: "~661,440 streams a day", anchors: ["661,440", "661440"] },
  { label: "~1,040 bot accounts", anchors: ["1,040", "1040 bot", "thousand bot"] },
  { label: "the $10M / settled forfeiture", anchors: ["10 million", "$10", "forfeit"] },
  { label: "distributor / platform warnings + denials", anchors: ["warned", "warning", "denied", "flagged"] },
  { label: "MLC halted payments (March 2023)", anchors: ["mlc", "mechanical licensing", "halted", "march 2023"] },
];

export function benchmarkCoverage(facts: string[]): { covered: number; total: number; missing: string[] } {
  const blob = facts.join("\n").toLowerCase();
  const missing: string[] = [];
  let covered = 0;
  for (const b of BENCHMARK) {
    if (b.anchors.some((a) => blob.includes(a.toLowerCase()))) covered++;
    else missing.push(b.label);
  }
  return { covered, total: BENCHMARK.length, missing };
}

let failures = 0;
function check(name: string, cond: boolean) { if (!cond) { failures++; console.log("  ✗ " + name); } else { console.log("  ✓ " + name); }}

// A DEEP fact set (indictment mined) covers the benchmark.
const deepSet = [
  "Smith created fake artists with names like Calliope Bloom, Calm Market, and Calorie Screams.",
  "In an October 4, 2018 email, a co-conspirator wrote that they needed a TON of content fast.",
  "Smith transferred about $1.3 million between 2020 and 2023 to fund the debit cards on the bot accounts.",
  "By June 2019 the accounts were generating 88 million streams a month, about $110,000.",
  "An October 2018 proof of concept showed the model worked.",
  "At its peak the network pushed 661,440 streams a day.",
  "The operation ran roughly 1,040 bot accounts.",
  "The scheme drew more than $10 million in royalties; the court later ordered forfeiture.",
  "Distributors warned Smith about the activity and he denied wrongdoing repeatedly.",
  "The MLC halted payments in March 2023 as the scheme unraveled.",
];
const deep = benchmarkCoverage(deepSet);
check("a deep (indictment-mined) fact set covers >= 9/10 of the benchmark", deep.covered >= 9);

// A THIN, news-summary-only set (the pre-403-fix state) covers little.
const thinSet = [
  "Michael Smith ran a massive streaming fraud scheme.",
  "He used bots and AI-generated songs to collect royalties.",
  "He was charged with wire fraud in 2024 and pleaded guilty.",
  "The scheme earned around $10 million over several years.",
];
const thin = benchmarkCoverage(thinSet);
check("a thin news-summary set scores low (<= 4/10)", thin.covered <= 4);
check("the matcher names what is missing", thin.missing.includes("AI-artist aliases") && thin.missing.includes("the 'TON of content' email (Oct 4 2018)"));
check("deep set is strictly better than thin set", deep.covered > thin.covered);

console.log(`\nbenchmark matcher: deep=${deep.covered}/${deep.total}, thin=${thin.covered}/${thin.total}`);
console.log("NOTE: to check the LIVE pipeline, dump a real Michael Smith research fact set to JSON and call benchmarkCoverage(facts) — this file proves the matcher, the live run proves the depth.");
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
