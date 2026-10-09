// EVIDENCE-FIRST SECTION WRITING (Evidence Integrity step 4, 2026-10-09; OFF unless a caller opts in).
// The v3 re-score showed the largest class of serious errors is INVENTED DETAIL (163 of 283), with misattachment and
// overstatement next: the section writer composes prose from a large pool and fills gaps with plausible specifics.
// This path reverses the order in which factual content is created:
//   1 EVIDENCE   the section's assigned facts, numbered E1..En (small: the beat's own slice)
//   2 CLAIMS     the writer lists every checkable claim it will make, in story order, each citing fact IDs
//   3 VALIDATE   code: cited IDs exist; every name/number/date in the claim is in the CITED facts (scope is tiny, so
//                this is precise). Then ONE checker call per section reads each claim against its cited facts for the
//                RELATIONSHIP (a fact ID is not proof: "used Goodenough's number to get ID" does not establish which
//                number was used for a casino job). Failure policy, no loop: a rejected claim is replaced by the cited
//                fact's own wording; a claim citing nothing usable is dropped.
//   4 PROSE      the existing writeSection writes from the approved claims only (full freedom of voice, pacing,
//                transitions, emphasis), with the approved claims as its whole factual universe
//   5 GUARD      deterministic: any prose clause that adds a name, number, date or quote found nowhere in the
//                approved claims, the research, or earlier sections is cut (step 3's guard, hard specifics only;
//                no model repair)
import { Anthropic } from "@anthropic-ai/sdk";
import { indexResearch, unsupportedSpecifics, setContext, relevantFacts, fold } from "@/lib/evidence-gate";
import { guardRewrite, type InvariantViolation } from "@/lib/no-new-specifics";

export interface EvidenceClaim { claim: string; facts: string[]; status: "approved" | "replaced_by_fact" | "dropped"; reason?: string }
export interface EvidenceFirstLog { section: number; evidence: string[]; claims: EvidenceClaim[]; guard: InvariantViolation[]; planFailed?: boolean; validateFailed?: boolean }

const client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "", timeout: 240_000, maxRetries: 1 });
const jsonOf = (m: any) => { const t = m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n"); return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); };
const norm = (t: string) => fold(String(t || "")).toLowerCase().replace(/[‘’“”"']/g, "").replace(/[^a-z0-9$%.]+/g, " ").replace(/\.(?!\d)/g, " ").replace(/\s+/g, " ").trim();
const words = (t: string) => norm(t).split(" ").filter((w) => w.length >= 3 || /\d/.test(w));
const quoteIn = (q: string, fact: string) => { const w = words(q); if (w.length < 2) return false; const F = new Set(words(fact)); return w.filter((x) => F.has(x)).length / w.length >= 0.8; };

// Minimal shape of the section spec this path needs (structurally compatible with claude.ts SectionSpec).
export interface EFSpec { name: string; purpose: string; targetWords: number; assignedFacts?: string[]; concept?: string; point?: string; sceneFacts?: string[]; centralQuotes?: string[] }
export interface EFContext { topic: string; title: string; sourceMaterial?: string; alreadyTold?: string; [k: string]: any }
type Writer = (spec: any, index: number, total: number, context: any) => Promise<string>;

export async function writeSectionEvidenceFirst(spec: EFSpec, index: number, total: number, context: EFContext, writer: Writer, log?: EvidenceFirstLog[]): Promise<string> {
  const research = context.sourceMaterial || "";
  const entry: EvidenceFirstLog = { section: index, evidence: [], claims: [], guard: [] };
  log?.push(entry);
  // 1 EVIDENCE: the beat's own facts (+ scene facts and central quotes); if the plan assigned none, the most related.
  let evidence = [...(spec.assignedFacts || []), ...(spec.sceneFacts || [])].map((f) => String(f).trim()).filter(Boolean);
  if (!evidence.length && research) evidence = relevantFacts(`${spec.name} ${spec.purpose} ${spec.point || ""} ${spec.concept || ""}`, research, 12);
  evidence = [...new Set(evidence)].slice(0, 14);
  entry.evidence = evidence;
  if (!evidence.length) return writer(spec, index, total, context); // nothing to anchor to: unchanged behavior
  const E = (i: number) => `E${i + 1}`;
  const evBlock = evidence.map((f, i) => `${E(i)}: ${f}`).join("\n");
  const factOf = (id: string) => { const m = /^E(\d+)$/.exec(String(id || "").trim()); const k = m ? Number(m[1]) - 1 : -1; return k >= 0 && k < evidence.length ? evidence[k] : null; };

  // 2 CLAIMS
  const nClaims = Math.max(4, Math.min(16, Math.round(spec.targetWords / 30)));
  let planned: { claim: string; facts: string[] }[] = [];
  try {
    const j = jsonOf(await client().messages.create({ model: "claude-sonnet-4-6", max_tokens: 3000, temperature: 0.3,
      messages: [{ role: "user", content: `You are planning ONE section of a documentary script before it is written. List the factual claims this section will make, in the order the story will tell them.

SECTION: "${spec.name}" (${index + 1} of ${total}). Its job: ${spec.point || spec.purpose}${spec.concept ? `\nThe video's concept: ${spec.concept}` : ""}
${context.alreadyTold ? `\nALREADY TOLD in earlier sections (do not plan these again):\n"""${String(context.alreadyTold).slice(-1500)}"""\n` : ""}
EVIDENCE (the ONLY facts this section may state):
${evBlock}

Rules for each claim:
- One checkable statement about the real world, restating what its cited facts say. You may combine facts only by citing all of them, and do plain arithmetic on dates or amounts the facts give.
- Add NOTHING the cited facts do not state: no place, time, title, role, manner, motive, scene detail, number, cause or outcome beyond them. If a fact says "left around noon", the claim cannot say "kissed his wife goodbye".
- Keep the facts' own qualifiers: "alleged", "according to", "by his own account", "reported".
- Cite with "facts": ["E2"]. Aim for about ${nClaims} claims; fewer is fine if the evidence is thin.

Output ONLY JSON: {"claims":[{"claim":"...","facts":["E1"]}]}` }] }));
    planned = (Array.isArray(j?.claims) ? j.claims : []).map((c: any) => ({ claim: String(c?.claim || "").trim(), facts: (Array.isArray(c?.facts) ? c.facts : []).map(String) })).filter((c: any) => c.claim);
  } catch (e: any) { entry.planFailed = true; console.warn(`[evidence-first] claim plan failed for section ${index + 1}, writing from the evidence directly: ${e?.message || e}`); }

  // 3 VALIDATE (code, then one relationship check per section)
  const claims: EvidenceClaim[] = planned.map((c) => {
    const cited = c.facts.map(factOf).filter(Boolean) as string[];
    if (!cited.length) return { claim: c.claim, facts: c.facts, status: "dropped", reason: "cites no assigned fact" };
    // Scope: the section's facts + the subject/title + what earlier sections told (a subject's own name or a name another
    // fact in this section establishes is not an invention). The relationship check below handles misattachment.
    const idx = indexResearch([evidence.join("\n"), context.topic, context.title, String(context.alreadyTold || "")].join("\n")); setContext(c.claim);
    const extra = unsupportedSpecifics(c.claim, idx);
    if (extra.length) return { claim: c.claim, facts: c.facts, status: "replaced_by_fact", reason: `not in this section's facts: ${extra.join(", ")}` };
    return { claim: c.claim, facts: c.facts, status: "approved" };
  });
  const toCheck = claims.map((c, i) => ({ c, i })).filter((x) => x.c.status === "approved");
  if (toCheck.length) {
    try {
      const j = jsonOf(await client().messages.create({ model: "claude-opus-5-5", max_tokens: 12000,
        messages: [{ role: "user", content: `Check each planned documentary claim against ONLY the facts it cites. The cited facts are the closed universe; outside knowledge never counts.

For each claim answer:
- "ok": the cited facts state it (paraphrase fine) or it follows by plain arithmetic/rounding from them;
- "unsupported": it adds something the cited facts do not state (a place, time, role, manner, motive, scene detail, number, cause, outcome);
- "misattached": the cited fact has the detail but about a different person, event, time, population or document;
- "overstated": the cited fact says something weaker (hedged, correlational, alleged) than the claim.
Give "quote": the exact span of the cited fact the verdict rests on.

${toCheck.map(({ c, i }) => `[${i}] CLAIM: ${c.claim}\n${c.facts.map((id) => `${id}: ${factOf(id) ?? "(missing)"}`).join("\n")}`).join("\n\n")}

Output ONLY JSON: {"checks":[{"i":0,"verdict":"ok","quote":"...","why":"short"}]}` }] }));
      const seen = new Set<number>();
      for (const ck of Array.isArray(j?.checks) ? j.checks : []) {
        const i = Number(ck?.i); const c = claims[i]; if (!c || c.status !== "approved" || seen.has(i)) continue; seen.add(i);
        const cited = c.facts.map(factOf).filter(Boolean).join(" ");
        if (ck?.verdict !== "ok") { c.status = "replaced_by_fact"; c.reason = `${ck?.verdict}: ${String(ck?.why || "").slice(0, 160)}`; }
        else if (!quoteIn(String(ck?.quote || ""), cited)) { c.status = "replaced_by_fact"; c.reason = "approval quote not found in cited facts"; }
      }
      // A claim the checker skipped is not approved by silence.
      toCheck.forEach(({ i }) => { if (!seen.has(i) && claims[i].status === "approved") { claims[i].status = "replaced_by_fact"; claims[i].reason = "checker gave no verdict"; } });
    } catch (e: any) {
      entry.validateFailed = true; console.warn(`[evidence-first] relationship check failed for section ${index + 1}, falling back to fact wording: ${e?.message || e}`);
      toCheck.forEach(({ i }) => { claims[i].status = "replaced_by_fact"; claims[i].reason = "relationship check failed"; });
    }
  }
  entry.claims = claims;
  // Failure policy (no loop): a rejected claim becomes its cited facts' own wording; the writer may paraphrase it.
  const approved: string[] = [];
  for (const c of claims) {
    if (c.status === "approved") approved.push(c.claim);
    else if (c.status === "replaced_by_fact") for (const id of c.facts) { const f = factOf(id); if (f && !approved.includes(f)) approved.push(f); }
  }
  // A failed or empty plan falls back to the evidence itself, never to the whole research pool.
  const universe = approved.length ? approved : evidence;

  // 4 PROSE: the existing writer, with the approved claims as its assigned facts AND its whole factual universe.
  const lock = `\nEVIDENCE-FIRST (hard): the CLAIMS below are the only facts this section may state, in roughly this order. Narration may connect, frame and dramatize them (transitions, pacing, emphasis, rhetorical questions), but every checkable statement (who, what, when, where, how many, what was said or done, why, a scene detail) must be one of these claims or a plain restatement of one. Do not add a place, time, title, role, manner, motive, physical detail, cause, comparison or outcome they do not state. Keep their qualifiers ("alleged", "according to", "by his own account").\n`;
  const prose = await writer({ ...spec, assignedFacts: universe }, index, total, { ...context, sourceMaterial: `${lock}\nCLAIMS:\n${universe.map((c) => `- ${c}`).join("\n")}` });

  // 5 GUARD: hard specifics only (names, numbers, dates, quotes) against the claims + the full research + earlier
  // sections. Cue words (cause/comparison/attribution) are not checked on fresh prose: they fire on ordinary rhetoric
  // ("the last thing he said to her as himself"); claim-level discipline is steps 2-3's job.
  const allowed = [universe.join("\n"), research, String(context.alreadyTold || ""), String(context.openingHook || "")].join("\n");
  return guardRewrite("", prose, { pass: `evidence_first_s${index + 1}`, evidence: allowed, log: entry.guard, quiet: true, cues: false });
}
