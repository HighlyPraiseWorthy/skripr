// CARD BENCHMARK, hook diagnosis. Explains WHY a card's hook scores what it does, so hook work can be
// aimed and measured. Separate from cards-judge.ts (errors) so error numbers stay comparable over time.
// Per card: six sub-scores, the question test, a predictability test, an ending give-away check,
// a weak-opening check (code), and the single biggest fix. Weighted score per the hook spec:
// curiosity 30, stakes 20, specificity 15, tension 15, payoff 10, voice 10; curiosity < 7 caps it at 7.5.
//   npx tsx --env-file=.env.local scripts/benchmark/cards-hookjudge.ts --labels payoff
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

const arg = (k: string, d = "") => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const dir = path.resolve(arg("dir", "scripts/benchmark/results/cards"));
const labels = arg("labels", "payoff").split(",");
const benchDir = path.resolve(__dirname);
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

export const WEAK_OPENINGS = /^(?:for (?:decades|years|centuries)|imagine\b|this is the story of|in this video|have you ever|meet\b|what if i told you|today we|let'?s talk about|everyone knows|throughout history|once upon)/i;
export const W = { curiosity: 0.3, stakes: 0.2, specificity: 0.15, tension: 0.15, payoff: 0.1, voice: 0.1 } as const;
// v2 (reviewer, 2026-10-05): tension above stakes, since a factual contradiction carries a hook that has
// no life-or-death stakes (LTCM, fast food prices).
export const W2 = { curiosity: 0.3, tension: 0.2, specificity: 0.15, stakes: 0.15, payoff: 0.1, voice: 0.1 } as const;
export function weighted(s: Record<string, number>, weights: Record<string, number> = W) {
  let v = 0; for (const [k, w] of Object.entries(weights)) v += (Number(s[k]) || 0) * w;
  if ((Number(s.curiosity) || 0) < 7) v = Math.min(v, 7.5);
  return +v.toFixed(1);
}

const RUBRIC = `You are a senior YouTube story editor diagnosing video HOOKS for a faceless documentary channel. Judge only how well each card would hold a viewer through the first 30 seconds. Facts are checked elsewhere; ignore accuracy here.

Score each 1-10 (10 = top-1% outlier hook in this niche, 5 = competent but forgettable):
- curiosity: does it open a specific question the viewer NEEDS answered? (a gap, not a topic)
- stakes: is it clear what was at risk, for whom, and why it matters?
- specificity: concrete names, numbers, places, objects vs vague summary
- tension: is there a contradiction, reversal, or two things that shouldn't both be true?
- payoff: does the payoff line promise a satisfying, earned answer the hook sets up?
- voice: does it sound like a person telling a story out loud, not a summary or a pitch?

Also:
- question: the exact question a viewer would want answered after hearing this hook (one line). If there is no real question, write "none".
- predictable: true if a typical viewer could guess the ending or answer from the hook alone.
- givesAwayEnding: true only if the title or hook already states what the card's PAYOFF reveals (how it ended, how they were caught, the answer the video is built to deliver). The story's PREMISE is not a give-away: in an unsolved case "she was never found" or "the warrant is still open" is the premise, and the open question is how or why; in a known-outcome case "he was caught" is the premise when the payoff is how.
- engine: the hook's main mechanism in 2-5 words (e.g. "outcome known, method hidden", "two lives one man", "number that shouldn't exist").
- fix: the single change that would most raise this hook, one sentence, using only material already on the card.
- viewerInference: what a viewer would confidently conclude about how the story resolves, from the title and hook alone (one line).
- integrity (true/false each): "endingRevealed" (the title or hook states the resolution), "questionPreserved" (a real question is still open at the end of the hook), "inferenceTooStrong" (the viewer can confidently guess the payoff), "genericLanguage" (vague stand-ins instead of specifics), "concreteEvidence" (a hard number, object, or named detail is present), "naturalTurn" (two facts side by side create a reversal without a manufactured line).

Output ONLY JSON: {"cards":[{"i":0,"curiosity":7,"stakes":6,"specificity":8,"tension":6,"payoff":7,"voice":6,"question":"...","predictable":false,"givesAwayEnding":false,"engine":"...","fix":"...","viewerInference":"...","integrity":{"endingRevealed":false,"questionPreserved":true,"inferenceTooStrong":false,"genericLanguage":false,"concreteEvidence":true,"naturalTurn":false}}]}`;

async function diagnose(id: string, angles: any[]) {
  const cardsText = angles.map((a, i) => `[${i}] HOOK TYPE: ${a.hookType}\nTITLE: ${a.titleSuggestion}\nHOOK: ${a.hookPremise}\nPAYOFF: ${a.payoffMoment ? `the video pays off on: ${a.payoffMoment}` : a.whyItWorks}`).join("\n\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const msg = await client.messages.create({ model: "claude-opus-5-5", max_tokens: 6000, system: RUBRIC, messages: [{ role: "user", content: `CARDS:\n${cardsText}` }] });
      const text = msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
    } catch (e: any) { console.error(`[hookjudge] ${id} attempt ${attempt + 1}: ${e?.message || e}`); }
  }
  return { cards: [] };
}

if (require.main === module) (async () => {
  const cases = JSON.parse(fs.readFileSync(path.join(benchDir, "cards-cases.json"), "utf8"));
  const out: any = { generatedAt: new Date().toISOString(), labels, cases: [] as any[] };
  for (const c of cases) {
    const row: any = { id: c.id, topic: c.topic, kind: c.kind, runs: {} };
    await Promise.all(labels.map(async (label) => {
      const file = path.join(dir, `${label}__${c.id}.json`);
      if (!fs.existsSync(file)) return;
      const angles = JSON.parse(fs.readFileSync(file, "utf8")).angles || [];
      const j = angles.length ? await diagnose(c.id, angles) : { cards: [] };
      row.runs[label] = angles.map((a: any, i: number) => {
        const d = (j.cards || []).find((x: any) => Number(x.i) === i) || {};
        const first = String(a.hookPremise || "").trim();
        return { hookType: a.hookType, title: a.titleSuggestion, hook: a.hookPremise, ...d, weakOpening: WEAK_OPENINGS.test(first), score: weighted(d), score2: weighted(d, W2) };
      });
      const r = row.runs[label];
      console.error(`[hookjudge] ${label} ${c.id}: avg ${(r.reduce((s: number, x: any) => s + x.score, 0) / (r.length || 1)).toFixed(1)}`);
    }));
    out.cases.push(row);
  }
  fs.writeFileSync(path.join(dir, `hooks-${labels.join("-")}.json`), JSON.stringify(out, null, 1));
})();
