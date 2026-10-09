// Report for the v3 re-score (rescore-v3/). Primary metric: SERIOUS (material) errors, counted per sentence with at
// least one material claim. Uncertainty is computed on matched script pairs (same case + run index) and on case
// means (8 pairs), by bootstrap; sentences are never treated as independent.
//   npx tsx scripts/benchmark/failure-set-v1/rescore-report.ts
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

const D = "scripts/benchmark/failure-set-v1/rescore-v3";
const rows = readdirSync(D).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(D, f), "utf8")));
const norm = (t: string) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const factsText = (id: string) => norm(JSON.parse(readFileSync(`scripts/benchmark/fixtures/${id}.json`, "utf8")).map((f: any) => f.fact).join(" "));

// Category of a serious claim (rule-based, documented): by v3 status, then by what the unsupported claim contains.
function category(c: any, research: string): string {
  if (c.status === "misattached") return "misattachment (real fact, wrong target)";
  if (c.status === "overstated") return "overstatement (stronger than the source)";
  if (c.status === "contradicted") return "contradiction";
  if (/\d/.test(c.claim)) return "unsupported number/date";
  const names = (c.claim.match(/\b[A-Z][a-z]{2,}(?:\s[A-Z][a-z]+)*/g) || []).filter((n: string, k: number) => k > 0 || !/^(The|A|An|He|She|They|It|In|On|At|By|When|What|That|This|His|Her)$/.test(n));
  if (names.some((n: string) => !research.includes(norm(n)))) return "outside fact (name/place/title/work not in research)";
  return "invented detail or event";
}

const per = rows.map((r) => {
  const research = factsText(r.case);
  const serious = r.judged.filter((s: any) => s.material);
  const claims = serious.flatMap((s: any) => s.claims.filter((c: any) => c.material).map((c: any) => ({ ...c, sentence: s.sentence, cat: category(c, research) })));
  // Stage: only where the sentence matches an error the original run traced (stage texts were not saved).
  const stageOf = (sent: string) => { const e = r.v1Errors.find((x: any) => norm(x.sentence) === norm(sent) || norm(sent).includes(norm(x.script_quote))); return e ? (String(e.first_seen).startsWith("section_") ? "section_writer" : e.first_seen) : "untraced"; };
  return { set: r.set, case: r.case, run: Number(r.file.match(/run(\d+)/)![1]), words: r.words, sentences: r.judged.length, failed: r.judged.filter((s: any) => s.failed).length,
    serious: serious.length, any: r.judged.filter((s: any) => s.error).length, per1k: (serious.length / r.words) * 1000, claims, stages: serious.map((s: any) => stageOf(s.sentence)),
    gateRemoved: r.set === "expA" ? r.gateOriginals.filter((g: any, k: number) => g.material && !norm(r.judged.map((s: any) => s.sentence).join(" ")).includes(norm(r.gateLog[k].sentence))).length : 0,
    gateIntroduced: r.set === "expA" ? serious.filter((s: any) => r.gateLog.some((g: any) => g.result && norm(g.result) === norm(s.sentence) && !r.gateOriginals[r.gateLog.indexOf(g)]?.material)).length : 0,
    gateChanged: r.set === "expA" ? r.gateLog.length : 0 };
});

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const boot = (diffs: number[], n = 10000) => { const m: number[] = []; for (let b = 0; b < n; b++) m.push(mean(diffs.map(() => diffs[Math.floor(rnd() * diffs.length)]))); m.sort((x, y) => x - y); return [m[Math.floor(n * 0.025)], m[Math.floor(n * 0.975)]]; };
const f2 = (x: number) => x.toFixed(2);

const B = per.filter((p) => p.set === "baseline"), E = per.filter((p) => p.set === "expA");
const lines: string[] = [];
const log = (s = "") => { console.log(s); lines.push(s); };
log(`RE-SCORE with accuracy_judge_v3 (holdout-validated): ${B.length} baseline + ${E.length} Experiment A scripts; failed sentence calls: ${per.reduce((a, p) => a + p.failed, 0)}`);
for (const [name, S] of [["Baseline", B], ["Experiment A", E]] as const)
  log(`${name.padEnd(13)} serious errors per script ${f2(mean(S.map((p) => p.serious)))} | per 1,000 words ${f2(mean(S.map((p) => p.per1k)))} | any error per script ${f2(mean(S.map((p) => p.any)))} | words ${Math.round(mean(S.map((p) => p.words)))}`);

const pairs = B.map((b) => ({ b, e: E.find((e) => e.case === b.case && e.run === b.run) })).filter((x) => x.e) as { b: any; e: any }[];
for (const [label, key] of [["per script", "serious"], ["per 1,000 words", "per1k"]] as const) {
  const d = pairs.map((x) => x.e[key] - x.b[key]); const [lo, hi] = boot(d);
  const cases = [...new Set(pairs.map((x) => x.b.case))]; const dc = cases.map((c) => mean(pairs.filter((x) => x.b.case === c).map((x) => x.e[key] - x.b[key]))); const [clo, chi] = boot(dc);
  log(`Experiment A minus baseline, serious ${label}: ${f2(mean(d))} (95% interval ${f2(lo)} to ${f2(hi)}, ${pairs.length} matched pairs) | by case: ${f2(mean(dc))} (${f2(clo)} to ${f2(chi)}, ${cases.length} cases)`);
}
log("\nPer case (serious errors per script, run1/run2): baseline -> Experiment A");
for (const c of [...new Set(B.map((p) => p.case))]) log(`  ${c.padEnd(18)} ${B.filter((p) => p.case === c).sort((a, b) => a.run - b.run).map((p) => p.serious).join("/")} -> ${E.filter((p) => p.case === c).sort((a, b) => a.run - b.run).map((p) => p.serious).join("/")}`);

for (const [name, S] of [["Baseline", B], ["Experiment A", E]] as const) {
  const cats: Record<string, number> = {}; S.flatMap((p) => p.claims).forEach((c: any) => (cats[c.cat] = (cats[c.cat] || 0) + 1));
  const st: Record<string, number> = {}; S.flatMap((p) => p.stages).forEach((s: string) => (st[s] = (st[s] || 0) + 1));
  log(`\n${name}: serious claims by category`); Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => log(`  ${String(v).padStart(3)}  ${k}`));
  log(`${name}: serious sentences by first stage (traceable only where it matches an old-run trace)`); Object.entries(st).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => log(`  ${String(v).padStart(3)}  ${k}`));
}
log(`\nExperiment A gate: ${E.reduce((a, p) => a + p.gateChanged, 0)} sentences changed | serious errors in the changed originals that no longer appear in the final: ${E.reduce((a, p) => a + p.gateRemoved, 0)} | serious errors in the final that came from a gate rewrite of a non-serious original: ${E.reduce((a, p) => a + p.gateIntroduced, 0)}`);
log("\nExamples of serious errors (baseline):"); B.flatMap((p) => p.claims.map((c: any) => ({ ...c, case: p.case }))).slice(0, 12).forEach((c: any) => log(`  [${c.case}] ${c.cat}: "${c.claim.slice(0, 90)}" :: ${c.why.slice(0, 120)}`));
writeFileSync("scripts/benchmark/failure-set-v1/rescore-v3-report.txt", lines.join("\n"));
writeFileSync("scripts/benchmark/failure-set-v1/rescore-v3-per-script.json", JSON.stringify(per.map(({ claims, ...p }) => ({ ...p, seriousClaims: claims })), null, 1));
