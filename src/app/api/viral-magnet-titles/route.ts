import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserPlan } from "@/lib/usage";
import Anthropic from "@anthropic-ai/sdk";
import { EXPERT_ATTRIBUTION_RULE } from "@/lib/ai/claude";
import { weightedOverall, passesGates, validateTitle } from "@/lib/title-validate";

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

FIRST, name the STORY STRUCTURE (the semantic spine, not punctuation). Example: "Crime → 40-year disappearance → courtroom reversal". This is what the titles must all serve — it is the thing to package, not a template to copy.

ARCHITECTURE (this order is mandatory): STORY → strongest title CONCEPT → OPTIONAL magnet → natural rewrite. Never go magnet → find a slot → build a title around it. The story picks the title; the magnet is an ingredient that may or may not improve it. If the honest, specific story concept is stronger WITHOUT a selected magnet, that title is allowed and can win.

THE ONE RULE ABOVE ALL: a magnet is an INGREDIENT, not a REQUIREMENT. A title wins because of the story it reveals, not because it contains a viral word. The selected magnets are CANDIDATES, not mandatory. A variation may use a stronger non-selected synonym the story actually supports ("vanished" instead of the selected "disappeared"), or use NO magnet at all, if that reads best. Do not treat any selected word as something you must demonstrate.

STORY SPINE MUST BE FACTUAL, not editorialized: describe it in neutral event terms ("Hijacking → disappearance → extradition battle → legal reversal"), never with interpretation baked in ("beat the system", "outsmarted everyone").

ADJECTIVE-ATTACHMENT RULE: an adjective describing a PERSON or CRIME must grammatically attach to the person/crime/organization/event, NEVER to an object or vehicle. "infamous hijacker" ✅, "infamous plane" ❌; "notorious criminal" ✅, "notorious flight" ❌. If a magnet is a person-adjective and it can only be slotted next to an object, do not use it there — rewrite so it attaches correctly or omit it from that title.

TITLE STRUCTURE LIBRARY (these are SEMANTIC constructions, not punctuation patterns): Narrative, Outcome-first, Mystery, Contradiction, Transformation, Time-anchored, Identity-first, Mechanism, Before/After, Question, Minimal, Declarative, Cause/Effect, Unexpected-outcome.

TASK: Generate ${magnetWords.length} "minimal" title${magnetWords.length === 1 ? "" : "s"} (one per selected magnet word), plus exactly 8 "variation" titles that each use a DIFFERENT structure from the library above.

GROUP 0 — "minimal" (exactly one title PER selected word — ${magnetWords.length} total):
The user already likes their ORIGINAL TITLE and just wants to see it with each magnet word added on its own. For EACH selected word, produce one title that takes the ORIGINAL TITLE and changes as LITTLE as possible: keep every existing word and the exact structure, and insert THAT ONE word in the most natural-reading position. Example: "The World's Most Addictive App" + "insane" → "The World's Most Insane Addictive App". Do NOT rephrase, shorten, reorder, or restructure — smallest possible edit only. Each minimal title uses exactly ONE magnet word (do not combine words here).
GRACEFUL FALLBACK: if a word genuinely cannot be slotted in with a near-minimal edit while staying grammatical and natural, make the SMALLEST possible natural adjustment to fit it — never output awkward or broken grammar. If the word is already present in the original title, lightly reposition or keep it so the title still reads clean. Every minimal title must read like a real, publishable title.

GROUP 1 — "variation" (exactly 8 titles, STRUCTURE DIVERSITY IS THE POINT):
Each of the 8 titles MUST use a DIFFERENT structure from the library, so the set explores the packaging space instead of rephrasing one shape. Do not produce 8 versions of the same construction. Tag each with its "structure". Keep the same topic/niche and serve the story structure. These are creative rewrites (word as constraint, not string insertion) — you may fully rephrase so the wording reads inevitable.

PUNCTUATION IS A STYLE VARIABLE, NOT A FORMULA (critical): Use punctuation naturally. Do NOT favor em dashes, colons, questions, periods, or any other punctuation pattern across the set. An em dash is OPTIONAL and only justified when it genuinely improves readability, rhythm, or contrast — NEVER inserted merely to manufacture a dramatic beat. A title like "He Hijacked a Plane, Vanished for 40 Years and Won in Court" (commas, no dash) is preferred over the same line forced into "He X — Then Y" if the dash adds nothing. Across the 8 variations, vary the punctuation; if more than a couple lean on the same "[setup] — Then [payoff]" dash pattern, rewrite them.

SPECIFICITY BEATS ADJECTIVES (scoring principle): concrete specifics — "$1 million", "40 years", "in court" — are far more powerful than stacked adjectives like "notorious", "actually", "insane". When two titles compete, the one carrying real specifics from the story should score higher on curiosity and storyFit than the one leaning on adjectives. Reward the specific, concrete story over the generic true-crime-sounding line.

WORD USAGE (the selected words are INGREDIENTS, not a checklist):
${magnetWords.length >= 2
  ? `- The user selected ${magnetWords.length} words (${magnetWords.join(", ")}) as the ingredients they are interested in. This does NOT mean every title must use all of them. The BEST title may use only one selected word, or two, or none if the original already wins. Spread the selected words across the set so each appears somewhere, and try some genuine pairings, but a clean title using ONE word beats an awkward one that crams in all three. Never reward "used all three" over "reads best".`
  : `- Only one word was selected — weave it naturally where it belongs; it need not appear in every title if a variation reads stronger without it.`}
- Combine words ONLY when the title still reads natural and click-worthy. A clean two-word pairing beats three words crammed in awkwardly. Placement matters: put a word where it does the most work (e.g. "actually" belongs before the unexpected OUTCOME — "actually beat them in court" — not before a neutral verb like "actually vanished").

CHARACTER LIMIT (hard): every title must be UNDER 65 characters so YouTube does not truncate it; aim for 50-60 on the primary. Count characters, not words. If a strong idea runs long, tighten it — never ship an over-length title. The "minimal" title should also stay under 65 unless the original itself is longer.

NUMERIC CONSISTENCY (hard failure): every number, date, age, dollar amount, duration, percentage, count or ranking in a title MUST match a number in the original title or the script/context. Never independently "adjust" a number (if the story says 23 years, never write 28 years). Do not introduce a number the source does not contain. This is verified in code and an unverified number disqualifies the title.

NARRATIVE COMPRESSION vs FACTUAL EXPANSION: narrative compression is allowed, factual expansion is not. "A TV broadcast ended her double life" is acceptable stylistic compression of a real chain; "a TV show found her" invents a false cause; "the broadcast exposed her identity" is the literal fact. Compress the telling if you must, but never assert a NEW fact (a number, a cause, a specific action) the source doesn't support.

LEGAL-STATUS PRECISION: "wanted for pipe bombs" implies she was personally charged with the bombing acts. If the record only supports involvement/a case, prefer "wanted in a pipe-bomb case" over "wanted for pipe bombs". Match the documented legal status, do not sharpen it.

CLAIM-SCOPE RULE (this is the #1 accuracy control): the actor + action + object in a title must match the DOCUMENTED scope. Do not upgrade involvement into direct participation. "Was involved in a plot to bomb LAPD cars" must NOT become "planted pipe bombs under LAPD cars"; "was convicted in connection with a killing" is not "killed"; "was accused of stealing" is not "stole"; "won an extradition ruling" is not "beat the FBI". If the script does not state the person personally performed the exact action on the exact object at the exact time, the title may not assert it. When unsure, use the less specific, accurate verb.

ENTITY-LABEL LADDER: the stronger the label, the stronger the evidence it needs. Documented descriptors (fugitive, wanted suspect, SLA member, convicted criminal) are safe. Interpretive labels (radical, bomb plotter, notorious figure) need a fair basis. High-risk labels (terrorist, mastermind, extremist, kingpin) may be used ONLY if the source explicitly supports that characterization — never auto-upgrade "bomb suspect / wanted fugitive" into "domestic terrorist".

CAUSAL-COMPRESSION RULE: narrative shorthand must not invent a new causal claim. "A TV show found her" overstates (a broadcast aired → a viewer recognized her → authorities investigated); the accurate framing is "a TV show exposed her" or "helped identify her". Do not compress a chain into a single false cause.

EXPLANATION DISCIPLINE: the same accuracy rules apply to your "whyItWorks" and "adds" text, not just the title. Do not invent new claims in the rationale ("the agency walked away with nothing", "the neighbors saw her every day") that the script does not establish. An accurate title with an invented explanation still fails.

GOOD WRITING IS NOT HIGH PULL: an elegant, natural word ("quietly") is not automatically high-pull. Score naturalness and pull independently — do not let a stylish word inflate its pull score.

RULES:
- 6-12 words per title for optimal CTR (the "minimal" title is EXEMPT — it must stay as close to the original length/structure as possible)
- Specific > vague. Numbers and concrete details beat abstractions and adjectives
- Every magnet word used must feel INEVITABLE — like it belongs there — not inserted
- No title should start with the same word as another title (the "minimal" title is exempt from this)

USE THE WORD AS A CREATIVE CONSTRAINT, NOT A REQUIRED STRING INSERTION (variation group): you may rewrite the title so the word reads inevitable ("Fast Food Quietly Became So Expensive", never "Fast Food Became Quietly So Unaffordable"). Only the "minimal" group keeps the original structure.

DUPLICATE-WORD RULE: if a selected magnet word is ALREADY in the original title, do not produce a "minimal" title that swaps the word for itself, and NEVER describe a word as an upgrade over itself ("vanished is an upgrade over vanished" is a bug). For such a word, either build a genuinely different variation or skip its minimal entry, and set that word's minimal whyItWorks to note it is already the original's word.

CERTAINTY RULE (hard, same as the script pipeline): a magnet word may intensify PRESENTATION, never the underlying FACTUAL PROPOSITION. It may make the true story feel sharper; it may not make it claim more. Do not let a word invent a cause, an event, or a certainty the context does not support ("a loophole set him free" or "brought him back" state more than "a legal outcome" does). If a title only works by overstating, it must score low on accuracy.

EXCLUSIVITY RULE: superlative/exclusivity claims ("nobody talks about", "the only", "the first", "never before", "no one saw coming", "completely", "everyone knows") assert something about the whole world the research almost never establishes. Do NOT give such a title a high accuracy score, and never rank it #1, unless the context explicitly supports the claim. Prefer curiosity that does not require an unverifiable world-scale assertion.

INSTITUTIONAL-FRAMING RULE (graded): distinguish three levels. EXACT outcome ("won his extradition case") is grounded. "Beat the FBI" is INTERPRETIVE packaging of that win — allowed, but not a documented fact, keep accuracy honest. "Defeated / outsmarted / humiliated the FBI" is POTENTIALLY MISLEADING — it claims more than the record shows; avoid unless the story literally supports it, and score its accuracy low. Same for "a court LET him keep his freedom" (implies the court affirmatively granted freedom) vs the accurate "a court ruled in his favor / against extradition" — prefer the accurate framing. And "the FBI forgot him" is a NEW factual claim (staying at large ≠ institutional forgetfulness); do not assert it.

NO-OVERSELL RULE: explanations must not exceed the evidence or read the viewer's mind. Do not write "cultural legend", "raises the viewer's curiosity about why they've never heard of him", or similar mind-reading/inflation. Describe the concrete psychological job the word does ("signals a significant criminal history before the reversal"), nothing grander.

"impossible" is a HIGH-RISK intensifier: implausible/improbable is NOT impossible. Only score it accurate when the story establishes literal impossibility; otherwise prefer improbable/extraordinary/unexpected and drop its accuracy.

SCORE EACH TITLE IN CONTEXT with ONE-DECIMAL precision (0.0-10.0), and SCORE HARD, do not inflate. Vary the dimensions — a title is almost never the same number across all five. Reserve 9.5+ for genuinely exceptional; strong titles sit around 8.5-9.4; solid ones 7-8.4; flawed ones 5-6.9; broken ones below 5. NEVER return 9/9/9/9/9 — that means you did not actually evaluate. Worked example of the discrimination expected:
- "He Hijacked a Plane in 1972, Vanished, and Won in Court 40 Years Later" → pull 8.8, naturalness 9.6, accuracy 9.8, curiosity 9.0, storyFit 9.7 (concrete, grounded, specific).
- "He Hijacked an Infamous Plane, Then Beat the FBI in Court" → pull 7.0, naturalness 5.8, accuracy 6.8, curiosity 6.7, storyFit 5.9 (adjective misattached, framing loose).
For every title give "scores": pull, naturalness, accuracy (does NOT intensify the factual claim), curiosity, storyFit (does it push the video's STRONGEST narrative promise, not a lesser angle), and specificity (how many concrete, verifiable story anchors it carries — numbers, names, places, events — vs generic adjectives). SPECIFICITY IS ITS OWN SCORE: "23 years / doctor's wife / FBI" scores high on specificity; "quietly / notorious / shocking" scores low. A specific title should out-rank a generic one. Also give "adds": 2-4 words naming what the magnet contributes ("Mystery + reversal", "Contradiction", "Hidden mechanism"), or "" if the title uses no magnet.

BEST OVERALL + HARD GATES + NO-FORCED-MAGNET VERDICT: score the ORIGINAL TITLE ("originalScore", 0-10). The system computes the final ranking OUTSIDE your response using a weighted score (25% curiosity, 25% storyFit, 20% naturalness, 20% accuracy, 10% pull) and HARD GATES: any title with accuracy < 8, naturalness < 8, OR storyFit < 8 cannot be ranked #1. Pull can never rescue a title that fails a gate — score every dimension honestly and independently, because inflating one will not lift a title that fails another. Still return your own "bestOverall" pick and "verdict" ("variation-wins" if a variation genuinely beats the original without hurting clarity/accuracy, else "original-strongest"), but know the gates are enforced in code afterward.

${EXPERT_ATTRIBUTION_RULE}

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "storyStructure": "the semantic spine, e.g. 'Crime → 40-year disappearance → courtroom reversal'",
  "originalScore": 8,
  "verdict": "variation-wins",
  "bestOverall": { "title": "the single strongest title (a variation, or the original if it wins)", "packagingScore": 9, "why": "one sentence" },
  "titles": [
    {
      "title": "string",
      "type": "minimal | variation",
      "structure": "which STRUCTURE LIBRARY construction this uses (e.g. Narrative, Mystery, Time-anchored)",
      "magnetWords": ["each selected magnet word that actually appears in this title"],
      "adds": "2-4 words: what the magnet contributes",
      "scores": { "pull": 8.8, "naturalness": 9.6, "accuracy": 9.8, "curiosity": 9.0, "storyFit": 9.7, "specificity": 9.4 },
      "whyItWorks": "string — one tight sentence, no self-comparison"
    }
  ]
}`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2200,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
    const data = JSON.parse(clean);
    // Normalize + attach DETERMINISTIC overall score and validator warnings so the
    // ranking can't be gamed by the LLM inflating one dimension.
    if (Array.isArray(data?.titles)) {
      data.titles = data.titles.map((t: any) => {
        const overall = weightedOverall(t.scores);
        return {
          ...t,
          magnetWords: Array.isArray(t.magnetWords)
            ? t.magnetWords.filter(Boolean)
            : (t.magnetWord ? [t.magnetWord] : []),
          overall,
          gated: !passesGates(t.scores),
          warnings: validateTitle(String(t.title || ""), `${title}\n${script || ""}`),
        };
      });

      // Pick Best Overall in CODE: highest weighted score among titles that pass the
      // hard gates AND carry no validator warning. If none qualify, the original wins.
      const eligible = data.titles.filter((t: any) => !t.gated && (t.warnings?.length || 0) === 0 && typeof t.overall === "number");
      eligible.sort((a: any, b: any) => (b.overall as number) - (a.overall as number));
      const origScore = typeof data.originalScore === "number" ? data.originalScore : 0;
      const top = eligible[0];
      if (top && (top.overall as number) > origScore) {
        data.bestOverall = { title: top.title, packagingScore: top.overall, why: top.whyItWorks || "" };
        data.verdict = "variation-wins";
      } else {
        data.verdict = "original-strongest";
        data.bestOverall = { title, packagingScore: origScore, why: "No variation clears the accuracy, naturalness, and story-fit gates while beating the original." };
      }
    }
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("viral-magnet-titles error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
