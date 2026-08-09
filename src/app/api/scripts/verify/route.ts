import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyScriptFacts } from "@/lib/ai/verify-facts";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { hook, body, title } = await req.json();
    if (!body || !String(body).trim()) {
      return NextResponse.json({ error: "Nothing to verify." }, { status: 400 });
    }
    const result = await verifyScriptFacts({ hook: String(hook || ""), body: String(body), title: title ? String(title) : undefined });
    if (!result.ran) {
      return NextResponse.json({ ran: false, error: "Fact verification isn't available right now." });
    }
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Verification failed" }, { status: 500 });
  }
}
