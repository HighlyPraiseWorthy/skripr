// CARD BENCHMARK, judge. Grades every card from cards-run.ts with an INDEPENDENT judge (its own prompt,
// not the checker that built the cards) plus deterministic checks, and writes a JSON summary.
// Evidence-gated: an error counts only if its quote of the card is really in the card, and (for a
// contradiction) its quote of the research is really in the research. So no error can be invented.
//   npx tsx scripts/benchmark/cards-judge.ts --dir <results dir> --labels baseline,current
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { familyInFacts } from "../../src/lib/script-compliance";

const arg = (k: string, d = "") => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const dir = path.resolve(arg("dir", "scripts/benchmark/results/cards"));
const labels = arg("labels", "baseline,current").split(",");
const benchDir = path.resolve(__dirname);
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
const squash = (t: string) => String(t || "").toLowerCase().replace(/[“”"'’‘]/g, "").replace(/[^a-z0-9$%.]+/g, " ").replace(/\s+/g, " ").trim();

const TYPES = ["invented", "contradicted", "wrong_number", "joined_figures", "intent_or_feeling", "absolute", "attribution", "privacy", "group", "timing", "payoff_promise"] as const;

const RUBRIC = `You are an independent fact-checker and story editor grading YouTube video angle cards before a creator commits to one. Use ONLY the RESEARCH below, never your own knowledge.

For each card, list every real ERROR in its hook, title, or payoff. Types:
- invented: a specific (event, detail, place, number, description) the research never gives.
- contradicted: a claim a research sentence contradicts.
- wrong_number: a figure that differs from the research.
- joined_figures: two figures linked as if one measured the other when the research ties them differently.
- intent_or_feeling: a real person's motive, intent, thought, or feeling the research doesn't state.
- absolute: "forever", "nobody", "everyone", "the whole time", "never caught" that the research disproves.
- attribution: something the research gives only as one person's account (a memoir, an interview, a family member) stated as plain fact.
- privacy: a private family member named, or a minor at the time named or used as the hook's opening.
- group: a group described differently from the research ("his congregation" vs "clients, many from his church").
- timing: things at different times stated as simultaneous, or in the wrong order.
- payoff_promise: the payoff text promises the video will show something the research doesn't have.
Do NOT flag style, taste, or a framing that is fair to the research. When unsure, don't flag.

For every error give "cardQuote": the EXACT words from the card (3 to 15 words, copied character for character), and for contradicted, wrong_number, joined_figures, absolute, timing: "researchQuote": the shortest EXACT span of the research that shows the problem.

Also rate each card's "hookStrength" 1 to 10 as a YouTube hook for this niche (curiosity, specificity, stakes, a reason to keep watching) and give one short "why".

Output ONLY JSON: {"cards":[{"i":0,"errors":[{"type":"...","cardQuote":"...","researchQuote":"...","explanation":"..."}],"hookStrength":7,"why":"..."}]}`;

async function judge(caseId: string, research: string, angles: any[]) {
  const cardsText = angles.map((a, i) => `[${i}] HOOK TYPE: ${a.hookType}\nTITLE: ${a.titleSuggestion}\nHOOK: ${a.hookPremise}\nPAYOFF: ${a.whyItWorks}`).join("\n\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const msg = await client.messages.create({ model: "claude-opus-5-5", max_tokens: 8000, system: RUBRIC, messages: [{ role: "user", content: `RESEARCH:\n"""\n${research.slice(0, 45000)}\n"""\n\nCARDS:\n${cardsText}` }] });
      const text = msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
    } catch (e: any) { console.error(`[judge] ${caseId} attempt ${attempt + 1}: ${e?.message || e}`); }
  }
  return { cards: [] };
}

function deterministic(a: any, research: string, subject: string) {
  const issues: string[] = [];
  const t = String(a.titleSuggestion || "");
  if (t.length > 60) issues.push(`title ${t.length} chars`);
  if (/[.!?]\s+\S/.test(t)) issues.push("title is two sentences");
  const text = `${a.titleSuggestion} ${a.hookPremise}`;
  for (const f of familyInFacts(research, subject)) if (new RegExp(`\\b${f.first}\\b`).test(text)) issues.push(`names family member ${f.first}`);
  const first = String(a.hookPremise || "").split(/(?<=[.!?])\s+/)[0] || "";
  if (/\b(?:his|her|their|[A-Z][a-z]+['’]s)\s+(?:[\w-]+\s+){0,2}(?:daughter|son|wife|husband|children|kids)\b/.test(first)) issues.push("opens on a family member");
  return issues;
}

const stems = (t: string) => new Set((String(t).toLowerCase().match(/[a-z]{5,}/g) || []).map((w) => w.slice(0, 6)));
function distinctness(angles: any[]) {
  const s = angles.map((a) => stems(`${a.hookPremise} ${a.titleSuggestion}`));
  let sum = 0, n = 0;
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) { const inter = [...s[i]].filter((x) => s[j].has(x)).length; const uni = new Set([...s[i], ...s[j]]).size || 1; sum += inter / uni; n++; }
  return n ? +(1 - sum / n).toFixed(2) : 1; // 1 = completely different cards
}

(async () => {
  const cases = JSON.parse(fs.readFileSync(path.join(benchDir, "cards-cases.json"), "utf8"));
  const summary: any = { generatedAt: new Date().toISOString(), labels, cases: [] as any[] };
  for (const c of cases) {
    const facts = JSON.parse(fs.readFileSync(path.join(benchDir, "fixtures", `${c.id}.json`), "utf8"));
    const research = facts.map((f: any) => f.fact).join("\n");
    const row: any = { id: c.id, topic: c.topic, kind: c.kind, runs: {} };
    await Promise.all(labels.map(async (label) => {
      const file = path.join(dir, `${label}__${c.id}.json`);
      if (!fs.existsSync(file)) return;
      const run = JSON.parse(fs.readFileSync(file, "utf8"));
      const angles = run.angles || [];
      const j = angles.length ? await judge(c.id, research, angles) : { cards: [] };
      const graded = angles.map((a: any, i: number) => {
        const jc = (j.cards || []).find((x: any) => Number(x.i) === i) || {};
        const cardText = squash(`${a.titleSuggestion} ${a.hookPremise} ${a.whyItWorks}`);
        const errors = (jc.errors || []).filter((e: any) => TYPES.includes(e.type) && e.cardQuote && cardText.includes(squash(e.cardQuote)) && (!e.researchQuote || squash(research).includes(squash(e.researchQuote))));
        const det = deterministic(a, research, c.topic);
        return { hookType: a.hookType, title: a.titleSuggestion, hook: a.hookPremise, payoff: a.whyItWorks, factCount: a.factCount ?? null, errors, deterministic: det, hookStrength: Number(jc.hookStrength) || null, why: jc.why || "", clean: !errors.length && !det.length };
      });
      row.runs[label] = { ms: run.ms, niche: run.niche, cards: graded, n: graded.length, clean: graded.filter((g: any) => g.clean).length, errors: graded.reduce((s: number, g: any) => s + g.errors.length + g.deterministic.length, 0), hookStrength: graded.length ? +(graded.reduce((s: number, g: any) => s + (g.hookStrength || 0), 0) / graded.length).toFixed(1) : null, distinct: distinctness(angles) };
      console.error(`[judge] ${label} ${c.id}: ${row.runs[label].clean}/${row.runs[label].n} clean, ${row.runs[label].errors} errors, hook ${row.runs[label].hookStrength}`);
    }));
    summary.cases.push(row);
  }
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 1));
})();
