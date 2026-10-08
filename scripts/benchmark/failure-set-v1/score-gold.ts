// Scores the gate and the frozen judge against the hand labels (labels.json). Strata were sampled at different
// rates, so each item is weighted by (stratum population / stratum sample) to estimate population precision/recall.
//   npx tsx scripts/benchmark/failure-set-v1/score-gold.ts
import { readFileSync } from "fs";
const D = "scripts/benchmark/failure-set-v1";
const pool: any[] = JSON.parse(readFileSync(`${D}/claims-pool.json`, "utf8"));
const L = JSON.parse(readFileSync(`${D}/labels.json`, "utf8"));
const NEG_POP = Number(process.argv[2] || 0);
const pop: Record<string, number> = { A_gate_confirmed: 73, B_gate_overblock: 312, C_gate_missed: 36, D_unflagged: NEG_POP };
const n: Record<string, number> = {}; pool.forEach((i) => (n[i.stratum] = (n[i.stratum] || 0) + 1));
const POS = new Set(["unsupported", "misattached", "overinterpretation"]);
const gateFlag = (i: any) => i.stratum.startsWith("A") || i.stratum.startsWith("B");
const judgeFlag = (i: any) => i.stratum.startsWith("A") || i.stratum.startsWith("C");
function score(name: string, flag: (i: any) => boolean, isPos: (l: any) => boolean) {
  let tp = 0, fp = 0, fn = 0;
  for (const i of pool) { const w = pop[i.stratum] / n[i.stratum]; const p = isPos(L[i.id]); const f = flag(i); if (f && p) tp += w; else if (f && !p) fp += w; else if (!f && p) fn += w; }
  console.log(`${name.padEnd(34)} precision ${(100 * tp / (tp + fp)).toFixed(0)}%  recall ${(100 * tp / (tp + fn)).toFixed(0)}%   (est. TP ${tp.toFixed(0)} FP ${fp.toFixed(0)} FN ${fn.toFixed(0)})`);
}
for (const [label, isPos] of [["any unsupported", (l: any) => POS.has(l.label)], ["MATERIAL unsupported", (l: any) => POS.has(l.label) && l.material]] as const) {
  console.log(`\n== positive = ${label}`);
  score("gate (Opus verifier + entity check)", gateFlag, isPos); score("judge v1 (Sonnet)", judgeFlag, isPos);
}
const by: any = {}; pool.forEach((i) => { const k = i.stratum; by[k] = by[k] || {}; const l = L[i.id].label + (POS.has(L[i.id].label) && L[i.id].material ? "*" : ""); by[k][l] = (by[k][l] || 0) + 1; });
console.log("\nlabels by stratum (* = material):", JSON.stringify(by, null, 1));
