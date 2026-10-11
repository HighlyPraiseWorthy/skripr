// VOICE RULES v2 DRY RUN (criteria 1-4 of the Nov 1 test). Builds v2 voice rules + fingerprint for every saved voice
// from its top-5 cached transcripts and writes a report. Writes NOTHING to voice_profiles. --learn also banks the
// videos in the framework library (off by default: that library is live data).
//   npx tsx --env-file=.env.local scripts/voice-v2/dryrun.ts [--learn]
import { writeFileSync } from "fs";
import { loadVoices, cachedVideos, writeCache, samplesOf } from "./cache";
import { extractVoiceStructure, renderVoiceStructure } from "../../src/lib/voice-structure";
import { measureVoiceFromSamples } from "../../src/lib/voice-metrics";
import { captureFrameworkInBackground } from "../../src/lib/framework-capture";

const learn = process.argv.includes("--learn");
(async () => {
  const voices = await loadVoices();
  const lines = ["# Voice rules v2 dry run", "", `Run ${new Date().toISOString()}. Nothing was written to the voices.`, ""];
  let withSignature = 0;
  for (const p of voices) {
    if (!p.source_ref) { lines.push(`## ${p.name}\n\nNo channel stored; skipped.\n`); continue; }
    const c = await cachedVideos(p as any);
    const rules = await extractVoiceStructure(samplesOf(c), { titles: c.videos.map((v) => v.title) });
    const fp = measureVoiceFromSamples(c.videos.map((v) => v.transcript.slice(0, 9000)));
    writeCache({ ...c, v2Rules: rules, v2Fingerprint: fp });
    if (learn) await Promise.allSettled(c.videos.map((v) => captureFrameworkInBackground({ videoId: v.videoId, transcript: v.transcript, title: v.title, views: v.views })));
    const sig = rules?.signature || [];
    if (sig.length) withSignature++;
    // Automatic flags for the human review (criteria 2-4).
    const flags: string[] = [];
    sig.forEach((s) => { if (/(?<!^)\b[A-Z][a-z]+/.test(s.phrase)) flags.push(`signature "${s.phrase}" contains a capitalized word: name or topic?`); });
    if (rules?.cta?.example && /\.(com|net|org|io|co|tv)\b|https?:|\bcode\b|% off|sponsor/i.test(rules.cta.example)) flags.push("CTA example looks like sponsor copy");
    if ((rules?.neverDoes || []).length > 3) flags.push("more than 3 never-does");
    lines.push(`## ${p.name} (account ${String(p.user_id).slice(-6)})`, "",
      `Videos: ${c.videos.length} (${c.videos.map((v) => `"${v.title}"`).join("; ")})`, "",
      "```", renderVoiceStructure(rules), "```", "",
      `Signature phrases: ${sig.length ? sig.map((s) => `"${s.phrase}" (${s.count}x)`).join(", ") : "none"}`, "",
      `Flags: ${flags.length ? flags.join("; ") : "none"}`, "");
    console.log(`- ${p.name}: ${c.videos.length} videos, ${sig.length} signature phrase(s), ${flags.length} flag(s)`);
  }
  lines.splice(4, 0, `**Criterion 1:** ${withSignature} of ${voices.length} voices got at least one signature phrase (target: 3+).`, "");
  writeFileSync(".scratch/voice-rules-v2-report.md", lines.join("\n"));
  console.log("Report: .scratch/voice-rules-v2-report.md");
})();
