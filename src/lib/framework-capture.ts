import { Anthropic } from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/db/supabase";
import { saveViralFramework, fetchSourceViews, normalizeNiche } from "@/lib/viral-frameworks";
import { getVideoMeta } from "@/lib/youtube-transcript";
import { NICHES } from "@/lib/data/niches";

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
    const { data } = await supabaseAdmin.from("viral_frameworks").select("video_id").eq("video_id", videoId).maybeSingle();
    return !!data;
  } catch {
    return true; // on error, skip rather than risk a duplicate analysis
  }
}

export interface CaptureInput {
  videoId: string;
  transcript: string;
  title?: string | null;
  views?: number | null;
}

export async function captureFrameworkInBackground(input: CaptureInput): Promise<void> {
  try {
    if (!supabaseAdmin) return;
    if (!input.videoId || !input.transcript || input.transcript.trim().length < 200) return;
    if (await alreadyCaptured(input.videoId)) return; // bound cost — analyze each video once

    const msg = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: `You output ONLY valid JSON. No prose, no markdown fences. Start with { and end with }.`,
      messages: [{
        role: "user",
        content: `Extract the viral framework from this YouTube video so it can teach future scripts what works.

IGNORE SPONSORS/ADS: skip any sponsor read, ad, or promo (brand, app, charity, promo code, "link in the description"). The real hook is the first sentence of the ACTUAL content.

TRANSCRIPT (first 7000 chars):
"""
${input.transcript.slice(0, 7000)}
"""

Return JSON with EXACTLY these keys:
{
  "hookType": "the hook pattern used (e.g. Cold Open, Provocation, Curiosity Gap, Data Drop)",
  "hook": "the opening hook line(s), verbatim from the content",
  "whyItWorks": "one sentence on the psychology of why this hook works",
  "structure": [{"section": "name", "description": "what happens"}],
  "retentionTriggers": [{"trigger": "type", "example": "the moment from the transcript"}],
  "titleFormula": {"formula": "the reusable title template this video implies"},
  "remixFramework": "3 sentences: how to replicate this video's success for any topic",
  "niche": "exactly one id from: ${NICHES.map(n => n.id).join(", ")}"
}`,
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    const title = input.title || (await getVideoMeta(input.videoId).then(m => m.title).catch(() => null));
    const views = input.views ?? (await fetchSourceViews(input.videoId));

    await saveViralFramework({
      video_id: input.videoId,
      video_title: title,
      niche: normalizeNiche(parsed.niche),
      hook_type: parsed.hookType ?? null,
      hook_text: parsed.hook ?? null,
      why_it_works: parsed.whyItWorks ?? null,
      structure: parsed.structure ?? null,
      retention_triggers: parsed.retentionTriggers ?? null,
      title_formula: parsed.titleFormula ?? null,
      remix_framework: parsed.remixFramework ?? null,
      source_views: views,
    });
    console.log(`[capture] banked framework for ${input.videoId} (niche=${normalizeNiche(parsed.niche)})`);
  } catch (e: any) {
    console.error("[capture] failed:", e?.message);
  }
}
