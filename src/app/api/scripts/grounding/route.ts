import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkSemanticGrounding } from "@/lib/ai/semantic-grounding";

export const maxDuration = 60;

// Semantic grounding: judges the script's substantive claims against the SCOPED facts —
// the ones the selected sections may draw on — keeping vivid retellings of true facts and
// flagging only claims that assert something the facts don't carry. On demand, one call.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { script, facts } = await req.json();
    if (!script || !String(script).trim()) {
      return NextResponse.json({ error: "Nothing to check." }, { status: 400 });
    }
    const result = await checkSemanticGrounding(String(script), Array.isArray(facts) ? facts : []);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Grounding check failed" }, { status: 500 });
  }
}
