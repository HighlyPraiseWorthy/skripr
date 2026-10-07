// PHASE 1 REPORT: which retention timing signals actually separate winning videos from normal ones.
// A signal "graduates" only if (1) winners and normal videos differ in the DISCOVERY set (80%), (2) the
// difference points the same way within the same channels (winner vs that channel's own normal videos), and
// (3) it holds in the HOLDOUT set (20%) the patterns were never fitted on. Everything is reported with sample
// sizes; nothing here changes how scripts are written.
//   npx tsx --env-file=.env.local scripts/phase1-report.ts [--json out.json]
import { writeFileSync } from "fs";
import { supabaseAdmin } from "../src/lib/db/supabase";

const sb = supabaseAdmin!;
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const q = (a: number[], p: number) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; };
const med = (a: number[]) => q(a, 0.5);

type V = { id: string; niche: string; channel: string; ratio: number; holdout: boolean; m: Record<string, number>; opening: string; entry: string };

function metrics(r: any): V | null {
  const tf = r.title_formula || {}; const d = tf.retention; const p = tf.perf;
  if (!d || !p) return null;
  const D = Math.max(60, Number(d.durationSec) || 0);
  const ev: any[] = (d.events || []).filter((e: any) => e.kind !== "sponsor");
  const at = (k: string) => ev.filter((e) => e.kind === k).map((e) => e.t);
  const qOpen = ev.filter((e) => e.kind === "question_open");
  const first = qOpen[0];
  const close = first ? ev.find((e) => e.kind === "question_close" && e.question === first.question && e.t > first.t) : null;
  const rehooks = at("rehook");
  const gaps = (ts: number[]) => ts.slice(1).map((t, i) => t - ts[i]).filter((g) => g >= 0);
  const meaningful = ev.filter((e) => e.newInfo && !["context", "repetition"].includes(e.kind)).map((e) => e.t);
  const majors = ev.filter((e) => e.kind === "major_reveal" && e.t > D * 0.15).map((e) => e.t);
  const firstMajor = majors[0];
  const m: Record<string, number> = {
    first_question_sec: first ? first.t : NaN,
    first_question_pct: first ? (100 * first.t) / D : NaN,
    first_loop_open_sec: first && close ? close.t - first.t : NaN,
    first_loop_open_pct: first && close ? (100 * (close.t - first.t)) / D : NaN,
    first_rehook_pct: rehooks.length ? (100 * rehooks[0]) / D : NaN,
    rehook_gap_sec: med(gaps(rehooks)),
    rehooks_per_10min: (rehooks.length * 600) / D,
    questions_per_10min: (qOpen.length * 600) / D,
    event_gap_sec: med(gaps(meaningful)),
    event_gap_p75_sec: q(gaps(meaningful), 0.75),
    longest_gap_sec: Math.max(0, ...gaps(meaningful)),
    mini_reveals_before_main: firstMajor !== undefined ? ev.filter((e) => e.kind === "mini_reveal" && e.t < firstMajor).length : NaN,
    main_reveal_pct: firstMajor !== undefined ? (100 * firstMajor) / D : NaN,
    repetition_share: ev.length ? (100 * ev.filter((e) => e.kind === "repetition").length) / ev.length : NaN,
    new_info_share: ev.length ? (100 * ev.filter((e) => e.newInfo).length) / ev.length : NaN,
    first_number_sec: Number.isFinite(d.opening?.firstNumberT) ? d.opening.firstNumberT : NaN,
  };
  return { id: r.video_id, niche: r.niche || tf.studyNiche || "?", channel: tf.channelTitle || "?", ratio: Number(p.ratio), holdout: !!tf.holdout, m, opening: d.opening?.type || "?", entry: d.opening?.entry || "?" };
}

// Mann-Whitney U, normal approximation (two-sided p). Small samples are reported, never hidden.
function mwu(a: number[], b: number[]) {
  const A = a.filter(Number.isFinite), B = b.filter(Number.isFinite);
  if (A.length < 5 || B.length < 5) return { p: NaN, n1: A.length, n2: B.length };
  const all = [...A.map((v) => ({ v, g: 0 })), ...B.map((v) => ({ v, g: 1 }))].sort((x, y) => x.v - y.v);
  const ranks = new Array(all.length); for (let i = 0; i < all.length;) { let j = i; while (j < all.length && all[j].v === all[i].v) j++; for (let k = i; k < j; k++) ranks[k] = (i + j + 1) / 2; i = j; }
  const r1 = all.reduce((s, x, i) => s + (x.g === 0 ? ranks[i] : 0), 0);
  const u = r1 - (A.length * (A.length + 1)) / 2, mu = (A.length * B.length) / 2, sd = Math.sqrt((A.length * B.length * (A.length + B.length + 1)) / 12);
  const z = Math.abs((u - mu) / sd); const p = 2 * (1 - 0.5 * (1 + erf(z / Math.SQRT2)));
  return { p: +p.toFixed(3), n1: A.length, n2: B.length };
}
function erf(x: number) { const t = 1 / (1 + 0.3275911 * x); return 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); }

const isWin = (v: V) => v.ratio >= 2, isNormal = (v: V) => v.ratio >= 0.75 && v.ratio <= 1.5;

function analyze(label: string, vids: V[], keys: string[]) {
  const disc = vids.filter((v) => !v.holdout), hold = vids.filter((v) => v.holdout);
  const out: any = { label, videos: vids.length, winners: vids.filter(isWin).length, normal: vids.filter(isNormal).length, signals: [] as any[] };
  for (const k of keys) {
    const W = disc.filter(isWin).map((v) => v.m[k]), N = disc.filter(isNormal).map((v) => v.m[k]);
    const t = mwu(W, N);
    // Same-channel: each channel's winner median minus its own normal median.
    const chans = [...new Set(disc.map((v) => v.channel))];
    const diffs = chans.map((c) => { const w = disc.filter((v) => v.channel === c && isWin(v)).map((v) => v.m[k]); const n = disc.filter((v) => v.channel === c && isNormal(v)).map((v) => v.m[k]); return w.filter(Number.isFinite).length && n.filter(Number.isFinite).length ? med(w) - med(n) : NaN; }).filter(Number.isFinite);
    const dir = Math.sign(med(W) - med(N));
    const sameDir = diffs.length ? Math.round((100 * diffs.filter((x) => Math.sign(x) === dir).length) / diffs.length) : NaN;
    // Bands across all discovery videos (gradient check).
    const sorted = [...disc].filter((v) => Number.isFinite(v.m[k])).sort((a, b) => a.ratio - b.ratio);
    const band = (lo: number, hi: number) => +med(sorted.slice(Math.floor(sorted.length * lo), Math.floor(sorted.length * hi)).map((v) => v.m[k])).toFixed(1);
    const HW = hold.filter(isWin).map((v) => v.m[k]), HN = hold.filter(isNormal).map((v) => v.m[k]);
    const holdDir = Math.sign(med(HW) - med(HN));
    const graduates = Number.isFinite(t.p) && t.p < 0.1 && (sameDir >= 60 || !diffs.length) && HW.filter(Number.isFinite).length >= 3 && HN.filter(Number.isFinite).length >= 3 && holdDir === dir;
    out.signals.push({ signal: k,
      winners: { p25: +q(W, 0.25).toFixed(1), median: +med(W).toFixed(1), p75: +q(W, 0.75).toFixed(1), n: t.n1 },
      normal: { p25: +q(N, 0.25).toFixed(1), median: +med(N).toFixed(1), p75: +q(N, 0.75).toFixed(1), n: t.n2 },
      p: t.p, sameChannelAgreementPct: sameDir, channelsCompared: diffs.length,
      bands: { bottom20: band(0, 0.2), lowMid: band(0.2, 0.5), highMid: band(0.5, 0.8), top20: band(0.8, 1) },
      holdout: { winnersMedian: +med(HW).toFixed(1), normalMedian: +med(HN).toFixed(1), sameDirection: holdDir === dir, n: [HW.filter(Number.isFinite).length, HN.filter(Number.isFinite).length] },
      graduates });
  }
  const openings = (set: V[]) => { const c: Record<string, number> = {}; set.forEach((v) => { c[v.opening] = (c[v.opening] || 0) + 1; }); const n = set.length || 1; return Object.fromEntries(Object.entries(c).map(([k, x]) => [k, Math.round((100 * x) / n)])); };
  out.openings = { winners: openings(vids.filter(isWin)), normal: openings(vids.filter(isNormal)) };
  return out;
}

(async () => {
  const { data } = await sb.from("viral_frameworks").select("video_id, niche, title_formula").not("video_id", "like", "pat:%").not("video_id", "like", "fam:%").limit(5000);
  const vids = (data || []).map(metrics).filter(Boolean) as V[];
  const keys = Object.keys(vids[0]?.m || {});
  const groups: [string, V[]][] = [["ALL NICHES", vids], ...["true-crime", "business", "personal-finance", "science"].map((n) => [n, vids.filter((v) => v.niche === n)] as [string, V[]])];
  const report = groups.map(([l, v]) => analyze(l, v, keys));
  for (const g of report) {
    console.log(`\n===== ${g.label}: ${g.videos} videos (${g.winners} winners >=2x expected, ${g.normal} normal 0.75-1.5x)`);
    console.log(`openings, winners: ${JSON.stringify(g.openings.winners)}\nopenings, normal:  ${JSON.stringify(g.openings.normal)}`);
    for (const s of g.signals) console.log(`${s.graduates ? "GRADUATES" : "         "} ${s.signal.padEnd(26)} winners ${s.winners.median} [${s.winners.p25}-${s.winners.p75}] n${s.winners.n} | normal ${s.normal.median} [${s.normal.p25}-${s.normal.p75}] n${s.normal.n} | p=${s.p} | same-channel ${s.sameChannelAgreementPct}% of ${s.channelsCompared} | bands ${s.bands.bottom20}/${s.bands.lowMid}/${s.bands.highMid}/${s.bands.top20} | holdout ${s.holdout.winnersMedian} vs ${s.holdout.normalMedian} ${s.holdout.sameDirection ? "same" : "FLIPS"} n${s.holdout.n.join("/")}`);
  }
  const out = arg("json"); if (out) writeFileSync(out, JSON.stringify(report, null, 1));
})();
