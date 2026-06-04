import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { extractVideoId, getTranscript, getVideoMeta } from "@/lib/youtube-transcript";
import { checkScriptLimit } from "@/lib/usage";
import { supabaseAdmin } from "@/lib/db/supabase";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Paywall — counts against 2 scripts/month. Free users get 1 remixer use.
    const { allowed, plan, used, limit } = await checkScriptLimit(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: `Script limit reached (${used}/${limit}). Upgrade to keep remixing at skripr.vercel.app/dashboard/settings` },
        { status: 403 }
      );
    }

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Paywall — counts against 2 scripts/month. Free users get 1 remixer use.
    const { allowed, plan, used, limit } = await checkScriptLimit(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: `Script limit reached (${used}/${limit}). Upgrade to keep remixing at skripr.vercel.app/dashboard/settings` },
        { status: 403 }
      );
    }

    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

    const videoId = extractVideoId(url);
    if (!videoId) return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });

    // Fetch metadata and transcript
    // Transcript: use Supadata (handles YouTube IP blocks from Vercel) then fallback
    const supaKey = process.env.SUPADATA_API_KEY;
    async function fetchTranscriptRobust(id: string): Promise<string> {
      if (supaKey) {
        try {
          console.log("[viral-remixer] Fetching transcript via Supadata for:", id);
          const r = await fetch(
            `https://api.supadata.ai/v1/youtube/transcript?videoId=${id}&text=true`,
            { headers: { "x-api-key": supaKey }, signal: AbortSignal.timeout(15000) }
          );
          console.log("[viral-remixer] Supadata status:", r.status);
          if (r.ok) {
            const d = await r.json();
            const t = typeof d === "string" ? d : (d.content ?? d.transcript ?? d.text ?? "");
            console.log("[viral-remixer] Supadata transcript length:", t.length);
            if (t.trim()) return t;
            console.warn("[viral-remixer] Supadata returned ok but empty transcript");
          } else {
            const errBody = await r.text().catch(() => "");
            console.error("[viral-remixer] Supadata error:", r.status, errBody.slice(0, 200));
          }
        } catch (e: any) {
          console.error("[viral-remixer] Supadata fetch threw:", e?.message);
        }
      } else {
        console.warn("[viral-remixer] No SUPADATA_API_KEY — skipping Supadata");
      }
      // Fallback: direct ytInitialPlayerResponse method
      console.log("[viral-remixer] Trying direct fallback for:", id);
      return getTranscript(id).catch((e) => {
        console.error("[viral-remixer] Fallback also failed:", e?.message);
        return "";
      });
    }

    const [meta, transcript] = await Promise.all([
      getVideoMeta(videoId),
      fetchTranscriptRobust(videoId),
    ]);

    if (!transcript) {
      return NextResponse.json({ error: "No transcript available for this video. Try a video with captions enabled." }, { status: 422 });
    }

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{
        role: "user",
        content: `You are a YouTube strategy expert. Analyze this video and extract the exact framework that made it perform.

TITLE: ${meta.title}
CHANNEL: ${meta.channelTitle}

TRANSCRIPT (first 7000 chars):
${transcript.slice(0, 7000)}

Return ONLY valid JSON, no markdown fences, with this exact shape:
{
  "hookAnalysis": {
    "hook": "The exact first 1-2 sentences of the video",
    "hookType": "One of: Challenge/Stat/Story/Controversy/Question/Result/Myth-bust/Teaser",
    "whyItWorks": "2 sentences on the psychological mechanism that stops the scroll"
  },
  "structure": [
    { "timestamp": "0:00", "section": "Hook", "description": "What happens", "purpose": "Retention purpose" },
    { "timestamp": "X:XX", "section": "Name", "description": "What happens", "purpose": "Retention purpose" }
  ],
  "retentionTriggers": [
    { "trigger": "Open loop", "example": "Quote or moment from transcript", "timestamp": "X:XX" },
    { "trigger": "Pattern interrupt", "example": "Quote or moment", "timestamp": "X:XX" },
    { "trigger": "Stakes escalation", "example": "Quote or moment", "timestamp": "X:XX" }
  ],
  "titleFormula": {
    "formula": "The reusable template e.g. I [did X] In [time] With [constraint] (Full Breakdown)",
    "psychology": "One sentence on why this title formula converts clicks",
    "remixExamples": ["Title option 1 applying formula to a different niche", "Title option 2 different angle same formula", "Title option 3 different angle same formula", "Title option 4 different angle same formula"]
  },
  "remixFramework": "3 sentence summary: how to replicate this video's success for any topic in any niche"
}`,
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const analysis = JSON.parse(raw.replace(/```json|```/g, "").trim());

    return NextResponse.json({ videoId, ...meta, ...analysis });
  } catch (e: any) {
    console.error("[viral-remixer]", e?.message);
    return NextResponse.json({ error: e?.message || "Analysis failed" }, { status: 500 });
  }
}
