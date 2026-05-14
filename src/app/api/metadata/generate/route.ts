import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateMetadata } from "@/lib/ai/claude";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { script, title, niche, targetKeywords } = await req.json();
    if (!script || !title) return NextResponse.json({ error: "Script and title required" }, { status: 400 });

    const metadata = await generateMetadata({ script, title, niche: niche || "", targetKeywords });
    return NextResponse.json(metadata);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate metadata" }, { status: 500 });
  }
}