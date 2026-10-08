// Scores my labels, judge v1 and judge v2 against the HUMAN adjudication (human.json), the ground truth.
//   npx tsx --env-file=.env.local scripts/benchmark/failure-set-v1/score-human.ts [--runs 2] [--model m]
import { readFileSync, writeFileSync } from "fs";
import { judgeAccuracyV2 } from "../accuracy-judge-v2";
const D = "scripts/benchmark/failure-set-v1";
const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const H = JSON.parse(readFileSync(`${D}/human.json`, "utf8")); const L = JSON.parse(readFileSync(`${D}/labels.json`, "utf8"));
const pool: any[] = JSON.parse(readFileSync(`${D}/claims-pool.json`, "utf8")).filter((i: any) => H[i.id] && H[i.id] !== "skip");
const POS = new Set(["unsupported", "misattached", "overinterpretation"]);
const human = (id: string, material: boolean) => material ? H[id] === "error!" : H[id] !== "ok";
type Pred = Record<string, { any: boolean; material: boolean }>;
function report(name: string, p: Pred) {
  for (const mat of [false, true]) {
    let a = 0, tp = 0, fp = 0, fn = 0;
    for (const it of pool) { const h = human(it.id, mat); const f = mat ? p[it.id].material : p[it.id].any; if (h === f) a++; if (f && h) tp++; if (f && !h) fp++; if (!f && h) fn++; }
    const pc = (x: number, y: number) => (y ? `${Math.round((100 * x) / y)}%` : "-");
    console.log(`${name.padEnd(26)} ${mat ? "MATERIAL" : "any     "} agreement ${pc(a, pool.length)} (${a}/${pool.length})  precision ${pc(tp, tp + fp)}  recall ${pc(tp, tp + fn)}`);
  }
}
(async () => {
  console.log(`${pool.length} claims (skips excluded): human errors ${pool.filter((i) => human(i.id, false)).length}, material ${pool.filter((i) => human(i.id, true)).length}\n`);
  report("Claude labeler", Object.fromEntries(pool.map((i) => [i.id, { any: POS.has(L[i.id].label), material: POS.has(L[i.id].label) && !!L[i.id].material }])));
  report("judge v1 (frozen)", Object.fromEntries(pool.map((i) => { const f = i.stratum.startsWith("A") || i.stratum.startsWith("C"); return [i.id, { any: f, material: f }]; })));
  const model = arg("model", "claude-sonnet-4-6"); const runs = Number(arg("runs", "2"));
  const all: Pred[] = [];
  for (let r = 0; r < runs; r++) {
    const p: Pred = {};
    for (const c of [...new Set(pool.map((i) => i.case))]) {
      const items = pool.filter((i) => i.case === c);
      const j = await judgeAccuracyV2(items.map((i) => i.sentence), JSON.parse(readFileSync(`scripts/benchmark/fixtures/${c}.json`, "utf8")), { model });
      items.forEach((it, k) => { const e = j.errors.filter((x) => x.i === k); p[it.id] = { any: e.length > 0, material: e.some((x) => x.material) }; });
    }
    all.push(p); report(`judge v2 ${model.includes("opus") ? "opus" : "sonnet"} run ${r + 1}`, p);
  }
  writeFileSync(`${D}/score-human-${model.replace(/[^a-z0-9]+/g, "")}.json`, JSON.stringify(all, null, 1));
  const dis = pool.filter((i) => human(i.id, false) !== all[0][i.id].any);
  console.log(`\nv2 run 1 disagreements with you:`); dis.forEach((i) => console.log(`- ${i.id} you=${H[i.id]} v2=${all[0][i.id].any ? (all[0][i.id].material ? "error!" : "error") : "ok"} | ${i.sentence.slice(0, 110)}`));
})();
