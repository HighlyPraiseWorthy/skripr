// FINAL CHECK — the pre-publication read of the finished script, as its own request after finalize.
//
// Why it exists: after every sentence-level pass, a finished script still carried 3-7 one-off slips
// per run (seen across ~15 live runs, LeFevre and Jones): an arrest under the wrong year's dateline,
// an age that doesn't fit the date, two figures for one quantity, two accounts of how someone was
// caught, a line announcing something that never comes, a reference to an event never introduced,
// a fact re-told three paragraphs later. A whole-script read against the research catches them; the
// older review could only rewrite single sentences, on the same model as everything else, inside the
// finalize request's time budget. This runs on the strongest model, can rewrite, cut, or add a short
// setup line, and every edit passes the same guards as the other passes.
import Anthropic from "@anthropic-ai/sdk";
import {
  splitSentences, quoteBalanceKept, attributionMismatch, introducesUnsupportedName,
  eventYearMismatches, ageYearMismatches, retoldFacts, expandNounContractions, stripStutters, stripStoryMeta, repeatedFigureExplanations, foreverContradicted, replaceMinorNames, replaceFamilyNames, unsupportedGroupWords, dropForeverAdverbs, fixMostWantedWording, unlinkedFigures,
} from "@/lib/script-compliance";

const MODELS = ["claude-opus-5-5", "claude-sonnet-4-6"]; // strongest first; fall back if unavailable

export type FinalCheckResult = { hook: string; body: string; changes: string[]; status: "ok" | "failed" | "skipped" };

function extractJson(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through to salvage */ } }
  // A reply cut off mid-list (seen live: the strongest model's edits were silently lost and the check fell
  // back to the weaker one): keep every COMPLETE edit object.
  const start = text.indexOf('"edits"');
  if (start < 0) return null;
  const objs: any[] = [];
  const re = /\{[^{}]*\}/g;
  for (const o of text.slice(start).match(re) || []) { try { const v = JSON.parse(o); if (v && (v.i !== undefined)) objs.push(v); } catch { /* skip */ } }
  return objs.length ? { edits: objs } : null;
}

export async function finalCheck(input: { hook: string; body: string; title?: string; facts: string; subject?: string }): Promise<FinalCheckResult> {
  const hook = input.hook || "";
  const body = input.body || "";
  const facts = (input.facts || "").trim();
  if (!body.trim() || !facts) return { hook, body, changes: [], status: "skipped" };

  const paras = body.split(/\n\n+/);
  const sentsByPara: string[][] = paras.map((p) => splitSentences(p));
  const all: { pi: number; si: number; text: string }[] = [];
  sentsByPara.forEach((ss, pi) => ss.forEach((text, si) => all.push({ pi, si, text })));
  const texts = all.map((x) => x.text);
  const hookSents = splitSentences(hook);

  // Leads found by code. The editor verifies each against the facts; they are not orders.
  const leads: string[] = [];
  for (const e of eventYearMismatches(texts, facts)) leads.push(e.missingYear
    ? `sentence ${e.i}: "${e.event}" has a month and day but no year, and the last year named before it is ${e.said}; the research has ${e.research}: add the year`
    : `sentence ${e.i}: "${e.event}" placed in ${e.said}; the research has ${e.research}`);
  for (const a of ageYearMismatches(texts, facts)) leads.push(`sentence ${a.i}: age ${a.said} in ${a.year}; by the research's ages and dates the person was about ${a.expected}`);
  for (const r of retoldFacts(texts, all.map((x) => x.pi)).slice(0, 12)) leads.push(`sentence ${r.i}: re-tells the fact in sentence ${r.same_as}`);
  texts.forEach((t, i) => { const fv = foreverContradicted(t, facts); if (fv) leads.push(`sentence ${i}: "${fv}" is an absolute the research's later arrest or discovery disproves: drop it`); });
  texts.forEach((t, i) => { for (const g of unsupportedGroupWords(t, facts)) leads.push(`sentence ${i}: "${g}" isn't how the research describes the group: use its own wording`); });
  // The opening paragraphs re-staging the hook's scene (seen live: the airport camera, khaki shorts and
  // red cap told in the hook and again in paragraph two).
  { const stem = (t: string) => new Set((t.toLowerCase().match(/[a-z]{5,}/g) || []).map((w) => w.slice(0, 6)));
    const hookStems = stem(hook);
    all.forEach((x, i) => { if (x.pi > 2 || !hookStems.size) return; const st = [...stem(x.text)]; const shared = st.filter((w) => hookStems.has(w)); if (st.length >= 5 && shared.length >= 4 && shared.length / st.length >= 0.5) leads.push(`sentence ${i}: re-stages the hook's scene the viewer just heard: cut it or keep only what's new`); }); }
  texts.forEach((t, i) => { for (const u of unlinkedFigures(t, facts)) leads.push(`sentence ${i}: joins ${u.figures.join(" and ")} as if one figure, but no fact gives them together: separate them or say what each measures`); });
  for (const g of repeatedFigureExplanations(texts)) leads.push(`sentences ${g.idx.join(", ")} each set ${g.pair} side by side: keep ONE clear explanation of the difference (the first), and remove or shorten the others so the figures aren't re-explained`);

  const system = `You are the final pre-publication editor of a documentary YouTube voiceover script. It has already been drafted and fact-checked sentence by sentence; you read the WHOLE script once, against the research, the way a careful producer does before recording. Fix ONLY real problems in these classes:

1. WRONG SPECIFICS: a year for an event that the research dates differently (check datelines like "July 2008." and everything under them), an age that doesn't fit the date it's stated at, a number, name, place, or duration the research contradicts or never states ("six weeks before" when the research says only "April").
2. INTERNAL CONTRADICTIONS: two figures for one quantity with no explanation (state why they differ, from what the research says about each, ONCE, where the second figure first appears; never state both as the same total, and never explain the same gap twice), and the reverse, a sentence comparing two figures that measure different things ("$11,400 owed to the victim, a separate figure from the $800 he paid for papers"): drop the comparison; two different accounts of the same event (how someone was found, who reported what) left unreconciled; a person described two incompatible ways.
3. CHRONOLOGY SLIPS: an event told under the wrong scene or dateline (a confession at the arrest placed under the sentencing date), or a claim that something was true at a time it wasn't (working at a place before it existed in the research's timeline).
4. UNSUPPORTED CERTAINTY: a motive, thought, secret, or private detail stated as fact that the research doesn't give ("he didn't tell her", "he watched it happen"), or one person's account stated as plain truth when the research attributes it, including the subject's OWN account from a memoir, interview, or letter ("he crossed a border" when only his memoir says so): attribute it ("by his own account"). Facts tagged [his own account] or [family account] in the research are exactly these. The subject's family members (spouse, children, parents, siblings) are referred to by relationship ("his wife", "his son", "his daughter"), never by name; a minor at the time (a child or teen at home, one being taught to drive) most of all, even if no age is given. A step of an event the research doesn't describe ("walked off the ferry" when it only says he boarded and threw things overboard) is an unsupported specific. Soften to what the research supports, or attribute it.
5. BROKEN TEXT: a sentence that doesn't parse; a fragment that only worked after a sentence that is gone; a line that announces something that never comes ("he made one more stop" with no stop); a reference to something the script never introduced ("the death declaration" before any court declared him dead: add the minimal setup). Narration about the video itself ("the next part of this story").
6. RE-TOLD FACTS: a later passage that re-explains a fact the script already delivered, including the opening scene staged twice (the hook sets a scene, then the next lines set the same scene again with a fresh dateline): keep the first, cut the second. Cut it, or shrink it to a few-word back-reference if it's needed for flow. Keep it if it adds a new fact.

RULES: Never mention "the research", "the record", "the facts", "sources", or the script itself in the narration: the viewer hears a documentary, not a fact-check (say "reports differ" or attribute to who reported it). The smallest edit that fixes each problem. Every specific you write must be in the research. Keep the creator's voice and rhythm; never polish style for its own sake; leave good lines alone. No em dashes. Quote marks only around words quoted in the research. At most 25 edits. Most sentences need nothing.

Output ONLY JSON: {"edits":[{"i":"<sentence index, or H0/H1 for the hook>","action":"rewrite"|"cut"|"insert_after","text":"<new sentence(s); for insert_after, the short line to add right after that sentence>","why":"<one plain line>"}]}`;

  const user = `RESEARCH (the only permitted source of specifics):
"""
${facts.slice(0, 45000)}
"""
${input.title ? `\nTITLE: ${input.title}\n` : ""}${leads.length ? `\nLEADS FOUND BY CODE (verify each against the research; fix the real ones):\n${leads.join("\n")}\n` : ""}
HOOK SENTENCES (the script's opening; the script sentences below follow it directly, so never cut the hook as a repeat):
${hookSents.map((x, i) => `H${i}. ${x}`).join("\n")}

SCRIPT SENTENCES (index. text), paragraphs separated by blank lines:
${all.map((x, i) => `${i > 0 && all[i - 1].pi !== x.pi ? "\n" : ""}${i}. ${x.text}`).join("\n")}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  let parsed: any = null, used = "";
  for (const model of MODELS) {
    try {
      const msg = await client.messages.create({ model, max_tokens: 12000, system, messages: [{ role: "user", content: user }] });
      const text = msg.content.filter((c) => c.type === "text").map((c: any) => c.text).join("\n");
      parsed = extractJson(text);
      if (parsed && Array.isArray(parsed.edits)) { used = model; if (msg.stop_reason === "max_tokens") console.log(`[final-check] ${model} reply was cut off; salvaged ${parsed.edits.length} complete edits`); break; }
      // Say WHY before falling back, so a silent downgrade can't hide again.
      console.error(`[final-check] ${model} unusable reply (stop=${msg.stop_reason}, ${text.length} chars): ${text.slice(0, 200).replace(/\s+/g, " ")}`);
    } catch (e: any) {
      console.error(`[final-check] ${model} failed: ${e?.message || e}`);
    }
  }
  if (!parsed || !Array.isArray(parsed.edits)) return { hook, body, changes: [], status: "failed" };

  const changes: string[] = [];
  let applied = 0, refused = 0, cuts = 0;
  const MAX_CUTS = Math.max(3, Math.floor(all.length * 0.08));
  const hookOut = [...hookSents];
  const clean = (t: string) => t.trim().replace(/\s*(?:—|–|--)\s*/g, ", ");
  // Pipeline words in the narration (seen live: "...and the research doesn't explain the gap").
  const META = /\b(?:the|our|my|its) (?:research|record|records|facts|fact sheet|sources?)\b|\bthis (?:script|video)\b|\bthe (?:next|second|final) (?:part|half) of (?:this|the) story\b|\b(?:reports?|sources?|records?|accounts?) (?:don't|do not|doesn't|does not) (?:explain|say|resolve|account for|reconcile)\b/i;
  const newMeta = (orig: string, rw: string) => META.test(rw) && !META.test(orig);
  const guardsOk = (orig: string, rw: string) =>
    quoteBalanceKept(orig, rw) && !attributionMismatch(orig, rw, facts.split("\n")) && !introducesUnsupportedName(orig, rw, facts) && !newMeta(orig, rw);

  for (const e of parsed.edits.slice(0, 25)) {
    const action = String(e?.action || "");
    const text = typeof e?.text === "string" ? clean(e.text) : "";
    const why = typeof e?.why === "string" ? e.why.trim().slice(0, 160) : "";
    const key = String(e?.i ?? "");
    if (/^H\d+$/.test(key)) {
      const h = Number(key.slice(1));
      if (h < 0 || h >= hookOut.length || action !== "rewrite" || !text) { refused++; continue; }
      if (text.length > hookOut[h].length * 2.5 + 200 || !guardsOk(hookOut[h], text)) { refused++; continue; }
      hookOut[h] = text; applied++; if (why) changes.push(why);
      continue;
    }
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx >= all.length) { refused++; continue; }
    const t = all[idx];
    const cur = sentsByPara[t.pi][t.si];
    if (cur !== t.text) { refused++; continue; } // already edited this run
    if (action === "cut") {
      if (cuts >= MAX_CUTS) { refused++; continue; }
      sentsByPara[t.pi][t.si] = ""; cuts++; applied++; if (why) changes.push(why);
    } else if (action === "rewrite") {
      if (!text || text === cur || text.length > cur.length * 2.5 + 250 || !guardsOk(cur, text)) { refused++; continue; }
      sentsByPara[t.pi][t.si] = text; applied++; if (why) changes.push(why);
    } else if (action === "insert_after") {
      if (!text || text.length > 260 || !quoteBalanceKept("", text) || introducesUnsupportedName("", text, facts) || META.test(text)) { refused++; continue; }
      sentsByPara[t.pi][t.si] = `${cur} ${text}`; applied++; if (why) changes.push(why);
    } else refused++;
  }

  let outBody = sentsByPara.map((ss) => ss.filter(Boolean).join(" ").trim()).filter(Boolean).join("\n\n");
  outBody = fixMostWantedWording(dropForeverAdverbs(replaceFamilyNames(expandNounContractions(stripStoryMeta(stripStutters(outBody).text).text).text, facts, input.subject || "").text, facts).text, facts).text;
  // A rewrite pass must not gut the script.
  if (outBody.split(/\s+/).length < body.split(/\s+/).length * 0.85) {
    console.log("[final-check] backed off: result too short");
    return { hook, body, changes: [], status: "failed" };
  }
  console.log(`[final-check] model=${used} leads=${leads.length} edits=${parsed.edits.length} applied=${applied} cuts=${cuts} refused=${refused}`);
  return { hook: replaceFamilyNames(hookOut.join(" ").trim() || hook, facts, input.subject || "").text, body: outBody, changes, status: "ok" };
}
