import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserPlan } from "@/lib/usage";
import { supabaseAdmin } from "@/lib/db/supabase";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// VIRAL MAGNET, ANALYSIS FIRST. A word has no universal viral score, its power depends on THIS
// story. So before the user picks anything, analyze the title + script, find the psychological hook,
// then recommend and score the words that amplify THAT hook, in context, accurately. Words are drawn
// only from the real magnet vocabulary (the DB) so recommendations stay grounded in proven words.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await getUserPlan(userId);
  if (plan === "free") {
    return NextResponse.json({ error: "Viral Magnet requires a Starter plan or above." }, { status: 403 });
  }

  const { title, script, niche } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

  // Pull the real vocabulary so recommendations come from proven magnet words, not invented ones.
  let vocab: string[] = [];
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin.from("magnet_words").select("word").eq("is_active", true);
    vocab = (data || []).map((w: any) => String(w.word)).filter(Boolean);
  }

  const prompt = `You are a YouTube packaging strategist. A viral "magnet" word has NO universal power, its strength depends entirely on THIS specific story and title. Your job: find the video's psychological hook, then recommend the words that amplify THAT hook naturally and accurately.

TITLE: "${title}"
${script?.trim() ? `SCRIPT / CONTEXT:\n"""\n${script.trim().slice(0, 1800)}\n"""` : ""}
${niche ? `NICHE: ${niche}` : ""}

STEP 1, read the story: What is the core curiosity gap? What is the single strongest psychological trigger (contradiction, secrecy, mechanism/cleverness, escalation/danger, myth-correction)? What claims does the title/script actually support (so a word never overstates)?

STEP 2, recommend words FROM THIS VOCABULARY ONLY (do not invent words outside it):
${vocab.length ? vocab.join(", ") : "(no vocabulary available, recommend the strongest common magnet words for this story)"}

Pick the 5 to 8 words that most NATURALLY and ACCURATELY amplify the hook you identified, ranked best first. For each, assign a pullType (exactly one of: "Hidden/Discovery", "Contradiction/Surprise", "Mechanism/Intelligence", "Escalation/Consequences", "Truth/Correction", "High Intensity"), a one-line "strengthens" (the specific lever it sharpens for THIS story), an example title that uses it well (you may rewrite the original, not just insert), and integer 0-10 scores in context: pull (click power), naturalness (reads like a real title, not jammed in), accuracy (does not overstate what the script supports), curiosity. A "High Intensity" word (terrifying, shocking, insane, brutal) scores LOW on accuracy unless the script genuinely earns it, add a "caution" note in that case.

NO-FORCED-MAGNET: if NO word in the vocabulary improves this title without hurting clarity or accuracy, set "noStrongMatch": true and keep "recommended" short (1-2 at most, honestly caveated). A great original title needs no magnet word, and saying so builds trust.

Return ONLY valid JSON, no fences:
{
  "coreHook": "one sentence: the curiosity gap / psychological trigger this video is built on",
  "bestMatch": "the single best word for this title, verbatim from the vocabulary, or null",
  "noStrongMatch": false,
  "recommended": [
    { "word": "...", "pullType": "Contradiction/Surprise", "strengthens": "...", "example": "an example title using it", "scores": { "pull": 9, "naturalness": 9, "accuracy": 10, "curiosity": 8 }, "caution": "" }
  ]
}`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const data = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
    // Only surface recommended words that actually exist in the vocabulary (guard against drift).
    if (Array.isArray(data?.recommended) && vocab.length) {
      const lc = new Set(vocab.map((w) => w.toLowerCase()));
      data.recommended = data.recommended.filter((r: any) => r?.word && lc.has(String(r.word).toLowerCase()));
    }
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("magnet-analyze error:", err?.message);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
