import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { findResearch, resolveSubjects, deepenCaseFacts } from "@/lib/research";
import { fetchCaseSaturation } from "@/lib/case-saturation";
import { getLibrary, addToLibrary, setDismissed, activeFacts } from "@/lib/fact-library";

// Retry-on-refusal adds a reformulate + second Perplexity round, so the deepen
// path can chain up to five sequential model calls. vercel.json is authoritative;
// this matches it so local/dev behaviour lines up.
export const maxDuration = 90;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { topic, angle, niche, action, caseName, caseSummary, sourcePayoff, sourceSubject, kind, topicAnchor, targetFacts, targetMinutes } = body;

    // "deepen": a case is already chosen; fetch the documentary-critical named
    // specifics (Claude questions -> Perplexity sourced answers). sourcePayoff, when
    // present, biases the questions toward reproducing what made a source video work.
    if (action === "deepen") {
      const result = await deepenCaseFacts({ caseName, summary: caseSummary, niche, sourcePayoff: typeof sourcePayoff === "string" ? sourcePayoff : undefined, sourceSubject: typeof sourceSubject === "string" ? sourceSubject : undefined, userId, kind, topicAnchor: typeof topicAnchor === "string" ? topicAnchor : undefined, targetFacts: typeof targetFacts === "number" ? targetFacts : undefined, targetMinutes: typeof targetMinutes === "number" ? targetMinutes : undefined });
      return NextResponse.json({ facts: result.facts, conflicts: result.conflicts, status: result.status, caseName: result.caseName, when: result.when, factCount: result.factCount, contextCount: result.contextCount, honestMinutes: result.honestMinutes, requestedMinutes: result.requestedMinutes, budget: result.budget });
    }

    // The user's accumulating fact library for a topic. "library" reads it, "library-add"
    // appends facts they pasted themselves, "library-dismiss" hides ones they don't want.
    // Nothing here ever deletes a fact — hiding is reversible.
    //
    // These MUST key on the same anchor the deepen path writes under, or user-pasted
    // facts and dismissals land in a different row from the deepened facts and never
    // merge. deepenCaseFacts keys on topicAnchor (the stable remix title) whenever it is
    // given, falling back to the drifting case name — so mirror that fallback here.
    const libTopic = (typeof topicAnchor === "string" && topicAnchor.trim())
      ? topicAnchor
      : (typeof caseName === "string" ? caseName : "");
    if (action === "library") {
      const lib = await getLibrary(userId, libTopic);
      return NextResponse.json({ library: activeFacts(lib), dismissed: lib.dismissed, total: lib.facts.length });
    }
    if (action === "library-add") {
      const incoming = Array.isArray(body.facts) ? body.facts : [];
      const lib = await addToLibrary(userId, libTopic, incoming, { manual: true, topicLabel: caseName || libTopic });
      return NextResponse.json({ library: activeFacts(lib), dismissed: lib.dismissed, total: lib.facts.length });
    }
    if (action === "library-dismiss") {
      await setDismissed(userId, libTopic, Array.isArray(body.dismissed) ? body.dismissed : []);
      const lib = await getLibrary(userId, libTopic);
      return NextResponse.json({ library: activeFacts(lib), dismissed: lib.dismissed, total: lib.facts.length });
    }

    // "saturation": how heavily YouTube already covers this case. Shown on the confirm
    // card so the creator learns a case is saturated (or is really a famous film) while
    // the choice is still cheap, instead of after a script is written.
    if (action === "saturation") {
      const result = await fetchCaseSaturation(typeof caseName === "string" ? caseName : "");
      return NextResponse.json({ saturation: result });
    }

    // "resolve": the topic is a video TITLE, not a claim. Find the real documented
    // cases it could be about, so an unsourced premise becomes a sourced one
    // instead of a dead end.
    if (action === "resolve") {
      const result = await resolveSubjects({ topic, niche });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
      return NextResponse.json({ kind: result.kind, candidates: result.candidates });
    }

    const result = await findResearch({ topic, angle, niche });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
    return NextResponse.json({
      kind: result.kind,
      verdict: result.verdict,
      verdictNote: result.verdictNote,
      facts: result.facts,
      citations: result.citations,
      candidates: result.candidates,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Research lookup failed" }, { status: 500 });
  }
}
