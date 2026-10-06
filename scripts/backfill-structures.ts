// STRUCTURE BACKFILL (2026-10-06). Re-analyzes every saved outlier video with its FULL transcript (the first
// capture read only 7,000 characters, so structures stopped about a third in), and records how far each video
// beat its own channel's usual views (outlierX = views / median views of the channel's recent long-form
// uploads) plus the channel, so structure families rank by "beat its channel", not raw views.
// Resumable: a row whose title_formula already has "shape" was done by this pass and is skipped.
//   npx tsx --env-file=.env.local scripts/backfill-structures.ts [--limit 500] [--dry]
import { supabaseAdmin } from "../src/lib/db/supabase";
import { getTranscript, getTranscriptRobust } from "../src/lib/youtube-transcript";
import { captureFrameworkInBackground } from "../src/lib/framework-capture";

const arg = (k: string, d = "") => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const limit = Number(arg("limit", "600"));
const dry = process.argv.includes("--dry");
const KEY = process.env.YOUTUBE_API_KEY;
const YT = "https://www.googleapis.com/youtube/v3";
const dur = (iso: string) => { const m = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : 0; };
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

async function videoMeta(ids: string[]) {
  const out = new Map<string, { channelId: string; channelTitle: string; views: number; durationSec: number }>();
  for (let k = 0; k < ids.length; k += 50) {
    const r = await fetch(`${YT}/videos?part=snippet,statistics,contentDetails&id=${ids.slice(k, k + 50).join(",")}&key=${KEY}`).then((x) => x.json());
    for (const v of r?.items || []) out.set(v.id, { channelId: v.snippet?.channelId, channelTitle: v.snippet?.channelTitle, views: Number(v.statistics?.viewCount || 0), durationSec: dur(v.contentDetails?.duration) });
  }
  return out;
}
const medianCache = new Map<string, number>();
async function channelMedian(channelId: string): Promise<number> {
  if (medianCache.has(channelId)) return medianCache.get(channelId)!;
  try {
    const ch = await fetch(`${YT}/channels?part=contentDetails&id=${channelId}&key=${KEY}`).then((x) => x.json());
    const up = ch?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    const pl = await fetch(`${YT}/playlistItems?part=contentDetails&playlistId=${up}&maxResults=50&key=${KEY}`).then((x) => x.json());
    const ids = (pl?.items || []).map((i: any) => i.contentDetails?.videoId).filter(Boolean);
    const meta = await videoMeta(ids);
    const m = median([...meta.values()].filter((v) => v.durationSec >= 180 && v.views > 0).map((v) => v.views));
    medianCache.set(channelId, m);
    return m;
  } catch { medianCache.set(channelId, 0); return 0; }
}

(async () => {
  if (!supabaseAdmin || !KEY) throw new Error("needs supabase + YOUTUBE_API_KEY");
  const { data, error } = await supabaseAdmin.from("viral_frameworks").select("video_id, video_title, niche, title_formula").not("video_id", "like", "pat:%").limit(2000);
  if (error) throw error;
  const rows = (data || []).filter((r: any) => /^[A-Za-z0-9_-]{11}$/.test(r.video_id) && !(r.title_formula && r.title_formula.shape)).slice(0, limit);
  console.log(`to analyze: ${rows.length}`);
  if (dry) return;
  const meta = await videoMeta(rows.map((r: any) => r.video_id));
  let ok = 0, noT = 0, fail = 0;
  // Three at a time (one at a time is 3+ hours); each worker takes the next row.
  const queue = rows.map((r: any, i: number) => [i, r] as const);
  const worker = async () => { for (let next = queue.shift(); next; next = queue.shift()) { const [i, r] = next; await one(i, r); } };
  const one = async (i: number, r: any) => {
    const m = meta.get(r.video_id);
    const med = m?.channelId ? await channelMedian(m.channelId) : 0;
    const outlierX = m && med ? +(m.views / med).toFixed(2) : null;
    let t = await getTranscript(r.video_id).catch(() => "");
    if (t.trim().length < 200) t = await getTranscriptRobust(r.video_id).catch(() => "");
    if (t.trim().length < 200) { noT++; console.log(`[${i + 1}/${rows.length}] no transcript ${r.video_id}`); return; }
    await captureFrameworkInBackground({ videoId: r.video_id, transcript: t, title: r.video_title, views: m?.views ?? null, niche: r.niche, outlierX, channelId: m?.channelId ?? null, channelTitle: m?.channelTitle ?? null, durationMin: m ? Math.round(m.durationSec / 60) : null, force: true });
    const { data: after } = await supabaseAdmin!.from("viral_frameworks").select("title_formula, structure").eq("video_id", r.video_id).maybeSingle();
    const tf: any = after?.title_formula;
    if (tf?.shape) { ok++; console.log(`[${i + 1}/${rows.length}] ok ${r.niche} x${outlierX ?? "?"} ${m?.channelTitle || ""} | ${tf.shape} | ${(after?.structure || []).length} parts, ${(tf.techniques || []).length} techniques`); }
    else { fail++; console.log(`[${i + 1}/${rows.length}] failed ${r.video_id}`); }
  };
  await Promise.all([worker(), worker(), worker()]);
  console.log(`DONE ok=${ok} noTranscript=${noT} failed=${fail}`);
})();
