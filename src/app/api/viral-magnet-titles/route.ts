import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserPlan } from "@/lib/usage";
import Anthropic from "@anthropic-ai/sdk";
import { EXPERT_ATTRIBUTION_RULE } from "@/lib/ai/claude";

export const maxDuration = 120;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Locked — Starter plan or above required
  const plan = await getUserPlan(userId);
  if (plan === "free") {
    return NextResponse.json(
      { error: "Viral Magnet Titles requires a Starter plan or above. Upgrade at skripr.app/dashboard/settings" },
      { status: 403 }
    );
  }


  const { title, script, magnetWords } = await req.json();
  if (!title?.trim() || !magnetWords?.length) {
    return NextResponse.json({ error: "title and magnetWords required" }, { status: 400 });
  }

  const prompt = `You are an expert YouTube title strategist with deep knowledge of what drives clicks and views.

ORIGINAL TITLE: "${title}"
${script?.trim() ? `VIDEO CONTEXT: ${script.trim().slice(0, 600)}` : ""}
SELECTED VIRAL MAGNET WORDS: ${magnetWords.join(", ")}

YouTube title formulas to reference:
- How-to: "How to [verb] [outcome] in [timeframe]"
- Curiosity gap: "The [thing] Nobody Talks About"
- Personal result: "I [did X] for [N days/times]: Here's what happened"
- Shock/contrast: "[Expected thing] vs [Surprising thing]: [result]"
- List: "[N] [adjective] [things] that [outcome]"
- POV/immersive: "POV: [vivid situation]"
- Reveal: "The truth about [X] (it's not what you think)"
- Challenge: "I tried [X] every day for [N days] so you don't have to"
- Confession: "I've [done X for N years]. Here's what I actually learned"
- Before/after: "How I went from [before] to [after] in [timeframe]"

TASK: Generate exactly 9 titles using the provided magnet words (1 minimal + 3 same-formula + 5 new-formula).

GROUP 0 — "minimal" (exactly 1 title):
The user already likes their ORIGINAL TITLE and just wants to see it with the magnet word added. Take the ORIGINAL TITLE and change as LITTLE as possible: keep every existing word and the exact structure, and insert the selected magnet word(s) in the most natural-reading position. Example: "The World's Most Addictive App" + "insane" → "The World's Most Insane Addictive App". Do NOT rephrase, shorten, reorder, or restructure — the smallest possible edit only. If more than one word is selected, slot them all in naturally if it still reads cleanly; otherwise use just the first.

GROUP 1 — "same-formula" (exactly 3 titles):
Identify the structural formula/pattern of the original title. Generate 3 variations that preserve that exact formula but with the magnet word naturally woven in. These should feel like upgraded versions of the original — same DNA, higher CTR.

GROUP 2 — "new-formula" (exactly 5 titles):
Use different YouTube title formulas from the list above. Keep the same topic/niche. Use at least 3 different formula types across the 5 titles.

WORD PAIRING (most important):
${magnetWords.length >= 2
  ? `- The user selected ${magnetWords.length} words (${magnetWords.join(", ")}) BECAUSE they want them working TOGETHER. At LEAST 4 of the 8 titles MUST naturally combine TWO of the selected words in the same title, and at least one title should try to land all ${magnetWords.length} words if it still reads naturally. Spread the remaining titles so every selected word appears somewhere across the set.`
  : `- Only one word was selected — weave it naturally into every title.`}
- Combine words ONLY when the title still reads natural and click-worthy. A clean two-word pairing (e.g. "The Forbidden Truth About...") beats three words crammed in awkwardly. Never force a word just to hit a count — but genuinely try to pair, since pairing is the whole point of selecting multiple words.

RULES:
- 6-12 words per title for optimal CTR (the "minimal" title is EXEMPT — it must stay as close to the original length/structure as possible)
- Specific > vague. Numbers and concrete details beat abstractions
- Every magnet word used must feel INEVITABLE — like it belongs there — not inserted
- No title should start with the same word as another title (the "minimal" title is exempt from this)

${EXPERT_ATTRIBUTION_RULE}

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "detectedFormula": "brief name of the original title's formula type",
  "titles": [
    {
      "title": "string",
      "type": "same-formula",
      "formula": "string — which formula pattern was used",
      "magnetWords": ["each selected magnet word that actually appears in this title"],
      "whyItWorks": "string — one tight sentence on why this title will perform"
    }
  ]
}`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1800,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
    const data = JSON.parse(clean);
    // Normalize: always expose magnetWords[] (older shape used magnetWord)
    if (Array.isArray(data?.titles)) {
      data.titles = data.titles.map((t: any) => ({
        ...t,
        magnetWords: Array.isArray(t.magnetWords)
          ? t.magnetWords.filter(Boolean)
          : (t.magnetWord ? [t.magnetWord] : []),
      }));
    }
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("viral-magnet-titles error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
