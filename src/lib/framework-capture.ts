import { Anthropic } from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/db/supabase";
import { saveViralFramework, fetchSourceViews, normalizeNiche } from "@/lib/viral-frameworks";
import { getVideoMeta } from "@/lib/youtube-transcript";
import { NICHES } from "@/lib/data/niches";
import { HOOK_FAMILY_TYPES, HOOK_FAMILIES_PROMPT, toHookFamily } from "@/lib/hook-families";
import { TECHNIQUES } from "@/lib/storytelling";
// Skripr's own storytelling technique ids, so the data can say which of THESE winning videos used.
const STORY_TECHNIQUE_IDS = TECHNIQUES.map((t) => t.id);

// Background framework capture: whenever a real YouTube video flows through ANY
// surface (New Script URL, Voice Match channel, etc.), extract its viral
// framework and bank it in viral_frameworks so the collective pool keeps
// learning. Cost-safe: each unique video is analyzed at most once ever
// (skip-if-already-captured), runs on cheap Haiku, and never throws.

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return _client;
}

async function alreadyCaptured(videoId: string): Promise<boolean> {
  if (!supabaseAdmin) return true;
  try {
    // A title-only row (banked by captureOutlierTitles moments earlier in the same Outlier scan) is NOT
    // a capture: only a row that already has the hook counts. Checking mere existence made every
    // breakout hook capture skip itself, so Outlier Finder banked titles but never a single hook.
    const { data } = await supabaseAdmin.from("viral_frameworks").select("video_id, hook_text").eq("video_id", videoId).maybeSingle();
    return !!(data && String((data as any).hook_text || "").trim());
  } catch {
    return true; // on error, skip rather than risk a duplicate analysis
  }
}

export interface CaptureInput {
  videoId: string;
  transcript: string;
  title?: string | null;
  views?: number | null;
  // The caller's niche (an Outlier scan knows the channel's niche) wins over the model's guess (seen: a
  // Visual Venture true-crime video filed under "storytelling").
  niche?: string | null;
  // STRUCTURE DATA (2026-10-06): how far this video beat its own channel's usual views (the honest "winning"
  // signal; raw views mostly measure channel size), and which channel it came from, so one big channel can't
  // dominate a niche's structure families. Stored in title_formula (jsonb) since the table can't take columns.
  outlierX?: number | null;
  channelId?: string | null;
  channelTitle?: string | null;
  durationMin?: number | null;
  // Re-analyze even when a hook is already banked (the full-transcript structure backfill).
  force?: boolean;
}

export async function captureFrameworkInBackground(input: CaptureInput): Promise<void> {
  try {
    if (!supabaseAdmin) return;
    if (!input.videoId || !input.transcript || input.transcript.trim().length < 200) return;
    if (!input.force && await alreadyCaptured(input.videoId)) return; // bound cost — analyze each video once

    const msg = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      system: `You output ONLY valid JSON. No prose, no markdown fences. Start with { and end with }.`,
      messages: [{
        role: "user",
        content: `Extract the viral framework from this YouTube video so it can teach future scripts what works.

IGNORE SPONSORS/ADS: skip any sponsor read, ad, or promo (brand, app, charity, promo code, "link in the description"). The real hook is the first sentence of the ACTUAL content.

FULL TRANSCRIPT (the whole video, so the structure covers its whole runtime, not just the opening):
"""
${input.transcript.slice(0, 60000)}
"""

Return JSON with EXACTLY these keys:
{
  "hookType": "the hook type used — EXACTLY one of: ${HOOK_FAMILY_TYPES.join(", ")} (see definitions below)",
  "hook": "the opening hook line(s), verbatim from the content",
  "whyItWorks": "one sentence on the psychology of why this hook works",
  "structure": [{"section": "name", "description": "what happens", "startPct": 0, "sharePct": 8, "role": "cold_open | setup | second_hook | backstory | escalation | turn | climax | resolution | callback | context | sponsor"}],
  "techniques": [{"id": "one of: ${STORY_TECHNIQUE_IDS.join(", ")}", "where": "which section", "example": "the moment from the transcript, under 25 words"}],
  "shape": "the video's overall story shape in 2-6 words (e.g. 'manhunt / second life', 'cold case breakthrough', 'rise and fall')",
  "retentionTriggers": [{"trigger": "type", "example": "the moment from the transcript"}],
  "titleFormula": {"formula": "the reusable title template this video implies"},
  "remixFramework": "3 sentences: how to replicate this video's success for any topic",
  "niche": "exactly one id from: ${NICHES.map(n => n.id).join(", ")}"
}

HOOK TYPE DEFINITIONS (classify by what the opening line DOES):
${HOOK_FAMILIES_PROMPT}`,
      }],
    }, { timeout: input.force ? 120_000 : 40_000 }); // full transcripts take longer; a live scan stays bounded

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    const title = input.title || (await getVideoMeta(input.videoId).then(m => m.title).catch(() => null));
    const views = input.views ?? (await fetchSourceViews(input.videoId));

    await saveViralFramework({
      video_id: input.videoId,
      video_title: title,
      niche: normalizeNiche(input.niche || parsed.niche),
      hook_type: toHookFamily(parsed.hookType),
      hook_text: parsed.hook ?? null,
      why_it_works: parsed.whyItWorks ?? null,
      // Each section: name, what happens, where it starts and how much of the runtime it takes (percent), its role.
      structure: Array.isArray(parsed.structure) ? parsed.structure.map((s: any) => ({ section: s?.section, description: s?.description, startPct: Number(s?.startPct) || 0, sharePct: Number(s?.sharePct) || 0, role: String(s?.role || "").split(/\s*\|\s*/)[0] || undefined })) : null,
      retention_triggers: parsed.retentionTriggers ?? null,
      title_formula: { ...(parsed.titleFormula || {}), outlierX: input.outlierX ?? null, channelId: input.channelId ?? null, channelTitle: input.channelTitle ?? null, durationMin: input.durationMin ?? null, shape: typeof parsed.shape === "string" ? parsed.shape.slice(0, 60) : null,
        techniques: Array.isArray(parsed.techniques) ? parsed.techniques.filter((t: any) => STORY_TECHNIQUE_IDS.includes(String(t?.id))).map((t: any) => ({ id: String(t.id), where: String(t.where || "").slice(0, 80), example: String(t.example || "").slice(0, 200) })).slice(0, 12) : [] },
      remix_framework: parsed.remixFramework ?? null,
      source_views: views,
    });
    console.log(`[capture] banked framework for ${input.videoId} (niche=${normalizeNiche(parsed.niche)})`);
  } catch (e: any) {
    console.error("[capture] failed:", e?.message);
  }
}
