// accuracy_judge_v1: FROZEN evaluator for Evidence Integrity (2026-10-07). Change anything here = new version.
// Evidence-gated: every flagged claim must quote the script's exact words; contradiction and inflation claims
// must also quote the exact research sentence they rest on. Code verifies both quotes exist (whitespace, quote
// and case-insensitive); a claim whose evidence can't be found is excluded from the metric. The judge also
// separates factual errors from defensible style/interpretation, which never count.
// Research is passed IN FULL (the old judge read only the first 20,000 characters and flagged facts it couldn't see).
import Anthropic from "@anthropic-ai/sdk";
import { splitSentences } from "../../src/lib/script-compliance";

export const ACCURACY_JUDGE_VERSION = "accuracy_judge_v1";
export const CATEGORIES = ["unsupported_specificity", "unsupported_attribution", "evidence_inflation", "causal_inflation", "certainty_inflation", "contradiction"] as const;
const NEEDS_RESEARCH_QUOTE = new Set(["evidence_inflation", "causal_inflation", "certainty_inflation", "contradiction"]);

const SYSTEM = `You are a strict documentary fact-checker. Audit numbered script sentences against the RESEARCH they were written from. Use ONLY the research, never your own knowledge.

Flag a sentence only for one of these FACTUAL problems:
- unsupported_specificity: a number, percentage, amount, date, age, duration, count, named study, named source, organization, person, or place that the research does not give.
- unsupported_attribution: a real person's or group's thought, feeling, belief, knowledge, intent, or motive that the research does not state ("he knew", "the family was waiting for", "she hoped").
- evidence_inflation: the research says X happened; the script says X proved or showed Y.
- causal_inflation: the research gives A and B; the script says A caused B, or B happened because of A, without the research saying so.
- certainty_inflation: the research hedges or attributes (alleged, suspected, according to, estimated); the script states it as plain fact.
- contradiction: the script conflicts with a research sentence.

Do NOT flag: style, rhetoric, framing, or interpretation a careful reader would see as the narrator's view and that doesn't state a new fact; correct paraphrase; arithmetic the research supports (1975 to 2015 = 40 years). When unsure, mark it "style".

For each flagged sentence give: "i" (sentence number), "script_quote" (the exact problem words copied from that sentence, 3-20 words), "category", "verdict" ("error" or "style"), "research_quote" (REQUIRED for evidence_inflation, causal_inflation, certainty_inflation and contradiction: the shortest exact span of the research it rests on, copied character for character; omit for the others), "why" (one line).
Output ONLY JSON: {"issues":[{"i":3,"script_quote":"...","category":"...","verdict":"error","research_quote":"...","why":"..."}]}`;

const norm = (t: string) => String(t || "").toLowerCase().replace(/[‘’“”"']/g, "").replace(/[^a-z0-9$%.]+/g, " ").replace(/\s+/g, " ").trim();
export interface JudgedIssue { i: number; sentence: string; script_quote: string; category: string; verdict: string; research_quote?: string; why: string }

export async function judgeAccuracyV1(body: string, research: string, opts: { model?: string } = {}): Promise<{ version: string; sentences: number; errors: JudgedIssue[]; style: JudgedIssue[]; rejected: number }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "", timeout: 180_000, maxRetries: 1 });
  const sents = body.split(/\n\n+/).flatMap((p) => splitSentences(p));
  const WIN = 40; const windows: number[][] = [];
  for (let a = 0; a < sents.length; a += WIN) windows.push(Array.from({ length: Math.min(WIN, sents.length - a) }, (_, k) => a + k));
  const researchN = norm(research);
  const raw = (await Promise.all(windows.map(async (idxs) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const m = await client.messages.create({ model: opts.model || "claude-sonnet-4-6", max_tokens: 6000, temperature: 0, system: SYSTEM,
          messages: [{ role: "user", content: `RESEARCH:\n"""\n${research}\n"""\n\nSCRIPT SENTENCES:\n${idxs.map((i) => `${i}. ${sents[i]}`).join("\n")}` }] });
        const t = m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
        const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
        return Array.isArray(j?.issues) ? j.issues : [];
      } catch { /* retry once */ }
    }
    return [];
  }))).flat();
  let rejected = 0;
  const valid: JudgedIssue[] = [];
  for (const x of raw) {
    const i = Number(x?.i); const s = sents[i];
    const cat = String(x?.category || ""), sq = String(x?.script_quote || ""), rq = x?.research_quote ? String(x.research_quote) : "";
    const ok = s && CATEGORIES.includes(cat as any) && sq.length >= 3 && norm(s).includes(norm(sq))
      && (!NEEDS_RESEARCH_QUOTE.has(cat) || (rq.length >= 8 && researchN.includes(norm(rq))));
    if (!ok) { rejected++; continue; }
    valid.push({ i, sentence: s, script_quote: sq, category: cat, verdict: x.verdict === "style" ? "style" : "error", research_quote: rq || undefined, why: String(x?.why || "").slice(0, 300) });
  }
  return { version: ACCURACY_JUDGE_VERSION, sentences: sents.length, errors: valid.filter((v) => v.verdict === "error"), style: valid.filter((v) => v.verdict === "style"), rejected };
}
