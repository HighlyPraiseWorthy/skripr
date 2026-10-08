// EVIDENCE INTEGRITY BASELINE (2026-10-07). Measures the CURRENT pipeline, unchanged, and maps where factual
// integrity breaks: for every verified error, the FIRST pipeline stage where the claim appears and every stage
// it survives (creation vs preservation). Judge: accuracy_judge_v1 (frozen). Primary metric: unsupported
// specifics + contradictions per 1,000 words; "overreach" (the 4 interpretive categories) is tracked, never
// used to decide whether a fix works.
// Stages mirror production: plan -> hook -> section drafts -> finalize (6 snapshots) -> review -> final check.
//   npx tsx --env-file=.env.local scripts/benchmark/evidence-baseline.ts --runs 2 [--cases a,b] [--label baseline]
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { buildTopicBlueprint, generateHookFirst, writeSection, assembleFinalizeScript, reconcileTitle } from "../../src/lib/ai/claude";
import { reviewAndCorrectScript } from "../../src/lib/ai/self-review";
import { finalCheck } from "../../src/lib/ai/final-check";
import { resolveFactConflicts } from "../../src/lib/fact-conflicts";
import { guardRewrite, type InvariantViolation } from "../../src/lib/no-new-specifics";
import { judgeAccuracyV1, ACCURACY_JUDGE_VERSION, type JudgedIssue } from "./accuracy-judge";

const DIR = "scripts/benchmark";
const val = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const runs = Number(val("--runs") || 2);
const GATE = process.argv.includes("--gate"); // Experiment A: evidence gate at the section-writer boundary
// Step 2 (2026-10-07): settle conflicting research facts before generation. The WRITER gets the resolved facts;
// the JUDGE still sees the full research, so provenance is never hidden from evaluation.
const RESOLVE = process.argv.includes("--resolve-conflicts");
// Step 3 (2026-10-07): no-new-checkable-proposition invariant on every rewrite pass (finalize checkpoints, then
// self-review and the final check, each diffed against its input). Logs every revert for inspection.
const INVARIANT = process.argv.includes("--no-new-specifics");
const PRIMARY = new Set(["unsupported_specificity", "contradiction"]);
type Case = { id: string; topic: string; title: string; angle: string; hookType: string; kind: string; minutes: number; niche?: string };
const cases: Case[] = JSON.parse(readFileSync(join(DIR, "cases.json"), "utf8"));
const pick = val("--cases")?.split(",");
const outDir = join(DIR, "results", `evidence-${val("--label") || "baseline"}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`);
mkdirSync(outDir, { recursive: true });

const norm = (t: string) => String(t || "").toLowerCase().replace(/[‘’“”"']/g, "").replace(/[^a-z0-9$%.]+/g, " ").replace(/\s+/g, " ").trim();
const content = (t: string) => norm(t).split(" ").filter((w) => w.length >= 4 || /\d/.test(w));
// Is this claim (the judge's exact script quote) present in a stage's text? Exact first; else 80% of its
// content words inside one sentence of the stage (the wording can shift a little between passes).
function present(quote: string, stageText: string): boolean {
  const q = norm(quote); const S = norm(stageText);
  if (q.length >= 8 && S.includes(q)) return true;
  const qw = content(quote); if (qw.length < 3) return false;
  return stageText.split(/(?<=[.!?])\s+/).some((sent) => { const w = new Set(content(sent)); return qw.filter((x) => w.has(x)).length / qw.length >= 0.8; });
}

async function generateTraced(c: Case) {
  const facts = JSON.parse(readFileSync(join(DIR, "fixtures", `${c.id}.json`), "utf8"));
  const fullResearch = facts.map((f: any) => (f.source ? `${f.fact} (source: ${f.source})` : f.fact)).join("\n");
  const resolved = RESOLVE ? await resolveFactConflicts(facts) : null;
  const sourceMaterial = resolved ? resolved.writerFacts.map((f: any) => (f.source ? `${f.fact} (source: ${f.source})` : f.fact)).join("\n") : fullResearch;
  const stages: { stage: string; text: string }[] = [];
  const plan = await buildTopicBlueprint(sourceMaterial, Math.round(c.minutes * 165), c.minutes, c.angle, { hookType: c.hookType, storytelling: "story" });
  if (plan.length < 2) throw new Error("blueprint failed");
  stages.push({ stage: "plan", text: plan.map((p: any) => [p.concept, p.point, p.name, p.purpose].filter(Boolean).join(". ")).join("\n") });
  const title = reconcileTitle(c.title, sourceMaterial);
  const presetHook = await generateHookFirst({ title, topic: c.topic, hookType: c.hookType, anglePremise: c.angle, sourceMaterial } as any);
  stages.push({ stage: "hook", text: presetHook || "" });
  const sections: { title: string; content: string }[] = [];
  const gateLog: any[] = [];
  const invariantLog: InvariantViolation[] = [];
  let previousTail = "";
  for (let i = 0; i < plan.length; i++) {
    const text = await writeSection(plan[i], i, plan.length, { topic: c.topic, title, sourceMaterial, previousTail, alreadyTold: sections.map((s) => s.content).join("\n\n"),
      reservedFacts: plan.slice(i + 1).flatMap((p) => p.assignedFacts || []), otherPoints: plan.filter((_, k) => k !== i).map((p) => p.point || "").filter(Boolean),
      ...(GATE ? { evidenceGate: { log: gateLog } } : {}) } as any);
    sections.push({ title: plan[i].name, content: text });
    stages.push({ stage: `section_${i + 1}`, text });
    previousTail = text.split(/\s+/).slice(-40).join(" ");
  }
  const input: any = { sourceTranscript: "", targetTopic: c.topic, targetNiche: "general", sourceTitle: c.topic, sourceNiche: "general", videoLength: "long", targetMinutes: c.minutes,
    tone: "entertaining", ttsOptimized: false, angle: c.angle, sectionPlan: plan, hookArchetype: c.hookType, topicKind: c.kind, storytellingMode: "story", sourceMaterial,
    selectedTitle: title, noCta: true, routeStartedAt: Date.now(), ...(INVARIANT ? { noNewSpecifics: true, __invariantLog: invariantLog } : {}), __trace: (stage: string, text: string) => stages.push({ stage, text }) };
  const script: any = await assembleFinalizeScript(input, sections, presetHook);
  let body: string = script.fullScript || script.script || script.body || ""; let hook: string = script.hook || "";
  const reviewed = await reviewAndCorrectScript({ hook, body, title, sourceMaterial });
  if (reviewed.changes.length) {
    if (INVARIANT) { const g = guardRewrite(`${hook}\n\n${body}`, `${reviewed.hook}\n\n${reviewed.body}`, { pass: "self_review", evidence: sourceMaterial, log: invariantLog }); const [h, ...b] = g.split(/\n\n+/); hook = h || reviewed.hook; body = b.join("\n\n") || reviewed.body; }
    else { body = reviewed.body; hook = reviewed.hook; }
  }
  stages.push({ stage: "review", text: `${hook}\n\n${body}` });
  const fc = await finalCheck({ hook, body, title, facts: sourceMaterial, subject: c.topic });
  if (fc.status === "ok") {
    if (INVARIANT) { const g = guardRewrite(`${hook}\n\n${body}`, `${fc.hook}\n\n${fc.body}`, { pass: "final_check", evidence: sourceMaterial, log: invariantLog }); const [h, ...b] = g.split(/\n\n+/); hook = h || fc.hook; body = b.join("\n\n") || fc.body; }
    else { body = fc.body; hook = fc.hook; }
  }
  stages.push({ stage: "final_check", text: `${hook}\n\n${body}` });
  return { title, sourceMaterial, stages, final: `${hook}\n\n${body}`, drafts: [presetHook || "", ...sections.map((s) => s.content)].join("\n\n"), gateLog, fullResearch, conflicts: resolved?.conflicts || null, invariantLog };
}

function trace(issue: JudgedIssue, stages: { stage: string; text: string }[]) {
  const seen = stages.filter((s) => present(issue.script_quote, s.text)).map((s) => s.stage);
  return { first_seen: seen[0] || "not_found", seen_in: seen };
}

(async () => {
  const list = cases.filter((c) => !pick || pick.includes(c.id));
  const rows: any[] = [];
  const queue = list.flatMap((c) => Array.from({ length: runs }, (_, r) => ({ c, r: r + 1 })));
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const { c, r } = job;
      try {
        const g = await generateTraced(c);
        const [finalJ, draftJ] = await Promise.all([judgeAccuracyV1(g.final, g.fullResearch), judgeAccuracyV1(g.drafts, g.fullResearch)]);
        const words = g.final.split(/\s+/).filter(Boolean).length;
        const finalErrors = finalJ.errors.map((e) => ({ ...e, ...trace(e, g.stages), in_final: true }));
        // Errors the drafts had that the final no longer contains: created, then removed (by which stage?).
        const removed = draftJ.errors.filter((e) => !present(e.script_quote, g.final)).map((e) => { const t = trace(e, g.stages); return { ...e, ...t, in_final: false, removed_after: t.seen_in[t.seen_in.length - 1] || "?" }; });
        const primary = finalErrors.filter((e) => PRIMARY.has(e.category));
        const row = { id: c.id, run: r, words, primaryPer1k: +((primary.length / words) * 1000).toFixed(2), overreachPer1k: +(((finalErrors.length - primary.length) / words) * 1000).toFixed(2),
          finalErrors, removed, draftErrors: draftJ.errors.length, rejected: finalJ.rejected, gate: GATE ? { flags: g.gateLog.length, actions: g.gateLog.reduce((m: any, f: any) => ({ ...m, [f.action]: (m[f.action] || 0) + 1 }), {}) } : null };
        rows.push(row);
        writeFileSync(join(outDir, `${c.id}-run${r}.json`), JSON.stringify({ ...row, gateLog: g.gateLog, conflicts: g.conflicts, invariantLog: g.invariantLog, stages: g.stages.map((s) => ({ stage: s.stage, words: s.text.split(/\s+/).length })), final: g.final }, null, 1));
        console.log(`[${c.id} run ${r}] ${words}w primary ${row.primaryPer1k}/1k (${primary.length}) overreach ${row.overreachPer1k}/1k | first seen: ${primary.map((e) => e.first_seen).join(", ") || "-"} | removed before final: ${removed.length}`);
      } catch (e: any) { console.log(`[${c.id} run ${r}] FAILED ${e?.message || e}`); }
    }
  };
  await Promise.all([worker(), worker()]);
  // Summary: the integrity map.
  const all = rows.flatMap((r) => r.finalErrors.filter((e: any) => PRIMARY.has(e.category)));
  const bucket = (s: string) => s.startsWith("section_") ? "section_writer" : s;
  const byStage: Record<string, number> = {}; all.forEach((e: any) => { const b = bucket(e.first_seen); byStage[b] = (byStage[b] || 0) + 1; });
  const rem = rows.flatMap((r) => r.removed.filter((e: any) => PRIMARY.has(e.category)));
  const remBy: Record<string, number> = {}; rem.forEach((e: any) => { const b = bucket(e.removed_after); remBy[b] = (remBy[b] || 0) + 1; });
  const avg = (k: string) => +(rows.reduce((s, r) => s + r[k], 0) / Math.max(1, rows.length)).toFixed(2);
  const gateTotals = GATE ? rows.reduce((m: any, r) => { for (const [k, v] of Object.entries(r.gate?.actions || {})) m[k] = (m[k] || 0) + (v as number); m.flags = (m.flags || 0) + (r.gate?.flags || 0); return m; }, {}) : null;
  const summary = { judge: ACCURACY_JUDGE_VERSION, gate: gateTotals, scripts: rows.length, primaryPer1k: avg("primaryPer1k"), overreachPer1k: avg("overreachPer1k"), primaryErrorsInFinal: all.length, firstSeenByStage: byStage,
    primaryRemovedBeforeFinal: rem.length, lastSeenBeforeRemoval: remBy };
  writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 1));
  console.log("\nSUMMARY", JSON.stringify(summary, null, 1));
})();
