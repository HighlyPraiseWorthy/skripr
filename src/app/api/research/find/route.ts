import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { findResearch, resolveSubjects, deepenCaseFacts } from "@/lib/research";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { topic, angle, niche, action, caseName, caseSummary, sourcePayoff } = await req.json();

    // "deepen": a case is already chosen; fetch the documentary-critical named
    // specifics (Claude questions -> Perplexity sourced answers). sourcePayoff, when
    // present, biases the questions toward reproducing what made a source video work.
    if (action === "deepen") {
      const result = await deepenCaseFacts({ caseName, summary: caseSummary, niche, sourcePayoff: typeof sourcePayoff === "string" ? sourcePayoff : undefined });
      return NextResponse.json({ facts: result.facts });
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
