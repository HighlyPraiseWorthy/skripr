// STRUCTURED VOICE PROFILE (Voice Match step 2, 2026-10-11). The prose profile (narrative mechanics etc.) stays;
// alongside it, a small set of fields that can be CHECKED, so a finished script can be measured against the creator
// (step 3) and one field can be adjusted without re-analysis (step 4). Every field is either measured by code from
// the samples or proposed by the model and then verified by code against the samples:
//   openers     code: the creator's most common sentence-opening words, with shares
//   person      code: first-person singular/plural and "you" per 1,000 words, and which dominates
//   signature   model proposes recurring phrases; code counts real occurrences, keeps those seen 2+ times
//   avoided     model proposes generic narrator phrases (with replacements); code keeps only those seen 0 times
//   cta         model: opening/middle/closing/none + a verbatim example; code drops an example not in the samples
//   neverDoes   model-stated rules (short); not code-verifiable, kept as stated
// Flavor fields (age vibe, energy adjectives) are deliberately absent: they cannot be checked.
// Rule: the voice shapes HOW things are said; it never overrides the evidence rules (certainty follows the research).
import { Anthropic } from "@anthropic-ai/sdk";

export interface VoiceStructure {
  version: 1;
  openers: { word: string; share: number }[];
  person: { firstSingularPer1k: number; firstPluralPer1k: number; secondPer1k: number; dominant: "first-singular" | "first-plural" | "second" | "third" };
  signature: { phrase: string; per1k: number; count: number }[];
  avoided: { phrase: string; replacement: string }[];
  cta: { placement: "opening" | "middle" | "closing" | "none" | "unknown"; example?: string };
  neverDoes: string[];
  sampleWords: number;
  sampleCount?: number; // how many videos/scripts the rules were built from (signature phrases need 2+)
  tweaks?: string[]; // plain-language adjustments applied by the user (step 4)
}

const lower = (t: string) => (t || "").toLowerCase().replace(/[’]/g, "'");
const wordCount = (t: string) => (t.match(/\b[\w']+\b/g) || []).length;
const countPhrase = (text: string, phrase: string) => {
  const p = lower(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return (lower(text).match(new RegExp(`(?<![a-z'])${p}(?![a-z'])`, "g")) || []).length;
};

export function measureOpeners(text: string, top = 6): VoiceStructure["openers"] {
  const sents = (text || "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 3);
  // A word capitalized mid-sentence is a name (seen: "kurt" as an "opener" in a Kurt Cobain video), not voice.
  const names = new Set((text.match(/(?<=[a-z,;]\s)[A-Z][a-z]+/g) || []).map((w) => w.toLowerCase()));
  const counts: Record<string, number> = {};
  for (const s of sents) { const w = lower(s).match(/^[a-z']+/)?.[0]; if (w) counts[w] = (counts[w] || 0) + 1; }
  const n = sents.length || 1;
  // Ordinary subject words ("the", "it", "he") open sentences in everyone's writing; only report distinctive openers.
  const COMMON = new Set(["the", "a", "an", "it", "he", "she", "they", "this", "that", "i", "we", "you", "in", "there", "his", "her", "their", "its", "one"]);
  return Object.entries(counts).filter(([w, c]) => !COMMON.has(w) && !names.has(w) && c / n >= 0.02).sort((a, b) => b[1] - a[1]).slice(0, top)
    .map(([word, c]) => ({ word, share: Number((c / n).toFixed(3)) }));
}

export function measurePerson(text: string): VoiceStructure["person"] {
  const n = wordCount(text) || 1; const t = lower(text);
  const per = (re: RegExp) => Number((((t.match(re) || []).length / n) * 1000).toFixed(1));
  const firstSingularPer1k = per(/\b(i|i'm|i've|i'd|i'll|me|my|mine|myself)\b/g);
  const firstPluralPer1k = per(/\b(we|we're|we've|we'd|we'll|us|our|ours|ourselves)\b/g);
  const secondPer1k = per(/\b(you|you're|you've|you'd|you'll|your|yours|yourself)\b/g);
  const max = Math.max(firstSingularPer1k, firstPluralPer1k, secondPer1k);
  const dominant = max < 5 ? "third" : max === secondPer1k ? "second" : max === firstPluralPer1k ? "first-plural" : "first-singular";
  return { firstSingularPer1k, firstPluralPer1k, secondPer1k, dominant };
}

// Title filter (v2): a signature phrase whose MAIN words appear in the analysed videos' titles is that video's topic,
// not the creator's voice ("the man with the iron heart"). Main words = 4+ letters, not stopwords, compared in a
// light stemmed form so "hearts" matches "heart". The stopword list keeps everyday title words ("really", "story",
// "people") from killing real phrases.
const STOPWORDS = new Set(("about above actually after again against almost also although always among another anyone anything around because been before behind being below between both came cannot come could did does doing done down during each even ever every everyone everything from further gets give given goes going gone good great have having here hers herself himself into itself just keep know last less like little made make many maybe more most much must myself never next nothing once only other others ours over own part people perhaps really right said same says should show since some something still story such take than that their theirs them themselves then there these they thing things this those though through time times today together told took toward truly under until upon very want watch ways well went were what when where whether which while whole whom whose will with within without would year years your yours yourself " +
  "actually basically literally simply totally completely absolutely honestly seriously probably definitely video videos episode channel inside behind truth real really insane crazy shocking secret secrets explained finally ever first last best worst full entire").split(/\s+/));
const stem = (w: string) => w.toLowerCase().replace(/['’]s$/, "").replace(/ies$/, "y").replace(/(ss)$/, "$1").replace(/(?<=[a-z]{3})(es|s)$/, "").replace(/(?<=[a-z]{3})(ing|ed)$/, "");
const mainWords = (t: string) => (t.toLowerCase().match(/[a-z']+/g) || []).map((w) => w.replace(/['’]s$/, "")).filter((w) => w.length >= 4 && !STOPWORDS.has(w)).map(stem);
export function isTitlePhrase(phrase: string, titles: string[]): boolean {
  const T = new Set(titles.flatMap(mainWords));
  return mainWords(phrase).some((w) => T.has(w));
}

const jsonOf = (m: any) => { const t = m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n"); return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); };

// Builds the structured profile from the creator's samples. Returns null if the samples are too thin.
// samples: one string with videos/scripts separated by lines of "---" (as the voice analysis joins them).
export async function extractVoiceStructure(samples: string, opts: { titles?: string[] } = {}): Promise<VoiceStructure | null> {
  const text = (samples || "").trim();
  const parts = text.split(/\n+\s*-{3,}\s*\n+/).map((x) => x.trim()).filter(Boolean);
  const words = wordCount(text);
  if (words < 300) return null;
  let proposed: any = {};
  try {
    proposed = jsonOf(await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "", timeout: 180_000, maxRetries: 1 }).messages.create({
      model: "claude-sonnet-4-6", max_tokens: 2000, temperature: 0,
      messages: [{ role: "user", content: `These are transcripts or scripts from ONE YouTube creator. Extract CHECKABLE voice facts only.

SAMPLES:
"""
${text.slice(0, 24000)}
"""

Return:
- "signature": up to 8 phrases this creator really repeats, copied VERBATIM from the samples (2-6 words each; recurring turns of phrase, not topic words or names).
- "avoided": up to 10 generic YouTube-narrator or AI-sounding phrases this creator NEVER uses (e.g. "let that sink in", "here's the thing", "buckle up", "in today's video", "but here's where it gets interesting", "the truth is"), each with the plain way THIS creator would say it instead ("replacement", or "" to just drop it).
- "cta": where the creator asks viewers to subscribe, like, comment, or follow: "opening", "middle", "closing", or "none"; plus "example": their exact words, copied verbatim, or "". IGNORE SPONSOR READS AND ADS completely (product plugs, discount codes, URLs, "this video is sponsored by"): they are not calls to action and must never be copied.
- "neverDoes": up to 3 short, concrete things about the NARRATION a listener would notice this creator never does (e.g. "never swears", "never addresses the viewer as 'guys'", "never uses sound-effect words"). Nothing about sponsor segments or video editing.
Do not include style adjectives, personality descriptions, or anything you cannot point to in the samples.
Output ONLY JSON: {"signature":["..."],"avoided":[{"phrase":"...","replacement":"..."}],"cta":{"placement":"closing","example":"..."},"neverDoes":["..."]}` }],
    }));
  } catch (e: any) { console.warn(`[voice-structure] extraction failed, keeping measured fields only: ${e?.message || e}`); }

  // Verify every model-proposed field against the samples.
  // A signature is VOICE only if it recurs across different videos; a phrase repeated inside one video is usually its
  // topic (seen: "the man with the iron heart", "internet sleuths"). With a single sample, 2+ uses inside it count.
  const signature = (Array.isArray(proposed.signature) ? proposed.signature : []).map((p: any) => String(p || "").trim()).filter((p: string) => p.split(/\s+/).length >= 2 && p.length <= 60)
    .map((phrase: string) => { const count = countPhrase(text, phrase); const inSamples = parts.filter((x) => countPhrase(x, phrase) > 0).length; return { phrase, count, inSamples, per1k: Number(((count / words) * 1000).toFixed(2)) }; })
    // v2: signature phrases need 2+ samples (videos, or scripts separated by ---): one sample builds the voice but
    // cannot show what recurs across videos. Phrases made of the videos' title words are topics, not voice.
    .filter((s: any) => parts.length >= 2 && s.inSamples >= 2 && !isTitlePhrase(s.phrase, opts.titles || [])).map(({ inSamples, ...s }: any) => s).slice(0, 8);
  // An "avoided" phrase must be absent from the samples; its replacement is kept only if the creator really says it.
  const avoided = (Array.isArray(proposed.avoided) ? proposed.avoided : []).map((a: any) => ({ phrase: String(a?.phrase || "").trim(), replacement: String(a?.replacement || "").trim() }))
    .filter((a: any) => a.phrase.split(/\s+/).length >= 2 && countPhrase(text, a.phrase) === 0)
    .map((a: any) => ({ phrase: a.phrase, replacement: a.replacement && countPhrase(text, a.replacement) > 0 ? a.replacement : "" })).slice(0, 10);
  const placement = ["opening", "middle", "closing", "none"].includes(proposed?.cta?.placement) ? proposed.cta.placement : "unknown";
  // Sponsor copy is never a call to action (seen: a NordVPN read returned as the CTA): drop URLs, codes, discounts.
  const rawExample = String(proposed?.cta?.example || "").trim();
  const example = /\b[\w-]+\.(com|net|org|io|co|tv)\b|https?:|\bcode\b|% off|\bsponsor|\bdiscount|\bpromo\b|\bfree trial\b/i.test(rawExample) ? "" : rawExample;
  const cta = { placement, ...(example && countPhrase(text, example.split(/[.!?]/)[0].trim()) > 0 ? { example: example.slice(0, 160) } : {}) } as VoiceStructure["cta"];
  const neverDoes = (Array.isArray(proposed.neverDoes) ? proposed.neverDoes : []).map((x: any) => String(x || "").trim()).filter((x: string) => x && !/sponsor|\bad\b|ads\b|edit/i.test(x)).slice(0, 3);
  if (process.env.VOICE_DEBUG) console.log("[voice-structure] proposed signature:", JSON.stringify(proposed.signature), "kept:", JSON.stringify(signature));
  return { version: 1, openers: measureOpeners(text), person: measurePerson(text), signature, avoided, cta, neverDoes, sampleWords: words, sampleCount: parts.length };
}

// Renders the fields as text for the existing voice prompt slot (appended to the prose profile).
export function renderVoiceStructure(s: VoiceStructure | null | undefined): string {
  if (!s) return "";
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const lines = ["CHECKABLE VOICE RULES (measured from this creator's own samples; the finished script is checked against them):"];
  if (s.person) lines.push(`- Person: mostly ${s.person.dominant.replace("-", " ")} (per 1,000 words: "I/me" ${s.person.firstSingularPer1k}, "we/us" ${s.person.firstPluralPer1k}, "you" ${s.person.secondPer1k}).`);
  if (s.openers?.length) lines.push(`- Distinctive sentence openers, at about these rates: ${s.openers.map((o) => `"${o.word}" ${pct(o.share)}`).join(", ")}. Use them at the creator's rate, not on every line.`);
  if (s.signature?.length) lines.push(`- Signature phrases (verbatim, at their real frequency; never more than about once each per section): ${s.signature.map((p) => `"${p.phrase}"`).join(", ")}.`);
  if (s.avoided?.length) lines.push(`- Never say (this creator never does): ${s.avoided.map((a) => `"${a.phrase}"${a.replacement ? ` (say "${a.replacement}")` : ""}`).join("; ")}.`);
  if (s.cta && s.cta.placement !== "unknown") lines.push(s.cta.placement === "none" ? "- Calls to action: this creator does not ask viewers to subscribe or comment." : `- Calls to action go in the ${s.cta.placement}${s.cta.example ? `, in their words: "${s.cta.example}"` : ""}.`);
  if (s.neverDoes?.length) lines.push(`- Never does: ${s.neverDoes.join("; ")}.`);
  if (s.tweaks?.length) lines.push(`- Creator's adjustments (these win over the measurements above): ${s.tweaks.map((t) => t.replace(/[.\s]+$/, "")).join("; ")}.`);
  lines.push("- These voice rules shape HOW things are said. They never override the evidence rules: certainty, attribution and every fact follow the research.");
  return lines.join("\n");
}
