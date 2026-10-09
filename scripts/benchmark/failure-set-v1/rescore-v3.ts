// RE-SCORE (2026-10-08): the 32 frozen scripts (16 baseline + 16 Experiment A, commit cb62e05) with the frozen,
// holdout-validated accuracy_judge_v3 (commit a61781c). Nothing is generated. Per-script results are cached so a
// crash resumes. Also judges the ORIGINAL form of every sentence the Experiment A gate changed, to count errors the
// gate removed vs introduced.
//   npx tsx --env-file=.env.local scripts/benchmark/failure-set-v1/rescore-v3.ts
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { judgeSentencesV3 } from "../accuracy-judge-v3";
import { splitSentences } from "../../../src/lib/script-compliance";

const D = "scripts/benchmark/failure-set-v1"; const OUT = join(D, "rescore-v3"); mkdirSync(OUT, { recursive: true });
const facts = (id: string) => JSON.parse(readFileSync(`scripts/benchmark/fixtures/${id}.json`, "utf8"));
const sentencesOf = (t: string) => t.split(/\n\n+/).flatMap((p) => splitSentences(p)).map((s) => s.trim()).filter(Boolean);

(async () => {
  const jobs: { set: string; file: string }[] = [];
  for (const set of ["baseline", "expA"]) for (const f of readdirSync(join(D, set)).filter((f) => /-run\d+\.json$/.test(f)).sort()) jobs.push({ set, file: f });
  // Two scripts at a time, 8 sentence calls each.
  const queue = [...jobs];
  const worker = async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      const out = join(OUT, `${j.set}__${j.file}`);
      if (existsSync(out)) continue;
      const row = JSON.parse(readFileSync(join(D, j.set, j.file), "utf8")); const id = j.file.replace(/-run\d+\.json$/, "");
      const sents = sentencesOf(row.final);
      const t0 = Date.now();
      const judged = await judgeSentencesV3(sents, facts(id), { concurrency: 8 });
      // Experiment A only: judge the pre-gate form of every sentence the gate changed.
      const gateOriginals = j.set === "expA" && Array.isArray(row.gateLog) && row.gateLog.length
        ? await judgeSentencesV3(row.gateLog.map((g: any) => g.sentence), facts(id), { concurrency: 8 }) : [];
      writeFileSync(out, JSON.stringify({ set: j.set, file: j.file, case: id, words: row.final.split(/\s+/).filter(Boolean).length, judged, gateLog: row.gateLog || [], gateOriginals, v1Errors: row.finalErrors || [] }, null, 1));
      const ser = judged.filter((s) => s.material).length, any = judged.filter((s) => s.error).length, failed = judged.filter((s) => s.failed).length;
      console.log(`[${j.set} ${j.file}] ${sents.length} sentences, serious ${ser}, any ${any}${failed ? `, FAILED ${failed}` : ""} (${Math.round((Date.now() - t0) / 1000)}s)`);
    }
  };
  await Promise.all([worker(), worker()]);
  console.log("RESCORE DONE");
})();
