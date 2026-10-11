// One-off backfill (2026-10-11, Voice Match step 2): add the structured voice profile to existing voices. Re-fetches
// each channel's top-3 long-form transcripts (as the analysis does), extracts + verifies the structure, and MERGES it
// into voice_fingerprint under "structure" (fingerprint numbers, style guide, name, active state untouched).
//   npx tsx --env-file=.env.local scripts/backfill-voice-structure.ts [--dry]
import { supabaseAdmin } from "../src/lib/db/supabase";
import { fetchChannelLongform } from "../src/lib/youtube-channel";
import { getTranscriptRobust } from "../src/lib/youtube-transcript";
import { extractVoiceStructure, renderVoiceStructure } from "../src/lib/voice-structure";

const dry = process.argv.includes("--dry");
(async () => {
  const { data, error } = await supabaseAdmin!.from("voice_profiles").select("id, name, source_ref, voice_fingerprint");
  if (error) throw error;
  for (const p of data || []) {
    if (!p.source_ref) { console.log(`- ${p.name}: no channel stored, skipped`); continue; }
    try {
      const scan = await fetchChannelLongform(p.source_ref);
      const top = [...scan.videos].sort((a, b) => b.views - a.views).slice(0, 3);
      const ts: string[] = [];
      for (const v of top) { try { const t = await getTranscriptRobust(v.videoId); if (t?.trim()) ts.push(t.slice(0, 9000)); } catch {} }
      const structure = await extractVoiceStructure(ts.join("\n\n---\n\n"));
      if (!structure) { console.log(`- ${p.name}: samples too thin, skipped`); continue; }
      const merged = { ...((p.voice_fingerprint as any) || { words: 0 }), structure };
      if (!dry) { const { error: e } = await supabaseAdmin!.from("voice_profiles").update({ voice_fingerprint: merged }).eq("id", p.id); if (e) throw e; }
      console.log(`\n- ${p.name}: ${dry ? "would store" : "stored"} (signature ${structure.signature.length}, avoided ${structure.avoided.length}, openers ${structure.openers.length}, cta ${structure.cta.placement})\n${renderVoiceStructure(structure).split("\n").slice(1, 4).join("\n")}`);
    } catch (e: any) { console.log(`- ${p.name}: FAILED ${e?.message || e}`); }
  }
})();
