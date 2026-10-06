// Self-review pass. After the script is written, a second, single-purpose Claude
// call re-reads it for ACCURACY and INTERNAL CONSISTENCY only, and returns a
// corrected version plus a list of what it changed. This is the reviewer step a
// careful human does by hand (heroin vs cocaine in the same script, age 21 stated
// under the year 1975, two different fugitive durations, FBI where it should be
// the Marshals), folded into the pipeline.
//
// Why a SEPARATE call and not a better generation prompt: generation juggles
// voice, retention, structure, length, and grounding all at once, and accuracy
// loses. A pass that does nothing but check facts and consistency, with no other
// job, catches what the writer misses. It is also strictly conservative: it makes
// the smallest edits that fix real errors and never rewrites for style, so the
// strong cold open and closer survive untouched.

import { Anthropic } from "@anthropic-ai/sdk";
import { splitSentences } from "@/lib/script-compliance";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return _client;
}

export interface SelfReviewResult {
  hook: string;
  body: string;
  changes: string[];
}

// Belt-and-suspenders over the corrector, same cleanup the generator output gets:
// no em dashes, no stray bracket markers.
function clean(s: string): string {
  return typeof s === "string"
    ? s.replace(/—/g, ", ").replace(/\s,\s/g, ", ")
        .replace(/\[\/?[A-Z][A-Z _-]*\]/g, "")
        .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, " ").trim()
    : s;
}

/**
 * Review and correct a finished script. Returns the corrected hook and body plus
 * a plain-English changelog. On any failure it returns the input unchanged with
 * no changes, so a review error can never block or damage a script.
 */
export async function reviewAndCorrectScript(input: {
  hook: string;
  body: string;
  title?: string;
  sourceMaterial?: string;
}): Promise<SelfReviewResult> {
  const hook = input.hook || "";
  const body = input.body || "";
  if (!body.trim() && !hook.trim()) return { hook, body, changes: [] };

  const hasFacts = !!(input.sourceMaterial && input.sourceMaterial.trim());
  // EDIT-BASED, never a full rewrite. This pass used to return the WHOLE script rewritten, after every
  // sentence-level check had run, so it could garble lines (seen live: two sentences mashed into one at
  // the ending) and undo earlier fixes. It now returns specific sentence edits, applied in place.
  const paras = body.split(/\n\n+/);
  const sentsByPara: string[][] = paras.map((p) => splitSentences(p));
  const bodyAll: { pi: number; si: number; text: string }[] = [];
  sentsByPara.forEach((ss, pi) => ss.forEach((text, si) => bodyAll.push({ pi, si, text })));
  const hookSents = splitSentences(hook);

  const factsBlock = hasFacts
    ? `APPROVED FACTS (the ONLY permitted source of specific claims):
"""
${input.sourceMaterial!.slice(0, 40000)}
"""

FIX, in this order:
1. UNSUPPORTED SPECIFICS. Any specific in the script, a date, number, dollar figure, name, place, agency, job title, sentence length, or stated motive, that the approved facts do not support. If the approved facts contain the correct value, change the script to match it. If they do not, make the claim qualitative ("in the early 1980s", "a large sum") or remove it. NEVER replace it with a different specific from your own memory.
2. INTERNAL CONTRADICTIONS. The same person's details (which drug they dealt, their age, hometown, role) and ALL dates and durations must agree across the whole script. If the script says both X and Y, keep the one the approved facts support and make the other match. Check the arithmetic: an escape date and a "N months later" recapture must actually be N months apart.
3. ENTITY DRIFT. If the script credits the wrong agency, organization, or person with an action (for example naming one agency for a manhunt another agency actually ran), correct it to the approved facts.
4. TIME-BOUND ATTRIBUTES. An age or "N-year-old" is only true at one point in the timeline. If the script states a LIVING person's age at, say, the hiring, do not let that same age be repeated at later events where it is no longer accurate. An age tied to a FIXED event stays true every time it is mentioned (a victim's age at death, an age at the crime): never remove it. Keep the age at the one moment it is correct (usually the opening) and replace later repetitions with a neutral reference ("the clerk", the person's name), never a different invented age.
5. OVER-HEDGING A DOCUMENTED FACT. If the approved facts state something plainly, do not let the script hedge it with "reportedly", "allegedly", or "supposedly". State it directly. (Only keep a hedge when the claim is genuinely not established by the facts.) And when the facts give a specific duration or figure, use it rather than a vaguer, smaller-sounding paraphrase ("about nineteen months", not "over a year").`
    : `You have NO external fact sheet for this script, so you cannot verify outside claims. Fix ONLY:
1. INTERNAL CONTRADICTIONS. The same person's details and all dates and durations must agree with each other across the script. If the script states two conflicting values, make them consistent and check the arithmetic.
2. TIME-BOUND ATTRIBUTES. An age or "N-year-old" is only true at one moment. If it is stated at an early event and then repeated at later events where it would no longer be accurate, keep it at the early moment and replace the later mentions with a neutral reference (the person's name or role), never a different invented age.
Do not change specifics you cannot confirm are wrong. When unsure, leave the text exactly as it is.`;

  const prompt = `You are a fact and consistency EDITOR for a YouTube script. Your only job is accuracy and internal consistency. You are NOT a rewriter.

RULES:
- Make the SMALLEST edits that fix real problems. Preserve the writing, voice, structure, paragraphing, and length everywhere else, word for word.
- Do NOT improve style, do NOT rephrase for flow, do NOT add new specifics or new sourced claims.
- Preserve the opening hook and the closing lines unless they contain an actual error.
- Keep the voice: no em dashes, no exclamation points, no emojis.
- "his son", "his daughter" in place of the name of someone who was a MINOR at the time is DELIBERATE (privacy). Never replace it with a name. Adults on the record (a spouse, a grown child) may be named.
- If the script is already accurate and consistent, return it unchanged with an empty changes list.

${factsBlock}

${input.title ? `TITLE: ${input.title}\n\n` : ""}HOOK SENTENCES (H-index. text):
${hookSents.map((x, i) => `H${i}. ${x}`).join("\n")}

BODY SENTENCES (index. text):
${bodyAll.map((x, i) => `${i}. ${x.text}`).join("\n")}

Output ONLY JSON, no prose, no markdown. Return ONLY the sentences you change, never the whole script:
{"edits":[{"i":"<index, or H0/H1 for the hook>","rewrite":"<the corrected sentence>","change":"one short plain-English line describing the fix"}]}`;

  try {
    const msg = await client().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { hook, body, changes: [] };
    const parsed = JSON.parse(m[0]);
    const edits = Array.isArray(parsed?.edits) ? parsed.edits.slice(0, 12) : [];
    const changes: string[] = [];
    const hookOut = [...hookSents];
    for (const e of edits) {
      const rw = typeof e?.rewrite === "string" ? clean(e.rewrite.trim()) : "";
      const key = String(e?.i ?? "");
      let orig = "";
      if (/^H\d+$/i.test(key)) { const hi = Number(key.slice(1)); if (hookOut[hi] === undefined) continue; orig = hookOut[hi]; if (!rw || rw === orig || rw.length > orig.length * 1.8) continue; hookOut[hi] = rw; }
      else { const bi = Number(key); const t = bodyAll[bi]; if (!Number.isInteger(bi) || !t || sentsByPara[t.pi][t.si] !== t.text) continue; orig = t.text; if (!rw || rw === orig || rw.length > orig.length * 1.8) continue; sentsByPara[t.pi][t.si] = rw; }
      if (typeof e?.change === "string" && e.change.trim()) changes.push(e.change.trim().slice(0, 200));
    }
    if (!changes.length) return { hook, body, changes: [] };
    const outBody = sentsByPara.map((ss) => ss.join(" ").trim()).filter(Boolean).join("\n\n");
    return { hook: hookOut.join(" ").trim() || hook, body: outBody, changes };
  } catch {
    return { hook, body, changes: [] };
  }
}
