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

export type ResearchResult =
  | { ok: true; verdict: ResearchVerdict; verdictNote: string; facts: ResearchFact[]; citations: string[] }
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
  | { ok: true; candidates: SubjectCandidate[] }
  | { ok: false; error: string };

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

  const prompt = `You are fact-checking a premise BEFORE a script is written about it. Work in two steps and do not skip step 1.

${subject}${input.niche ? `\nNICHE: ${input.niche}` : ""}

STEP 1 — VERIFY THE PREMISE. Search for sources that describe THIS SPECIFIC event, case, person, or claim. Do NOT assume it is real. Do NOT substitute loosely related material from the same subject area and treat it as confirmation. Decide one verdict:
- "documented": real citable sources describe this specific event or claim.
- "partial": the general subject is real and documented, but this SPECIFIC event, case, framing, or causal claim is NOT something you can find sources for.
- "unverified": you cannot find any source describing this specific event or claim. Sounding plausible is not evidence. If it appears to be invented, fictional, or a mashup of unrelated real things, this is the correct verdict.

Be strict. If you are reaching, choose "partial" or "unverified". A wrong "documented" leads to a creator stating fabrication on camera as fact.

STEP 2 — FACTS. If the verdict is "documented", return the 5-8 most useful specific facts (real numbers, dates, named findings) with sources. If "partial", return only facts about the REAL surrounding subject that you can genuinely source, and never facts that imply the unverified specific claim is true. If "unverified", return an empty facts array.

Only include a fact you can attribute to a real source URL. Output ONLY this JSON, no prose:
{"verdict":"documented|partial|unverified","verdictNote":"one plain sentence stating what the record does and does not show about this specific claim","facts":[{"fact":"the specific fact, including the exact number","source":"the source URL it comes from"}]}`;

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", temperature: 0.2, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { ok: false, error: `Research lookup failed (${res.status}).` };
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content || "";
    const citations: string[] = Array.isArray(data?.citations) ? data.citations.filter((c: any) => typeof c === "string") : [];

    let facts: ResearchFact[] = [];
    let verdict: ResearchVerdict = "unverified";
    let verdictNote = "";
    try {
      // Object shape now (verdict + facts). Fall back to a bare array so an older
      // response shape still parses rather than throwing the whole lookup away.
      // Pick by whichever delimiter comes FIRST: a greedy {...} match would
      // otherwise grab the first element out of a bare array and lose the rest.
      const objAt = content.indexOf("{");
      const arrAt = content.indexOf("[");
      const useArray = arrAt !== -1 && (objAt === -1 || arrAt < objAt);
      const m = useArray ? content.match(/\[[\s\S]*\]/) : content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : content);
      const rawFacts = Array.isArray(parsed) ? parsed : parsed?.facts;
      if (Array.isArray(parsed)) {
        // No verdict in a bare array: unknown, not confirmed.
        verdict = "partial";
        verdictNote = "";
      } else {
        const v = String(parsed?.verdict || "").toLowerCase();
        verdict = v === "documented" || v === "partial" ? v : "unverified";
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
          .slice(0, 8);
      }
    } catch { /* unparseable — treat as unverified, citations still returned */ }

    // An unverified premise is a RESULT worth reporting, not a failure. The old
    // code only failed when facts AND citations were both empty, which for any
    // plausible-sounding topic never happened, so the failure branch was
    // effectively dead and every premise looked grounded.
    if (verdict === "unverified" && facts.length === 0 && citations.length === 0 && !verdictNote) {
      return { ok: false, error: "Nothing came back for this topic. Try more specific wording, or paste your own sources below." };
    }
    return { ok: true, verdict, verdictNote, facts, citations };
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
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { ok: false, error: "Research sourcing isn't set up yet." };
  const topic = (input.topic || "").slice(0, 200);
  if (!topic.trim()) return { ok: false, error: "Add a topic first." };

  const prompt = `A creator wants to make a documentary video with this title or topic:
"${topic}"${input.niche ? `\nNICHE: ${input.niche}` : ""}

This is a TITLE, not a factual claim, so do not judge whether it is "true". Identify the REAL, DOCUMENTED people, cases, or events this title could actually be about, so the creator can build the video on a real story instead of an invented one.

Rules:
- Return 1 to 4 candidates, MOST LIKELY FIRST.
- Each must be a genuinely documented case you can cite. Never invent a case, a name, or a date to fill a slot.
- Prefer the case a viewer would consider the definitive match for this title.
- If the title is broad, include the strongest specific cases that fit it.
- If you truly cannot find any real case matching this title, return an empty array. An empty array is a valid, useful answer.

Output ONLY this JSON, no prose:
{"candidates":[{"name":"the person, case, or event","summary":"1-2 sentences on what actually happened","when":"year or range","whyItFits":"one sentence on how it matches the title","sources":["url"]}]}`;

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", temperature: 0.2, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return { ok: false, error: `Subject lookup failed (${res.status}).` };
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content || "";
    const fallbackCitations: string[] = Array.isArray(data?.citations) ? data.citations.filter((c: any) => typeof c === "string") : [];

    let candidates: SubjectCandidate[] = [];
    try {
      const m = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : content);
      const raw = Array.isArray(parsed) ? parsed : parsed?.candidates;
      if (Array.isArray(raw)) {
        candidates = raw
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
          // A candidate with no citable source is exactly what this feature exists
          // to prevent, so drop it rather than offering an unsourced "real" case.
          .filter((c: SubjectCandidate) => c.sources.length > 0 || fallbackCitations.length > 0)
          .map((c: SubjectCandidate) => ({ ...c, sources: c.sources.length ? c.sources : fallbackCitations.slice(0, 2) }))
          .slice(0, 4);
      }
    } catch { /* unparseable — no candidates */ }

    return { ok: true, candidates };
  } catch (e: any) {
    return { ok: false, error: e?.name === "TimeoutError" ? "Subject lookup timed out." : (e?.message || "Subject lookup failed.") };
  }
}
