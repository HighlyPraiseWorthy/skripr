import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/db/supabase";
import { checkScriptLimit } from "@/lib/usage";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Enforce plan limits
  const { allowed, plan, used, limit } = await checkScriptLimit(userId);
  if (!allowed) {
    return NextResponse.json({
      error: `You've used ${used}/${limit} scripts this month on the ${plan} plan. Upgrade to save more.`,
      limitReached: true,
      plan,
    }, { status: 403 });
  }

  try {
    const { title, content, niche, topic, wordCount, estimatedDuration, sourceVideoId, structurePattern } = await req.json();
    if (!title || !content) return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    if (!supabaseAdmin) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    const { data, error } = await supabaseAdmin
      .from("scripts")
      .insert({
        user_id: userId,
        title,
        content,
        niche: niche || null,
        topic: topic || null,
        word_count: wordCount || null,
        estimated_duration: estimatedDuration || null,
        source_video_id: sourceVideoId || null,
        structure_pattern: structurePattern || null,
      })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (error: any) {
    console.error("Script save error:", error);
    return NextResponse.json({ error: error.message || "Failed to save script" }, { status: 500 });
  }
}
