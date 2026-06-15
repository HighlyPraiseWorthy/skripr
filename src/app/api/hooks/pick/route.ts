import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { saveHookPick } from "@/lib/hook-picks";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { niche, topic, hookText, hookType, predictedRetention } = await req.json();
    if (!hookText || !String(hookText).trim()) {
      return NextResponse.json({ error: "hookText required" }, { status: 400 });
    }
    await saveHookPick({
      user_id: userId,
      niche: niche || null,
      topic: topic || null,
      hook_text: String(hookText),
      hook_type: hookType || null,
      predicted_retention: typeof predictedRetention === "number" ? Math.round(predictedRetention) : null,
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to record pick" }, { status: 500 });
  }
}
