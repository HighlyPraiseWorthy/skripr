import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { analyzeStructure } from "@/lib/youtube/structural-analysis";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { transcript, title, videoId } = await req.json();
    if (!transcript) return NextResponse.json({ error: "Transcript required" }, { status: 400 });

    const analysis = analyzeStructure(transcript, title || "");
    return NextResponse.json({ ...analysis, videoId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Analysis failed" }, { status: 500 });
  }
}