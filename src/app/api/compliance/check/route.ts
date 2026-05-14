import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runComplianceCheck } from "@/lib/ai/compliance";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { script, title, niche } = await req.json();
    if (!script) return NextResponse.json({ error: "Script required" }, { status: 400 });

    const report = await runComplianceCheck(script, title || "", niche || "");
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Compliance check failed" }, { status: 500 });
  }
}