import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateHooks } from "@/lib/ai/claude";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { topic, niche, tone, count } = await req.json();
    if (!topic || !niche) return NextResponse.json({ error: "Topic and niche required" }, { status: 400 });

    const hooks = await generateHooks({ topic, niche, tone: tone || "educational", count: count || 10 });
    return NextResponse.json({ hooks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate hooks" }, { status: 500 });
  }
}