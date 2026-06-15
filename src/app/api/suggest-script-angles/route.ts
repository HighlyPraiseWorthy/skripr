import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { getNicheHookExamplesBlock, getNicheTitleFormulasBlock } from "@/lib/viral-frameworks";
import { getPickedAnglesBlock } from "@/lib/angle-picks";

const client = new Anthropic();
export const maxDuration = 120;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { topic, niche, videoLength = "medium", hookTypeFilter, viralMagnetWord } = await req.json();
    if (!topic) return NextResponse.json({ error: "Topic is required" }, { status: 400 });

    // Self-improving layer: ground suggestions in proven hooks + title formulas
    // for the niche, and lean toward angles creators actually picked. All three
    // helpers are time-boxed and null-safe, so they never block or break.
    const [pickedAngles, hookExamples, titleFormulas] = await Promise.all([
      getPickedAnglesBlock(niche).catch(() => null),
      getNicheHookExamplesBlock(niche, 4).catch(() => null),
      getNicheTitleFormulasBlock(niche, 4).catch(() => null),
    ]);
    const learning = [
      pickedAngles ? `ANGLES CREATORS PICKED IN THIS NICHE — strongest signal, lean toward this kind of framing (never copy wording):\n${pickedAngles}` : "",
      hookExamples ? `PROVEN HOOKS IN THIS NICHE — model "hookPremise" on these mechanics:\n${hookExamples}` : "",
      titleFormulas ? `PROVEN TITLES IN THIS NICHE — model "titleSuggestion" on these formulas:\n${titleFormulas}` : "",
    ].filter(Boolean).join("\n\n");

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: `You output ONLY valid JSON arrays. No prose, no markdown. Start with [ and end with ].
Each object must have EXACTLY these keys: "hookType", "hookPremise", "titleSuggestion", "whyItWorks", "audienceEmotion".`,
      messages: [{
        role: "user",
        content: `A YouTube creator wants to make a video about: "${topic.slice(0, 120)}"
Niche: ${niche || "general"}
Length: ${videoLength}
${learning ? `\n${learning}\n` : ""}${viralMagnetWord ? `\nVIRAL MAGNET WORD: Every "titleSuggestion" MUST naturally include the word "${viralMagnetWord}" — weave it where it creates maximum curiosity or urgency, never forced. Work it into the "hookPremise" too when it fits naturally.\n` : ""}
${hookTypeFilter
  ? `Generate 5 DIFFERENT ANGLES for this topic, ALL using the "${hookTypeFilter}" hook type. Each should take a different specific approach within that hook type.`
  : `Generate 5 completely different hook angles. Each must use a DIFFERENT psychological hook:
- CONTROVERSY: Challenge a sacred belief
- CURIOSITY GAP: Create an itch they must scratch
- AUTHORITY: Lead with surprising data that reframes everything
- MYTH-BUST: Destroy the most common wrong assumption
- STORY: Open with a specific moment that makes stakes visceral
- PATTERN INTERRUPT: Violate expectations immediately
- FEAR/STAKES: Make the cost of NOT knowing feel immediate
- INSIDER SECRET: What the industry doesn't want you to know`}

For each angle return EXACTLY:
- "hookType": hook type (ALL CAPS)
- "hookPremise": opening hook sentence (1-2 sentences, punchy, specific)
- "titleSuggestion": full YouTube title (8-12 words, high CTR)
- "whyItWorks": one sentence on the psychology
- "audienceEmotion": primary emotion (curiosity / fear / anger / excitement / surprise)

[`,
      }, {
        role: "assistant",
        content: "[",
      }],
    });

    const raw = "[" + (msg.content[0].type === "text" ? msg.content[0].text : "");
    const angles = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json({ angles, topic, niche, hookTypeFilter: hookTypeFilter || null });
  } catch (e: any) {
    console.error("[suggest-script-angles]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to generate angles" }, { status: 500 });
  }
}
