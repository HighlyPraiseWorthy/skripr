// Builds spotcheck-v3.md: 10 serious errors (judge v3) the Experiment A gate removed + 10 remaining after it, spread
// across cases, each with the cited research fact or, for "not in research" claims, the closest facts by rare-word overlap.
import { readFileSync, readdirSync, writeFileSync } from "fs";
const D = "scripts/benchmark/failure-set-v1/rescore-v3"; let seed = 20261008; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const sample = <T,>(a: T[], n: number) => a.map((x) => ({ x, k: rnd() })).sort((p, q) => p.k - q.k).slice(0, n).map((p) => p.x);
const removed: any[] = [], remaining: any[] = [];
for (const f of readdirSync(D).filter((f) => f.startsWith("expA"))) {
  const r = JSON.parse(readFileSync(`${D}/${f}`, "utf8")); const facts = JSON.parse(readFileSync(`scripts/benchmark/fixtures/${r.case}.json`, "utf8"));
  r.gateOriginals.forEach((g: any, k: number) => { if (g.material) removed.push({ case: r.case, sentence: g.sentence, claims: g.claims.filter((c: any) => c.material), facts, fix: r.gateLog[k].result || "(sentence removed)", action: r.gateLog[k].action }); });
  r.judged.forEach((s: any) => { if (s.material) remaining.push({ case: r.case, sentence: s.sentence, claims: s.claims.filter((c: any) => c.material), facts }); });
}
const pickSpread = (arr: any[], n: number) => { const out: any[] = []; const byCase: Record<string, any[]> = {}; sample(arr, arr.length).forEach((x) => (byCase[x.case] = byCase[x.case] || []).push(x)); const cs = Object.keys(byCase); for (let i = 0; out.length < n && i < 500; i++) { const c = cs[i % cs.length]; if (byCase[c].length) out.push(byCase[c].shift()); } return out; };
const A = pickSpread(removed, 10), B = pickSpread(remaining, 10);
const W = (t: string) => new Set(t.toLowerCase().replace(/['’]s\b/g, "").match(/[a-z]{4,}|\d+/g) || []);
const related = (text: string, facts: any[], k = 3) => {
  const sets = facts.map((f: any) => W(f.fact)); const df: Record<string, number> = {}; sets.forEach((s) => s.forEach((w) => (df[w] = (df[w] || 0) + 1))); const w = W(text);
  return sets.map((s, i) => ({ i, s: [...s].filter((x) => w.has(x)).reduce((a, x) => a + Math.log(facts.length / df[x]), 0) })).filter((x) => x.s > 0.5).sort((a, b) => b.s - a.s).slice(0, k);
};
const ev = (c: any, x: any) => {
  const k = /^F\d+$/.test(c.fact) ? Number(c.fact.slice(1)) : -1;
  if (k >= 0 && x.facts[k]) return `  > F${k}: ${x.facts[k].fact}`;
  const rel = related(`${c.claim} ${x.sentence}`, x.facts);
  return rel.length ? `  Closest research facts (none states this, per the judge):\n${rel.map((r) => `  > F${r.i}: ${x.facts[r.i].fact}`).join("\n")}` : "  (nothing related in the research)";
};
const out = ["# Spot-check: is Judge v3 right about these serious errors?", "", "Read each script line, what the judge says is wrong, and the research beside it. Answer **real** (a genuine serious error: a viewer would be misled), **minor** (an error, but not serious), or **wrong** (the research supports the line; the judge is mistaken).", "", "Reply in chat like `1 real, 2 minor, 3 wrong`.", "", "## Part A: errors the gate REMOVED (10)", ""];
let n = 0;
const item = (x: any, showFix: boolean) => { n++; out.push(`### ${n}. (${x.case})`, "", `**Script line:** ${x.sentence}`, "", ...x.claims.map((c: any) => `- Judge says **${c.status}**: "${c.claim}" (${c.why})\n\n${ev(c, x)}\n`), ...(showFix ? [`**What the gate did (${x.action}):** ${x.fix}`, ""] : []), "**Your answer:** ", ""); };
A.forEach((x) => item(x, true)); out.push("## Part B: errors still in the final script after the gate (10)", ""); B.forEach((x) => item(x, false));
writeFileSync("scripts/benchmark/failure-set-v1/spotcheck-v3.md", out.join("\n")); console.log(n, "items");
