import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateHooks } from "@/lib/ai/claude";
import { getNicheFrameworksBlock } from "@/lib/viral-frameworks";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { topic, niche, tone, count } = await req.json();
    if (!topic || !niche) return NextResponse.json({ error: "Topic and niche required" }, { status: 400 });

    // Learning layer: inject real high-performing hooks captured for this niche
    // so the Hook Engine improves as more videos are analyzed across Skripr.
    // Time-boxed and null-safe inside the helper, so it never blocks generation.
    const nicheFrameworks = (await getNicheFrameworksBlock(niche).catch(() => null)) || undefined;

    const hooks = await generateHooks({ topic, niche, tone: tone || "educational", count: count || 10, nicheFrameworks });
    return NextResponse.json({ hooks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate hooks" }, { status: 500 });
  }
}