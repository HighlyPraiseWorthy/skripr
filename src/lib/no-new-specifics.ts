// NO-NEW-CHECKABLE-PROPOSITION INVARIANT (Evidence Integrity step 3, 2026-10-07; OFF unless a caller opts in).
// Every rewrite pass (refine, refill, certainty, self-review, final check) may change PRESENTATION, but may not
// introduce a checkable factual proposition that is not supported by that pass's allowed evidence (the text it was
// given, plus the research when the pass is allowed to use research). The baseline map showed passes after the
// writer creating errors (final check alone: 10 in Experiment A).
//
// Deliberately NOT an AI judge: a plain before/after diff, so it can't overblock what the writer already wrote and
// can't invent a repair. Detected additions:
//   - numbers, amounts, percentages, years, month-day dates; names, places, institutions, titles, works (phrase-level)
//   - quoted words not present in the input or evidence
//   - a NEW cause/effect, comparison/superlative, or attribution ("because...", "the largest...", "told reporters...")
//     whose content is not in the input or evidence
// Not detected (documented limit): an unnamed concrete scene detail ("a bracelet on the nightstand") with no name
// or number in it; that is the evidence-first writer's job (step 4).
//
// Repair is deterministic: a changed sentence that adds a violation goes back to its pre-pass version (that
// sentence's other edits are lost, the rest of the pass is kept); a brand-new sentence loses the offending clause
// when it is cleanly delimited, otherwise the sentence is dropped. Nothing is ever rewritten by a model here.
import { indexResearch, unsupportedSpecifics, splitSentences, setContext, fold } from "@/lib/evidence-gate";

export interface InvariantViolation { pass: string; sentence: string; added: string[]; action: "reverted" | "clause_cut" | "dropped"; result?: string }

const norm = (t: string) => fold(String(t || "")).toLowerCase().replace(/[‘’“”"']/g, "").replace(/[^a-z0-9$%.]+/g, " ").replace(/\s+/g, " ").trim();
// Content words, with sentence periods stripped ("history." == "history") but decimals kept ("12.8").
const content = (t: string) => norm(t).replace(/\.(?!\d)/g, " ").split(/\s+/).filter((w) => w.length >= 4 || /\d/.test(w));
const jaccard = (a: string[], b: string[]) => { const A = new Set(a), B = new Set(b); const i = [...A].filter((x) => B.has(x)).length; return i / Math.max(1, new Set([...a, ...b]).size); };
// How much of the pre-pass sentence survives inside the new one (a pass that APPENDS a clause keeps it aligned).
const contained = (before: string[], after: string[]) => { if (!before.length) return 0; const A = new Set(after); return before.filter((w) => A.has(w)).length / before.length; };

const CUES: { kind: string; re: RegExp }[] = [
  { kind: "cause", re: /\b(because|caused|causing|led to|leading to|resulted in|as a result|due to|thanks to|which meant|so that|in order to|forced)\b/i },
  { kind: "comparison", re: /\b(more than|less than|fewer than|twice|triple|largest|biggest|smallest|highest|lowest|longest|shortest|oldest|youngest|deadliest|richest|greatest|worst|best|first|only|last|most|least|record|ever|never before)\b/i },
  { kind: "attribution", re: /\b(said|says|told|according to|admitted|testified|claimed|wrote|announced|confirmed|denied|reported|testimony)\b/i },
];

// What the sentence adds that neither the pass input nor the allowed evidence supports.
function additions(after: string, aligned: string | null, idx: ReturnType<typeof indexResearch>, allowedText: string): string[] {
  const added = unsupportedSpecifics(after, idx);
  for (const m of after.matchAll(/["“]([^"”]{3,200})["”]/g)) if (m[1].split(/\s+/).length >= 3 && !allowedText.includes(norm(m[1]))) added.push(`quote: "${m[1].slice(0, 60)}"`);
  const allowedWords = new Set(content(allowedText));
  for (const cue of CUES) {
    const m = after.match(cue.re);
    if (!m || (aligned && cue.re.test(aligned))) continue; // cue already there before the pass
    // The proposition the cue introduces: the whole clause that contains it.
    const at = after.indexOf(m[0]);
    const start = Math.max(...[",", ";", ":", "—", "–", "."].map((d) => after.lastIndexOf(d, at))) + 1;
    const clause = after.slice(start).split(/[,;:.!?—–]/)[0];
    const words = content(clause).filter((w) => !cue.re.test(w));
    if (words.length >= 2 && words.filter((w) => allowedWords.has(w)).length / words.length < 0.7) added.push(`${cue.kind}: "${clause.trim().slice(0, 80)}"`);
  }
  return [...new Set(added)];
}

export function guardRewrite(before: string, after: string, opts: { pass: string; evidence?: string; log?: InvariantViolation[]; quiet?: boolean }): string {
  if (!after || after === before) { if (!opts.quiet) console.log(`[no-new-specifics] ${opts.pass}: no change`); return after; }
  let changed = 0; const startLog = opts.log ? opts.log.length : 0; const localLog: InvariantViolation[] = opts.log || [];
  const allowed = `${before}\n${opts.evidence || ""}`;
  const idx = indexResearch(allowed);
  const allowedText = norm(allowed);
  setContext(after);
  const beforeSents = before.split(/\n\n+/).flatMap((p) => splitSentences(p)).map((s) => s.trim());
  const beforeSet = new Set(beforeSents.map(norm));
  const out = after.split(/\n\n+/).map((para) => splitSentences(para).map((raw) => {
    const s = raw.trim();
    if (!s || beforeSet.has(norm(s))) return s; // unchanged sentence: never touched
    changed++;
    const cw = content(s);
    let aligned: string | null = null, best = 0;
    for (const b of beforeSents) { const bw = content(b); const j = Math.max(jaccard(cw, bw), contained(bw, cw) >= 0.8 ? 0.8 : 0); if (j > best) { best = j; aligned = b; } }
    if (best < 0.5) aligned = null;
    const added = additions(s, aligned, idx, allowedText);
    if (!added.length) return s;
    if (aligned) { localLog.push({ pass: opts.pass, sentence: s, added, action: "reverted", result: aligned }); return aligned; }
    // New sentence: cut a cleanly delimited clause that carries every addition, else drop the sentence.
    const parts = s.split(/(\s*[,;]\s+|\s+[—–]\s+|\s*\([^)]*\)\s*)/);
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k]; if (!p || /^\s*[,;—–]\s*$/.test(p)) continue;
      const rest = (parts.slice(0, k).join("") + parts.slice(k + 1).join("")).replace(/\s*[,;—–]\s*$/, "").replace(/^\s*[,;—–]\s*/, "").trim();
      if (rest.split(/\s+/).length >= 5 && k > 0 && !additions(rest, null, idx, allowedText).length) {
        const fixed = /[.!?]["”’)]*$/.test(rest) ? rest : `${rest}.`;
        localLog.push({ pass: opts.pass, sentence: s, added, action: "clause_cut", result: fixed }); return fixed;
      }
    }
    localLog.push({ pass: opts.pass, sentence: s, added, action: "dropped" }); return "";
  }).filter(Boolean).join(" ")).filter((p) => p.trim()).join("\n\n");
  if (!opts.quiet) console.log(`[no-new-specifics] ${opts.pass}: changed sentences checked=${changed} reverted/cut=${localLog.length - startLog}`);
  return out;
}
