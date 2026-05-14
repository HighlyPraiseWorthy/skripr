import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/db/supabase";
import { getProfileId, checkLimit, incrementUsage } from "@/lib/usage/tracking";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const profileId = await getProfileId(userId);

    // Check save limit for free tier
    if (profileId) {
      const { allowed, current, limit } = await checkLimit(profileId, "scripts_saved");
      if (!allowed) {
        return NextResponse.json(
          {
            error: `Free tier save limit reached (${current}/${limit} scripts saved this month). Upgrade to Pro for unlimited saves.`,
            limitReached: true,
            current,
            limit,
          },
          { status: 403 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from("scripts")
      .insert({
        user_id: profileId,
        title: body.title || "Untitled Script",
        niche: body.niche || null,
        topic: body.topic || null,
        content: body.content || "",
        word_count: body.wordCount || 0,
        estimated_duration: body.estimatedDuration || 0,
        source_video_id: body.sourceVideoId || null,
        structure_pattern: body.structurePattern || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Increment usage counter
    if (profileId) {
      await incrementUsage(profileId, "scripts_saved");
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error: any) {
    console.error("Save script error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save script" },
      { status: 500 }
    );
  }
}
