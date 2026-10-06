import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { fetchChannelLongform } from "@/lib/youtube-channel";
import { captureOutlierTitles, captureOutlierPatterns, getCanonicalPatternNames, type CanonicalName } from "@/lib/viral-frameworks";
import { captureFrameworkInBackground } from "@/lib/framework-capture";
import { getTranscriptRobust, transcriptRateLimited } from "@/lib/youtube-transcript";
import { NICHES } from "@/lib/data/niches";

export const maxDuration = 150; // scan + breakout hook capture (capture now really runs; seen: 504 at 90s)

// Explain WHY each outlier over-performed, so the feature is analysis, not just a
// leaderboard. One LLM pass over the flagged outliers returns, per video: the outlier
// TYPE(s), a one-line "why it popped", and the reusable title + story patterns. Grounded
// only in the title + the channel's own norms (we have no transcript here), so it names
// the visible pattern, never invents plot. Best-effort — the scan still returns without it.
type OutlierAnalysis = {
  videoId: string;
  outlierType: string[];
  whyItStandsOut: string;
  likelyDriver: string;
  titlePattern: string;
  storyPattern: string;
};
type ChannelPattern = { name: string; kind: "story" | "packaging"; why: string; confidence: string; videoIds: string[]; universal: boolean };
type AnalysisResult = {
  analyses: Record<string, OutlierAnalysis>;
  channelPatterns: ChannelPattern[];
  opportunity: string;
};

async function analyzeOutliers(
  channelTitle: string,
  medianViews: number,
  medianDurationMin: number,
  outliers: { videoId: string; title: string; views: number; outlierX: number; durationMin: number; ageDays: number }[],
  vocab: { own: CanonicalName[]; universal: CanonicalName[] } = { own: [], universal: [] },
): Promise<AnalysisResult> {
  const empty: AnalysisResult = { analyses: {}, channelPatterns: [], opportunity: "" };
  if (!outliers.length) return empty;
  // Existing pattern vocabulary: reuse a name when it's the SAME function, so re-scans refresh one
  // row per idea instead of inventing synonyms. Never a checklist to fill.
  const vocabList = [...vocab.own, ...vocab.universal.filter((u) => !vocab.own.some((o) => o.name === u.name))];
  const vocabBlock = vocabList.length
    ? `\nEXISTING PATTERN NAMES (already learned from earlier scans):\n${vocabList.map((v) => `- [${v.kind}] ${v.name}`).join("\n")}\nNAMING RULE: when a pattern you find has the SAME single function as one of these, use that EXACT name and the same kind, character for character, instead of inventing a synonym. Only reuse on a genuine match: do NOT bend a pattern to fit a listed name, and do NOT report a listed pattern this channel's outliers don't actually show. A genuinely new function gets a new name. This list is vocabulary, not a checklist.\n`
    : "";
  const list = outliers
    .map((o, i) => `${i + 1}. id=${o.videoId} | "${o.title}" | ${o.views} views | ${o.outlierX}x expected pace | ${o.durationMin} min | ${o.ageDays}d old`)
    .join("\n");
  const prompt = `You are a YouTube strategist analyzing why certain videos broke a channel's normal performance. Channel: "${channelTitle}". The channel's TYPICAL video gets ${medianViews} views and runs about ${medianDurationMin} minutes.

These videos massively outperformed that norm (each with its "x expected pace" = how many times the channel's normal daily view rate it is pulling):
${list}

LANGUAGE RULE (critical — you have views but NOT CTR or audience data, so never claim to know why viewers clicked): describe OBSERVABLE differences in the packaging, not inferred viewer behavior. USE: "combines...", "differs from the channel's norm by...", "this creates...", "this framing emphasizes...", "a plausible driver is...". AVOID: "this caused...", "viewers clicked because...", "this reliably produces...", "audiences love...", "consistently", "guaranteed". Make the interpretation sharp; keep the measurement exact.

For EACH video, judge ONLY from the title and the numbers given (no script — never invent plot points, name people the title doesn't, or assert facts beyond the title):
"outlierType": one or more of exactly these labels, most important first:
- "Topic" (the subject itself is far outside the channel's usual)
- "Packaging" (a normal-for-the-channel subject with an unusually strong title/framing)
- "Angle" (the subject is ordinary but the specific framing/lens is the distinguishing feature)
- "Subject" (a specific person/entity outside the channel's usual mix)
- "Format" (length or structure differs sharply from the channel norm — flag if duration is far from ${medianDurationMin} min)
- "Timing" (ONLY if the TITLE ITSELF signals a timely event — an anniversary, a breaking event, a "now"). Do NOT tag Timing just because a video is fresh or fast: early velocity is not evidence of a timely event.
"whyItStandsOut": ONE sentence describing what the packaging OBSERVABLY does (e.g. "Combines an FBI subject with a superlative — 'most valuable' — creating an institution-plus-status contrast"). No viewer-behavior claims, and NEVER attribute the performance to recency/timing or fold the velocity number into a causal claim — describe the title/packaging only.
"likelyDriver": a short phrase naming the single strongest distinguishing feature, prefixed as inference (e.g. "A plausible driver is the insider-access premise plus superlative framing"). Call a superlative an "extreme characterization", not an "extreme status" (a superlative is a claim, not a status). Ground the driver in the PACKAGING evidence you have; do NOT cite recency/timing as a driver.
"titlePattern": the reusable structure, 3-6 words (e.g. "Institution + superlative + person").
"storyPattern": the transferable shape, an arrow chain (e.g. "Investigation -> unexpected insider -> high-value revelation").

THEN find the RECURRING PATTERNS across these outliers, and SEPARATE them into two kinds so they don't overlap:
- STORY patterns (kind:"story") = what the story is fundamentally ABOUT (e.g. "Insider / infiltration", "Crime -> capture", "Hidden system -> exposure").
- PACKAGING patterns (kind:"packaging") = HOW it is presented (e.g. "Superlative subject", "Concrete scale", "Specificity", "Contradiction").
ONE COHERENT FUNCTION PER PATTERN (the single most important rule — do NOT invent a pattern just because several titles contain strong words): every video in a pattern must share ONE specific function, not merely a topic or "has an intense word". Distinct functions must NOT be merged:
- status/superlative ("Most Valuable", "Biggest") is a PACKAGING function, not resolution.
- investigative action ("Infiltration", "Exposing") is disclosure/action, not the same as an outcome ("Was Caught", "Got Caught").
- absence of resolution ("Unsolved") is the OPPOSITE of resolution and never joins a resolution/exposure pattern.
If a group only coheres by "these titles all sound intense", it is a FALSE pattern — drop it. Prefer a broader-but-honest name over a false-precise one. Do NOT call a pattern "resolution" or "closure" unless every member establishes a resolved OUTCOME: an ACTION or ACCESS event ("Infiltration", "Exposing") is not closure, so a group mixing "Was Caught" (outcome) with "Infiltration" (action) should be named "Capture / investigative-action arc" (subject framed around a concrete investigative action or endpoint), NOT "Resolution arc". For story patterns, name the shape from the title's function and do NOT over-claim mechanism the title doesn't establish ("Hidden or opaque system exposed" is fair and covers a dark-web market, a pharma company, or a platform economy; do NOT say "illicit" (over-restrictive) or "from the inside" (claims insider access the title may not support)). Name a pattern by its ABSTRACTION, not by listing entity types: a title anchored to a precise location OR a named operation is one pattern, "Specificity anchor" (a concrete identifying detail — a precise location or named operation — instead of only the broad subject), not two.
${vocabBlock}Give 2-3 of each kind. For each: "name", "kind", a one-line "why" that is OBSERVABLE from the titles and does NOT claim audience behavior ("titles pair X with Y" — never "the audience is offered a complete loop"). For a superlative/extreme pattern, say "extreme ranking or extreme characterization" (this covers a qualified extreme like "Almost Impossible"), not "absolute claim". Also give "confidence" of exactly "High"/"Moderate"/"Low" — this is your confidence in the INTERPRETATION and is INDEPENDENT of how many videos share it (prevalence is shown separately from the count); High only when the shared function is unambiguous. Include the "videoIds" that belong (only a pattern with a coherent shared function spanning >=2 videos).
Also tag each pattern with "universal" (boolean). DEFAULT IT TO false. Set it true ONLY when the pattern is a subject-INDEPENDENT psychological or storytelling mechanism that would work just as well in a completely different niche — e.g. "outcome is known but the mechanism is withheld", "second-person address that implicates the viewer", "a familiar thing recast to mean the opposite", "a concrete measurable detail set against a system's scale". Set it false whenever the pattern only coheres because of THIS niche's subject matter (e.g. "FBI fugitive arc", "crypto-heist reveal", "dinosaur extinction hook") — those do not transfer. SIGNATURE-PHRASE RULE: if a pattern is defined by a literal phrase or title template this channel repeats (e.g. "WTF Is Happening To ___", "The Hunt for ___", "I Spent 24 Hours ___"), it is the channel's BRAND VOICE, not transferable psychology: tag it false. This applies to EVERY pattern built on that same device, including a story pattern that re-describes it in more abstract words ("alarm-signal diagnostic question" for "WTF Is Happening To") — never tag one description false and another description of the same device true. Be STRICT: when unsure, use false. Expect most channels to yield only 1-3 universal patterns, not most of them. A packaging pattern like "extreme ranking or extreme characterization" is universal; a story pattern naming a specific domain event is not.

Finally one "opportunity" — hedged, ANALYTICAL, and PRINCIPLE-based, not a rigid formula. The detected patterns do NOT all need to appear together, so do NOT hand the creator a multi-variable recipe ("A + B + C + D"). State what the outliers frequently do, then ONE creative principle to test. Keep it to about TWO scannable sentences — do NOT write one dense run-on. Good shape: "The channel's outliers frequently combine a concrete, high-signal detail (an exact figure, named operation, precise location, or superlative) with a structural tension such as capture, exposure, infiltration, or non-resolution. A principle worth testing: find the most unusual or measurable fact inside a powerful or hidden system, then build the story around the tension between that detail and the system's scale or secrecy." Avoid copywriting flourishes ("earns the right to answer").

Return ONLY valid JSON, no fences:
{
  "analyses": [ { "videoId": "...", "outlierType": ["Topic","Packaging"], "whyItStandsOut": "...", "likelyDriver": "...", "titlePattern": "...", "storyPattern": "..." } ],
  "channelPatterns": [ { "name": "Insider / infiltration", "kind": "story", "why": "one line", "confidence": "Moderate", "universal": false, "videoIds": ["...","..."] } ],
  "opportunity": "one hedged sentence"
}`;

  try {
    const msg = await new Anthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    // Robust extraction: take the outermost { ... } so a stray preamble/fence or a
    // trailing token can't blow up JSON.parse and silently drop the whole analysis.
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
    const data = JSON.parse(s >= 0 && e > s ? cleaned.slice(s, e + 1) : cleaned);
    const analyses: Record<string, OutlierAnalysis> = {};
    for (const a of data?.analyses || []) {
      if (a?.videoId) analyses[a.videoId] = {
        videoId: a.videoId,
        outlierType: Array.isArray(a.outlierType) ? a.outlierType.filter(Boolean).slice(0, 3) : [],
        whyItStandsOut: String(a.whyItStandsOut || ""),
        likelyDriver: String(a.likelyDriver || ""),
        titlePattern: String(a.titlePattern || ""),
        storyPattern: String(a.storyPattern || ""),
      };
    }
    const validIds = new Set(outliers.map((o) => o.videoId));
    const channelPatterns: ChannelPattern[] = (data?.channelPatterns || [])
      .map((p: any) => ({
        name: String(p?.name || ""),
        kind: p?.kind === "packaging" ? "packaging" : "story",
        why: String(p?.why || ""),
        confidence: ["High", "Moderate", "Low"].includes(p?.confidence) ? p.confidence : "Moderate",
        universal: p?.universal === true,
        videoIds: Array.isArray(p?.videoIds) ? p.videoIds.filter((id: any) => validIds.has(id)) : [],
      }))
      .filter((p: ChannelPattern) => p.name && p.videoIds.length >= 2);
    return { analyses, channelPatterns, opportunity: String(data?.opportunity || "") };
  } catch (e: any) {
    console.error("[channel-outliers] analyze skipped:", e?.message);
    return empty;
  }
}

// Auto-classify the channel's niche from its name + top titles, so captured
// outlier titles land in the right niche pool. Cheap, best-effort, null on fail.
async function classifyNiche(channelTitle: string, titles: string[]): Promise<string | null> {
  try {
    const ids = NICHES.map((n) => n.id).join(", ");
    const msg = await new Anthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 20,
      system: "You output ONLY one niche id from the provided list, nothing else.",
      messages: [{
        role: "user",
        content: `Channel: "${channelTitle}"\nTop videos:\n${titles.slice(0, 8).map((t) => `- ${t}`).join("\n")}\n\nReturn the single best-fit niche id from this list (exact id, lowercase, no other text):\n${ids}`,
      }],
    });
    const raw = (msg.content[0]?.type === "text" ? msg.content[0].text : "").trim().toLowerCase();
    return NICHES.some((n) => n.id === raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { channel } = await req.json();
    if (!channel) return NextResponse.json({ error: "Channel URL or @handle required" }, { status: 400 });

    const scan = await fetchChannelLongform(String(channel));

    if (scan.videos.length < 4) {
      return NextResponse.json({ error: "Not enough long-form videos on this channel to compute outliers (needs 4+)" }, { status: 422 });
    }

    // Age-normalized outlier score: compare each video's VIEWS-PER-DAY against
    // the channel's median views-per-day, so a genuine recent breakout beats an
    // old video that only looks big because it's had years to accumulate views.
    const now = Date.now();
    const withVpd = scan.videos.map((v) => {
      const days = Math.max((now - new Date(v.publishedAt).getTime()) / 86400000, 1);
      return { ...v, viewsPerDay: v.views / days, ageDays: Math.round(days) };
    });
    const sortedVpd = [...withVpd].sort((a, b) => a.viewsPerDay - b.viewsPerDay);
    const medianVpd = sortedVpd[Math.floor(sortedVpd.length / 2)].viewsPerDay || 1;
    // Keep a raw-view median too (for display/context).
    const sortedViews = [...scan.videos].sort((a, b) => a.views - b.views);
    const median = sortedViews[Math.floor(sortedViews.length / 2)].views || 1;
    // Median duration, so the analysis can spot FORMAT outliers (length far from norm).
    const sortedDur = [...scan.videos].sort((a, b) => a.durationSec - b.durationSec);
    const medianDurationMin = Math.round((sortedDur[Math.floor(sortedDur.length / 2)].durationSec || 0) / 60);

    // Honest metric: outlierX is views vs EXPECTED views at this age (expected = the
    // channel's median daily pace * the video's age). This equals viewsPerDay/medianVpd
    // but we now also expose expectedViews so the number is transparent and checkable,
    // instead of a bare "Nx vs baseline" the user can't reconcile against total views.
    const result = withVpd
      .map((v) => {
        const expectedViews = Math.max(Math.round(medianVpd * v.ageDays), 1);
        return { ...v, expectedViews, outlierX: Math.round((v.views / expectedViews) * 10) / 10 };
      })
      .sort((a, b) => b.outlierX - a.outlierX);

    // Explain the top outliers (cap at 10 to bound cost/latency) and merge the analysis in.
    const flagged = result.filter((v) => v.outlierX >= 2).slice(0, 10);
    const outliers = result.filter((v) => v.outlierX >= 2);

    // Classify the niche FIRST (cheap Haiku call): the analysis needs the niche's existing pattern
    // vocabulary so it reuses names instead of inventing synonyms. Also used to bank titles/patterns
    // and returned so the cross-channel validator can discover PEER CHANNELS in the same niche.
    let niche: string | null = null;
    let vocab: { own: CanonicalName[]; universal: CanonicalName[] } = { own: [], universal: [] };
    if (outliers.length > 0) {
      niche = await classifyNiche(scan.channel.title, outliers.map((v) => v.title)).catch(() => null);
      if (niche) vocab = await getCanonicalPatternNames(niche).catch(() => vocab);
    }

    const { analyses, channelPatterns, opportunity } = await analyzeOutliers(
      scan.channel.title,
      median,
      medianDurationMin,
      flagged.map((v) => ({ videoId: v.videoId, title: v.title, views: v.views, outlierX: v.outlierX, durationMin: Math.round(v.durationSec / 60), ageDays: v.ageDays })),
      vocab,
    );
    const videos = result.map((v) => (analyses[v.videoId] ? { ...v, analysis: analyses[v.videoId] } : v));
    if (channelPatterns.length) {
      const reused = channelPatterns.filter((p) => [...vocab.own, ...vocab.universal].some((v) => v.name === p.name)).length;
      console.log(`[channel-outliers] patterns=${channelPatterns.length} reusedNames=${reused} vocab=${vocab.own.length}+${vocab.universal.length} niche=${niche}`);
    }

    try {
      if (outliers.length > 0) {
        if (niche) {
          await captureOutlierTitles(niche, outliers.map((v) => ({ videoId: v.videoId, title: v.title, views: v.views })));
          // Bank the DNA PATTERNS too, so the generators learn transferable structures,
          // not just titles. Enrich each pattern with its example titles + peak views.
          if (channelPatterns.length) {
            const viewsById = new Map(result.map((v) => [v.videoId, v.views]));
            const titleById = new Map(result.map((v) => [v.videoId, v.title]));
            await captureOutlierPatterns(niche, channelPatterns.map((p) => ({
              name: p.name, kind: p.kind, why: p.why, confidence: p.confidence, universal: p.universal,
              examples: p.videoIds.map((id) => titleById.get(id) || "").filter(Boolean).slice(0, 3),
              maxViews: Math.max(0, ...p.videoIds.map((id) => viewsById.get(id) || 0)),
            })));
          }
          // Bank the actual HOOKS + retention structure of the top breakout outliers — the richest
          // hook/retention training signal a scan produces, which title-only capture threw away.
          // For each, pull the transcript and run the shared framework capture (verbatim opening hook,
          // structure, retention triggers -> viral_frameworks.hook_text, read back by getNicheFrameworksBlock
          // into generation). Deduped per video (alreadyCaptured), time-boxed, best-effort — never blocks
          // the scan. Candidate pool = top 6 by outlier strength. Fetch transcripts SEQUENTIALLY, not in
          // parallel: the transcript API rate-limits burst requests, which was silently failing most of a
          // parallel batch (banked 1/5). Sequential walks the pool until 3 winners are banked or the time
          // budget runs out, so a couple of missing-transcript videos (very recent uploads) don't cost the
          // slot. Deduped per video (alreadyCaptured), best-effort.
          const breakouts = [...outliers].sort((a, b) => b.outlierX - a.outlierX).slice(0, 6);
          // Budget from the REQUEST start, not from here: the scan itself can take most of the limit, and a
          // capture that runs past maxDuration kills the whole response (seen: 504 once capture actually ran).
          const hookBudgetMs = Math.min(Date.now() + 45_000, startedAt + 115_000);
          const WANT = 3;
          let bankedCount = 0, noTranscript = 0, rateLimited = false;
          for (const v of breakouts) {
            if (bankedCount >= WANT || Date.now() + 40_000 > hookBudgetMs) break; // a full-transcript capture takes up to ~40s
            const transcript = await getTranscriptRobust(v.videoId).catch(() => "");
            // Stop the moment the transcript API reports a plan/rate limit — every further call just
            // burns the little quota that's left and returns empty anyway. This is NOT missing captions.
            if (transcriptRateLimited) { rateLimited = true; break; }
            if (transcript.trim().length < 200) { noTranscript++; continue; }
            try { await captureFrameworkInBackground({ videoId: v.videoId, transcript, title: v.title, views: v.views, niche, outlierX: v.outlierX, channelTitle: scan.channel.title, durationMin: Math.round(v.durationSec / 60) }); bankedCount++; }
            catch { /* best effort */ }
          }
          console.log(`[channel-outliers] hook capture: banked ${bankedCount} breakout hooks (${noTranscript} no-transcript${rateLimited ? ", STOPPED: transcript API rate/usage limit exceeded" : ""}) niche=${niche}`);
        }
      }
    } catch (e: any) {
      console.error("[channel-outliers] capture skipped:", e?.message);
    }

    return NextResponse.json({
      channel: scan.channel,
      niche,
      medianViews: median,
      medianVpd: Math.round(medianVpd),
      medianDurationMin,
      channelPatterns,
      opportunity,
      videos,
    });
  } catch (e: any) {
    console.error("[channel-outliers]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to scan channel" }, { status: 500 });
  }
}
