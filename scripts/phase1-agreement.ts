// Agreement test for observable events: a stratified sample of videos, analyzed twice independently by the
// stronger model (Sonnet A vs Sonnet B), plus the cheap model (Haiku) vs Sonnet A. Agreement is reported PER
// EVENT TYPE: (1) does the FIRST occurrence land within 10 seconds, and (2) event-level F1 with a +-2 line
// tolerance. Only high-agreement event types should feed any later analysis.
import { writeFileSync } from "fs";
import { supabaseAdmin } from "../src/lib/db/supabase";
import { getTimedLines, analyzeEventsV1, V1_KINDS, EVENT_SCHEMA_VERSION, type ObservableEvent } from "../src/lib/retention-dna";
import { readFileSync, existsSync } from "fs";

const pickSample = (rows: any[]) => {
  const nicheOf = (r: any) => r.niche || r.title_formula?.studyNiche || "?";
  const bucket = (r: any) => { const n = nicheOf(r); return n === "true-crime" ? "tc" : ["business", "personal-finance"].includes(n) ? "money" : n === "science" ? "sci" : "other"; };
  const win = (r: any) => r.title_formula?.perf?.ratio >= 2;
  const out: any[] = [];
  for (const b of ["tc", "money", "sci", "other"]) {
    const pool = rows.filter((r) => bucket(r) === b).sort(() => Math.random() - 0.5);
    const w = pool.filter(win).slice(0, 2), n = pool.filter((r) => !win(r)).slice(0, b === "other" ? 2 : 1);
    out.push(...w, ...n);
  }
  return out.slice(0, 14);
};
function compare(a: ObservableEvent[], b: ObservableEvent[], kind: string) {
  const A = a.filter((e) => e.kind === kind), B = b.filter((e) => e.kind === kind);
  const firstA = A[0]?.t, firstB = B[0]?.t;
  const firstAgree = firstA === undefined && firstB === undefined ? null : firstA !== undefined && firstB !== undefined && Math.abs(firstA - firstB) <= 10;
  const used = new Set<number>(); let tp = 0;
  for (const e of A) { const k = B.findIndex((f, i) => !used.has(i) && Math.abs(f.line - e.line) <= 2); if (k >= 0) { used.add(k); tp++; } }
  const f1 = A.length + B.length ? (2 * tp) / (A.length + B.length) : null;
  return { firstAgree, f1, nA: A.length, nB: B.length };
}
(async () => {
  const { data } = await supabaseAdmin!.from("viral_frameworks").select("video_id, video_title, niche, title_formula").not("video_id", "like", "pat:%").not("video_id", "like", "fam:%").limit(5000);
  // Same 13 videos as the first test (frozen), so the re-run is a true repeat with chunking.
  const prev = existsSync("scripts/benchmark/results/phase1-agreement.json") ? JSON.parse(readFileSync("scripts/benchmark/results/phase1-agreement.json", "utf8")).sample as string[] : null;
  const eligible = (data || []).filter((r: any) => r.title_formula?.retention && r.title_formula?.perf);
  const sample = prev ? prev.map((id) => eligible.find((r: any) => r.video_id === id)).filter(Boolean) : pickSample(eligible);
  console.log(`sample: ${sample.length} videos`);
  const results: Record<string, { sonnetSelf: any[]; haikuVsSonnet: any[] }> = {};
  for (const k of V1_KINDS) results[k] = { sonnetSelf: [], haikuVsSonnet: [] };
  console.log(`schema: ${EVENT_SCHEMA_VERSION}`);
  for (const r of sample) {
    const lines = await getTimedLines(r.video_id);
    const title = r.video_title || r.title_formula.title || "";
    const [ra, rb] = await Promise.all([
      analyzeEventsV1({ title, lines, model: "claude-sonnet-4-6", temperature: 1 }),
      analyzeEventsV1({ title, lines, model: "claude-sonnet-4-6", temperature: 1 }),
    ]);
    const sa = ra?.events || null, sb2 = rb?.events || null, h: ObservableEvent[] | null = null;
    console.log(`${r.video_id} ${r.niche || r.title_formula.studyNiche} x${r.title_formula.perf.ratio}: run A ${sa?.length ?? "fail"} events (${ra?.failedChunks ?? "?"}/${ra?.chunks ?? "?"} chunks failed), run B ${sb2?.length ?? "fail"} (${rb?.failedChunks ?? "?"}/${rb?.chunks ?? "?"} failed)`);
    if (!sa || !sb2) continue;
    for (const k of V1_KINDS) results[k].sonnetSelf.push(compare(sa, sb2, k));
  }
  const summarize = (xs: any[]) => { const first = xs.filter((x) => x.firstAgree !== null); const f1s = xs.map((x) => x.f1).filter((v) => v !== null); return { firstWithin10s: first.length ? Math.round((100 * first.filter((x) => x.firstAgree).length) / first.length) : null, eventF1: f1s.length ? Math.round((100 * f1s.reduce((a, b) => a + b, 0)) / f1s.length) : null, videos: xs.length }; };
  const table = V1_KINDS.map((k) => ({ kind: k, sonnetSelf: summarize(results[k].sonnetSelf), haikuVsSonnet: summarize(results[k].haikuVsSonnet) }));
  console.log("\nEVENT TYPE              | RUN A vs RUN B: first within 10s, event F1, videos compared");
  for (const t of table) console.log(`${t.kind.padEnd(23)} | ${String(t.sonnetSelf.firstWithin10s).padStart(4)}%  ${String(t.sonnetSelf.eventF1).padStart(4)}%  n=${t.sonnetSelf.videos}`);
  writeFileSync("scripts/benchmark/results/phase1-agreement-v1.json", JSON.stringify({ schema: EVENT_SCHEMA_VERSION, sample: sample.map((r: any) => r.video_id), table }, null, 1));
})();
