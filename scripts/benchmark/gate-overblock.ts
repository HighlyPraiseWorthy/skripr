// OVERBLOCKING AUDIT (Evidence Integrity, 2026-10-07): every sentence the evidence gate changed is re-judged in
// its ORIGINAL form by the frozen accuracy_judge_v1 (a different model from the gate's Opus verifier). If the judge
// finds no error in the original, the gate's change counts as an overblock: a legitimate line rewritten or removed.
// Also: errors the gate INTRODUCED (final-script errors whose words come from a gate rewrite), and information lost
// on overblocked rewrites (concrete specifics in the original that the rewrite dropped, sentence by sentence).
//   npx tsx --env-file=.env.local scripts/benchmark/gate-overblock.ts <experimentDir>
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { judgeAccuracyV1 } from "./accuracy-judge";

const dir = process.argv[2];
const PRIMARY = new Set(["unsupported_specificity", "contradiction"]);
const specifics = (t: string) => (t.match(/\$?\d[\d,.]*%?/g) || []).length + (t.match(/(?<=[a-z,;]\s)[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g) || []).length;
const introduced: any[] = []; let finalPrimaryTotal = 0;
const norm = (t: string) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

(async () => {
  const files = readdirSync(dir).filter((f) => /-run\d+\.json$/.test(f));
  const rows: any[] = [];
  await Promise.all(files.map(async (f) => {
    const r = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const id = f.replace(/-run\d+\.json$/, "");
    const facts = JSON.parse(readFileSync(join("scripts/benchmark/fixtures", `${id}.json`), "utf8"));
    const research = facts.map((x: any) => (x.source ? `${x.fact} (source: ${x.source})` : x.fact)).join("\n");
    const log: any[] = r.gateLog || [];
    if (!log.length) return;
    // One sentence per paragraph so each original is judged on its own.
    const j = await judgeAccuracyV1(log.map((g) => g.sentence).join("\n\n"), research);
    const finalPrimary = (r.finalErrors || []).filter((e: any) => PRIMARY.has(e.category));
    introduced.push(...finalPrimary.filter((e: any) => log.some((g) => g.result && norm(g.result).includes(norm(e.script_quote)) && !norm(g.sentence).includes(norm(e.script_quote))))
      .map((e: any) => ({ file: f, quote: e.script_quote, why: e.why })));
    finalPrimaryTotal += finalPrimary.length;
    log.forEach((g) => {
      const hits = j.errors.filter((e) => norm(e.sentence) === norm(g.sentence) || norm(g.sentence).includes(norm(e.script_quote)));
      rows.push({ file: f, action: g.action, layer: g.layer, sentence: g.sentence, result: g.result || null,
        specificsLost: g.result ? Math.max(0, specifics(g.sentence) - specifics(g.result)) : specifics(g.sentence),
        judgeError: hits.length > 0, judgePrimary: hits.some((h) => PRIMARY.has(h.category)), judgeWhy: hits.map((h) => `${h.category}: ${h.why}`) });
    });
  }));
  const n = rows.length;
  const over = rows.filter((x) => !x.judgeError);
  const by = (k: string) => rows.reduce((m: any, x) => { const key = String(x[k]); m[key] = m[key] || { flags: 0, overblock: 0 }; m[key].flags++; if (!x.judgeError) m[key].overblock++; return m; }, {});
  const summary = { flags: n, judgeConfirmed: n - over.length, overblocks: over.length, overblockRate: n ? +((100 * over.length) / n).toFixed(1) : 0, byAction: by("action"), byLayer: by("layer"),
    errorsRemoved: n - over.length, errorsIntroduced: introduced.length, finalPrimaryErrors: finalPrimaryTotal,
    overblocksThatLostSpecifics: over.filter((x) => x.specificsLost > 0).length, specificsLostOnOverblocks: over.reduce((a, x) => a + x.specificsLost, 0) };
  writeFileSync(join(dir, "overblock.json"), JSON.stringify({ summary, introduced, rows }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  console.log("\nINTRODUCED BY GATE:"); introduced.forEach((x) => console.log(`- ${x.file}: ${x.quote}`));
  console.log("\nSAMPLE OVERBLOCKS:"); over.slice(0, 15).forEach((x) => console.log(`- [${x.action}] ${x.sentence}\n    -> ${x.result || "(removed)"}`));
})();
