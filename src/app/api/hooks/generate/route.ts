import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateHooks } from "@/lib/ai/claude";
import { getNicheHookExamplesBlock } from "@/lib/viral-frameworks";
import { getKeptHooksBlock } from "@/lib/hook-picks";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { topic, niche, tone, count } = await req.json();
    if (!topic || !niche) return NextResponse.json({ error: "Topic and niche required" }, { status: 400 });

    // Learning layer: inject (a) real high-performing hooks captured for this
    // niche, and (b) hooks creators actually kept (feedback loop). Both helpers
    // are time-boxed and null-safe, so neither ever blocks generation.
    const [nicheFrameworks, keptHooks] = await Promise.all([
      getNicheHookExamplesBlock(niche).catch(() => null),
      getKeptHooksBlock(niche).catch(() => null),
    ]);

    const hooks = await generateHooks({
      topic,
      niche,
      tone: tone || "educational",
      count: count || 10,
      nicheFrameworks: nicheFrameworks || undefined,
      keptHooks: keptHooks || undefined,
    });
    return NextResponse.json({ hooks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate hooks" }, { status: 500 });
  }
}