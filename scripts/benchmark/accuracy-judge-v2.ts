// accuracy_judge_v2 (2026-10-07, DRAFT until validated on the claim-alignment gold set). Replaces v1, whose
// precision against hand labels was ~42% (it flagged rounding, research arithmetic and conflicting-source figures,
// and missed outside facts). Research is given as NUMBERED facts so every verdict cites evidence; code verifies the
// citations. A claim is an error only if it is not supported by the research under the explicit rules below.
import Anthropic from "@anthropic-ai/sdk";
import { splitSentences } from "../../src/lib/script-compliance";

export const ACCURACY_JUDGE_V2 = "accuracy_judge_v2";
export const STATUSES = ["supported", "derived", "unsupported", "misattached", "overinterpretation", "contradiction"] as const;
export const ERROR_STATUSES = new Set(["unsupported", "misattached", "overinterpretation", "contradiction"]);

const SYSTEM = `You fact-check documentary script sentences against numbered RESEARCH facts. The research is the CLOSED universe: a claim is supported only if the research supports it. Your own knowledge never supports a claim, even when it is true.

For each sentence, list every CHECKABLE claim: a statement about the real world that could be verified (who, what, when, where, how many, how much, what someone said or did, a status, a mechanism, a cause, a comparison, a superlative, a reference to a film, book, person or event).
SPLIT sentences into separate claims: a sentence that mixes a supported part with an added detail has TWO claims, and the added detail must be listed on its own. In particular list SEPARATELY every named film, book, show, person, place, institution, law or country arrangement, every superlative or "first/only/ever", every title or role, and every physical scene detail (what was on a table, in a room, sitting somewhere) or mechanism of how something worked. Each must map to a research fact or it is unsupported.
Do NOT list narration: the narrator's framing, rhetorical questions, emotional color, transitions, or references back to a scene the research describes.

Give each claim a status:
- supported: a research fact states it (paraphrase is fine).
- derived: it follows directly from research facts: rounding (77.4% -> 77%, $11.99 -> about twelve dollars), arithmetic on research dates or amounts (1959 to 2015 = 56 years; $11.99 - $5.39), a spelled-out number, a less specific version of a research fact, or a surname for a named person.
- unsupported: the research does not contain it (including true outside facts, film or pop-culture references, superlatives like "largest ever", added details, places, titles, or mechanisms).
- misattached: the research has the entity or number, but attached to a different event, person, place, time or population (e.g. a figure for "non-manager wages" presented as wages "in fast food"; a defendant "sentenced in Brooklyn" when Brooklyn appears only as where an indictment was filed).
- overinterpretation: the research says X and the script states something stronger or different (correlation stated as cause, "registered to vote" stated as "voted", one study stated as industry-wide).
- contradiction: the script conflicts with EVERY research fact on the point.

CONFLICTING SOURCES: if research facts disagree (e.g. one says 26%, another 19.8%; one says three years of probation, another five), a script that matches ANY of them is supported. That is never a contradiction.

For each claim output: "i" (sentence number), "claim" (exact words from the sentence, 3-20 words), "status", "facts" (array of fact ids like "F12" that support it or that it is misattached from / conflicts with; empty for unsupported), "material" (true if a viewer would come away misinformed about the case; false for trivial or harmless details), "why" (one short line).
List supported and derived claims too, so the evidence is visible.
Output ONLY JSON: {"claims":[{"i":0,"claim":"...","status":"supported","facts":["F3"],"material":false,"why":"..."}]}`;

const norm = (t: string) => String(t || "").toLowerCase().replace(/[‘’“”"']/g, "").replace(/[^a-z0-9$%.]+/g, " ").replace(/\s+/g, " ").trim();
// A claim is "real script words" when at least 70% of its content words occur in that sentence (split claims are
// lightly reworded, e.g. "Meriwether brought this to Greenwich"); this still rejects claims invented by the judge.
const content = (t: string) => norm(t).split(" ").filter((w) => w.length >= 4 || /\d/.test(w));
const inSentence = (claim: string, s: string) => { const c = content(claim); if (!c.length) return norm(s).includes(norm(claim)); const S = new Set(content(s)); return c.filter((w) => S.has(w)).length / c.length >= 0.7; };
export interface V2Claim { i: number; sentence: string; claim: string; status: string; facts: string[]; material: boolean; why: string }

export async function judgeAccuracyV2(input: string | string[], facts: { fact: string; source?: string }[], opts: { model?: string } = {}) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "", timeout: 240_000, maxRetries: 1 });
  const sents = Array.isArray(input) ? input : input.split(/\n\n+/).flatMap((p) => splitSentences(p));
  const research = facts.map((f, k) => `F${k}: ${f.fact}`).join("\n");
  const WIN = 40; const windows: number[][] = [];
  for (let a = 0; a < sents.length; a += WIN) windows.push(Array.from({ length: Math.min(WIN, sents.length - a) }, (_, k) => a + k));
  const model = opts.model || "claude-sonnet-4-6";
  const raw = (await Promise.all(windows.map(async (idxs) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const m = await client.messages.create({ model, max_tokens: model.includes("opus") ? 32000 : 16000, ...(model.includes("opus") ? {} : { temperature: 0 }), system: SYSTEM,
          messages: [{ role: "user", content: `RESEARCH FACTS:\n${research}\n\nSCRIPT SENTENCES:\n${idxs.map((i) => `${i}. ${sents[i]}`).join("\n")}` }] });
        const t = m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
        const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
        return Array.isArray(j?.claims) ? j.claims : [];
      } catch { /* retry once */ }
    }
    return null; // window failed: reported, never silently scored as clean
  })));
  const failedWindows = raw.filter((r) => r === null).length;
  let rejected = 0; const claims: V2Claim[] = [];
  for (const x of raw.flat().filter(Boolean)) {
    const i = Number(x?.i); const s = sents[i]; const st = String(x?.status || "");
    const ids = (Array.isArray(x?.facts) ? x.facts : []).map(String).filter((id: string) => /^F\d+$/.test(id) && Number(id.slice(1)) < facts.length);
    // Evidence gate: the claim must be real script words; supported/derived/misattached/contradiction must cite a real fact.
    const ok = s && (STATUSES as readonly string[]).includes(st) && String(x?.claim || "").length >= 3 && inSentence(String(x.claim), s)
      && (st === "unsupported" || st === "overinterpretation" || ids.length > 0);
    if (!ok) { rejected++; if (process.env.JUDGE_DEBUG) console.log("[rejected]", JSON.stringify(x).slice(0, 300)); continue; }
    claims.push({ i, sentence: s, claim: String(x.claim), status: st, facts: ids, material: !!x.material, why: String(x?.why || "").slice(0, 300) });
  }
  return { version: ACCURACY_JUDGE_V2, model, sentences: sents.length, claims, errors: claims.filter((c) => ERROR_STATUSES.has(c.status)), rejected, failedWindows };
}
