import { Anthropic } from "@anthropic-ai/sdk";

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return _anthropic;
}

// Auto-sourcing via Perplexity Sonar. Given a topic/angle, fetch real,
// citable facts so the script can be grounded in verifiable numbers. Returns
// facts each paired with a source URL for the user to approve/verify. Dormant
// until PERPLEXITY_API_KEY is set — callers surface the error gracefully.

export interface ResearchFact { fact: string; source: string | null }

// Whether the record actually supports the premise the script is about to assert.
//   documented  a real, citable source describes THIS specific event or claim
//   partial     the subject area is real, but this specific framing is not documented
//   unverified  nothing found describing this specific event or claim
export type ResearchVerdict = "documented" | "partial" | "unverified";

// What KIND of question the topic is. This has to be settled before grounding,
// because "is this claim true" is only the right question for one of them.
//   event        a specific real thing that happened (documentary, true crime, history)
//   explainer    how something works, no single incident (the Kurzgesagt lane)
//   hypothetical a counterfactual, deliberately not something that happened
//   claim        an assertion about people, markets, or trends
//
// Without this, a topic like "What If the Earth Stopped Spinning" gets fact-checked
// as an event, comes back unverified because the Earth has not stopped spinning,
// and the script is then barred from stating specifics — which guts a science
// explainer, since specifics are the whole product. The no-invented-specifics gate
// applies to unresolved EVENTS only.
export type TopicKind = "event" | "explainer" | "hypothetical" | "claim";

export type ResearchResult =
  | {
      ok: true;
      kind: TopicKind;
      verdict: ResearchVerdict;
      verdictNote: string;
      facts: ResearchFact[];
      citations: string[];
      candidates: SubjectCandidate[];
    }
  | { ok: false; error: string };

// A real, documented case that a proposed video title could actually be about.
// Creators type titles ("The Hunt for the Man Who Sold America's Satellites"),
// not claims, and a title is not a falsifiable statement — so verifying it as one
// is the wrong question. The right question is "which real story is this?", which
// for that title is Christopher Boyce or William Kampiles. Resolving the subject
// turns an unsourced premise into a documented one instead of a dead end.
export interface SubjectCandidate {
  name: string;        // the person, case, or event
  summary: string;     // one or two sentences on what actually happened
  when: string;        // year or range, "" when genuinely unclear
  whyItFits: string;   // how it matches the creator's title
  sources: string[];   // citable URLs
}
export type ResolveResult =
  | { ok: true; kind: TopicKind; candidates: SubjectCandidate[] }
  | { ok: false; error: string };

// A candidate that argues against itself. The model is asked to omit cases that do
// not fit the title and instead returns them with an explanation attached ("this
// was a corporate acquisition, not the sale of America's satellites in the sense
// implied by the title"). That admission is a reliable signal, so it is enforced
// here rather than left to the prompt, which demonstrably does not hold.
function selfNegating(c: SubjectCandidate): boolean {
  const text = `${c.summary} ${c.whyItFits}`.toLowerCase();
  return [
    /\bnot a (crime|manhunt|criminal|murder|theft|sale|case of)\b/,
    /\bnot the (sale|story|case|event)\b/,
    /\bnot in the sense\b/,
    /\bnot about\b/,
    /\bnot directly (related|connected|about)\b/,
    /\brather than a\b/,
    /\bdoes not (match|fit|involve|describe)\b/,
    /\bis a business (origin )?story\b/,
    /\bnot an? (espionage|spy|criminal)\b/,
    /\bthis is (a )?(policy|corporate|business|legal) (story|matter|dispute|debate)\b/,
    /\bonly loosely\b/,
    /\bnot the same as\b/,
  ].some((re) => re.test(text));
}

// Shared by findResearch and resolveSubjects. A candidate with no citable source
// is exactly what this feature exists to prevent, so it is dropped rather than
// offered as a "real" case the creator might trust.
function normalizeCandidates(raw: any, fallbackCitations: string[], allowSourceless = false): SubjectCandidate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c: any) => c && typeof c.name === "string" && c.name.trim())
    .map((c: any) => ({
      name: String(c.name).trim().slice(0, 160),
      summary: typeof c.summary === "string" ? c.summary.trim().slice(0, 500) : "",
      when: typeof c.when === "string" ? c.when.trim().slice(0, 40) : "",
      whyItFits: typeof c.whyItFits === "string" ? c.whyItFits.trim().slice(0, 300) : "",
      sources: (Array.isArray(c.sources) ? c.sources : [])
        .filter((u: any) => typeof u === "string" && /^https?:\/\//.test(u))
        .slice(0, 4),
    }))
    .filter((c: SubjectCandidate) => !selfNegating(c))
    // Claude-named candidates carry no URLs; sourcing is enforced downstream when
    // the chosen case's facts are fetched from Perplexity, so allow them through.
    .filter((c: SubjectCandidate) => allowSourceless || c.sources.length > 0 || fallbackCitations.length > 0)
    .map((c: SubjectCandidate) => ({ ...c, sources: c.sources.length ? c.sources : fallbackCitations.slice(0, 2) }))
    .slice(0, 4);
}

export async function findResearch(input: { topic: string; angle?: string; niche?: string }): Promise<ResearchResult> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { ok: false, error: "Research sourcing isn't set up yet." };
  const topic = (input.topic || "").slice(0, 200);
  if (!topic.trim()) return { ok: false, error: "Add a topic first." };
  const angle = (input.angle || "").slice(0, 220);

  // VERIFY BEFORE SUBSTANTIATING. This used to ask for facts that "SUBSTANTIATE
  // this specific angle", which is confirmation-seeking: given a premise that is
  // not a real documented event, the search returns the nearest real material in
  // the topic area, and the script then wraps genuine citations around an
  // invented story. That is the most damaging failure mode for a documentary
  // channel, because the verifiable part lends its credibility to the invented
  // part. So step one is always "does the record describe this at all", and the
  // verdict travels with the facts.
  const subject = angle ? `CLAIM / ANGLE the video intends to assert: "${angle}"\nTOPIC AREA: ${topic}` : `CLAIM / TOPIC the video intends to assert: "${topic}"`;

  const prompt = `You are preparing research for a video script. Do two steps in order and do not skip step 1.

${subject}${input.niche ? `\nNICHE: ${input.niche}` : ""}

STEP 1 — CLASSIFY the topic as exactly one "kind":
- "event": a specific real thing that happened, or a specific person, case, or organisation's actions. Documentaries, true crime, history, investigations.
- "explainer": how something works or what something is, with no single incident at its centre. Science and technology explainers.
- "hypothetical": a counterfactual or thought experiment, deliberately NOT something that happened ("what if the Earth stopped spinning", "what happens if every glacier melts").
- "claim": an assertion about people, behaviour, markets, or trends rather than one incident ("why nobody can focus any more").

STEP 2 — ground it according to that kind. This matters: applying the wrong one produces a useless answer.

IF "event":
  COVER THE WHOLE STORY, not just the triggering incident. A script needs facts for every act, and research that returns only the arrest leaves the writer nothing to stand on for the setup or the aftermath, so those parts come out hedged or invented. Deliberately spread the facts across:
   - the PEOPLE: who they were, ages, jobs, employers, how they got their access, background and family details where documented
   - the MECHANISM: how it actually worked, named programs, documents, or systems involved
   - the MONEY or stakes: amounts, and who received what
   - the OUTCOME: charges, dates, verdicts, sentences
   - the AFTERMATH and what remains unknown or disputed
  A stated MOTIVE counts as a fact worth sourcing when the record documents the person claiming it, so include it and attribute it to who said it.
  Search for sources describing THIS SPECIFIC event, case, or person. Do NOT assume it is real and do NOT substitute loosely related material from the same subject area as confirmation. Set "verdict":
   - "documented": real citable sources describe this specific event.
   - "partial": the surrounding subject is real but this specific event, framing, or causal claim is not something you can source.
   - "unverified": nothing describes this specific event. Sounding plausible is not evidence.
  Be strict; if you are reaching, choose "partial" or "unverified". A wrong "documented" puts fabrication in a creator's mouth on camera.
  ALSO fill "candidates": the real, documented cases this title could actually be about, best match FIRST, up to 4. A creator types a TITLE, not a claim, so naming the real story is more useful than rejecting the title.
  HOW TO FIND THEM: do not just search the title as a keyword string. That surfaces recent, heavily indexed, loosely related material and misses the famous case. Instead, first BREAK THE TITLE INTO ITS REQUIRED ELEMENTS, then look for a case that satisfies ALL of them. For "The Hunt for the Man Who Sold America's Satellites" the elements are: one identified individual (not a company or a policy), who sold or passed satellite material to a foreign power, plus a pursuit, manhunt, escape, or investigation. A corporate technology transfer satisfies the "satellites" element and fails every other one, so it is NOT a match.

  Rules for candidates, all of them strict:
  - A candidate must satisfy EVERY element of the title, not just the subject matter. Matching only the topic area is the most common way to get this wrong.
  - A NUMBER in the title is a HARD FILTER. If the title says "30 years", a case that lasted 6 years does not qualify no matter how famous it is; drop it. Do not let a well-known case that fails the number crowd out a lesser-known case that matches it. The specific constraint outranks fame every time.
  - ONLY include a case that genuinely fits. If you would have to explain that it does not really fit, LEAVE IT OUT. One strong candidate beats four near misses, and a candidate whose own description concedes it is not really this story is worse than no candidate at all. Do NOT write summaries containing phrases like "this is not a crime or manhunt" or "not in the sense implied by the title": if that is true, the case does not belong in the list.
  - Returning an EMPTY candidates array is a valid and useful answer when nothing genuinely fits. It is much better than padding.
  - Search the WHOLE historical record, not just recent or heavily indexed events. The definitive case for a title like this is often decades old and predates most web coverage. Do not let recency bias push a minor recent case above the famous one. Ask yourself which case a well-read viewer would name if they read this title, and make sure that case is present.
  - Never invent a case to fill a slot. If the event is already fully identified, a single candidate is correct.

IF "explainer":
  Do NOT try to verify it as an event; there is no incident to confirm. Set "verdict" to "documented" when the subject genuinely exists, and return the most useful SPECIFIC sourced facts a script could state (real numbers, scales, mechanisms, named findings). Leave "candidates" empty.

IF "hypothetical":
  Do NOT judge whether the scenario happened. It is counterfactual ON PURPOSE, and marking it unverified would be wrong. Set "verdict" to "documented" when the underlying science or mechanism is real, and return real sourced facts about the mechanisms needed to reason through the scenario (the physics, biology, or economics it depends on). Leave "candidates" empty.

IF "claim":
  Return sourced evidence bearing on the claim, including evidence that complicates it. Set "verdict" by whether real evidence exists: "documented" when it does, "partial" when only adjacent evidence exists, "unverified" when none does. Leave "candidates" empty.

Only include a fact you can attribute to a real source URL. Output ONLY this JSON, no prose:
{"kind":"event|explainer|hypothetical|claim","verdict":"documented|partial|unverified","verdictNote":"one plain sentence on what the record does and does not show","facts":[{"fact":"the specific fact, including the exact number","source":"url"}],"candidates":[{"name":"person, case, or event","summary":"1-2 sentences on what actually happened","when":"year or range","whyItFits":"how it matches the title","sources":["url"]}]}`;

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      // temperature 0: the same topic should not resolve to different cases on
      // different runs. This only pins the language step, not retrieval, since
      // Sonar searches live and the retrieved pages themselves vary, which is why
      // the code below also enforces fit rather than trusting the prompt.
      body: JSON.stringify({ model: "sonar", temperature: 0, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { ok: false, error: `Research lookup failed (${res.status}).` };
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content || "";
    const citations: string[] = Array.isArray(data?.citations) ? data.citations.filter((c: any) => typeof c === "string") : [];

    let facts: ResearchFact[] = [];
    let verdict: ResearchVerdict = "unverified";
    let verdictNote = "";
    let kind: TopicKind = "event";
    let candidates: SubjectCandidate[] = [];
    try {
      // Object shape now. Fall back to a bare array so an older response shape
      // still parses rather than throwing the whole lookup away. Pick by whichever
      // delimiter comes FIRST: a greedy {...} match would otherwise grab the first
      // element out of a bare array and lose the rest.
      const objAt = content.indexOf("{");
      const arrAt = content.indexOf("[");
      const useArray = arrAt !== -1 && (objAt === -1 || arrAt < objAt);
      const m = useArray ? content.match(/\[[\s\S]*\]/) : content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : content);
      const rawFacts = Array.isArray(parsed) ? parsed : parsed?.facts;
      if (Array.isArray(parsed)) {
        // No verdict in a bare array: unknown, not confirmed.
        verdict = "partial";
      } else {
        const v = String(parsed?.verdict || "").toLowerCase();
        verdict = v === "documented" || v === "partial" ? v : "unverified";
        const k = String(parsed?.kind || "").toLowerCase();
        kind = k === "explainer" || k === "hypothetical" || k === "claim" ? k : "event";
        verdictNote = typeof parsed?.verdictNote === "string" ? parsed.verdictNote.trim().slice(0, 400) : "";
      }
      if (Array.isArray(rawFacts)) {
        facts = rawFacts
          .filter((x: any) => x && typeof x.fact === "string" && x.fact.trim())
          .map((x: any, i: number) => ({
            fact: String(x.fact).trim().slice(0, 400),
            // prefer the model's per-fact source; fall back to the citations list by index
            source: (typeof x.source === "string" && /^https?:\/\//.test(x.source)) ? x.source : (citations[i] || null),
          }))
          .slice(0, 12);
      }
    } catch { /* unparseable — treat as unverified, citations still returned */ }

    // A hypothetical or explainer is never "unverified" for the purposes of the
    // script gate: there is no event to confirm. Only an EVENT can fail to resolve.
    if (kind !== "event" && verdict === "unverified" && facts.length > 0) verdict = "partial";

    // An unverified premise is a RESULT worth reporting, not a failure. The old
    // code only failed when facts AND citations were both empty, which for any
    // plausible-sounding topic never happened, so the failure branch was
    // effectively dead and every premise looked grounded.
    if (verdict === "unverified" && facts.length === 0 && citations.length === 0 && !verdictNote && candidates.length === 0) {
      return { ok: false, error: "Nothing came back for this topic. Try more specific wording, or paste your own sources below." };
    }
    // A single-purpose prompt resolves cases far better than the combined one, so
    // Candidate resolution ALWAYS runs on Claude (see resolveSubjects), because
    // Perplexity searches live and buries famous historical cases under recent
    // coverage. Perplexity here only supplies kind, verdict, and facts.
    if (kind === "event") {
      // Anchor case resolution on the ANGLE when there is one, not just the topic.
      // The angle is the real subject ("How a Mobster Infiltrated the FBI for 30
      // Years"); the topic is often the angle's framing ("The Double Life Nobody
      // Suspected"). Passing topic alone made Claude resolve the framing and return
      // psychological-profile cases while Perplexity, which got the angle, returned
      // the correct mob-informant facts. The two must key off the same subject.
      const resolveSubject = input.angle ? `${input.angle}. ${input.topic}` : input.topic;
      const resolved = await resolveSubjects({ topic: resolveSubject, niche: input.niche }).catch(() => null);
      if (resolved?.ok) {
        candidates = resolved.candidates;
        // Claude's classification is also more reliable; if it says this is not an
        // event after all, trust that and drop the (now irrelevant) event verdict.
        if (resolved.kind !== "event") kind = resolved.kind;
      }
    }

    return { ok: true, kind, verdict, verdictNote, facts, citations, candidates };
  } catch (e: any) {
    return { ok: false, error: e?.name === "TimeoutError" ? "Research lookup timed out." : (e?.message || "Research lookup failed.") };
  }
}

/**
 * Given a proposed video topic or title, find the REAL documented cases it could
 * be about. This is the counterpart to findResearch: verification asks "is this
 * claim true", resolution asks "which true story is this". A creator typing
 * "The Hunt for the Man Who Sold America's Satellites" has not invented
 * anything, they have described Christopher Boyce (TRW satellite ciphers sold to
 * the KGB, escaped Lompoc in 1980, recaptured after a 19-month manhunt) or
 * William Kampiles (sold the KH-11 manual to the Soviets in 1978). Refusing that
 * premise as unverified would be the wrong answer; naming the real case is the
 * right one.
 */
export async function resolveSubjects(input: { topic: string; niche?: string }): Promise<ResolveResult> {
  const topic = (input.topic || "").slice(0, 200);
  if (!topic.trim()) return { ok: false, error: "Add a topic first." };

  // Resolution runs on CLAUDE, not Perplexity. A video title is a recall question
  // ("which famous documented case is this?"), and Perplexity searches the live web
  // first, so it surfaces recent, heavily indexed coverage (a corporate tech-transfer
  // controversy) and buries a famous decades-old case. Claude knows these cases from
  // training and names the definitive one reliably. Sourcing is not lost: when the
  // creator picks a case, its facts are fetched from Perplexity with real citations.
  const prompt = `A creator wants to make a video with this title or topic:
"${topic}"${input.niche ? `\nNICHE: ${input.niche}` : ""}

First classify it as one "kind": "event" (a specific real thing that happened, or a specific person/case), "explainer" (how something works), "hypothetical" (a what-if), or "claim" (an assertion about people or trends).

Then, if it is an "event", identify the REAL, DOCUMENTED people or cases this title is most likely about, so the creator builds on a real story instead of an invented one. Use your own knowledge of history, true crime, espionage, and current events. The definitive case is often decades old, so do not assume the title refers to a recent story just because recent stories are easier to recall.

Break the title into its required elements and match ALL of them. For "The Hunt for the Man Who Sold America's Satellites" the elements are: one identified individual (not a company, not a policy debate), who sold or passed satellite material to a foreign power, plus a pursuit, manhunt, escape, or investigation. The definitive match is Christopher Boyce (with Andrew Daulton Lee), the TRW case behind "The Falcon and the Snowman". A corporate technology-transfer controversy matches only the subject area and fails the "one man" and "hunt" elements, so it is NOT a match.

Rules:
- Best match FIRST. Return 1 to 4 candidates for an event, empty for the other kinds.
- Only name a case you are genuinely confident is real and documented. Never invent a case, a name, or a date. If you are not confident any real case fits, return an empty list.
- A candidate must satisfy EVERY element of the title, not just the subject area.
- A NUMBER in the title (like "30 years") is a HARD FILTER: a case that does not match it is disqualified even if it is more famous than the ones that do. The specific constraint outranks fame.
- Never include a case while noting it does not really fit. If it does not fit, omit it.
- Ask which case a well-read viewer would name on reading this title, and make sure it is present.

Output ONLY this JSON, no prose, no markdown:
{"kind":"event|explainer|hypothetical|claim","candidates":[{"name":"the person or case","summary":"1-2 sentences on what actually happened","when":"year or range","whyItFits":"one sentence on how it matches the title"}]}`;

  try {
    const msg = await anthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    const content = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    let kind: TopicKind = "event";
    let candidates: SubjectCandidate[] = [];
    try {
      const m = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : content);
      const k = String(parsed?.kind || "").toLowerCase();
      kind = k === "explainer" || k === "hypothetical" || k === "claim" ? k : "event";
      candidates = normalizeCandidates(parsed?.candidates, [], true);
    } catch { /* unparseable — no candidates */ }
    return { ok: true, kind, candidates };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Subject lookup failed." };
  }
}

// Grounding carried from the topic stage into the ANGLE prompts. Angles used to be
// written before any research ran, so they had no idea Boyce existed and came back
// as "there's a story about someone who allegedly sold satellite technology". The
// specificity has to be available at the angle stage or the cards stay vague.
export interface GroundingContext {
  kind: TopicKind;
  verdict: ResearchVerdict;
  caseName?: string;
  caseSummary?: string;
  when?: string;
  facts?: string[];
  // What the research itself flagged as uncertain ("sources vary on some sentence
  // details"). Fed to the angle prompt so it does not build a load-bearing thesis
  // on a field the research just warned about.
  caveat?: string;
}

export function buildGroundingBlock(g?: GroundingContext | null): string {
  if (!g) return "";
  const lines: string[] = [];

  if (g.caseName) {
    lines.push(`GROUNDED IN A REAL, DOCUMENTED CASE — this is what the video is actually about:`);
    lines.push(`CASE: ${g.caseName}${g.when ? ` (${g.when})` : ""}`);
    if (g.caseSummary) lines.push(`WHAT HAPPENED: ${g.caseSummary}`);
  }
  if (g.facts?.length) {
    lines.push(g.caseName ? "SOURCED FACTS:" : "RESEARCHED FACTS (real, sourced):");
    lines.push(...g.facts.slice(0, 8).map((f) => `- ${f}`));
  }
  if (!lines.length) return "";

  // What to DO with it, which differs by topic kind. Without this the model treats
  // grounding as background colour instead of the substance of the angle.
  const use =
    g.kind === "hypothetical"
      ? `Use these real mechanisms as the engine of each angle. The scenario is a thought experiment, so never claim it happened, but DO reason concretely from the real science above.`
      : g.kind === "explainer"
        ? `Build each angle on a specific mechanism or number above, not on a general observation. "Most people assume X" is a weak angle; a concrete sourced detail is a strong one.`
        : `Every angle must be about THIS case and should use its real names, dates, and figures. Do not retreat into "someone allegedly did X" or "a person with access" when you have been given the actual name. Vagueness reads as not having done the research.`;

  // CLOSED WORLD. Handing over a real case does not stop invention, it relocates
  // it: with Boyce and Lee correctly identified, the model still produced "Lee
  // only received $15,000" (the split actually ran the other way) and invented a
  // reason for his arrest (he was picked up on an unrelated suspicion and found
  // carrying microfilm). Those errors are MORE dangerous than vague ones, because
  // they arrive wrapped in verifiable names and dates, so a reader who checks one
  // detail trusts the rest. Argument stays free; new specifics do not.
  const closedWorld = `USE ONLY THE FACTS ABOVE (critical). Everything factual in your angles must come from the material above. You may interpret it, argue from it, question it, and draw out what it implies. You may NOT add:
- a number, amount, percentage, date, or duration that does not appear above
- a name, place, job title, agency, or document that does not appear above
- a motive, intention, or cause stated as fact when the material above does not state it

If a point needs a figure you were not given, make the point without the figure. If you do not know why someone acted, say the record does not say, or build the angle on something you do know. Where the material above is thin, the honest move is a sharper reading of what IS there, never a plausible-sounding detail that fills the gap. An invented specific inside an otherwise accurate angle is the worst possible outcome: it inherits the credibility of everything true around it.`;

  const caveat = g.caveat
    ? `\n\nRESEARCH CAVEAT (respect this): ${g.caveat} Do NOT build an angle's central claim on any detail this caveat flags as uncertain or disputed. You may still tell the story; just do not hinge a thesis, a title, or a "the real question is..." turn on a shaky specific. Lead with what is solid.`
    : "";
  return `${lines.join("\n")}\n\n${use}\n\n${closedWorld}${caveat}`;
}

/**
 * Deepen the facts for a chosen case. The plain fact fetch returns the surface of
 * a story (who, what, when); a documentary also needs the NAMED specifics that
 * make it credible: the program or system involved, the person's stated motive,
 * how they got their access, the settings by name, the precise outcome. Perplexity
 * on a broad query misses these. So Claude, which knows famous cases in depth,
 * generates the targeted QUESTIONS, and Perplexity answers them WITH CITATIONS.
 * Claude never supplies a fact directly: only sourced answers reach the script, so
 * the anti-fabrication guarantee holds while the grounding gets much richer.
 */
export async function deepenCaseFacts(input: { caseName: string; summary?: string; niche?: string; sourcePayoff?: string; sourceSubject?: string }): Promise<{ facts: ResearchFact[] }> {
  const caseName = (input.caseName || "").slice(0, 200);
  if (!caseName.trim()) return { facts: [] };
  const pkey = process.env.PERPLEXITY_API_KEY;
  // No Perplexity means no citable answers, and Claude-only facts would be
  // unsourced, which is exactly what must not reach the script. Return nothing.
  if (!pkey) return { facts: [] };

  // 1) Claude generates the targeted questions.
  let questions: string[] = [];
  try {
    const msg = await anthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      temperature: 0,
      messages: [{
        role: "user",
        content: `You are a documentary researcher preparing a script about this real case:
CASE: ${caseName}${input.summary ? `\nCONTEXT: ${input.summary}` : ""}${input.sourcePayoff ? `\n\nPAYOFF TO REPRODUCE: this video is modeled on one that worked because of this: "${input.sourcePayoff}". PRIORITIZE questions whose answers would let the script deliver that same kind of payoff on this case. Still cover the basics, but lead with the facts that serve this payoff.` : ""}

List the 6 to 8 most important SPECIFIC, NAMED, VERIFIABLE details a strong documentary on this case must include, phrased as research questions each seeking ONE citable fact. Target these gaps specifically, because they are what makes a script credible and are the first thing a viewer checks:
- the NAMED programs, systems, documents, or operations at the center of the case
- the person's STATED motive (what they said drove them, attributed to them)
- HOW they obtained their access, position, or clearance
- specific SETTINGS or locations by their real names
- the precise OUTCOME: exact charges and key dates
- the SENTENCE EACH person received, as a separate question per person (do not bundle them). When a case has more than one defendant, ask what sentence EACH one got by name, because the contrast between them is often the most striking fact in the story
- the DOCUMENTED ENDING: how the story actually resolved (the verdict, the capture, the trial outcome, the final fate of the key people). This is what a climax must build toward and land on, so it is essential, ask for the specific resolution with its date
- what remains DISPUTED, sealed, or unknown${input.sourceSubject ? `
- THE BRIDGE (highest value): this script remixes a video about "${input.sourceSubject}". Include 1 or 2 questions hunting for a DOCUMENTED, real connection between THIS case and that subject, a shared event, a crossover, a moment where the two worlds touched. A true connection like that is the single strongest cold open a remix can have. Only ask it if such a link might genuinely exist; a fabricated bridge is worse than none.` : ""}

Each question must seek a single concrete fact that can carry a citation. Do not ask open-ended or interpretive questions. Output ONLY a JSON array of question strings, no prose.`,
      }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const m = text.match(/\[[\s\S]*\]/);
    const arr = JSON.parse(m ? m[0] : text);
    if (Array.isArray(arr)) questions = arr.filter((q) => typeof q === "string" && q.trim()).slice(0, 8);
  } catch { /* no questions — nothing to deepen */ }
  if (!questions.length) return { facts: [] };

  // 2) Perplexity answers each question with a real source.
  const prompt = `Case: ${caseName}.${input.summary ? ` ${input.summary}` : ""}

Answer each question below with ONE specific, citable fact and its source URL. If you cannot find a real source for a question, OMIT that question entirely rather than guessing. Accuracy matters more than completeness: a documentary reads these on camera.

QUESTIONS:
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Output ONLY a JSON array, no prose:
[{"fact":"the specific fact, including any exact name, number, or date","source":"the source URL"}]`;

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${pkey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", temperature: 0, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return { facts: [] };
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content || "";
    const citations: string[] = Array.isArray(data?.citations) ? data.citations.filter((c: any) => typeof c === "string") : [];
    const m = content.match(/\[[\s\S]*\]/);
    const arr = JSON.parse(m ? m[0] : content);
    if (!Array.isArray(arr)) return { facts: [] };
    const facts: ResearchFact[] = arr
      .filter((x: any) => x && typeof x.fact === "string" && x.fact.trim())
      .map((x: any, i: number) => ({
        fact: String(x.fact).trim().slice(0, 400),
        source: (typeof x.source === "string" && /^https?:\/\//.test(x.source)) ? x.source : (citations[i] || null),
      }))
      // A fact with no source cannot be vouched for, so it does not reach the script.
      .filter((f: ResearchFact) => !!f.source)
      .slice(0, 10);
    return { facts };
  } catch { return { facts: [] }; }
}
