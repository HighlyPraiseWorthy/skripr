import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateScript } from "@/lib/ai/claude";
import { getProfileId, checkLimit, incrementUsage } from "@/lib/usage/tracking";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Check usage limit for free tier
    const profileId = await getProfileId(userId);
    if (profileId) {
      const { allowed, current, limit } = await checkLimit(profileId, "scripts_generated");
      if (!allowed) {
        return NextResponse.json(
          {
            error: `Free tier limit reached (${current}/${limit} scripts this month). Upgrade to Pro for unlimited generation.`,
            limitReached: true,
            current,
            limit,
          },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const script = await generateScript({
      sourceTranscript: body.transcript || body.sourceTranscript,
      sourceTitle: body.sourceTitle || "",
      sourceNiche: body.sourceNiche || body.niche || "",
      targetTopic: body.targetTopic || body.topic || "",
      targetNiche: body.targetNiche || body.niche || "",
      videoLength: body.videoLength || "medium",
      tone: body.tone || "educational",
      ttsOptimized: body.ttsOptimized !== false,
    });

    // Increment usage counter
    if (profileId) {
      await incrementUsage(profileId, "scripts_generated");
    }

    return NextResponse.json(script);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate script" }, { status: 500 });
  }
}
