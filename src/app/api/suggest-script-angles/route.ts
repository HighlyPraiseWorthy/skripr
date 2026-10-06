import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { getNicheHookExamplesBlock, getNicheTitleFormulasBlock, getNicheOutlierPatterns, getHookFamilyRanking } from "@/lib/viral-frameworks";
import { getPickedAnglesBlock } from "@/lib/angle-picks";
import { EXPERT_ATTRIBUTION_RULE, PROVENANCE_RULE } from "@/lib/ai/claude";
import { buildGroundingBlock, sanitizeCaseLabel, type GroundingContext } from "@/lib/research";
import { vetAngles, groundingToSourceText } from "@/lib/ai/angle-vet";
import { normalizeNiche } from "@/lib/viral-frameworks";
import { detectNiche } from "@/lib/niche-detect";
import { stripEmDashes } from "@/lib/script-text";
import { hookCraftIssues } from "@/lib/script-compliance";
import { findStorySpines, repairAngles, selectAngles, type StorySpine } from "@/lib/ai/angle-spines";
import { replaceFamilyNames, tagFactSources, stripSourceTags, unsupportedGroupWords, unlinkedFigures, fixMostWantedWording, groundedInFacts } from "@/lib/script-compliance";

const client = new Anthropic({ timeout: 75_000, maxRetries: 1 }); // the route has 300s in total
export const maxDuration = 300; // spines + cards + vet + repair + re-vet (+ a second round); every AI call has a hard timeout

export async function POST(req: Request) {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { topic, niche: rawNiche, videoLength = "medium", hookTypeFilter, viralMagnetWord, grounding, lockedTitle, seedAngle, excludeAngles } = await req.json();
    if (!topic) return NextResponse.json({ error: "Topic is required" }, { status: 400 });

    // The case label/summary were recalled from memory; check them against the sourced facts here too,
    // so a stale brief can't feed an unsupported place (e.g. "captured in Morocco") into the cards.
    if (grounding?.caseName && Array.isArray(grounding.facts) && grounding.facts.length) {
      const label = sanitizeCaseLabel(String(grounding.caseName), String(grounding.caseSummary || ""), grounding.facts.map((f: any) => String(f)));
      if (label.removed.length) console.log(`[angles] case label corrected: removed ${JSON.stringify(label.removed)}`);
      grounding.caseName = label.name; grounding.caseSummary = label.summary;
    }
    if (grounding && Array.isArray(grounding.facts)) grounding.facts = grounding.facts.map((f: any) => tagFactSources(String(f), String(topic)));
    const groundingBlock = buildGroundingBlock(grounding as GroundingContext | undefined);

    // NICHE: a typed-without-niche topic used to reach every niche-keyed lookup as blank, so the hook
    // ranking fell back to ALL niches (seen live: a fugitive case got "Top pick: Curiosity Gap" instead
    // of true crime's Story). Resolve it here the same way the generator does, using the topic PLUS
    // the research's case summary (the strongest signal once research has run), and hand it back so
    // the brief and the generator use the same niche.
    let niche: string = rawNiche || "";
    if (!normalizeNiche(niche)) {
      const g: any = grounding || {};
      // The first research facts too: a name-only topic with a bare case label gave the classifier
      // almost nothing (seen live: "Arthur Gerald Jones", a casino job -> "entertainment").
      const factLines = Array.isArray(g.facts) ? g.facts.slice(0, 8).map((f: any) => (typeof f === "string" ? f : f?.fact || "")).filter(Boolean) : [];
      const basis = [topic, g.caseName, g.caseSummary, ...factLines].filter(Boolean).join(". ");
      const detected = await detectNiche(basis).catch(() => null);
      if (detected) { niche = detected; console.log(`[angles] niche auto-detected: ${detected} (was "${rawNiche || ""}")`); }
    }

    // Self-improving layer: ground suggestions in proven hooks + title formulas
    // for the niche, and lean toward angles creators actually picked. All three
    // helpers are time-boxed and null-safe, so they never block or break.
    const [pickedAngles, hookExamples, titleFormulas, outlierPatterns, hookRanking] = await Promise.all([
      getPickedAnglesBlock(niche).catch(() => null),
      getNicheHookExamplesBlock(niche, 4).catch(() => null),
      getNicheTitleFormulasBlock(niche, 4).catch(() => null),
      // The proven story-engine + packaging SHAPES that actually broke out in this niche (banked from
      // every Outlier scan). This teaches the angle suggester the winning FRAMINGS, not just hooks/titles.
      getNicheOutlierPatterns(niche).catch(() => null),
      // Which of the 8 hook types proven winners in this niche open with most (share of breakouts).
      getHookFamilyRanking(niche).catch(() => null),
    ]);
    const topHook = hookRanking?.ranks?.[0] || null;
    const learning = [
      !hookTypeFilter && hookRanking?.ranks?.length ? `HOOK TYPES THAT WIN ${hookRanking.scope === "niche" ? "IN THIS NICHE" : "ACROSS SCANNED CHANNELS"} (share of proven breakout videos that open this way): ${hookRanking.ranks.slice(0, 4).map((r) => `${r.type} ${Math.round(r.share * 100)}%`).join(", ")}. Make the angle using the top type ("${topHook!.type}") one of your strongest, but this is evidence, not a mandate: still give 5 genuinely different hook types.` : "",
      outlierPatterns ? `PROVEN OUTLIER PATTERNS IN THIS NICHE — the story-engine + packaging SHAPES that actually broke out on real channels. Bias the angle FRAMING toward these winning shapes (imitate the STRUCTURE, never the subject or wording):\n${outlierPatterns}` : "",
      pickedAngles ? `ANGLES CREATORS PICKED IN THIS NICHE — strongest signal, lean toward this kind of framing (never copy wording):\n${pickedAngles}` : "",
      hookExamples ? `PROVEN HOOKS IN THIS NICHE — model "hookPremise" on these mechanics:\n${hookExamples}` : "",
      titleFormulas ? `PROVEN TITLES IN THIS NICHE — model "titleSuggestion" on these formulas:\n${titleFormulas}` : "",
    ].filter(Boolean).join("\n\n");

    // STORY SPINES: the complete arcs the research can carry, found BEFORE any card is written, so each
    // card tells a strong, fact-backed story and the hook type is only how it's told.
    const factList: string[] = Array.isArray((grounding as any)?.facts) ? (grounding as any).facts.map((f: any) => (typeof f === "string" ? f : f?.fact || "")).filter(Boolean) : [];
    const spines: StorySpine[] = factList.length >= 8 ? await findStorySpines(factList, topic, String((grounding as any)?.kind || "event")) : [];
    if (spines.length) console.log(`[angles] spines: ${spines.map((sp) => `${sp.name} (${sp.depth})`).join(" | ")}`);
    const spinesBlock = spines.length
      ? `STORY SPINES (found in the research; every card MUST tell ONE of these, and put its number in "spine"):\n${spines.map((sp, k) => `[${k}] ${sp.name}: ${sp.arc} Opens on: ${sp.opening}. Pays off: ${sp.payoff}. (carried by ${sp.depth} facts)${sp.question ? `\n    Viewer question: ${sp.question}` : ""}${sp.hookFact ? `\n    Hook fact: ${sp.hookFact}` : ""}${sp.mechanism ? `\n    Hook mechanism: ${sp.mechanism}` : ""}${sp.premise ? `\n    Premise (may be said up front): ${sp.premise}` : ""}${sp.hookFactsText?.length ? `\n    HOOK FACTS (assemble this spine's hook from these):\n${sp.hookFactsText.map((f) => `      - ${f}`).join("\n")}` : ""}${sp.revealText ? `\n    PAYOFF REVEAL (the video's answer: NEVER in the title or hook): ${sp.revealText}` : sp.withhold ? `\n    Keep for the payoff (never in the title or hook): ${sp.withhold}` : ""}`).join("\n")}\n\nTHE HOOK TYPE IS HOW A SPINE IS TOLD, NEVER A PREMISE OF ITS OWN. Do not bend a fact to fit a hook type (no "faked his death" when a court declared him dead, no invented controversy, no myth the facts don't contain). If a hook type has no honest version for these facts, SKIP it: six strong cards beat eight with a forced one. SPREAD the cards across the spines: at most 2 cards per spine, so the creator gets genuinely different stories, not one story told five ways. Prefer the spines carried by more facts.\n`
      : "";
    const msg = await client.messages.create({
      // Sonnet, not Haiku: the cards decide the whole video, and the smaller model bent facts to fit
      // hook types (seen live, repeatedly).
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: `You output ONLY valid JSON arrays. No prose, no markdown. Start with [ and end with ].
Each object must have EXACTLY these keys: "hookType", "hookPremise", "titleSuggestion", "payoffMoment", "middleBeats", "audienceEmotion", "spine", "viewerQuestion", "hookFact".`,
      messages: [{
        role: "user",
        content: `A YouTube creator wants to make a video about: "${topic.slice(0, 120)}"
Niche: ${niche || "general"}
Length: ${videoLength}
${learning ? `\n${learning}\n` : ""}${spinesBlock ? `\n${spinesBlock}` : ""}${Array.isArray(excludeAngles) && excludeAngles.length ? `\nALREADY SHOWN TO THE CREATOR (they asked for DIFFERENT options): do not reuse these opening moments, scenes, or titles. Open on other documented moments and take other ways in:\n${excludeAngles.slice(0, 15).map((x: any) => `- ${String(x).slice(0, 220)}`).join("\n")}\n` : ""}
CARD RULES (every card):
- ATTRIBUTION: Facts tagged [his own account] come only from the subject himself (his memoir, interviews, letters), and [family account] only from his family: when you use one, attribute it in the narration ("he later wrote", "by his own account", "his son said"), never state it as established fact, and never say the tag itself.
- MINORS: never name anyone who was a minor at the time of the events; say "his son", "his daughter". Adults on the record (a spouse, a grown child, a victim) may be named. Never open a hook on a side person: open on the main event or the subject.
- FIRST SENTENCE: it must name or show the main event or the main subject (the faked death, the fraud, the arrest, the disappearance), never a side character.
- TITLE: one idea, at most 55 characters, a single sentence. Name the main event in plain words a searcher would type (faked death, Ponzi scheme, bank fraud, manhunt), plus the niche's keyword. Every title uses different key words: if one title says "Vanished", no other title does.
- "payoffMoment" and "middleBeats": where this video's payoff lands, and the 2 or 3 moments that carry its middle. Each one is a specific moment or finding FROM THE RESEARCH, restated in at most 15 words ("the New Year's Eve traffic stop in Glynn County", "the Goldman account falling from $36.9 million to $480,000"). Never a promise of material the research doesn't have (quotes, interviews, testimony, footage, "why the myth survived", "how courts handle it"), never an explanation the research doesn't give.
${viralMagnetWord ? `\nVIRAL MAGNET WORD: Every "titleSuggestion" MUST naturally include the word "${viralMagnetWord}" — weave it where it creates maximum curiosity or urgency, never forced. Work it into the "hookPremise" too when it fits naturally.\n` : ""}
${hookTypeFilter
  ? `Generate 7 DIFFERENT ANGLES for this topic, ALL using the "${hookTypeFilter}" hook type. Each should take a different specific approach within that hook type.`
  : `Generate up to 8 hook angles, each a DIFFERENT psychological hook from this list (skip any with no honest version for these facts):
- CONTROVERSY: Challenge a sacred belief
- CURIOSITY GAP: Create an itch they must scratch
- REFRAME: Recast something the viewer already knows so it means the opposite
- MYTH-BUST: Destroy the most common wrong assumption
- STORY: Open with a specific moment that makes stakes visceral
- PATTERN INTERRUPT: Violate expectations immediately
- FEAR/STAKES: Make the cost of NOT knowing feel immediate
- OVERLOOKED MECHANISM: The unglamorous way this actually works, which nobody bothers to explain`}

${seedAngle ? `\nPROVEN STRUCTURE TO FOLLOW (this idea came from a real outlier): bias the STORY STRUCTURE and packaging toward this proven shape, imitating the STRUCTURE only, never its subject or wording. But you MUST still make the 5 angles genuinely DIFFERENT hook types as listed above (controversy, story, reframe, myth-bust, stakes, pattern interrupt, overlooked mechanism, curiosity gap) — do NOT collapse them all into the outlier's own hook style. The structure is borrowed; the best hook TYPE for this specific story is open, so give real variety and let the strongest one win: ${String(seedAngle).slice(0, 400)}\n` : ""}
${lockedTitle ? `\nTITLE LOCK: the creator has chosen their title and it is FIXED. Set "titleSuggestion" to EXACTLY this string for every angle, unchanged, do not invent alternatives: "${String(lockedTitle).slice(0,150)}". Vary only the "hookPremise" across the 5 angles. The hooks must all work UNDER this one title.\n` : ""}
PRIVATE PEOPLE AND CRIME (strict): never suggest that a named private person (a neighbor, a seller, a spouse, a coworker) helped, knew, or took part, unless a fact says so. "How many people helped him?" right after naming the man who sold him a house points at that man.

PRESENT TENSE (strict): never state a status as true today ("is a registered nonprofit", "still operates", "remains open") unless a fact says it is current; use the past tense with the year the facts give.

NUMBERS IN ANGLES (strict): do not put a specific number, salary, wage, dollar amount, date, or count in a "hookPremise" or "titleSuggestion" unless that exact figure is in the facts above. If the facts give none, make the point without one.

NO INVENTED MINDS, NO FALSE RECENCY, NO LOOSE PARAPHRASE: never claim what a real person thought or felt ("seemed to have genuinely moved on") unless the facts say it; never call a past event recent ("just ended", "recently") when the facts date it years ago; never claim what investigators or an agency knew, intended, or failed to do ("had no idea where he was", "nobody pursued him", "closed his file", "in a matter of months") unless the facts say it, and never relocate a fact when paraphrasing (a son in one state and a friend in another is NOT "family connections in Florida"). Never put words in quotation marks unless they are copied exactly from the facts.

HOOK CRAFT (this is what separates a 5/10 card from an 8/10 one):
- QUESTION FIRST: before writing, decide the one question this hook makes the viewer NEED answered ("viewerQuestion"). The hook opens that question; the video answers it. If you can't name a specific question, the hook is a summary, not a hook.
- ASSEMBLE, DON'T INVENT: when the spine lists HOOK FACTS, build the hook from those facts and its premise, in that spine's mechanism. You may name the subject and set the time and place from them; add no other event, claim, or judgment. Write the TITLE last: it names the premise or the event, never the PAYOFF REVEAL.
- NEVER ANSWER IT IN THE TITLE OR HOOK. Name the event and the stakes, never how it ends, how they were caught, or the explanation. "Caught at a New Year's Eve Traffic Stop" gives the ending away; "He Faked His Death in 1979. In 2011 He Was Still Alive." withholds it. "The Hijacker Who Won His Case in Court" hands over the twist. For OVERLOOKED MECHANISM and MYTH-BUST: show the result or the contradiction and tease that there is a method; never explain the method in the hook.
- CARRY THE HOOK FACT: put the single most surprising concrete detail ("hookFact", the spine's hook fact when one is given) in the hook in plain words: the hard number, the contrast, the object. "The account fell from $36.9 million to $480,000" beats "secretly destroying their savings".
- TENSION: the strongest hooks put two true things side by side that shouldn't both be true (gave away his salary / drained his clients' savings).
- NO VAGUE STAND-INS: never "found a way to", "bigger than most people realize", "what he did next", "everything changed", "something shocking", "the truth is darker". Say the specific thing.
- NO STOCK OPENERS: never open with "For decades", "Imagine", "This is the story of", "Have you ever", "Meet".
- THE SURPRISE COMES FROM THE RESEARCH ONLY: never reach outside it for a bigger-sounding hook, even with something true (a famous comparison, a prize, a historical first, "the last person to...", twins, "the only mistake"). Never upgrade a fact to make it sharper ("a distribution hub" stays a hub, not "the primary hub"; money "raised" is not money "stolen"; a cumulative total is not an opening balance). A smaller true hook beats a bigger invented one.

For each angle return EXACTLY:
- "hookType": hook type (ALL CAPS)
- "hookPremise": opening hook sentence (1-2 sentences, punchy, specific)
- "titleSuggestion": full YouTube title (one idea, at most 55 characters)
- "payoffMoment": the documented moment the ending lands on (at most 15 words, from the research). When the card's spine gives a PAYOFF REVEAL, restate THAT fact: it is the answer the video holds back (for an explainer, the explanation, never just the latest number)
- "middleBeats": an array of 2 or 3 documented moments that carry the middle (each at most 15 words, from the research): moments of the case itself (the crime, the escape, the hiding, the hunt, the turn), never side details about a private person's money, debts, or personal life
- "audienceEmotion": primary emotion (curiosity / fear / anger / excitement / surprise)
- "spine": the number of the STORY SPINE this card tells (or null if no spines were given)
- "viewerQuestion": the one question the hook makes the viewer need answered (at most 20 words), which the title and hook do NOT answer. Aim it at the case's real mystery (how he hid, who helped, how he was found, why it happened), never "will he face justice" or the verdict or sentence unless that outcome is the genuine surprise
- "hookFact": the concrete detail from the research the hook is built on (at most 25 words)

${EXPERT_ATTRIBUTION_RULE}

${PROVENANCE_RULE}

${groundingBlock || `GROUNDING (critical): this topic is a string the creator typed. You have NO source document and NO confirmation that the event, case, or person it describes is real. So:
- Do NOT invent a documented incident, a date, a name, a dollar figure, an agency, a court case, or a leaked/declassified document to make an angle sound concrete.
- Do NOT write a "hookPremise" whose credibility depends on a source you cannot show. An angle that only works if a fake document exists is a bad angle, not a strong one.
- Build each angle on the mechanism, the incentive, the stakes, or the question, all of which are honest with no source. A sharp question beats a fabricated revelation.
- If the topic reads like a specific real event you cannot verify, angle toward the verifiable system around it instead of asserting the event happened.`}

Output ONLY the JSON array of cards.`,
      }],
    });

    // No assistant prefill: Sonnet rejects it (400). Take the array from the reply itself.
    const raw = msg.content.find((c) => c.type === "text")?.type === "text" ? (msg.content.find((c) => c.type === "text") as any).text as string : "";
    // Salvage a cut-off reply: keep every complete card instead of failing the whole page.
    const fenced = raw.replace(/```json|```/g, "").trim();
    const cleaned = fenced.slice(Math.max(0, fenced.indexOf("[")));
    let angles: any[];
    try { angles = JSON.parse(cleaned); }
    catch {
      const lastObj = cleaned.lastIndexOf("}");
      angles = lastObj > 0 ? JSON.parse(cleaned.slice(0, lastObj + 1) + "]") : [];
      console.warn(`[suggest-script-angles] reply was cut off; salvaged ${angles.length} complete card(s)`);
      if (!angles.length) throw new Error("Angle generation was cut off. Please try again.");
    }
        const lockedOut = lockedTitle
      ? angles.map((a: any) => ({ ...a, titleSuggestion: String(lockedTitle).slice(0, 150) }))
      : angles;
    // Each card carries its spine's fact depth, so the creator can see what a full video can stand on.
    const sized = lockedOut.map((a: any) => {
      const sp = Number.isInteger(Number(a?.spine)) ? spines[Number(a.spine)] : undefined;
      return { ...a, factCount: sp ? sp.depth : undefined, spineName: sp ? sp.name : undefined, spineHookFact: sp?.hookFact, reveal: sp?.revealText, hookFactsText: sp?.hookFactsText, mechanism: sp?.mechanism };
    });
    // GATE, don't just warn: vet every card, repair the flagged ones against the research, re-vet the
    // repairs, and show only clean cards (a flagged card is a trap for a creator who doesn't know the case).
    const sourceText = groundingToSourceText(grounding);
    const topicKind = String((grounding as any)?.kind || "event");
    // Family members by relationship, never by name (deterministic; seen live: son and daughter named
    // in every batch).
    // The payoff line is ASSEMBLED from documented moments, never free text.
    const composePayoff = (c: any) => {
      const pm = String(c.payoffMoment || "").trim().replace(/[.]+$/, "");
      const mb = (Array.isArray(c.middleBeats) ? c.middleBeats : []).map((b: any) => String(b || "").trim().replace(/[.]+$/, "")).filter(Boolean).slice(0, 3);
      if (!pm) return;
      const list = mb.length > 1 ? `${mb.slice(0, -1).join(", ")} and ${mb[mb.length - 1]}` : mb[0] || "";
      // Lower-case only a leading common word ("The traffic stop"), never a name or acronym (seen: "u.S.", "nRN", "wendy's").
      const lc = (t: string) => /^(?:The|A|An|His|Her|Their|Its|This|That|One|Two|Three|After|When|Before)\b/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
      c.whyItWorks = `The payoff lands on ${lc(pm)}${list ? `; the middle is carried by ${lc(list)}` : ""}.`;
    };
    for (const c of sized) composePayoff(c);
    // The card's hook fact steers repairs, so it has to be in the research: otherwise fall back to the
    // spine's (already grounded) one, or none. Without research there is nothing to check it against.
    for (const c of sized) {
      const hf = String(c.hookFact || "").trim();
      c.hookFact = sourceText.trim() && hf && groundedInFacts(hf, sourceText) ? hf : (sourceText.trim() ? c.spineHookFact : undefined);
      delete c.spineHookFact;
    }
    for (const c of sized) {
      c.hookPremise = fixMostWantedWording(replaceFamilyNames(String(c.hookPremise || ""), sourceText, topic).text, sourceText).text;
      c.whyItWorks = fixMostWantedWording(String(c.whyItWorks || ""), sourceText).text;
      if (!lockedTitle) c.titleSuggestion = replaceFamilyNames(String(c.titleSuggestion || ""), sourceText, topic).text;
    }
    // Title checks code can make: length, one sentence, and no key word reused across cards (seen
    // live: four of five titles said "Vanished").
    const TITLE_STOP = new Set(["about", "after", "their", "there", "these", "which", "while", "would", "years", "where", "before", "never", "every", "under", "still", "other"]);
    // Same tokenizing as the titles, so "Wendy’s" (curly apostrophe) in the topic exempts "wendy" (seen: a false
    // "title reuses wendy" flag on every Wendy's card).
    const subjectWords = new Set(String(topic).toLowerCase().match(/[a-z]{5,}/g) || []);
    const titleWords = (t: string) => [...new Set((String(t).toLowerCase().match(/[a-z]{5,}/g) || []).filter((w) => !TITLE_STOP.has(w) && !subjectWords.has(w)))];
    const wordUse = new Map<string, number[]>();
    sized.forEach((c: any, i: number) => titleWords(c.titleSuggestion).forEach((w) => { if (!wordUse.has(w)) wordUse.set(w, []); wordUse.get(w)!.push(i); }));
    // Code checks that must hold for the FINAL card, re-run after every repair (seen live: a repair put the
    // daughter back into the opening and only the AI re-check looked at it).
    const codeIssues = (c: any): string[] => {
      const out: string[] = [];
      const firstSentence = String(c.hookPremise || "").split(/(?<=[.!?])\s+/)[0] || "";
      if (/\b(?:[Hh]is|[Hh]er|[Tt]heir|[A-Z][a-z]+['’]s)\s+(?:[\w-]+\s+)?(?:daughter|son|wife|husband|children|kids|mother|father|family)\b/.test(firstSentence)) out.push("the hook opens on a private family member: open on the main event or the subject instead");
      for (const u of unlinkedFigures(String(c.hookPremise || ""), sourceText)) out.push(`joins ${u.figures.slice(0, 2).join(" and ")} as if one figure${u.figures[2] ? ` ${u.figures[2]}` : ""}`);
      for (const g of unsupportedGroupWords(`${c.hookPremise} ${c.whyItWorks || ""} ${lockedTitle ? "" : c.titleSuggestion}`, sourceText)) out.push(`uses "${g}"`);
      if (!lockedTitle && String(c.titleSuggestion || "").length > 70) out.push(`title is ${String(c.titleSuggestion).length} characters`);
      // Every payoff piece must point at something the research has.
      for (const piece of [c.payoffMoment, ...(Array.isArray(c.middleBeats) ? c.middleBeats : [])].filter(Boolean)) if (!groundedInFacts(String(piece), sourceText)) out.push(`the payoff points at "${String(piece).slice(0, 80)}", which isn't a moment in your research: pick one that is`);
      // The payoff has to describe THIS hook (seen live: the hook was repaired to open on the disappearance,
      // the payoff still said "the daughter's memory creates an immediate emotional anchor").
      // Checker language leaking into what the creator reads (seen live: "the two figures are kept distinct...
      // matching the research's own sourcing", hooks opening a sentence with "Separately,").
      if (/\b(the research(?:['’]s)?|sourcing|kept distinct|the two figures)\b/i.test(`${c.hookPremise} ${c.whyItWorks || ""}`)) out.push("talks about the research or the edit instead of the story: rewrite it as narration");
      if (/(?:^|[.!?]\s+)Separately,/.test(String(c.hookPremise || ""))) out.push(`starts a sentence with "Separately,": say what each figure measured in natural words`);
      const FAM = /\b(daughter|son|wife|husband|children|kids|mother|father)\b/i;
      // Only where the payoff LANDS (seen: the wife named in a middle beat, where she belonged, flagged 2 good cards).
      const pm = String(c.payoffMoment || "").match(FAM);
      if (pm && !new RegExp(`\\b${pm[1]}`, "i").test(String(c.hookPremise || ""))) out.push(`the payoff talks about the ${pm[1].toLowerCase()}, but the hook doesn't: make the payoff describe this hook`);
      out.push(...hookCraftIssues(c, topic, { lockedTitle: !!lockedTitle }));
      // Explainers: the payoff lands on the spine's reveal (the explanation), in the writer's OWN words; the
      // reveal fact only checks it. (Pasting the raw fact in read flat: payoff score 4.6 -> 3.9. Seen before
      // that: explainer payoffs picked "sales fell 7.8%" instead of the why.)
      if (topicKind !== "event" && c.reveal && c.payoffMoment && !groundedInFacts(String(c.payoffMoment), String(c.reveal)))
        out.push(`the payoff should land on this angle's answer: restate "${String(c.reveal).slice(0, 160)}" in your own words, at most 15 words`);
      return out;
    };
    const titleIssues: string[][] = sized.map(() => []);
    if (!lockedTitle) sized.forEach((c: any, i: number) => {
      const t = String(c.titleSuggestion || "");
      if (t.length > 60) titleIssues[i].push(`title is ${t.length} characters: cut it to one idea under 55 characters`);
      if (/[.!?]\s+\S/.test(t)) titleIssues[i].push("title is two sentences: make it one");
      for (const [w, idx] of wordUse) if (idx.length >= 3 && idx.indexOf(i) >= 1) titleIssues[i].push(`title reuses "${w}", which other cards' titles already use: pick different words`);
    });
    // Two dollar figures joined as one when the research ties them differently (deterministic).
    sized.forEach((c: any, i: number) => {
      for (const u of unlinkedFigures(`${c.hookPremise}`, sourceText)) titleIssues[i].push(`joins ${u.figures.slice(0, 2).join(" and ")} as if one figure${u.figures[2] ? ` ${u.figures[2]}` : ""}: keep each number with what it measured`);
    });
    // Group words the research never uses (deterministic).
    sized.forEach((c: any, i: number) => {
      for (const g of unsupportedGroupWords(`${c.hookPremise} ${lockedTitle ? "" : c.titleSuggestion}`, sourceText)) titleIssues[i].push(`"${g}" isn't how your research describes them: use its own wording for who invested or was harmed (for example "clients, many from his church")`);
    });
    // A hook may not OPEN on a private person (seen live: "Lee Price's daughter woke up one morning..."
    // even after names were removed).
    sized.forEach((c: any, i: number) => {
      const firstSentence = String(c.hookPremise || "").split(/(?<=[.!?])\s+/)[0] || "";
      // Any wording ("his sleeping daughter" got past a fixed adjective list, seen live).
      if (/\b(?:[Hh]is|[Hh]er|[Tt]heir|[A-Z][a-z]+['’]s)\s+(?:[\w-]+\s+)?(?:daughter|son|wife|husband|children|kids|mother|father|family)\b/.test(firstSentence))
        titleIssues[i].push("the hook opens on a private family member: open on the main event or the subject instead, and keep the family out of the first sentence");
    });
    // The payoff text steers the script, so it's checked like the hook (seen live: an invented sentencing event).
    // "Viewer asks" is checked too (seen live: hook "about 30 years", question "35 years"; a question about how
    // she hid paid off on how she was caught).
    const vetOf = (list: any[]) => vetAngles(list.map((a: any) => `${a?.hookPremise || ""} ${a?.titleSuggestion || ""} ${a?.whyItWorks || ""}${a?.viewerQuestion ? ` VIEWER ASKS: ${a.viewerQuestion}` : ""}`.trim()), sourceText).catch(() => list.map(() => [] as string[]));
    let warnings: string[][] = (await vetOf(sized)).map((w, i) => [...new Set([...w, ...titleIssues[i], ...codeIssues(sized[i])])]);
    const flagged = warnings.map((w, i) => (w.length ? i : -1)).filter((i) => i >= 0);
    // What was found on each card, so a repaired card can show what was corrected (the creator can't
    // otherwise tell the checker ran: clean cards look the same as unchecked ones).
    const found: string[][] = warnings.map((w) => [...w]);
    const fixLog: ({ why: string[]; diffs: { field: string; was: string; now: string }[] } | undefined)[] = sized.map(() => undefined);
    // TIME BUDGET (maxDuration 300): a repair round + re-check takes ~60-90s, and skipping the SECOND round
    // left most cards flagged (benchmark: clean 73% -> 47%). So only skip when there's truly no room left.
    if (flagged.length && sourceText.trim() && elapsed() > 200_000) console.warn(`[angles] skipped repair: ${Math.round(elapsed() / 1000)}s used`);
    if (flagged.length && sourceText.trim() && elapsed() <= 200_000) {
      const before = sized.map((c: any) => ({ hookPremise: c.hookPremise, titleSuggestion: c.titleSuggestion, whyItWorks: c.whyItWorks }));
      const fixed = await repairAngles(sized, warnings, sourceText);
      const changed = flagged.filter((i) => fixed[i].hookPremise !== sized[i].hookPremise || fixed[i].titleSuggestion !== sized[i].titleSuggestion || (fixed[i].whyItWorks || "") !== (sized[i].whyItWorks || "") || JSON.stringify([fixed[i].payoffMoment, fixed[i].middleBeats, fixed[i].viewerQuestion ?? sized[i].viewerQuestion]) !== JSON.stringify([sized[i].payoffMoment, sized[i].middleBeats, sized[i].viewerQuestion]));
      if (changed.length) {
        const re = await vetOf(changed.map((i) => ({ ...sized[i], ...fixed[i], titleSuggestion: lockedTitle ? sized[i].titleSuggestion : fixed[i].titleSuggestion })));
        changed.forEach((i, k) => {
          sized[i] = { ...sized[i], hookPremise: replaceFamilyNames(fixed[i].hookPremise, sourceText, topic).text, titleSuggestion: lockedTitle ? sized[i].titleSuggestion : replaceFamilyNames(fixed[i].titleSuggestion, sourceText, topic).text, whyItWorks: fixed[i].whyItWorks || sized[i].whyItWorks, payoffMoment: fixed[i].payoffMoment ?? sized[i].payoffMoment, middleBeats: fixed[i].middleBeats ?? sized[i].middleBeats, viewerQuestion: fixed[i].viewerQuestion ?? sized[i].viewerQuestion };
          composePayoff(sized[i]);
          // What changed, for the "what was fixed" panel: before, after, and why.
          const diffs: { field: string; was: string; now: string }[] = [];
          if (before[i].titleSuggestion !== sized[i].titleSuggestion) diffs.push({ field: "Title", was: String(before[i].titleSuggestion), now: String(sized[i].titleSuggestion) });
          if (before[i].hookPremise !== sized[i].hookPremise) diffs.push({ field: "Hook", was: String(before[i].hookPremise), now: String(sized[i].hookPremise) });
          if ((before[i].whyItWorks || "") !== (sized[i].whyItWorks || "")) diffs.push({ field: "Payoff", was: String(before[i].whyItWorks || ""), now: String(sized[i].whyItWorks || "") });
          fixLog[i] = { why: [...(found[i] || [])], diffs };
          const t = String(sized[i].titleSuggestion || "");
          void t;
          warnings[i] = [...(re[k] || []), ...codeIssues(sized[i])];
        });
      }
      // A second repair round when too few cards came out clean (seen live: 3 of 8 after one round once the
      // payoff text was checked too), so the creator still gets a full set.
      // A THIRD round only when fewer than 3 cards are clean (the creator always gets a full, clean set; seen
      // live: Levine's 3 shown cards all carried warnings). Each round fits the 300s budget or is skipped.
      for (const round of [2, 3]) {
      const stillIdx = warnings.map((w, i) => (w.length ? i : -1)).filter((i) => i >= 0);
      const cleanNow = sized.length - stillIdx.length;
      if (!stillIdx.length || (round === 2 ? !(cleanNow < 4 && elapsed() <= 205_000) : !(cleanNow < 3 && elapsed() <= 215_000))) break;
      {
        const fixed2 = await repairAngles(sized, warnings, sourceText);
        const changed2 = stillIdx.filter((i) => fixed2[i].hookPremise !== sized[i].hookPremise || fixed2[i].titleSuggestion !== sized[i].titleSuggestion || (fixed2[i].whyItWorks || "") !== (sized[i].whyItWorks || "") || JSON.stringify([fixed2[i].payoffMoment, fixed2[i].middleBeats, fixed2[i].viewerQuestion ?? sized[i].viewerQuestion]) !== JSON.stringify([sized[i].payoffMoment, sized[i].middleBeats, sized[i].viewerQuestion]));
        if (changed2.length) {
          const re2 = await vetOf(changed2.map((i) => ({ ...sized[i], ...fixed2[i], titleSuggestion: lockedTitle ? sized[i].titleSuggestion : fixed2[i].titleSuggestion })));
          changed2.forEach((i, k) => {
            sized[i] = { ...sized[i], hookPremise: replaceFamilyNames(fixed2[i].hookPremise, sourceText, topic).text, titleSuggestion: lockedTitle ? sized[i].titleSuggestion : replaceFamilyNames(fixed2[i].titleSuggestion, sourceText, topic).text, whyItWorks: fixed2[i].whyItWorks || sized[i].whyItWorks, payoffMoment: fixed2[i].payoffMoment ?? sized[i].payoffMoment, middleBeats: fixed2[i].middleBeats ?? sized[i].middleBeats, viewerQuestion: fixed2[i].viewerQuestion ?? sized[i].viewerQuestion };
          composePayoff(sized[i]);
            warnings[i] = [...(re2[k] || []), ...codeIssues(sized[i])];
            const prev = fixLog[i] || { why: [...(found[i] || [])], diffs: [] };
            const add = (field: string, was: string, now: string) => { if (was !== now) prev.diffs = [...prev.diffs.filter((d) => d.field !== field), { field, was: prev.diffs.find((d) => d.field === field)?.was ?? was, now }]; };
            add("Title", String(before[i].titleSuggestion), String(sized[i].titleSuggestion));
            add("Hook", String(before[i].hookPremise), String(sized[i].hookPremise));
            add("Payoff", String(before[i].whyItWorks || ""), String(sized[i].whyItWorks || ""));
            fixLog[i] = prev;
          });
        }
      }
      }
      console.log(`[angles] candidates=${sized.length} flagged=${flagged.length} repaired=${changed.length} stillFlagged=${warnings.filter((w) => w.length).length}`);
    }
    // A "Viewer asks" line that still doesn't match after repair is hidden, never a reason to flag or drop
    // a good card (seen: unsolved cases, where the payoff can't answer "how did she vanish").
    sized.forEach((c: any, i: number) => {
      const isVQ = (w: string) => /^the "Viewer asks" question/.test(w);
      // A warning whose quoted words appear ONLY in the question is about the question (seen live: a hidden
      // question's "hide for nearly 20 years" stayed on the card as a warning about text no longer shown).
      const sq = (t: string) => String(t || "").toLowerCase().replace(/[‘’“”"']/g, "").replace(/\s+/g, " ");
      const shown = sq(`${c.hookPremise} ${c.titleSuggestion} ${c.whyItWorks || ""}`);
      const onlyInQ = (w: string) => { const q = w.match(/^"([^"]+?)(?:…)?"/); return !!q && !!c.viewerQuestion && sq(c.viewerQuestion).includes(sq(q[1])) && !shown.includes(sq(q[1])); };
      if ((warnings[i] || []).some((w) => isVQ(w) || onlyInQ(w))) { warnings[i] = warnings[i].filter((w) => !isVQ(w) && !onlyInQ(w)); c.viewerQuestion = undefined; }
      // Same for the explainer payoff steer: it's craft, not accuracy, so it gets one repair and never flags
      // an accurate card (seen: Wendy's 0 of 3 clean when repair couldn't match the reveal's wording).
      // STYLE NUDGES never flag a card: they get the repair rounds above, then drop if still unmet. Accuracy
      // warnings (the vet's, unsupported figures, research-talk leaks) are untouched. Seen: "For years," and a
      // payoff-mentions-the-wife nudge flagged 2 of 3 error-free cards.
      const STYLE = /^(?:the payoff should land on this angle's answer|"[^"]*" is a vague stand-in|the hook opens with a stock phrase|the hook leaves out its strongest fact|the payoff talks about the |the title gives away|the hook gives away|title reuses |title is \d+ characters|title is two sentences|starts a sentence with "Separately,"|the hook opens on a private family member)/;
      warnings[i] = (warnings[i] || []).filter((w) => !STYLE.test(w));
      // LAST RESORT, after every repair round: cut the hook sentence (or the middle beat) that still carries a
      // flagged phrase, so the creator sees a clean card and the script never inherits the error. The warning
      // is only removed when the cut really removed the phrase; anything left still steers the script.
      const sentences = (t: string) => String(t || "").split(/(?<=[.!?]["”’]?)\s+/).filter(Boolean);
      warnings[i] = (warnings[i] || []).filter((w) => {
        const m = w.match(/^"([^"]+?)(?:…)?"/) || w.match(/^Unverified figure: (.+)$/);
        if (!m) return true;
        const ph = sq(m[1]);
        const hs = sentences(c.hookPremise);
        const hit = hs.findIndex((x) => sq(x).includes(ph));
        // Never the FIRST sentence: it carries the setup, and the rest reads as a fragment without it (seen:
        // hooks starting "But by 2025..." and "What the numbers showed:...").
        if (hit >= 1 && hs.length >= 2) {
          const rest = hs.filter((_, k) => k !== hit).join(" ");
          if (rest.split(/\s+/).length >= 12) { c.hookPremise = rest; return false; }
        }
        const beats: string[] = Array.isArray(c.middleBeats) ? c.middleBeats : [];
        const bi = beats.findIndex((b) => sq(b).includes(ph));
        if (bi >= 0 && beats.length >= 2) { c.middleBeats = beats.filter((_, k) => k !== bi); composePayoff(c); return false; }
        return true;
      });
    });
    // HOUSE RULE: strip em dashes from every user-facing string on each angle (premise, title, the
    // "why it works" explanation, and each vetting warning) before it reaches the cards.
    const cleaned2 = sized.map((a: any, i: number) => ({
      ...a,
      checked: !!sourceText.trim(),
      corrections: !(warnings[i] || []).length ? (found[i] || []).map((w: string) => stripEmDashes(w)).slice(0, 4) : [],
      fixes: !(warnings[i] || []).length && fixLog[i] ? { why: fixLog[i]!.why.map((w: string) => stripEmDashes(w)).slice(0, 5), diffs: fixLog[i]!.diffs.map((d) => ({ ...d, was: stripSourceTags(stripEmDashes(d.was)), now: stripSourceTags(stripEmDashes(d.now)) })) } : undefined,
      hookPremise: stripSourceTags(stripEmDashes(a?.hookPremise)).trim(),
      titleSuggestion: stripSourceTags(stripEmDashes(a?.titleSuggestion)).trim(),
      whyItWorks: stripEmDashes(a?.whyItWorks),
      audienceEmotion: stripEmDashes(a?.audienceEmotion),
      viewerQuestion: a?.viewerQuestion ? stripSourceTags(stripEmDashes(String(a.viewerQuestion))).trim() : undefined,
      reveal: undefined, hookFactsText: undefined, // internal: steer the writer, the checks, and the repair only
      warnings: (warnings[i] || []).map((w: any) => stripEmDashes(w)),
    }));
    const withWarnings = selectAngles(cleaned2, { max: 5, allowRepeatTypes: !!hookTypeFilter, topHookType: topHook?.type || null });
    console.log(`[angles] shown=${withWarnings.length} clean=${withWarnings.filter((a: any) => !a.warnings.length).length} depths=${withWarnings.map((a: any) => a.factCount ?? "-").join(",")} secs=${Math.round(elapsed() / 1000)}`);
    // THIN RESEARCH: under ~12 facts there are no story arcs to choose between, so cards repeat one story
    // (seen live: four "AI cults" cards with the same payoff). The page tells the creator to add research.
    return NextResponse.json({ factCount: factList.length, thinResearch: factList.length < 12, angles: withWarnings, topic, niche, detectedNiche: niche !== (rawNiche || "") ? niche : null, hookTypeFilter: hookTypeFilter || null,
      hookRanking: hookRanking ? { scope: hookRanking.scope, ranks: hookRanking.ranks.slice(0, 4).map((r) => ({ type: r.type, label: r.label, share: r.share, n: r.n })) } : null });
  } catch (e: any) {
    console.error("[suggest-script-angles]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to generate angles" }, { status: 500 });
  }
}
