import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Anthropic } from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/db/supabase";
import { saveVoiceProfile, deleteVoiceProfile } from "@/lib/voice-profile";

export const maxDuration = 60;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return _client;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ profile: null });
  const { data } = await supabaseAdmin
    .from("voice_profiles")
    .select("style_guide, sample_excerpt, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  return NextResponse.json({
    profile: data ? { styleGuide: data.style_guide, sampleExcerpt: data.sample_excerpt, updatedAt: data.updated_at } : null,
  });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { samples } = await req.json();
    const text = String(samples || "").trim();
    if (text.length < 400) {
      return NextResponse.json({ error: "Paste at least a few paragraphs of your past scripts (400+ characters) so the analysis has enough to work with." }, { status: 400 });
    }

    const msg = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      system: "You are a forensic writing-style analyst for YouTube voiceover scripts. Output plain text only — no markdown headers, no preamble.",
      messages: [{
        role: "user",
        content: `Analyze these writing samples from one YouTube creator and produce a VOICE PROFILE that another writer could follow to write indistinguishably in this creator's voice.

SAMPLES:
"""
${text.slice(0, 24000)}
"""

Write a compact profile (max 300 words) covering, in this order:
- Sentence rhythm: typical length, fragment usage, how they build and release tension
- Vocabulary and diction: simple/technical, slang, contractions, words they favor
- Energy and tone: where they sit between calm-documentary and hype, how serious vs playful
- Person and address: how they talk to the viewer (you/we/I), how personal they get
- Humor: type, frequency, and an example pattern
- Signature phrases: exact recurring words/phrases (quote them verbatim)
- Transitions: how they move between ideas
- CTA style: how they ask for subscribes/comments
- Never-does: things notably absent from their style

Be specific and concrete. No generic filler like "engaging" or "conversational" without evidence.`,
      }],
    });

    const styleGuide = (msg.content[0].type === "text" ? msg.content[0].text : "").trim().slice(0, 2600);
    if (!styleGuide) throw new Error("Style analysis came back empty — please try again");

    await saveVoiceProfile(userId, styleGuide, text.slice(0, 600));
    return NextResponse.json({ profile: { styleGuide, updatedAt: new Date().toISOString() } });
  } catch (e: any) {
    console.error("[voice-profile]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to build voice profile" }, { status: 500 });
  }
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await deleteVoiceProfile(userId);
  return NextResponse.json({ ok: true });
}
