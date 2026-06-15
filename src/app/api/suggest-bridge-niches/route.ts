import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { rpmArbitrage, fetchBlendProof, resolveNiche } from "@/lib/bend-insights";
import { getPoolNicheStats, normalizeNiche } from "@/lib/viral-frameworks";
import { getNicheById, NICHES } from "@/lib/data/niches";

const CANONICAL_NAMES = NICHES.map(n => n.name).join(", ");

const fmtV = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : `${v}`;

const client = new Anthropic();
export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { videoTitle, channelTitle, remixFramework, hookType, titleFormula, sourceNiche, exclude } = await req.json();
    const excludeList: string[] = Array.isArray(exclude) ? exclude.filter(Boolean).slice(0, 40) : [];
    const formula = (titleFormula?.formula || "").slice(0, 200);
    const framework = (remixFramework || "").slice(0, 400);

    // Learning loop: niches Skripr has proven frameworks for, so we can prefer
    // bridging toward them (and badge them on the card).
    const poolStats = await getPoolNicheStats().catch(() => []);
    const srcId = normalizeNiche(sourceNiche);
    const poolCounts = new Map(poolStats.map(s => [s.niche, s.count]));
    const poolPref = poolStats
      .filter(s => s.niche !== srcId)
      .slice(0, 12)
      .map(s => `${getNicheById(s.niche)?.name || s.niche} (${s.count} framework${s.count === 1 ? "" : "s"}, top ${fmtV(s.topViews)} views)`)
      .join("; ");

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      temperature: 1, // variety across refreshes
      system: `You output ONLY valid JSON arrays. No prose, no markdown. Start with [ and end with ].
Each object must have EXACTLY these keys: "name", "parentNiche", "hook", "algorithmNote", "titlePreview".`,
      messages: [{
        role: "user",
        content: `A YouTube creator made a video about: "${(videoTitle || "Unknown").slice(0, 120)}"
Channel: ${channelTitle || "Unknown"}
Hook type: ${hookType}
Title formula: ${formula}
Framework signals: ${framework.slice(0, 150)}
${excludeList.length ? `\nALREADY SHOWN TO THIS USER — do NOT suggest any of these or close variants; pick 5 genuinely DIFFERENT bridge sub-niches from other communities:\n${excludeList.map(n => `- ${n}`).join("\n")}\n` : ""}${poolPref ? `\nSKRIPR'S LEARNED DATA — these niches have proven high-performing frameworks in our database. PREFER bridging toward these when it still makes a surprising, completely-different-community blend, because the script can then borrow their real retention mechanics:\n${poolPref}\n` : ""}
STEP 1 — Detect source niche: Based on the video title, channel name, and framework keywords, determine exactly what content niche this creator is in (e.g. "health & weight loss", "personal finance", "gaming", "psychology", "fitness", "true crime", "technology", "cooking").

STEP 2 — Find bridge niches that are COMPLETELY DIFFERENT from that detected niche. Each bridge's "parentNiche" MUST be EXACTLY one of these canonical niches (copy the name verbatim): ${CANONICAL_NAMES}. Pick the 5 that would create the most surprising and compelling cross-community blend. Prioritize variety — never pick 2 from the same parentNiche. Do NOT suggest anything from the same category as the detected source niche.

Find 5 BRIDGE SUB-NICHES from COMPLETELY DIFFERENT content categories than this video.

CRITICAL RULE: Bridge niches must NOT be from the same niche as the source video.

EXAMPLES OF WRONG (too similar):
- Ozempic/health video → "Metabolic Health", "Fitness Supplements", "Workout Routines" ✗
- Finance video → "Investing", "Stock Market", "Crypto" ✗
- Psychology video → "Mental Wellness", "Therapy Tips", "Mindfulness" ✗

EXAMPLES OF RIGHT (true bridge — completely different community):
- Ozempic/health video → "True Crime Psychology" [True Crime], "Financial Anxiety" [Personal Finance], "Biohacking" [Technology], "Dark Psychology" [Psychology], "FIRE Movement" [Finance] ✓
- Finance video → "Speedrunning" [Gaming], "Stoicism" [Philosophy], "True Crime" [Crime], "Neuroscience" [Science] ✓

SUB-NICHES must be SPECIFIC, not broad categories:
- NOT "Gaming" → YES "Speedrunning" or "Indie Game Dev"
- NOT "Psychology" → YES "Dark Psychology" or "Cognitive Biases"
- NOT "Finance" → YES "Financial Anxiety" or "FIRE Movement"
- NOT "Science" → YES "Neuroscience" or "Quantum Physics"

NAMED-EXPERT RULE (critical): If the title formula contains a named person/expert (e.g. "- Erica Komisar"), that name belongs ONLY to the source video's topic. When you apply the formula to a DIFFERENT blended topic, you MUST NOT keep that name — Erica Komisar has nothing to do with true crime, philosophy, or business. Instead: if a real, widely-recognized expert genuinely fits the NEW blended topic, use them; otherwise DROP the "- [Expert]" part of the formula entirely and end the title cleanly. NEVER reuse the source's expert on an unrelated topic, and NEVER invent a fake or unverifiable name.

For each bridge sub-niche return EXACTLY these JSON fields:
- "name": specific sub-niche name (2-4 words, e.g. "Dark Psychology")
- "parentNiche": MUST be exactly one of the canonical niche names listed in STEP 2 (e.g. "True Crime", "Gaming", "Personal Finance") — never invent a category outside that list
- "hook": one sentence on how BOTH audiences connect with this blend
- "algorithmNote": why YouTube recommends this to BOTH communities simultaneously
- "titlePreview": apply EXACTLY this formula "${formula}" to the blended topic

[`,
      }, {
        role: "assistant",
        content: "[",
      }],
    });

    const raw = "[" + (msg.content[0].type === "text" ? msg.content[0].text : "");
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    // Strict field mapping — system prompt enforces exact keys
    const base = parsed.map((n: any) => ({
      name: n.name || "Unknown",
      parentNiche: n.parentNiche || "",
      hook: n.hook || "",
      algorithmNote: n.algorithmNote || "",
      titlePreview: n.titlePreview || "",
    }));

    const sourceNicheName = resolveNiche(sourceNiche)?.name || sourceNiche || "";
    // Enrich each bridge with real RPM arbitrage (#2) + a YouTube blend proof (#1).
    // Proof/RPM are best-effort: any failure leaves that field null and the card still renders.
    const niches = await Promise.all(
      base.map(async (n: any) => {
        const rpm = rpmArbitrage(sourceNiche, n.parentNiche);
        const query = `${n.name} ${sourceNicheName}`.trim();
        const proof = await fetchBlendProof(query).catch(() => null);
        const bid = resolveNiche(n.parentNiche)?.id ?? null;
        const poolCount = bid ? (poolCounts.get(bid) ?? 0) : 0;
        return { ...n, rpmLabel: rpm?.label ?? null, bridgeRpm: rpm?.bridgeRpm ?? null, proof, poolCount: poolCount || null };
      })
    );
    return NextResponse.json({ niches });
  } catch (e: any) {
    console.error("[suggest-bridge-niches]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to generate bridge niches" }, { status: 500 });
  }
}
