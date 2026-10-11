// One-off backfill (2026-10-11, user-approved): voices analyzed before the fingerprint fix have no stored
// voice_fingerprint. Re-fetch each channel's top-3 long-form transcripts exactly as the analysis does, measure the
// fingerprint on all of it, and update ONLY voice_fingerprint (style guide, name, active state untouched).
//   npx tsx --env-file=.env.local scripts/backfill-voice-fingerprints.ts [--dry]
import { supabaseAdmin } from "../src/lib/db/supabase";
import { fetchChannelLongform } from "../src/lib/youtube-channel";
import { getTranscriptRobust } from "../src/lib/youtube-transcript";
import { measureVoiceFromSamples } from "../src/lib/voice-metrics";

const dry = process.argv.includes("--dry");
(async () => {
  // --names "A,B": re-measure these profiles even if they already have a stored fingerprint.
  const ni = process.argv.indexOf("--names"); const names = ni >= 0 ? process.argv[ni + 1].split(",") : null;
  const q = supabaseAdmin!.from("voice_profiles").select("id, name, source_ref, voice_fingerprint");
  const { data, error } = names ? await q.in("name", names) : await q.is("voice_fingerprint", null);
  if (error) throw error;
  for (const p of data || []) {
    if (!p.source_ref) { console.log(`- ${p.name}: no channel stored, skipped`); continue; }
    try {
      const scan = await fetchChannelLongform(p.source_ref);
      const top = [...scan.videos].sort((a, b) => b.views - a.views).slice(0, 3);
      const ts: string[] = [];
      for (const v of top) { try { const t = await getTranscriptRobust(v.videoId); if (t?.trim()) ts.push(t.slice(0, 9000)); } catch {} }
      const fp = measureVoiceFromSamples(ts);
      if (!fp) { console.log(`- ${p.name}: no measurable (punctuated) transcript, fingerprint cleared`); if (!dry) await supabaseAdmin!.from("voice_profiles").update({ voice_fingerprint: null }).eq("id", p.id); continue; }
      if (!dry) { const { error: e } = await supabaseAdmin!.from("voice_profiles").update({ voice_fingerprint: fp }).eq("id", p.id); if (e) throw e; }
      console.log(`- ${p.name}: ${dry ? "would store" : "stored"} ${JSON.stringify(fp)}`);
    } catch (e: any) { console.log(`- ${p.name}: FAILED ${e?.message || e}`); }
  }
})();
