import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { chooseStructure } from "@/lib/structure-families";
import { normalizeNiche } from "@/lib/viral-frameworks";

// The storytelling step asks which WINNING STRUCTURE (story shape from this niche's outlier videos, or all
// niches' when this one has too little data) fits the creator's research, with the evidence behind it and
// the alternatives. The creator's pick is passed to generation, so it isn't recomputed there.
export const maxDuration = 120;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { niche, topic, angle, sourceMaterial, familyId } = await req.json();
    const facts = String(sourceMaterial || "").split("\n").map((l) => l.replace(/^-\s*/, "").replace(/\s*\(source: [^)]*\)\s*$/, "").trim()).filter(Boolean);
    const chosen = await chooseStructure({ niche: normalizeNiche(niche) || niche || null, facts, angle, topic, familyId: typeof familyId === "string" ? familyId : null });
    return NextResponse.json({ structure: chosen });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Couldn't choose a structure" }, { status: 500 });
  }
}
