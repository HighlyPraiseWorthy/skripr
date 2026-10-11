import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Anthropic } from "@anthropic-ai/sdk";
import {
  listVoiceProfiles,
  createVoiceProfile,
  updateVoiceProfileStyle,
  getVoiceProfileSourceRef,
  setActiveVoiceProfile,
  deleteVoiceProfileById,
  getVoiceJson,
  setVoiceJson,
  MAX_PROFILES,
} from "@/lib/voice-profile";
import { parseTweak, composeVoiceJson, baseOf, METRICS } from "@/lib/voice-tweak";
import { fetchChannelLongform } from "@/lib/youtube-channel";
import { getTranscriptRobust } from "@/lib/youtube-transcript";
import { captureFrameworkInBackground } from "@/lib/framework-capture";
import { measureVoiceFromSamples } from "@/lib/voice-metrics";
import { extractVoiceStructure } from "@/lib/voice-structure";

export const maxDuration = 120;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return _client;
}

const toClient = (p: any) => {
  const vf = p.voice_fingerprint || null;
  const fp = vf && Number(vf.words) >= 300 ? vf : null;
  return {
    id: p.id, name: p.name, source: p.source, styleGuide: p.style_guide,
    isActive: p.is_active, updatedAt: p.updated_at,
    // canReanalyze: a channel handle is stored, so the profile can be refreshed in one click
    canReanalyze: !!p.source_ref,
    // Step 4: the creator's plain-language adjustments, and the rhythm targets they currently produce.
    adjustments: [...new Set(((vf?.tweakOps || []) as any[]).map((o) => String(o.instruction || "")).filter(Boolean))],
    // Voice rules v2: how many videos/scripts the rules came from (signature phrases need 2+). null = built before v2.
    builtFrom: typeof vf?.structure?.sampleCount === "number" ? vf.structure.sampleCount : null,
    targets: fp ? Object.entries(METRICS).map(([k, m]) => ({ label: m.label, value: k === "fragmentRate" ? `${Math.round(Number(fp[k]) * 100)}%` : `${fp[k]}${m.unit ? ` ${m.unit}` : ""}` })) : [],
  };
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profiles = await listVoiceProfiles(userId);
  return NextResponse.json({ profiles: profiles.map(toClient), max: MAX_PROFILES });
}

// Voice rules v2 (2026-10-11): the channel's top 5 long-form videos (was 3), fetched in parallel (route budget).
// Signature phrases must recur across 2+ videos, so more videos = real signatures; 1 usable video still builds a voice.
export const VOICE_SAMPLE_VIDEOS = 5;
// The analysis prompt holds 24,000 characters: give each video/script an equal share so all of them are read
// (with 5 videos, a plain slice only reached the first two or three).
function promptSamples(text: string, budget = 24000): string {
  const parts = text.split(/\n+\s*-{3,}\s*\n+/).map((x) => x.trim()).filter(Boolean);
  if (parts.length <= 1) return text.slice(0, budget);
  const share = Math.floor(budget / parts.length);
  return parts.map((p) => p.slice(0, share)).join("\n\n---\n\n");
}
async function samplesFromChannel(channelInput: string): Promise<{ samples: string; channelTitle: string; videos: { videoId: string; transcript: string; title: string; views: number }[] }> {
  const scan = await fetchChannelLongform(channelInput);
  // The channel's most-viewed long-form videos carry the most representative voice
  const top = [...scan.videos].sort((a, b) => b.views - a.views).slice(0, VOICE_SAMPLE_VIDEOS);
  if (top.length === 0) throw new Error("No long-form videos found on this channel");
  const fetched = await Promise.all(top.map(async (v) => {
    try { const t = await getTranscriptRobust(v.videoId); return t?.trim() ? { videoId: v.videoId, transcript: t, title: v.title, views: v.views } : null; }
    catch (e: any) { console.error(`[voice-profile] transcript failed for ${v.videoId}:`, e?.message); return null; }
  }));
  const videos = fetched.filter(Boolean) as { videoId: string; transcript: string; title: string; views: number }[];
  const joined = videos.map((v) => v.transcript.slice(0, 9000)).join("\n\n---\n\n");
  if (joined.length < 400) {
    throw new Error("Couldn't fetch transcripts from this channel's videos — try pasting scripts instead");
  }
  return { samples: joined, channelTitle: scan.channel.title, videos };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, samples, channel, reanalyzeId } = await req.json();

    let text = String(samples || "").trim();
    let source = "scripts";
    let resolvedName = String(name || "").trim();
    let channelVideos: { videoId: string; transcript: string; title: string; views: number }[] = [];
    let sourceRef: string | null = null;
    let channelInput = channel ? String(channel) : "";

    // One-click re-analyze: no new input, but the profile already stores the
    // channel it was built from — re-fetch from that.
    if (reanalyzeId && !text && !channelInput) {
      const storedRef = await getVoiceProfileSourceRef(userId, String(reanalyzeId));
      if (storedRef) channelInput = storedRef;
    }

    if (!text && channelInput) {
      const fromChannel = await samplesFromChannel(channelInput);
      text = fromChannel.samples;
      source = "channel";
      sourceRef = channelInput;
      channelVideos = fromChannel.videos;
      if (!resolvedName) resolvedName = fromChannel.channelTitle;
    }

    if (text.length < 400) {
      return NextResponse.json({ error: "Paste at least a few paragraphs of scripts (400+ characters), or provide a channel with transcripts." }, { status: 400 });
    }
    if (!resolvedName) resolvedName = "My Voice";

    // Structured profile runs in parallel with the prose analysis (route budget), verified against the samples.
    const structurePromise = extractVoiceStructure(text, { titles: channelVideos.map((v) => v.title) }).catch(() => null);
    const msg = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2200,
      system: "You are a forensic writing-style analyst for YouTube voiceover scripts. Output plain text only — no markdown headers, no preamble.",
      messages: [{
        role: "user",
        content: `Analyze these writing samples from one YouTube creator and produce a VOICE PROFILE that another writer could follow to write indistinguishably in this creator's voice.

SAMPLES:
"""
${promptSamples(text)}
"""

Write a compact profile (max 480 words) covering, in this order:
- NARRATIVE MECHANICS (the most important section — this is how they SHAPE a story, and it must transfer to ANY subject): their signature OPENING MOVE (quote one); their TRANSITION mechanic, how they shift between ideas (e.g. a rhetorical question as a gear-shift, a hard cut, a callback); their TENSION pattern, how they build and then turn (e.g. accumulation then pivot, setup then reversal); their SECTION-ENDING pattern (e.g. apparent resolution then a darker complication, or a clean landing); and their PAYOFF/CALLBACK behavior (e.g. return to the opening image at the end). Describe each as a repeatable move, not a one-off.
- Sentence rhythm: typical length, fragment usage, the build-and-release pattern (e.g. long, medium, short punch)
- Imagery and metaphor: do they explain through analogies or vivid comparisons? How often, and what kind (physical/sensory, pop-culture, scientific, everyday)? Quote 1-2 verbatim examples. If they rarely use imagery, say so explicitly.
- Vocabulary and diction: simple/technical, slang, contractions, words they favor
- Energy and tone: where they sit between calm-documentary and hype, how serious vs playful
- Person and address: how they talk to the viewer (you/we/I), how personal they get
- Humor: type, frequency, and an example pattern
- Signature phrases: exact recurring words/phrases, quoted verbatim
- CTA style: how they ask for subscribes/comments
- Never-does: things notably absent from their style
- CHARACTERISTIC STRENGTH (end with this, one short block): name the 2-4 DOMINANT traits that define the voice and should be imitated heavily, and separately the OCCASIONAL traits to use only where they fit. Explicitly flag any single trait (e.g. sentence fragments, a catchphrase, a metaphor type) that would read as a machine-made TIC if overused — so a writer applies it at the creator's real frequency, not on every line.

Be specific and concrete. No generic filler like "engaging" or "conversational" without evidence. Quote the creator verbatim wherever you can.`,
      }],
    });

    // Trim to a sentence/line boundary so the profile never ends mid-word (the "short fragme…" /
    // "trapdoor section en…" bug) — a hard character slice cut the last section off in the middle.
    const rawStyle = (msg.content[0].type === "text" ? msg.content[0].text : "").trim();
    const styleGuide = rawStyle.length > 5000
      ? rawStyle.slice(0, 5000).replace(/\s+\S*$/, "").replace(/[,;:\s]+$/, "")
      : rawStyle;
    if (!styleGuide) throw new Error("Style analysis came back empty — please try again");

    // Measure the fingerprint from ALL the samples now, while we have them (sample_excerpt keeps only 600 chars).
    const fingerprint = measureVoiceFromSamples(text.split(/\n+-{3,}\n+/));
    // Structured profile (checkable fields, each verified against the samples). Failure keeps the prose profile.
    const structure = await structurePromise;
    const profile = reanalyzeId
      ? await updateVoiceProfileStyle(userId, String(reanalyzeId), styleGuide, text.slice(0, 600), sourceRef, fingerprint, structure)
      : await createVoiceProfile(userId, resolvedName, source, styleGuide, text.slice(0, 600), sourceRef, fingerprint, structure);

    // Learning loop: bank frameworks from the channel's videos we already pulled
    // transcripts for. Parallel + skip-if-already-captured, so it's bounded.
    if (channelVideos.length) {
      await Promise.allSettled(channelVideos.map(v =>
        captureFrameworkInBackground({ videoId: v.videoId, transcript: v.transcript, title: v.title, views: v.views })
      ));
    }

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
    const { id, action, instruction } = await req.json();
    // Step 4: plain-language adjustment ("use shorter sentences") -> checkable fields, no re-analysis.
    if (action === "tweak" || action === "reset") {
      if (!id) return NextResponse.json({ error: "Profile id required" }, { status: 400 });
      const current = await getVoiceJson(userId, String(id));
      const base = baseOf(current);
      if (!base.fp && !base.structure) return NextResponse.json({ error: "Re-analyze this voice once before adjusting it." }, { status: 400 });
      const oldOps = action === "reset" ? [] : (current?.tweakOps || []);
      const before = composeVoiceJson(base, oldOps);
      const effectiveFp = Number(before.json.words) >= 300 ? (before.json as any) : null;
      const newOps = action === "tweak" ? await parseTweak(String(instruction || ""), effectiveFp) : [];
      if (action === "tweak" && !newOps.length) return NextResponse.json({ error: "Type what you'd like to change." }, { status: 400 });
      const after = composeVoiceJson(base, [...oldOps, ...newOps]);
      const saved = await setVoiceJson(userId, String(id), after.json);
      return NextResponse.json({ profile: toClient(saved), changes: action === "reset" ? ["All adjustments undone"] : after.summary.slice(before.summary.length) });
    }
    // id: profile to activate, or null to use the default Skripr voice
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
