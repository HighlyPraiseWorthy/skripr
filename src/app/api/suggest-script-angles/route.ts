import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { topic, niche, videoLength = "medium", hookTypeFilter } = await req.json();
    if (!topic) return NextResponse.json({ error: "Topic is required" }, { status: 400 });

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
