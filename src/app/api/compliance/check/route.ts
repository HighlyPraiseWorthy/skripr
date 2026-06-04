import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runComplianceCheck } from "@/lib/ai/compliance";
import { getUserPlan } from "@/lib/usage";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Locked — Starter plan or above required
  const plan = await getUserPlan(userId);
  if (plan === "free") {
    return NextResponse.json(
      { error: "Compliance Check requires a Starter plan or above. Upgrade at skripr.vercel.app/dashboard/settings" },
      { status: 403 }
    );
  }

  try {
    const { script, title, niche } = await req.json();
    if (!script) return NextResponse.json({ error: "Script required" }, { status: 400 });

    const report = await runComplianceCheck(script, title || "", niche || "");
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Compliance check failed" }, { status: 500 });
  }
}