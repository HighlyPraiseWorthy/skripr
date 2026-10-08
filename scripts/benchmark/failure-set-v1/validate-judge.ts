// Validates a judge against the claim-alignment gold set (labels.json). Each gold sentence is judged in a batch
// with the other gold sentences from its case; a sentence counts as flagged if any claim in it gets an error status.
// DEV cases are for prompt work; TEST cases are held out and only reported. Target: >=85% agreement.
//   npx tsx --env-file=.env.local scripts/benchmark/failure-set-v1/validate-judge.ts [--split dev|test|all] [--model m] [--runs 2]
import { readFileSync, writeFileSync } from "fs";
import { judgeAccuracyV2, ERROR_STATUSES } from "../accuracy-judge-v2";

const D = "scripts/benchmark/failure-set-v1";
const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const DEV = ["freshwaters", "wright", "ltcm", "chapo-chicago"], TEST = ["streaming-fraud", "jones", "psychopathy", "fast-food-prices"];
const split = arg("split", "dev"); const model = arg("model", "claude-sonnet-4-6"); const runs = Number(arg("runs", "1"));
const cases = split === "dev" ? DEV : split === "test" ? TEST : [...DEV, ...TEST];
const pool: any[] = JSON.parse(readFileSync(`${D}/claims-pool.json`, "utf8")).filter((i: any) => cases.includes(i.case));
const L = JSON.parse(readFileSync(`${D}/labels.json`, "utf8"));
const POS = new Set(["unsupported", "misattached", "overinterpretation"]);
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "-");

(async () => {
  const runFlags: Record<string, { flag: boolean; material: boolean; why: string[] }>[] = [];
  for (let r = 0; r < runs; r++) {
    const flags: Record<string, { flag: boolean; material: boolean; why: string[] }> = {};
    await Promise.all(cases.map(async (c) => {
      const items = pool.filter((i) => i.case === c);
      const facts = JSON.parse(readFileSync(`scripts/benchmark/fixtures/${c}.json`, "utf8"));
      const j = await judgeAccuracyV2(items.map((i) => i.sentence), facts, { model });
      if (j.failedWindows) console.log(`[${c}] ${j.failedWindows} window(s) FAILED`);
      items.forEach((it, k) => { const e = j.errors.filter((x) => x.i === k);
        flags[it.id] = { flag: e.length > 0, material: e.some((x) => x.material), why: e.map((x) => `${x.status}${x.material ? "*" : ""}: ${x.claim} :: ${x.why}`) }; });
    }));
    runFlags.push(flags);
  }
  for (const [name, isPos, get] of [["any error", (l: any) => POS.has(l.label), (f: any) => f.flag], ["MATERIAL error", (l: any) => POS.has(l.label) && l.material, (f: any) => f.flag && f.material]] as const) {
    runFlags.forEach((flags, r) => {
      let agree = 0, tp = 0, fp = 0, fn = 0;
      for (const it of pool) { const p = isPos(L[it.id]); const f = get(flags[it.id]); if (p === f) agree++; if (f && p) tp++; if (f && !p) fp++; if (!f && p) fn++; }
      console.log(`[${split} run ${r + 1}] ${name.padEnd(15)} agreement ${pct(agree, pool.length)} (${agree}/${pool.length})  precision ${pct(tp, tp + fp)}  recall ${pct(tp, tp + fn)}`);
    });
  }
  if (runs > 1) { const same = pool.filter((it) => runFlags.every((f) => f[it.id].flag === runFlags[0][it.id].flag)).length; console.log(`self-consistency (sentence level): ${pct(same, pool.length)}`); }
  const dis = pool.filter((it) => runFlags[0][it.id].flag !== POS.has(L[it.id].label));
  writeFileSync(`${D}/validate-${split}-${model.replace(/[^a-z0-9]+/g, "")}.json`, JSON.stringify(dis.map((it) => ({ id: it.id, label: L[it.id], judge: runFlags[0][it.id], sentence: it.sentence })), null, 1));
  console.log(`\nDISAGREEMENTS (${dis.length}):`);
  for (const it of dis) console.log(`- ${it.id} gold=${L[it.id].label}${L[it.id].material ? "*" : ""} judge=${runFlags[0][it.id].flag ? "ERROR" : "ok"} | ${it.sentence.slice(0, 140)}\n    ${runFlags[0][it.id].why.join(" || ").slice(0, 300) || L[it.id].note}`);
})();
