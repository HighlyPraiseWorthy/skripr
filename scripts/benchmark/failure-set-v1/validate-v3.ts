// Judge v3 validation. DEV = the 151 Claude-labeled claims MINUS the 24 human-adjudicated ones and minus labels marked
// ambiguous (development only, not ground truth). HOLDOUT = human.json (frozen in commit 9bdf629; sha256 9ee6610507e2...),
// scored only with --split holdout. Reports serious-error (material) precision/recall + confusion matrix, then any-error.
//   npx tsx --env-file=.env.local scripts/benchmark/failure-set-v1/validate-v3.ts --split dev|holdout [--model m] [--limit n]
import { readFileSync, writeFileSync } from "fs";
import { judgeSentencesV3 } from "../accuracy-judge-v3";

const D = "scripts/benchmark/failure-set-v1";
const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const split = arg("split", "dev"); const model = arg("model", "claude-opus-5-5"); const limit = Number(arg("limit", "999"));
const H = JSON.parse(readFileSync(`${D}/human.json`, "utf8")); const L = JSON.parse(readFileSync(`${D}/labels.json`, "utf8"));
const POS = new Set(["unsupported", "misattached", "overinterpretation"]);
const all: any[] = JSON.parse(readFileSync(`${D}/claims-pool.json`, "utf8"));
const items = split === "holdout"
  ? all.filter((i) => H[i.id] && H[i.id] !== "skip")
  : all.filter((i) => !H[i.id] && !L[i.id].ambiguous).slice(0, limit);
const truth = (id: string) => split === "holdout"
  ? { any: H[id] !== "ok", material: H[id] === "error!" }
  : { any: POS.has(L[id].label), material: POS.has(L[id].label) && !!L[id].material };

(async () => {
  const pred: Record<string, any> = {};
  await Promise.all([...new Set(items.map((i) => i.case))].map(async (c) => {
    const its = items.filter((i) => i.case === c);
    const r = await judgeSentencesV3(its.map((i) => i.sentence), JSON.parse(readFileSync(`scripts/benchmark/fixtures/${c}.json`, "utf8")), { model });
    its.forEach((it, k) => (pred[it.id] = r[k]));
  }));
  const failed = items.filter((i) => pred[i.id].failed).length;
  console.log(`${split.toUpperCase()}: ${items.length} claims (${failed} failed calls) | model ${model}\n`);
  for (const key of ["material", "any"] as const) {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const it of items) { const t = truth(it.id)[key]; const p = key === "material" ? pred[it.id].material : pred[it.id].error; if (t && p) tp++; else if (!t && p) fp++; else if (t && !p) fn++; else tn++; }
    const pc = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "-");
    console.log(`${key === "material" ? "SERIOUS ERRORS" : "ANY ERROR     "}  agreement ${pc(tp + tn, items.length)}  precision ${pc(tp, tp + fp)}  recall ${pc(tp, tp + fn)}`);
    console.log(`                 confusion: judge flags & truth error ${tp} | judge flags, truth ok ${fp} | judge misses ${fn} | both ok ${tn}`);
  }
  const misses = items.filter((i) => truth(i.id).material && !pred[i.id].material);
  const falseAlarms = items.filter((i) => !truth(i.id).material && pred[i.id].material);
  const show = (i: any) => `- ${i.id} (${i.case}) ${i.sentence.slice(0, 120)}\n    judge: ${pred[i.id].claims.filter((c: any) => c.status !== "supported").map((c: any) => `${c.status}${c.material ? "*" : ""} "${c.claim.slice(0, 60)}" ${c.why.slice(0, 110)}`).join(" || ") || "all supported"}`;
  console.log(`\nSERIOUS ERRORS MISSED (${misses.length}):`); misses.forEach((i) => console.log(show(i)));
  console.log(`\nSERIOUS FALSE ALARMS (${falseAlarms.length}):`); falseAlarms.forEach((i) => console.log(show(i)));
  writeFileSync(`${D}/v3-${split}-${model.replace(/[^a-z0-9]+/g, "")}.json`, JSON.stringify(items.map((i) => ({ id: i.id, truth: truth(i.id), pred: pred[i.id] })), null, 1));
})();
