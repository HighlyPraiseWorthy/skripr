import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserPlan } from "@/lib/usage";
import { supabaseAdmin } from "@/lib/db/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { weightedOverall } from "@/lib/title-validate";

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

Pick the 5 to 8 words that most naturally and accurately amplify the hook, ranked best first. For each give:
- "pullType": exactly one of "Hidden/Discovery", "Contradiction/Surprise", "Mechanism/Intelligence", "Escalation/Consequences", "Truth/Correction", "High Intensity".
- "adds": 2-4 words naming the psychological effect the word contributes (e.g. "Mystery + reversal", "Contradiction", "Hidden mechanism").
- "strengthens": ONE short sentence, the specific lever it sharpens for THIS story. Keep it tight.
- "example": one example title using it well (you may rewrite the original, not just insert).
- "support": how grounded the word is in what the script establishes — "grounded" (the script plainly supports it), "interpretive" (a fair characterization the script does not state outright, e.g. calling a legal outcome a "loophole"), "rhetorical" (a pun / double-meaning word like "explosive" for a bombing story — works as wordplay, best in a THUMBNAIL or subtitle, not the primary clause), or "unsupported" (it would overstate or change the facts). Prefer grounded words; include interpretive/rhetorical only when it is a fair read and flag it; NEVER recommend an "unsupported" one.
- "scores": integers 0-10 for pull (click power), naturalness (reads like a real title, not jammed in), accuracy (does NOT intensify the factual claim beyond what the script supports), curiosity, and storyFit (does it push the video's STRONGEST narrative promise, the core hook above, rather than a lesser angle).
- "caution": a short note if the word needs verification or leans hype, else "".

SCORE HARD with ONE-DECIMAL precision (0.0-10.0), do not inflate. Reserve 9.5+ for genuinely exceptional in that dimension; strong words 8.5-9.4; good 7-8.4; mediocre fit 4-6.9. Vary the dimensions — never return 9/9/9/9/9. SPECIFICITY BEATS ADJECTIVES: a word that adds a concrete story lever outscores a generic intensifier.

ADJECTIVE-ATTACHMENT: if the word is a person/crime adjective (infamous, notorious, convicted), note in "caution" that it must attach to the person or crime, never an object ("infamous hijacker" not "infamous plane").

CLAIM-SCOPE: a word must not upgrade the documented scope — do not let a word turn "involved in a plot" into "planted the bombs", "won an extradition ruling" into "beat the FBI", or "TV exposure led to identification" into "a show found her". If a word only works by such an upgrade, mark it interpretive/unsupported.

ENTITY-LABEL LADDER: documented descriptors (fugitive, suspect, convicted, member) are grounded; interpretive labels (radical, plotter, notorious) need a fair basis; high-risk labels (terrorist, mastermind, extremist, kingpin) require the source to state them — do not recommend auto-upgrading a suspect into a "terrorist".

GOOD WRITING ≠ HIGH PULL: an elegant, natural word ("quietly") is not automatically high-pull. Score naturalness and pull independently; do not let a stylish word inflate its pull.

EXPLANATION DISCIPLINE: your "strengthens"/"adds" text must not introduce claims beyond what the script establishes.

STRONGEST PULL MAY BE A STORY CONTRAST, NOT A WORD: if the story's own concrete contrast (e.g. "Fugitive, Mom, Church Volunteer") is a stronger hook than any single magnet, say so via noStrongMatch and keep recommendations honest.
CERTAINTY RULE (hard, same as the script pipeline): a magnet word may intensify PRESENTATION, never the underlying FACTUAL PROPOSITION. It may make the true story feel sharper; it may not make it claim more (do not let "legal outcome" become "loophole set him free" as if that is documented, do not let a word invent a cause, a certainty, or an event). If a word only works by overstating, mark it interpretive/unsupported and drop its accuracy score.

NO-OVERSELL RULE: your "strengthens"/"adds" text must NOT exceed the evidence or read the viewer's mind. Never write "cultural legend", "raises curiosity about why they've never heard of him", or similar inflation/mind-reading. Name the concrete psychological job only (e.g. for "notorious": "signals a significant criminal history before the reversal" — not "elevates him to cultural legend").

HIGH-RISK INTENSIFIERS: "impossible" is high-risk — implausible/improbable is NOT impossible. Recommend "impossible" only if the script establishes literal impossibility; otherwise mark it interpretive at best (or drop it) and note improbable/extraordinary/unexpected are the accurate words. Same caution for "unbeatable", "flawless", "perfect".

INSTITUTIONAL FRAMING: words that imply defeating an agency ("beat the FBI", "outsmarted the government") are packaging language, not documented fact when the story only shows a specific legal outcome — mark such usage interpretive and caution accordingly.

NO-FORCED-MAGNET: if NO word improves this title without hurting clarity or accuracy, set "noStrongMatch": true and keep "recommended" short (1-2, honestly caveated). A great original title needs no magnet word, and saying so builds trust.

Return ONLY valid JSON, no fences:
{
  "coreHook": "one sentence: the curiosity gap / psychological trigger this video is built on",
  "primaryPull": "2-4 words: the dominant psychological lever (e.g. 'Contradiction + reversal')",
  "bestMatch": "the single best word for this title, verbatim from the vocabulary, or null",
  "noStrongMatch": false,
  "recommended": [
    { "word": "...", "pullType": "Contradiction/Surprise", "adds": "Mystery + reversal", "strengthens": "one short sentence", "example": "an example title", "support": "grounded", "scores": { "pull": 8.4, "naturalness": 9.1, "accuracy": 9.6, "curiosity": 8.2, "storyFit": 9.0 }, "caution": "" }
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
    if (Array.isArray(data?.recommended)) {
      if (vocab.length) {
        const lc = new Set(vocab.map((w) => w.toLowerCase()));
        data.recommended = data.recommended.filter((r: any) => r?.word && lc.has(String(r.word).toLowerCase()));
      }
      // Deterministic overall (same weighting as titles) so magnet ranking is consistent,
      // then rank best-first by it — magnet quality is scored the same way title quality is.
      data.recommended = data.recommended
        .map((r: any) => ({ ...r, overall: weightedOverall(r.scores) }))
        .sort((a: any, b: any) => (b.overall ?? 0) - (a.overall ?? 0));
    }
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("magnet-analyze error:", err?.message);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
