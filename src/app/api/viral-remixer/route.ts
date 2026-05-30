import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { extractVideoId, getTranscript, getVideoMeta } from "@/lib/youtube-transcript";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

    const videoId = extractVideoId(url);
    if (!videoId) return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });

    const [meta, transcript] = await Promise.all([
      getVideoMeta(videoId),
      getTranscript(videoId).catch(() => ""),
    ]);

    if (!transcript) {
      return NextResponse.json({ error: "No transcript available for this video. Try a video with captions enabled." }, { status: 422 });
    }

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
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
    "remixExample": "Apply the same formula to a different niche topic"
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
