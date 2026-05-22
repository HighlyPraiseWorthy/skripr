import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Anthropic } from "@anthropic-ai/sdk";
import { NICHES } from "@/lib/data/niches";

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  }
  return anthropicClient;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 });

    const nicheList = NICHES.map(n => `${n.id}: ${n.name}`).join("\n");

    const response = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 64,
      messages: [{
        role: "user",
        content: `You are a YouTube niche classifier. Given the transcript below, identify which single niche best describes this content.

NICHES (id: name):
${nicheList}

TRANSCRIPT (first 800 chars):
"${text.slice(0, 800)}"

Respond with ONLY the niche id (e.g. "fitness" or "personal-finance"). No explanation, no punctuation.`,
      }],
    });

    const raw = response.content[0];
    if (raw.type !== "text") return NextResponse.json({ error: "Bad response" }, { status: 500 });

    const detectedId = raw.text.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    const match = NICHES.find(n => n.id === detectedId);

    return NextResponse.json({
      nicheId: match?.id || null,
      nicheName: match?.name || null,
      raw: detectedId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to detect niche" }, { status: 500 });
  }
}
