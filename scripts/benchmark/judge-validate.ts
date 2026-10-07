// Step 0 of Evidence Integrity: is accuracy_judge_v1 trustworthy?
//  --golden       validity: does it agree with 20 hand-verified cases (errors caught, correct lines left alone)?
//  --consistency  reliability: the same 10 benchmark scripts judged twice; claim-level and per-category agreement.
import { readFileSync, readdirSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { judgeAccuracyV1, CATEGORIES, ACCURACY_JUDGE_VERSION } from "./accuracy-judge";

const DIR = "scripts/benchmark";
const flag = (n: string) => process.argv.includes(n);

async function golden() {
  const cases = JSON.parse(readFileSync(join(DIR, "accuracy-golden.json"), "utf8"));
  let caught = 0, expectedErrors = 0, catOk = 0, falsePos = 0, okLines = 0;
  const rows: string[] = [];
  await Promise.all(cases.map(async (c: any) => {
    const r = await judgeAccuracyV1(c.script, c.research);
    const flagged = new Map<number, string[]>();
    for (const e of r.errors) flagged.set(e.i, [...(flagged.get(e.i) || []), e.category]);
    for (const [k, cats] of Object.entries(c.expect) as [string, string[]][]) {
      expectedErrors++; const got = flagged.get(Number(k)) || [];
      if (got.length) { caught++; if (got.some((g) => cats.includes(g))) catOk++; }
      rows.push(`${got.length ? "CAUGHT " : "MISSED "} ${c.id} s${k}: expected ${cats.join("/")}, got ${got.join(",") || "nothing"}`);
    }
    for (const k of c.ok) { okLines++; const got = flagged.get(Number(k)) || []; if (got.length) { falsePos++; rows.push(`FALSE+  ${c.id} s${k}: flagged ${got.join(",")} on a correct line`); } }
  }));
  rows.sort().forEach((x) => console.log(x));
  console.log(`\nGOLDEN (${ACCURACY_JUDGE_VERSION}): caught ${caught}/${expectedErrors} real errors (right category ${catOk}/${expectedErrors}); flagged ${falsePos}/${okLines} correct lines`);
}

async function consistency() {
  const res = join(DIR, "results");
  const dirs = ["2026-10-06T23-17-44-base", "2026-10-06T23-17-44-struct"];
  const scripts: { id: string; body: string; research: string }[] = [];
  for (const d of dirs) for (const f of readdirSync(join(res, d)).filter((x) => x.endsWith(".script.json"))) {
    const id = f.replace(".script.json", ""); const g = JSON.parse(readFileSync(join(res, d, f), "utf8"));
    const fx = join(DIR, "fixtures", `${id}.json`); if (!existsSync(fx)) continue;
    const research = JSON.parse(readFileSync(fx, "utf8")).map((x: any) => (x.source ? `${x.fact} (source: ${x.source})` : x.fact)).join("\n");
    scripts.push({ id: `${d.split("-").pop()}:${id}`, body: g.body, research });
  }
  const per: any[] = []; const catA: Record<string, number> = {}, catB: Record<string, number> = {}, catBoth: Record<string, number> = {};
  let both = 0, onlyA = 0, onlyB = 0;
  for (const s of scripts) {
    const [A, B] = await Promise.all([judgeAccuracyV1(s.body, s.research), judgeAccuracyV1(s.body, s.research)]);
    const a = new Map(A.errors.map((e) => [e.i, e.category])), b = new Map(B.errors.map((e) => [e.i, e.category]));
    const shared = [...a.keys()].filter((i) => b.has(i));
    both += shared.length; onlyA += a.size - shared.length; onlyB += b.size - shared.length;
    for (const [i, c] of a) { catA[c] = (catA[c] || 0) + 1; if (b.has(i) && b.get(i) === c) catBoth[c] = (catBoth[c] || 0) + 1; }
    for (const [, c] of b) catB[c] = (catB[c] || 0) + 1;
    const words = s.body.split(/\s+/).length;
    per.push({ id: s.id, runA: A.errors.length, runB: B.errors.length, shared: shared.length, per1kA: +((A.errors.length / words) * 1000).toFixed(1), per1kB: +((B.errors.length / words) * 1000).toFixed(1), rejectedA: A.rejected, rejectedB: B.rejected });
    console.log(`${s.id.padEnd(26)} run A ${A.errors.length} errors (${per[per.length - 1].per1kA}/1k), run B ${B.errors.length} (${per[per.length - 1].per1kB}/1k), same sentences flagged: ${shared.length}; quotes rejected ${A.rejected}/${B.rejected}`);
  }
  const claimAgreement = both + onlyA + onlyB ? Math.round((100 * both) / (both + onlyA + onlyB)) : 0;
  const f1 = both * 2 + onlyA + onlyB ? Math.round((100 * 2 * both) / (2 * both + onlyA + onlyB)) : 0;
  console.log(`\nCLAIM-LEVEL: flagged by both ${both}, only run A ${onlyA}, only run B ${onlyB} -> overlap ${claimAgreement}% (F1 ${f1}%)`);
  for (const c of CATEGORIES) { const n = (catA[c] || 0) + (catB[c] || 0); console.log(`  ${c.padEnd(24)} run A ${catA[c] || 0}, run B ${catB[c] || 0}, same sentence + category ${catBoth[c] || 0}${n ? ` -> F1 ${Math.round((200 * (catBoth[c] || 0)) / n)}%` : ""}`); }
  writeFileSync(join(DIR, "results", "judge-consistency.json"), JSON.stringify({ version: ACCURACY_JUDGE_VERSION, per, both, onlyA, onlyB, claimAgreement, f1, catA, catB, catBoth }, null, 1));
}

(async () => { if (flag("--golden")) await golden(); if (flag("--consistency")) await consistency(); })();
