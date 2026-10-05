// REGRESSION SUITE for the research CONFLICT-RESOLUTION layer (2026-09-18 arc). These lock the
// DETERMINISTIC halves of auto-resolution — the parts whose reliability the LLM judgment leans on —
// so a future prompt tweak or refactor can't silently break them. We do NOT test resolveFinalConflicts
// itself (it calls the model, non-deterministic); we test the code it depends on:
//   - extractNumericSignals: pulls comparable figures (money / duration / height / date) with context
//   - detectNumericClusters: the recall guarantee + the guards that stop FALSE clusters
//   - FILE_META_JUNK_RE: the file/landing-page metadata junk filter (O.J. Vault regression)
// Run: npx tsx scripts/conflict-resolution.test.ts
import { extractNumericSignals, detectNumericClusters, FILE_META_JUNK_RE } from "../src/lib/research.ts";

let failures = 0;
const check = (name: string, cond: boolean) => {
  console.log(`  ${cond ? "✓" : "✗"} ${name}`);
  if (!cond) failures++;
};
const facts = (arr: string[]) => arr.map((f) => ({ fact: f, source: null }));
const sig = (f: string) => extractNumericSignals(f);
const has = (f: string, cat: string, value: number, ctx?: string) => sig(f).some((s) => s.cat === cat && s.value === value && (ctx === undefined || s.ctx === ctx));
// A cluster keyed cat:ctx exists with exactly these fact indices (order-insensitive).
const clusterIdx = (fs: string[], label: string) => {
  const c = detectNumericClusters(facts(fs)).find((x) => x.label === label);
  return c ? c.members.map((m) => m.i).sort((a, b) => a - b) : null;
};
const clusterLabels = (fs: string[]) => detectNumericClusters(facts(fs)).map((c) => c.label).sort();

console.log("extractNumericSignals — money:");
check("$500,000 -> 500000 (total)", has("the final confirmed ransom was $500,000, delivered by the FBI", "money", 500000, "total"));
check("$1 million -> 1000000", has("collected a $1 million ransom before flying to Algeria", "money", 1000000));
check("$323.5 million -> 323500000 (tranche via 'Project Star'/'financing')", has("Project Star involved seven banks financing $323.5 million in computer equipment", "money", 323500000, "tranche"));
check("$350 million defrauded -> total", has("they defrauded the United States and foreign banks of $350 million", "money", 350000000, "total"));
check("$200 million traced -> recovered ctx", has("About $200 million had been traced and frozen by the FBI", "money", 200000000, "recovered"));

console.log("extractNumericSignals — duration:");
check("'17 1/2 years' -> 17.5 (sentence)", has("ultimately sentenced to 17 1/2 years in prison", "dur", 17.5, "sentence"));
check("'17 years' -> 17 (sentence)", has("was sentenced to 17 years in federal prison", "dur", 17, "sentence"));
check("'15 to 30 years' RANGE is excluded (no dur signal)", sig("sentenced to 15 to 30 years in prison").filter((s) => s.cat === "dur").length === 0);
check("'four decades' -> 40", has("had been a fugitive for more than four decades", "dur", 40));
check("calendar year '1972' is NOT a duration", sig("hijacked in 1972 and fled").filter((s) => s.cat === "dur").length === 0);
check("'over 23 years' -> 23 (fugitive)", has("had been on the lam for over 23 years", "dur", 23, "fugitive"));

console.log("extractNumericSignals — height:");
check("'5 feet 10 inches' -> 70", has("about 5 feet 10 inches tall and 170 pounds", "height", 70));
check("'5 feet 11 inches' -> 71", has("approximately 5 feet 11 inches tall", "height", 71));

console.log("extractNumericSignals — date (year-month key, day value):");
check("'February 4, 1997' -> date 1997-02 day 4", has("On February 4, 1997, the civil jury found Simpson liable", "date", 4, "1997-02"));
check("'9 November 1998' -> date 1998-11 day 9", has("Ruffo disappeared on 9 November 1998", "date", 9, "1998-11"));

console.log("detectNumericClusters — RECALL (must surface real conflicts):");
check("ransom $500k vs $1M -> money:total cluster", (() => { const i = clusterIdx(["ransom was $500,000, delivered by the FBI", "collected a $1 million ransom", "demanded $1 million in ransom"], "money:total"); return !!i && i.length >= 2; })());
check("sentence 17 vs 17.5 -> dur:sentence cluster", (() => { const i = clusterIdx(["sentenced to 17 1/2 years in prison", "the poster says he was sentenced to 17 years in prison"], "dur:sentence"); return JSON.stringify(i) === JSON.stringify([1, 2]); })());
check("height 5'10 vs 5'11 -> height cluster", (() => { const i = clusterIdx(["described as about 5 feet 10 inches tall", "the notice said approximately 5 feet 11 inches tall"], "height:height"); return JSON.stringify(i) === JSON.stringify([1, 2]); })());
check("dates Feb 4 vs Feb 5 1997 (same year-month) -> date:1997-02 cluster", (() => { const i = clusterIdx(["On February 4, 1997, the civil jury found Simpson liable", "On February 5, 1997, Simpson was found liable in the civil trial"], "date:1997-02"); return JSON.stringify(i) === JSON.stringify([1, 2]); })());
check("dates Sep 26 vs Sep 28 2011 -> date:2011-09 cluster", (() => { const i = clusterIdx(["arrested in Portugal on September 26, 2011", "arrested near Lisbon on September 28, 2011"], "date:2011-09"); return JSON.stringify(i) === JSON.stringify([1, 2]); })());

console.log("detectNumericClusters — GUARDS (must NOT create false clusters):");
check("$350M total vs $323.5M tranche do NOT cluster (different contexts)", (() => { const ls = clusterLabels(["they defrauded banks of $350 million", "Project Star involved financing $323.5 million in equipment"]); return !ls.includes("money:total") && !ls.some((l) => l.startsWith("money") && clusterIdx(["they defrauded banks of $350 million", "Project Star involved financing $323.5 million in equipment"], l)!.length >= 2); })());
check("five identical $350M facts do NOT cluster (single distinct value)", detectNumericClusters(facts(["defrauded banks of $350 million", "the scheme defrauded $350 million", "out of $350 million", "banks of $350 million", "totaling $350 million"])).length === 0);
check("two figures inside ONE fact ($200M/$180M) do NOT cluster", detectNumericClusters(facts(["About $200 million had been traced and frozen, of which about $180 million was invested in stocks"])).length === 0);
check("Jul 31 vs Aug 31 1972 (different months) do NOT cluster here (left to LLM scan)", clusterIdx(["hijacked on July 31, 1972", "hijacked on August 31, 1972"], "date:1972-07") === null && clusterLabels(["hijacked on July 31, 1972", "hijacked on August 31, 1972"]).every((l) => !l.startsWith("date") || clusterIdx(["hijacked on July 31, 1972", "hijacked on August 31, 1972"], l)!.length < 2));
check("same date repeated (Nov 9 1998) does NOT cluster", detectNumericClusters(facts(["ordered to report to prison on Nov. 9, 1998", "last seen at a Home Depot on Nov. 9, 1998", "disappeared on 9 November 1998"])).length === 0);
check("sentence 17.5 (dur) never clusters with fugitive 23 (different context)", (() => { const ls = clusterLabels(["sentenced to 17 1/2 years in prison", "on the lam for over 23 years"]); return ls.length === 0; })());

console.log("FILE_META_JUNK_RE — file/landing-page metadata (O.J. Vault regression):");
const junk = [
  "The document is hosted on the FBI's official public records repository known as 'The Vault'",
  "The subject of the file is identified as 'Orenthal James Simpson (OJ Simpson)'",
  "The specific file is labeled 'Orenthal James Simpson (OJ Simpson) Part 01'",
  "The file is available as a PDF document",
  "The PDF document size is listed as 24,785 kB",
  "The PDF document size is also expressed as 25,380,765 bytes",
  "The document is categorized under the FBI Vault's records system",
];
const real = [
  "The civil jury awarded $8.5 million in compensatory damages and later $25 million in punitive damages.",
  "The transcript archive contains 538,000+ lines across 4,600+ proceedings, spanning 230 court days.",
  "The official case name used in the criminal trial was The People of the State of California v. Orenthal James Simpson.",
  "On February 4, 1997, the civil jury found Simpson liable and awarded roughly $33.5 million.",
  "No murder weapon was ever recovered in the O.J. Simpson case.",
  "He was labeled the most wanted man in America.",
];
junk.forEach((f, i) => check(`junk[${i}] flagged`, FILE_META_JUNK_RE.test(f)));
real.forEach((f, i) => check(`real[${i}] NOT flagged`, !FILE_META_JUNK_RE.test(f)));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
if (failures) process.exit(1);
