// CARD BENCHMARK, spoiler-cut experiment. Post-processes already generated cards (so every variant sees
// the SAME cards and differences come from the step, not run noise). DELETION ONLY: the hook is split
// into sentences and clauses in code; the model may only (a) drop a whole sentence or (b) cut a sentence
// from a clause onward. Code rebuilds the hook, so no word can be added or changed. Clauses that carry
// attribution ("by his own account", "prosecutors said") are protected, as is the first sentence.
//   B = cut the explicit answer.  C = B + viewer inference: also cut what lets the viewer infer the
//   protected payoff, while keeping a reveal that IS the hook (the payoff type decides which).
//   npx tsx --env-file=.env.local scripts/benchmark/cards-spoilercut.ts --from hookcraft2 --variant B
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

const arg = (k: string, d = "") => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const dir = path.resolve(arg("dir", "scripts/benchmark/results/cards"));
const from = arg("from", "hookcraft2");
const variant = arg("variant", "B") as "B" | "C";
const label = `spoil${variant}`;
const benchDir = path.resolve(__dirname);
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

const ATTRIB = /\b(by (?:his|her|their) own account|according to|(?:he|she|they) (?:later )?(?:said|wrote|told|claimed)|prosecutors|the indictment|court records|investigators (?:said|say)|alleged)\b/i;
type Seg = { s: number; c: number; text: string; protected: boolean };
export function segment(hook: string): Seg[][] {
  const sentences = hook.trim().split(/(?<=[.!?]['"’”]?)\s+(?=[A-Z0-9"'“‘$])/).filter(Boolean);
  return sentences.map((sen, s) => {
    // clause boundaries: ", and" ", but" ", then" ", while" "; " ", " (only before a lowercase word or "and")
    const parts = sen.split(/(?=,\s+(?:and|but|then|while|only|until|before|after|where|who|which)\b)|(?=;\s)|(?=\s+and then\b)|(?=,\s+(?:[a-z]))/);
    // The first sentence is locked whole; an attribution clause locks itself AND the clause it introduces.
    return parts.map((t, c) => ({ s, c, text: t, protected: s === 0 || ATTRIB.test(t) || (c > 0 && ATTRIB.test(parts[c - 1]) && parts[c - 1].split(/\s+/).length <= 6) }));
  });
}
export function applyCuts(segs: Seg[][], cuts: string[]): string {
  const dropSentence = new Set<number>(), cutFrom = new Map<number, number>();
  for (const k of cuts) {
    const m = String(k).match(/^S(\d+)(?:\.c(\d+))?$/); if (!m) continue;
    const s = Number(m[1]), c = m[2] !== undefined ? Number(m[2]) : null;
    if (!segs[s]) continue;
    if (c === null || c === 0) { if (s > 0 && !segs[s].some((x) => x.protected)) dropSentence.add(s); }
    else if (segs[s][c] && !segs[s].slice(c).some((x) => x.protected)) cutFrom.set(s, Math.min(c, cutFrom.get(s) ?? 99));
  }
  return segs.map((sen, s) => {
    if (dropSentence.has(s)) return "";
    const end = cutFrom.get(s);
    if (end === undefined) return sen.map((x) => x.text).join("");
    return sen.slice(0, end).map((x) => x.text).join("").replace(/[,;:\s]+$/, "") + ".";
  }).filter(Boolean).join(" ");
}
// Title: deletion only at a ":" or "," boundary (keep the part before it); otherwise unchanged.
const titleCut = (t: string) => { const m = t.match(/^(.{12,}?)[:,]\s/); return m ? m[1] : t; };

const PROMPT = (v: "B" | "C") => `You are a YouTube story editor. Each card's hook is split into numbered pieces: S0, S1... are sentences; S1.c2 is clause 2 of sentence 1. You can ONLY delete, never write: return cuts like "S2" (drop sentence 2) or "S1.c2" (cut sentence 1 from clause 2 to its end). Pieces marked [locked] cannot be cut.

For each card:
1. "payoffType": what the video's payoff actually reveals: OUTCOME, IDENTITY, METHOD, MECHANISM, LOCATION, CULPRIT, EXPLANATION, or CONSEQUENCE (use the PAYOFF line).
2. "heldBack": the specific answer the hook must not give away, in at most 15 words.
3. "cuts": the smallest set of cuts that removes every piece that STATES that answer.${v === "C" ? `
4. ALSO consider "viewerInference": what a viewer would confidently conclude about the held-back answer from the remaining hook. If it lets them guess the payoff, cut the piece that enables the guess too.
   BUT keep a reveal that IS the hook's engine and is not the payoff: e.g. if the payoff is HOW he was caught (METHOD), "he was declared dead while still alive" stays, because the viewer still doesn't know how he was found.` : ""}
- Never cut so much that the hook loses its concrete fact or its contradiction. If nothing gives the answer away, return no cuts.
- "titleSpoils": true if the TITLE states the held-back answer.

Output ONLY JSON: {"cards":[{"i":0,"payoffType":"...","heldBack":"...",${v === "C" ? `"viewerInference":"...",` : ""}"cuts":["S2"],"titleSpoils":false}]}`;

(async () => {
  const cases = JSON.parse(fs.readFileSync(path.join(benchDir, "cards-cases.json"), "utf8"));
  const log: any[] = [];
  await Promise.all(cases.map(async (c: any) => {
    const src = JSON.parse(fs.readFileSync(path.join(dir, `${from}__${c.id}.json`), "utf8"));
    const angles = src.angles || [];
    const segs = angles.map((a: any) => segment(String(a.hookPremise || "")));
    const cardsText = angles.map((a: any, i: number) => `[${i}] TYPE: ${a.hookType}\nTITLE: ${a.titleSuggestion}\nVIEWER QUESTION: ${a.viewerQuestion || ""}\nPAYOFF: ${a.payoffMoment || a.whyItWorks}\nHOOK PIECES:\n${segs[i].flat().map((x: Seg) => `  ${x.c === 0 ? `S${x.s}` : `S${x.s}.c${x.c}`}${x.protected ? " [locked]" : ""}: ${x.text.trim()}`).join("\n")}`).join("\n\n");
    let j: any = { cards: [] };
    for (let attempt = 0; attempt < 2 && !j.cards.length; attempt++) {
      try {
        const msg = await client.messages.create({ model: "claude-opus-5-5", max_tokens: 4000, system: PROMPT(variant), messages: [{ role: "user", content: cardsText }] });
        const text = msg.content.filter((x: any) => x.type === "text").map((x: any) => x.text).join("\n");
        const m = text.match(/\{[\s\S]*\}/); if (m) j = JSON.parse(m[0]);
      } catch (e: any) { console.error(`[spoilercut] ${c.id}: ${e?.message || e}`); }
    }
    const out = angles.map((a: any, i: number) => {
      const d = (j.cards || []).find((x: any) => Number(x.i) === i) || {};
      const hook = applyCuts(segs[i], Array.isArray(d.cuts) ? d.cuts : []);
      const okHook = hook.split(/\s+/).length >= 8 ? hook : a.hookPremise;
      const title = d.titleSpoils ? titleCut(String(a.titleSuggestion)) : a.titleSuggestion;
      log.push({ id: c.id, i, payoffType: d.payoffType, heldBack: d.heldBack, inference: d.viewerInference, cuts: d.cuts, titleSpoils: !!d.titleSpoils, titleChanged: title !== a.titleSuggestion, was: a.hookPremise, now: okHook });
      return { ...a, hookPremise: okHook, titleSuggestion: title };
    });
    fs.writeFileSync(path.join(dir, `${label}__${c.id}.json`), JSON.stringify({ ...src, label, angles: out }, null, 1));
  }));
  fs.writeFileSync(path.join(dir, `${label}-cuts.json`), JSON.stringify(log, null, 1));
  const changed = log.filter((x) => x.was !== x.now).length;
  console.log(`[spoilercut] ${label}: ${changed}/${log.length} hooks cut, ${log.filter((x) => x.titleSpoils).length} titles spoil (${log.filter((x) => x.titleChanged).length} trimmed)`);
})();
