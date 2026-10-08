// CLAIM-ALIGNMENT POOL (Evidence Integrity Failure Set v1, 2026-10-07). Stratified sample of real claims from
// Experiment A, to be labeled against the research (not against any model judge):
//   A gate flag the judge confirmed (30) | B gate flag the judge called fine, i.e. likely overblock (45)
//   C error that reached the final script, born in the section writer, the gate let through (all)
//   D sentence with checkable specifics nobody flagged, i.e. likely supported (40)
// Seeded, so the pool is reproducible.   npx tsx scripts/benchmark/failure-set-v1/build-pool.ts
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { splitSentences } from "../../../src/lib/script-compliance";
const DIR = "scripts/benchmark/failure-set-v1/expA";
let seed = 20261007; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const sample = <T,>(a: T[], n: number) => a.map((x) => ({ x, k: rnd() })).sort((p, q) => p.k - q.k).slice(0, n).map((p) => p.x);
const norm = (t: string) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const ob = JSON.parse(readFileSync(join(DIR, "overblock.json"), "utf8"));
const items: any[] = [];
const caseOf = (f: string) => f.replace(/-run\d+\.json$/, "");
for (const r of sample(ob.rows.filter((x: any) => x.judgeError), 30)) items.push({ stratum: "A_gate_confirmed", case: caseOf(r.file), file: r.file, sentence: r.sentence, span: r.sentence, gateResult: r.result, judgeWhy: r.judgeWhy });
for (const r of sample(ob.rows.filter((x: any) => !x.judgeError), 45)) items.push({ stratum: "B_gate_overblock", case: caseOf(r.file), file: r.file, sentence: r.sentence, span: r.sentence, gateResult: r.result });
const flaggedSents = new Set(ob.rows.map((x: any) => norm(x.sentence)));
const negatives: any[] = [];
for (const f of readdirSync(DIR).filter((f) => /-run\d+\.json$/.test(f))) {
  const r = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  for (const e of r.finalErrors.filter((e: any) => ["unsupported_specificity", "contradiction"].includes(e.category) && String(e.first_seen).startsWith("section_")))
    items.push({ stratum: "C_gate_missed", case: caseOf(f), file: f, sentence: e.sentence, span: e.script_quote, judgeWhy: [`${e.category}: ${e.why}`] });
  const judged = new Set(r.finalErrors.map((e: any) => norm(e.sentence)));
  for (const s of (r.final as string).split(/\n\n+/).flatMap((p) => splitSentences(p)))
    if (/\d|(?<=[a-z,]\s)[A-Z][a-z]+/.test(s) && s.split(/\s+/).length >= 8 && !judged.has(norm(s)) && !flaggedSents.has(norm(s))) negatives.push({ stratum: "D_unflagged", case: caseOf(f), file: f, sentence: s.trim(), span: s.trim() });
}
items.push(...sample(negatives, 40));
items.forEach((it, i) => (it.id = `C${String(i + 1).padStart(3, "0")}`));
writeFileSync("scripts/benchmark/failure-set-v1/claims-pool.json", JSON.stringify(items, null, 1));
const by: any = {}; items.forEach((i) => (by[i.stratum] = (by[i.stratum] || 0) + 1)); console.log(items.length, by);
