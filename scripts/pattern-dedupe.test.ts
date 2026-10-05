// Regression guard for cross-niche pattern de-duplication (samePattern): different scans name
// the same idea differently, and a duplicate import wastes one of the 3 universal-transfer slots.
import { patternTokens as t, samePattern as s, rankUniversalImports, canonicalizeNames } from "../src/lib/viral-frameworks";
const cases: [string, string, boolean][] = [
  ["Extreme ranking or extreme characterization", "Extreme characterization anchor", true],
  ["Extreme ranking or extreme characterization", "Extreme characterization of subject", true],
  ["Specificity anchor", "Concrete specificity anchor", true],
  ["Hidden or opaque system exposed", "Opaque or hidden system exposed through consequence", true],
  ["Specificity anchor", "Extreme characterization anchor", false],
  ["Expectation inversion", "Contradiction or value-inversion framing", false],
  ["Withheld or absent resolution", "Non-resolution / open tension", false],
  ["Second-person identity address", "Named authority as credibility anchor", false],
];
let fail = 0;
for (const [a, b, want] of cases) {
  const got = s(t(a), t(b));
  if (got !== want) { fail++; console.log(`FAIL  "${a}" ~ "${b}" -> ${got}, want ${want}`); }
}
// Ranking: an idea confirmed in 2 niches beats a higher-view one-off; own-niche ideas are never imported.
const row = (niche: string, name: string, universal: boolean, views: number) => ({ niche, remix_framework: name, title_formula: { universal }, source_views: views });
const own = [row("true-crime", "Capture arc", false, 9e6)];
const cross = [
  row("business", "Alarm-signal diagnostic question", true, 5e6),   // one-off, high views
  row("science", "Expectation inversion", true, 1e6),               // confirmed in 2 niches
  { niche: "business", remix_framework: "Expectation inversion framing", title_formula: {}, source_views: 1e5 }, // legacy untagged: confirms, doesn't vote
  row("history", "Royal-court intrigue arc", false, 2e6),
  row("science", "Capture arc pursuit", true, 8e6),                 // own niche already has it
];
const picked = rankUniversalImports(own, cross, 3).map((r) => r.remix_framework);
const rankChecks: [string, boolean][] = [
  ["confirmed idea ranks first", picked[0] === "Expectation inversion"],
  ["one-off still imported after it", picked[1] === "Alarm-signal diagnostic question"],
  ["own-niche idea not imported", !picked.includes("Capture arc pursuit")],
  ["niche-bound rows never imported", !picked.includes("Expectation inversion framing") && !picked.includes("Royal-court intrigue arc")],
];
// Vote: an old universal tag is cancelled by a later niche-bound re-scan of the same idea (tie = no transfer).
const voted = rankUniversalImports(own, [
  row("business", "Alarm-signal diagnostic question applied to a high-stakes subject", true, 5e6),
  row("business", "Alarm-signal diagnostic question", false, 5e6),
  row("science", "Expectation inversion", true, 1e6),
], 3).map((r) => r.remix_framework);
rankChecks.push(["tie vote blocks transfer", !voted.some((n: string) => n.startsWith("Alarm"))]);
rankChecks.push(["majority-universal still transfers", voted.includes("Expectation inversion")]);
// Canonical vocabulary: synonyms collapse to one name (most-used wins), distinct ideas stay separate.
const canon = canonicalizeNames([
  { remix_framework: "Specificity anchor", hook_type: "packaging" },
  { remix_framework: "Specificity anchor", hook_type: "packaging" },
  { remix_framework: "Concrete specificity anchor", hook_type: "packaging" },
  { remix_framework: "Withheld or absent resolution", hook_type: "story" },
], 10).map((c) => c.name);
rankChecks.push(["synonyms collapse to most-used name", canon.length === 2 && canon.includes("Specificity anchor") && !canon.includes("Concrete specificity anchor")]);
for (const [name, ok] of rankChecks) { cases.push([name, name, true]); if (!ok) { fail++; console.log(`FAIL  ${name} (got ${JSON.stringify(picked)})`); } }
console.log(`pattern-dedupe: ${cases.length - fail}/${cases.length} passed`);
if (fail) process.exit(1);
