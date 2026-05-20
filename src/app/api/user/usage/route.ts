import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkScriptLimit } from "@/lib/usage";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ used: 0, limit: 2, plan: "free", limitReached: false });
  const result = await checkScriptLimit(userId);
  return NextResponse.json({
    used: result.used,
    limit: result.limit,
    plan: result.plan,
    limitReached: !result.allowed,
  });
}
