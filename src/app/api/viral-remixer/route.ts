import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { extractVideoId, getTranscriptRobust, getVideoMeta } from "@/lib/youtube-transcript";
import { checkScriptLimit } from "@/lib/usage";
import { supabaseAdmin } from "@/lib/db/supabase";
import { NICHES } from "@/lib/data/niches";
import { saveViralFramework, fetchSourceViews, normalizeNiche } from "@/lib/viral-frameworks";
import { EXPERT_ATTRIBUTION_RULE } from "@/lib/ai/claude";
import { extractTrailingExpert, stripCarriedExpert } from "@/lib/title-utils";

export const maxDuration = 120;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Paywall — counts against 2 scripts/month. Free users get 1 remixer use.
    const { allowed, plan, used, limit } = await checkScriptLimit(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: `Script limit reached (${used}/${limit}). Upgrade to keep remixing at skripr.app/dashboard/settings` },
        { status: 403 }
      );
    }


    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

    const videoId = extractVideoId(url);
    if (!videoId) return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });

    // Fetch metadata and transcript (Supadata English-first, direct fallback — shared lib)
    const [meta, transcript] = await Promise.all([
      getVideoMeta(videoId),
      getTranscriptRobust(videoId).catch((e) => {
        console.error("[viral-remixer] transcript fetch failed:", e?.message);
        return "";
      }),
    ]);

    if (!transcript) {
      return NextResponse.json({ error: "No transcript available for this video. Try a video with captions enabled." }, { status: 422 });
    }

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 5000,
      // The same video must read back the same way every time. Without this the
      // API samples at its default temperature, so re-running one URL rewrote the
      // hook type, structure labels, and trigger wording on each pass and users
      // could not trust or re-find the analysis. The remix TITLES are the only
      // part meant to be creative, and 10 of them from one formula stay varied
      // enough at t=0.
      temperature: 0,
      messages: [{
        role: "user",
        content: `You are a YouTube strategy expert. Analyze this video and extract the exact framework that made it perform.

IMPORTANT — IGNORE SPONSORS/ADS: The transcript may open or pause with a sponsor read or ad (a brand, app, charity, donation match, promo code, "this video's sponsor", "link in the description"). That is a paid insertion, NOT the video's content. Skip it completely. The real hook is the first sentence of the ACTUAL content, never the sponsor intro. Never put a sponsor, brand, or promo into the hook, structure, retention triggers, title formula, or remix titles.

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
    "formula": "The reusable template derived from the TITLE STRING ITSELF, e.g. I [did X] In [time] With [constraint] (Full Breakdown)",
    "psychology": "One sentence on why this title formula converts clicks",
    "remixTitles": [
      { "title": "Full title using the formula", "description": "One sentence: what this video would actually cover and why it hooks", "audience": "Who specifically clicks this", "scope": "close" }
    ]
  },
  "remixFramework": "3 sentence summary: how to replicate this video's success for any topic in any niche",
  "niche": "Exactly one id from this list that best fits the video: ${NICHES.map(n => n.id).join(", ")}",
  "sourceEntities": ["distinctive terms specific to THIS video's content"]
}

SOURCE ENTITIES REQUIREMENT (critical for not copying content): "sourceEntities" is 8 to 20 of the DISTINCTIVE nouns, proper names, places, brands, named events, and concrete objects that belong to THIS video's specific story — the things a remix on a DIFFERENT topic must never accidentally import. Include people's names, company/brand names, city/place names, named operations or events, and any vivid concrete object the video is built around (e.g. for a sneaker-counterfeiting video: "Nike", "Memphis", "sneaker stores", "shipping labels", "raids", "seized accounts"). Do NOT include generic words that belong to any video ("story", "money", "people", "system"). These are used ONLY to detect leakage; the remix must reproduce the STRUCTURE of this video, never its content.

TITLE FORMULA REQUIREMENT (critical — this is the most commonly botched field): the formula must be abstracted from the TITLE STRING ITSELF, never from what the video turns out to be about. Run this test before you answer: fill your formula's slots with this video's own subject. It MUST reproduce the actual title almost exactly. If the real title is "Alcohol is AMAZING", the formula is "[Thing People Enjoy] is [Enthusiastic Positive Superlative]" — filling it gives back "Alcohol is AMAZING". A formula like "[Loved Thing] is [Shocking Negative Superlative]" FAILS this test, because it yields "Alcohol is DEVASTATING", which is not the title. That formula describes the video's ARGUMENT, not its title, and every remix built on it will invert the hook.

IRONY AND CONTRADICTION ARE PART OF THE TITLE, NOT A MISTAKE TO CORRECT. When a title praises something the video then criticizes, the dissonance IS the hook: the viewer clicks to resolve the contradiction. Preserve that shape in the formula and in every remixTitle. A remix that states the video's conclusion in the title ("Social Media is ADDICTIVE") destroys the mechanism, because it agrees with what the viewer already believes and leaves nothing to resolve. If the source title is positive about its subject, EVERY remixTitle must be positive about its subject too.

RETENTION TRIGGERS REQUIREMENT — "retentionTriggers" must contain 6 to 9 distinct entries covering the ENTIRE runtime (early, middle, AND late timestamps). Vary the types: open loops, pattern interrupts, stakes escalation, callbacks, curiosity gaps, personal implication, subverted expectations. Each needs a real quote or moment from the transcript.

REMIX TITLES REQUIREMENT — "remixTitles" must contain EXACTLY 10 entries:
- Entries 1-5 ("scope": "close"): topics ADJACENT to this video's subject — same broad subject area, different specific angle (e.g. MONEY → banks, debt, taxes, gold, inflation).
- Entries 6-10 ("scope": "wide"): the SAME title formula applied to COMPLETELY DIFFERENT niches far from this video's subject (e.g. MONEY → social media, diets, sleep, video games, marriage). Use the formula as-is — do not bolt on extra subtitle clauses the formula doesn't have.
- Every entry needs a sharp one-sentence "description" of what that video would cover, and a specific "audience" (who clicks and why), not generic demographics.

${EXPERT_ATTRIBUTION_RULE}`,
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const analysis = JSON.parse(raw.replace(/```json|```/g, "").trim());

    // Hard guarantee: strip the source video's expert from any remix title that
    // carried it onto a different topic, even if the model ignored the rule.
    const sourceExpert = extractTrailingExpert(meta.title);
    if (sourceExpert && Array.isArray(analysis.titleFormula?.remixTitles)) {
      analysis.titleFormula.remixTitles = analysis.titleFormula.remixTitles.map((t: any) =>
        ({ ...t, title: stripCarriedExpert(t?.title || "", sourceExpert) }));
    }

    // Backward compat: older consumers read titleFormula.remixExamples (string[])
    if (analysis.titleFormula?.remixTitles && !analysis.titleFormula.remixExamples) {
      analysis.titleFormula.remixExamples = analysis.titleFormula.remixTitles.map((t: any) => t.title);
    }

    // Collective learning layer: capture this framework so script generation
    // can use it as a few-shot example for the niche. Never blocks the response.
    await saveViralFramework({
      video_id: videoId,
      video_title: meta.title || null,
      niche: normalizeNiche(analysis.niche),
      hook_type: analysis.hookAnalysis?.hookType ?? null,
      hook_text: analysis.hookAnalysis?.hook ?? null,
      why_it_works: analysis.hookAnalysis?.whyItWorks ?? null,
      structure: analysis.structure ?? null,
      retention_triggers: analysis.retentionTriggers ?? null,
      title_formula: analysis.titleFormula ?? null,
      remix_framework: analysis.remixFramework ?? null,
      source_views: await fetchSourceViews(videoId),
    }).catch(() => {});

    // Carry a trimmed transcript back so the brief can score the SOURCE video against the
    // same framework checks as the generated script (the fidelity comparison). Capped to
    // keep sessionStorage light; the structural checks read the opening and the close.
    return NextResponse.json({ videoId, ...meta, ...analysis, sourceTranscript: (transcript || "").slice(0, 20000) });
  } catch (e: any) {
    console.error("[viral-remixer]", e?.message);
    return NextResponse.json({ error: e?.message || "Analysis failed" }, { status: 500 });
  }
}
