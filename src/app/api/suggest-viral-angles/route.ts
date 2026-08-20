import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { getNicheHookExamplesBlock, getNicheTitleFormulasBlock } from "@/lib/viral-frameworks";
import { getPickedAnglesBlock } from "@/lib/angle-picks";
import { extractTrailingExpert, stripCarriedExpert } from "@/lib/title-utils";
import { PROVENANCE_RULE, extractJSON } from "@/lib/ai/claude";
import { buildGroundingBlock, type GroundingContext } from "@/lib/research";

const client = new Anthropic();
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { hookType, hookAnalysis, remixFramework, selectedTitle, selectedTitleDescription, selectedTitleAudience, titleFormula, videoTitle, niche, grounding } = await req.json();
    const groundingBlock = buildGroundingBlock(grounding as GroundingContext | undefined);

    // RESEARCH-BEFORE-CARDS + STRUCTURAL SLOTS. When the case has already been
    // deepened (facts are present), stop generating five free-form angles from a
    // 2-sentence blurb — the root cause of cards that assert endings that never
    // happened and overlap heavily. Instead build one card per structural slot,
    // each grounded in the numbered facts, and drop any slot fewer than two facts
    // support. Fewer, true, non-overlapping cards beat five dramatic guesses.
    // Use the FULL researched set (case + context facts), not a 12-fact slice. The old cap of
    // 12 was the reason the angle page recycled the same five core numbers: context depth
    // gathered 30-50 distinct facts but only the first 12 (the pinned core case figures) ever
    // reached the cards, so the writer had almost nothing else to build from. Raising it puts
    // the distinct context material (detection, prior cases, victims, response) ON the page.
    const deepFacts: string[] = Array.isArray(grounding?.facts) ? grounding.facts.filter((f: any) => typeof f === "string" && f.trim()).slice(0, 50) : [];
    const slotsMode = deepFacts.length >= 3;
    const numberedFacts = deepFacts.map((f, i) => `F${i + 1}. ${f}`).join("\n");
    // The CONTESTED slot is only legitimate when the research actually flagged a
    // dispute. Without that signal the model would invent controversy to fill the
    // slot — exactly how "thirty years of corruption" gets manufactured — so the
    // slot is gated on a real conflict existing in the fact set.
    // A dispute the research flagged as a collision, OR a single fact that carries a
    // dispute marker on its own ("X claimed … authorities denied", "disputed", "never
    // resolved"). The narrow collision-only gate missed cases where one answer already
    // stated both sides, so widen it — the contested card is still built only from a
    // fact that genuinely carries the dispute, never invented.
    const disputeInFacts = /\b(disputed|contested|denied|never (?:fully )?resolved|conflicting account|alleged|claimed[^.]{0,60}\bdenied|unsettled|still (?:debated|unknown)|remains? (?:unclear|unknown)|not (?:yet )?(?:fully )?understood)\b/i.test(numberedFacts);
    const hasConflict = !!grounding?.hasConflict || disputeInFacts;
    // Explainers and hypotheticals use a science-shaped slot set: a Kurzgesagt video
    // has no climax or aftermath, it has a mechanism, a sense of scale, and a frontier.
    const isExplainer = grounding?.kind === "explainer" || grounding?.kind === "hypothetical" || grounding?.kind === "claim";

    // Trim remixFramework to prevent transcript bleed into prompt
    const framework = (remixFramework || "").slice(0, 600);
    const whyItWorks = (hookAnalysis?.whyItWorks || "").slice(0, 300);
    const chosenTitle = (selectedTitle || "").slice(0, 150);

    // Self-improving layer: read proven hooks/titles + picked angles for the
    // source video's niche. Time-boxed, null-safe — never blocks suggestions.
    const [pickedAngles, hookExamples, titleFormulas] = await Promise.all([
      getPickedAnglesBlock(niche).catch(() => null),
      getNicheHookExamplesBlock(niche, 4).catch(() => null),
      getNicheTitleFormulasBlock(niche, 4).catch(() => null),
    ]);
    const learning = [
      pickedAngles ? `ANGLES CREATORS PICKED IN THIS NICHE — lean toward this framing (never copy wording):\n${pickedAngles}` : "",
      hookExamples ? `PROVEN HOOKS IN THIS NICHE:\n${hookExamples}` : "",
      titleFormulas && !chosenTitle ? `PROVEN TITLES IN THIS NICHE — model "titleSuggestion" on these formulas:\n${titleFormulas}` : "",
    ].filter(Boolean).join("\n\n");

    // The task differs by mode. Slot mode builds cards from the fact set; the
    // legacy path generates free-form angles from the case blurb (used only when
    // the case hasn't been deepened, e.g. an ungrounded or thin topic).
    // TITLE IS DECIDED UPSTREAM. The creator already chose the video's title at the
    // remix step; this screen picks WHICH VERSION of that video to make, not which
    // video. Emitting fresh titles here let an angle card silently replace the chosen
    // title ("Social Media is FANTASTIC" became "Community is DESTROYING Us"), which
    // inverts the whole premise and throws away the decision the user already made.
    const titleLock = chosenTitle
      ? `TITLE IS ALREADY DECIDED — DO NOT WRITE NEW TITLES. The creator has locked this video's title as "${chosenTitle}". Set "titleSuggestion" to EXACTLY that string on EVERY card, character for character. You are choosing which VERSION of this one video to make, not proposing other videos. Never substitute a different subject, a different superlative, or a different framing — the card's "angle" and "description" carry what makes each option different, and the title stays fixed.`
      : "";

    const taskBlock = slotsMode
      ? `The creator has CHOSEN this video topic: "${chosenTitle || (videoTitle || "").slice(0, 100)}". This video is grounded in a real case, and the SOURCED FACTS are numbered below.

Build angle cards INTO this topic, ONE per STRUCTURAL SLOT, in this priority order:
${isExplainer ? `1. PREMISE — the question or setup the video exists to answer, framed so a viewer feels why it matters
2. MECHANISM — how the thing actually works, step by step. This is the spine of a science explainer and usually the strongest card
3. SCALE — the numbers made felt through a documented comparison, so a figure becomes something a viewer can picture
4. CONSEQUENCE — what it actually means or what would happen, in documented order
${hasConflict ? `5. OPEN QUESTION — what is genuinely unsettled, modelled rather than observed, or still debated. Build this ONLY from facts that say so, never from your own sense that something is uncertain.` : `(Do NOT produce an OPEN QUESTION card. The fact set flags nothing as unsettled, and you must not manufacture doubt.)`}` : `1. SETUP — how the access, entry, cover, or position was obtained
2. MECHANISM — how it actually worked and why it wasn't caught
3. CLIMAX — the single peak documented moment the story builds to
4. AFTERMATH — what happened afterward, including the personal or institutional cost
${hasConflict ? `5. CONTESTED — the disputed/unresolved point the facts flag. Build this ONLY from the genuinely conflicting facts, never from your own sense that something is controversial.` : `(Do NOT produce a CONTESTED card. The fact set contains no flagged dispute, and you must not manufacture one.)`}`}

HARD RULES:
- Build every card ONLY from the numbered facts. A card may rest ONLY on facts that genuinely support its slot.
- Produce a card for a slot ONLY IF at least TWO numbered facts support it. If fewer than two support a slot, OMIT that slot entirely. Never invent a fact, an ending, or a detail to fill a slot.
- Return BETWEEN 2 AND 5 cards. Fewer strong, non-overlapping cards is the correct outcome; padding with a thin or duplicate card is a failure.
- Each card lists "factRefs": the numbers of the facts it rests on, e.g. [1,4]. List only facts that truly support that specific slot.
- Do not let two cards tell the same story with different wording; each must be a genuinely different entry point (its slot).
- ONE SENTENCE PER FACT — NEVER FUSE FACTS INTO ONE SENTENCE. When a card rests on two facts, the description is TWO short sentences, one per fact, each standing on its own. Do NOT combine them into a single sentence, because compressing two unrelated facts into one clause forces you to invent a connection between them that no fact states. Wrong (invents a link): "Receiving likes activates reward regions, a response that persuasive-design research explicitly informed designers to target." Right (two separate facts): "Receiving likes activates reward-related brain regions. Separately, persuasive-technology research from Stanford influenced how notifications were designed." If the two facts have no established relationship, keep them in separate sentences and never imply one connects to the other.
- A card's "description" must NEVER ASSERT A RELATIONSHIP between facts that no fact states — no "through", "because of", "in order to", "rather than", "as a result", or "which means" linking two facts unless a supplied fact establishes that link. Meta's revenue and time-spent-socializing are two numbers; do not fuse them into a trade-off. A neuroscience finding and a design-history finding are two facts; do not chain them into "designers were told to target the brain."
- A card's "description" must NEVER add an INTERPRETIVE FRAME its facts do not carry. If the fact says likes activate "reward-related brain regions including the nucleus accumbens", the description may NOT call it "the same system engaged by addictive stimuli" — addiction is an inference you added, and it is the claim a viewer will repeat. Same for "hijacked", "rewired", "designed to addict". Describe what was measured, not what it implies.
- Do NOT place two figures side by side as a comparison unless the facts establish they are comparable. "2h23m on social media vs 1h30m in person" is misleading when one is global internet users and the other is US adults from a different survey — different populations cannot be contrasted as if they were one. If you present both, name the populations; if that is clumsy, drop the comparison.
- A card's "description" must NEVER be stronger, more certain, or less hedged than the facts it cites. If a fact is attributed ("Queen says…") or disputed ("members claimed X, authorities denied it"), the description must PRESERVE that attribution or dispute — never flatten "a loyalty test that included meth, which he feared could expose him" into "a forced methamphetamine trial". The card must be checkable against its own facts: nothing asserted in the description that the referenced facts do not support at that strength.

${titleLock}`
      : `${chosenTitle
  ? `The creator has CHOSEN this video topic: "${chosenTitle}"
${selectedTitleDescription ? `What it covers: ${String(selectedTitleDescription).slice(0, 200)}` : ""}
${selectedTitleAudience ? `Target audience: ${String(selectedTitleAudience).slice(0, 150)}` : ""}

Generate 5 different angles INTO this exact topic — different entry points, framings, or sub-stories WITHIN "${chosenTitle}". Do NOT change the subject or jump to other niches. Every angle must still be recognizably about this chosen topic.

${titleLock}`
  : `Generate 5 YouTube content angles using this viral framework.

WHITE-SPACE SWAPS: Make 2 of the 5 angles SINGLE-VARIABLE SWAPS of the source title — keep the proven formula and change EXACTLY ONE variable (the subject, the timeframe, the quantity, or the outcome) to claim an under-served sibling angle. Example: "...from Mom..." -> "...from Dad...". This is how the creator differentiates from everyone copying the original video. CRITICAL: the swapped claim MUST stay genuinely true and defensible — never swap into a claim that is false or unsupported just because it's structurally neat. The other 3 angles are normal angles (no swap).`}`;

    const outputSpec = slotsMode
      ? `Output a JSON array of 2 to 5 objects, best slot first. Each object must have these exact keys:
- "slot": one of ${isExplainer ? `"premise" | "mechanism" | "scale" | "consequence" | "open-question"` : `"setup" | "mechanism" | "climax" | "aftermath" | "contested"`}
- "factRefs": array of the fact numbers this card rests on (at least 2)
- "angle": punchy topic name, max 8 words
- "description": ONE SHORT SENTENCE PER REFERENCED FACT (so a two-fact card is two sentences), each drawn from a single fact and standing alone — never fuse the facts into one sentence or assert a link between them
- "audience": who would specifically click on this
- "titleSuggestion": full title${chosenTitle ? ` — MUST follow the TITLE LOCK formula above, only the variable changed. Do not change the title shape.` : " using the formula above"}. TITLE MUST BE COHERENT ENGLISH FIRST, formula second: apply the formula's spirit but pick a verb that is ACCURATE and reads naturally; never jam a word in backwards if it produces nonsense.
- "swap": null`
      : `Output a JSON array of exactly 5 objects. Each object must have these exact keys:
- "angle": punchy topic name, max 8 words
- "description": one sentence describing what the video covers
- "audience": who would specifically click on this
- "titleSuggestion": full title${chosenTitle ? ` — MUST follow the TITLE LOCK formula above, only the variable changed for this angle. Do not change the title shape.` : " using the formula above"}. TITLE MUST BE COHERENT ENGLISH FIRST, formula second. Apply the formula's SPIRIT (the "How [subject] [verb] [target]" curiosity structure), but choose a verb and phrasing that are ACCURATE and read naturally. Never jam the source's key word in backwards if it produces nonsense: "How the FBI Infiltrated Its Own Informant" is broken because the FBI did not infiltrate its own informant. If the exact formula word does not fit, use a true verb that keeps the same click. A title a viewer cannot parse gets no clicks, so coherence and accuracy beat literal formula-matching every time.
- "swap": ${chosenTitle ? `null (not applicable here)` : `if this angle is a single-variable swap of the source title, the change written as "X → Y" (e.g. "Mom → Dad"); otherwise null`}`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: slotsMode ? 1300 : 800,
      system: "You output ONLY valid JSON arrays. No prose, no markdown, no explanation. Start your response with [ and end with ].",
      messages: [{
        role: "user",
        content: `${taskBlock}

SOURCE VIDEO (framework origin): "${(videoTitle || "Unknown").slice(0, 100)}"
HOOK TYPE: ${hookType}
HOOK PSYCHOLOGY: ${whyItWorks}
TITLE FORMULA: ${titleFormula?.formula || ""}
FRAMEWORK SUMMARY: ${framework}
${learning ? `\n${learning}\n` : ""}

${PROVENANCE_RULE}

The source video grounds the ORIGINAL topic only. It is not evidence for the new topic you are angling toward, so never carry its documents, figures, or named sources onto a different subject, and never invent new ones.
${slotsMode ? `\nTHIS VIDEO IS ABOUT A REAL, RESOLVED CASE. Build every card only from these numbered SOURCED FACTS:\n${numberedFacts}${grounding?.caseName ? `\n(Case: ${grounding.caseName}${grounding.when ? `, ${grounding.when}` : ""})` : ""}` : groundingBlock ? `\nTHIS VIDEO IS ABOUT A REAL, RESOLVED CASE. Every angle must be about it and use only its facts:\n${groundingBlock}` : ""}

${outputSpec}

TITLE RULES — TWO ANCHORS FIRST, THEN UNDER 50 CHARACTERS (every titleSuggestion):
The model title is "How an FBI Agent Infiltrated the KKK" (36 chars). It works because it carries TWO RECOGNIZABLE PROPER NOUNS — a trusted institution against a feared organization — plus a COMPLETED action verb. Reproduce that shape:
1. NAME THE INSTITUTION by its real acronym or name (ATF, FBI, DEA, the agency in the facts). Required.
2. NAME THE NOTORIOUS GROUP specifically (the Mongols, the Hells Angels, the KKK). Required — never a category like "the Deadliest Biker Gang in America", which is 35 wasted characters and recognizable to nobody.
3. THE VERB MUST NAME A COMPLETED ACTION WITH A SPECIFIC OBJECT. The test is not which verb you pick — it is whether the verb hedges an outcome or names one, and whether what it acts on is concrete.
   - BANNED: hedges that mean nothing happened ("almost exposed him", "nearly caught"), and abstract objects with no noun ("cost him everything", "changed everything").
   - GOOD: infiltrated the Mongols, became a full-patch Mongol, brought down the Mongols, survived the Mongols' loyalty test, escaped the clubhouse. "Survived" and "endured" are STRONG when what was survived is NAMED — survival is often the real story and the strongest promise a title can make. Never suppress them.
4. DO NOT SPOIL THE PEAK. A title that states the single biggest moment spends it before the video starts ("The Mongols Put a Gun to an ATF Agent's Head"). Name the CATEGORY of the ordeal ("the loyalty test"), not its most dramatic image — that image belongs on the thumbnail, where showing it teases and stating it spoils.
5. THEN trim to UNDER 50 CHARACTERS. Front-load the distinctive words; truncation eats the end.
A title containing NO proper noun is a FAILURE — "How a Gun to His Head Almost Exposed Him" could be any video on YouTube and will not be clicked. "How an ATF Agent Infiltrated the Mongols" (41) and "How an ATF Agent Survived the Mongols' Loyalty Test" (49) are both correct.
- Do NOT append a stock suffix ("Inside the Deadliest ... in America", "in America").
- No two titles may share the same ending phrase — each must read as a different video.

[`,
      }, {
        role: "assistant",
        content: "[",
      }],
    });

    // The assistant reply is prefilled with "[", and slot mode can trail prose or a
    // second array after the JSON, which crashed a naive JSON.parse ("Unexpected
    // non-whitespace character after JSON"). Bracket-match the first complete array and
    // ignore anything after it.
    const raw = "[" + (msg.content[0].type === "text" ? msg.content[0].text : "");
    const parsed = extractJSON(raw, "array") as any;
    // Hard guarantee: strip a carried-over source expert from each angle title, then
    // tighten toward the 50-char cap in code (the prompt asks, code enforces). When a
    // title is over-long, drop the stock category suffix that eats the truncated end.
    const sourceExpert = extractTrailingExpert(videoTitle);
    const tightenTitle = (t: string): string => {
      let s = (t || "").trim();
      if (s.length <= 50) return s;
      s = s.replace(/\s+(?:inside|within|deep inside)\s+(?:the\s+)?[^,]+?(?:\s+in\s+(?:america|the\s+(?:us|u\.s\.|world|country)))?\s*$/i, "");
      s = s.replace(/\s+in\s+(?:america|the\s+(?:us|u\.s\.|world|country))\s*$/i, "");
      s = s.replace(/\s+(?:the\s+)?(?:deadliest|most\s+(?:violent|notorious|dangerous))\s+[^,]+$/i, "");
      return s.replace(/\s{2,}/g, " ").replace(/[\s,]+$/, "").trim();
    };
    let angles = Array.isArray(parsed)
      ? parsed.map((a: any) => ({
          ...a,
          // When a title was chosen upstream it is FINAL. Overwrite whatever the model
          // returned rather than trusting the prompt — this is the guarantee that an
          // angle card can never replace the user's decision.
          titleSuggestion: chosenTitle || tightenTitle(stripCarriedExpert(a?.titleSuggestion || "", sourceExpert)),
        }))
      : parsed;

    // Slot mode: enforce the two-fact minimum in code (belt and suspenders over the
    // prompt). A card whose factRefs don't point at ≥2 real facts doesn't render,
    // and duplicate slots collapse to the first, so what the user sees is only the
    // well-grounded, non-overlapping cards.
    if (slotsMode && Array.isArray(angles)) {
      const seen = new Set<string>();
      const usedRefSets: number[][] = [];
      angles = angles.filter((a: any) => {
        const refs = Array.isArray(a?.factRefs) ? a.factRefs.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n >= 1 && n <= deepFacts.length) : [];
        a.factRefs = Array.from(new Set(refs));
        const slot = String(a?.slot || "").toLowerCase();
        if (a.factRefs.length < 2) return false;
        // A contested / open-question card with nothing flagged behind it is
        // manufactured controversy (or manufactured doubt, on the science side).
        if ((slot === "contested" || slot === "open-question") && !hasConflict) return false;
        if (slot && seen.has(slot)) return false;
        // Two cards resting on the SAME facts are the same video with two badges. Slot
        // uniqueness alone did not catch this (an "aftermath" and a "climax" card both
        // built on the one Tiny fact), so also dedupe on fact overlap.
        const overlapsExisting = usedRefSets.some((prev) => {
          const shared = a.factRefs.filter((r: number) => prev.includes(r)).length;
          return shared >= Math.min(prev.length, a.factRefs.length);
        });
        if (overlapsExisting) return false;
        usedRefSets.push(a.factRefs);
        if (slot) seen.add(slot);
        return true;
      });
      // FUSED-FACT REPAIR. A two-fact card whose description is one long sentence has
      // almost certainly invented a connective link between the facts to fuse them. We
      // can't safely rewrite the prose in code, but we CAN replace the fabricated summary
      // with the plain facts themselves, which is what the card should have shown anyway.
      for (const a of angles) {
        const desc = String(a?.description || "");
        const sentences = desc.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim().length > 4);
        const fusedLink = /\b(?:through|because of|in order to|so as to|rather than|as a result|which means|a response that|a technique that|designed to)\b/i.test(desc);
        if ((a?.factRefs?.length || 0) >= 2 && sentences.length < 2 && fusedLink) {
          a.description = a.factRefs
            .map((r: number) => String(deepFacts[r - 1] || "").replace(/\s*\(source:[^)]*\)\s*$/i, "").trim())
            .filter(Boolean)
            .join(" ");
        }
      }
    }
    return NextResponse.json({ angles });
  } catch (e: any) {
    console.error("[suggest-viral-angles]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to generate angles" }, { status: 500 });
  }
}
