// VOICE RULES v2 REBUILD (run once, after v2 is promoted and Supadata credits are confirmed). For each saved voice:
// replace ONLY its voice rules with the v2 rules built from the cached top-5 transcripts (reusing the dry run's,
// so Supadata is not paid twice), re-apply the creator's adjustments on top, and leave the measured fingerprint
// and style guide untouched. Also banks the videos in the framework library (learning loop; skips already-banked).
//   npx tsx --env-file=.env.local scripts/voice-v2/rebuild.ts [--dry] [--no-learn]
import { supabaseAdmin } from "../../src/lib/db/supabase";
import { loadVoices, cachedVideos, samplesOf } from "./cache";
import { extractVoiceStructure } from "../../src/lib/voice-structure";
import { baseOf, composeVoiceJson } from "../../src/lib/voice-tweak";
import { captureFrameworkInBackground } from "../../src/lib/framework-capture";

const dry = process.argv.includes("--dry"); const learn = !process.argv.includes("--no-learn");
(async () => {
  for (const p of await loadVoices()) {
    if (!p.source_ref) { console.log(`- ${p.name}: no channel stored, skipped`); continue; }
    const c = await cachedVideos(p as any);
    const rules = c.v2Rules ?? await extractVoiceStructure(samplesOf(c), { titles: c.videos.map((v) => v.title) });
    if (!rules) { console.log(`- ${p.name}: no usable transcripts, left unchanged`); continue; }
    const current = (p.voice_fingerprint || {}) as any;
    const base = baseOf(current);
    const json = composeVoiceJson({ fp: base.fp, structure: rules }, current.tweakOps || []).json;
    if (!dry) { const { error } = await supabaseAdmin!.from("voice_profiles").update({ voice_fingerprint: json }).eq("id", p.id); if (error) throw error; }
    if (learn && !dry) await Promise.allSettled(c.videos.map((v) => captureFrameworkInBackground({ videoId: v.videoId, transcript: v.transcript, title: v.title, views: v.views })));
    console.log(`- ${p.name}: ${dry ? "would update" : "updated"} (${rules.signature.length} signature phrase(s), ${(current.tweakOps || []).length} adjustment(s) re-applied, ${c.videos.length} videos${learn && !dry ? " banked for learning" : ""})`);
  }
})();
