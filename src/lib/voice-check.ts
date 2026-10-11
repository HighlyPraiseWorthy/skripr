// FINAL VOICE CHECK (Voice Match step 3, 2026-10-11). Runs AFTER every other pass (at the end of the final-check
// request, after self-review and the final check, which used to run after the voice pass and pull the voice back
// toward generic). Three parts:
//   1 SCORE    code measures the finished script against the creator: the fingerprint (sentence length, short
//              punches, "you" rate, contractions, questions) and the structured profile (avoided phrases), plus house
//              tics. 0-100, with a per-measure breakdown. This is the "voice match" score.
//   2 REWRITE  only if the score is under the threshold: one call rewrites ONLY the sentences that cause the drift.
//   3 GUARD    each rewritten sentence must keep every name, number and quote, add none (step 3 guard), keep quote
//              balance and attribution, add no pipeline words, and (when CTA is off) add no viewer ask. Then the
//              script is re-scored; if the score did not improve, every edit is reverted. Facts never move.
import { Anthropic } from "@anthropic-ai/sdk";
import { measureVoice, fingerprintToBrief, findHouseTics, type VoiceFingerprint } from "@/lib/voice-metrics";
import { renderVoiceStructure, type VoiceStructure } from "@/lib/voice-structure";
import { splitSentences, quoteBalanceKept, attributionMismatch, introducesUnsupportedName } from "@/lib/script-compliance";
import { guardRewrite } from "@/lib/no-new-specifics";
import { isCtaAsk } from "@/lib/cta-guard";

export const VOICE_REWRITE_THRESHOLD = 80;

export interface VoiceMeasure { name: string; target: number; actual: number; points: number; max: number; direction: "ok" | "high" | "low" }
export interface VoiceReport { score: number; measures: VoiceMeasure[]; avoidedHits: string[]; tics: string[] }

const lower = (t: string) => (t || "").toLowerCase().replace(/[’]/g, "'");
const hasPhrase = (text: string, phrase: string) => new RegExp(`(?<![a-z'])${lower(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}(?![a-z'])`).test(lower(text));

// Linear credit: full within `full` of the target, zero at `zero` away.
function band(name: string, target: number, actual: number, full: number, zero: number, max: number): VoiceMeasure {
  const d = Math.abs(actual - target);
  const points = d <= full ? max : d >= zero ? 0 : max * (1 - (d - full) / (zero - full));
  return { name, target, actual, max, points: Number(points.toFixed(1)), direction: d <= full ? "ok" : actual > target ? "high" : "low" };
}

export function scoreVoice(text: string, fp: VoiceFingerprint, structure?: VoiceStructure | null): VoiceReport {
  const m = measureVoice(text);
  const rel = (t: number, r: number, floor: number) => Math.max(floor, Math.abs(t) * r);
  const measures = [
    band("sentence length (words)", fp.avgSentenceWords, m.avgSentenceWords, rel(fp.avgSentenceWords, 0.2, 2), rel(fp.avgSentenceWords, 0.6, 6), 25),
    band("short punches (share of sentences under 5 words)", fp.fragmentRate, m.fragmentRate, 0.04, 0.15, 15),
    band('"you" per 1,000 words', fp.secondPersonRate, m.secondPersonRate, rel(fp.secondPersonRate, 0.3, 4), rel(fp.secondPersonRate, 1, 15), 15),
    band("contractions per 1,000 words", fp.contractionRate, m.contractionRate, rel(fp.contractionRate, 0.3, 6), rel(fp.contractionRate, 1, 20), 15),
    band("questions per 1,000 words", fp.questionRate, m.questionRate, rel(fp.questionRate, 0.4, 1.5), rel(fp.questionRate, 1.5, 6), 10),
  ];
  const avoidedHits = (structure?.avoided || []).map((a) => a.phrase).filter((p) => hasPhrase(text, p));
  const tics = findHouseTics(text);
  const phrasePoints = Math.max(0, 20 - 5 * (avoidedHits.length + tics.length));
  const score = Math.round(measures.reduce((a, x) => a + x.points, 0) + phrasePoints);
  return { score, measures, avoidedHits, tics };
}

// Which sentences cause the drift, with the fix each one needs. Capped, so the rewrite stays small.
function driftSentences(sents: string[], fp: VoiceFingerprint, r: VoiceReport, structure?: VoiceStructure | null, cap = 12): { i: number; fix: string }[] {
  const picks = new Map<number, string>();
  const add = (i: number, fix: string) => { if (picks.size < cap && !picks.has(i)) picks.set(i, fix); };
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  sents.forEach((s, i) => {
    const hit = (structure?.avoided || []).find((a) => hasPhrase(s, a.phrase));
    if (hit) add(i, `remove the phrase "${hit.phrase}"${hit.replacement ? ` (this creator says "${hit.replacement}")` : ""}`);
    else if (findHouseTics(s).length) add(i, "remove the stock narrator phrase");
  });
  const get = (name: string) => r.measures.find((x) => x.name.startsWith(name))!;
  const len = get("sentence length");
  if (len.direction === "high") sents.map((s, i) => ({ i, w: words(s) })).filter((x) => x.w > fp.avgSentenceWords * 1.6).sort((a, b) => b.w - a.w)
    .forEach((x) => add(x.i, `split or tighten: this creator averages about ${fp.avgSentenceWords} words per sentence`));
  if (len.direction === "low") sents.map((s, i) => ({ i, w: words(s) })).filter((x) => x.w <= 4).forEach((x) => add(x.i, `join with a neighbor idea or expand: this creator averages about ${fp.avgSentenceWords} words and uses fewer short punches`));
  const con = get("contractions");
  if (con.direction === "low") sents.forEach((s, i) => { if (/\b(do not|does not|did not|is not|are not|was not|were not|it is|that is|they are|we are|cannot|will not|would not|he is|she is|there is)\b/i.test(s)) add(i, "use the contractions this creator uses in speech"); });
  if (con.direction === "high") sents.forEach((s, i) => { if ((s.match(/\b\w+['’](?:s|t|re|ve|ll|d|m)\b/gi) || []).length >= 2) add(i, "this creator speaks more formally: fewer contractions"); });
  if (get('"you"').direction === "high") sents.forEach((s, i) => { if (/\byou(?:r|'re|'ve|'ll|'d)?\b/i.test(s) && !/["“]/.test(s)) add(i, 'address the viewer less directly ("you"): this creator rarely does'); });
  if (get("questions").direction === "high") sents.forEach((s, i) => { if (/\?\s*$/.test(s) && !/["“]/.test(s)) add(i, "turn the rhetorical question into a statement: this creator asks fewer"); });
  return [...picks.entries()].map(([i, fix]) => ({ i, fix }));
}

const specificsOf = (t: string) => [...new Set((t.match(/\$?\d[\d,.]*%?|\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g) || []).filter((x, k) => k > 0 || /\d/.test(x)).map((x) => x.toLowerCase().replace(/[.,]$/, "")))];

export interface VoiceCheckResult { body: string; before: VoiceReport; after: VoiceReport; changes: { from: string; to: string; fix: string }[]; refused: number; reverted: boolean }

export async function finalVoiceCheck(body: string, opts: { fingerprint: VoiceFingerprint; structure?: VoiceStructure | null; voiceName?: string; facts?: string; noCta?: boolean }): Promise<VoiceCheckResult> {
  const before = scoreVoice(body, opts.fingerprint, opts.structure);
  const none = { body, before, after: before, changes: [], refused: 0, reverted: false };
  if (before.score >= VOICE_REWRITE_THRESHOLD) return none;
  const paras = body.split(/\n\n+/).map((p) => splitSentences(p).map((s) => s.trim()).filter(Boolean));
  const flat = paras.flatMap((ss, p) => ss.map((s, k) => ({ p, k, s })));
  const picks = driftSentences(flat.map((x) => x.s), opts.fingerprint, before, opts.structure);
  if (!picks.length) return none;
  let edits: { i: number; text: string }[] = [];
  try {
    const m = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "", timeout: 120_000, maxRetries: 1 }).messages.create({
      model: "claude-sonnet-4-6", max_tokens: 3000, temperature: 0.3,
      messages: [{ role: "user", content: `You adjust the VOICE of a few sentences in a finished documentary script so they sound like this creator. Change ONLY wording and rhythm.

${fingerprintToBrief(opts.fingerprint, opts.voiceName)}
${renderVoiceStructure(opts.structure)}

HARD RULES: keep every fact exactly: every name, number, date, place, quote (word for word) and attribution ("according to", "by his own account") stays, and nothing new is added. Do not add a call to action. No em dashes. One sentence may become two, or stay one.

${picks.map(({ i, fix }, k) => `S${k + 1} (${fix}): ${flat[i].s}`).join("\n")}

Output ONLY JSON, one entry per sentence you change, using its label: {"edits":[{"id":"S1","text":"..."}]}` }],
    });
    const t = m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    // Labels S1..Sn map back to script positions in code (seen: the model renumbering answers 0..11 when given the
    // script's own sentence numbers, so every edit pointed at the wrong sentence). Each edit must also share most of
    // its words with the sentence it claims to replace.
    const W = (t: string) => new Set(lower(t).match(/[a-z0-9']{3,}/g) || []);
    edits = (Array.isArray(j?.edits) ? j.edits : []).map((e: any) => {
      const k = Number(String(e?.id || "").replace(/^S/i, "")) - 1; const i = picks[k]?.i ?? -1;
      const text = String(e?.text || "").trim().replace(/\s*(?:—|–|--)\s*/g, ", ");
      if (i < 0) return { i, text };
      const o = W(flat[i].s), t2 = W(text); const overlap = [...o].filter((w) => t2.has(w)).length / Math.max(1, o.size);
      return { i: overlap >= 0.4 ? i : -1, text };
    });
  } catch (e: any) { console.warn(`[voice-check] rewrite failed, script unchanged: ${e?.message || e}`); return none; }

  const facts = opts.facts || "";
  const picked = new Map(picks.map((p) => [p.i, p.fix]));
  const changes: VoiceCheckResult["changes"] = []; let refused = 0;
  const out = flat.map((x) => x.s);
  for (const e of edits) {
    const orig = flat[e.i]?.s; const fix = picked.get(e.i);
    if (!orig || !fix || !e.text || e.text === orig || e.text.length > orig.length * 2 + 120) {
      refused++; if (process.env.VOICE_DEBUG) console.log(`[voice-check] refused (${!orig ? `no sentence ${e.i}` : !fix ? `sentence ${e.i} was not picked` : !e.text ? "empty" : e.text === orig ? "unchanged" : "too long"}): ${String(e.text).slice(0, 100)}`); continue;
    }
    const kept = specificsOf(orig).every((sp) => lower(e.text).includes(sp));
    const guardLog: any[] = []; guardRewrite(orig, e.text, { pass: "voice_check", evidence: facts, log: guardLog, quiet: true });
    const why = !kept ? `dropped a specific (${specificsOf(orig).filter((sp) => !lower(e.text).includes(sp)).join(", ")})`
      : guardLog.length ? `new proposition: ${guardLog[0].added.join(", ")}`
      : !quoteBalanceKept(orig, e.text) ? "quote balance" : attributionMismatch(orig, e.text, facts.split("\n")) ? "attribution changed"
      : introducesUnsupportedName(orig, e.text, facts) ? "new name" : /\b(?:the|our) (?:research|record|facts|sources?)\b|\bthis (?:script|video)\b/i.test(e.text) ? "pipeline words"
      : opts.noCta && isCtaAsk(e.text) ? "CTA" : (opts.structure?.avoided || []).some((a) => hasPhrase(e.text, a.phrase)) || findHouseTics(e.text).length ? "avoided phrase/tic" : null;
    if (why) { refused++; if (process.env.VOICE_DEBUG) console.log(`[voice-check] refused (${why}): ${e.text.slice(0, 120)}`); continue; }
    out[e.i] = e.text; changes.push({ from: orig, to: e.text, fix });
  }
  let i = 0;
  const rebuilt = paras.map((ss) => ss.map(() => out[i++]).join(" ")).join("\n\n");
  const after = scoreVoice(rebuilt, opts.fingerprint, opts.structure);
  // Keep the edits only if they actually moved the script toward the creator.
  if (!changes.length || after.score <= before.score) return { ...none, refused, reverted: changes.length > 0 };
  return { body: rebuilt, before, after, changes, refused, reverted: false };
}
