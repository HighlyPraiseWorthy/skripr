import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserPlan } from "@/lib/usage";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ plan: "free" });
  const plan = await getUserPlan(userId);
  return NextResponse.json({ plan });
}
