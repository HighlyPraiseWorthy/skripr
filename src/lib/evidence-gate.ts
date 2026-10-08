// EVIDENCE INTEGRITY GATE, Experiment A (2026-10-07). Runs on each section the writer produces, where the
// baseline showed 57 of 63 unsupported claims were born. Rule (creator decision): the approved research is the
// CLOSED factual universe; the writer may interpret evidence but never expand it, even with true outside facts.
//
// Layer 1, deterministic: every externally verifiable specific in a sentence (numbers, amounts, percentages,
// years, dates, durations, proper nouns: people, places, organizations, courts, sources) must resolve to the
// research or to a deterministic variant of it (rounding, spelled numbers, durations from research years,
// names the research establishes). Pronouns and plain references ("he", "the court") are never checked.
// Repair: one call per section; each flagged sentence gets ONLY the research facts most related to it and is
// rewritten without the unsupported specifics. A rewrite that still fails is cut back to its supported clause,
// or removed. The repair can never add a fact: its output is re-checked by the same deterministic rule.
import { Anthropic } from "@anthropic-ai/sdk";

const UNITS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALE: Record<string, number> = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12, m: 1e6, b: 1e9, k: 1e3, mn: 1e6, bn: 1e9 };
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// Spelled numbers to digits ("fifty-six years" -> "56 years", "two hundred clients" -> "200 clients").
export function digitize(text: string): string {
  return text.replace(/\b((?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)(?:[\s-]+(?:and[\s-]+)?)?)+)\b/gi, (m) => {
    const words = m.toLowerCase().split(/[\s-]+/).filter((w) => w && w !== "and");
    if (!words.length || (words.length === 1 && UNITS[words[0]] !== undefined && UNITS[words[0]] <= 12)) return m; // keep small words ("one man", "three documents")
    let total = 0, cur = 0;
    for (const w of words) {
      if (UNITS[w] !== undefined) cur += UNITS[w]; else if (TENS[w] !== undefined) cur += TENS[w];
      else if (w === "hundred") cur = (cur || 1) * 100; else if (w === "thousand") { total += (cur || 1) * 1000; cur = 0; }
    }
    const n = total + cur;
    return n > 0 ? `${n}${/\s$/.test(m) ? " " : ""}` : m;
  });
}

type Num = { v: number; kind: "pct" | "money" | "year" | "count"; raw: string };
export function numbersIn(text: string): Num[] {
  const t = digitize(text);
  const out: Num[] = [];
  const re = /(\$)?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(%|percent|million|billion|trillion|thousand|bn|mn|[mbk]\b)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const raw = m[0].trim(); const n = Number(m[2].replace(/,/g, "")); const unit = (m[3] || "").toLowerCase();
    if (!Number.isFinite(n)) continue;
    if (unit === "%" || unit === "percent") { out.push({ v: n, kind: "pct", raw }); continue; }
    const v = n * (SCALE[unit] || 1);
    if (!m[1] && !unit && /^(1[89]\d{2}|20\d{2})$/.test(m[2])) { out.push({ v: n, kind: "year", raw }); continue; }
    out.push({ v, kind: m[1] || unit ? "money" : "count", raw });
  }
  return out;
}

// Words that are capitalized for grammar, not because they name something specific.
const COMMON = new Set(("the a an and but or so yet for nor in on at by to of from with without into onto over under after before during when while where why how what who whom whose which that this these those there here then now once he she it they we you i his her its their our your him them us me my one two three four five six seven eight nine ten no not never nothing nobody someone something everyone every each all both some most many few more less if because though although even still just only also too very much such than as like about across against along among around behind below beneath beside between beyond despite down inside near off out outside past since through throughout toward towards until up upon within " +
  "yes okay mr mrs ms dr judge sir madam monday tuesday wednesday thursday friday saturday sunday " + MONTHS.join(" ") + " god chapter part act section episode video story today tonight yesterday tomorrow").split(" "));
export const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
// Proper-noun specifics in a sentence, as phrases: consecutive capitalized words (bridged by of/the/de/del/la)
// form one name that must appear AS A PHRASE in the research ("Eastern District of New York" is not supported
// just because "eastern", "new" and "york" each appear somewhere). Hyphenated compounds split ("Chicago-based").
// A sentence-initial single word counts only when the research never uses it as an ordinary lowercase word.
let midCaps = new Set<string>();
export const setContext = (text: string) => { midCaps = new Set(fold(text).match(/(?<=[a-z,;]\s+)[A-Z][A-Za-z]+/g) || []); };
const capsIn = (sentence: string, idx: ResearchIndex): string[] => {
  const words = fold(digitize(sentence)).replace(/[“”"()\[\]]/g, " ").trim().split(/\s+/);
  const out: string[] = []; let run: string[] = []; let runStart = -1;
  const flush = () => {
    while (run.length && /^(of|the|de|del|la)$/i.test(run[run.length - 1])) run.pop();
    const names = run.filter((w) => !/^(of|the|de|del|la)$/i.test(w));
    if (names.length) {
      const single = names.length === 1;
      const w0 = names[0], l0 = w0.toLowerCase();
      const skip = single && (COMMON.has(l0) || (runStart === 0 && (COMMON_START.has(l0) || idx.lowerWords.has(l0) || /(ly|ing|ed|ers|ors|ists|ions|ness|ments?|ever|where|thing|one|body)$/.test(l0) || !midCaps.has(w0))));
      if (!skip) out.push(run.join(" "));
    }
    run = []; runStart = -1;
  };
  words.forEach((w, i) => {
    const parts = w.replace(/^[^A-Za-z]+|[^A-Za-z.']+$/g, "").replace(/['’]s$/, "").replace(/\.$/, "").split("-");
    for (const clean of parts) {
      const isName = /^[A-Z]/.test(clean) && !/['’.]/.test(clean) && clean.length >= 2 && !(clean.length === 2 && /^[A-Z][a-z]$/.test(clean));
      if (isName && !COMMON.has(clean.toLowerCase())) { if (!run.length) runStart = i; run.push(clean); }
      else if (run.length && /^(of|the|de|del|la)$/i.test(clean)) run.push(clean);
      else flush();
    }
    if (/[,;:.!?]$/.test(w) || /['’]s[^a-z]*$/.test(w)) flush();
  });
  flush();
  return out;
};
const COMMON_START = new Set("years months days weeks decades hours minutes later earlier eventually finally meanwhile instead nearly almost roughly about only just still nobody somebody everybody investigators prosecutors police authorities officials federal state court courts records documents money cash people neighbors family friends police officers agents detectives reporters witnesses experts researchers scientists studies data numbers prices sales profits losses revenue customers clients investors banks companies chains restaurants workers employees".split(" "));

export interface ResearchIndex { nums: Num[]; years: Set<number>; flat: string; lowerWords: Set<string>; dates: Set<string>; raw: string }
export function indexResearch(research: string): ResearchIndex {
  const nums = numbersIn(research);
  const years = new Set(nums.filter((n) => n.kind === "year").map((n) => n.v));
  // A research year written inside a range or date still counts ("1959-1975", "May 10, 1979").
  for (const y of research.match(/\b(1[89]\d{2}|20\d{2})\b/g) || []) years.add(Number(y));
  const flat = ` ${fold(research).toLowerCase().replace(/['’]s\b/g, "").replace(/[^a-z0-9]+/g, " ")} `;
  const lowerWords = new Set(fold(research).match(/(?<![A-Za-z])[a-z]{3,}/g) || []); // words the research uses uncapitalized
  const dates = new Set<string>();
  // "September 30", "Sept. 30", "Sep 30", "2015-03-26", "3/26/2015", "30 September" all index the same date.
  const low = research.toLowerCase();
  for (const m of low.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/g)) dates.add(`${MONTHS.find((x) => x.startsWith(m[1]))} ${Number(m[2])}`);
  for (const m of low.matchAll(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/g)) dates.add(`${MONTHS.find((x) => x.startsWith(m[2]))} ${Number(m[1])}`);
  for (const m of low.matchAll(/\b(?:19|20)\d{2}-(\d{2})-(\d{2})\b/g)) if (+m[1] >= 1 && +m[1] <= 12) dates.add(`${MONTHS[+m[1] - 1]} ${Number(m[2])}`);
  for (const m of low.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(?:19|20)?\d{2}\b/g)) if (+m[1] >= 1 && +m[1] <= 12) dates.add(`${MONTHS[+m[1] - 1]} ${Number(m[2])}`);
  return { nums, years, flat, lowerWords, dates, raw: research };
}

function numberSupported(n: Num, idx: ResearchIndex, sentence: string): boolean {
  if (n.kind === "year") return idx.years.has(n.v);
  if (n.kind === "count" && n.v <= 12) return true; // small counts are grammar, not data
  const approx = /\b(nearly|almost|about|roughly|around|approximately|more than|over|less than|under|some|close to)\b/i.test(sentence) ? 0.12 : 0.051;
  if (n.kind === "pct") return idx.nums.some((r) => r.kind === "pct" && Math.abs(r.v - n.v) <= (approx > 0.1 ? 1.5 : 0.5));
  const same = (a: number, b: number) => a === b || (b !== 0 && Math.abs(a - b) / Math.abs(b) <= approx) || Math.abs(a - b) < 0.051;
  if (idx.nums.some((r) => (r.kind === n.kind || (n.kind === "count" && r.kind !== "year") || (n.kind === "money" && r.kind === "count")) && same(n.v, r.v))) return true;
  // A duration that is the gap between two research years ("56 years" = 2015 - 1959).
  if (n.kind === "count" && /\d\s*(?:years?|decades?)/i.test(digitize(sentence))) {
    const ys = [...idx.years];
    for (const a of ys) for (const b of ys) if (b > a && Math.abs((b - a) - n.v) <= 1) return true;
  }
  // An age that a research birth year and event year imply is left to the existing age checks.
  return false;
}

export interface GateFlag { sentence: string; unsupported: string[]; layer: ("entity" | "attribute")[]; why?: string[]; action: "rewritten" | "clause_cut" | "removed"; result?: string }
export function unsupportedSpecifics(sentence: string, idx: ResearchIndex): string[] {
  const bad: string[] = [];
  for (const n of numbersIn(sentence)) if (!numberSupported(n, idx, sentence)) bad.push(n.raw);
  const low = sentence.toLowerCase();
  for (const m of low.matchAll(new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{1,2})\\b`, "g"))) if (!idx.dates.has(`${m[1]} ${Number(m[2])}`)) bad.push(`${m[1]} ${m[2]}`);
  for (const name of capsIn(sentence, idx)) {
    const has = (x: string) => idx.flat.includes(` ${fold(x).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `);
    // Supported if the whole phrase is in the research, or each of its bridged parts is ("Goodenough of Arizona").
    if (!has(name) && name.split(/\s+(?:of|the|de|del|la)\s+/i).some((part) => !has(part))) bad.push(name);
  }
  return [...new Set(bad)];
}

// Periods inside numbers ("$12.8 billion") and common abbreviations don't end a sentence.
export const splitSentences = (t: string) => t.match(/(?:\d\.\d|\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|U\.S|vs|No)\.|[^.!?])+(?:[.!?]+["”’)]*|$)/g)?.filter((x) => x.trim()) || [t];
function relevantFacts(sentence: string, research: string, k = 8): string[] {
  const words = new Set((sentence.toLowerCase().match(/[a-z]{4,}|\d+/g) || []));
  return research.split("\n").map((f) => ({ f, s: (f.toLowerCase().match(/[a-z]{4,}|\d+/g) || []).filter((w) => words.has(w)).length }))
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.f);
}

const client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "", timeout: 180_000, maxRetries: 1 });
const jsonOf = (msg: any) => { const t = msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n"); return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); };
const normQ = (t: string) => fold(String(t || "")).toLowerCase().replace(/[‘’“”"']/g, "").replace(/[^a-z0-9$%.]+/g, " ").trim();

// LAYER 2, attribute grounding: a research entity or number attached to the wrong claim ("voted" where the
// research says "registered to vote"; the right judge in a courtroom the research never places him in).
// Opus reads the FULL research (a retrieval miss must never look like an unsupported claim); every flag must
// quote the exact script words, which code verifies. Interpretation stays the writer's: only checkable claims about the world count.
const VERIFY = `You verify a documentary script section against its RESEARCH, which is the complete and closed set of facts the script may state. Outside knowledge does not count, even if true.

Go sentence by sentence. For every CHECKABLE claim about the world (who, what, when, where, how many, how much, what a document or person said, what someone did, what status something had, how something happened), find the research text that supports it.

Skip (do not list): the narrator's interpretation, framing, rhetorical questions, emotional color, transitions, references back to a scene the research describes ("the moment in the trailer"), and scene-setting that asserts no new checkable fact.

For each checkable claim output:
- "i": sentence number
- "claim": the exact script words making the claim, copied from the sentence (3-15 words)
- "support": the shortest exact research span that supports it, copied character for character, or "" if none
- "fit": "exact" (research states it), "derived" (faithful paraphrase, or a LESS specific version of what the research says: "deputies found him" when the research says "local deputies arrested him"; rounding; spelled numbers; arithmetic from research dates; surname for a named person), "partial" (the script states something DIFFERENT or STRONGER than the research: the entity or number attached to another event, person, place or time, or a different action, e.g. "voted" when the research says "registered to vote"), or "none" (not in the research)

Output ONLY JSON: {"claims":[{"i":0,"claim":"...","support":"...","fit":"exact"}]}`;

async function verifyAttributes(sentences: string[], research: string): Promise<Map<number, { quote: string; why: string }[]>> {
  const out = new Map<number, { quote: string; why: string }[]>();
  if (!sentences.length) return out;
  const R = normQ(research);
  try {
    const j = jsonOf(await client().messages.create({ model: "claude-opus-5-5", max_tokens: 24000, system: VERIFY,
      messages: [{ role: "user", content: `RESEARCH:\n"""\n${research}\n"""\n\nSCRIPT SENTENCES:\n${sentences.map((s, i) => `${i}. ${s}`).join("\n")}` }] }));
    if (process.env.GATE_DEBUG) console.log("[verify raw]", JSON.stringify(j).slice(0, 4000));
    for (const c of Array.isArray(j?.claims) ? j.claims : []) {
      const i = Number(c?.i); const q = String(c?.claim || ""); const sup = String(c?.support || ""); const fit = String(c?.fit || "");
      if (!sentences[i] || q.length < 3 || !normQ(sentences[i]).includes(normQ(q))) continue; // the claim must be real script words
      // Supported only with a real research span and an exact or derived fit; the span is verified by code.
      const supported = (fit === "exact" || fit === "derived") && sup.length >= 4 && R.includes(normQ(sup));
      if (supported) continue;
      const why = fit === "partial" ? `research differs: "${sup.slice(0, 160)}"` : sup && !R.includes(normQ(sup)) ? "cited support not found in research" : "not in research";
      out.set(i, [...(out.get(i) || []), { quote: q, why }]);
    }
  } catch (e: any) { console.warn(`[evidence-gate] verifier failed, Layer 1 only: ${e?.message || e}`); }
  return out;
}

export interface GateOptions { log?: GateFlag[]; attributes?: boolean }
export async function gateSection(text: string, research: string, opts: GateOptions = {}): Promise<string> {
  if (!text.trim() || !research.trim()) return text;
  const idx = indexResearch(research);
  setContext(text);
  const sentsByPara = text.split(/\n\n+/).map((p) => splitSentences(p));
  const flat: { p: number; s: number; sentence: string }[] = [];
  sentsByPara.forEach((ss, p) => ss.forEach((sentence, s) => flat.push({ p, s, sentence: sentence.trim() })));
  const l2 = opts.attributes === false ? new Map() : await verifyAttributes(flat.map((f) => f.sentence), research);
  const flagged = flat.map((f, k) => {
    const bad = unsupportedSpecifics(f.sentence, idx);
    const attr: { quote: string; why: string }[] = l2.get(k) || [];
    return { ...f, bad, attr, layer: [...(bad.length ? ["entity"] : []), ...(attr.length ? ["attribute"] : [])] as GateFlag["layer"] };
  }).filter((f) => f.bad.length || f.attr.length);
  if (!flagged.length) return text;

  // Repair: one call; each sentence sees ONLY the research facts most related to it, never the whole research.
  let rewrites: Record<number, string> = {};
  try {
    const j = jsonOf(await client().messages.create({ model: "claude-sonnet-4-6", max_tokens: 3000, temperature: 0.2,
      messages: [{ role: "user", content: `Each sentence below, from a documentary script, states something the research does not support (listed). Rewrite each sentence so it keeps its job in the story but states only what that sentence's FACTS support. Make the SMALLEST change: first choice, delete the unsupported words or make them less specific ("on September 30, 1959" -> "in 1959"; "a Las Vegas DMV" -> "a DMV"). Substitute a fact only when the FACTS state that exact fact about this same event, person and time. Never change who did something, never move a fact (a duration, a place, a number) from one event or period onto another, never add a claim the FACTS don't state. Keep the voice, keep it about the same length or shorter, no em dashes. If the sentence cannot stand without the unsupported part, output exactly CUT.

${flagged.map((f, i) => `[${i}] SENTENCE: ${f.sentence}\nNOT SUPPORTED: ${[...f.bad.map((b) => `"${b}" (not in the research)`), ...f.attr.map((a) => `"${a.quote}" (${a.why})`)].join("; ")}\nFACTS:\n${relevantFacts(`${f.sentence} ${f.attr.map((a) => a.why).join(" ")}`, research, 10).map((x) => `- ${x}`).join("\n") || "- (none related)"}`).join("\n\n")}

Output ONLY JSON: {"rewrites":[{"i":0,"text":"..."}]}` }] }));
    for (const r of Array.isArray(j?.rewrites) ? j.rewrites : []) if (Number.isInteger(Number(r?.i)) && typeof r?.text === "string") rewrites[Number(r.i)] = r.text.trim();
  } catch (e: any) { console.warn(`[evidence-gate] repair failed, cutting instead: ${e?.message || e}`); rewrites = {}; }

  // Re-check every rewrite with BOTH layers; a rewrite that still fails falls back to cutting the clause.
  const cand = flagged.map((f, i) => { const rw = rewrites[i]; return rw && rw !== "CUT" && rw.split(/\s+/).length >= 4 && !unsupportedSpecifics(rw, idx).length ? rw : null; });
  const toRecheck = cand.map((c, i) => ({ c, i })).filter((x) => x.c) as { c: string; i: number }[];
  const re = opts.attributes === false ? new Map() : await verifyAttributes(toRecheck.map((x) => x.c), research);
  const passed = new Set(toRecheck.filter((_, k) => !re.has(k)).map((x) => x.i));

  flagged.forEach((f, i) => {
    let result: string | null = null; let action: GateFlag["action"] = "removed";
    if (passed.has(i)) { result = cand[i]; action = "rewritten"; }
    else {
      const clauses = f.sentence.split(/(?<=[,;])\s+|\s+(?=\b(?:and|but|while|which|after|before|when|where)\b)/);
      const keep = clauses.filter((c) => !unsupportedSpecifics(c, idx).length && !f.attr.some((a) => normQ(c).includes(normQ(a.quote)) || normQ(a.quote).includes(normQ(c))));
      const joined = keep.join(" ").replace(/[,;\s]+$/, "").replace(/^\s*(and|but|while|which)\s+/i, "").trim();
      if (keep.length && keep.length < clauses.length && joined.split(/\s+/).length >= 5) { result = /[.!?]["”’)]*$/.test(joined) ? joined : `${joined}.`; result = result[0].toUpperCase() + result.slice(1); action = "clause_cut"; }
    }
    sentsByPara[f.p][f.s] = result ? ` ${result} ` : " ";
    opts.log?.push({ sentence: f.sentence, unsupported: [...f.bad, ...f.attr.map((a) => a.quote)], layer: f.layer, why: f.attr.map((a) => a.why), action, result: result || undefined });
  });
  return sentsByPara.map((ss) => ss.join(" ").replace(/\s{2,}/g, " ").trim()).filter(Boolean).join("\n\n");
}
