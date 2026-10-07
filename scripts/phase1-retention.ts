// PHASE 1 of the timing guide (2026-10-07). Data only: no script behavior changes.
//  1. Age-adjusted performance for every saved outlier video, with Outlier Finder's own formula
//     (expected views = the channel's median views per day across its recent long-form uploads x the video's age).
//  2. Same-channel baseline: up to 3 NORMAL videos per channel (0.75-1.5x expected), stored with niche and title
//     NULL (study fields live in title_formula), so no existing reader (title pool, hook examples, pool stats)
//     ever treats them as winners.
//  3. Retention DNA (timed information events) for every video: title_formula.retention.
//  4. Holdout: a fixed 20% of videos (hash of the id) is never used to discover patterns, only to check them.
// Resumable: rows that already have retention are skipped.
//   npx tsx --env-file=.env.local scripts/phase1-retention.ts [--stage perf|normals|analyze|all] [--limit N]
import { supabaseAdmin } from "../src/lib/db/supabase";
import { getTimedLines, analyzeRetention } from "../src/lib/retention-dna";

const arg = (k: string, d = "") => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const stage = arg("stage", "all");
const limit = Number(arg("limit", "100000"));
const KEY = process.env.YOUTUBE_API_KEY;
const YT = "https://www.googleapis.com/youtube/v3";
const sb = supabaseAdmin!;
const dur = (iso: string) => { const m = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0; };
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
export const isHoldout = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 5 === 0; };

type Meta = { id: string; title: string; channelId: string; channelTitle: string; views: number; ageDays: number; durationSec: number };
async function videoMeta(ids: string[]): Promise<Map<string, Meta>> {
  const out = new Map<string, Meta>();
  for (let k = 0; k < ids.length; k += 50) {
    const r: any = await fetch(`${YT}/videos?part=snippet,statistics,contentDetails&id=${ids.slice(k, k + 50).join(",")}&key=${KEY}`).then((x) => x.json());
    for (const v of r?.items || []) out.set(v.id, { id: v.id, title: v.snippet?.title || "", channelId: v.snippet?.channelId, channelTitle: v.snippet?.channelTitle, views: Number(v.statistics?.viewCount || 0),
      ageDays: Math.max(1, (Date.now() - new Date(v.snippet?.publishedAt).getTime()) / 864e5), durationSec: dur(v.contentDetails?.duration) });
  }
  return out;
}
const paceCache = new Map<string, { medianVpd: number; uploads: Meta[] }>();
async function channelPace(channelId: string) {
  if (paceCache.has(channelId)) return paceCache.get(channelId)!;
  const ch: any = await fetch(`${YT}/channels?part=contentDetails&id=${channelId}&key=${KEY}`).then((x) => x.json());
  const up = ch?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  const pl: any = up ? await fetch(`${YT}/playlistItems?part=contentDetails&playlistId=${up}&maxResults=50&key=${KEY}`).then((x) => x.json()) : null;
  const ids = (pl?.items || []).map((i: any) => i.contentDetails?.videoId).filter(Boolean);
  const uploads = [...(await videoMeta(ids)).values()].filter((v) => v.durationSec >= 180 && v.views > 0);
  const res = { medianVpd: median(uploads.map((v) => v.views / v.ageDays)) || 1, uploads };
  paceCache.set(channelId, res);
  return res;
}
const perfOf = (m: Meta, medianVpd: number) => { const expected = Math.max(1, Math.round(medianVpd * m.ageDays)); return { expectedViews: expected, ratio: +(m.views / expected).toFixed(2), views: m.views, ageDays: Math.round(m.ageDays), durationSec: m.durationSec, measuredAt: new Date().toISOString() }; };

async function allRows() {
  const { data } = await sb.from("viral_frameworks").select("video_id, video_title, niche, title_formula").not("video_id", "like", "pat:%").not("video_id", "like", "fam:%").limit(5000);
  return (data || []).filter((r: any) => /^[A-Za-z0-9_-]{11}$/.test(r.video_id));
}

async function stagePerf() {
  const rows = (await allRows()).filter((r: any) => !r.title_formula?.perf);
  const meta = await videoMeta(rows.map((r: any) => r.video_id));
  let n = 0;
  for (const r of rows) {
    const m = meta.get(r.video_id); if (!m?.channelId) continue;
    const pace = await channelPace(m.channelId);
    const tf = { ...(r.title_formula || {}), channelId: m.channelId, channelTitle: m.channelTitle, perf: perfOf(m, pace.medianVpd), holdout: isHoldout(r.video_id) };
    await sb.from("viral_frameworks").update({ title_formula: tf }).eq("video_id", r.video_id); n++;
  }
  console.log(`[perf] updated ${n} of ${rows.length}`);
}

async function stageNormals() {
  const rows = await allRows();
  const have = new Set(rows.map((r: any) => r.video_id));
  const byChannel = new Map<string, { niche: string; title: string }>();
  for (const r of rows) { const c = r.title_formula?.channelId; if (c && r.niche && !byChannel.has(c)) byChannel.set(c, { niche: r.niche, title: r.title_formula?.channelTitle || "" }); }
  const already = new Map<string, number>();
  for (const r of rows) if (r.title_formula?.normalSample) already.set(r.title_formula.channelId, (already.get(r.title_formula.channelId) || 0) + 1);
  let added = 0;
  for (const [channelId, info] of byChannel) {
    const need = 3 - (already.get(channelId) || 0); if (need <= 0) continue;
    const pace = await channelPace(channelId);
    const normals = pace.uploads.filter((v) => !have.has(v.id) && v.durationSec >= 360 && v.ageDays >= 14)
      .map((v) => ({ v, p: perfOf(v, pace.medianVpd) })).filter((x) => x.p.ratio >= 0.75 && x.p.ratio <= 1.5)
      .sort((a, b) => Math.abs(1 - a.p.ratio) - Math.abs(1 - b.p.ratio)).slice(0, need);
    for (const { v, p } of normals) {
      await sb.from("viral_frameworks").upsert({ video_id: v.id, video_title: null, niche: null, source_views: null,
        title_formula: { title: v.title, channelId, channelTitle: info.title, studyNiche: info.niche, normalSample: true, perf: p, holdout: isHoldout(v.id) } }, { onConflict: "video_id", ignoreDuplicates: true });
      added++;
    }
  }
  console.log(`[normals] added ${added} normal videos across ${byChannel.size} channels`);
}

async function stageAnalyze() {
  const rows = (await allRows()).filter((r: any) => r.title_formula?.perf && !r.title_formula?.retention).slice(0, limit);
  console.log(`[analyze] ${rows.length} videos`);
  let ok = 0, noT = 0, fail = 0;
  const queue = [...rows.entries()];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [i, r] = next;
      try {
        const lines = await getTimedLines(r.video_id);
        if (lines.length < 20) { noT++; console.log(`[${i + 1}/${rows.length}] no timed transcript ${r.video_id}`); continue; }
        const dna = await analyzeRetention({ title: r.video_title || r.title_formula?.title || "", lines, durationSec: r.title_formula?.perf?.durationSec });
        if (!dna) { fail++; console.log(`[${i + 1}/${rows.length}] failed ${r.video_id}`); continue; }
        await sb.from("viral_frameworks").update({ title_formula: { ...(r.title_formula || {}), retention: dna } }).eq("video_id", r.video_id);
        ok++; console.log(`[${i + 1}/${rows.length}] ok ${r.niche || r.title_formula?.studyNiche} x${r.title_formula.perf.ratio} ${dna.events.length} events, opening ${dna.opening.type}`);
      } catch (e: any) { fail++; console.log(`[${i + 1}/${rows.length}] error ${r.video_id}: ${e?.message || e}`); }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  console.log(`DONE ok=${ok} noTranscript=${noT} failed=${fail}`);
}

(async () => {
  if (!sb || !KEY) throw new Error("needs supabase + YOUTUBE_API_KEY");
  if (stage === "perf" || stage === "all") await stagePerf();
  if (stage === "normals" || stage === "all") { await stageNormals(); await stagePerf(); }
  if (stage === "analyze" || stage === "all") await stageAnalyze();
})();
