// PLAIN-LANGUAGE VOICE TWEAKS (Voice Match step 4, 2026-10-11). The creator types "use shorter sentences" or
// "never say 'folks'" and the matching checkable fields update, with no re-analysis.
// Data model inside voice_profiles.voice_fingerprint (JSONB):
//   top level   the EFFECTIVE fingerprint + structure (what generation and the voice check read; unchanged shape)
//   base        the MEASURED fingerprint + structure, saved the first time a tweak is applied
//   tweakOps    the ordered list of operations; effective = base + ops
// So "undo all adjustments" is exact, and a re-analysis re-applies the ops on top of the fresh measurement.
// The model only TRANSLATES the instruction into operations; code applies them, with clamped ranges.
import { Anthropic } from "@anthropic-ai/sdk";
import type { VoiceFingerprint } from "@/lib/voice-metrics";
import type { VoiceStructure } from "@/lib/voice-structure";

export const METRICS = {
  avgSentenceWords: { label: "Average sentence length", unit: "words", min: 6, max: 30 },
  fragmentRate: { label: "Short punches (share of sentences under 5 words)", unit: "", min: 0, max: 0.4 },
  secondPersonRate: { label: '"You" per 1,000 words', unit: "", min: 0, max: 60 },
  contractionRate: { label: "Contractions per 1,000 words", unit: "", min: 0, max: 60 },
  questionRate: { label: "Rhetorical questions per 1,000 words", unit: "", min: 0, max: 15 },
} as const;
type Metric = keyof typeof METRICS;

export type TweakOp =
  | { op: "metric"; metric: Metric; value?: number; direction?: "lower" | "higher"; instruction: string }
  | { op: "avoid"; phrase: string; replacement?: string; instruction: string }
  | { op: "allow"; phrase: string; instruction: string }
  | { op: "never_does"; text: string; instruction: string }
  | { op: "cta"; placement: "opening" | "middle" | "closing" | "none"; instruction: string }
  | { op: "note"; text: string; instruction: string };

export interface VoiceJson extends Partial<VoiceFingerprint> { structure?: VoiceStructure; base?: { fp: VoiceFingerprint | null; structure: VoiceStructure | null }; tweakOps?: TweakOp[]; [k: string]: any }

const FP_KEYS = ["avgSentenceWords", "sentenceVariance", "secondPersonRate", "contractionRate", "questionRate", "fragmentRate", "avgParagraphSentences", "words"] as const;
const fpOf = (j: VoiceJson | null | undefined): VoiceFingerprint | null => (j && Number(j.words) >= 300 ? Object.fromEntries(FP_KEYS.map((k) => [k, (j as any)[k]])) as unknown as VoiceFingerprint : null);
const emptyStructure = (): VoiceStructure => ({ version: 1, openers: [], person: { firstSingularPer1k: 0, firstPluralPer1k: 0, secondPer1k: 0, dominant: "third" }, signature: [], avoided: [], cta: { placement: "unknown" }, neverDoes: [], sampleWords: 0 });
const clamp = (m: Metric, v: number) => Math.min(METRICS[m].max, Math.max(METRICS[m].min, v));
const fmt = (m: Metric, v: number) => (m === "fragmentRate" ? `${Math.round(v * 100)}%` : `${Number(v.toFixed(1))}${METRICS[m].unit ? ` ${METRICS[m].unit}` : ""}`);

// Apply ops to the measured base. Returns the effective fingerprint + structure and a readable change list.
export function applyOps(base: { fp: VoiceFingerprint | null; structure: VoiceStructure | null }, ops: TweakOp[]): { fp: VoiceFingerprint | null; structure: VoiceStructure; summary: string[] } {
  const fp = base.fp ? { ...base.fp } : null;
  const s: VoiceStructure = JSON.parse(JSON.stringify(base.structure || emptyStructure()));
  const summary: string[] = [];
  const tweaks: string[] = [];
  for (const o of ops) {
    if (o.op === "metric") {
      if (!fp) { tweaks.push(o.instruction); summary.push(`Noted: "${o.instruction}" (this voice has no measured rhythm to adjust)`); continue; }
      const cur = Number((fp as any)[o.metric]) || 0;
      // A direction without a number moves the target 25% (at least a sensible minimum step).
      const step = o.metric === "fragmentRate" ? Math.max(0.04, cur * 0.25) : Math.max(o.metric === "avgSentenceWords" ? 2 : 3, cur * 0.25);
      const next = clamp(o.metric, typeof o.value === "number" && isFinite(o.value) ? o.value : o.direction === "lower" ? cur - step : cur + step);
      (fp as any)[o.metric] = Number(next.toFixed(o.metric === "fragmentRate" ? 2 : 1));
      summary.push(`${METRICS[o.metric].label}: ${fmt(o.metric, cur)} → ${fmt(o.metric, (fp as any)[o.metric])}`);
    } else if (o.op === "avoid") {
      if (!s.avoided.some((a) => a.phrase.toLowerCase() === o.phrase.toLowerCase())) s.avoided.push({ phrase: o.phrase, replacement: o.replacement || "" });
      summary.push(`Never say "${o.phrase}"${o.replacement ? ` (say "${o.replacement}")` : ""}`);
    } else if (o.op === "allow") {
      const before = s.avoided.length; s.avoided = s.avoided.filter((a) => a.phrase.toLowerCase() !== o.phrase.toLowerCase());
      s.signature = s.signature.filter((p) => p.phrase.toLowerCase() !== o.phrase.toLowerCase());
      summary.push(before !== s.avoided.length ? `"${o.phrase}" is allowed again` : `Noted: "${o.phrase}" is allowed`);
    } else if (o.op === "never_does") {
      if (!s.neverDoes.includes(o.text)) s.neverDoes.push(o.text);
      summary.push(`Never does: ${o.text}`);
    } else if (o.op === "cta") {
      s.cta = { placement: o.placement };
      summary.push(o.placement === "none" ? "No calls to action in this voice" : `Calls to action go in the ${o.placement}`);
    } else {
      tweaks.push(o.text);
      summary.push(`Noted: ${o.text}`);
    }
  }
  // Plain notes the fields can't express are passed to the writer as the creator's adjustments.
  s.tweaks = [...new Set(tweaks)].slice(-8);
  if (!s.tweaks.length) delete s.tweaks;
  return { fp, structure: s, summary };
}

// Model: translate one instruction into ops (it never edits the profile itself).
export async function parseTweak(instruction: string, fp: VoiceFingerprint | null): Promise<TweakOp[]> {
  const text = instruction.trim().slice(0, 400);
  if (!text) return [];
  try {
    const m = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "", timeout: 60_000, maxRetries: 1 }).messages.create({
      model: "claude-sonnet-4-6", max_tokens: 800, temperature: 0,
      messages: [{ role: "user", content: `Translate a creator's instruction about their script VOICE into operations on these fields.

CURRENT MEASURED TARGETS: ${fp ? Object.entries(METRICS).map(([k, v]) => `${k} (${v.label}) = ${(fp as any)[k]}`).join("; ") : "none measured"}

Operations:
- {"op":"metric","metric":"avgSentenceWords|fragmentRate|secondPersonRate|contractionRate|questionRate","value":<number, only if the creator gives one>,"direction":"lower|higher"}  (shorter sentences = avgSentenceWords lower; punchier = fragmentRate higher; more casual = contractionRate higher; talk to the viewer more = secondPersonRate higher; fewer questions = questionRate lower)
- {"op":"avoid","phrase":"...","replacement":"..."}  (a phrase they never want; replacement optional)
- {"op":"allow","phrase":"..."}  (a phrase they DO want allowed)
- {"op":"never_does","text":"..."}  (a short rule, e.g. "never swears")
- {"op":"cta","placement":"opening|middle|closing|none"}
- {"op":"note","text":"..."}  (anything else, restated as one short instruction)
Never touch facts, accuracy, or certainty: if the instruction asks the voice to sound more certain or to state things the research does not, turn it into a note that keeps "certainty follows the research".

INSTRUCTION: "${text}"
Output ONLY JSON: {"ops":[...]}` }],
    });
    const t = m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    const ops: TweakOp[] = [];
    for (const o of Array.isArray(j?.ops) ? j.ops : []) {
      if (o?.op === "metric" && o.metric in METRICS && (typeof o.value === "number" || o.direction === "lower" || o.direction === "higher")) ops.push({ op: "metric", metric: o.metric, ...(typeof o.value === "number" ? { value: o.value } : {}), ...(o.direction ? { direction: o.direction } : {}), instruction: text });
      else if (o?.op === "avoid" && String(o.phrase || "").trim()) ops.push({ op: "avoid", phrase: String(o.phrase).trim().slice(0, 60), ...(o.replacement ? { replacement: String(o.replacement).trim().slice(0, 60) } : {}), instruction: text });
      else if (o?.op === "allow" && String(o.phrase || "").trim()) ops.push({ op: "allow", phrase: String(o.phrase).trim().slice(0, 60), instruction: text });
      else if (o?.op === "never_does" && String(o.text || "").trim()) ops.push({ op: "never_does", text: String(o.text).trim().slice(0, 120), instruction: text });
      else if (o?.op === "cta" && ["opening", "middle", "closing", "none"].includes(o.placement)) ops.push({ op: "cta", placement: o.placement, instruction: text });
      else if (o?.op === "note" && String(o.text || "").trim()) ops.push({ op: "note", text: String(o.text).trim().slice(0, 200), instruction: text });
    }
    return ops.length ? ops : [{ op: "note", text, instruction: text }];
  } catch {
    return [{ op: "note", text, instruction: text }];
  }
}

// Build the stored JSON from a measured base + ops.
export function composeVoiceJson(base: { fp: VoiceFingerprint | null; structure: VoiceStructure | null }, ops: TweakOp[]): { json: VoiceJson; summary: string[] } {
  const eff = applyOps(base, ops);
  const adjusted = ops.some((o) => o.op === "metric");
  const json: VoiceJson = { ...(eff.fp || { words: 0 }), structure: eff.structure, ...(ops.length ? { base, tweakOps: ops } : {}), ...(adjusted ? { adjusted: true } : {}) };
  return { json, summary: eff.summary };
}

// The measured base of a stored JSON (the base snapshot if tweaks exist, else the top level itself).
export function baseOf(j: VoiceJson | null | undefined): { fp: VoiceFingerprint | null; structure: VoiceStructure | null } {
  if (j?.base) return { fp: j.base.fp, structure: j.base.structure };
  return { fp: fpOf(j), structure: (j?.structure as VoiceStructure) || null };
}
