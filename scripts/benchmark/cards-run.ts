// CARD BENCHMARK, runner. Generates angle cards for fixed cases from frozen research, with whichever
// version of the card route lives at --root, so two versions can be compared on identical facts.
// Run with cwd = --root (so "@/..." resolves to that version):
//   cd <root> && npx tsx <repo>/scripts/benchmark/cards-run.ts --root <root> --label current --out <dir>
// Auth is stubbed; everything else (models, niche learning blocks) runs for real.
import fs from "fs";
import path from "path";

const Module = require("module");
const origLoad = Module._load;
Module._load = function (req: string, ...rest: any[]) {
  if (req === "@clerk/nextjs/server") return { auth: async () => ({ userId: "user_3FPywGkZ9XTC286jWMtRw2oVMW2" }) };
  return origLoad.call(this, req, ...rest);
};

const arg = (k: string, d = "") => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const root = path.resolve(arg("root", process.cwd()));
const label = arg("label", "current");
const outDir = path.resolve(arg("out", "scripts/benchmark/results/cards"));
const benchDir = path.resolve(__dirname);
const only = arg("cases", "").split(",").filter(Boolean);
const concurrency = Number(arg("concurrency", "3"));

type Case = { id: string; topic: string; kind: string };
const cases: Case[] = JSON.parse(fs.readFileSync(path.join(benchDir, "cards-cases.json"), "utf8")).filter((c: Case) => !only.length || only.includes(c.id));
fs.mkdirSync(outDir, { recursive: true });

async function runCase(c: Case) {
  const facts = JSON.parse(fs.readFileSync(path.join(benchDir, "fixtures", `${c.id}.json`), "utf8")).map((f: any) => (f.source ? `${f.fact} (source: ${f.source})` : f.fact));
  const { POST } = require(path.join(root, "src/app/api/suggest-script-angles/route"));
  const logs: string[] = [];
  const t0 = Date.now();
  const res = await POST(new Request("http://bench/api", { method: "POST", body: JSON.stringify({ topic: c.topic, niche: "", videoLength: "long", grounding: { kind: c.kind, verdict: "documented", caseName: c.topic, caseSummary: "", facts } }) }));
  const j = await res.json().catch(() => ({}));
  const out = { case: c.id, topic: c.topic, label, ms: Date.now() - t0, status: res.status, niche: j.niche || null, angles: j.angles || [], error: j.error || null, logs };
  fs.writeFileSync(path.join(outDir, `${label}__${c.id}.json`), JSON.stringify(out, null, 1));
  console.error(`[cards-run] ${label} ${c.id}: ${out.angles.length} cards in ${Math.round(out.ms / 1000)}s ${out.error ? "ERROR " + out.error : ""}`);
}

(async () => {
  // Capture which learning blocks were injected per case (they log "[hooks] injected n=..." etc.).
  const origLog = console.log;
  const captured: string[] = [];
  console.log = (...a: any[]) => { captured.push(a.map(String).join(" ")); };
  const queue = [...cases];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) { const c = queue.shift()!; try { await runCase(c); } catch (e: any) { console.error(`[cards-run] ${label} ${c.id} FAILED ${e?.message || e}`); } }
  });
  await Promise.all(workers);
  console.log = origLog;
  fs.writeFileSync(path.join(outDir, `${label}__logs.txt`), captured.join("\n"));
})();
