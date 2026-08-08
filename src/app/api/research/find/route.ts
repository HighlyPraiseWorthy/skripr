import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { findResearch } from "@/lib/research";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { topic, angle, niche } = await req.json();
    const result = await findResearch({ topic, angle, niche });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
    return NextResponse.json({
      verdict: result.verdict,
      verdictNote: result.verdictNote,
      facts: result.facts,
      citations: result.citations,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Research lookup failed" }, { status: 500 });
  }
}
