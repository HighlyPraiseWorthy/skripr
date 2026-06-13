import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Anthropic } from "@anthropic-ai/sdk";
import {
  listVoiceProfiles,
  createVoiceProfile,
  setActiveVoiceProfile,
  deleteVoiceProfileById,
  MAX_PROFILES,
} from "@/lib/voice-profile";
import { fetchChannelLongform } from "@/lib/youtube-channel";
import { getTranscriptRobust } from "@/lib/youtube-transcript";

export const maxDuration = 120;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return _client;
}

const toClient = (p: any) => ({
  id: p.id, name: p.name, source: p.source, styleGuide: p.style_guide,
  isActive: p.is_active, updatedAt: p.updated_at,
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profiles = await listVoiceProfiles(userId);
  return NextResponse.json({ profiles: profiles.map(toClient), max: MAX_PROFILES });
}

async function samplesFromChannel(channelInput: string): Promise<{ samples: string; channelTitle: string }> {
  const scan = await fetchChannelLongform(channelInput);
  // The channel's most-viewed long-form videos carry the most representative voice
  const top = [...scan.videos].sort((a, b) => b.views - a.views).slice(0, 3);
  if (top.length === 0) throw new Error("No long-form videos found on this channel");
  const transcripts: string[] = [];
  for (const v of top) {
    try {
      const t = await getTranscriptRobust(v.videoId);
      if (t?.trim()) transcripts.push(t.slice(0, 9000));
    } catch (e: any) {
      console.error(`[voice-profile] transcript failed for ${v.videoId}:`, e?.message);
    }
  }
  const joined = transcripts.join("\n\n---\n\n");
  if (joined.length < 400) {
    throw new Error("Couldn't fetch transcripts from this channel's videos — try pasting scripts instead");
  }
  return { samples: joined, channelTitle: scan.channel.title };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, samples, channel } = await req.json();

    let text = String(samples || "").trim();
    let source = "scripts";
    let resolvedName = String(name || "").trim();

    if (!text && channel) {
      const fromChannel = await samplesFromChannel(String(channel));
      text = fromChannel.samples;
      source = "channel";
      if (!resolvedName) resolvedName = fromChannel.channelTitle;
    }

    if (text.length < 400) {
      return NextResponse.json({ error: "Paste at least a few paragraphs of scripts (400+ characters), or provide a channel with transcripts." }, { status: 400 });
    }
    if (!resolvedName) resolvedName = "My Voice";

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

    const profile = await createVoiceProfile(userId, resolvedName, source, styleGuide, text.slice(0, 600));
    return NextResponse.json({ profile: toClient(profile) });
  } catch (e: any) {
    console.error("[voice-profile]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to build voice profile" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await req.json(); // id: profile to activate, or null to use the default Skripr voice
    await setActiveVoiceProfile(userId, id ?? null);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to switch voice" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Profile id required" }, { status: 400 });
    await deleteVoiceProfileById(userId, id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to delete voice" }, { status: 500 });
  }
}
