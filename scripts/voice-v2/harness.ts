// CRITERION 6 HARNESS (Nov 1 test). Generates one script with an EXISTING voice using that voice's v2 rules from the
// dry-run cache, held IN MEMORY (the preview app would read the voice's live v1 rules from the database), then runs
// the final voice check exactly as the app does, and saves the script plus its rhythm match before/after and every
// voice-check edit for review. Writes nothing to the database. Run the dry run first.
//   npx tsx --env-file=.env.local scripts/voice-v2/harness.ts --voice "FERN" [--case jones]
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { loadVoices, readCache } from "./cache";
import { renderVoiceStructure } from "../../src/lib/voice-structure";
import { buildTopicBlueprint, generateHookFirst, writeSection, assembleFinalizeScript, reconcileTitle } from "../../src/lib/ai/claude";
import { finalCheck } from "../../src/lib/ai/final-check";
import { finalVoiceCheck } from "../../src/lib/voice-check";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
(async () => {
  const voiceName = arg("voice", "FERN"); const caseId = arg("case", "jones");
  const p = (await loadVoices()).find((v: any) => v.name === voiceName && readCache(v.id)?.v2Rules);
  if (!p) throw new Error(`No voice "${voiceName}" with cached v2 rules: run scripts/voice-v2/dryrun.ts first`);
  const cache = readCache(p.id)!;
  const rules = cache.v2Rules; const fingerprint = (p.voice_fingerprint as any)?.words >= 300 ? p.voice_fingerprint : cache.v2Fingerprint;
  const styleGuide = `${p.style_guide}\n\n${renderVoiceStructure(rules)}`; // what toVoiceMeta would build with v2 rules
  const c = JSON.parse(readFileSync("scripts/benchmark/cases.json", "utf8")).find((x: any) => x.id === caseId);
  const facts = JSON.parse(readFileSync(`scripts/benchmark/fixtures/${caseId}.json`, "utf8"));
  const sourceMaterial = facts.map((f: any) => (f.source ? `${f.fact} (source: ${f.source})` : f.fact)).join("\n");
  const plan = await buildTopicBlueprint(sourceMaterial, Math.round(c.minutes * 165), c.minutes, c.angle, { hookType: c.hookType, storytelling: "story" });
  const title = reconcileTitle(c.title, sourceMaterial);
  const presetHook = await generateHookFirst({ title, topic: c.topic, hookType: c.hookType, anglePremise: c.angle, sourceMaterial, voiceProfile: styleGuide } as any);
  const sections: { title: string; content: string }[] = [];
  for (let i = 0; i < plan.length; i++) {
    const text = await writeSection(plan[i], i, plan.length, { topic: c.topic, title, sourceMaterial, voice: styleGuide, previousTail: sections.length ? sections[sections.length - 1].content.split(/\s+/).slice(-40).join(" ") : "",
      alreadyTold: sections.map((s) => s.content).join("\n\n"), reservedFacts: plan.slice(i + 1).flatMap((x: any) => x.assignedFacts || []), otherPoints: plan.filter((_: any, k: number) => k !== i).map((x: any) => x.point || "").filter(Boolean) } as any);
    sections.push({ title: plan[i].name, content: text });
  }
  const input: any = { sourceTranscript: "", targetTopic: c.topic, targetNiche: "general", sourceTitle: c.topic, sourceNiche: "general", videoLength: "long", targetMinutes: c.minutes, tone: "entertaining", ttsOptimized: false,
    angle: c.angle, sectionPlan: plan, hookArchetype: c.hookType, topicKind: c.kind, storytellingMode: "story", sourceMaterial, selectedTitle: title, noCta: true, routeStartedAt: Date.now(),
    voiceProfile: styleGuide, voiceFingerprint: fingerprint, voiceName: p.name };
  const script: any = await assembleFinalizeScript(input, sections, presetHook);
  let body: string = script.fullScript || script.script || script.body || ""; let hook: string = script.hook || "";
  const fc = await finalCheck({ hook, body, title, facts: sourceMaterial, subject: c.topic });
  if (fc.status === "ok") { body = fc.body; hook = fc.hook; }
  const vc = await finalVoiceCheck(body, { fingerprint, structure: rules, voiceName: p.name, facts: sourceMaterial, noCta: true });
  mkdirSync(".scratch", { recursive: true });
  const out = `.scratch/voice-v2-harness-${voiceName.replace(/\W+/g, "")}-${caseId}.md`;
  writeFileSync(out, [`# ${title}`, "", `Voice: ${p.name} (v2 rules in memory) | Rhythm match: ${vc.before.score} -> ${vc.after.score} | voice-check edits: ${vc.changes.length} applied, ${vc.refused} refused${vc.reverted ? ", reverted" : ""}`, "",
    "## Voice-check edits (check that no fact moved)", "", ...vc.changes.map((x) => `- [${x.fix}]\n  - before: ${x.from}\n  - after: ${x.to}`), "", "## Script", "", hook, "", vc.body].join("\n"));
  console.log(`Saved ${out}: rhythm match ${vc.before.score} -> ${vc.after.score}, ${vc.changes.length} edits`);
})();
