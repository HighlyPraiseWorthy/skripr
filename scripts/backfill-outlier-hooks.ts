// Backfill the real opening hooks of outlier videos that were banked title-only (Outlier Finder saved
// titles, but its hook capture skipped every video because the title row already existed). For each
// title-only row: fetch the transcript (direct YouTube first, which works from a home IP and costs no
// Supadata quota, then Supadata), then run the shared framework capture (Haiku) to write hook_text,
// structure and retention triggers. The outlier-scan niche is kept, since it's more reliable than a guess.
//   npx tsx --env-file=.env.local scripts/backfill-outlier-hooks.ts [--limit 600] [--dry]
import { supabaseAdmin } from "../src/lib/db/supabase";
import { getTranscript, getTranscriptRobust } from "../src/lib/youtube-transcript";
import { captureFrameworkInBackground } from "../src/lib/framework-capture";

const arg = (k: string, d = "") => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const limit = Number(arg("limit", "600"));
const dry = process.argv.includes("--dry");

(async () => {
  if (!supabaseAdmin) throw new Error("no supabase");
  const { data, error } = await supabaseAdmin.from("viral_frameworks")
    .select("video_id, video_title, niche, source_views, hook_text")
    .is("hook_text", null).not("video_id", "like", "pat:%").order("source_views", { ascending: false }).limit(limit);
  if (error) throw error;
  const rows = (data || []).filter((r: any) => /^[A-Za-z0-9_-]{11}$/.test(r.video_id));
  const byNiche: Record<string, number> = {};
  for (const r of rows) byNiche[r.niche || "?"] = (byNiche[r.niche || "?"] || 0) + 1;
  console.log(`title-only outlier rows: ${rows.length}`, byNiche);
  if (dry) return;
  let ok = 0, noT = 0, fail = 0;
  for (const [i, r] of rows.entries()) {
    let t = await getTranscript(r.video_id).catch(() => "");
    if (t.trim().length < 200) t = await getTranscriptRobust(r.video_id).catch(() => "");
    if (t.trim().length < 200) { noT++; console.log(`[${i + 1}/${rows.length}] no transcript ${r.video_id}`); continue; }
    await captureFrameworkInBackground({ videoId: r.video_id, transcript: t, title: r.video_title, views: r.source_views });
    const { data: after } = await supabaseAdmin.from("viral_frameworks").select("hook_text, niche").eq("video_id", r.video_id).maybeSingle();
    if (after?.hook_text) {
      ok++;
      if (r.niche && after.niche !== r.niche) await supabaseAdmin.from("viral_frameworks").update({ niche: r.niche }).eq("video_id", r.video_id);
      console.log(`[${i + 1}/${rows.length}] ok ${r.niche} "${String(after.hook_text).slice(0, 90)}"`);
    } else { fail++; console.log(`[${i + 1}/${rows.length}] capture failed ${r.video_id}`); }
  }
  console.log(`DONE banked=${ok} noTranscript=${noT} failed=${fail}`);
})();
