// REPAIR-MODE COMPARISON (2026-10-09), sentence level, no generation. The 385 sentences the Experiment A gate flagged,
// with their original flags, repaired by (a) the original rewrite repair (its saved outputs) and (b) the conservative
// repair (commit 0d92975), on identical research. Every output is judged by frozen accuracy_judge_v3 (commit a61781c);
// the originals' v3 verdicts come from rescore-v3/. Accuracy and preservation are reported SEPARATELY.
//   npx tsx --env-file=.env.local scripts/benchmark/failure-set-v1/compare-repair.ts
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { repairFlaggedConservative } from "../../../src/lib/evidence-gate";
import { judgeSentencesV3 } from "../accuracy-judge-v3";

const D = "scripts/benchmark/failure-set-v1"; const OUT = join(D, "compare-repair"); mkdirSync(OUT, { recursive: true });
const norm = (t: string) => String(t || "").toLowerCase().replace(/[‘’“”"']/g, "").replace(/[^a-z0-9$%.]+/g, " ").replace(/\.(?!\d)/g, " ").replace(/\s+/g, " ").trim();
const words = (t: string) => norm(t).split(" ").filter((w) => w.length >= 4 || /\d/.test(w));
const specifics = (t: string) => [...new Set((t.match(/\$?\d[\d,.]*%?|\b[A-Z][a-z]{2,}(?:\s[A-Z][a-z]+)*/g) || []).map((x) => x.toLowerCase().replace(/[.,]$/, "")))];

(async () => {
  for (const f of readdirSync(join(D, "rescore-v3")).filter((f) => f.startsWith("expA")).sort()) {
    const out = join(OUT, f); if (existsSync(out)) continue;
    const r = JSON.parse(readFileSync(join(D, "rescore-v3", f), "utf8"));
    const facts = JSON.parse(readFileSync(`scripts/benchmark/fixtures/${r.case}.json`, "utf8"));
    const research = facts.map((x: any) => (x.source ? `${x.fact} (source: ${x.source})` : x.fact)).join("\n");
    // Rebuild each sentence's original flags from the gate log: entity flags come first, attribute flags carry a "why".
    const items = r.gateLog.map((g: any) => { const nw = (g.why || []).length; const ent = g.unsupported.slice(0, g.unsupported.length - nw);
      return { sentence: g.sentence, bad: g.layer.includes("entity") ? ent : [], attr: (g.why || []).map((w: string, k: number) => ({ quote: g.unsupported[g.unsupported.length - nw + k], why: w })) }; });
    const cons = await repairFlaggedConservative(items, research);
    const oldOut = r.gateLog.map((g: any) => g.result || null); const consOut = cons.map((c) => c.result || null);
    const toJudge = [...oldOut, ...consOut].map((t, k) => ({ t, k })).filter((x) => x.t) as { t: string; k: number }[];
    const judged = await judgeSentencesV3(toJudge.map((x) => x.t), facts, { concurrency: 8 });
    const verdict = (k: number) => { const j = toJudge.findIndex((x) => x.k === k); return j >= 0 ? judged[j] : null; };
    const rows = r.gateLog.map((g: any, i: number) => ({ original: g.sentence, origV3: r.gateOriginals[i],
      old: { action: g.action, text: oldOut[i], v3: verdict(i) }, cons: { action: cons[i].action, text: consOut[i], v3: verdict(r.gateLog.length + i) } }));
    writeFileSync(out, JSON.stringify({ case: r.case, file: f, judge: "accuracy_judge_v3@a61781c", repair: "conservative@0d92975", rows }, null, 1));
    console.log(`[${f}] ${rows.length} sentences done`);
  }
  // REPORT
  const rows = readdirSync(OUT).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(join(OUT, f), "utf8")).rows);
  const lines: string[] = []; const log = (s = "") => { console.log(s); lines.push(s); };
  const sub = (name: string, R: any[]) => {
    log(`\n=== ${name}: ${R.length} sentences ===`);
    for (const m of ["old", "cons"] as const) {
      const lbl = m === "old" ? "Original rewrite repair" : "Conservative repair   ";
      const removed = R.filter((x) => !x[m].text).length;
      const serious = R.filter((x) => x[m].text && x[m].v3?.material).length;
      const unresolved = R.filter((x) => x.origV3?.material && x[m].text && x[m].v3?.material).length;
      const introduced = R.filter((x) => !x.origV3?.material && x[m].text && x[m].v3?.material).length;
      const anyErr = R.filter((x) => x[m].text && x[m].v3?.error).length;
      // Preservation: share of the original's content words kept (removed = 0); supported specifics kept.
      const kept = R.map((x) => { const o = words(x.original); if (!x[m].text || !o.length) return 0; const S = new Set(words(x[m].text)); return o.filter((w) => S.has(w)).length / o.length; });
      const supSpec = R.map((x) => { const flaggedTxt = norm((x.origV3?.claims || []).filter((c: any) => c.status !== "supported" && c.status !== "derived").map((c: any) => c.claim).join(" "));
        const sp = specifics(x.original).filter((s) => !flaggedTxt.includes(norm(s))); const outN = norm(x[m].text || ""); return { total: sp.length, kept: sp.filter((s) => outN.includes(norm(s))).length }; });
      const ts = supSpec.reduce((a, b) => a + b.total, 0), ks = supSpec.reduce((a, b) => a + b.kept, 0);
      log(`${lbl} | ACCURACY: serious errors left ${serious} (unresolved ${unresolved}, introduced ${introduced}), any error left ${anyErr} | PRESERVATION: removed ${removed}, original wording kept ${Math.round((100 * kept.reduce((a, b) => a + b, 0)) / Math.max(1, kept.length))}%, supported specifics kept ${ks}/${ts} (${Math.round((100 * ks) / Math.max(1, ts))}%)`);
    }
  };
  log(`REPAIR COMPARISON, judge accuracy_judge_v3@a61781c, conservative repair @0d92975. Originals: ${rows.filter((x) => x.origV3?.material).length} with a serious error, ${rows.filter((x) => !x.origV3?.error).length} fully supported.`);
  sub("ALL flagged sentences", rows);
  sub("Originals with a SERIOUS error", rows.filter((x) => x.origV3?.material));
  sub("Originals with only MINOR errors", rows.filter((x) => x.origV3?.error && !x.origV3?.material));
  sub("Originals FULLY SUPPORTED (should be left alone)", rows.filter((x) => !x.origV3?.error));
  const dis = rows.filter((x) => !!x.old.v3?.material !== !!x.cons.v3?.material || (!x.old.text) !== (!x.cons.text));
  log(`\nSentences where the two modes differ in outcome (serious-error status or removal): ${dis.length}`);
  dis.slice(0, 12).forEach((x) => log(`- ORIGINAL: ${x.original.slice(0, 140)}\n    old  (${x.old.action}${x.old.v3?.material ? ", SERIOUS" : ""}): ${x.old.text || "(removed)"}\n    cons (${x.cons.action}${x.cons.v3?.material ? ", SERIOUS" : ""}): ${x.cons.text || "(removed)"}`));
  writeFileSync(join(D, "compare-repair-report.txt"), lines.join("\n"));
})();
