// STORY SPINES + CARD REPAIR — so every angle card is a safe, strong pick.
//
// Why: across live runs (Jones, LeFevre) usually only one of five cards was worth choosing. Cards were
// written hook-type-first ("write a Controversy angle"), so the model bent facts to fit the frame
// ("Faked His Death to Escape the Mob"); flagged cards were still shown, which is a trap for a creator
// who doesn't know the case; and some cards were true but thin (a Goodenough-only angle with ~5 facts
// behind a 12-minute video). Now: (1) find the story's complete arcs in the research first, each with
// the facts that carry it, (2) every card tells one of those arcs, (3) flagged cards are repaired or
// dropped before the creator sees them.
import Anthropic from "@anthropic-ai/sdk";
import { groundedInFacts } from "@/lib/script-compliance";

const MODEL = "claude-sonnet-4-6";
// Hard cap per call (the card route has 240s in total; seen: 497s through SDK retries on a slow call).
function client(): Anthropic { return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder", timeout: 50_000, maxRetries: 1 }); }

// HOOK OPPORTUNITY (per spine, found before any card is written): the question this arc makes a viewer
// need answered, the single most surprising concrete fact the hook should carry, and the answer the
// title and hook must hold back. Seen in the hook benchmark: half the cards gave away their own ending
// and the strongest number sat in the research instead of the hook.
export type StorySpine = { name: string; arc: string; opening: string; payoff: string; factIdx: number[]; depth: number; question?: string; hookFact?: string; withhold?: string;
  // REVEAL ORDER (decided before any card is written; benchmark showed half the hooks spent the payoff, and
  // telling the writer "don't give it away" either failed or pushed it to invent). The spine names the ONE
  // fact its payoff reveals, the facts the hook is built from (none of which state the reveal), what may be
  // said up front, and the hook's mechanism.
  mechanism?: string; payoffType?: string; premise?: string; revealText?: string; hookFactsText?: string[] };

function jsonFrom(text: string, kind: "array" | "object"): any | null {
  const m = text.match(kind === "array" ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// Validate the spine's reveal order against the real fact list: indices in range, the reveal never among
// the hook facts. Texts are carried (not indices) so the card writer and the code checks see the facts.
function revealOrder(s: any, facts: string[], n: number) {
  const ri = Number(s?.revealIdx);
  const reveal = Number.isInteger(ri) && ri >= 0 && ri < n ? ri : null;
  const hook = (Array.isArray(s?.hookIdx) ? s.hookIdx : []).map(Number).filter((k: number) => Number.isInteger(k) && k >= 0 && k < n && k !== reveal).slice(0, 3);
  const clip = (t: string) => String(t).replace(/\s*\(source: [^)]*\)\s*$/, "").slice(0, 260);
  return {
    mechanism: String(s?.mechanism || "").slice(0, 60) || undefined,
    payoffType: String(s?.payoffType || "").toUpperCase().slice(0, 20) || undefined,
    premise: String(s?.premise || "").slice(0, 160) || undefined,
    revealText: reveal !== null ? clip(facts[reveal]) : undefined,
    hookFactsText: hook.length ? hook.map((k: number) => clip(facts[k])) : undefined,
  };
}

// The complete, fact-backed arcs this research can carry. Depth = how many facts the arc can use.
export async function findStorySpines(facts: string[], topic: string, kind: string = "event"): Promise<StorySpine[]> {
  if (facts.length < 8) return [];
  const numbered = facts.slice(0, 120).map((f, i) => `${i}. ${f}`).join("\n");
  try {
    const msg = await client().messages.create({
      model: MODEL, max_tokens: 3500, temperature: 0.2,
      messages: [{ role: "user", content: `These are the researched facts for a documentary YouTube video about "${topic.slice(0, 120)}".

Find 3 to 5 STORY SPINES: complete arcs a full-length video could be built on, each a different way into the same case (which moment it opens on, what question drives it, where it pays off). A spine must be carried by the facts, not by invention. Prefer arcs that use MANY facts end to end (the whole story told through one lens) over a narrow slice (one side character's ordeal alone). Every spine must still cover the case's key events in some order.

For each spine return:
- "name": 3-6 words
- "arc": one sentence, at most 30 words: the opening moment, the driving question, the payoff
- "opening": the documented moment it opens on, at most 12 words
- "payoff": the documented ending it lands on, at most 12 words
- "factIdx": the indices of EVERY fact this spine can use
- "question": the one question a viewer would NEED answered after hearing this spine's opening (a specific gap, not a topic), at most 20 words
- "hookFact": the single most surprising concrete detail for this spine's hook, a number, contrast, object, or moment, copied as closely as possible from ONE fact. Prefer a hard figure or a contradiction (two true things that shouldn't both be true). It must NOT be the payoff itself.
- "withhold": the answer the title and hook must NOT give away (how it ended, how they were caught, the explanation), at most 15 words
- "payoffType": what this spine's payoff reveals: OUTCOME, METHOD, IDENTITY, LOCATION, CULPRIT, EXPLANATION, CONSEQUENCE, or STATUS
- "revealIdx": the index of the ONE fact that IS the payoff reveal, the answer the video saves for the end
- "premise": what the viewer may be told up front without spoiling anything, at most 15 words (in an unsolved case "she has never been found" is premise; the payoff is how or why)
- "hookIdx": 1 to 3 fact indices the hook is built from: facts that come BEFORE the reveal and do not state it, chosen for the strongest contradiction, number, or moment. Never the revealIdx.
- "mechanism": the hook's engine in 2-5 words, e.g. "identity transformation", "reversal", "the moment it backfired", "two true things that clash", "the number that shouldn't exist", "near miss", "expectation vs reality", "unsolved absence"
${kind !== "event" ? `
THIS IS AN EXPLAINER, NOT A CASE: its spines are ways in, not plots. Look for (a) EXPECTATION vs REALITY: what most viewers would assume, the fact that contradicts it, and the explanation held back as the reveal; (b) THE MOMENT: one documented decision, quote, launch, or announcement that backfired or exposed the problem (a single moment beats a list of statistics); (c) THE NUMBER that shouldn't exist. For an explainer the reveal is usually the explanation or mechanism, so the hook shows the contradiction and holds back the why.
` : ""}
FACTS:
${numbered}

Output ONLY a JSON array: [{"name":"...","arc":"...","opening":"...","payoff":"...","factIdx":[0,3,4],"question":"...","hookFact":"...","withhold":"...","payoffType":"METHOD","revealIdx":12,"premise":"...","hookIdx":[2,5],"mechanism":"..."}]` }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const arr = jsonFrom(text, "array");
    if (!Array.isArray(arr)) return [];
    const n = Math.min(facts.length, 120);
    return arr.map((s: any) => {
      const idx: number[] = Array.isArray(s?.factIdx) ? [...new Set<number>(s.factIdx.map(Number).filter((k: number) => Number.isInteger(k) && k >= 0 && k < n))] : [];
      // A hook fact the research doesn't carry is dropped, never passed on to the card writer.
      const hookFact = String(s?.hookFact || "").slice(0, 220);
      return { name: String(s?.name || "").slice(0, 60), arc: String(s?.arc || "").slice(0, 300), opening: String(s?.opening || "").slice(0, 200), payoff: String(s?.payoff || "").slice(0, 200), factIdx: idx, depth: idx.length,
        question: String(s?.question || "").slice(0, 200) || undefined, hookFact: hookFact && groundedInFacts(hookFact, facts.join("\n")) ? hookFact : undefined, withhold: String(s?.withhold || "").slice(0, 160) || undefined,
        ...revealOrder(s, facts, n) };
    }).filter((s: StorySpine) => s.name && s.arc && s.depth > 0).sort((a: StorySpine, b: StorySpine) => b.depth - a.depth);
  } catch (e: any) {
    console.error("[angles] spines failed:", e?.message || e);
    return [];
  }
}

// Fix only the flagged wording on each card, keeping its hook type and punch. Cards that come back
// unchanged or broken are left as they were (and later dropped if still flagged).
export async function repairAngles(cards: { hookType: string; hookPremise: string; titleSuggestion: string; whyItWorks?: string; payoffMoment?: string; middleBeats?: string[]; viewerQuestion?: string; hookFact?: string; reveal?: string }[], warnings: string[][], sourceText: string): Promise<{ hookPremise: string; titleSuggestion: string; whyItWorks?: string; payoffMoment?: string; middleBeats?: string[]; viewerQuestion?: string }[]> {
  const allTodo = cards.map((c, i) => ({ c, i, w: warnings[i] || [] })).filter((x) => x.w.length);
  const out = cards.map((c) => ({ hookPremise: c.hookPremise, titleSuggestion: c.titleSuggestion, whyItWorks: c.whyItWorks, payoffMoment: c.payoffMoment, middleBeats: c.middleBeats, viewerQuestion: c.viewerQuestion }));
  if (!allTodo.length) return out;
  // Batches of 4 in parallel: one call for 8 cards with long problem lists ran past its token limit and
  // came back unparseable, so NO card was repaired and flagged cards were shown (seen in the benchmark).
  const batches: typeof allTodo[] = [];
  for (let k = 0; k < allTodo.length; k += 4) batches.push(allTodo.slice(k, k + 4));
  await Promise.all(batches.map((todo) => repairBatch(todo, sourceText, out)));
  return out;
}

async function repairBatch(todo: { c: any; i: number; w: string[] }[], sourceText: string, out: { hookPremise: string; titleSuggestion: string; whyItWorks?: string; payoffMoment?: string; middleBeats?: string[]; viewerQuestion?: string }[]): Promise<void> {
  try {
    const msg = await client().messages.create({
      model: MODEL, max_tokens: 6000, temperature: 0.2,
      messages: [{ role: "user", content: `Each YouTube angle card below has wording that conflicts with, or isn't supported by, the research. Fix ONLY the flagged wording so the card is accurate, using the research's own facts, and keep the card's hook type, structure, energy, and length. Prefer replacing a wrong specific with the right one ("a 73-year-old man" -> "a man"; "32 years in Las Vegas" -> "32 years under another name") over deleting the hook's pull. When two figures must be kept apart, say what each measured in natural words ("he hid $20 to $23 million in losses; prosecutors put the total at more than $70 million"), never "Separately," and never mention the research or sourcing. Titles: one idea, at most 55 characters, one sentence, naming the main event in plain words (faked death, Ponzi scheme, bank fraud), using words no other card's title uses. Never add a specific the research doesn't give. A person who was a minor at the time is named by relationship ("his daughter"), never by name. An absolute like "vanished forever" becomes "vanished". When a problem is about the hook's craft (gives away the ending, a vague stand-in, a missing hook fact), rewrite the hook or title so it opens the viewer question without answering it and carries the concrete fact, using only the research. The subject's own claims get attributed ("by his own account"). No em dashes.

RESEARCH:
"""
${sourceText.slice(0, 30000)}
"""

CARDS TO FIX:
${todo.map((x) => `[${x.i}] HOOK TYPE: ${x.c.hookType}\nHOOK: ${x.c.hookPremise}\nTITLE: ${x.c.titleSuggestion}\nPAYOFF MOMENT: ${x.c.payoffMoment || ""}\nMIDDLE BEATS: ${(x.c.middleBeats || []).join(" | ")}${x.c.viewerQuestion ? `\nVIEWER QUESTION (the hook opens it, never answers it): ${x.c.viewerQuestion}` : ""}${x.c.hookFact ? `\nHOOK FACT (the concrete detail the hook carries): ${x.c.hookFact}` : ""}${x.c.reveal ? `\nPAYOFF REVEAL (never in the title or hook; to fix a give-away, REMOVE it, don't replace it with a new claim): ${x.c.reveal}` : ""}\nPROBLEMS:\n${x.w.map((w) => `- ${w}`).join("\n")}`).join("\n\n")}

Fix the PAYOFF too when a problem is in it (it steers the script, so it may not promise an event the research doesn't have). The PAYOFF must stay what it is: one sentence on what the video must deliver and where the payoff lands, and it must describe the card AS REPAIRED (if you moved the hook off his daughter, the payoff can't still say the daughter's memory opens the video). NEVER describe your edits in it; put that in "change". The PAYOFF MOMENT and MIDDLE BEATS must each be a specific moment or finding from the research, at most 15 words; replace any that isn't. Output ONLY a JSON array: [{"i":0,"hookPremise":"...","titleSuggestion":"...","payoffMoment":"...","middleBeats":["...","..."],"viewerQuestion":"...","change":"what you fixed, one short line"}]. When a problem is about the "Viewer asks" question, rewrite "viewerQuestion" so it is the question this payoff answers, with the hook's own figures (at most 20 words)` }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    let arr = jsonFrom(text, "array");
    // Salvage a cut-off reply: keep every complete card.
    if (!Array.isArray(arr)) { const t = text.slice(Math.max(0, text.indexOf("["))); const last = t.lastIndexOf("}"); try { arr = last > 0 ? JSON.parse(t.slice(0, last + 1) + "]") : null; } catch { arr = null; } }
    if (!Array.isArray(arr)) console.error(`[angles] repair reply unparseable (stop=${msg.stop_reason}, ${text.length} chars)`);
    if (Array.isArray(arr)) for (const r of arr) {
      const i = Number(r?.i);
      if (!Number.isInteger(i) || !out[i]) continue;
      const hp = typeof r?.hookPremise === "string" ? r.hookPremise.trim() : "";
      const ts = typeof r?.titleSuggestion === "string" ? r.titleSuggestion.trim() : "";
      if (hp.length >= 20) out[i].hookPremise = hp;
      if (ts.length >= 10) out[i].titleSuggestion = ts;
      if (typeof r?.payoffMoment === "string" && r.payoffMoment.trim().length >= 6) out[i].payoffMoment = r.payoffMoment.trim();
      if (typeof r?.viewerQuestion === "string" && r.viewerQuestion.trim().length >= 10) out[i].viewerQuestion = r.viewerQuestion.trim().slice(0, 200);
      if (Array.isArray(r?.middleBeats) && r.middleBeats.length) out[i].middleBeats = r.middleBeats.map((b: any) => String(b || "").trim()).filter(Boolean).slice(0, 3);
      const wy = typeof r?.whyItWorks === "string" ? r.whyItWorks.trim() : "";
      // A payoff that talks about the edit ("replaces 'pastor' in the title...") is a leak, not a payoff.
      if (wy.length >= 20 && !/\b(replac\w*|removes?|removed|rewrit\w*|swapp?\w*|changed|instead of|rather than on|first sentence|keeps? the family|family member out|preserv\w+ the|the (?:hook|title|card)(?:['’]s)?|kept distinct|keeping the .{0,40}distinct|the two figures|the research(?:['’]s)?|sourcing)\b/i.test(wy)) out[i].whyItWorks = wy;
    }
  } catch (e: any) {
    console.error("[angles] repair failed:", e?.message || e);
  }
}

// Pick what the creator sees: only clean cards, the deepest spines first, one card per hook type,
// nothing thin. Falls back to flagged cards (warnings shown) only when fewer than 3 are clean.
export function selectAngles<T extends { hookType: string; warnings: string[]; factCount?: number; spineName?: string }>(cards: T[], opts: { max: number; allowRepeatTypes: boolean; topHookType?: string | null }): T[] {
  const deepest = Math.max(0, ...cards.map((c) => c.factCount || 0));
  const thinCut = deepest ? Math.max(6, Math.round(deepest * 0.4)) : 0;
  const score = (c: T) => (c.factCount || 0) + (opts.topHookType && c.hookType.toUpperCase().includes(opts.topHookType.toUpperCase()) ? deepest * 0.15 : 0);
  const pool = (list: T[]) => [...list].sort((a, b) => score(b) - score(a));
  const picked: T[] = [];
  const seen = new Set<string>();
  const seenSpines = new Set<string>();
  // freshSpine: a different STORY per card first (seen live: five cards, four of them the same
  // confession arc); repeats only fill what's left.
  const take = (list: T[], freshSpine = false) => {
    for (const c of pool(list)) {
      if (picked.length >= opts.max) break;
      const t = c.hookType.toUpperCase();
      if (!opts.allowRepeatTypes && seen.has(t)) continue;
      if (picked.includes(c)) continue;
      if (freshSpine && c.spineName && seenSpines.has(c.spineName)) continue;
      picked.push(c); seen.add(t); if (c.spineName) seenSpines.add(c.spineName);
    }
  };
  const clean = cards.filter((c) => !c.warnings.length);
  const deep = clean.filter((c) => !thinCut || (c.factCount || 0) >= thinCut);
  take(deep, true);
  take(deep);
  if (picked.length < 3) take(clean); // thin but clean beats flagged
  // Last resort, warnings shown: top up to 3, never to the full 5 (seen: 3 of 5 cards flagged on screen).
  if (picked.length < 3) { const keep = opts.max; opts.max = 3; take(cards.filter((c) => c.warnings.length)); opts.max = keep; }
  return picked;
}
