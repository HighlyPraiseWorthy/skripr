// SKRIPR QUALITY BENCHMARK
//
// Generates a script for each fixed case through the SAME pipeline the app uses (story blueprint ->
// hook-first -> section writer with already-told + reserved facts -> finalize (every check) -> the
// post-review edits), then scores it three ways:
//   1. CODE CHECKS: deterministic counts of known failure modes (fake quotes, superlative drift,
//      guessed ages, stutters, leaked dividers, repeated phrases, banned filler, time-order jumps).
//   2. ACCURACY JUDGE: an independent strict reviewer reads every sentence against the research and
//      lists invented / speculative / contradicted claims. Reported per 1,000 words.
//   3. CRAFT JUDGE: a YouTube script editor scores hook, retention, specificity, clarity, ending and
//      voice 1-10, with the top weaknesses.
// Research is FROZEN per case (fixtures/<id>.json), so runs compare the writer + checks, not research luck.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/benchmark/run.ts --snapshot            # (re)build fixtures from saved research
//   npx tsx --env-file=.env.local scripts/benchmark/run.ts                       # run all cases
//   npx tsx --env-file=.env.local scripts/benchmark/run.ts --cases freshwaters,wright
//   npx tsx --env-file=.env.local scripts/benchmark/run.ts --save-baseline       # store this run as the baseline
//   npx tsx --env-file=.env.local scripts/benchmark/run.ts --rescore <resultsDir> # re-judge saved scripts, no generation

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { getLibrary, activeFacts } from "../../src/lib/fact-library";
import { listVoiceProfiles, getVoiceMetaById, SKRIPR_HOUSE_VOICE } from "../../src/lib/voice-profile";
import { buildTopicBlueprint, generateHookFirst, writeSection, assembleFinalizeScript, reconcileTitle, unsupportedAgeSentences, overusedOpeners, repeatedFigures, repeatedShapes } from "../../src/lib/ai/claude";
import { reviewAndCorrectScript } from "../../src/lib/ai/self-review";
import { chooseStructure } from "../../src/lib/structure-families";
import { splitSentences, unsourcedQuotes, superlativeMismatches, stripStutters, stripDividers, fixDanglingBackrefs, fixQuoteWordCounts, stripLeaningFragments } from "../../src/lib/script-compliance";

const DIR = join(process.cwd(), "scripts/benchmark");
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const val = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const anthropic = new Anthropic();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type Case = { id: string; library: string; topic: string; title: string; angle: string; hookType: string; kind: string; voice: string | null; minutes: number; niche?: string };
type Fact = { fact: string; source: string | null };
const cases: Case[] = JSON.parse(readFileSync(join(DIR, "cases.json"), "utf8"));
const config: { voiceUserId?: string } = existsSync(join(DIR, "config.json")) ? JSON.parse(readFileSync(join(DIR, "config.json"), "utf8")) : {};

async function ownerId(): Promise<string> {
  if (process.env.BENCHMARK_USER_ID) return process.env.BENCHMARK_USER_ID;
  const { data } = await sb.from("scripts").select("user_id").ilike("topic", "%Freshwaters%").limit(1);
  if (!data?.[0]?.user_id) throw new Error("Set BENCHMARK_USER_ID (the account whose saved research/voices the cases use).");
  return data[0].user_id;
}

// ---------- fixtures ----------
async function snapshot(uid: string) {
  mkdirSync(join(DIR, "fixtures"), { recursive: true });
  for (const c of cases) {
    if (existsSync(join(DIR, "fixtures", `${c.id}.json`)) && !flag("--force")) { console.log(`fixture ${c.id}: kept (frozen; --force to rebuild)`); continue; }
    const facts = (activeFacts(await getLibrary(uid, c.library)) as any[]).map((f) => ({ fact: f.fact, source: f.source ?? null }));
    writeFileSync(join(DIR, "fixtures", `${c.id}.json`), JSON.stringify(facts, null, 1));
    console.log(`fixture ${c.id}: ${facts.length} facts`);
  }
}
const loadFacts = (c: Case): Fact[] => JSON.parse(readFileSync(join(DIR, "fixtures", `${c.id}.json`), "utf8"));
const toMaterial = (facts: Fact[]) => facts.map((f) => (f.source ? `${f.fact} (source: ${f.source})` : f.fact)).join("\n");

// ---------- generation (mirrors /api/scripts/generate plan -> section -> finalize) ----------
async function generate(c: Case, uid: string): Promise<{ title: string; hook: string; body: string; ms: number }> {
  const t0 = Date.now();
  const sourceMaterial = toMaterial(loadFacts(c));
  let voiceProfile = SKRIPR_HOUSE_VOICE;
  if (c.voice) {
    // Voices can come from a different account than the research (BENCHMARK_VOICE_USER_ID).
    const vuid = process.env.BENCHMARK_VOICE_USER_ID || config.voiceUserId || uid;
    const row = (await listVoiceProfiles(vuid)).find((v: any) => v.name.toLowerCase() === c.voice!.toLowerCase()) as any;
    const meta = row ? await getVoiceMetaById(vuid, row.id) : null;
    if (!meta) console.warn(`[${c.id}] voice "${c.voice}" not found for that account; using the house voice`);
    if (meta?.styleGuide) voiceProfile = meta.styleGuide;
  }
  const minutes = c.minutes;
  // --structure: plan on the winning structure chosen from the niche's outlier data (same as the app).
  const chosen = flag("--structure") ? await chooseStructure({ niche: c.niche, facts: loadFacts(c).map((f) => f.fact), angle: c.angle, topic: c.topic }) : null;
  if (chosen) console.log(`[${c.id}] structure: ${chosen.source} "${chosen.name}" (${chosen.scope}, fit ${chosen.fit})`);
  const plan = await buildTopicBlueprint(sourceMaterial, Math.round(minutes * 165), minutes, c.angle, { hookType: c.hookType, storytelling: "story", structure: chosen ? { name: chosen.name, stages: chosen.stages } : undefined });
  if (plan.length < 2) throw new Error("blueprint failed");
  const title = reconcileTitle(c.title, sourceMaterial);
  const presetHook = await generateHookFirst({ title, topic: c.topic, hookType: c.hookType, anglePremise: c.angle, sourceMaterial, voiceProfile } as any);
  const sections: { title: string; content: string }[] = [];
  let previousTail = "";
  for (let i = 0; i < plan.length; i++) {
    const text = await writeSection(plan[i], i, plan.length, {
      topic: c.topic, title, sourceMaterial, voice: voiceProfile, previousTail,
      alreadyTold: sections.map((s) => s.content).join("\n\n"),
      reservedFacts: plan.slice(i + 1).flatMap((p) => p.assignedFacts || []),
      otherPoints: plan.filter((_, k) => k !== i).map((p) => p.point || "").filter(Boolean),
    });
    sections.push({ title: plan[i].name, content: text });
    previousTail = text.split(/\s+/).slice(-40).join(" ");
  }
  const input: any = {
    sourceTranscript: "", targetTopic: c.topic, targetNiche: "general", sourceTitle: c.topic, sourceNiche: "general",
    videoLength: "long", targetMinutes: minutes, tone: "entertaining", ttsOptimized: false, angle: c.angle,
    voiceProfile, voiceName: c.voice || undefined, sectionPlan: plan, hookArchetype: c.hookType,
    topicKind: c.kind, storytellingMode: "story", sourceMaterial, selectedTitle: title, noCta: true, routeStartedAt: Date.now(),
  };
  const script: any = await assembleFinalizeScript(input, sections, presetHook);
  let body: string = script.fullScript || script.script || script.body || "";
  let hook: string = script.hook || "";
  const reviewed = await reviewAndCorrectScript({ hook, body, title, sourceMaterial });
  if (reviewed.changes.length) { body = reviewed.body; hook = reviewed.hook; }
  return { title, hook, body, ms: Date.now() - t0 };
}

// ---------- scoring ----------
const BANNED = [
  /not unusual for (?:the|that) era/i, /common (?:at|for) the time/i, /pulling threads/i, /dead leads/i,
  /paid (?:his |her )?(?:rent|bills)/i, /kept to himself/i, /a face people recognized/i, /place in the community/i,
  /hold a lease/i, /receive mail/i, /it'?s important to note/i, /plays a crucial role/i, /at the end of the day/i,
  /let that sink in/i, /read that again/i, /here'?s the thing/i, /\bdelve\b/i, /tapestry/i,
  /stays with you/i, /hard to process/i, /worth sitting with/i, /that is chilling/i, /here'?s where it gets/i, /what makes this remarkable/i,
];
function codeChecks(body: string, material: string) {
  const sents = body.split(/\n\n+/).flatMap((p) => splitSentences(p));
  const words = body.split(/\s+/).filter(Boolean).length;
  const lower = body.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ");
  const tok = lower.split(" ");
  const grams = new Map<string, number>();
  for (let i = 0; i + 5 <= tok.length; i++) { const g = tok.slice(i, i + 5).join(" "); grams.set(g, (grams.get(g) || 0) + 1); }
  const repeated = [...grams.entries()].filter(([, n]) => n >= 3).map(([g]) => g);
  const paraYears = body.split(/\n\n+/).slice(2).map((p) => { const m = p.match(/\b(1[89]\d{2}|20\d{2})\b/); return m ? Number(m[1]) : null; }).filter((y): y is number => y !== null);
  let backJumps = 0; for (let i = 1; i < paraYears.length; i++) if (paraYears[i] < paraYears[i - 1] - 5) backJumps++;
  return {
    words,
    overusedOpeners: overusedOpeners(sents).map((t) => `${t.opener} x${t.idx.length}`),
    repeatedFigures: repeatedFigures(sents).map((f) => `${f.figure} x${f.again.length + 1}`),
    repeatedShapes: repeatedShapes(sents).map((x) => `${x.shape} x${x.idx.length}`),
    leaningFragments: stripLeaningFragments(body).cuts,
    fakeQuotes: unsourcedQuotes(body, material),
    superlativeDrift: superlativeMismatches(body, material).map((m) => m.said),
    guessedAges: unsupportedAgeSentences(sents, material).map((i) => sents[i]),
    stutters: stripStutters(body).cuts,
    dividers: stripDividers(body).cuts.length,
    danglingRefs: fixDanglingBackrefs(body).cuts,
    quoteCountErrors: fixQuoteWordCounts(body).cuts,
    repeatedPhrases: repeated.slice(0, 12),
    bannedHits: BANNED.filter((r) => r.test(body)).map((r) => r.source),
    timeBackJumps: backJumps,
    emDashes: (body.match(/—/g) || []).length,
  };
}

async function judgeJSON(system: string, user: string, max = 4000): Promise<any> {
  for (let a = 0; a < 2; a++) {
    try {
      const m = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: max, temperature: 0, system, messages: [{ role: "user", content: user }] });
      const t = m.content[0]?.type === "text" ? m.content[0].text : "";
      return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    } catch { /* retry once */ }
  }
  return null;
}

// Independent accuracy reviewer (deliberately a DIFFERENT prompt from the in-app fact pass, so the
// benchmark is not grading the app with the app's own blind spots).
async function accuracyJudge(body: string, material: string) {
  const sents = body.split(/\n\n+/).flatMap((p) => splitSentences(p));
  const WIN = 50; const wins: number[][] = [];
  for (let a = 0; a < sents.length; a += WIN) wins.push(Array.from({ length: Math.min(WIN, sents.length - a) }, (_, k) => a + k));
  const sys = `You are a strict documentary fact-checker auditing a finished YouTube script against the research it was written from. List EVERY sentence that states something the research does not support. Count as a problem: (a) INVENTED: any specific detail, action, scene, place, time of day, number, behavior, relationship, or background/history claim absent from the research; (b) MIND/KNOWLEDGE: what a real person or agency thought, felt, knew, intended, or failed to do, unless sourced; (c) SPECULATION/INSINUATION: hints, "might have", "not ruled out", implied wrongdoing; (d) CONTRADICTED: conflicts with the research; (e) MISATTRIBUTED: a claim or quote credited to the wrong source/speaker. NOT problems: interpretation, framing, emotion, rhetorical lines, correct arithmetic from research dates. Be strict but fair. Output ONLY JSON: {"issues":[{"i":<sentence index>,"type":"invented|mind|speculation|contradicted|misattributed","quote":"<the problem words>","why":"<short>"}]}`;
  const res = await Promise.all(wins.map((idxs) => judgeJSON(sys, `RESEARCH:\n"""\n${material.slice(0, 200000)}\n"""\n\nSCRIPT SENTENCES:\n${idxs.map((i) => `${i}. ${sents[i]}`).join("\n")}`)));
  const issues = res.flatMap((r) => (Array.isArray(r?.issues) ? r.issues : []));
  return { issues, sentences: sents.length };
}

async function craftJudge(c: Case, title: string, body: string) {
  const sys = `You are a senior YouTube script editor for faceless documentary channels. Score this script 1-10 on each dimension (10 = would publish unchanged and expect strong retention; 7 = solid but generic; 5 = noticeable problems). Be demanding and specific; do not grade on effort. Dimensions: hook (first 30s grabs and opens a loop), retention (escalation, open loops, momentum through the middle), specificity (concrete real moments vs generic narration), clarity (easy to follow when HEARD, time order, no confusion), ending (lands, pays off the opening), voice (consistent, human, not AI-sounding), repetition (10 = never repeats itself). Output ONLY JSON: {"scores":{"hook":n,"retention":n,"specificity":n,"clarity":n,"ending":n,"voice":n,"repetition":n},"overall":n,"weaknesses":["top 3 specific problems, quote the text"],"strengths":["top 2"]}`;
  return judgeJSON(sys, `TITLE: ${title}\nINTENDED ANGLE: ${c.angle}\nVOICE: ${c.voice || "Skripr house voice"}\n\nSCRIPT:\n"""\n${body}\n"""`, 1500);
}

async function score(c: Case, gen: { title: string; hook: string; body: string; ms?: number }) {
  const material = toMaterial(loadFacts(c));
  const [acc, craft] = await Promise.all([accuracyJudge(gen.body, material), craftJudge(c, gen.title, gen.body)]);
  const code = codeChecks(gen.body, material);
  const per1k = (n: number) => Math.round((n / Math.max(1, code.words)) * 1000 * 10) / 10;
  const codeIssueCount = code.repeatedFigures.length + code.repeatedShapes.length + code.leaningFragments.length + code.fakeQuotes.length + code.superlativeDrift.length + code.guessedAges.length + code.stutters.length + code.dividers + code.danglingRefs.length + code.quoteCountErrors.length + code.bannedHits.length + code.timeBackJumps;
  return {
    id: c.id, words: code.words, seconds: gen.ms ? Math.round(gen.ms / 1000) : null,
    accuracyIssues: acc.issues.length, accuracyPer1k: per1k(acc.issues.length),
    accuracyByType: acc.issues.reduce((m: any, x: any) => ((m[x.type] = (m[x.type] || 0) + 1), m), {}),
    craftOverall: craft?.overall ?? null, craft: craft?.scores ?? null, weaknesses: craft?.weaknesses ?? [], strengths: craft?.strengths ?? [],
    codeIssues: codeIssueCount, code, accuracyDetail: acc.issues,
  };
}

// ---------- reporting ----------
function report(results: any[], outDir: string) {
  const baselinePath = join(DIR, "baseline.json");
  const base: any[] = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : [];
  const b = (id: string) => base.find((x) => x.id === id);
  const d = (cur: number | null, prev: number | null | undefined, lowerIsBetter = false) => {
    if (cur == null || prev == null) return "";
    const diff = Math.round((cur - prev) * 10) / 10;
    if (!diff) return " (=)";
    const good = lowerIsBetter ? diff < 0 : diff > 0;
    return ` (${diff > 0 ? "+" : ""}${diff} ${good ? "▲" : "▼"})`;
  };
  const rows = results.map((r) => `| ${r.id} | ${r.craftOverall ?? "-"}${d(r.craftOverall, b(r.id)?.craftOverall)} | ${r.accuracyPer1k}${d(r.accuracyPer1k, b(r.id)?.accuracyPer1k, true)} | ${r.codeIssues}${d(r.codeIssues, b(r.id)?.codeIssues, true)} | ${r.words} |`);
  const avg = (k: string) => Math.round((results.reduce((s, r) => s + (Number(r[k]) || 0), 0) / results.length) * 10) / 10;
  const md = [`# Skripr benchmark ${new Date().toISOString().slice(0, 16)}`, "",
    `**Average craft:** ${avg("craftOverall")}/10 · **Accuracy issues per 1,000 words:** ${avg("accuracyPer1k")} · **Code-check issues per script:** ${avg("codeIssues")}`, "",
    "| Case | Craft /10 | Accuracy issues /1k words | Code issues | Words |", "|---|---|---|---|---|", ...rows, "",
    ...results.flatMap((r) => [`## ${r.id}`, `Craft: ${JSON.stringify(r.craft)}`, `Accuracy by type: ${JSON.stringify(r.accuracyByType)}`,
      `Weaknesses:`, ...r.weaknesses.map((w: string) => `- ${w}`),
      `Code checks: ${JSON.stringify({ fakeQuotes: r.code.fakeQuotes, superlativeDrift: r.code.superlativeDrift, guessedAges: r.code.guessedAges.length, stutters: r.code.stutters.length, dividers: r.code.dividers, danglingRefs: r.code.danglingRefs.length, quoteCountErrors: r.code.quoteCountErrors.length, bannedHits: r.code.bannedHits, timeBackJumps: r.code.timeBackJumps, repeatedPhrases: r.code.repeatedPhrases })}`,
      `Accuracy issues:`, ...r.accuracyDetail.slice(0, 25).map((x: any) => `- [${x.type}] "${String(x.quote || "").slice(0, 140)}": ${x.why}`), ""])].join("\n");
  writeFileSync(join(outDir, "summary.md"), md);
  writeFileSync(join(outDir, "summary.json"), JSON.stringify(results, null, 1));
  console.log("\n" + md.split("\n## ")[0]);
  if (flag("--save-baseline")) { writeFileSync(baselinePath, JSON.stringify(results.map(({ accuracyDetail, ...r }) => r), null, 1)); console.log("\nSaved as baseline."); }
}

async function main() {
  const uid = await ownerId();
  if (flag("--snapshot")) { await snapshot(uid); return; }
  // --recode <dir>: recompute ONLY the deterministic code checks for a saved run (and the baseline if
  // it came from that run). Judges are not re-run, so craft/accuracy scores stay comparable.
  const recode = val("--recode");
  if (recode) {
    const sum: any[] = JSON.parse(readFileSync(join(recode, "summary.json"), "utf8"));
    for (const r of sum) {
      const c = cases.find((x) => x.id === r.id)!; const g = JSON.parse(readFileSync(join(recode, `${r.id}.script.json`), "utf8"));
      const code = codeChecks(g.body, toMaterial(loadFacts(c)));
      r.code = code;
      r.codeIssues = code.repeatedFigures.length + code.repeatedShapes.length + code.leaningFragments.length + code.fakeQuotes.length + code.superlativeDrift.length + code.guessedAges.length + code.stutters.length + code.dividers + code.danglingRefs.length + code.quoteCountErrors.length + code.bannedHits.length + code.timeBackJumps;
    }
    writeFileSync(join(recode, "summary.json"), JSON.stringify(sum, null, 1));
    if (flag("--save-baseline")) writeFileSync(join(DIR, "baseline.json"), JSON.stringify(sum.map(({ accuracyDetail, ...r }: any) => r), null, 1));
    sum.forEach((r) => console.log(`${r.id}: code=${r.codeIssues} figures=${JSON.stringify(r.code.repeatedFigures)} shapes=${JSON.stringify(r.code.repeatedShapes)} fragments=${r.code.leaningFragments.length}`));
    return;
  }
  const pick = val("--cases")?.split(",");
  const run = cases.filter((c) => !pick || pick.includes(c.id));
  for (const c of run) if (!existsSync(join(DIR, "fixtures", `${c.id}.json`))) throw new Error(`missing fixture for ${c.id}: run --snapshot first`);

  const rescore = val("--rescore");
  const outDir = rescore || join(DIR, "results", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + (val("--label") ? `-${val("--label")}` : ""));
  mkdirSync(outDir, { recursive: true });

  const CONC = Number(val("--concurrency") || 3);
  const results: any[] = [];
  const queue = [...run];
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (queue.length) {
      const c = queue.shift()!;
      try {
        let gen: any;
        const f = join(outDir, `${c.id}.script.json`);
        if (rescore && existsSync(f)) gen = JSON.parse(readFileSync(f, "utf8"));
        else { console.log(`[${c.id}] generating...`); gen = await generate(c, uid); writeFileSync(f, JSON.stringify(gen, null, 1)); writeFileSync(join(outDir, `${c.id}.txt`), `${gen.title}\n\n${gen.body}`); }
        console.log(`[${c.id}] scoring...`);
        const r = await score(c, gen);
        results.push(r);
        console.log(`[${c.id}] craft=${r.craftOverall} accuracy/1k=${r.accuracyPer1k} code=${r.codeIssues} words=${r.words}`);
      } catch (e: any) { console.error(`[${c.id}] FAILED: ${e?.message}`); }
    }
  }));
  results.sort((a, b) => run.findIndex((c) => c.id === a.id) - run.findIndex((c) => c.id === b.id));
  report(results, outDir);
  console.log(`\nFull report: ${join(outDir, "summary.md")}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
