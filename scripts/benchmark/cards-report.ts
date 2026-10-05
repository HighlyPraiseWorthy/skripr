// CARD BENCHMARK, report. Turns summary.json from cards-judge.ts into one HTML page: the headline numbers
// per version, a per-case table, and every judged error with its quoted evidence, so each claim can be
// checked by hand.   npx tsx scripts/benchmark/cards-report.ts --dir <results dir> --out <file.html>
import fs from "fs";
import path from "path";

const arg = (k: string, d = "") => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const dir = path.resolve(arg("dir", "scripts/benchmark/results/cards"));
const out = path.resolve(arg("out", path.join(dir, "report.html")));
const S = JSON.parse(fs.readFileSync(path.join(dir, "summary.json"), "utf8"));
const esc = (t: any) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const LABEL: Record<string, string> = { baseline: "Before (Oct 1)", current: "Now", payoff: "With payoff fix" };
const COLOR: Record<string, string> = { baseline: "before", current: "now", payoff: "fix" };

function totals(label: string) {
  let n = 0, clean = 0, errors = 0, hs = 0, hsN = 0, ms = 0, runs = 0, dist = 0;
  const byType: Record<string, number> = {};
  for (const c of S.cases) {
    const r = c.runs[label]; if (!r) continue;
    runs++; n += r.n; clean += r.clean; errors += r.errors; ms += r.ms; dist += r.distinct;
    for (const g of r.cards) { if (g.hookStrength) { hs += g.hookStrength; hsN++; } for (const e of g.errors) byType[e.type] = (byType[e.type] || 0) + 1; for (const d of g.deterministic) { const k = /names family|opens on a family/.test(d) ? "privacy" : "title rules"; byType[k] = (byType[k] || 0) + 1; } }
  }
  return { n, clean, errors, cleanPct: n ? Math.round((clean / n) * 100) : 0, perCard: n ? +(errors / n).toFixed(2) : 0, hook: hsN ? +(hs / hsN).toFixed(1) : 0, secs: runs ? Math.round(ms / runs / 1000) : 0, distinct: runs ? +(dist / runs).toFixed(2) : 0, byType };
}
const T: Record<string, ReturnType<typeof totals>> = Object.fromEntries(S.labels.map((l: string) => [l, totals(l)]));
const types: string[] = [...new Set<string>(S.labels.flatMap((l: string) => Object.keys(T[l].byType)))].sort((a, b) => (T.baseline?.byType[b] || 0) - (T.baseline?.byType[a] || 0));
const maxType = Math.max(1, ...types.map((t) => Math.max(...S.labels.map((l: string) => T[l].byType[t] || 0))));

const kpi = (label: string) => {
  const t = T[label];
  return `<section class="ver ver-${label}"><h2>${esc(LABEL[label] || label)}</h2>
  <dl class="kpis">
    <div><dt>Cards with zero errors</dt><dd><span class="big">${t.cleanPct}%</span><span class="sub">${t.clean} of ${t.n}</span></dd></div>
    <div><dt>Errors per card</dt><dd><span class="big">${t.perCard}</span><span class="sub">${t.errors} total</span></dd></div>
    <div><dt>Hook strength</dt><dd><span class="big">${t.hook}</span><span class="sub">out of 10</span></dd></div>
    <div><dt>Card variety</dt><dd><span class="big">${t.distinct}</span><span class="sub">1.0 = fully different</span></dd></div>
    <div><dt>Time per topic</dt><dd><span class="big">${t.secs}s</span><span class="sub">angles page wait</span></dd></div>
  </dl></section>`;
};

const typeRows = types.map((ty) => `<tr><th scope="row">${esc(ty.replace(/_/g, " "))}</th>${S.labels.map((l: string) => { const v = T[l].byType[ty] || 0; return `<td><span class="bar bar-${l}" style="width:${Math.round((v / maxType) * 100)}%"></span><span class="num">${v}</span></td>`; }).join("")}</tr>`).join("");

const caseRows = S.cases.map((c: any) => `<tr><th scope="row">${esc(c.topic)}<span class="kind">${esc(c.kind)}${c.runs.current?.niche ? ` · ${esc(c.runs.current.niche)}` : ""}</span></th>${S.labels.map((l: string) => { const r = c.runs[l]; return r ? `<td><span class="num">${r.clean}/${r.n}</span> clean<br><span class="muted">${r.errors} err · hook ${r.hookStrength ?? "–"}</span></td>` : `<td class="muted">no run</td>`; }).join("")}</tr>`).join("");

const detail = S.cases.map((c: any) => `<details class="case"><summary><span>${esc(c.topic)}</span><span class="muted">${S.labels.map((l: string) => c.runs[l] ? `${esc(LABEL[l] || l)} ${c.runs[l].clean}/${c.runs[l].n} clean` : "").join(" · ")}</span></summary>
${S.labels.map((l: string) => { const r = c.runs[l]; if (!r) return ""; return `<div class="run"><h4>${esc(LABEL[l] || l)}</h4>${r.cards.map((g: any) => `<article class="card ${g.clean ? "ok" : "bad"}">
  <header><span class="type">${esc(g.hookType)}</span><span class="pill ${g.clean ? "pill-ok" : "pill-bad"}">${g.clean ? "clean" : `${g.errors.length + g.deterministic.length} issue${g.errors.length + g.deterministic.length === 1 ? "" : "s"}`}</span><span class="muted">hook ${g.hookStrength ?? "–"}/10</span></header>
  <p class="title">${esc(g.title)}</p><p class="hook">${esc(g.hook)}</p>
  ${g.errors.map((e: any) => `<div class="err"><span class="etype">${esc(e.type.replace(/_/g, " "))}</span> <q>${esc(e.cardQuote)}</q>${e.researchQuote ? ` <span class="vs">research:</span> <q class="src">${esc(e.researchQuote)}</q>` : ""}<div class="muted">${esc(e.explanation)}</div></div>`).join("")}
  ${g.deterministic.map((d: string) => `<div class="err"><span class="etype">rule</span> ${esc(d)}</div>`).join("")}
</article>`).join("")}</div>`; }).join("")}</details>`).join("");

const html = `<title>Hook Card Benchmark</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@500;700&family=Atkinson+Hyperlegible:wght@400;700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* Lab report: verdict first, then the per-case table, then every error with its evidence. */
:root { --bg:#f6f7f5; --panel:#ffffff; --fg:#1d2321; --muted:#5f6b67; --line:#d9dfdc; --before:#a8722c; --now:#2f6f8f; --ok:#2e7d4f; --bad:#b4413a; --fix:#5b4a9e;
  --display:"Familjen Grotesk", "Helvetica Neue", Arial, sans-serif; --body:"Atkinson Hyperlegible", "Segoe UI", sans-serif; --mono:"JetBrains Mono", ui-monospace, Menlo, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#121615; --panel:#1a201e; --fg:#e4ebe8; --muted:#97a39f; --line:#2c3532; --before:#d39a52; --now:#6cb3d4; --ok:#5fbf86; --bad:#e2766e; --fix:#a99be0; color-scheme: dark } }
:root[data-theme="dark"] { --bg:#121615; --panel:#1a201e; --fg:#e4ebe8; --muted:#97a39f; --line:#2c3532; --before:#d39a52; --now:#6cb3d4; --ok:#5fbf86; --bad:#e2766e; --fix:#a99be0; color-scheme: dark }
body { background:var(--bg); color:var(--fg); font:15px/1.55 var(--body); }
.wrap { max-width:1080px; margin:0 auto; padding-inline:16px; padding-block:28px 64px; display:grid; gap:28px; }
h1 { font:700 clamp(26px,4vw,38px)/1.1 var(--display); margin:0; text-wrap:balance; }
h2 { font:700 19px var(--display); margin:0 0 10px; } h3 { font:700 16px var(--display); margin:0 0 10px; } h4 { font:700 13px var(--display); text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:14px 0 8px; }
.lede { color:var(--muted); max-width:68ch; margin:6px 0 0; }
.vers { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:16px; }
.ver { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; border-top:4px solid var(--before); }
.ver-current { border-top-color:var(--now); } .ver-payoff { border-top-color:var(--fix); } .bar-payoff { background:var(--fix); }
.kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:12px; margin:0; }
.kpis div { display:grid; gap:2px; } dt { font-size:12px; color:var(--muted); letter-spacing:.03em; } dd { margin:0; display:flex; flex-direction:column; }
.big { font:700 26px var(--display); font-variant-numeric:tabular-nums; } .sub { font-size:12px; color:var(--muted); }
.tbl { overflow-x:auto; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 16px; }
table { border-collapse:collapse; width:100%; min-width:520px; font-variant-numeric:tabular-nums; }
th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; } thead th { font-size:12px; color:var(--muted); font-weight:700; }
tbody th { font-weight:700; } .kind { display:block; font-weight:400; font-size:12px; color:var(--muted); }
td { position:relative; } .bar { display:block; height:8px; border-radius:4px; background:var(--before); margin-bottom:4px; max-width:100%; } .bar-current { background:var(--now); }
.num { font-family:var(--mono); font-weight:600; } .muted { color:var(--muted); font-size:13px; }
details.case { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 16px; }
details.case + details.case { margin-top:10px; }
summary { cursor:pointer; display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; font-weight:700; }
summary:focus-visible { outline:2px solid var(--now); outline-offset:3px; }
.run { display:grid; gap:10px; } .card { border:1px solid var(--line); border-left:4px solid var(--ok); border-radius:8px; padding:10px 12px; min-width:0; }
.card.bad { border-left-color:var(--bad); }
.card header { display:flex; flex-wrap:wrap; gap:8px; align-items:center; } .type { font:600 12px var(--mono); letter-spacing:.04em; }
.pill { font-size:11px; font-weight:700; padding:1px 8px; border-radius:999px; border:1px solid currentColor; } .pill-ok { color:var(--ok); } .pill-bad { color:var(--bad); }
.title { font:700 15px var(--display); margin:6px 0 2px; } .hook { margin:0 0 6px; color:var(--fg); }
.err { font-size:13.5px; padding:6px 0 0; border-top:1px dashed var(--line); margin-top:6px; } .etype { font:600 11px var(--mono); text-transform:uppercase; color:var(--bad); }
q { font-style:italic; } q.src { color:var(--muted); } .vs { font-size:12px; color:var(--muted); }
.legend { display:flex; gap:16px; flex-wrap:wrap; font-size:13px; color:var(--muted); } .sw { display:inline-block; width:12px; height:12px; border-radius:3px; vertical-align:-1px; margin-right:6px; }
@media (prefers-reduced-motion: reduce) { * { transition:none !important; } }
</style>
<div class="wrap">
  <header><h1>Hook Card Benchmark</h1>
  <p class="lede">The same ${S.cases.length} topics, the same frozen research, generated by each version of the angle page. Every card was graded by an independent judge whose every error had to quote the card and the research word for word; unverifiable claims were thrown out. Run ${esc(new Date(S.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))}.</p></header>
  <div class="vers">${S.labels.map(kpi).join("")}</div>
  <section><h3>Errors by type</h3><div class="legend">${S.labels.map((l: string) => `<span><span class="sw" style="background:var(--${COLOR[l] || "now"})"></span>${esc(LABEL[l] || l)}</span>`).join("")}</div>
  <div class="tbl"><table><thead><tr><th>Type</th>${S.labels.map((l: string) => `<th>${esc(LABEL[l] || l)}</th>`).join("")}</tr></thead><tbody>${typeRows}</tbody></table></div></section>
  <section><h3>By topic</h3><div class="tbl"><table><thead><tr><th>Topic</th>${S.labels.map((l: string) => `<th>${esc(LABEL[l] || l)}</th>`).join("")}</tr></thead><tbody>${caseRows}</tbody></table></div></section>
  <section><h3>Every card, with evidence</h3>${detail}</section>
</div>`;
fs.writeFileSync(out, html);
console.log(out);
