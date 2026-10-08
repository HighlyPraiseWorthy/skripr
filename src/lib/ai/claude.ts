import { Anthropic } from "@anthropic-ai/sdk";
import { fingerprintToBrief, readProhibitions, stripStandaloneTics, type VoiceFingerprint } from "@/lib/voice-metrics";
import { buildStorytellingBlock } from "@/lib/storytelling";
import { stripInsinuations, stripUnnamedPartyNaming, stripSpeculation, stripImpliedRevelation, dedupeAdjacentParagraphs, stripDuplicateHook, collapseRepeatedAnchors, stripSchemeDurationClaim, stripStaleFutureDates, stripSourceLeaks, stripFactMetaLeaks, stripUngroundedActs, stripRepeatedSentences, stripStutters, stripDividers, fixDanglingBackrefs, BACKREF_RE, unquoteUnsourced, fixQuoteWordCounts, superlativeMismatches, stripLeaningFragments, restoreSuperlativeQualifiers, balanceQuotes, fixOrphanedItSays, dedupeEndingDates, stripPipelineWords, misattributedPhrases, mergeOrphanFragments, correctDatesToFacts, stripUnitConflation, stripInventedInference, flagOverstatementRisk, splitSentences, stripLeakedLabels, stripFalseEquality, stripUnsourcedStat, researchedYearSpan, primarySubjectName, quoteBalanceKept, fixWeekdayDates, attributionMismatch, introducesUnsupportedName, ageYearMismatches, stripStoryMeta, expandNounContractions, eventYearMismatches, retoldFacts, introducesPipelineWords, figurePairsInSentence, foreverContradicted, replaceMinorNames, replaceFamilyNames, dropForeverAdverbs, fixMostWantedWording } from "@/lib/script-compliance";
import { buildVarietyBlock } from "@/lib/ai/phrase-variety";
import { validateTitle } from "@/lib/title-validate";
import { getNicheOutlierPatterns } from "@/lib/viral-frameworks";

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  }
  return _anthropic;
}

export interface ScriptGenerationInput {
  // The video's subject (the topic as typed), so family-name handling never treats the subject as
  // "his son" when a fact quotes his father.
  subjectName?: string;
  sourceTranscript: string;
  sourceTitle: string;
  sourceNiche: string;
  targetTopic: string;
  targetNiche: string;
  videoLength: "short" | "medium" | "long" | "ultraLong";
  targetMinutes?: number;
  tone: "educational" | "entertaining" | "storytelling" | "hype";
  ttsOptimized: boolean;
  viralMagnetWord?: string;
  angle?: string;
  nicheFrameworks?: string;
  // Real, proven hooks for this niche (view-ranked + creator-kept), built by the
  // hook-learning helpers. Injected into the HOOK RULES so the script's opening
  // line is modeled on hooks that actually work — and keeps improving as more
  // videos are analyzed and more hooks are kept.
  nicheHookExamples?: string;
  // Real proven titles + their formulas for this niche, built by
  // getNicheTitleFormulasBlock. Injected into the TITLE RULES so the title is
  // modeled on templates that actually earned views — improving as more videos
  // are analyzed.
  nicheTitleFormulas?: string;
  voiceProfile?: string;
  // Per-section plan measured from the source video's structure. When present, the body
  // is written section by section against it instead of in one drifting pass.
  sectionPlan?: SectionSpec[];
  // Hook inputs, so the hook can be written and validated as its own first step.
  hookArchetype?: string;
  hookWhyItWorks?: string;
  hookScript?: string;
  // The source video's extracted recipe, handed to each section writer for context.
  remixRecipe?: string;
  // Numeric voice targets measured from the creator's own transcripts, so the voice
  // pass aims at checkable numbers instead of adjectives.
  voiceFingerprint?: VoiceFingerprint;
  voiceName?: string;
  companionCta?: boolean;
  // Storytelling engine: narrative mode id + the resolved technique ids the
  // script should weave in. When omitted, the route auto-selects. Rendered into
  // the prompt via buildStorytellingBlock.
  storytellingMode?: string;
  storytellingTechniques?: string[];
  // Opt-in second CTA around the 60-70% retention dip. Off by default: it used
  // to be forced on, which produced two full subscribe+comment asks per script.
  softCta?: boolean;
  // Fully suppress the end CTA — no subscribe/like/comment/related-video ask at all.
  // The script ends on its closing narrative line. Default false (keeps the one end CTA).
  noCta?: boolean;
  // Result of the pre-generation source check (src/lib/research.ts). "partial" or
  // "unverified" means the premise is not documented, so the script is barred
  // from inventing specifics to make it feel concrete.
  sourceVerdict?: "documented" | "partial" | "unverified";
  // What KIND of topic this is (src/lib/research.ts). The no-invented-specifics
  // gate applies to unresolved EVENTS only: an explainer or a thought experiment
  // has no incident to confirm, and gagging its specifics would gut it.
  topicKind?: "event" | "explainer" | "hypothetical" | "claim";
  // Creator-provided research / source material (pasted articles, notes, or
  // auto-sourced facts). The script MAY state specific facts/numbers/studies
  // that appear here; anything not in it still obeys the anti-fabrication rule.
  sourceMaterial?: string;
  // Distinctive proper nouns from the SOURCE video's own story (names/places/objects). Used only
  // to CUT a leak: a remix copies structure, never content, so any of these that appears in the
  // generated script AND is not supported by the user's own facts is a copied-content leak (a
  // fabrication about this subject) and is silently removed in finalize.
  sourceEntities?: string[];
  // The title the user explicitly chose (e.g. by picking an angle card). When
  // set, it LOCKS the title — generation must use it as-is, not invent its own.
  selectedTitle?: string;
  // Epoch ms when the HTTP request began, so the finalize deadline is measured from ROUTE start (which
  // includes section-writing time in the one-shot path), not from finalize start. Optional; falls back
  // to the finalize start time when absent.
  routeStartedAt?: number;
  // Freeform creator instruction on HOW the story is told (casting, staging, tone,
  // where to aim the climax). Shapes craft only; it can never override accuracy.
  directorNote?: string;
}

export interface GeneratedScript {
  title: string;
  hook: string;
  sections: ScriptSection[];
  cta: string;
  fullScript: string;
  wordCount: number;
  estimatedDuration: number;
  ttsTimings: TTSTiming[];
}

export interface ScriptSection {
  id: string;
  type: "hook" | "intro" | "point" | "story" | "transition" | "cta" | "outro";
  title: string;
  content: string;
  duration: number;
  retentionBeat: boolean;
  notes: string;
}

export interface TTSTiming {
  afterLine: number;
  pauseMs: number;
  emphasis: "normal" | "strong" | "whisper";
}

// Shared across every surface that writes titles, hooks, or scripts. A source
// video's named expert belongs only to the source's topic — carrying it onto a
// different topic/niche/angle misattributes a real person (e.g. a maternal-bonding
// expert showing up on a true-crime title). Single source of truth so the rule
// can't drift between routes.
export const EXPERT_ATTRIBUTION_RULE = `NAMED-EXPERT / ATTRIBUTION RULE (critical): Never attach a real named person or expert to a title, hook, or claim unless that person is genuinely and verifiably tied to THIS specific topic. If a source or reference (e.g. a title formula like "... - [Named Expert]") carries an expert's name, that name belongs ONLY to the source's original topic. When the topic, niche, or angle changes you MUST NOT keep it — use a real expert who genuinely fits the new topic, or drop the named-expert reference entirely and end cleanly. NEVER reuse the source's expert on an unrelated topic, and NEVER invent a fake, generic, or unverifiable name.`;

// Shared by the script generator and the angle/hook suggesters. Invented
// PROVENANCE is worse than an invented fact: a wrong number can be corrected,
// but "a declassified document reveals" cannot be checked at all, and it is the
// thing that makes a fabricated premise read as researched. This rule exists
// because the old anti-fabrication rule banned fake numbers while explicitly
// prescribing vague attribution ("research suggests", "studies have shown") as
// the safe fallback, which is invented provenance by another name.
export const PROVENANCE_RULE = `SOURCING / PROVENANCE RULE (critical, no exceptions): You may NEVER invent the existence of a source, document, or authority. All of the following are BANNED unless the specific item appears in the provided source material:
- Documents: "a declassified document", "internal memos show", "leaked files reveal", "court records show", "a sealed indictment", "the report found".
- Officials and insiders: "officials admitted", "a former analyst revealed", "an engineer who worked on it said", "insiders confirm", "sources familiar with the matter".
- Vague research authority: "research suggests", "studies have shown", "experts estimate", "data indicates", "scientists agree". These are NOT a safe hedge. They assert that evidence exists, which is a factual claim about the world, and an unfalsifiable one.
- Any named person, agency, company, study, court case, or dated event presented as connected to this specific story when you cannot source it.
- A MOTIVE, INTENTION, OR CAUSE stated as established fact when the source material does not state it. This is the easiest one to miss: writing "he did it because he needed the money" or "she was arrested because they had been watching her for months" invents the inside of a real person's head, or a chain of events, and presents it as reporting. If the record does not give the reason, either say it does not, or write the beat without a reason. Speculation is allowed only when it is openly marked as speculation.
- DRAMATIZED SCENES, QUOTED DIALOGUE, AND NAMED PLACES not traceable to a supplied fact. Do NOT stage a specific scene, put words in a real person's mouth (even hedged as "something to the effect of" or "words like"), or name a location as the setting of an event unless the source material establishes that scene, that line, or that place. Reconstructing "a Hells Angel looked him in the eye and said we know who the rats are" when no such quote was sourced is fabrication wearing the costume of reporting — it reads as an account of something that happened, and it did not. You may write ABOUT a documented dynamic in the abstract ("informants inside the club lived under constant suspicion") without inventing a specific exchange to illustrate it.
- QUOTE THEN ANALYZE (encouraged — the strongest researched texture). When a supplied fact contains a real, sourced VERBATIM QUOTE — the subject's own words (an email, a post, a line they said), a plea or courtroom statement, indictment language, or a named official's statement — drop that quote word for word, attribute it to the speaker, and then interpret what it reveals. This "primary-source line, then analysis" move is what makes a script read as genuinely researched, and it honestly extends length. Use the quote EXACTLY as sourced; never invent a quote, never paraphrase into quotation marks, never attribute a quote to someone the source does not. If no sourced quote exists for a beat, write it in narration without quotation marks.
- ATTRIBUTE TO THE NAMED AUTHORITY WHEN THE FACT HAS ONE (encouraged — this is the rigor texture). When a supplied fact carries an authoritative source — the DOJ, the FBI, the court, or a named news outlet (shown in its "(source: …)" tag) — you SHOULD attribute the fact to that ACTOR in the narration: "the DOJ charged him with…", "The New York Times reported…", "the court ordered an $8 million forfeiture". A named actor stating a fact is exactly the attribution the rules below REQUIRE, and it signals real research to the viewer. This is DISTINCT from — and never licenses — the banned meta-talk about "the record", "the sources", or "what is documented": attribute to the ACTOR, never to the machinery. Do not attribute to an actor a fact whose source is not that actor.
- PRESERVE ATTRIBUTION AND CONTESTED CAUSE (critical). When a supplied fact is attributed or hedged — "Dobyns SAID his home was burned down", "prosecutors ALLEGED", "he CLAIMS" — the script must keep that framing. Do NOT promote "X said Y happened" into "Y happened", and never assign a cause the source does not establish. If a fact states an event but not who caused it (an arson whose perpetrator was investigated, disputed, or never proven), you may narrate the event but you may NOT name a culprit for narrative closure. Writing "the people he investigated tried to burn his family alive" or "the club made sure of it" when the source only says the house burned and the cause was contested is an accusation the record does not support. State what was reported and what was and was not established, and let the sequence speak.
- BLENDED RANK OR STATUS TERMS. Ranks are facts: "hang-around", "prospect", and "full-patch member" are distinct stages. Never merge them into an incoherent hybrid like "fully patched prospect". Use the exact status the source gives.
- INVENTED PROPER NOUNS, especially OPERATION CODENAMES. Never attach an official-sounding NAME that is not in the supplied facts: an operation codename ("Operation Ivan"), a program name, a task-force name, a case number, or a unit designation. The urge to give the operation a codename is strong and it produces fabrications that read as authoritative. If the facts do not name the operation, call it "the operation" or "the investigation" — never a name you supplied. Same for any place, agency division, or document title not in the facts.
- QUOTE LENGTH — COPYRIGHT SAFETY (hard cap). A sourced verbatim quote is a powerful cold open and payoff, but the richest source for these cases is a copyrighted memoir, and the creator publishes this script under their own name. So: any verbatim quote you use must be AT MOST one or two sentences, always attributed to the speaker (and ideally the source), and you may use NO MORE THAN TWO verbatim quotes in the entire script. Never reproduce a paragraph, a passage, or a run of copyrighted text — a couple of attributed sentences is fair use; a paragraph is a claim risk. If a quote in the facts is long, use only its sharpest sentence.
- CLAIMS BROADER THAN THE FACTS' SCOPE (critical, and the subtlest failure of all). Your conclusions must stay at the same SCOPE as your evidence. If every supplied fact is about a narrow mathematical property of networks, the script may explain that property brilliantly — but it may NOT conclude things about loneliness epidemics, how societies build institutions, what evolution designed the brain for, or what people have stopped investing in. Those are broader claims that need their own sources. This is the most dangerous shape of fabrication because the base is real: genuine citations at the bottom, an entire sociology extrapolated on top, all delivered in one confident voice so a viewer cannot tell where the evidence stopped. Test each claim: is there a supplied fact at THIS level of generality? If not, either cut it, or mark it openly as your own reasoning ("if that holds beyond the math, it would suggest…"). Never let an unsourced general conclusion inherit the authority of a sourced specific one.
- CORRELATION NARRATED AS CAUSATION. This is the science equivalent of naming a culprit for a contested cause, and it is the single most common error in social-science and health topics. If the material says a study found an ASSOCIATION, a LINK, a CORRELATION, or that heavy users "were more likely to" report something, you may NOT write that the thing CAUSES, DRIVES, CREATES, REWIRES, or LEADS TO the outcome. Keep the shape the evidence has: "people who use it heavily report more of X" is honest; "it makes you X" is a claim the study did not make. Where researchers actively disagree about effect sizes or whether an effect exists at all, SAY SO — never present one side of a live scientific disagreement as the settled finding, and never round a contested small effect up into a crisis.
- INVENTED LINKS BETWEEN TWO SEPARATE FACTS. Two facts sitting near each other are not evidence of a relationship. If one fact says likes activate reward-related brain regions, and another says persuasive-design research influenced how notifications were built, you may NOT chain them into "researchers told designers to target those brain regions" — nothing establishes that designers were aiming at the nucleus accumbens. Do not fuse two figures into an implied trade-off ("time on the platform rather than time spent socializing"). State each fact on its own. A connective word between two facts ("because", "in order to", "which is why", "a response that X targeted", "rather than") is a claim about their relationship, and it needs its own source, not just proximity.
- INVENTED SEQUENCING. Do not assert that one event happened BEFORE or AFTER another unless the facts establish that order. "A moment that came after the interrogation" is a fabrication when neither fact dates either event. Order is a factual claim exactly like a number is: if the record does not give you the sequence, narrate each event without claiming when it sat relative to the other.
- NEVER REFERENCE SOURCING IN THE SCRIPT'S VOICE (principle, not a phrase list). The viewer must never hear the machinery. Banned in the narrator's voice: any sentence whose SUBJECT is the evidence rather than the story — "that's the sourced version", "what the facts establish is", "what the record shows/establishes", "according to the facts we have", "what is documented is", "the sources don't say", "this part is well documented". Also banned: narrating your own refusal to elaborate ("how exactly that resolved isn't something that gets cleaner with more words"). When the record has a GAP, stay inside the story and write around it — "Whatever he said in that moment, it worked. The gun came down." is correct; stepping outside to discuss the evidence is not. (Attributing a claim to a real named person — "Queen said", "prosecutors alleged" — is REQUIRED and is not what this bans; what is banned is making sources, documentation, or the research itself the subject.)
- INVENTED CAUSAL EXPLANATIONS FOR A GAP IN THE NUMBERS. When two figures in the facts differ (e.g. 54 arrests but 53 convictions), do NOT manufacture a reason for the difference ("one defendant took the fall for a brother"). You noticed a gap; the record did not explain it, so neither do you. State both figures and move on. Inventing the connective reason is the same failure as inventing a source — a plausible story filling a hole the facts left open.
- COMPUTED DURATION COUNTS. Do NOT state a span you calculated by subtracting dates — "seven years", "for nearly a decade", "over eight years". State the DATE RANGE the facts actually give instead: "from 2017 to 2024". A computed count reads as filler, drifts by a year, and is not itself in the sources; the range is exact and sourced. If a beat needs the time span, name the two years and let the viewer feel the length; never assert the count.

NARROW ALLOWANCE — ESTABLISHED DOMAIN VOCABULARY (this is permitted, and it is good): you MAY use the standard, widely-documented vocabulary of the world the story takes place in, even when that word is not in the supplied facts, as long as you are only NAMING a general practice — not asserting a specific event. Outlaw motorcycle clubs call their meetings "church"; the mob has "made men" and "sit-downs"; espionage has "dead drops" and "handlers"; prisons have "shot callers". Using such a term to explain the world ("their membership meetings, which the club calls church") adds texture a viewer recognizes as authentic. What remains BANNED is using domain vocabulary to smuggle in a specific claim: you may say the club calls its meetings church, but you may NOT assert that a particular church meeting happened on a particular night, who was there, or what was decided, unless the facts say so. General practice: allowed. Specific event, dialogue, place, date, or number: still requires a fact.

WHAT TO DO WHEN YOU DO NOT HAVE A SOURCE: do not reach for a vaguer version of the claim. Either drop the claim, or state the reasoning openly as reasoning ("if that pattern held here, it would mean...", "there is no public accounting of this, which is itself the problem"). Owning a gap is credible. Papering over it with an unnamed authority is not, and a creator reads this on camera under their own name.`;

// EXPLAINER CRAFT — the science-explainer form (the Kurzgesagt shape). Applied to any
// non-event topic. A documentary runs on a story with people in it; an explainer runs on
// an idea, and its whole job is making one abstract mechanism feel enormous and personal
// without a protagonist. These are the specific moves that produce that feeling.
export const EXPLAINER_CRAFT = `EXPLAINER CRAFT — THIS IS A SCIENCE EXPLAINER, NOT A DOCUMENTARY.

PRECEDENCE (read first): these are DEFAULTS describing the form in general. If this script is a REMIX, the measured structure of the source video — its section order, its section weighting, its beat positions, its hook type — is the template and OUTRANKS everything below. Use these rules to fill in what the source analysis does not specify, never to override what it does. Never let a generic rule here flatten a shape that was measured from a real video.

1. THE SCALE LADDER IS THE SPINE. Do not explain the idea once at one size. Climb it: start at ONE unit the viewer can picture (one person, one cell, one house, one dollar), show the mechanism there, then step up an order of magnitude, then again, and again, until the number stops being imaginable and the viewer feels the vertigo. Each rung must restate the SAME mechanism at a bigger size, not introduce a new topic. The rungs must be built from real supplied figures — if you only have numbers for two rungs, build two rungs and stop, never invent a third.

2. MAKE EVERY BIG NUMBER PHYSICAL. A figure the viewer cannot picture does no work. Immediately convert it into something bodily: a distance walked, a stadium filled, a stack of objects, a length of time lived. Invent the COMPARISON freely (that is your craft), but never invent the NUMBER. If a supplied fact gives a comparison, prefer expressing the same idea a different way rather than reusing the source's image.

3. SECOND PERSON, ONE PERSON — UNLESS THE VOICE PROFILE FORBIDS IT. By default, address the viewer directly as "you", and enter the idea through a single ordinary person's experience before widening out. "You" is the entry point, not a character — do NOT give the viewer a fictional biography, name, or backstory. BUT: if a creator voice profile is supplied and its "never-does" says this creator never addresses the viewer as "you", that wins absolutely. Carry the same intimacy through close third person and concrete specifics instead. A documentary voice that never says "you" is not a flaw to correct.

4. NO PROTAGONIST, NO VILLAIN. There is no hero and no enemy. The subject is a system, a mechanism, or an incentive structure. Never assign intent to an institution, a technology, or a species ("the algorithm wants", "evolution decided", "the company set out to"). Systems have effects, not motives. If something bad happens, it happens because of how the mechanism works, and that is a more interesting and more honest explanation than a culprit.

5. CALM AND CURIOUS, NEVER OUTRAGED OR PREACHY. The tone is a fascinated friend explaining something remarkable, not an activist warning you. No moralising, no scolding, no "we need to wake up", no doom. Wonder outperforms alarm, and it is what makes a hard subject watchable.

6. BUILD ONE IDEA. An explainer is not a list of facts about a topic. Every section must depend on the one before it, so removing a section would break the next. If a section could be moved anywhere without damage, it is a list item and it should be cut or folded in.

7. PLAIN WORDS, SHORT SENTENCES. Define a technical term the first time you use it, in the same sentence, without breaking rhythm. Never use jargon to sound authoritative. If a sentence needs a comma to survive, consider two sentences.

8. THE TURN IS STRUCTURAL, NOT MORAL. When the script pivots from the upside to the cost, the pivot must be a mechanism, not a betrayal: the SAME property that produces the benefit produces the harm at a different scale. Never resolve into "so this thing is bad". The honest, more interesting landing is that a real benefit and a real cost come from one cause.

9. OWN THE UNCERTAINTY, DON'T HIDE IT. Say plainly when something is modelled rather than measured, contested rather than settled, or simply unknown. In an explainer, admitting the edge of knowledge INCREASES authority — it is the difference between a science channel and a content channel. "Nobody knows yet" is a legitimate and satisfying beat.

10. END ON PERSPECTIVE, NOT A CALL TO ARMS. Close by re-framing what the viewer now understands, ideally zooming back down to the one person you opened on. Not a demand, not a warning, not a list of tips. Humane and a little hopeful is the register — the feeling should be "I see this differently now", not "I should do something".`;

// Canonical hook-type taxonomy — single source of truth, used by the script
// generator, the hook generator, the niche→hook mapping, and (as labels) the
// framework capture. Consolidates the three older lists that had drifted apart.
export const HOOK_TYPES: { name: string; how: string; ex: string }[] = [
  { name: "Cold Open", how: "Drop straight into a specific moment or event, no setup.", ex: "On March 3rd, a fund manager closed his laptop and walked out. He never came back." },
  { name: "Question", how: "Surface a pain or curiosity as a direct question.", ex: "What if the advice you've followed about money is the reason you're broke?" },
  { name: "Data Drop", how: "Lead with a hyper-specific number that demands explanation.", ex: "The average person makes 35,000 decisions a day. 226 are about food alone." },
  { name: "Provocation", how: "Challenge a belief the viewer already holds.", ex: "You've been told index funds are safe. That's only true if you have 30 years." },
  { name: "Curiosity Gap", how: "State that something exists, withhold the payoff.", ex: "Three techniques. One has a 94% success rate. Nobody teaches the right one." },
  { name: "Myth-Bust", how: "Destroy the single most common wrong assumption.", ex: "Every guide says to budget first. Here's why that quietly keeps you broke." },
  { name: "Bold Claim", how: "State a counterintuitive result up front.", ex: "This one habit is responsible for most failed channels, and almost nobody names it." },
  { name: "Direct Address", how: "Speak to a specific person in a specific moment.", ex: "If you've ever rewritten a hook five times and still hated it, stop." },
  { name: "Teaser", how: "Promise a specific, concrete payoff by the end.", ex: "By the end of this you'll know the exact 6-account setup that changed everything." },
  { name: "Pattern Interrupt", how: "Subvert the expected opening immediately.", ex: "Most videos on this start with a definition. We're skipping all of that." },
  { name: "Scene-Setter", how: "Build sensory atmosphere before revealing the stakes.", ex: "The office smelled like burned coffee. Nobody had slept. The audit started in four hours." },
  { name: "Story", how: "Open inside a personal narrative scene, present-tense.", ex: "Three years ago I was $40k in debt and lying about it to everyone I knew." },
];
export const HOOK_TYPE_NAMES = HOOK_TYPES.map((h) => h.name);
export const HOOK_TYPES_PROMPT = HOOK_TYPES.map((h, i) => `${i + 1}. ${h.name} — ${h.how} e.g. "${h.ex}"`).join("\n");

const buildSystemPrompt = ({ softCta = false, noCta = false, sourceVerdict, topicKind = "event" }: { softCta?: boolean; noCta?: boolean; sourceVerdict?: "documented" | "partial" | "unverified"; topicKind?: "event" | "explainer" | "hypothetical" | "claim" } = {}) => `You are Skripr's AI script engine. You specialize in writing YouTube scripts for faceless channels that are optimized for retention, algorithm performance, and AI voice (TTS) delivery.

Your scripts follow these principles:
1a. HOOK DEVICE — SELECT IT FROM THIS CASE'S OWN FACTS, DO NOT TRANSPLANT THE SOURCE'S (the highest-leverage craft decision). A hook device works only when the case's facts can fire it. The source video's device fit ITS case, not necessarily yours: a "resolve a spectacle the audience witnessed" open works for a case people saw happen (a livestreamed raid), and falls flat on a case with no witnessed spectacle. So do NOT copy the source's hook treatment. Instead, from this MENU pick the device the CASE'S FACTS best support and the voice allows:
   - RESOLVE-A-WITNESSED-SPECTACLE: "you saw this happen and no one explained it — here is why." Only when the audience actually witnessed a public event.
   - PARADOX: two true facts that cannot both be true, held side by side ("billions of streams, zero real fans"; "a song no human ever chose to play is streaming right now"). Strong when the facts contain a contradiction.
   - COLD-SCENE-DROP: drop straight into one vivid documented moment, mid-action, no setup.
   - TICKING-CLOCK: a countdown or deadline the facts establish.
   LEAD WITH THE STRONGEST CONCRETE IMAGE that is already in the researched facts — do not bury it in paragraph 2. THE VERY FIRST SENTENCE MUST BE THE DEVICE FIRING ON THAT CONCRETE IMAGE, not a windup toward it. A vague abstract opener is a FAILURE: "something was quietly draining millions", "for years, a scheme operated in the shadows", "few people noticed at first" — these name nothing the viewer can picture and they bury the real hook. Instead, open ON the specific image or contradiction the facts give you and let the viewer feel it before you explain anything. The material is almost always already there; surface and place it, never invent it. This is niche-agnostic: a paradox for a fraud whose facts contradict each other, a cold vivid scene for a murder case, a ticking clock for a disaster, a single stark object for a heist — pick from the facts you were given, and put it in sentence one.
1. HOOK: First 5 seconds must grab attention using one of the proven hook types defined in the HOOK RULES section below. OPEN A LOOP, DO NOT STATE FACTS (non-negotiable — this is graded and it fails most often): the hook must TEASE a payoff and then JUMP AWAY from it, creating a question the viewer needs answered. Name the most striking thing to come (the scale, the number, the turn) WITHOUT resolving it, then cut to the setup. A hook that simply states facts in order ("In 2017, a man began…") has no open loop and fails. Right shape: name the stakes or the shocking outcome as a question the video will answer, then pull back to the beginning. Do NOT resolve the teased payoff until later — that gap is the loop. Hook types built on a specific statistic (Data Drop, and the numeric form of Curiosity Gap) are only available when that number appears in the provided source material; with no source, pick a hook type that does not require inventing one (Cold Open, Question, Data Drop, Provocation, Curiosity Gap, Myth-Bust, Bold Claim, Direct Address, Teaser, Pattern Interrupt, Scene-Setter, Story). QUOTE-FIRST HOOK (strongly prefer when available): if the source material contains a striking VERBATIM quote — something a real person actually said or wrote, with a source — opening ON that quote, word for word, is one of the strongest possible cold opens. A real voice with real words in it lands harder than any narration describing the scene. Use the quote exactly as sourced; never invent or embellish one.
1b. HOOK DEVICE vs VOICE — TWO SEPARATE AXES, DO NOT CONFLATE THEM. The hook DEVICE, where the loop opens, and where the callback lands are STRUCTURE — chosen from the case's facts (rule 1a). The creator's VOICE is only HOW it is said — diction, rhythm, register. Order of operations: pick the device from the facts, decide which fact/image it points at and defer the payoff, THEN let the voice render the wording. The same paradox hook is renderable in any voice (forensic, clinical, high-energy); never bake a specific voice's phrasing into the device choice, or a voice fights the case (a psychology voice forced onto a mechanism story). Voice may NOT weaken the requirement that the loop opens or the callback lands — those are always-on best practice regardless of voice. Two legitimate constraints: (a) if the voice's NEVER-DOES bans a device (e.g. never opens on a rhetorical question, never uses second person), pick a device the voice allows; (b) if the voice carries its OWN opening signature (e.g. a date-stamped cold drop), use that AS the device, still pointed at the case's strongest concrete fact or image.
2. RETENTION BEATS: Use three precision mechanics — not generic pattern interrupts:
   a) RE-HOOK AT 0:30: The 30-second cliff is the #1 drop-off point. Place a hard re-hook at the 30-second mark — a new tension, a surprising pivot, or a fact that reframes what the viewer just accepted. This is mandatory, not optional.
   b) ESCALATING OPEN LOOPS: Place open loops at the 1/3 and 2/3 points of the script. The 2/3 loop must be more urgent and higher-stakes than the 1/3 loop — escalate intensity, don't just repeat the pattern. The viewer must feel it would be a mistake to stop now.
   c) CALLBACK THREADING — RETURN TO A CONCRETE OBJECT/IMAGE (mandatory, graded, fails often). Plant ONE specific CONCRETE IMAGE OR OBJECT in the hook — a physical thing or a vivid single image the story can orbit (the 2017 spreadsheet; "a song no human ever chose to play, streaming right now"; the shipping label in the Nike case). Thread it lightly through the middle, then in the final 20% RETURN to that exact image and land it on a REAL SOURCED FACT: the documented outcome, the forfeiture figure, the guilty plea. An abstract callback ("the calculation on a spreadsheet") is weak; a concrete object the viewer can picture is what produces "I can't believe that came back." The ending must not simply stop, must not resolve on a teased phantom, and must not imply a revelation the facts don't contain — it returns to the planted image and pays it off on a real number.
3. VOICEOVER-READY: Short sentences (max 15 words). Natural conversational tone. Plain spoken prose ONLY — never include stage directions, bracket markers, or annotations of any kind (no [PAUSE], no [EMPHASIS], no [MUSIC], nothing in brackets). Creators paste this text directly into AI voiceover tools or read it aloud word-for-word; anything that is not speakable text breaks their workflow.
3b. NO INVENTED ORDINARY LIFE: where the sources are silent about how someone lived (years on the run, life under an alias), never fill it with everyday texture (rent, bills, mail, a lease, neighbors, "a face people recognized", routines, jobs) or invented investigation texture (dead leads, months of pulling threads). Say once that the record shows little about that stretch, and move on. Never fill that silence with SUSPICION either (hinting that named people helped, funded, or hid someone, or that a possibility "hasn't been ruled out"): a hint is still a claim. Never state what an agency knew, intended, or failed to do, or how long it took, unless sourced; no "not unusual for the era" filler; never invent the terms of a sentence or probation.
4. HUMANIZATION (critical): Write exactly like a real person talking — not an AI. Use:
   - Contractions always (don't, you're, it's, we've, that's)
   - Occasional sentence fragments for emphasis. Like this.
   - Varied sentence rhythm — mix short punchy lines with longer ones
   - Natural filler transitions: "Here's the thing...", "And honestly?", "Now, I know what you're thinking", "But wait —"
   - First-person opinions: "I think", "In my experience", "What I've found"
   - Direct address: "you", "your", never "one" or "individuals"
   - Imperfect constructions: start sentences with "And", "But", "So"
   - Avoid: "In conclusion", "Furthermore", "It is worth noting", "Delve", "Crucial", "Leverage", "It's important to"
   - Never use em-dashes mid-sentence — use commas or just end the sentence
   - No bullet-point-style lists read aloud. Flow naturally instead.
4. CTA PLACEMENT: ${noCta
  ? `WRITE NO CTA. This script must NOT ask the viewer to subscribe, like, comment, share, follow, or watch another video anywhere — not mid-script and not at the end — and must NOT tease that more videos exist ("there's more where this came from"). The script ends on its final NARRATIVE line, with nothing after it. The "cta" field must be an empty string.`
  : softCta
  ? `Place ONE soft CTA at the 60-70% mark (where retention typically dips), then the hard CTA at the end. "SOFT" IS A HARD CONSTRAINT: exactly one sentence, and it may contain AT MOST a single subscribe ask. It must NOT ask for a comment, must NOT stack a second request, and must NOT restate what the ending will ask for. Only the final CTA may ask for both a subscribe and a comment. If you cannot make the early one a single unobtrusive sentence, leave it out entirely.`
  : `Place exactly ONE CTA, at the very end. Do NOT put a subscribe, comment, like, or "stick around" ask anywhere earlier in the script. A second earlier ask makes the video feel like it ends twice.`}
5. STRUCTURE: Follow the exact structural pattern of the source viral video but apply it to the new topic.
5b. LENGTH THROUGH CRAFT AND CONTEXT, NEVER PADDING (the core of a long-form script). A great long video does NOT come from more raw facts or from repeating the ones you have. It comes from TELLING the facts you have as a story, and from the REAL SOURCED CONTEXT in the material. Reach the target length by DOING this to the supplied facts:
   - RENDER EACH FACT AS A SCENE. Do not report "he ran a bot farm." Put the viewer in it: the moment, the room, the stakes, what it felt like, what was at risk — using only details the facts support. A single sourced fact, told as a scene with its real stakes, is a minute of retention; stated flat, it is five seconds.
   - EXPLAIN THE MECHANISM PATIENTLY. When a fact names how something worked, walk the viewer through it step by step in causal order, at the pace of someone who wants them to actually understand. The "how" explained well is the most rewatched part of a documentary.
   - USE THE CONTEXT FACTS AS THE CONNECTIVE TISSUE. Some supplied facts are marked or read as CONTEXT — how the industry/system works, the history and prior similar cases, the broader moment, the stakes and who was affected, how detection or regulation works. These are real and sourced. Weave them in to widen the story beyond the single case: set up the mechanism before the crime, compare it to the precedent, land the impact. This is where honest minutes come from.
   - BUILD A CONTROLLING THESIS and escalate toward it. The video is an argument, not a pile of facts: state (or imply) what it all means, and make each section raise the stakes over the one before.
   - RUN THE RETENTION PLAYBOOK your framework checks look for: open a loop in the first 30 seconds and pay it off late; escalate stakes section to section; make ONE section clearly the longest and heaviest (the peak); and plant a detail early that you call back at the end. Write TO these, do not bolt them on.
   THE HARD LINE (never cross it): expanding a sourced fact into scene, stakes, mechanism, or context is REQUIRED. Inventing a NEW case fact, a statistic, a date, a name, or a quote that is not in the material is FORBIDDEN and will be caught. Expansion adds craft AROUND a fact; invention adds a fact. If you find yourself needing a fact you were not given to fill time, that is the signal to go deeper on a scene or a context fact you DO have, never to make one up.
6a. BANNED NARRATOR TICS (hard rule — these belong to no creator and mark a script as machine-written). Never use, in any variation: "pause on that for a second", "sit with that", "think about what that means", "read that again", "let that sink in", "here's the thing", "now slow down", "that's not a metaphor", "the uncomfortable truth", or the construction "That's not X. That's Y." These are the loudest thing in a generic AI script. If you feel the urge to tell the viewer that something is significant, make the sentence itself carry the weight instead — show the thing, do not instruct the viewer how to feel about it.

6. ANTI-REPETITION: Never start two consecutive sentences with the same word. Vary sentence length — mix short punchy sentences with longer ones. Never repeat a key point already made; build forward only. Two specific patterns to avoid, because they are the usual way a good script goes slack:
   a) RESTATING AN IDEA IN NEW WORDS (a hard failure, and the #1 way length gets faked). Making the same point — the same mechanism, the same explanation, the same number — a second time, however reworded, is padding. State each fact and each explanation ONCE, in its strongest form, then ADVANCE to different material. If you feel you are running short, that is NOT a cue to re-explain what you already said; it is a cue to go DEEPER on a DISTINCT fact or context fact you have not used yet (the mechanics, a prior case, the victims, the money trail, the response). You have been given a wide set of facts precisely so length comes from BREADTH of real material, never from repeating five points. If you cannot fill the length without restating, write it shorter — a tight script beats a padded one.
   b) NO RECAP BEFORE THE END. Do not summarise the story you just told before the closing beat. Re-narrating the whole case in the final third kills the momentum you spent the whole script building and steals the ending's job. The last beat should land the meaning of the story, not list its contents again. If you feel the need to remind the viewer what happened, the earlier telling was not vivid enough; fix that instead.
   c) STOP ON YOUR STRONGEST LINE (closing discipline — a formatting constraint, not a suggestion). The final narrative beat must be SHORT and hard: land it in one or two sentences and stop. Do NOT explain, soften, or add a reflective paragraph after your best line — every sentence that follows your strongest one is weaker than it and drains the ending. If the beat is a quote, END on the quote: no trailing gloss after it. The only thing allowed to follow the closing beat is the single required CTA, and that CTA must itself be brief (one or two sentences). Concretely: the last block of the script — closing beat plus CTA together — should be well under 60 words. A long final paragraph is the single most common way a strong script fumbles its ending.
7. NO FABRICATED FACTS: Never state a specific statistic, percentage, dollar figure, year, date, named study, or named survey unless it appears in the provided source material. Never attribute a quote or claim to a named real person unless it was in the source material. A creator will read this on camera — an invented number destroys their credibility. Do NOT downgrade an unsourced number into a vague claim of evidence; write the sentence without the number, or cut it.

${PROVENANCE_RULE}${topicKind === "event" && (sourceVerdict === "unverified" || sourceVerdict === "partial") ? `

PREMISE NOT VERIFIED (critical): a source check could NOT confirm ${sourceVerdict === "partial" ? "this specific event, case, or framing (only the broader subject area is documented)" : "that this specific event, case, or claim is documented anywhere"}. Therefore this script MUST NOT present it as an established, reported incident. You are FORBIDDEN from inventing a specific date, year, name, place, agency, job title, court case, document, or dollar figure to make it feel concrete. Do not invent an anonymous stand-in either ("a technician", "a contractor in 1987") to imply a real person exists. Write the video on what is genuinely known: explain the real mechanism, the real system, the real stakes, and state plainly where the public record goes quiet. If the topic cannot be made into an honest video without inventing a case, say so in the script's own framing rather than filling the gap.` : ""}
${topicKind !== "event" ? `\n${EXPLAINER_CRAFT}\n` : ""}
${EXPERT_ATTRIBUTION_RULE}

7. NO SPONSORS, ADS, OR PROMOS (critical): The source transcript may contain sponsor reads, ad segments, or promotions for a product, app, brand, charity, newsletter, course, Patreon, donation match, or affiliate offer (e.g. "this video's sponsor", "use code X", "go to brand.com", "first-time donors", "link in the description"). These are NOT part of the video's content — they are a paid insertion belonging to a different creator's deal. Completely ignore and exclude them. Never name the sponsor, never reproduce the ad slot, never write a "and that's why I want to mention [brand]" segment, never invent your own sponsor read. Treat the transcript as if the sponsored portions were never there. The script you output must contain ZERO brand names, products, or promotional asks other than the channel's own subscribe/like CTA.

7. ORIGINAL METAPHORS — COPYRIGHT-SAFE BUT BOLD (critical): Metaphors, analogies, comparisons, and catchphrases are the original creative expression of whoever wrote the source. Reusing one is plagiarism even when the facts around it are public. So: NEVER reuse, lightly reword, or closely paraphrase any metaphor, analogy, vivid comparison, opening image, or signature phrase that appears in the provided source material. If the source compares an allergy to "a spider in your bedroom and a nuclear bomb," you must NOT use spiders, bedrooms, or nuclear bombs at all — invent a completely different image for that idea.
   This is NOT a license to be bland. The opposite: invent your OWN bold, surprising, concrete metaphors that hook the viewer just as hard. Every script should have 2-4 of these original comparisons — a familiar everyday thing reframed in a shocking or vivid way (the kind of line a viewer screenshots). Make them yours: different domain, different objects, different picture than anything in the source, but every bit as memorable. Creativity is required; copying someone else's creativity is forbidden.

7. ${buildVarietyBlock()}

8. HOOK ARCHITECTURE — use the formula that matches the niche, not a generic opener:

HOOK TYPE DEFINITIONS:
- COLD OPEN: Drop straight into a specific moment/event. No setup. No "today we're talking about."
  Formula: [Date/Place/Person] + [What was happening] + [The thing that changed everything]
  Example: "On March 3rd, 2019, a portfolio manager at Fidelity closed his laptop and walked out. He never came back."

- PROVOCATION: Challenge a belief the viewer already holds. Make them defensive first, then curious.
  Formula: "You've been told [X]. That's [wrong/a lie/incomplete]."
  Example: "You've been told index funds are the safe choice. That's only true if you have 30 years."

- CURIOSITY GAP: Withhold the payoff. State what exists without explaining it.
  Formula: [Number/Thing] + [Exists] + [Payoff deliberately withheld]
  Example: "Three techniques. One of them has a 94% success rate. Nobody teaches the right one."

- DATA DROP: Lead with a number so specific it demands explanation.
  Formula: [Hyper-specific stat] + [What it implies that surprises you]
  Example: "The average person makes 35,000 decisions a day. 226 of them are about food alone."

- SCENE-SETTER: Build atmosphere before revealing stakes. Sensory details first.
  Formula: [Sensory detail] + [Situation] + [The stakes hiding underneath]
  Example: "The office smelled like burned coffee. Nobody had slept. The audit started in four hours."

NICHE → HOOK MAPPING (use the PRIMARY hook for each niche):
- true-crime, history, documentary → COLD OPEN (drop into the moment)
- personal-finance, investing, business → PROVOCATION (challenge their assumption)
- science, health, psychology → DATA DROP (lead with the specific number)
- self-improvement, productivity, habits → PROVOCATION or CURIOSITY GAP
- technology, ai, software → DATA DROP or CURIOSITY GAP
- fitness, nutrition → PROVOCATION (challenge conventional wisdom)
- cooking, food → SCENE-SETTER (sensory atmosphere first)
- travel, lifestyle → SCENE-SETTER or COLD OPEN
- education, explainer → CURIOSITY GAP (withhold the payoff)
- gaming, entertainment → COLD OPEN or CURIOSITY GAP

RULE: The hook must be written BEFORE any context-setting. Never open with "In this video", "Today we", "Have you ever", or "Welcome back." The hook IS the first sentence. No warmup.

9. SCRIPT FORMATTING (critical): Format the fullScript as full, flowing paragraphs — like a polished documentary narration read aloud. Each paragraph is 3 to 5 sentences that build one idea completely before the blank line. Vary sentence length WITHIN the paragraph for rhythm. Do NOT chop the script into a stack of one-line fragments: avoid standalone single-sentence paragraphs, and never use two-or-three-word dramatic fragments as their own paragraph (e.g. "A year later." / "That turned out to be wrong." / "So the mystery deepens." on their own line is a FAILURE). Reserve a rare one-line paragraph for a single genuine punch per segment at most. The goal is smooth, confident flow, never choppy. A content segment must still be multiple paragraphs, but each paragraph must be substantial. EXCEPTION: this flowing-documentary default applies only when NO creator voice profile is provided. If a voice profile is provided and its rhythm is short, punchy, fragmented, or high-energy (a direct creator who speaks in short punches and pattern interrupts), follow THAT instead. Short sentences, deliberate fragments, and frequent pattern interrupts are correct then, and matching the creator's cadence matters more than documentary smoothness.

10. NO REPETITION: Never restate a point, fact, or idea you have already made. Every segment advances with new information, a new example, or a new beat. Once something is established (for example, that the outside world feels dangerous, or that conformity is a survival strategy), build on it. Do not re-explain the same idea in different words later in the script. If you notice you are circling back to a point already made, cut it and move forward.

11. CONCRETE SCENES: Anchor each content segment in at least one specific, sensory moment the viewer can picture, not only abstract explanation. Show a place, an object, or a single concrete instant. For example, instead of "the outside world feels foreign," write "you are standing in a grocery store staring at fifty brands of cereal, and no one ever taught you how to choose." Concrete, visual moments hold attention far better than abstract description.

CRITICAL: Never use em dashes (—) anywhere in the script output. Use commas, periods, or colons instead.

Output valid JSON matching the specified schema. Be specific and actionable. No fluff.`;


/**
 * Safely extract JSON from a Claude text response.
 * Claude often wraps JSON in ```json code blocks or appends
 * explanatory text (with { } characters) before/after the JSON block.
 */
// A 1,500-word prose block containing quotation marks is the most fragile thing you can
// put inside a JSON string, and we now actively ask for verbatim quotes — so this failure
// gets MORE likely over time, not less. Repair the common cause: a `"` inside a string
// value that was never escaped. We walk the text tracking string state, and any quote
// that is not followed by a valid JSON structural character is treated as content and
// escaped rather than as a terminator.
export function repairScriptJSON(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  const raw = text.slice(start, end + 1);

  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === "\\") { out += ch; escaped = true; continue; }
    if (ch === '"') {
      if (!inString) { inString = true; out += ch; continue; }
      // Closing quote only if the next non-space char legitimately follows a string.
      const rest = raw.slice(i + 1);
      const next = rest.match(/^\s*([,:}\]])/);
      if (next) { inString = false; out += ch; continue; }
      // Otherwise it is content inside the value — escape it.
      out += '\\"';
      continue;
    }
    // Raw newlines are illegal inside JSON strings; the model emits them in prose.
    if (inString && (ch === "\n" || ch === "\r")) { out += "\\n"; continue; }
    if (inString && ch === "\t") { out += "\\t"; continue; }
    out += ch;
  }
  // Trailing commas before a closer are the other common break.
  out = out.replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(out); } catch { return null; }
}

// Last resort: the JSON is beyond repair but the WORDS are in there. Pull the prose out
// with permissive matching so the creator still gets the script they waited for, minus
// the structured extras.
export function salvageScriptText(text: string): { title?: string; hook?: string; fullScript: string } | null {
  const grab = (key: string): string | undefined => {
    const m = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*"[a-zA-Z]|\\s*[}\\]])`).exec(text);
    return m ? m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim() : undefined;
  };
  const body = grab("fullScript") || grab("script") || grab("body") || grab("content");
  if (body && body.split(/\s+/).length > 80) {
    return { title: grab("title"), hook: grab("hook"), fullScript: body };
  }
  // No usable field: take the longest run of prose paragraphs in the raw output.
  const prose = text
    .replace(/^[\s\S]*?\{/, "")
    .split(/\\n\\n|\n\n/)
    .map((p) => p.replace(/^[\s"',{}\[\]]+|[\s"',{}\[\]]+$/g, "").trim())
    .filter((p) => p.split(/\s+/).length > 12);
  const joined = prose.join("\n\n");
  return joined.split(/\s+/).length > 120 ? { fullScript: joined } : null;
}

export function extractJSON(text: string, kind: "object" | "array"): unknown {
  // First try: pull JSON from a markdown code block
  const codeBlock = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch { /* fall through */ }
  }
  // Second try: bracket-matching to find the outermost JSON structure
  const opener = kind === "array" ? "[" : "{";
  const closer = kind === "array" ? "]" : "}";
  const start = text.indexOf(opener);
  if (start === -1) throw new Error(`No JSON ${kind} found in Claude response`);
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === "\"" && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try { return JSON.parse(candidate); }
        catch (e) {
          throw new Error(`Failed to parse JSON (kind=${kind}) — snippet: ${candidate.slice(-80)}... — ${e}`);
        }
      }
    }
  }
  throw new Error(`No valid JSON ${kind} found in Claude response. Text (last 300 chars): ${text.slice(-300)}`);
}

// Lenient JSON salvage for a model response. extractJSON already handles code fences and outermost
// bracket-matching; this adds the two failure modes it doesn't: trailing commas before a closing
// brace/bracket, and smart quotes the model sometimes emits around keys/values. Applied only as a
// LAST resort before giving up, so a well-formed response is never perturbed.
export function repairJson(raw: string): string {
  return raw
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,(\s*[}\]])/g, "$1");
}

// THE shared structured-LLM boundary. Every pass that asks the model for JSON goes through here so
// a malformed response is HANDLED, LOUDLY, in one place — never silently swallowed into a SUCCESS.
// Pipeline: native parse -> strip fences / bracket-match (extractJSON) -> repairJson -> ONE retry
// with a minimal "JSON only" reprompt -> schema-validate. On final failure it returns { ok:false }
// with a reason; the CALLER decides what to keep, but must mark the stage DEGRADED (never SUCCESS).
async function callStructuredLLM<T>(opts: {
  model: string;
  max_tokens: number;
  temperature: number;
  system: string;
  user: string;
  kind: "object" | "array";
  validate: (v: unknown) => T | null;
  label: string;
}): Promise<{ ok: true; value: T; attempts: number } | { ok: false; reason: string; attempts: number }> {
  const tryParse = (text: string): unknown | null => {
    try { return extractJSON(text, opts.kind); } catch { /* fall through */ }
    try { return extractJSON(repairJson(text), opts.kind); } catch { /* fall through */ }
    return null;
  };
  let lastReason = "unknown";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const system = attempt === 1
      ? opts.system
      : `${opts.system}\n\nCRITICAL: your previous reply was not valid JSON. Reply with ONLY the JSON value — no prose, no code fences, no trailing commas.`;
    try {
      const resp = await getAnthropic().messages.create({
        model: opts.model,
        max_tokens: opts.max_tokens,
        temperature: attempt === 1 ? opts.temperature : Math.min(opts.temperature, 0.2),
        system,
        messages: [{ role: "user", content: opts.user }],
      });
      const c = resp.content[0];
      const text = c && c.type === "text" ? c.text : "";
      const parsed = tryParse(text);
      if (parsed == null) { lastReason = "unparseable"; continue; }
      const value = opts.validate(parsed);
      if (value == null) { lastReason = "schema-mismatch"; continue; }
      return { ok: true, value, attempts: attempt };
    } catch (e) {
      lastReason = `llm-error: ${(e as any)?.message || e}`;
    }
  }
  console.error(`[${opts.label}] STRUCTURED_LLM_FAILED reason=${lastReason} attempts=2`);
  return { ok: false, reason: lastReason, attempts: 2 };
}

// Single extension pass only: each pass is a full Sonnet call (60-90s), and the
// base generation already uses one. Stacking passes risks the Vercel function limit,
// and a dead function loses everything — a slightly-short script beats no script.
// Heal paragraph breaks that land INSIDE a sentence. A blank line after an
// abbreviation ("...and then a U.S." / "Border Patrol agent.") reads as a formatting
// bug and, worse, a TTS tool pauses there. Deterministic repair applied to the final
// body, so it fixes the break whichever layer introduced it (model output or a
// continuation pass) rather than guessing at the cause.
export function healMidSentenceBreaks(text: string): string {
  if (!text) return text;
  // Case 1: the paragraph ends with a known abbreviation, so the period was not a
  // sentence end. Rejoin with a single space.
  const ABBR = String.raw`(?:U\.S|U\.K|U\.N|Mr|Mrs|Ms|Dr|Prof|Sgt|Lt|Capt|Det|Gen|Sen|Rep|Gov|St|Jr|Sr|vs|etc|Inc|Co|Ltd|No|Ave|Blvd|approx|a\.m|p\.m|[A-Z])`;
  let out = text.replace(new RegExp(String.raw`(\b${ABBR}\.)\n\n+(?=\S)`, "g"), "$1 ");
  // Case 2: the paragraph ends WITHOUT terminal punctuation (mid-clause split) and the
  // next line starts lowercase or with a conjunction — clearly one sentence torn in two.
  out = out.replace(/([^\s.!?:;"'”’)\]])\n\n+(?=[a-z]|and\b|then\b|but\b|or\b)/g, "$1 ");
  return out;
}

// HOOK-FIRST GENERATION.
//
// The hook field and the script body were two independent generations with nothing
// joining them: the displayed hook opened on a stacked stat, while the body opened by
// restating the title. Both were "the opening", and they disagreed. Generating the hook
// FIRST and passing it verbatim gives one source of truth — and because it is a tiny
// call, an archetype failure can be retried for a few hundred tokens instead of
// discovering it after a full script has been written.
export async function generateHookFirst(input: {
  title: string;
  topic: string;
  hookType?: string;
  hookWhyItWorks?: string;
  hookScript?: string;
  // The SPECIFIC angle the creator chose on the angle page (its hook premise). The hook must DELIVER
  // this angle, not independently grab the single biggest fact — that is what made every hook type
  // open on the same statistic. Distinct from hookScript (a remix source's own opening, shape-only).
  anglePremise?: string;
  // Where the picked card's payoff lands ("The payoff lands on ..."). The hook opens on the card's tension
  // and NEVER on this (creator rule, 2026-10-06, all niches).
  anglePayoff?: string;
  // The card's "Viewer asks" question: the hook opens it and must not answer it.
  angleQuestion?: string;
  // Learned proven hooks for the niche (view-ranked + creator-kept from analyzed viral videos), so
  // the hook writer improves from real winners, the same signal the angle + body writers use.
  nicheHookExamples?: string;
  sourceMaterial?: string;
  voiceProfile?: string;
  directorNote?: string;
}): Promise<string | null> {
  // OPENING RULE (creator decision 2026-10-06, replaces "never open on the payoff"): open on the strongest
  // unresolved question. An outcome may open the hook when it creates a stronger how/why question; the hook
  // must never ANSWER the question it opens. The card's own opening is kept (fidelity check below).
  const premiseShown = String(input.anglePremise || "");
  const wantsStat = /stat|data|number|controvers|figure/i.test(input.hookType || "");
  const wantsQuote = /quote|line|said/i.test(input.hookType || "");

  const ask = async (retryNote?: string): Promise<string> => {
    const msg = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      temperature: 0.9,
      system: "You write the opening lines of a YouTube script. Output ONLY the hook itself as plain speakable prose — 2 to 4 sentences, no label, no quotes around it, no commentary.",
      messages: [{
        role: "user",
        content: `VIDEO TITLE: "${input.title}"
TOPIC: ${input.topic}
${input.hookType ? `\nHOOK ARCHETYPE (required): ${input.hookType}. ${wantsStat ? `A stat/controversy hook is not just "has a number". Its engine is: a SUPERLATIVE CLAIM about the subject, then a STACKED COMPARISON that proves it — the figure set against two or three familiar things people already fear or understand, combined ("more than terrorism, wars and car accidents combined"). Keep it to two sentences, roughly 25-30 words. If the facts contain a stacked comparison, build the hook on it. If they do not, make the strongest single superlative claim the facts support and prove it with the biggest documented figure — do NOT invent a comparison.` : wantsQuote ? "Real quoted speech must open it." : ""}` : ""}
${input.anglePremise ? `\nOPEN ON THE STRONGEST UNRESOLVED QUESTION (critical, every niche): the hook's first sentence opens on the same moment the card below opens on. It may reveal an outcome (an arrest, a collapse, a result) ONLY when that outcome creates a stronger question about how, why, or what led to it; never reveal an outcome just because it is dramatic. The hook must NEVER answer the question it opens: keep the mechanism, the cause, and the explanation for the video. Test: after the hook, the viewer has one specific question it doesn't answer.${input.angleQuestion ? `\nTHE CARD'S CENTRAL QUESTION (the hook opens it and must not answer it): ${String(input.angleQuestion).slice(0, 240)}` : ""}${input.anglePayoff ? `\nWHERE THE VIDEO PAYS OFF (never explained in the hook): ${String(input.anglePayoff).slice(0, 400)}` : ""}\nTHE ANGLE THE CREATOR CHOSE (deliver THIS specific angle — its opening move is the point, not the single biggest number): "${String(premiseShown).slice(0, 300)}"\nBuild the hook to open the way THIS angle opens. A curiosity-gap angle opens on the gap it teases; a reframe opens by flipping the assumption; a myth-bust opens by naming the belief it breaks; a fear/stakes angle opens on what's at risk. Do NOT default to leading with the top statistic unless THIS angle leads there. Adapt the wording to the voice and length; keep the angle's specific move.` : ""}
${input.hookWhyItWorks ? `\nWHY THE SOURCE'S HOOK WORKED (reproduce this mechanism, not its wording): ${String(input.hookWhyItWorks).slice(0, 400)}` : ""}
${input.hookScript ? `\nThe source's own opening, for shape only — never reuse its wording: "${String(input.hookScript).slice(0, 200)}"` : ""}
${input.nicheHookExamples ? `\nPROVEN HOOKS IN THIS NICHE (view-ranked, from real videos — model the MECHANIC and energy, never copy wording):\n${String(input.nicheHookExamples).slice(0, 900)}` : ""}
${input.sourceMaterial ? `\nSOURCED FACTS — any number or specific you use must come from here, exactly as stated:\n${input.sourceMaterial.slice(0, 2500)}` : ""}
${input.voiceProfile ? `\nWRITE IT IN THIS CREATOR'S VOICE:\n${input.voiceProfile.slice(0, 900)}` : ""}
${input.directorNote && input.directorNote.trim() ? `\nDIRECTOR'S NOTES (obey for the OPEN): "${input.directorNote.trim().slice(0, 500)}". If a note says to HOLD or not reveal the outcome/verdict/twist in the open, the hook MUST NOT reveal it — set up the premise and withhold the payoff.` : ""}
${retryNote ? `\nYOUR PREVIOUS ATTEMPT FAILED: ${retryNote} Fix that.` : ""}

Rules:
- Do NOT restate the title or the thesis. The viewer just read the title; repeating it carries zero new information.
- WITHHOLD THE EXPLANATION. Open on the PARADOX or the impossible situation and STOP there — do not name the mechanism, the method, or the cause in the hook. If the story's engine is "bots and AI generated billions of fake streams", the hook is the paradox ("A song racking up billions of streams that no human ever chose to play") and NOT the answer ("using AI songs and bot accounts"). The reveal is what the body is for; the hook's only job is to open the loop. A hook that hands over the how has nothing left to pull the viewer in.
- WITHHOLD THE RESOLUTION, not just the method (critical for twist/reversal stories). Never state HOW the story RESOLVES or WHICH WAY a late reversal goes — the verdict, who won, the final status, where it ended up. You may tease that a reversal or payoff is coming and how high the stakes are; you may NOT reveal its result. If the engine is "you'd expect X, but Y happened", the hook sets up X and hides Y. Naming the ending ("the case that concluded in a Lisbon courtroom", "the hijacker who won in court") spoils the exact reason to keep watching. (This does not apply to an OUTCOME-KNOWN frame like "how X was caught", where the known outcome is the premise and the method is the withheld part.)
- ONE QUESTION MAXIMUM. A rhetorical question can open a loop, but a STACK of them ("What if... What if... What if...") is a stall and an AI-writing tell. Ask at most one, then move into concrete setup.
- Say something about the WORLD, not about the video.
- No invented numbers. Every figure must appear in the facts above.
- No em dashes. Plain speakable prose.

Write the hook now.`,
      }],
    });
    const c = msg.content[0];
    return c.type === "text" ? c.text.trim().replace(/^["“']|["”']$/g, "") : "";
  };

  try {
    let hook = await ask();
    // Validate against the archetype and retry ONCE — cheap here, expensive later.
    const firstTwo = hook.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
    if (wantsStat && !/\d/.test(firstTwo)) {
      hook = await ask("The source used a statistic hook but your opening had no number in the first two sentences.");
    } else if (wantsQuote && !/["“'‘]/.test(firstTwo)) {
      hook = await ask("The source used a quote hook but your opening contained no quoted speech.");
    }
    // The hook opens on the PICKED card's moment (seen live: the creator picked a $5.3M Bitcoin card and the
    // script cold-opened on the Austria bank arrest, the story's ending). Content words of the card's first
    // sentence must show up in the hook's first two sentences; otherwise retry once.
    // QUESTION PRESERVED: the hook must not resolve the question it creates (an outcome is allowed, an answer
    // isn't). One cheap check; one retry.
    if (hook && (input.angleQuestion || input.anglePayoff)) {
      try {
        const chk = await getAnthropic().messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 200, temperature: 0,
          messages: [{ role: "user", content: `HOOK: "${hook}"\nCENTRAL QUESTION: ${input.angleQuestion || "(none given)"}\nPAYOFF THE VIDEO BUILDS TO: ${String(input.anglePayoff || "").slice(0, 300)}\n\nDoes the hook ANSWER the central question or explain how the payoff happened (the mechanism, cause, or explanation)? Revealing an outcome alone is NOT answering. Output ONLY JSON: {"answers":true|false,"why":"one line"}` }] }, { timeout: 20_000, maxRetries: 0 });
        const t = chk.content[0]?.type === "text" ? chk.content[0].text : "";
        const j2 = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
        if (j2?.answers === true) {
          const retry = await ask(`Your hook answers the question it should leave open (${String(j2.why || "").slice(0, 160)}). Keep the opening moment, but withhold the how/why/explanation for the video.`);
          if (retry) hook = retry;
        }
      } catch { /* the check is best effort */ }
    }
    // Fidelity: the hook opens on the card's own opening moment.
    if (hook && input.anglePremise) {
      const words = (t: string) => new Set((String(t).toLowerCase().match(/[a-z0-9$.,]{4,}/g) || []).map((w) => w.replace(/[.,]+$/, "").slice(0, 6)).filter((w) => !/^(?:about|after|their|there|which|while|would|where|before|other|these|those|this|that|with|from|have|were|been|into|then|than|they|them|what|when)$/.test(w)));
      const cardFirst = words(String(input.anglePremise).split(/(?<=[.!?])\s+/)[0] || "");
      const hookHead = words(hook.split(/(?<=[.!?])\s+/).slice(0, 2).join(" "));
      const shared = [...cardFirst].filter((w) => hookHead.has(w)).length;
      if (cardFirst.size >= 4 && shared < Math.min(3, Math.ceil(cardFirst.size * 0.3))) {
        const retry = await ask(`Your hook did not open on the card the creator picked. Its first sentence must open on this moment: "${String(input.anglePremise).split(/(?<=[.!?])\s+/)[0].slice(0, 240)}"`);
        if (retry) hook = retry;
      }
    }
    return hook || null;
  } catch (e) {
    console.error("[hook] hook-first generation failed, falling back to inline hook:", (e as any)?.message);
    return null;
  }
}

// SECTION-BY-SECTION GENERATION.
//
// One pass produces one blob, and the extracted structure becomes a suggestion the model
// drifts from: the climax flattens, sections come out evenly weighted, and nothing owns a
// word budget so the script runs 46% over. Generating each section against its OWN brief
// — its function, its share of the runtime, the beats that land inside it — turns the
// source's structure from a hint into a template. It also makes length arithmetic rather
// than hope, because each section is asked for a specific size.
export interface SectionSpec {
  name: string;
  purpose: string;
  targetWords: number;
  isPeak: boolean;
  triggers: string[];
  // TOPIC BLUEPRINT only: the facts assigned to THIS beat (disjoint across beats), so the section
  // writer draws from its own slice instead of the whole pool — two beats then physically cannot
  // state the same number. Empty/undefined on the remix path, which keeps its whole-pool behavior.
  assignedFacts?: string[];
  // CONCEPT MODE: the video is built to deliver ONE script concept (the picked angle), not the
  // subject's whole history. Every beat carries the concept and its own unique POINT.
  concept?: string;
  point?: string;
  // Documented specifics of the central moment (scene research), on the opening beat.
  sceneFacts?: string[];
  // The words actually SPOKEN at the central moment, verbatim from the facts ("You got me."). The
  // opening must quote them and the ending must echo them (seen live: a hook promised "three words"
  // and the script never said them).
  centralQuotes?: string[];
}

// Build the per-section plan from the source's measured structure, scaled to the user's
// chosen length. The SHAPE is preserved: if the source's peak runs 2.3x its median, it
// still runs 2.3x at a longer target — a bigger median, not a flatter video.
export function buildSectionPlan(
  structure: { section?: string; purpose?: string; description?: string; timestamp?: string }[] | undefined,
  triggers: { trigger?: string; example?: string; timestamp?: string }[] | undefined,
  targetWords: number,
): SectionSpec[] {
  const toSec = (t?: string) => {
    const m = String(t || "").match(/^(?:(\d+):)?(\d+):(\d{2})$/);
    return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
  };
  const rows = (structure || []).filter((s) => s?.section);
  if (rows.length < 2) return [];
  const starts = rows.map((s) => toSec(s.timestamp));
  if (starts.some((s) => s === null)) return [];
  const runtime = Math.max(...(starts as number[])) * 1.12;
  const spans = rows.map((s, i) => {
    const start = starts[i] as number;
    const end = i + 1 < rows.length ? (starts[i + 1] as number) : runtime;
    return Math.max(1, end - start);
  });
  const totalSpan = spans.reduce((a, b) => a + b, 0) || 1;
  const peakIdx = spans.indexOf(Math.max(...spans));

  return rows.map((s, i) => {
    // Triggers whose timestamp falls inside this section belong to it.
    const secStart = starts[i] as number;
    const secEnd = i + 1 < rows.length ? (starts[i + 1] as number) : runtime;
    const mine = (triggers || [])
      .filter((t) => {
        const ts = toSec(t?.timestamp);
        return ts !== null && ts >= secStart && ts < secEnd;
      })
      .map((t) => `${t.trigger}${t.example ? ` — the source did it like this: "${String(t.example).slice(0, 120)}"` : ""}`);
    return {
      name: String(s.section).slice(0, 80),
      purpose: String(s.purpose || s.description || "").slice(0, 200),
      targetWords: Math.max(80, Math.round((spans[i] / totalSpan) * targetWords)),
      isPeak: i === peakIdx,
      triggers: mine,
    };
  });
}

// Parse the "- fact (source: url)" lines out of the joined source material. A topic/phenomenon
// brief's source material is the approved research pool in exactly this shape; a case brief may
// also carry a "REAL CASE THIS VIDEO IS ABOUT" header block, which is not a numbered fact and is
// skipped. Returns the fact lines verbatim (source tag kept) so a beat can carry its own citations.
function parseFactLines(sourceMaterial?: string): string[] {
  if (!sourceMaterial) return [];
  return sourceMaterial
    .split("\n")
    .map((l) => l.replace(/^\s*[-•]\s+/, "").trim())
    .filter((l) => l.length > 12 && !/^REAL CASE THIS VIDEO IS ABOUT/i.test(l) && !/^\(sources?:/i.test(l));
}

// TOPIC STORY BLUEPRINT (phenomenon / topic mode, where there is no source video to measure).
// One planning call turns the approved facts + the angle into a beat outline that ESCALATES toward
// a controlling thesis, with each fact ASSIGNED to exactly one beat. The result is a SectionSpec[]
// the same chunked writer consumes — so the draft arrives near length with facts already spread
// across beats, instead of every section drawing the same pool and the refill loop carrying length.
//
// Fact-count-adaptive (the honest-length principle): the beat count is capped so each beat holds a
// real slice of facts (≈2+), rather than stretching a thin pool across too many beats. If a topic's
// honest yield is small, the video is built from fewer, denser beats — not padded to a beat count
// the material cannot support. Returns [] on any failure so the caller falls back to the one-shot
// path (current behavior), never a broken plan.
export async function buildTopicBlueprint(
  sourceMaterial: string | undefined,
  targetWords: number,
  targetMinutes: number,
  angle: string | undefined,
  opts?: { hookType?: string; storytelling?: string; directorNote?: string; structure?: { name: string; stages: { name: string; role?: string; sharePct: number; does: string; factIdx?: number[] }[] } },
): Promise<SectionSpec[]> {
  const facts = parseFactLines(sourceMaterial);
  // Below ~6 facts there is nothing to distribute — the one-shot writer handles a thin brief fine.
  if (facts.length < 6) return [];

  // Beats scaled to duration (~1 per 100s) but capped so each beat gets ≈2+ facts. A 20-min brief
  // wants ~12 beats; a 29-fact pool caps that near ceil(29/2)=15, so 12 stands; a thin pool shrinks it.
  const byTime = Math.round((targetMinutes * 60) / 100);
  const byFacts = Math.ceil(facts.length / 2);
  // A WINNING STRUCTURE (data-driven, from the niche's outlier videos) fixes the beats: one per stage, in order.
  const structure = opts?.structure && opts.structure.stages.length >= 4 ? opts.structure : null;
  const beatCount = structure ? structure.stages.length : Math.max(4, Math.min(byTime, byFacts, 14));

  const numbered = facts.map((f, i) => `[${i}] ${f}`).join("\n");
  // CONCEPT MODE (benchmark-driven): every whole-history plan kept re-making the same points to fill
  // the runtime. With an angle, build the video around ONE script concept instead: its central
  // moment/claim, beats that each contribute a distinct point toward it, only the facts that serve it.
  const conceptMode = !!(angle && angle.trim());
  const conceptRules = conceptMode ? ` CONCEPT MODE (this overrides "assign every useful fact"): the ANGLE below is the SCRIPT CONCEPT. The video exists to deliver THAT concept, not to cover the subject's whole history. (a) Name the concept's single CENTRAL MOMENT or CLAIM in "concept" (one sentence, using ONLY details the facts state: no ages, numbers, or descriptions the facts don't give). (b) Beat 1 opens ON that moment or its tension. (c) Every later beat must earn its place by building toward or proving the concept; give each beat a "point": the ONE new thing it contributes that NO other beat says. Two beats may not share a point. (d) Assign ONLY facts that serve the concept; leave the rest unassigned even if true and interesting — breadth is what makes a video repeat itself. (e) Depth over breadth: fewer facts per beat, rendered as scenes. (f) The FINAL beat pays the concept off and calls back to the opening moment. (g) If beat 1 flashes forward, the later beat that reaches that moment in time order covers ONLY what the opening did not show (how they got there, what came after); it never re-stages the opening scene or re-uses its quotes. Output JSON: {"concept":"...","beats":[{"name":"...","purpose":"...","point":"...","when":1976,"factIndices":[...],"weight":2}, ...]}.` : "";
  const sys = `You are a documentary story architect. You design the BEAT STRUCTURE of a ${targetMinutes}-minute YouTube video from a set of sourced facts, then assign each fact to the one beat it best serves. Rules: (1) The video is an ARGUMENT, not a list — state a single controlling thesis and order the beats so each RAISES THE STAKES over the last (setup → mechanism → who/how much → escalation → payoff). (2) Assign EVERY useful fact to EXACTLY ONE beat (its factIndices); it is fine to leave a weak/duplicative fact unassigned. Do not put the same fact in two beats. (3) Give each beat a distinct narrative FUNCTION in one line. (4) Weight each beat 1-3 for how much runtime it deserves (the climax/mechanism beats earn more). (5) TRUE STORIES RUN IN TIME ORDER: when the facts describe real events over time (a case, a person, a chase), beat 1 may flash forward to the most gripping moment as a cold open, but EVERY beat after it follows the order events happened. Escalate WITHIN that order. Never place a later stretch of time before an earlier event (life in Florida in the 2000s cannot come before a 1975 arrest). Give each beat a "when": the year its EVENTS happened, not the year they were reported or described in an interview (her 1976 escape, told in a 2008 interview, is 1976); use null for a beat that is not about events in time. Output ONLY JSON: {"thesis":"...","beats":[{"name":"...","purpose":"...","when":1976,"factIndices":[0,3,7],"weight":2}, ...]}. Exactly ${beatCount} beats.${conceptRules}${structure ? `

FOLLOW THIS WINNING STRUCTURE ("${structure.name}", the story shape that beat its channels' usual views in this niche). It overrides rule 5's ordering where they differ: the beats are EXACTLY these stages, in this order, one beat per stage, each beat named after its stage and doing that stage's job with THIS story's facts. Never open on the payoff: the cold open is the story's tension, the payoff stays in its own later stage.
${structure.stages.map((s, i) => `${i + 1}. ${s.name}${s.role ? ` [${s.role}]` : ""} (~${s.sharePct}% of runtime): ${s.does}${s.factIdx && s.factIdx.length ? ` Suggested facts: ${s.factIdx.join(", ")}` : ""}`).join("\n")}` : ""}`;
  const ask = `ANGLE / FRAMING: ${angle || "(none given — infer the strongest thesis from the facts)"}${opts?.hookType ? `\nHOOK TYPE: ${opts.hookType}` : ""}${opts?.storytelling ? `\nSTORYTELLING MODE: ${opts.storytelling}` : ""}${opts?.directorNote ? `\nDIRECTOR'S NOTES (obey when planning beats — within the facts, they win over your defaults): "${opts.directorNote.slice(0, 600)}". If a note says to HOLD an outcome/reversal, the payoff beat goes LAST and no earlier beat reveals it. If a note names beats that must appear (only when the facts support them) or says a topic deserves as much time as another, weight the beats accordingly.` : ""}\n\nFACTS (assign by index):\n${numbered}\n\nDesign exactly ${beatCount} escalating beats and assign the facts. Output ONLY the JSON.`;

  try {
    const msg = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      temperature: 0.4,
      system: sys,
      messages: [{ role: "user", content: ask }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : null;
    const beats: any[] = Array.isArray(parsed?.beats) ? parsed.beats : [];
    if (beats.length < 2) return [];
    // CHRONOLOGY BACKSTOP (seen live: the "20 years in Florida" beat came BEFORE the 1975 arrest beat, so
    // the viewer jumped forward then back). Date each beat after the opening by the median of its facts'
    // first-mentioned years; if that sequence goes backwards, stable-sort those beats by year. Beat 1 (the
    // cold open) stays put. Undated beats keep their slot relative to neighbors.
    // The model's own "when" (event year) wins over fact years: facts are often dated by when they were
    // REPORTED (seen live, LeFevre: her 1976 escape and 1980s life, told in 2008 interviews, sorted as
    // 2008-2009 and landed after her 2009 release, scrambling a correct order).
    // (Skipped under a winning structure: its stage order is the data-backed choice, and a mystery shape steps
    // back in time on purpose.)
    if (!structure) {
      const yearOf = (i: number) => { const m = String(facts[i] || "").match(/\b(1[89]\d{2}|20\d{2})\b/); return m ? Number(m[1]) : null; };
      const whenOf = (b: any) => { const w = Number(b?.when); return Number.isInteger(w) && w >= 1800 && w <= 2099 ? w : null; };
      const factYear = (b: any) => { const ys = (Array.isArray(b?.factIndices) ? b.factIndices : []).map(yearOf).filter((y: number | null): y is number => y !== null).sort((a: number, c: number) => a - c); return ys.length ? ys[Math.floor(ys.length / 2)] : null; };
      const byWhen = beats.slice(1).filter((b) => whenOf(b) !== null).length >= Math.ceil((beats.length - 1) * 0.6);
      const beatYear = (b: any) => (byWhen ? whenOf(b) : factYear(b));
      const rest = beats.slice(1).map((b, k) => ({ b, k, y: beatYear(b) }));
      const dated = rest.filter((r) => r.y !== null);
      const backwards = dated.some((r, idx) => idx > 0 && (r.y as number) < (dated[idx - 1].y as number));
      if (backwards && dated.length >= Math.ceil(rest.length * 0.6)) {
        let last = -Infinity;
        const keyed = rest.map((r) => { if (r.y !== null) last = r.y; return { ...r, key: r.y ?? last }; });
        keyed.sort((a, c) => a.key - c.key || a.k - c.k);
        beats.splice(1, beats.length - 1, ...keyed.map((r) => r.b));
        console.log(`[blueprint] chronology re-sorted (${byWhen ? "event years" : "fact years"}): ${keyed.map((r) => r.key).join(" -> ")}`);
      }
    }

    // The concept and points go into EVERY section's prompt, so an invented detail there spreads through
    // the whole script (seen: "an 82-year-old man" for a man of 79, age not in the facts). Strip ages
    // the facts don't support.
    const factsBlob = facts.join("\n");
    const cleanConcept = (t: string) => unsupportedAgeSentences([t], factsBlob).length
      ? t.replace(/\b(a|an)\s+\d{1,3}[- ]year[- ]old\s+/gi, "a ").replace(/,?\s*(?:aged?|at age)\s+\d{1,3}\b/gi, "").replace(/\bin (?:his|her|their) (?:early |mid-?|late )?(?:twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties)\b\s*/gi, "")
      : t;

    // Proportional word budgets from the weights, summing to the length target. Peak = heaviest beat.
    // Under a winning structure, runtime follows the stage shares the winners used.
    const weights = structure && beats.length === structure.stages.length
      ? structure.stages.map((st) => Math.max(1, st.sharePct))
      : beats.map((b) => Math.max(1, Math.min(3, Number(b?.weight) || 1)));
    // CONCEPT MODE: the central moment is the spine, not a one-paragraph teaser (seen live: the photo
    // moment opened the video and was never mentioned again; the ending landed somewhere else). The
    // opening beat gets real weight and the FINAL beat is the peak, returning to the central moment.
    if (conceptMode && !structure && beats.length >= 3) { weights[0] = Math.max(weights[0], 2); weights[weights.length - 1] = 3; }
    const totalW = weights.reduce((a, b) => a + b, 0) || beats.length;
    const peakIdx = conceptMode && beats.length >= 3 ? beats.length - 1 : weights.indexOf(Math.max(...weights));
    if (conceptMode) console.log(`[blueprint] CONCEPT: ${String(parsed?.concept || "").slice(0, 240)} :: ${beats.map((b, i) => `${i + 1}. ${String(b?.point || b?.name || "").slice(0, 110)}`).join(" | ")}`);
    const used = new Set<number>();
    const planned = beats.map((b, i) => {
      const idxs: number[] = Array.isArray(b?.factIndices) ? b.factIndices.filter((n: any) => Number.isInteger(n) && n >= 0 && n < facts.length) : [];
      // Enforce disjointness even if the model double-assigned: first beat to claim a fact keeps it.
      const mine = idxs.filter((n: number) => !used.has(n));
      mine.forEach((n) => used.add(n));
      return {
        name: String(b?.name || `Beat ${i + 1}`).slice(0, 80),
        purpose: String(b?.purpose || "").slice(0, 220),
        ...(conceptMode ? { concept: cleanConcept(String(parsed?.concept || angle || "").slice(0, 300)), point: cleanConcept(String(b?.point || "").slice(0, 220)) } : {}),
        targetWords: Math.max(90, Math.round((weights[i] / totalW) * targetWords)),
        isPeak: i === peakIdx,
        triggers: [],
        assignedFacts: mine.map((n) => facts[n]),
      };
    });
    return budgetByFacts(planned, targetWords);
  } catch {
    return [];
  }
}

// WORDS FOLLOW FACTS. A beat's budget comes from its weight, but a heavily weighted beat with few
// facts gets padded with restatement (seen live, Jones "Innocent Victim" card: the Goodenough beats
// had ~5 facts for minutes of runtime, so his IRS ordeal was told three times and one line about the
// $11,400 appeared twice). Cap each beat at what its facts can carry and hand the excess to beats
// with facts to spare. The opening and final beats keep a floor: they carry the concept.
const WORDS_PER_FACT = 100;
export function budgetByFacts<T extends { targetWords: number; assignedFacts?: string[] }>(beats: T[], targetWords: number): T[] {
  if (beats.length < 2) return beats;
  const cap = (b: T, i: number) => Math.max(i === 0 || i === beats.length - 1 ? 180 : 120, (b.assignedFacts?.length || 0) * WORDS_PER_FACT);
  let excess = 0;
  const notes: string[] = [];
  const out = beats.map((b, i) => {
    const c = cap(b, i);
    if (b.targetWords <= c) return { ...b };
    excess += b.targetWords - c;
    notes.push(`beat ${i + 1} ${b.targetWords}->${c} (${b.assignedFacts?.length || 0} facts)`);
    return { ...b, targetWords: c };
  });
  if (!excess) return beats;
  // Redistribute to beats with room, in proportion to that room.
  for (let pass = 0; pass < 3 && excess > 20; pass++) {
    const room = out.map((b, i) => Math.max(0, cap(b, i) - b.targetWords));
    const totalRoom = room.reduce((a, r) => a + r, 0);
    if (!totalRoom) break;
    let given = 0;
    out.forEach((b, i) => { if (!room[i]) return; const add = Math.min(room[i], Math.round((excess * room[i]) / totalRoom)); b.targetWords += add; given += add; });
    excess -= given;
    if (!given) break;
  }
  const total = out.reduce((a, b) => a + b.targetWords, 0);
  console.log(`[blueprint] words follow facts: ${notes.join(", ")}; total ${total}/${targetWords}${excess > 20 ? ` (${excess} words short of facts; refill tops up from unused facts)` : ""}`);
  return out;
}

// SCENE FACTS OWNED ELSEWHERE. Central-scene research runs after planning and can hand the cold open a
// fact that IS a later beat's point (seen live, LeFevre: the opening got "an anonymous caller tipped
// Michigan officials... confirmed by the thumbprint on her driver's license" while beat 7's point was
// "one tip, confirmed by the thumbprint on her own license", so the tip was told twice). A scene fact
// sharing 3+ distinctive word stems with a later beat's point (and not with the opening's own point)
// stays with that beat.
export function sceneFactsOwnedElsewhere(lines: string[], beats: { point?: string; name?: string; assignedFacts?: string[] }[]): { keep: string[]; moved: string[] } {
  const STOP = new Set(["about", "after", "again", "being", "could", "every", "first", "their", "there", "these", "those", "under", "where", "which", "while", "would", "years", "according", "reported", "source", "https"]);
  const stems = (t: string) => new Set((String(t).toLowerCase().replace(/\(source:[^)]*\)/g, " ").match(/[a-z]{5,}/g) || []).filter((w) => !STOP.has(w)).map((w) => w.slice(0, 5)));
  const own = stems(`${beats[0]?.point || ""} ${beats[0]?.name || ""}`);
  const later = beats.slice(1).map((b) => stems(`${b.point || ""} ${b.name || ""}`));
  // Or a later beat already holds the same fact (seen live: beat 6's point paraphrased the tip in too
  // few shared words, but its assigned facts carried the tip and the thumbprint).
  const laterFacts = beats.slice(1).flatMap((b) => (b.assignedFacts || []).map(stems));
  const keep: string[] = [], moved: string[] = [];
  for (const line of lines) {
    const all = [...stems(line)];
    const st = all.filter((x) => !own.has(x));
    const inPoint = later.some((L) => st.filter((x) => L.has(x)).length >= 3);
    const inFact = all.length >= 5 && laterFacts.some((F) => all.filter((x) => F.has(x)).length / all.length >= 0.6);
    (inPoint || inFact ? moved : keep).push(line);
  }
  return { keep, moved };
}

// OPENING ECHOES. A cold open flashes forward to the central moment; the later beat that reaches that
// moment in time order was also handed facts restating it, so the script staged the scene twice (seen
// live, LeFevre: the front-yard arrest, "Are you sure?" and the thumbprint all told twice). Drop from
// later beats any fact that repeats an opening fact's quote or most of its wording.
export function dropOpeningEchoes(beats: { assignedFacts?: string[] }[], dropped_out?: string[]): number {
  if (beats.length < 2) return 0;
  const words = (t: string) => new Set(String(t).toLowerCase().replace(/\(source:[^)]*\)/g, " ").match(/[a-z0-9']{4,}/g) || []);
  const quotes = (t: string) => [...String(t).matchAll(/[“"]([^“”"]{6,200})[”"]/g)].map((m) => m[1].toLowerCase().replace(/[^a-z0-9' ]/g, "").trim()).filter((q) => q.split(/\s+/).length >= 3);
  const opening = beats[0].assignedFacts || [];
  const openQuotes = new Set(opening.flatMap(quotes));
  const openWords = opening.map(words);
  let dropped = 0;
  for (const b of beats.slice(1)) {
    const keep = (b.assignedFacts || []).filter((f) => {
      if (quotes(f).some((q) => openQuotes.has(q))) return false;
      const w = words(f);
      if (w.size < 6) return true;
      // Measured against the LATER fact's own words: a fact that adds something new (the charge, the
      // sting) survives even when a short opening fact shares its setup (seen live: "19, community
      // college, no record" swallowed the heroin-sale fact and the script never said what she did).
      return !openWords.some((o) => { let n = 0; w.forEach((x) => { if (o.has(x)) n++; }); return n / w.size >= 0.8; });
    });
    if (dropped_out) dropped_out.push(...(b.assignedFacts || []).filter((f) => !keep.includes(f)));
    dropped += (b.assignedFacts || []).length - keep.length;
    b.assignedFacts = keep;
  }
  return dropped;
}

// Write one section against its own brief. Small, focused calls: the model has one job,
// one word budget, and the beats that belong here — nothing to trade the structure against.
export async function writeSection(
  spec: SectionSpec,
  index: number,
  total: number,
  context: { topic: string; title: string; sourceMaterial?: string; previousTail: string; recipe?: string; voice?: string; directorNote?: string; alreadyTold?: string; reservedFacts?: string[]; otherPoints?: string[]; openingHook?: string },
): Promise<string> {
  const conceptBlock = spec.concept
    ? `\nTHE VIDEO'S CONCEPT (every sentence of this section serves it; this is not a history of the subject): ${spec.concept}\nTHIS SECTION'S ONE POINT: ${spec.point || spec.purpose}\n${spec.centralQuotes && spec.centralQuotes.length && (index === 0 || index === total - 1) ? `THE WORDS SPOKEN AT THE CENTRAL MOMENT (verbatim from the facts; never paraphrase, never drop): ${spec.centralQuotes.map((q) => `"${q}"`).join(" / ")}. ${index === 0 ? "This OPENING section must quote ALL of them, word for word, in the order they were said, with who reported them. If the hook teases them (\"he said three words\"), deliver them here." : "This FINAL section must echo the key line verbatim as the callback."}\n` : ""}${index === total - 1 ? "THIS IS THE FINAL SECTION: after making its point, RETURN to the central moment named in the concept (the scene the video opened on) and land the video THERE, so the ending pays off the opening. The last lines belong to that moment, not to a new topic. It is a CALLBACK: the viewer already saw that scene in the opening, so evoke it in a line or two and land its meaning; do NOT re-explain how it happened. " : ""}Make THIS point, deeply, as scenes from the facts. ${context.otherPoints && context.otherPoints.length ? `Do NOT make these points, other sections own them:\n${context.otherPoints.filter(Boolean).map((p) => `- ${p}`).join("\n").slice(0, 1500)}` : ""}\n`
    : "";
  // ALREADY TOLD: each section used to see only the previous section's last 40 words, so every section
  // re-told the strongest beats (seen live: one twist told 3x, one quote 4x). Give it the real text.
  // Keep the most recent material when long: the opening + the latest sections are what it must not echo.
  const told = (context.alreadyTold || "").trim();
  const toldBlock = told
    ? `\nALREADY TOLD IN EARLIER SECTIONS (the viewer has HEARD all of this — do NOT re-tell any event, re-state any figure or quote, re-introduce any person, or re-describe any place below, and do NOT re-make any ARGUMENT, thesis, or insight already made there, even in fresh words (if an earlier section already said "his stillness was the strategy", this section must not say it again in any form). Refer back in a few words at most ("that 1975 arrest") and move FORWARD to a NEW point):\n"""\n${told.length > 9000 ? told.slice(0, 2500) + "\n[...]\n" + told.slice(-6500) : told}\n"""\n`
    : "";
  const reserved = (context.reservedFacts || []).filter(Boolean);
  const reservedBlock = reserved.length
    ? `\nRESERVED FOR LATER SECTIONS — do NOT reveal, state, or hint at these yet; later sections pay them off (this is how a twist or the climax stays a surprise):\n${reserved.map((f) => `- ${f}`).join("\n").slice(0, 3000)}\n`
    : "";
  const msg = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: Math.min(8000, spec.targetWords * 3 + 800),
    temperature: 0.8,
    system: `You write one section of a YouTube voiceover script IN A SPECIFIC CREATOR'S VOICE. The voice is not a finishing touch — it is how you write every sentence from the first word. Output ONLY that section's prose — no headings, no labels (never write "HOOK:" or a section name), no commentary, no JSON. Plain speakable text. NEVER use these generic narrator tics, in any variation: "read that again", "pause on that", "sit with that", "let that sink in", "think about what that means", "here's the thing", "that's not a metaphor", or "That's not X. That's Y." They belong to no creator and mark writing as machine-made.

THE DRAMATIC TRUTH RULE (non-negotiable — write disciplined from the FIRST draft): you may intensify emotion, imagery, contrast, pacing, and narrative IMPLICATION freely, but you may NOT intensify the evidence's SCOPE, CERTAINTY, CAUSATION, EXCLUSIVITY, QUANTITY, or KNOWLEDGE/INTENT beyond the sourced facts. Make the interpretation vivid; keep the measurement exact. Concretely, do NOT write:
- absolutes about human listening or scope ("no human audience at all", "not a single real listener", "the industry never saw it coming");
- anything beyond an official's own words — if the DOJ called it "the first criminal case involving artificially inflated music streaming", do NOT upgrade to "the first in American history";
- a ROLE or FUNCTION for a co-conspirator the record doesn't define ("his job was to improve the AI", "a partner with skin in the game") — say only what is sourced ("financially incentivized", "paid a share");
- that a platform DETECTED the scheme or DROVE the investigation — a platform limiting its own exposure to ~$60,000 is NOT catching him or tipping investigators;
- zero-sum / one-for-one economic claims ("every dollar he took was a dollar stolen from a real artist"), invented mysteries ("where did the other two million go"), or a stat attributed to a named body (RIAA, a study) that is not in your facts;
- "same number"/"identical" about two figures that differ.
STAT FIDELITY — state a statistic ONLY as its source frames it (the most common way a research-heavy script overstates): a RANGE or SHARE is not a THRESHOLD ("47% call $5–$9.99 a fair price" is NOT "half said [one higher price] is unfair"); a SAMPLE/SUBSET figure is not the WHOLE ("a 77.4% rise across a basket of items at six chains" is not "fast food rose 77.4%" — name the sample); an ILLUSTRATIVE/example figure is not UNIVERSAL ("a business on a ~5% margin" is not "operators preserved their 5%"); a MODELED/PROJECTED number keeps "estimated/modeled"; and a figure from an ADVOCACY GROUP, TRADE ASSOCIATION, or COMPANY about its own industry must be ATTRIBUTED in the narration ("a 2026 Employment Policies Institute analysis argues…"), never stated as neutral fact.
ANALYTICAL-INFERENCE DISCIPLINE (keep the INVESTIGATION framing — "that explains X, but not Y" — but never harden a reasonable inference into a definitive claim; this is where a data-heavy script loses accuracy while sounding confident): (1) NO FALSE-DICHOTOMY ACCOUNTING — if a study says "~50% passed through to prices", do NOT say "the other half went somewhere else" as if there is a clean second bucket to point at; say "the rest was absorbed elsewhere in the business" without quantifying or locating it (margins, hours, portions, closures, mix — the study did not itemize it). (2) CORRELATION IS NOT CAUSATION — two findings sitting together ("47% call a range fair, 81% noticed increases") are a TENSION, not "cause and effect"; write "put them side by side and the tension is obvious", never "they are cause and effect". (3) NO UNPROVEN PERMANENCE OR ABSOLUTES — "some exits are permanent" -> "some may not come back"; "millions can no longer afford it" -> "millions no longer consider it affordable"; "nobody noticed" -> "without the industry ever announcing it". (4) NO COORDINATED INTENT — "restaurants discovered / found a lever", "operators were widening the gap" implies industry-wide strategy the data does not show; write "another lever was available" and "prices stayed well above where the cost shock alone would put them". The framing QUESTION stays; only the connective CLAIM softens to what the evidence supports.
Write the TRUE version with the same punch. Model recasts: "no human choosing to hear it" -> "The stream didn't need a fan. It needed a system capable of generating the play." | "the first criminal case in history" -> "one of the earliest criminal cases to put AI-generated music inside the scheme." | "every dollar he took was stolen from a real artist" -> "The streams were fake. The money they generated wasn't." | "half said $6.50 crossed the line of fair" -> "half said a fair meal runs five to ten dollars, and the combos now push past that." | "the other half went somewhere else" -> "the rest was absorbed elsewhere in the business." | "they are cause and effect" -> "put them side by side and the tension is obvious." Metaphor and contrast are fine ("the operation became a factory"); only invented factual scope is banned.`,
    messages: [{
      role: "user",
      content: `VIDEO: "${context.title}"
THE TITLE IS A HOOK FRAMING, NOT A SOURCE OF FACT. Any time span or number in the title is a headline device — never state a duration (how many years the scheme ran, how long it lasted) FROM the title. State durations only from the sourced facts below; if the facts give dates (a start year and an end year), the span is their difference, and that is the only duration you may assert.
TOPIC/ANGLE: ${context.topic}
${context.recipe ? `\nTHE SOURCE VIDEO'S RECIPE (this remix follows it): ${context.recipe}\n` : ""}
YOU ARE WRITING SECTION ${index + 1} OF ${total}: "${spec.name}"
ITS JOB IN THE VIDEO: ${spec.purpose || "advance the argument"}
LENGTH: about ${spec.targetWords} words. This is a budget, not a suggestion — stay within about 10%.
REACH THAT LENGTH BY ELABORATION, NEVER BY REPETITION. Hit the word budget by going DEEPER on the facts you have: explain the mechanism in causal, step-by-step detail; unpack what a figure means in real economic and human terms (against a normal comparison, who gained, who lost and how much); render the key moment as a scene, beat by beat; place it in its context and precedent. That is how a good narrator fills the time. Do NOT restate a number, name, or claim you have already made — repeating "the same figure" three times is padding and will be cut. And never invent a fact to reach length: every specific still comes only from the source material. If you are short, deepen an existing fact; do not repeat one and do not make one up.
ADVANCE THE STORY — this section is one link in a CHAIN OF DISCOVERIES, not a standalone essay. It must move PAST where the previous section left off: introduce genuinely new material that escalates — a new development, a deeper cause, a bigger consequence, an answer that opens a harder question. Never re-explain a mechanism, re-introduce a person, or re-state a figure the earlier sections already covered; assume the viewer already has it and build on it. A 20-minute video earns its length by escalating, and that is also why it never repeats: each section carries facts the others do not.
REACH FOR THE DISTINCTIVE FACTS, NOT THE ROUND HEADLINE NUMBERS. The source material carries specific, granular details — dated communications (a dated email and what it said), named entities and aliases, exact dollar movements and how the money looped, documented warnings and how they were answered, contract/agreement terms. THOSE are what make a section land and what a viewer cannot get from a summary. Build the section from them. The big round top-line figure (the total, "N million streams") is the LEAST distinctive thing you can say and is almost certainly already stated elsewhere — lead with the specific, use the round number at most once. Write the section as a CAUSAL CHAIN, each documented fact causing the next (the volume forced the need for supply, which the AI songs met, which drew the warning, which was answered, which fed the money loop), not as a list of facts.
PULL THE QUOTED AND NAMED EVIDENCE, not just the numbers. What makes a section feel REAL is the verbatim primary-source line and the specific name — quote a dated email or message in the subject's own words when the facts carry one ("in order to not raise any issues... we need a TON of content"), name the aliases and entities exactly as written (the randomized AI song names, a shell/company name like an "SMH Entertainment" money trail), cite the dated milestone with its figure (an 88 million streams / $110,000 month, a "10x-20x better" quality email). Reach for these quoted/named specifics FIRST — they are the highest-value texture in the material and the thing a summary can never reproduce. A section built on a real quoted line and a named detail beats one built on round numbers every time.
WALK THE MACHINE, do not just cite its numbers. If this section explains HOW the scheme worked, take the viewer STEP BY STEP through the mechanism using the granular figures AS THE STEPS, smallest unit up to the total — e.g. the number of cloud accounts, times the bots per account, gives the bot count; that many bots stream so many songs a day; that many songs make so many streams a day; at the per-stream rate that is so many dollars a day, which compounds to the monthly and yearly figures, which is where the money loop moves it. Each documented number is a LINK the previous one produces, shown as arithmetic the viewer can follow — never a pile of figures mentioned in passing. That walk-through IS the spine of the mechanism section; build it, don't summarize it.
THIN SECTION? KEEP IT SHORT — NEVER PAD WITH INFERENCE. If the facts you have for this section are sparse (a role the record names but does not explain, an unnamed person, a gap the sources leave open), state plainly what the record DOES say, once, and move on — a short honest section is fine. Do NOT stretch thin facts to length by guessing at roles, motives, or cooperation ("the publicist provided the cover", "whether they cooperated"), by building a "mystery" the sources don't support, or by editorializing about what the record doesn't say. When the record is silent, say so briefly ("the indictment names them but does not detail their role") and go no further. Unsupported inference is the one thing worse than a short section.
SHOW, NEVER ANNOUNCE THE FEELING: never tell the viewer how to feel or that a moment is powerful: no "the detail that stays with you", "this is the part that is genuinely hard to process", "and that is chilling", "it's worth sitting with that", "here's where it gets interesting", "what makes this remarkable". Deliver the moment; the viewer decides how it lands.
NO INVENTED ORDINARY LIFE (the most common invention, and reviewers catch it): when the record is silent about how someone LIVED during a stretch of time (years on the run, a life under an alias, a career, a marriage), do NOT fill the silence with everyday texture: paying rent or bills, getting mail, holding a lease, neighbors, being "a face people recognized", "a place in the community", routines, jobs, habits, or what people around them thought. Also do not invent the texture of an INVESTIGATION (dead leads, file transfers, months of pulling threads, late nights). State what the record shows about that stretch, say plainly ONCE that it shows little more ("the record says almost nothing about those years"), and move on. Silence stated honestly is stronger than a life made up to fill it.
NO INVENTED MINDS OR AGENCY KNOWLEDGE: never state what a real person or an agency/official THOUGHT, FELT, KNEW, believed, intended, or FAILED to do, or how long their work took, unless the facts say it: "the Marshals had no idea where he was", "nobody pursued him", "they closed his file", "they dismantled it in a matter of months" are all inventions. Say what the record shows they DID, with its date.
NO ERA OR GEOGRAPHY FILLER, NO INVENTED LEGAL TERMS: no "that was not unusual for the era" / "common at the time" generalizations, no geographic description of a place beyond what the facts give, and never invent the TERMS of a sentence, probation, or parole ("stay out of trouble, do not drive"): state only the terms or violations the facts name.
AND DO NOT FILL THE SILENCE WITH SUSPICION either. Never suggest, hint, or pose as an open question something the record does not say, especially about real people: "a small circle can shelter a person, it can also fund one", "neither possibility has been ruled out", "someone may have helped him", "it's hard not to wonder whether". A hint is still a claim. If the record names people around the subject without saying what they did, say exactly that and nothing more.
${spec.isPeak ? `THIS IS THE PEAK OF THE VIDEO. It is the longest section by design. Slow down, go beat by beat, and let it breathe. Do not summarize what happens here — render it.\n` : ""}${!spec.isPeak && total >= 6 && index === Math.floor(total / 2) ? `THIS IS THE MIDPOINT PIVOT. A long video needs one clear TURN near the middle where the framing flips and the viewer thinks "wait, THAT'S the real problem." Do not just add another point here — REFRAME what came before: the obvious explanation the first half built up is not the whole story, and this section names the sharper question the rest of the video will chase. Land that turn in a crisp line, then open the new loop it creates. (Only if the material genuinely supports a turn — never manufacture a fake twist.)\n` : ""}
${spec.triggers.length ? `RETENTION BEATS THAT BELONG IN THIS SECTION (place them here, reproduce the MECHANIC not the wording):\n${spec.triggers.map((t) => `- ${t}`).join("\n")}\n` : ""}
${conceptBlock}${toldBlock}${reservedBlock}${context.previousTail ? `THE SECTION BEFORE THIS ONE ENDED LIKE THIS (continue naturally, never repeat it):\n"...${context.previousTail}"\n` : (context.openingHook ? `THE HOOK THAT PLAYS RIGHT BEFORE THIS SECTION (already heard):\n"""\n${context.openingHook.slice(0, 1200)}\n"""\nStart where the hook leaves off. Do NOT re-stage its scene, re-state its date or place as a fresh dateline, or re-describe the action it just showed. Move to what the viewer does not know yet.\n` : "This is the OPENING section — it carries the hook.\n")}
${context.directorNote && context.directorNote.trim() ? `\nDIRECTOR'S NOTES from the creator — treat as HARD, MUST-OBEY instructions for HOW to tell this (they never override the sourced facts, but within the facts they win over your defaults): "${context.directorNote.trim().slice(0, 800)}"\n- If a note says to HOLD or not reveal something in the open (an outcome, a verdict, a twist), this ${index === 0 ? "OPENING section MUST NOT reveal it — set up the premise and withhold the payoff" : "section must respect that hold until the point the note names (e.g. 'the middle', 'the end'); if the note names no point, hold it until the video's final act. The RESERVED list above tells you which beats belong to later sections"}.\n- If a note names beats that must appear, work in the ones this section is responsible for (only when the facts support them).\n${index === total - 1 ? `- FINAL SECTION: if a note names an EXACT closing line, this section MUST end on that line, verbatim, as the very last sentence — nothing after it.\n` : ""}` : ""}
${spec.assignedFacts && spec.assignedFacts.length ? `\nTHE FACTS ASSIGNED TO THIS BEAT — build this section on THESE. They are yours to spend here; other sections carry the rest of the research, so lead with these and render them as scenes/steps. State a NUMBER only if it appears in the assigned facts (or, for light connective context, elsewhere in the pool) — do not pull another beat's headline figure into this one. NEVER narrate the bookkeeping: do not mention fact numbers, do not say a fact was "delivered above"/"already covered"/"skipped", and never write that facts are duplicates. If an assigned fact repeats something already told, simply skip it silently and write the narrative — the viewer must never hear the machinery:\n${spec.assignedFacts.map((f) => `- ${f}`).join("\n").slice(0, 4000)}\n` : ""}
${context.sourceMaterial ? `\n${spec.assignedFacts && spec.assignedFacts.length ? "THE FULL RESEARCH POOL (context + anti-fabrication guardrail only — every specific you state must exist SOMEWHERE here; but SPEND the assigned facts above, not these):" : "SOURCE MATERIAL — every specific you state must come from here. Do not add a number, name, date, or claim that is not present:"}\n${context.sourceMaterial.slice(0, 10000)}\n\nFacts tagged [his own account] come only from the subject himself (his memoir, interviews, letters), and [family account] only from his family: when you use one, attribute it in the narration (\"he later wrote\", \"by his own account\", \"his son said\"), never state it as established fact, and never say the tag itself.\n\nNO FAMOUS-FACT REACH-OUT (hard): being confident a real-world detail is true is NOT permission to state it. If a named law or Act, an agency, a program, a court case, a named report, an aftermath or "what changed" event, or a person is NOT in the material above, you may not name it — even if it is well known and genuinely connected (e.g. do not add "the Sarbanes-Oxley Act" or "this led to new regulation" unless the material contains it). The same bars invented texture ("borrowed equipment", "in a cramped office"). And do NOT assert a CAUSAL/aftermath link ("a direct response to", "which led to", "resulting in") between the story and any consequence the material does not state. When tempted to close with legacy or aftermath, end on the material you have, not on a famous fact you happen to know.
TERMS OF ART ARE VERBATIM: a legal plea, charge, verdict, or institution name is used EXACTLY as the facts state it — never paraphrase or "translate" it. "nolo contendere" or "no contest" stays that; do NOT render it "no defense" (a different meaning). A prison, court, or agency keeps its exact name from the facts (do not turn "Bayside State Prison in Leesburg" into "Leesburg State Prison"). If the facts give a term, quote the term.
PICK ONE, DO NOT HEDGE ON AIR: if the facts give two values for the same date, number, or figure, state ONE and say it once. Never narrate the disagreement ("the FBI records it as X, though some reporting places it at Y, either way…") — sources arguing with each other is machinery the viewer must never hear. Choose the PRIMARY source's value (a court filing, indictment, DOJ or agency release, the CFTC/SEC, the FBI) over news reporting or books, and move on.` : ""}
${context.voice ? `\nWRITE THIS ENTIRE SECTION IN THIS CREATOR'S VOICE — their sentence rhythm, fragment use, narrative shape, diction, energy and way of addressing (or not addressing) the viewer. Obey their never-does absolutely. STYLE NOT SUBJECT: borrow the creator's writing MECHANICS only, never their usual topics — the subject and facts of THIS section are fixed above and do not bend toward what that creator normally covers. APPLY BY STRENGTH: reproduce their dominant traits at their real frequency; do not seize one trait (a fragment habit, a catchphrase) and repeat it on every line — that is a tic, not the voice. VOICE IS NOT LICENSE: a confident or explanatory voice must never turn an inference into a stated fact to make a cleaner explanation; if the record does not give the WHY, mark it as inference or leave it out.\n${context.voice.slice(0, 5200)}\n` : ""}

PROSE DISCIPLINE (human, not AI-tell):
- NO CRUTCH ABSTRACT NOUN. Do not lean on one abstract word to carry the section — if you have used "mechanism", "architecture", "dynamic", "framework", or "apparatus" once, say it a different way the next time (the scheme, the setup, how it worked, the move). A word repeated four+ times reads as a machine reaching for it.
- BAN THESE AI-TELL PHRASES outright: "boundary condition", "the architecture of the system", "in all the ways that practically mattered", "the ground disappearing underfoot", "it's worth noting", "in a very real sense", "at the end of the day". Write the concrete thing instead.
- ONE RHETORICAL QUESTION MAX per section, and never stack them ("What if... What if... What if..." is an AI tell). Prefer a declarative sentence.
- Do NOT restate a sentence you already wrote. If a beat needs emphasis, land it once, in its strongest form.

Write only this section's prose now.`,
    }],
  });
  const c = msg.content[0];
  return c.type === "text" ? c.text.trim() : "";
}

// Generate the whole body section by section, in order, each against its own brief.
export async function generateBySections(
  plan: SectionSpec[],
  context: { topic: string; title: string; sourceMaterial?: string; recipe?: string; voice?: string },
  startedAt: number,
): Promise<{ body: string; sections: { title: string; content: string }[] } | null> {
  if (plan.length < 2) return null;
  const written: { title: string; content: string }[] = [];
  let previousTail = "";
  for (let i = 0; i < plan.length; i++) {
    // Leave headroom so a slow run degrades to what we have rather than timing out.
    if (Date.now() - startedAt > 210_000) {
      console.error(`[sections] time budget reached after ${i} of ${plan.length}`);
      break;
    }
    try {
      const text = await writeSection(plan[i], i, plan.length, { ...context, previousTail, alreadyTold: written.map((w) => w.content).join("\n\n"), reservedFacts: plan.slice(i + 1).flatMap((p) => p.assignedFacts || []), otherPoints: plan.filter((_, k) => k !== i).map((p) => p.point || "").filter(Boolean) });
      if (!text) continue;
      written.push({ title: plan[i].name, content: text });
      previousTail = text.split(/\s+/).slice(-40).join(" ");
    } catch (e) {
      console.error(`[sections] section ${i + 1} failed:`, (e as any)?.message);
    }
  }
  if (written.length < Math.max(2, Math.ceil(plan.length * 0.6))) return null;
  return { body: written.map((w) => w.content).join("\n\n"), sections: written };
}

// VOICE AS ITS OWN PASS.
//
// During generation the model juggles facts, structure, slot weighting, techniques and
// six director's notes. Voice is the last thing it optimizes and the first thing it
// drops — which is why the same narrator showed up across every profile. Same insight as
// the climax pass: give the hard thing its own turn, with nothing else to trade against.
// Structure is locked; only the prose changes.
export async function applyVoicePass(
  fullScript: string,
  voiceBrief: string,
  styleGuide: string,
  startedAt: number,
): Promise<string> {
  const words = fullScript.split(/\s+/).filter(Boolean).length;
  // Not worth a call on a stub. The time guard was 200s, but section-by-section routinely
  // spends more than that before we get here, so the pass was being SILENTLY skipped on
  // exactly the long scripts that need it. The route allows 300s, so leave ~40s of buffer
  // (skip only past 258s) and LOG the skip so this can never be silent again.
  if (words < 200) return fullScript;
  const elapsed = Date.now() - startedAt;
  if (elapsed > 258_000) {
    console.error(`[voice] SKIPPED — only ${Math.round((300000 - elapsed) / 1000)}s of budget left after ${Math.round(elapsed / 1000)}s. The deterministic tic strip still runs.`);
    return fullScript;
  }
  try {
    const msg = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: Math.min(16000, Math.round(words * 2.6) + 1200),
      temperature: 0.7,
      system: "You rewrite scripts in a specific creator's voice. You output ONLY the rewritten script as plain text — no preamble, no JSON, no headings, no commentary.",
      messages: [{
        role: "user",
        content: `Rewrite the script below in this creator's voice.

${voiceBrief}

${styleGuide ? `HOW THIS CREATOR SOUNDS (their own style guide):\n${styleGuide.slice(0, 2000)}\n` : ""}

ABSOLUTE CONSTRAINTS — breaking any of these makes the rewrite useless:
- Do NOT change the structure. Same sections, same order, same paragraph breaks, same beats in the same places.
- Do NOT change, add, or remove a single FACT, number, date, name, quote, or claim. This script was fact-checked; you are changing HOW it is said, never WHAT it says.
- Do NOT change the opening beat's function or the final line. If it ends on a quote, it still ends on that quote.
- Keep the length within about 10% of the original.
- Never use these stock narrator tics: "pause on that for a second", "sit with that", "think about what that means", "read that again", "let that sink in", "here's the thing", "that's not a metaphor", or "That's not X. That's Y." They belong to no creator.
- Never use these abstract AI-tell phrases: "boundary condition", "the architecture of the system", "in all the ways that practically mattered", "the ground disappearing underfoot", "a structure built on absence", "designed to hold no visible seam", "the sequence completed itself", "it's worth noting", "at the end of the day". Write the concrete thing instead. And do not lean on one abstract noun (mechanism, architecture, dynamic, framework) repeatedly — vary it.
- Plain speakable prose only. No stage directions, no bracketed markers, no em dashes.

Rewrite for rhythm, diction, sentence length, and address so it sounds like this specific person read it aloud.

SCRIPT:
${fullScript}`,
      }],
    });
    const c = msg.content[0];
    if (c.type !== "text" || !c.text.trim()) return fullScript;
    const rewritten = c.text.trim();
    const newWords = rewritten.split(/\s+/).filter(Boolean).length;
    // A rewrite that lost a third of the script dropped content, not just style.
    if (newWords < words * 0.7) {
      console.error(`[voice] rewrite too short (${newWords} vs ${words}) — keeping original`);
      return fullScript;
    }
    return rewritten;
  } catch (e) {
    console.error("[voice] pass failed, keeping original:", (e as any)?.message);
    return fullScript;
  }
}

async function extendScriptToLength(fullScript: string, targetWords: number, topic: string, niche: string, startedAt: number): Promise<string> {
  const count = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const words = count(fullScript);
  // Backstop at 0.88, not 0.8: a terse voice was landing brew at ~84% of target and slipping under
  // the old 0.8 gate, so it never extended and shipped ~15% short. 0.88 catches that band while
  // leaving a script already within ~12% of target alone (no needless padding pass).
  if (words >= targetWords * 0.88) return fullScript;
  const elapsed = Date.now() - startedAt;
  if (elapsed > 180_000) {
    console.log(`[extend] skipped — ${elapsed}ms elapsed, too close to function limit`);
    return fullScript;
  }
  const needed = targetWords - words;
  const paras = fullScript.split(/\n\n+/);
  const conclusion = paras.length > 2 ? paras.pop()! : "";
  const body = paras.join("\n\n");
  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: "You are extending a YouTube script mid-production. Match the existing voice, pacing, sentence rhythm, and TTS style exactly. Never repeat a point already made. Never fabricate statistics, named studies, or quotes. Output ONLY the new segments as plain text — no preamble, no JSON, no headers, no conclusion.",
    messages: [{ role: "user", content: `Topic: ${topic}\nNiche: ${niche}\n\nScript so far (conclusion removed):\n\n${body}\n\nThis script is ${words} words; the final target is ${targetWords} words. Write approximately ${Math.min(needed, 1500)} words of NEW body segments that will be inserted before the conclusion. Each segment must open with a re-hook (open loop, pattern interrupt, or raised stakes) and go deep: concrete examples, story beats, specific detail. Match the sentence rhythm and paragraph cadence of the script so far exactly: if it uses short punches and fragments, continue that; if it flows in longer paragraphs, continue that. Do NOT write one giant paragraph. Do NOT write any conclusion, callback, or wrap-up. Do NOT repeat existing content.` }],
  });
  const c = response.content[0];
  if (c.type !== "text" || !c.text.trim()) return fullScript;
  return [body, c.text.trim(), conclusion].filter(Boolean).join("\n\n");
}

// UTILIZATION + LENGTH in one pass. The root cause of both the short length and the shallow depth
// was the same: the script used ~10 of ~79 approved facts and stopped short. Generic padding makes
// it longer but not deeper. This reaches the requested length by ELABORATING the UNUSED approved
// facts — each distinctive fact becomes a walked beat — so length and depth rise together, and
// never by inventing (only the supplied facts are fed in). Loops so a large gap (1,000 -> 3,300
// words) is actually closed, not one capped call; time-guarded; inserts before the conclusion.
export function parseFactList(factsBlob: string): string[] {
  return (factsBlob || "")
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-•*]\s*/, "").replace(/\s*\(source:[^)]*\)\s*$/i, "").trim())
    .filter((l) => l.length > 12);
}
// A fact is "used" if a DISTINCTIVE marker of it (a quoted phrase, a 3+ digit number, or a
// multi-word proper noun) already appears in the body. Facts with no distinctive marker are treated
// as used (untrackable), so the pass targets the granular overt-acts facts that carry the depth.
export function factIsUsed(fact: string, bodyLc: string): boolean {
  const has = (m: string) => !!m && bodyLc.includes(m.toLowerCase());
  // Strongest marker first: a quoted phrase.
  const quoted = fact.match(/["“]([^"”]{8,})["”]/);
  if (quoted) return bodyLc.includes(quoted[1].toLowerCase().slice(0, 40));
  // A spelled magnitude ("4 billion", "$12 million") — the digit-only scan misses these.
  const mag = fact.match(/\$?\d+(?:\.\d+)?\s*(?:billion|million|thousand)\b/i);
  if (mag) return has(mag[0]);
  // A distinctive contiguous number ($1.3M, 1,040, 10,000, 661,440) — but NOT a bare year, which is
  // a weak, ubiquitous marker.
  const bignum = [...fact.matchAll(/\$?\d[\d,]{2,}(?:\.\d+)?/g)]
    .map((x) => x[0])
    .find((x) => { const v = parseFloat(x.replace(/[$,]/g, "")); return !(Number.isInteger(v) && v >= 1900 && v <= 2100); });
  if (bignum) return has(bignum) || has(bignum.replace(/[$,]/g, ""));
  // A co-conspirator designation (CC-3).
  const ccn = fact.match(/\bC\.?C\.?-?\s?\d\b/i);
  if (ccn) return has(ccn[0]);
  // A multi-word proper noun (SMH Entertainment).
  const proper = fact.match(/\b[A-Z][a-zA-Z.'’-]+(?:\s+[A-Z][a-zA-Z.'’-]+){1,3}\b/);
  if (proper && !/^(The|A|An|In|On|By|He|She|They|It|His|Her|And|But|For|Of)\b/.test(proper[0])) return has(proper[0]);
  return true; // no distinctive marker to track -> don't chase it
}
// NOVELTY score for the unused-fact pool: pull the highest-value evidence first. A NEW
// transaction/quote/dated-event outranks a generic context line, so the $1.3M trail, the dated
// email, and 88M/$110k get consumed before another soft restatement. This is the new-evidence
// override in ranking form — a fact carrying a fresh number/date/quote/entity scores high even if
// it reads thematically similar to already-covered text.
export function factNoveltyScore(fact: string): number {
  let s = 0;
  if (/["“][^"”]{8,}["”]|\b(email|message|wrote|texted|memo|statement)\b/i.test(fact)) s += 3; // quote / communication
  if (/\btransfer|forfeit|laundered|wired|paid|deposit|\bLLC\b|entity|account\b/i.test(fact)) s += 3; // money movement / entity
  if (/[$£€]\s?\d|\b\d[\d,]{2,}(?:\.\d+)?\b|\b\d+(?:\.\d+)?\s*(?:million|billion|thousand)\b/i.test(fact)) s += 2; // a figure
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d|\b(19|20)\d{2}\b/i.test(fact)) s += 2; // a date/milestone
  if (/\bC\.?C\.?-?\s?\d\b|\b[A-Z][a-zA-Z.'’-]+\s+[A-Z][a-zA-Z.'’-]+\b/.test(fact)) s += 2; // named entity / CC-N
  return s;
}
// BOUNDED refill — never an unbounded word-target-driven loop. Hard caps: at most MAX_REFILL_CALLS
// LLM calls and MAX_REFILL_MS wall-clock (also stops at the shared finalize deadline). Each call is
// ONE ~450-word envelope written from a whole BATCH of assigned unused facts (not iterative 100-word
// top-ups). If the target isn't reached within the budget we return status:"shortfall" — the caller
// marks the pipeline DEGRADED. We do NOT loop chasing the word count; a slightly-short, fully-sourced
// body beats a timed-out request.
const MAX_REFILL_CALLS = 2;
const MAX_REFILL_MS = 70_000;
export const REFILL_RESTORE_WORDS_PER_CALL = 450; // the ~envelope one refill call can rebuild
type RefillResult = { text: string; status: "ok" | "shortfall" };
async function extendWithUnusedFacts(fullScript: string, factsBlob: string, targetWords: number, startedAt: number, deadline: number): Promise<RefillResult> {
  // SHED A CALL WHEN THE ROUTE BUDGET IS NEARLY SPENT: each call is ~35s, so allow the full 2 only
  // when >140s remain; with less, cap at 1 so refill can never push the request past the deadline.
  const maxCalls = (deadline - Date.now()) > 140_000 ? MAX_REFILL_CALLS : 1;
  const count = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const facts = parseFactList(factsBlob);
  const refillStart = Date.now();
  const unusedAtStart = facts.filter((f) => !factIsUsed(f, fullScript.toLowerCase())).length;
  let calls = 0;
  let stoppedBecause = "calls-max";
  let body = fullScript;
  const addedBeats: string[] = []; // the new fact-beats, collected so they can be WOVEN, not tailed
  const report = (status: RefillResult["status"]) => console.log(`[expand] invoked=true parsedFacts=${facts.length} unusedFacts=${unusedAtStart} calls=${calls} stoppedBecause=${stoppedBecause} startWords=${count(fullScript)} finalWords=${count(body)} target=${targetWords} status=${status}`);
  if (facts.length < 3) { stoppedBecause = "too-few-facts"; report("shortfall"); return { text: fullScript, status: "shortfall" }; }
  for (calls = 0; calls < maxCalls; ) {
    const w = count(body);
    if (w >= targetWords * 0.92) { stoppedBecause = "length-reached"; break; }
    if (Date.now() - refillStart > MAX_REFILL_MS) { stoppedBecause = "refill-time-budget"; break; }
    if (deadline - Date.now() < 35_000) { stoppedBecause = "finalize-deadline"; break; }
    const bodyLc = body.toLowerCase();
    // REFILL IS FACT-CONSUMPTION: operate on the UNUSED pool only, highest-novelty first.
    const unused = facts.filter((f) => !factIsUsed(f, bodyLc)).sort((a, b) => factNoveltyScore(b) - factNoveltyScore(a));
    if (!unused.length) { stoppedBecause = "facts-exhausted"; break; } // shortfall over padding
    // Assign a LARGER batch (6-8 facts) so ONE call produces a substantial ~450-500-word envelope:
    // calls were under-producing (~185 words off 3-4 facts), and with a 2-call cap that couldn't
    // rebuild what the cut passes removed. More facts per call = more the model must deliver, so 2
    // calls yield ~800-900 words — enough to restore the length. Still bounded, so it can't pad.
    const deficitFacts = Math.ceil((targetWords - w) / 110);
    const batch = unused.slice(0, Math.min(unused.length, Math.max(6, Math.min(8, deficitFacts))));
    const paras = body.split(/\n\n+/);
    const conclusion = paras.length > 3 ? paras.pop()! : "";
    const mid = paras.join("\n\n");
    const needed = Math.min(520, batch.length * 90);
    try {
      calls++;
      const resp = await getAnthropic().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        temperature: 0.7,
        system: "You are extending a documentary YouTube script mid-production, matching its existing voice and rhythm. Your ONLY job is to CONSUME documented facts: write ONE beat per assigned fact, and each beat must DELIVER that fact — stating its specific figure, date, name or quoted words verbatim so it is unmistakably communicated. You are NOT writing connective narration, scene-setting, or analysis to reach a word count. Never invent: no statistic, name, quote, motive, role, method, or physical detail that is not in the assigned facts. If a fact cannot be delivered without inventing something, SKIP that fact and write fewer words — a shorter, fully-sourced passage is the correct outcome. Output ONLY the new beats as plain speakable prose — no preamble, no headers, no conclusion.",
        messages: [{
          role: "user",
          content: `The script so far (its conclusion is held out and will follow your beats):\n"""\n${mid.slice(-6000)}\n"""\n\nWrite ONE beat for EACH of these approved, not-yet-used facts, in order. Each beat must state that fact's specific figure/date/name/quote verbatim:\n${batch.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\nWRITE ABOUT ${needed} WORDS TOTAL — roughly ${Math.round(needed / Math.max(1, batch.length))} words per beat, which is 2-4 full sentences each: state the fact, then DEEPEN it (what it means in concrete terms, how it connects to the mechanism, who it affected and by how much) using only what the fact and the script already establish. This is a real length target, not a ceiling — deliver all ${batch.length} beats at that depth. Do NOT invent a statistic, name, quote, motive, or role beyond the facts; do NOT restate anything already in the script; do NOT write a conclusion. Depth on the sourced fact is how you reach the length — never filler.`,
        }],
      });
      const c = resp.content[0];
      const seg = c.type === "text" ? c.text.trim() : "";
      if (!seg || count(seg) < 40) { stoppedBecause = "empty-segment"; break; }
      // ENFORCE THE INVARIANT: refill is fact-CONSUMPTION. Reject only clear PADDING — a segment that
      // delivers no new fact, or one so verbose per fact it is mostly narration (> 320 w/fact). We do
      // NOT retry a rejected call (that was the latency sink); a rejected call still counts against the
      // 2-call cap, and we stop, returning shortfall rather than looping.
      const segLc = seg.toLowerCase();
      const consumed = batch.filter((f) => factIsUsed(f, segLc)).length;
      const wordsPerFact = consumed > 0 ? count(seg) / consumed : Infinity;
      if (consumed < 1 || wordsPerFact > 320) {
        stoppedBecause = "padding-rejected";
        console.log(`[extend-facts] call ${calls}: REJECTED padding (+${count(seg)} words, consumed ${consumed}/${batch.length}, ${Math.round(wordsPerFact)} words/fact)`);
        break;
      }
      body = [mid, seg, conclusion].filter(Boolean).join("\n\n");
      addedBeats.push(...seg.split(/\n\n+/).map((p) => p.trim()).filter(Boolean));
      console.log(`[extend-facts] call ${calls}: +${count(seg)} words consuming ${consumed}/${batch.length} facts (${Math.round(wordsPerFact)} w/fact) (${w} -> ${count(body)}, target ${targetWords}, ${unused.length} unused)`);
    } catch (e) {
      stoppedBecause = "llm-error";
      console.error("[extend-facts] failed, keeping current body:", (e as any)?.message);
      break;
    }
  }
  // WEAVE, don't tail. The loop appended the new beats at the end (needed so factIsUsed could track
  // consumption); now relocate each beat next to the existing paragraph it is most topically related
  // to, so the consumed facts read as part of the narrative arc instead of a list bolted on at the
  // end. Deterministic (token overlap) — no rewrite, no new text, so it cannot fabricate.
  if (addedBeats.length) {
    const woven = weaveBeats(fullScript, addedBeats);
    if (woven.split(/\s+/).filter(Boolean).length >= count(fullScript)) body = woven; // never shrink
  }
  // Shortfall = we stopped before reaching the length band (facts ran out, budget blown, padding).
  // It is a real signal (the caller marks DEGRADED), not a failure to return a usable body.
  const status: RefillResult["status"] = count(body) >= targetWords * 0.92 ? "ok" : "shortfall";
  report(status);
  return { text: body, status };
}

// Relocate new beat-paragraphs into an original body at contextual homes: each beat goes right after
// the original paragraph it shares the most distinctive vocabulary with; a beat with no clear home is
// placed before the conclusion (the old tail behavior). No text is added or changed — only order.
export function weaveBeats(originalBody: string, beats: string[]): string {
  // Placement rules (seen live, Jones: six refill paragraphs about the 1995 IRS records, the DMV and the
  // 1986 death declaration piled up inside the May 1979 departure scene, right after "That's all she
  // got."): (1) overlap is measured against the BEAT's own words, so a 3-word paragraph is no magnet,
  // and a home needs 8+ content words; (2) a dated beat only goes where the story's clock fits its
  // year; (3) nothing goes inside the cold open (the flash-forward before the story first goes back).
  const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const contentTokens = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 3));
  const yearOf = (s: string) => { const m = String(s).match(/\b(1[89]\d{2}|20\d{2})\b/); return m ? Number(m[1]) : null; };
  const paras = originalBody.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (paras.length < 2) return [originalBody, ...beats].join("\n\n");
  const conclusion = paras.length > 3 ? paras.pop()! : null; // keep the ending last
  // Cold open: everything before the first paragraph dated EARLIER than one before it, when that
  // happens in the first third of the script.
  let coldEnd = 0;
  { let maxY = -Infinity; for (let i = 0; i < paras.length; i++) { const y = yearOf(paras[i]); if (y === null) continue; if (y < maxY - 1 && i <= Math.ceil(paras.length / 3)) { coldEnd = i; break; } maxY = Math.max(maxY, y); } }
  // The story clock at each paragraph: its own year, else the last year seen (from the cold open's end).
  const clock = (list: string[]) => { let last: number | null = null; return list.map((p, i) => { if (i < coldEnd) return null; const y = yearOf(p); if (y !== null) last = y; return last; }); };
  for (const beat of beats) {
    if (!beat) continue;
    const bt = contentTokens(beat);
    const by = yearOf(beat);
    const clk = clock(paras);
    let bestI = -1, best = 0;
    for (let i = Math.max(0, coldEnd); i < paras.length; i++) {
      const pt = contentTokens(paras[i]);
      if (pt.size < 8 || !bt.size) continue;
      // The clock must fit: this paragraph's time is at or before the beat's year, and the next dated
      // paragraph is not earlier than it.
      if (by !== null) {
        const here = clk[i];
        const nextY = clk.slice(i + 1).find((y) => y !== null && y !== here) ?? null;
        if (here !== null && here > by + 1) continue;
        if (nextY !== null && nextY < by - 1) continue;
      }
      let shared = 0; for (const w of bt) if (pt.has(w)) shared++;
      const o = shared / bt.size;
      if (o > best) { best = o; bestI = i; }
    }
    if (bestI >= 0 && best >= 0.16) paras.splice(bestI + 1, 0, beat);
    else paras.push(beat); // no fitting home -> before the conclusion
  }
  if (conclusion) paras.push(conclusion);
  return paras.join("\n\n");
}

function containsWord(s: unknown, word: string): boolean {
  return typeof s === "string" && s.toLowerCase().includes(word.toLowerCase());
}

// The prompt asks for the magnet word in the title and hook, but the model treats it
// as one soft preference among many constraints and sometimes drops it — so verify
// after generation and repair with a small targeted rewrite instead of regenerating.
async function enforceMagnetWord(script: GeneratedScript, word: string, topic: string): Promise<GeneratedScript> {
  const titleOk = containsWord(script.title, word);
  const hookOk = containsWord(script.hook, word);
  if (titleOk && hookOk) return script;
  const target = titleOk ? "the hook" : hookOk ? "the title" : "both the title and the hook";
  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    system: "You punch up YouTube titles and hooks. Output ONLY valid JSON, no preamble.",
    messages: [{ role: "user", content: `Video topic: ${topic}\nCurrent title: ${script.title}\nCurrent hook: ${script.hook}\n\nRewrite ${target} so each naturally includes the word "${word}". Keep the same meaning, energy, and length. The word must feel inevitable, not forced. The title stays under 65 characters. Never use em dashes. Output JSON: {"title": "...", "hook": "..."}` }],
  });
  const c = response.content[0];
  if (c.type !== "text") return script;
  try {
    const fixed = extractJSON(c.text, "object") as { title?: string; hook?: string };
    if (!titleOk && fixed.title && containsWord(fixed.title, word)) script.title = fixed.title;
    if (!hookOk && fixed.hook && containsWord(fixed.hook, word)) {
      const oldHook = script.hook;
      script.hook = fixed.hook;
      // The body fields open with the hook — swap it there too, or the saved
      // and copied script text would still carry the old hook
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      for (const k of ["fullScript", "script", "body", "content"]) {
        const v = (script as any)[k];
        if (typeof v === "string" && v.trim() && oldHook) {
          const paras = v.split(/\n\n+/);
          if (norm(paras[0] || "") === norm(oldHook)) {
            paras[0] = fixed.hook;
            (script as any)[k] = paras.join("\n\n");
          }
        }
      }
    }
  } catch (e) {
    console.error("[magnet] enforce rewrite unparseable, keeping original title/hook:", e);
  }
  return script;
}

// RECONCILE THE PLACEHOLDER TITLE AGAINST THE RESEARCHED FACTS. The remix titles shown at ideation
// are placeholders written BEFORE research: the time period is a guess and the target pronoun is the
// generic "Them". Once the facts are grounded, rewrite ONLY those two variable slots of the viral
// formula ("After [Time] [Brand] Finally Caught [pronoun]..") to match the evidence — the brand and
// the formula are preserved. Deterministic and conservative: it never INVENTS a number (keeps the
// placeholder when the span isn't clearly established) and only downgrades "Them" when the record
// clearly centers ONE named, charged/convicted person. This becomes both the displayed title AND the
// title handed to the section-writer, so the hook draws its duration from a CORRECT title, killing
// the hook/body contradiction ("for almost four years" vs a correct "roughly seven years") at source.
export function reconcileTitle(title: string, facts: string | undefined): string {
  if (!title || !facts || !facts.trim()) return title;
  let out = title;

  // TIME SLOT — the researched span replaces the guessed one ("4 Years" -> "7 Years"). Only when the
  // span is clearly established (>=2 distinct in-range years); otherwise keep the placeholder.
  const span = researchedYearSpan(facts);
  // A duration the facts themselves state wins over the computed span (seen live, LeFevre: the card's
  // correct "32 Years" became "40" because the span ran from the earliest to the latest year mentioned
  // anywhere in the research). Only an unsupported number gets replaced.
  const NUM_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
  const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const spell = (n: number) => (n <= 20 ? NUM_WORDS[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? `[- ]${NUM_WORDS[n % 10]}` : "") : String(n));
  const titleNum = out.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+Years?\b/i)?.[1];
  const tn = titleNum ? (/^\d+$/.test(titleNum) ? Number(titleNum) : NUM_WORDS.indexOf(titleNum.toLowerCase())) : -1;
  const stated = tn > 0 && new RegExp(`\\b(?:${tn}|${spell(tn)})[- ]years?\\b`, "i").test(facts);
  if (span != null && !stated) {
    out = out.replace(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(\s+Years?\b)/i, `${span}$2`);
  }

  // PRONOUN SLOT — "Caught Them" -> "Caught Him/Her" ONLY when the record clearly centers one named,
  // charged/convicted person. Signal: a charge/conviction verb is present AND gendered pronouns run
  // overwhelmingly one way. If multiple or unnamed, keep the generic "Them".
  const charged = /\b(?:pleaded? guilty|plead(?:ed)? guilty|convicted|indicted|charged|sentenced|arrested|found guilty)\b/i.test(facts);
  if (charged) {
    const male = (facts.match(/\b(?:he|him|his)\b/gi) || []).length;
    const female = (facts.match(/\b(?:she|her|hers)\b/gi) || []).length;
    let pron: string | null = null;
    if (male >= 2 && male > female * 2) pron = "Him";
    else if (female >= 2 && female > male * 2) pron = "Her";
    if (pron) out = out.replace(/\b(Caught|Catch|Get|Got|Nail(?:ed)?|Stop(?:ped)?|Bust(?:ed)?)\s+Them\b/i, `$1 ${pron}`);
  }

  if (out !== title) console.log(`[reconcile-title] "${title}" -> "${out}" (span=${span ?? "kept"})`);
  return out;
}

export async function generateScript(input: ScriptGenerationInput): Promise<GeneratedScript> {
  const startedAt = Date.now();
  const targetWords = input.targetMinutes ? Math.round(input.targetMinutes * 130) : null;
  const lengthGuide = {
    short: "60-90 seconds, 150-200 words",
    medium: "2-3 minutes, 300-400 words",
    long: "4-5 minutes, 600-700 words",
    ultraLong: "5-6 minutes, 700-900 words",
  };

  const hasTranscript = input.sourceTranscript && input.sourceTranscript.trim().length > 10;

  // HOOK FIRST. Written and archetype-validated on its own before the body exists, then
  // handed to the body generation verbatim. Previously the hook field and the script's
  // opening were two independent generations that disagreed with each other — the hook
  // led on a stacked stat while the body restated the title.
  const presetHook = await generateHookFirst({
    title: input.selectedTitle || input.targetTopic || input.sourceTitle || "",
    topic: input.targetTopic || input.sourceTitle || "",
    hookType: input.hookArchetype,
    hookWhyItWorks: input.hookWhyItWorks,
    hookScript: input.hookScript,
    sourceMaterial: input.sourceMaterial,
    voiceProfile: input.voiceProfile,
  });

  const sourceSection = hasTranscript
    ? `REFERENCE TRANSCRIPT TO REVERSE-ENGINEER:
Title: "${input.sourceTitle}"
Niche: ${input.sourceNiche}
Full transcript:
"""
${input.sourceTranscript}
"""

STRUCTURAL REQUIREMENTS — you MUST mirror the reference transcript exactly:
1. Hook style: use the same type of opening (question/story/stat/controversy) and same energy
2. Argument flow: follow the same sequence of ideas — problem → insight → proof → solution → CTA
3. Pacing: match the timing of reveals — where the reference drops the key insight, you drop yours
4. Retention beats: keep the same number of pattern interrupts and reframes in the same positions — but a SPONSOR/AD slot is NOT a content beat. If the reference pauses for a sponsor read (a brand, app, charity, donation match, promo code, "link in the description"), do NOT mirror that slot. Skip it entirely and continue the actual content; fill the position with a real content beat instead.
5. Tone and voice: match the conversational register (casual/authoritative/storytelling)
6. CTA style: mirror how the reference closes and asks for the subscribe/action — but only the subscribe/like ask, never any sponsor or product plug the reference closes with
The content adapts to the new topic — the STRUCTURE is preserved, the WORDS are not.
COPYRIGHT-SAFE — mirror the structure, never the expression: copy the reference's pacing, beat positions, and energy, but NEVER reuse its actual metaphors, analogies, comparisons, opening images, jokes, or signature phrases. Those belong to the original author. Invent your own equally bold, equally screenshot-worthy comparisons from a completely different domain. The viewer should feel the same hook, never read the same lines.`
    : `Write an original, highly engaging script on this topic. No source transcript — create fresh content with a strong hook, clear structure, and compelling CTA.`;

  const userPrompt = `${sourceSection}

${hasTranscript
  ? (input.targetTopic
    ? `Recreate the reference structure above, adapted for this new topic: "${input.targetTopic}"`
    : `Recreate this reference script faithfully — same topic, same niche, same key arguments. Improve only the hook strength, title, section structure, and retention beats. Do NOT change what the video is about.`)
  : `Generate a highly engaging original script about: "${input.targetTopic || "the requested topic"}"`}${input.angle ? `\n\nCREATOR ANGLE (most important — build the entire script around this):\n"${input.angle}"\nDo NOT write a generic overview. Use this angle as the spine. Every section must prove, demonstrate, or build toward this specific perspective.` : ""}
Target niche: ${input.targetNiche}
${presetHook ? `THE HOOK IS ALREADY WRITTEN — USE IT VERBATIM (critical):
The script's opening has been generated and validated separately. Your "hook" field MUST be this text exactly as written, character for character, and the body MUST begin with this same text. Do NOT rewrite it, paraphrase it, shorten it, or "improve" it. It is the single source of truth for how this video opens.

${presetHook}

THE PARAGRAPH AFTER THE HOOK MUST ADVANCE, NOT RECAP. Do not re-explain, restate, or summarise what the hook just said. The hook has landed; move the story forward from there.

` : ""}Video length: ${targetWords ? `${input.targetMinutes} minutes (~${targetWords} words spoken aloud)` : lengthGuide[input.videoLength]}
${targetWords && targetWords >= 1200 ? `
CRITICAL LENGTH REQUIREMENT — scripts shorter than ${targetWords} words are FAILURES:
- Structure the body as ${Math.max(4, Math.ceil((input.targetMinutes || 10) / 3))} distinct segments totaling at least ${targetWords} words.
- SECTIONS ARE NOT EQUAL WEIGHT (critical — this is what separates a flat script from a gripping one). Do NOT give every segment the same length. Pick the ONE most vividly documented scene in the source material (the peak moment the story builds to — a raid, a confrontation, a ritual, the moment of exposure) and TELL THAT ONE SCENE AT LENGTH: roughly THREE TO FOUR TIMES a normal segment, walked through beat by beat, in the fullest sensory and sequential detail the facts support. Everything else — connective setup, transitions, context — stays TIGHT and moves fast. A documentary lives on one scene told in full, not five scenes summarized evenly.
- Structure the arc like the proven framework, not as equal blocks: hook hard, make the central figure physically real early (their build, look, nickname if the facts give one), TEASE the big scene, then jump away from it and build back to it, and finally DELIVER that scene at full length as the climax. The tease-interrupt-payoff of one specific scene is the spine.
- Open every segment with a re-hook: an open loop, a pattern interrupt, or raised stakes.
- Inside every segment, go deep before moving on: one concrete example, one story beat, AND one piece of evidence or specific detail. Never compress or summarize a point you can expand.
- Do NOT begin any conclusion, callback, or wrap-up until the cumulative word count has reached ${targetWords} words.
- A segment is NOT one paragraph. Break every segment into multiple paragraphs. Default to flowing paragraphs of 3-5 sentences like documentary narration, UNLESS a creator voice profile calls for a punchier, more fragmented rhythm, in which case follow the voice (short punches and fragments are fine then).
- A viewer asked for a ${input.targetMinutes}-minute video. Delivering 8 minutes of content is a broken promise.` : ""}
Tone: ${input.tone}
Voiceover delivery: plain spoken prose only — no [PAUSE], [EMPHASIS], or any bracketed markers. Every word must be speakable.
${input.noCta
  ? `NO CTA AT ALL: the creator turned the CTA off for this script. Write NO call to action of any kind — no subscribe, like, comment, share, follow, "apply this", or related-video ask, and no "there's more where this came from" tease. End on the final narrative line. Leave the "cta" field an empty string.`
  : input.companionCta
  ? `COMPANION VIDEO CTA: End the script with a brief, natural call to action that points viewers to a RELATED video on this channel, phrased so it is true whether the creator places it on the end screen or in the description — e.g. "that video is either above this one right now or linked in the description." Keep the reference GENERAL — do NOT invent a specific title or topic for that video.`
  : `NO COMPANION VIDEO: The creator may not have a related video to point to. Do NOT reference, tease, or claim that another video exists on this channel — no "watch my other video", "the next video is already waiting", "the video right after this", "above this one", or "linked in the description". Close instead with only a subscribe / comment / apply-this-now style CTA.`}
${input.voiceProfile ? `
CREATOR VOICE PROFILE — this creator's audience knows their voice; the script must sound like THEM, not like a generic narrator. Follow this profile for rhythm, diction, energy, humor, address, transitions, and CTA style. It overrides the generic Tone setting AND the default paragraph/sentence-rhythm formatting above: match THIS creator's sentence length, fragments, pacing, and pattern interrupts even if that means short punches and choppy lines. Sounding like this creator is the priority. THE PROFILE'S "NEVER-DOES" LIST IS ABSOLUTE and outranks every generic craft rule in this prompt, including the explainer-form defaults: if it says this creator never addresses the viewer as "you", never opens on a rhetorical question, or never editorializes, then your script does not do those things either, no matter what a general rule above recommends. Negative space is what makes a voice recognisable. It NEVER overrides the banned-phrases list, the anti-fabrication rule, the no-sponsor rule, or the voiceover-only rule (plain speakable prose, no bracketed markers).
STYLE, NOT SUBJECT (the firewall — critical): borrow the creator's WRITING MECHANICS only — their rhythm, narrative shape (opening move, transitions, tension pattern, section endings, callbacks), metaphor behavior, vocabulary, humor level, and point of view. Do NOT borrow their usual TOPICS, and do NOT bend THIS video's subject toward the kind of thing that creator normally covers. The topic, the facts, and the angle are fixed by the research above and do not change because of the voice: a science channel's voice on a true-crime case still tells the true-crime case (told with that channel's mechanics), it does not drift into a science explainer, and it invents no content to fit the style. The voice controls HOW the story is told, never WHAT is true. A creator whose lens is psychology/behavior may FRAME the subject through motive and decision-making, but every such claim still comes only from the sourced facts and obeys the certainty rules — a behavioral lens is not license to diagnose or infer a motive the record does not support. THE STRONGER THE VOICE MATCH, THE HARDER THIS HOLDS: a confident, explanatory, or authoritative voice makes a manufactured explanation SOUND true, which is exactly when inference gets smuggled in as fact. Matching a voice governs HOW something is said; it is NEVER permission to assert an unestablished WHY. If the record does not give the reason, the voice states it as inference ("one likely reason", "possibly", "the record does not say why") or not at all — however satisfying a clean explanation would sound in that creator's style.
APPLY BY STRENGTH, DO NOT TURN A TRAIT INTO A TIC: apply the profile's DOMINANT traits heavily and its OCCASIONAL traits only where they fit; match the creator's real FREQUENCY for each. Finding one distinctive trait (a fragment habit, a catchphrase, a metaphor type) and repeating it on every line is NOT matching the voice — it is a machine-made tic and a failure. Reproduce the interaction of the traits at natural density, not one trait cranked to maximum.

${input.voiceProfile}

WHAT THE VOICE PROFILE GOVERNS, AND WHAT IT DOES NOT (read carefully — this is the most misread part of the whole prompt):
- It governs HOW the script SOUNDS: sentence rhythm, fragment use, diction, energy, humor, person and address, transitions, and everything in its never-does list.
- It does NOT govern WHAT the video is about, its genre, its subject matter, or its structure. A creator's voice is portable — you can write a true-crime story in a science channel's voice, or an explainer in a documentary channel's voice. When a source video's structure or a topic's form has been supplied above, THAT decides the running order, the section weighting, the hook archetype and the beats; the voice profile only decides how those sections read on the page. Never let a voice profile pull the script back toward the subject matter or the format of the channel it was measured from.

CTA — THE PROFILE DESCRIBES A STYLE, NOT ASSETS THIS CREATOR HAS (critical, this is a fabrication risk):
A profile's "CTA style" is an observation about the channel it was measured from — "products woven into the narrative", "Patreon and Discord acknowledgment mid-video", "merch mentioned in the outro". Those belong to THAT channel. The creator writing THIS script may have no product, no Patreon, no Discord, no sponsor, and no merch.
So: NEVER invent, reference, thank, or weave in a sponsor, product, Patreon, Discord, membership, newsletter, course, merch line, or community that has not been explicitly supplied to you. Do not write a dedication to patrons. Do not name a brand. Do not imply the creator sells anything.
Take only the MANNER from the profile's CTA style — how gently or bluntly they ask, where they place it, how it is phrased — and apply that manner to the CTA this script is actually configured to make (a subscribe/comment ask, or the companion-video ask when one is enabled). If the profile's CTA style depends on an asset that has not been supplied, ignore that part of the profile entirely rather than inventing the asset.

VOICE-DRIVEN HOOK: If this voice profile favors metaphors, analogies, vivid sensory comparisons, or a signature opening move, PREFER opening in that style — it's the channel's signature and makes the opening punchier and more catchy. Keep it fresh and specific (never a cliché), and still obey the hook anti-patterns and fact rules. Precedence, which depends on whether a hook archetype was specified above:
- A HOOK ARCHETYPE WAS SPECIFIED (this is a remix of a source video, or the creator picked a hook angle): that archetype is a STRUCTURAL decision and wins. Open in that archetype, and let the voice profile shape the WORDING of it — a stat hook written in this creator's rhythm and diction is the goal, not a different hook type.
- NO HOOK ARCHETYPE WAS SPECIFIED (a from-scratch topic): there is nothing to defer to, so the voice profile's own opening move IS the primary guide. Use this creator's signature opening — their metaphor, their cold scene, their bold claim — rather than defaulting to a generic hook.
` : ""}
${buildStorytellingBlock(input.storytellingMode, input.storytellingTechniques)}
${input.sourceMaterial ? `
VERIFIED SOURCE MATERIAL (provided by the creator). Treat this as the ONLY permitted source of hard specifics for this script.

USE IT (required): Build the script's factual backbone on these facts. Weave SEVERAL of them in naturally, in the script's own voice (never copy verbatim). A grounded script must visibly USE the material it was given — do not write around it and ignore it.

HARD RULE — NO OUTSIDE SPECIFICS: When source material is provided, EVERY specific in the script must come from this material. Being confident a detail is true is NOT sufficient, and a half-remembered version of a real detail is worse than no detail, because it is wrong in a way that sounds researched. This covers ALL of the following, not just numbers:
- Figures: statistics, percentages, amounts, dollar figures, sentence lengths, counts, durations.
- Dates: exact days, months, or years, including "on January 26th" style precision.
- People and places: names, ages, job titles, employers, neighbourhoods, cities, institutions, family details, relationships, how someone got a job.
- Documents and proceedings: indictment counts, charges, court dates, verdicts, named reports or programs.
- Motives and causes: why someone acted, what they believed, what they had read or seen, and any because-of chain of events.

DATES AND NUMBERS, THE MODEL'S WEAK SPOT (read this twice): you recall famous names well but reconstruct exact dates and figures unreliably, producing something that merely looks right. So: never write a day-level date (e.g. "March 6, 1980") unless that exact date is in the material. If the material gives only a year, write only the year ("in 1980"), never a made-up day or month. The same holds for dollar amounts, sentence lengths, counts, and ages. And CHECK YOUR OWN ARITHMETIC: any dates and durations you state must agree with each other (an escape date and a "nineteen months later" recapture must actually be nineteen months apart). A script that contradicts itself two paragraphs apart is the fastest way to lose a viewer's trust.

BEFORE you write any specific of any kind, check that it appears in the material below. If it does not, you have two honest options: write the sentence without it, or say plainly that the record does not establish it. You may NOT substitute a vaguer version of the same claim, and you may NOT reach for "research suggests", "studies have shown", "experts estimate", "by some accounts", or "reportedly" to smuggle in something unsourced. Those phrases assert that evidence exists, which is itself an unsourced factual claim, and they are what makes a script go soft and evasive in its final third.

Where the material is thin, say so directly and make that the point. "The public accounting stops at what prosecutors had to prove" is strong, specific, and true. "By some accounts he may have been motivated by ideology" is a hedge doing the work a fact should do.

Never invent a number, never attach a figure to this material that isn't in it, and never copy long passages verbatim — restate in the script's own voice.

CLAIM INTEGRITY (critical): A fact may ONLY support what it directly states. Do NOT use a fact as evidence for a larger, different, or speculative claim it doesn't establish — e.g. do NOT use "the Navy tests SEALs for steroids" to imply "there is a hidden cognitive super-drug," and do NOT present a citation as proof of a cover-up, conspiracy, or mechanism the source never mentions. If the chosen angle reaches beyond what the source material actually supports, keep those reaches clearly hedged as opinion/speculation ("some believe", "it's possible") and NEVER imply the cited sources prove them. The viewer must be able to click any source and find it genuinely backs the claim it's next to.

SOURCE MATERIAL:
"""
${input.sourceMaterial.slice(0, 6000)}
"""
` : ""}

${input.nicheFrameworks ? `
PROVEN VIRAL FRAMEWORKS FROM THIS NICHE — extracted from real high-performing videos in this exact niche. Model this script's structure, pacing, hook placement, and retention mechanics on these patterns. Adapt the MECHANICS to the new topic; never copy the content or wording:

${input.nicheFrameworks}
` : ""}

${input.nicheTitleFormulas ? `
PROVEN TITLES FROM THIS NICHE — real titles that earned views in this exact niche, with the reusable formula each implies. Model the "title" field on the strongest of these: borrow the formula and structure, never the wording or subject. Adapt to THIS topic:
${input.nicheTitleFormulas}
` : ""}
${input.selectedTitle ? `
TITLE — LOCKED (this overrides the TITLE RULES below): The creator already chose this exact title for the video. The "title" field MUST be this title, output essentially as-is. Do NOT invent, rewrite, or substitute a different title. Only minor cleanup is allowed (capitalization, a stray word, length trim); if a Viral Magnet word is required, weave it in WITHOUT changing the title's meaning or structure. Build the whole script to deliver on this exact title:
"${input.selectedTitle}"
` : `
TITLE RULES — the generated "title" field MUST follow these viral patterns. Study these real titles that got 3M–10M+ views:`}

PATTERN 1 — BOLD DECLARATION (2–6 words, strong verb or adjective):
"AI Slop Is Destroying The Internet" · "Pregnancy is Insane" · "Alcohol is AMAZING" · "Trees Are So Weird" · "GERMANY IS OVER"
→ Subject + strong verb/adjective. Short. Makes a claim. One word carries all the weight.

PATTERN 2 — "ACTUALLY" (challenges what viewer already believes):
"Ozzy Osbourne Is Actually the GREATEST Frontman Ever" · "The Uncomfortable Truth About Ozempic"
→ "Actually" signals the viewer has been wrong. Instantly creates tension.

PATTERN 3 — DIRECT ADDRESS (You / Your / We):
"You're More Stressed Than Ever - Let's Change That" · "You Need To Quit Weed." · "We Found a Loophole to Survive the End of the Universe"
→ Names their specific situation. Full stop = conviction. "We" = community discovery.

PATTERN 4 — SUPERLATIVE + STAKES:
"This Is the Scariest Place in The Universe" · "The Dumbest Animal Alive" · "Can Humanity Stop A Planet-Killing Asteroid?"
→ THE (not A). Civilization-scale or deeply personal stakes.

PATTERN 5 — TWO UNEXPECTED THINGS COLLIDING:
"How Nuclear Flies Protect You from Flesh-Eating Parasites" · "Let's Kill You a Billion Times to Make You Immortal"
→ Bizarre juxtaposition forces a click.

HARD RULES:
- Under 65 characters
- ONE strong emotional word (Insane, Scariest, Actually, Destroying, Worst, Hidden, Dead, Real, Weird, Truth, Wrong)
- NEVER start with: "How to use", "The best", "Complete guide", "Top 10", "Everything you need to know"
- No listicles. No colons splitting two weak halves.
- Must directly reflect the script content — no misleading clickbait
- Must fail the "generic test" — cannot work for a different video with only the topic swapped
- Sound like a human said it out loud

BAD → GOOD examples:
❌ "How to Use AI for YouTube Scripts" → ✅ "AI Scripts Are Actually Destroying Channels"
❌ "The Best Script Generator for Creators" → ✅ "Why Your Scripts Stop Working (Most Creators Miss This)"
❌ "YouTube Script Writing Explained" → ✅ "The Real Reason Nobody Watches Your Videos"
${input.viralMagnetWord ? `
VIRAL MAGNET REQUIREMENT: The title field MUST naturally incorporate the word "${input.viralMagnetWord}". The hook field MUST also include the word "${input.viralMagnetWord}" within its first two sentences. Weave it in where it creates maximum curiosity or urgency — not forced, but inevitable.` : ""}

${input.nicheHookExamples ? `
PROVEN HOOKS FROM THIS NICHE — real opening lines that earned views or that creators chose to keep. Model the "hook" field on the strongest of these: match their tension, specificity, and opening move. NEVER reuse their wording, names, or numbers — only their mechanics:
${input.nicheHookExamples}
` : ""}
THE HOOK SHOULD OVERSELL — go aggressive. The opening's job is to win the click and stop the scroll, so maximize curiosity, boldness, and stakes: the biggest, most surprising, most provocative framing the topic can honestly carry. The BODY then sustains attention and delivers on that promise. "Oversell" means bold framing and high curiosity — it does NOT mean asserting a fabricated fact as proven. The hook may promise big and tease hard, but any hard specific (number, stat, study, named person) still follows the fact rules above. Be punchy, never timid.

HOOK RULES — the "hook" field MUST use one of these proven patterns. Pick the one that fits the topic best:
${HOOK_TYPES_PROMPT}

HOOK ANTI-PATTERNS — NEVER start the hook with any of these:
❌ "What if I told you..." ❌ "In this video..." ❌ "Today we're going to..." ❌ "Welcome back..." ❌ "Hey guys..." ❌ "In today's video..."
The hook must feel like the video is ALREADY IN PROGRESS — no preamble, no host intro, straight to the tension.

Output JSON with this exact structure:
{
  "title": "string",
  "hook": "string — the opening 5-10 seconds",
  "sections": [
    {
      "id": "string",
      "type": "hook|intro|point|story|transition|cta|outro",
      "title": "string",
      "content": "string — the full text for this section",
      "duration": number — estimated seconds,
      "retentionBeat": boolean,
      "notes": "string — why this section works"
    }
  ],
  "cta": "string",
  "fullScript": "string — the complete script with all sections combined",
  "wordCount": number,
  "estimatedDuration": number — total seconds,
  "ttsTimings": [
    {
      "afterLine": number,
      "pauseMs": number,
      "emphasis": "normal|strong|whisper"
    }
  ]
}`;

  // 16000, not 8000: long scripts are written twice in the JSON (sections + fullScript),
  // so a 2600-word script needs ~7500+ output tokens and truncates the JSON mid-string at 8000.
  // 16K is the non-streaming-safe ceiling for the SDK.
  // Director's note: creator guidance on HOW to tell it. Placed last so it is the
  // final instruction the model reads, but explicitly subordinate to accuracy.
  const directorNoteBlock = input.directorNote && input.directorNote.trim()
    ? `

DIRECTOR'S NOTES from the creator (shape the TELLING, never the truth): ${input.directorNote.trim().slice(0, 600)}
Follow these for casting, staging, tone, pacing, and where to aim the climax. They do NOT override any accuracy rule: never assert as fact anything the source material does not support, no matter what the note asks. If a note conflicts with the facts, honor the facts and apply the note only where it does not.

CLOSING-LINE DIRECTIVE (obey exactly when a note names a final line, quote, or beat): that line is the LAST thing in the script. Use it EXACTLY ONCE, at the very end — never earlier as well, because using your best line twice halves it. After it, write NOTHING: no reflection, no explanation of what it meant, no summary, no "that is what this work looks like", no restating the thesis. A great closing line explains itself, and every sentence after it is weaker than it. The CTA (if any) follows only as the separate outro field, never as narration continuing past the closing line.

ANGLE OUTRANKS A CONFLICTING NOTE: if a note aims the climax at a moment that is NOT the peak of the chosen angle, the ANGLE wins. The peak of the story you were asked to tell is the climax; a note pointing elsewhere is applied only where it does not fight the angle.`
    : "";
  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    system: buildSystemPrompt({ softCta: !!input.softCta, noCta: !!input.noCta, sourceVerdict: input.sourceVerdict, topicKind: input.topicKind }),
    messages: [{ role: "user", content: userPrompt + directorNoteBlock }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }
  if (response.stop_reason === "max_tokens") {
    console.error(`[generate] output hit max_tokens — JSON likely truncated (targetWords=${targetWords})`);
  }

  let script: GeneratedScript;
  try {
    script = extractJSON(content.text, "object") as GeneratedScript;
  } catch (e) {
    if (response.stop_reason === "max_tokens") {
      throw new Error("The script came out longer than expected and was cut off. Please try again — if it keeps happening, try a slightly shorter video length.");
    }
    // The model FINISHED — we have the words. A parse failure is a formatting problem
    // in the metadata layer, and it must never cost the user a completed generation.
    // Most of these are one unescaped quote inside a long prose value, which gets more
    // likely the more verbatim quotes we ask for. Repair, then salvage.
    const repaired = repairScriptJSON(content.text);
    if (repaired) {
      console.error("[generate] JSON repair recovered the script after:", (e as any)?.message);
      script = repaired as GeneratedScript;
    } else {
      const salvaged = salvageScriptText(content.text);
      if (salvaged) {
        console.error("[generate] JSON unparseable; salvaged raw prose after:", (e as any)?.message);
        script = salvaged as GeneratedScript;
      } else {
        throw new Error("The script was written but came back in a format we couldn't read. Please generate again.");
      }
    }
  }

  if (input.viralMagnetWord) {
    try {
      script = await enforceMagnetWord(script, input.viralMagnetWord, input.targetTopic || input.sourceTitle || "");
      console.log(`[magnet] word="${input.viralMagnetWord}" inTitle=${containsWord(script.title, input.viralMagnetWord)} inHook=${containsWord(script.hook, input.viralMagnetWord)}`);
    } catch (e) {
      console.error("[magnet] enforce failed, keeping original title/hook:", e);
    }
  }

  // Long-form scripts: JSON output caps prose length, so extend via continuation passes.
  // The model names the body field inconsistently — find whichever one it used.
  const bodyKey = ["fullScript", "script", "body", "content"].find(
    (k) => typeof (script as any)[k] === "string" && (script as any)[k].trim().length > 0
  );
  // SECTION-BY-SECTION takes precedence over the continuation pass when we have a real
  // plan measured from the source. Each section is written against its own function,
  // beats and word budget, which is what turns the extracted structure into a template
  // instead of a suggestion — and it makes length arithmetic rather than hope, so the
  // one-blob overrun stops happening.
  let sectionsWritten = false;
  if (input.sectionPlan?.length && targetWords && bodyKey) {
    try {
      const built = await generateBySections(input.sectionPlan, {
        topic: input.targetTopic || input.sourceTitle || "",
        title: (script as any).title || input.selectedTitle || input.targetTopic || "",
        sourceMaterial: input.sourceMaterial,
        recipe: input.remixRecipe,
        voice: input.voiceProfile,
      }, startedAt);
      if (built) {
        const before = (script as any)[bodyKey].split(/\s+/).filter(Boolean).length;
        (script as any)[bodyKey] = built.body;
        (script as any).sections = built.sections;
        (script as any).sectionwise = true;
        sectionsWritten = true;
        console.log(`[sections] wrote ${built.sections.length} sections, ${built.body.split(/\s+/).length} words (was ${before}, target ${targetWords})`);
      }
    } catch (e) {
      console.error("[sections] failed, keeping single-pass script:", e);
    }
  }

  // Length backstop moved into finalizeScript, so it covers ALL paths in one place — the one-shot
  // blob, the one-shot section build, and the chunked build. (Before, it lived here and ran only
  // when sections were NOT written, so a section build that came in short — a terse voice
  // compressing every section — had no extend backstop at all. That was the brew-length miss.)
  void sectionsWritten;

  // The generation TAIL — every silent-fix + safety pass — lives in finalizeScript, so it is
  // shared by construction between the one-shot path (here) and the chunked path (the route's
  // mode:"finalize"). If a pass moves, both paths get it; neither can silently skip one.
  return finalizeScript(script, input, { startedAt, presetHook });
}

// FINALIZE — the whole generation tail, run on an already-assembled body. Called by
// generateScript (one-shot) AND by the chunked mode:"finalize" (client looped the sections, then
// hands the assembled whole here). MUST run every silent-fix + safety pass on the WHOLE script:
// voice pass, deterministic tic strip, format repair, hook rewrite + re-stamp, guarded ending
// rewrite, anaphora guard, stripInsinuations (person-guilt cut), stripImpliedRevelation (trailing
// cliffhanger cut), and the _autoCuts internal record. Some passes are inherently whole-script
// (hook/callback, anaphora, insinuation, cliffhanger), which is exactly why they run HERE, after
// assembly, never per-section.
export async function finalizeScript(
  script: GeneratedScript,
  input: ScriptGenerationInput,
  opts: { startedAt: number; presetHook: string | null },
): Promise<GeneratedScript> {
  const { startedAt, presetHook } = opts;
  // EVIDENCE-INTEGRITY TRACE (benchmark only): when the caller passes input.__trace, snapshot the body between
  // passes so each unsupported claim can be traced to the step that created it. A no-op in the app.
  const __trace = (stage: string) => { try { const fn = (input as any).__trace; if (typeof fn !== "function") return; const k = ["fullScript", "script", "body", "content"].find((x) => typeof (script as any)[x] === "string" && (script as any)[x].trim()); fn(stage, k ? (script as any)[k] : ""); } catch { /* tracing never affects the script */ } };
  __trace("finalize_in");

  // PIPELINE STATUS + GLOBAL DEADLINE CIRCUIT-BREAKER. The route budget is 300s; we hold a hard
  // internal deadline 30s under it and, before every expensive LLM stage, check whether the stage's
  // minimum run time still fits. If it doesn't, we SKIP that stage and mark the pipeline DEGRADED —
  // a script missing one polish stage beats a lost request. Any stage that fails (e.g. an unparseable
  // JSON reply) also marks DEGRADED and logs LOUDLY; a stage NEVER fails into a silent SUCCESS.
  // Measured from ROUTE start when the caller provides it (the one-shot path spends ~70-80s writing
  // sections BEFORE finalize, and a finalize-scoped deadline let the whole request drift to ~292s).
  // 255s from route start leaves a 45s hard margin under the 300s cap.
  const routeStart = input.routeStartedAt && input.routeStartedAt > 0 ? input.routeStartedAt : startedAt;
  const DEADLINE = routeStart + 255_000;
  const pipeline: { status: "SUCCESS" | "DEGRADED"; skipped: string[]; failed: string[] } = {
    status: "SUCCESS", skipped: [], failed: [],
  };
  (script as any)._pipeline = pipeline;
  const markDegraded = (kind: "skipped" | "failed", stage: string, reason: string) => {
    pipeline.status = "DEGRADED";
    pipeline[kind].push(stage);
    console.error(`FINALIZE_DEGRADED stage=${stage} kind=${kind} reason=${reason}`);
  };
  // Returns true (and marks DEGRADED skipped) when `stageMinMs` no longer fits before the deadline.
  const budgetBlown = (stage: string, stageMinMs: number): boolean => {
    const remaining = DEADLINE - Date.now();
    if (remaining < stageMinMs) {
      markDegraded("skipped", stage, `deadline: ${Math.round(remaining / 1000)}s left < ${Math.round(stageMinMs / 1000)}s min`);
      return true;
    }
    return false;
  };

  // Reconcile the displayed title against the researched facts (idempotent — the plan/section paths
  // already reconciled, but the one-shot path and the stored title land here). Compute the scheme's
  // researched span once, for the body-duration backstop below.
  if (typeof (script as any).title === "string" && (script as any).title.trim()) {
    (script as any).title = reconcileTitle((script as any).title, input.sourceMaterial);
  }
  const researchedSpan = researchedYearSpan(input.sourceMaterial);
  const subjectName = primarySubjectName(input.sourceMaterial); // exempt from the person-id guard

  const bodyKey = ["fullScript", "script", "body", "content"].find(
    (k) => typeof (script as any)[k] === "string" && (script as any)[k].trim().length > 0,
  );

  // NOTE: the length RE-FILL runs at the very END of finalize, AFTER the reduction passes — never
  // here. The instrumented run proved the script generates at full length, and the refine + safety
  // cuts then remove ~60%; a backstop placed before those cuts sees full length and no-ops, leaving
  // the gutted result with nothing to re-fill it. So expansion is the LAST step (see bottom).

  // ONE SOURCE OF TRUTH for the opening. The prompt asks for the preset hook verbatim;
  // this guarantees it, and guarantees the body actually STARTS with it — the exact
  // mismatch a user could see (hook field said one thing, script opened with another).
  if (presetHook) {
    (script as any).hook = presetHook;
    const bk = ["fullScript", "script", "body", "content"].find(
      (k) => typeof (script as any)[k] === "string" && (script as any)[k].trim().length > 0
    );
    if (bk) {
      const body = (script as any)[bk] as string;
      const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
      const first = norm(presetHook).split(" ").slice(0, 8).join(" ");
      if (first && !norm(body).startsWith(first)) {
        (script as any)[bk] = `${presetHook}\n\n${body}`;
      }
    }
  }

  // Carry the voice's NEVER-DOES rules back to the client so the compliance panel can
  // stand down the generic checks they override — otherwise a correctly-voiced script
  // (Fern never says "you") gets marked wrong by a rule its own voice forbids.
  if (input.voiceProfile) {
    (script as any).voiceProhibitions = readProhibitions(input.voiceProfile);
  }

  // VOICE PASS — runs LAST, after the content and length are settled, so the rewrite has
  // nothing to trade voice against. Structure and facts are locked; only the prose moves.
  if (input.voiceProfile && bodyKey) {
    try {
      const before = (script as any)[bodyKey];
      const brief = input.voiceFingerprint
        ? fingerprintToBrief(input.voiceFingerprint, input.voiceName)
        : "Match this creator's rhythm, sentence length, diction and way of addressing the viewer.";
      const after = await applyVoicePass(before, brief, input.voiceProfile, startedAt);
      if (after && after !== before) {
        (script as any)[bodyKey] = after;
        (script as any).voicePassApplied = true;
        console.log(`[voice] pass applied (${before.split(/\s+/).length} -> ${after.split(/\s+/).length} words)`);
      }
    } catch (e) {
      console.error("[voice] pass errored, keeping original:", e);
    }
  }

  // DETERMINISTIC TIC STRIP — runs UNCONDITIONALLY, so the stock narrator tics can never
  // ship even when the LLM voice pass was skipped for budget. This is the guaranteed half
  // of the voice fix; the LLM pass is the aspirational half.
  for (const k of ["fullScript", "script", "body", "content", "hook", "outro"]) {
    if (typeof (script as any)[k] === "string") (script as any)[k] = stripStandaloneTics((script as any)[k]);
  }
  if (Array.isArray((script as any).sections)) {
    (script as any).sections = (script as any).sections.map((s: any) =>
      s && typeof s.content === "string" ? { ...s, content: stripStandaloneTics(s.content) } : s
    );
  }

  // Final formatting repair: rejoin any paragraph break that landed mid-sentence
  // (after "U.S.", "Mr.", or a torn clause). Runs last so it also covers text a
  // continuation pass appended.
  for (const k of ["fullScript", "script", "body", "content", "hook", "outro"]) {
    if (typeof (script as any)[k] === "string") (script as any)[k] = healMidSentenceBreaks((script as any)[k]);
  }
  if (Array.isArray((script as any).sections)) {
    (script as any).sections = (script as any).sections.map((s: any) =>
      s && typeof s.content === "string" ? { ...s, content: healMidSentenceBreaks(s.content) } : s
    );
  }

  // HOOK RE-STAMP (runs LAST, after every pass). The section writer, voice pass, and tic
  // strip can each quietly paraphrase the opening, so the displayed hook and the script's
  // first line drift apart — a visible bug the hook-matches-script check flags. Overwrite
  // the body's opening sentence(s) with the hook verbatim, making the guarantee
  // deterministic instead of hoped for.
  let hookText = typeof (script as any).hook === "string" ? (script as any).hook.trim() : "";

  // MOVE #9 fix #2 — GUARDED hook rewrite (runs BEFORE the re-stamp so a rewrite is synced into
  // the body). Fires when the hook is vague OR fact-dumps the payoff; accepts the rewrite ONLY if
  // it is usable AND genuinely WITHHOLDS (does not itself dump the mechanism/figure), else keeps
  // the original. So it can only replace a failing hook with a withholding one — never regress.
  // Detect on the EFFECTIVE OPENER (the hook field PLUS the body's first sentences), because a
  // dump ("running on bots and AI") often lands in the opening body, not the short hook field.
  const bodyKeyEarly = ["fullScript", "script", "body", "content"].find((k) => typeof (script as any)[k] === "string" && (script as any)[k].trim());
  const bodyOpener = bodyKeyEarly ? ((script as any)[bodyKeyEarly] as string).trim().split(/(?<=[.!?])\s/).slice(0, 3).join(" ") : "";
  const openerText = [hookText, bodyOpener].filter(Boolean).join(" ");
  // The creator CHOSE a hook archetype. A stat/data/curiosity/controversy hook is SUPPOSED to lead
  // with the number, so the money-dump trigger must not fire for it — otherwise a correct number-led
  // hook gets flagged and homogenized into the paradox rewrite (why every hook came back "Imagine…").
  const numberLedArchetype = /stat|data|number|controvers|curiosity/i.test(input.hookArchetype || "");
  if (hookText && (hookIsVague(openerText) || hookDumpsPayoff(openerText, { allowMoney: numberLedArchetype }))) {
    const rewritten = await rewriteVagueHook(hookText, input.sourceMaterial, input.voiceProfile, startedAt, input.hookArchetype);
    const withholds = isUsableRewrite(rewritten, 60) && !hookDumpsPayoff((rewritten as string).trim(), { allowMoney: numberLedArchetype });
    const chosen = withholds ? (rewritten as string).trim() : hookText;
    if (chosen !== hookText) { hookText = chosen; (script as any).hook = chosen; }
  }

  if (hookText) {
    for (const k of ["fullScript", "script", "body", "content"]) {
      const cur = (script as any)[k];
      if (typeof cur === "string" && cur.trim()) (script as any)[k] = restampHook(cur, hookText);
    }
    if (Array.isArray((script as any).sections) && (script as any).sections.length) {
      const s0 = (script as any).sections[0];
      if (s0 && typeof s0.content === "string" && s0.content.trim()) {
        (script as any).sections[0] = { ...s0, content: restampHook(s0.content, hookText) };
      }
    }
  }

  // MOVE #9 fix #2 — GUARDED ending rewrite. Fires ONLY when the ending teases without landing
  // on a sourced fact; keeps the original on any failure. Rewrites just the final paragraph.
  const bodyKey2 = ["fullScript", "script", "body", "content"].find((k) => typeof (script as any)[k] === "string" && (script as any)[k].trim());
  if (bodyKey2) {
    const body = (script as any)[bodyKey2] as string;
    const paras = body.split(/\n\n+/);
    const lastPara = paras[paras.length - 1] || "";
    if (lastPara && endingTeasesWithoutLanding(lastPara)) {
      const rewritten = await rewriteTeasingEnding(lastPara, hookText, input.sourceMaterial, startedAt);
      const chosen = chooseRewrite(lastPara, rewritten, 60);
      if (chosen !== lastPara) {
        paras[paras.length - 1] = chosen;
        (script as any)[bodyKey2] = paras.join("\n\n");
      }
    }

    // MOVE #9 fix #2(3) — ANAPHORA GUARD. Reword paragraphs that open by restating the same
    // figure/line as an earlier section (the "Ten thousand accounts…" drumbeat). Capped at 2
    // rewrites, each guarded with a fallback to the original paragraph.
    const paras2 = ((script as any)[bodyKey2] as string).split(/\n\n+/);
    const repeats = repeatedOpeners(paras2).slice(0, 2);
    let changed = false;
    for (const idx of repeats) {
      const rewritten = await rewriteRepeatedOpener(paras2[idx], startedAt);
      const chosen = chooseRewrite(paras2[idx], rewritten, 400);
      if (chosen !== paras2[idx]) { paras2[idx] = chosen; changed = true; }
    }
    if (changed) (script as any)[bodyKey2] = paras2.join("\n\n");
  }

  // SEMANTIC REFINE PASS — the one place deterministic-first flips to model judgment. Two problems
  // survived every regex/overlap attempt because they are about MEANING, not pattern: a theme
  // restated 3+ times with fresh wording each time (the overlap heuristic can't see "provided the
  // cover of legitimacy" == "knows how to package an artist"), and inference-as-fact ("the publicist
  // provided cover", "whether they cooperated") phrased outside any fixed pattern. One targeted LLM
  // pass, on the assembled body, judges by meaning: collapse a repeated point to its 1-2 best
  // instances, and cut/hedge any role/motive/cooperation the FACTS don't establish. Reduction-only
  // (never adds), guarded, graceful fallback — the deterministic cuts below still backstop it.
  __trace("before_refine");
  const refineKey = ["fullScript", "script", "body", "content"].find((k) => typeof (script as any)[k] === "string" && (script as any)[k].trim());
  if (refineKey && input.sourceMaterial && input.sourceMaterial.trim() && !budgetBlown("refine", 45_000)) {
    const before = (script as any)[refineKey] as string;
    const refined = await refineAssembledBody(before, input.sourceMaterial, startedAt);
    if (refined && refined !== before) {
      for (const k of ["fullScript", "script", "body", "content"]) {
        if (typeof (script as any)[k] === "string") (script as any)[k] = refined;
      }
      (script as any).semanticRefined = true;
    }
  }

  __trace("after_refine");
  // GOVERNING PRINCIPLE — SILENT SAFETY CUT (runs last). Person-guilt insinuation is a defamation
  // risk, so it is CUT silently before the script is returned — no panel, no flag. A cut is the
  // safe default (removing a sentence can't add a new problem). What was cut is kept ONLY in an
  // internal record (script._autoCuts), never surfaced to the user.
  const autoCuts: string[] = [];

  // Deterministic body-wide cleanups that run BEFORE the safety cuts, each over the body fields
  // AND every section, feeding the same internal record. All are cut/merge only — never a rewrite
  // that could shatter prose. Order: drop near-duplicate adjacent paragraphs (a chunked-generation
  // artifact — padding, not elaboration) -> cut a false STATED scheme-duration ("Three years.
  // That's how long this ran") -> cut a now-past future-framed date ("scheduled for July 2026").
  const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const applyBodyPass = (fn: (t: string) => { text: string; cuts: string[] }, tag: string) => {
    let wIn = 0, wOut = 0, nCuts = 0;
    for (const k of ["fullScript", "script", "body", "content", "outro"]) {
      const cur = (script as any)[k];
      if (typeof cur === "string" && cur.trim()) {
        const { text, cuts } = fn(cur);
        if (cuts.length) { wIn += wc(cur); wOut += wc(text); nCuts += cuts.length; (script as any)[k] = text; autoCuts.push(...cuts.map((c) => `${tag}: ${c}`)); }
      }
    }
    // Per-pass metric — so a length/quality regression is attributable to the exact deterministic pass
    // that caused it. Logged only when the pass actually changed something.
    if (nCuts) console.log(`[pass] ${tag} words=${wIn}->${wOut} (-${wIn - wOut}) cuts=${nCuts}`);
    if (Array.isArray((script as any).sections)) {
      (script as any).sections = (script as any).sections.map((s: any) => {
        if (s && typeof s.content === "string" && s.content.trim()) {
          const { text, cuts } = fn(s.content);
          if (cuts.length) { autoCuts.push(...cuts.map((c) => `${tag}: ${c}`)); return { ...s, content: text }; }
        }
        return s;
      });
    }
  };
  const nowMs = Date.now();
  // The main body word count at the START of the deterministic strips — the baseline for the runtime
  // over-cut guard on the repetition pass below.
  const mainWords = () => { const k = ["fullScript", "script", "body", "content"].find((kk) => typeof (script as any)[kk] === "string" && (script as any)[kk].trim()); return k ? wc((script as any)[k]) : 0; };
  const wordsAtStripStart = mainWords();
  // Source-leak CUT first — a leaked proper noun from the source video's story is a fabrication
  // about this subject; remove it before anything else reasons about the body.
  applyBodyPass((t) => stripSourceLeaks(t, input.sourceEntities, input.sourceMaterial), "source-leak");
  applyBodyPass(stripFactMetaLeaks, "fact-meta-leak");
  applyBodyPass(stripRepeatedSentences, "repeated-sentence");
  // Grounded scripts only: cut a named Act/legislation the approved facts don't contain (with the
  // unsupported aftermath claim it usually carries). No-op when there's no source material.
  if (input.sourceMaterial) applyBodyPass((t) => stripUngroundedActs(t, input.sourceMaterial), "ungrounded-act");
  applyBodyPass(dedupeAdjacentParagraphs, "dedupe");
  // Strip a leaked structural label ("HOOK:", "SECTION 1:") the writer emitted as literal text.
  applyBodyPass(stripLeakedLabels, "leaked-label");
  // Cut a duplicated HOOK re-emitted later in the body (a chunked-gen artifact the adjacent/3+
  // dedupers miss): the real opening stays, the later restatement goes.
  applyBodyPass(stripDuplicateHook, "dup-hook");
  // False equality between two documented figures (the "$8.09M and $10M are the same number"
  // self-contradiction), and a fabricated external stat (an RIAA "$25k-$50k average" with no fact).
  applyBodyPass(stripFalseEquality, "false-equality");
  applyBodyPass((t) => stripUnsourcedStat(t, input.sourceMaterial), "unsourced-stat");
  // De-repetition: collapse an anchor fact drummed across the whole body, keeping the elaborated
  // instances and cutting the bare/near-duplicate restatements. RUNTIME OVER-CUT GUARD: repetition is
  // the most aggressive cut and the last big one, so if the cumulative strip cut (start-of-strips ->
  // after repetition) would exceed what the bounded refill can rebuild (~2 x 450w), it BACKS OFF —
  // we snapshot the body, apply repetition, and revert it if the total net cut blows the budget. A
  // slightly-repetitive script the refill can't fix beats a gutted one that lands short every run.
  {
    const snapshot: Record<string, any> = {};
    for (const k of ["fullScript", "script", "body", "content", "outro"]) snapshot[k] = (script as any)[k];
    const snapSections = (script as any).sections;
    const autoCutsLen = autoCuts.length;
    applyBodyPass(collapseRepeatedAnchors, "repetition");
    const MAX_RESTORE = 2 * REFILL_RESTORE_WORDS_PER_CALL; // words a 2-call refill can rebuild
    const cutWithRep = wordsAtStripStart - mainWords();
    if (cutWithRep > MAX_RESTORE) {
      for (const k of ["fullScript", "script", "body", "content", "outro"]) (script as any)[k] = snapshot[k];
      (script as any).sections = snapSections;
      autoCuts.length = autoCutsLen; // drop the repetition cuts we just reverted
      console.log(`[pass] repetition BACKED OFF: cumulative strip cut ${cutWithRep}w would exceed refill capacity ${MAX_RESTORE}w`);
    }
  }
  applyBodyPass((t) => stripSchemeDurationClaim(t, (script as any).title, researchedSpan), "duration");
  applyBodyPass((t) => stripStaleFutureDates(t, nowMs), "stale-date");
  // Date integrity: correct a case-event date the script shifted off the sourced date (March 20 ->
  // March 19), when the fact set uniquely fixes it. Verbatim dates, silently.
  if (input.sourceMaterial && input.sourceMaterial.trim()) applyBodyPass((t) => correctDatesToFacts(t, input.sourceMaterial), "date-fix");
  // Numeric conflation: cut a sentence that arithmetically ties a songs/files figure to a streams
  // figure (the 661,440-from-10,000 error); the correct account->streams tie is untouched.
  applyBodyPass(stripUnitConflation, "unit-conflation");
  // Inference/speculation-as-fact: cut a sentence that asserts a cause, motive, or conclusion the
  // record doesn't support ("must have required...", "did not do this alone", "...or both"). Like
  // the insinuation cut, this is an accuracy/credibility guard — the safe default is to remove it.
  applyBodyPass(stripSpeculation, "speculation");
  // Invented inference: assigned roles, imputed motives, undocumented methodology or trends — the
  // class padding produces. Grounded framing is untouched; only invented specifics are cut.
  applyBodyPass(stripInventedInference, "invented-inference");
  // DEFAMATION cut: never let the script equate an unnamed/CC party with a real named person or
  // company. The deeper mining surfaces real names next to "CC-N" designations, so this guard
  // matters more now — a named living person identified as an uncharged co-conspirator must not
  // reach the finished script.
  applyBodyPass((t) => stripUnnamedPartyNaming(t, subjectName), "person-id");
  // Seam cleanup runs LAST, after the cuts, so any fragment a cut left stranded is folded back in.
  applyBodyPass(mergeOrphanFragments, "seam");

  for (const k of ["fullScript", "script", "body", "content", "outro"]) {
    const cur = (script as any)[k];
    if (typeof cur === "string" && cur.trim()) {
      const { text, cuts } = stripInsinuations(cur);
      if (cuts.length) { (script as any)[k] = text; autoCuts.push(...cuts); }
    }
  }
  if (Array.isArray((script as any).sections)) {
    (script as any).sections = (script as any).sections.map((s: any) => {
      if (s && typeof s.content === "string" && s.content.trim()) {
        const { text, cuts } = stripInsinuations(s.content);
        if (cuts.length) { autoCuts.push(...cuts); return { ...s, content: text }; }
      }
      return s;
    });
  }

  // IMPLIED-REVELATION — silent cut of the TRAILING cliffhanger (the tease the facts never pay
  // off). Applied only to the ENDING: the assembled body's last block, and the last section's
  // content, so the script stops on its prior sourced beat. Trailing-only, so a mid-body loop
  // that legitimately resolves later is never touched. Deterministic, off the critical path.
  const bodyKeyEnd = ["fullScript", "script", "body", "content"].find(
    (k) => typeof (script as any)[k] === "string" && (script as any)[k].trim(),
  );
  if (bodyKeyEnd) {
    const { text, cuts } = stripImpliedRevelation((script as any)[bodyKeyEnd] as string);
    if (cuts.length) { (script as any)[bodyKeyEnd] = text; autoCuts.push(...cuts); }
  }
  if (Array.isArray((script as any).sections) && (script as any).sections.length) {
    // Only the final non-empty section can hold the script's ending.
    const secs = (script as any).sections as any[];
    let last = secs.length - 1;
    while (last >= 0 && !(secs[last] && typeof secs[last].content === "string" && secs[last].content.trim())) last--;
    if (last >= 0) {
      const { text, cuts } = stripImpliedRevelation(secs[last].content);
      if (cuts.length) { secs[last] = { ...secs[last], content: text }; autoCuts.push(...cuts); }
    }
  }
  if (autoCuts.length) {
    const unique = [...new Set(autoCuts)];
    (script as any)._autoCuts = unique; // internal record, never shown to the user
    // Report UNIQUE cuts, not the raw tally — the raw counter double-counts each line once per body
    // field (fullScript/script/body/content/outro) and per section, which made ~8 real cuts read as
    // "44" and looked like the guard was shredding the script. It isn't; that many fields hold copies.
    console.log(`[safety] silently cut ${unique.length} unique accuracy/safety line(s) (raw tally ${autoCuts.length} across duplicate fields)`);
  }

  // LENGTH RE-FILL — runs LAST, AFTER refine + every safety cut, so whatever the reductions removed
  // is re-filled from UNUSED facts back to the target. This is the fix for the gutted 6-min output:
  // generation was full (3299 words), refine/safety cut ~60%, and the old backstop (which ran first)
  // couldn't help. Target is ~165 wpm (the finished-video rate; the old 130 undershot a 20:40 ask by
  // ~800 words). Only the supplied facts feed in (never invents), and a deterministic safety re-sweep
  // guards any newly-added beat so the re-fill can't re-introduce an insinuation.
  __trace("before_refill");
  const refillKey = ["fullScript", "script", "body", "content"].find(
    (k) => typeof (script as any)[k] === "string" && (script as any)[k].trim().length > 0,
  );
  // Refill target at ~166 wpm — the real finished-narration rate. 190 over-provisioned it: a good
  // ~3,000-word / ~18-min script tripped a false "shortfall 3007/3800" DEGRADED, and the refill kept
  // fighting the person-id/de-rep cuts to chase a number it didn't need. ~166 wpm lands a genuine
  // 18-20 min without false-flagging, and the bounded 2-call cap still holds the latency.
  const finalTarget = input.targetMinutes ? Math.round(input.targetMinutes * 166) : null;
  if (finalTarget && finalTarget >= 1200 && refillKey && !budgetBlown("refill", 75_000)) {
    const beforeWords = (script as any)[refillKey].split(/\s+/).filter(Boolean).length;
    // Concept mode: top up only from facts the concept plan assigned; re-adding the facts it left out
    // on purpose would turn a focused video back into a whole-history one.
    const conceptFacts = (input.sectionPlan || []).some((sp) => sp.concept) ? (input.sectionPlan || []).flatMap((sp) => sp.assignedFacts || []) : [];
    const facts = conceptFacts.length ? conceptFacts.join("\n") : (input.sourceMaterial && input.sourceMaterial.trim() ? input.sourceMaterial : "");
    try {
      const refill = facts
        ? await extendWithUnusedFacts((script as any)[refillKey], facts, finalTarget, startedAt, DEADLINE)
        : { text: await extendScriptToLength((script as any)[refillKey], finalTarget, input.targetTopic || "", input.targetNiche || "", startedAt), status: "ok" as const };
      if (refill.status === "shortfall") markDegraded("failed", "refill", `shortfall: ${refill.text.split(/\s+/).filter(Boolean).length}/${finalTarget} words`);
      let filled = refill.text;
      if (filled !== (script as any)[refillKey]) {
        // Deterministic re-sweep on the (now longer) body — de-rep AFTER refill (so refill can't
        // reintroduce a repeated concept), plus the cheap safety guards so a new beat can't slip the
        // net. This is the de-rep -> refill -> de-rep ordering: the refill added novel unused facts,
        // and these passes collapse any accidental echo and re-check safety.
        filled = healMidSentenceBreaks(filled);
        filled = dedupeAdjacentParagraphs(filled).text;
        filled = collapseRepeatedAnchors(filled).text;
        filled = stripInsinuations(filled).text;
        filled = stripSpeculation(filled).text;
        filled = stripInventedInference(filled).text; // refill is where invented roles/motives appear
        filled = stripUnnamedPartyNaming(filled, subjectName).text;
        for (const k of ["fullScript", "script", "body", "content"]) {
          if (typeof (script as any)[k] === "string") (script as any)[k] = filled;
        }
      }
      const afterWords = filled.split(/\s+/).filter(Boolean).length;
      console.log(`[refill] target=${finalTarget} before=${beforeWords} after=${afterWords} (${facts ? "fact-aware" : "generic"})`);
    } catch (e) {
      console.error("[refill] failed, keeping post-cut body:", (e as any)?.message);
    }
  } else {
    const why = !refillKey ? "no-body-field" : !finalTarget ? "targetMinutes-undefined" : `target-below-1200 (${finalTarget})`;
    console.log(`[refill] skipped reason=${why}`);
  }

  __trace("after_refill");
  // CERTAINTY DISCIPLINE runs LAST, on the FINAL assembled body (including the woven refill beats,
  // which is where overstatement lands): flag scope/certainty/causation risks, judge each against
  // the facts, rewrite only the unsupported ones AROUND their true core — keeping the punch.
  const certKey = ["fullScript", "script", "body", "content"].find(
    (k) => typeof (script as any)[k] === "string" && (script as any)[k].trim().length > 0,
  );
  // Text before the cutting passes, so the seam check can find every sentence they removed.
  const preCutKey = ["fullScript", "script", "body", "content"].find((k) => typeof (script as any)[k] === "string" && (script as any)[k].trim().length > 0);
  const preCut = preCutKey ? String((script as any)[preCutKey]) : "";
  if (certKey && input.sourceMaterial && input.sourceMaterial.trim() && !budgetBlown("certainty", 30_000)) {
    const cert = await applyCertaintyDiscipline((script as any)[certKey] as string, input.sourceMaterial, startedAt);
    if (cert.status === "failed") markDegraded("failed", "certainty", cert.reason || "unknown");
    if (cert.text && cert.text !== (script as any)[certKey]) {
      for (const k of ["fullScript", "script", "body", "content"]) {
        if (typeof (script as any)[k] === "string") (script as any)[k] = cert.text;
      }
    }
  }

  // FACT DISCIPLINE — its own pass for invented and contradicted details (before the polish pass, so
  // accuracy gets budget first when time is tight).
  const fcKey = ["fullScript", "script", "body", "content"].find((k) => typeof (script as any)[k] === "string" && (script as any)[k].trim().length > 0);
  if (fcKey && input.sourceMaterial && input.sourceMaterial.trim() && !budgetBlown("fact-check", 25_000)) {
    const fc = await applyFactDiscipline((script as any)[fcKey] as string, input.sourceMaterial, startedAt);
    if (fc.status === "failed") markDegraded("failed", "fact-check", fc.reason || "unknown");
    if (fc.text && fc.text !== (script as any)[fcKey]) {
      for (const k of ["fullScript", "script", "body", "content"]) if (typeof (script as any)[k] === "string") (script as any)[k] = fc.text;
    }
  }

  // STRUCTURE PASS — restated arguments, false endings, announced feelings, overused openers, and an
  // honest hook promise (the baseline's weakest craft areas). After the fact check, before self-review.
  const stKey = ["fullScript", "script", "body", "content"].find((k) => typeof (script as any)[k] === "string" && (script as any)[k].trim().length > 0);
  if (stKey && !budgetBlown("structure", 22_000)) {
    const st = await applyStructurePass((script as any)[stKey] as string, startedAt, { voiceProfile: input.voiceProfile, facts: input.sourceMaterial || "" });
    if (st.status === "failed") markDegraded("failed", "structure", "structure pass failed");
    if (st.text && st.text !== (script as any)[stKey]) {
      for (const k of ["fullScript", "script", "body", "content"]) if (typeof (script as any)[k] === "string") (script as any)[k] = st.text;
    }
  }

  // SELF-REVIEW + AUTO-REVISE — the internalized ChatGPT check. Runs LAST (after accuracy/certainty),
  // grades the whole script against a publish rubric and rewrites only the weakest lines (flat hook,
  // AI-tells, telly lines, limp ending). Bounded so it polishes but never guts. Needs ~25s of budget.
  const srKey = ["fullScript", "script", "body", "content"].find(
    (k) => typeof (script as any)[k] === "string" && (script as any)[k].trim().length > 0,
  );
  if (srKey && !budgetBlown("self-review", 25_000)) {
    const sr = await applySelfReview((script as any)[srKey] as string, input.sourceMaterial || "", startedAt, { noCta: !!input.noCta, voiceProfile: input.voiceProfile });
    if (sr.status === "failed") markDegraded("failed", "self-review", sr.reason || "unknown");
    if (sr.text && sr.text !== (script as any)[srKey]) {
      for (const k of ["fullScript", "script", "body", "content"]) {
        if (typeof (script as any)[k] === "string") (script as any)[k] = sr.text;
      }
    }
  }

  // FINAL de-dup of the opening — a later pass (refill/weave/certainty rewrite) can restack or
  // re-label the hook, so run these idempotent cleanups once more on the settled body.
  for (const k of ["fullScript", "script", "body", "content"]) {
    if (typeof (script as any)[k] === "string") {
      (script as any)[k] = stripLeakedLabels((script as any)[k]).text;
      (script as any)[k] = stripDuplicateHook((script as any)[k]).text;
      // Late passes (voice, certainty, fact-check, self-review) rewrite sentences and can leave a
      // stutter or an exact echo; clean both on the settled body.
      (script as any)[k] = stripDividers((script as any)[k]).text;
      if (input.sourceMaterial) (script as any)[k] = unquoteUnsourced((script as any)[k], input.sourceMaterial).text;
      if (input.sourceMaterial) (script as any)[k] = restoreSuperlativeQualifiers((script as any)[k], input.sourceMaterial).text;
      (script as any)[k] = fixDanglingBackrefs((script as any)[k]).text;
      (script as any)[k] = fixQuoteWordCounts((script as any)[k]).text;
      (script as any)[k] = fixWeekdayDates((script as any)[k], input.sourceMaterial || "").text;
      (script as any)[k] = stripLeaningFragments((script as any)[k]).text;
      (script as any)[k] = balanceQuotes((script as any)[k]).text;
      (script as any)[k] = fixOrphanedItSays((script as any)[k]).text;
      (script as any)[k] = dedupeEndingDates((script as any)[k]).text;
      (script as any)[k] = stripPipelineWords((script as any)[k]).text;
      (script as any)[k] = stripStoryMeta((script as any)[k]).text;
      (script as any)[k] = expandNounContractions((script as any)[k]).text;
      // People who were minors at the time by relationship, never by name (channel policy 2026-10-06: adults may be named).
      if (input.sourceMaterial) (script as any)[k] = replaceFamilyNames((script as any)[k], input.sourceMaterial, input.subjectName || (input as any).targetTopic || "").text;
      if (input.sourceMaterial) (script as any)[k] = dropForeverAdverbs((script as any)[k], input.sourceMaterial).text;
      if (input.sourceMaterial) (script as any)[k] = fixMostWantedWording((script as any)[k], input.sourceMaterial).text;
      // House rule: no dashes in narration. Typed double hyphens ("--") slipped past the em-dash strip.
      (script as any)[k] = String((script as any)[k]).replace(/\s*--\s*/g, ", ").replace(/,\s*,/g, ",").replace(/,\s*([.!?])/g, "$1");
      if (k === "fullScript" || (k === "body" && typeof (script as any).fullScript !== "string")) {
        const final = String((script as any)[k]);
        const cq = (input.sectionPlan || []).find((sp) => sp.centralQuotes?.length)?.centralQuotes || [];
        const qn = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
        const missing = cq.filter((q) => !qn(final).includes(qn(q)));
        if (cq.length) console.log(`[central-quote] ${missing.length ? `MISSING ${JSON.stringify(missing)}` : `all ${cq.length} present`}`);
        if (input.sourceMaterial) { const ma = misattributedPhrases(splitSentences(final.replace(/\n\n+/g, " ")), input.sourceMaterial.split("\n")); if (ma.length) console.log(`[attribution] STILL MISATTRIBUTED: ${ma.map((x) => `"${x.phrase}" credited to ${x.credited}, research says ${x.speaker}`).join(" || ")}`); }
      }
      // ENDING INTEGRITY: the script must not end on a dangling back-reference ("What it shows...").
      { const ps = String((script as any)[k]).split(/\n\n+/); const lastS = splitSentences(ps[ps.length - 1] || ""); const tail = (lastS[lastS.length - 1] || "").trim();
        if (lastS.length > 1 && BACKREF_RE.test(tail) && (BACKREF_RE.exec(tail)?.[0] || "").trim()) { lastS.pop(); ps[ps.length - 1] = lastS.join(" "); (script as any)[k] = ps.join("\n\n"); } }
      (script as any)[k] = stripStutters((script as any)[k]).text;
      (script as any)[k] = stripRepeatedSentences((script as any)[k]).text;
    }
  }

  // CUT SEAMS: repair any sentence a cut left stranded LAST, after every pass that removes sentences, the
  // final cleanup loop included (seen live: a pair stranded by a late cleanup cut got through when this ran
  // before the loop).
  const seamKey = ["fullScript", "script", "body", "content"].find((k) => typeof (script as any)[k] === "string" && (script as any)[k].trim().length > 0);
  if (seamKey && preCut && !budgetBlown("seams", 15_000)) {
    const cur = String((script as any)[seamKey]);
    const fixed = await repairCutSeams(preCut, cur, input.sourceMaterial || "").catch(() => cur);
    if (fixed && fixed !== cur) for (const k of ["fullScript", "script", "body", "content"]) if (typeof (script as any)[k] === "string") (script as any)[k] = fixed;
  }

  // FINAL HOOK SYNC — the displayed hook MUST equal what actually opens the script. The hook is
  // stamped early, but the body-editing passes (de-rep, soften, refill) run afterward and can reshape
  // the opening, so the stored hook can drift from the real first line (the "the shown hook isn't the
  // script's opening sentence" bug). Re-derive the hook from the FINAL body's opening paragraph.
  const hookSyncKey = ["fullScript", "script", "body", "content"].find((k) => typeof (script as any)[k] === "string" && (script as any)[k].trim());
  if (hookSyncKey) {
    const finalBody = ((script as any)[hookSyncKey] as string).trim();
    let newHook = (finalBody.split(/\n\n+/)[0] || "").trim();
    if (newHook.length > 400) {
      const sents = newHook.match(/[^.!?]+[.!?]["'”’)\]]?/g) || [newHook];
      newHook = sents.slice(0, 3).join(" ").trim();
    }
    if (newHook) (script as any).hook = newHook;
  }

  // ALWAYS emit the final pipeline status — SUCCESS or DEGRADED with the stages that skipped/failed,
  // so we can measure how often a stage is lost to the deadline or a bad JSON reply. Never silent.
  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  if (pipeline.status === "DEGRADED") {
    console.error(`FINALIZE_DEGRADED status=DEGRADED skipped=[${pipeline.skipped.join(",")}] failed=[${pipeline.failed.join(",")}] elapsed=${elapsed}s`);
  } else {
    console.log(`[finalize] status=SUCCESS elapsed=${elapsed}s`);
  }

  __trace("finalize_out");
  return script;
}

// The model-judgment editor behind the semantic refine pass. Reduction-only: it collapses a point
// restated 3+ times to its 1-2 best instances and cuts/hedges any cause/motive/role/cooperation the
// FACTS don't establish — judged by MEANING, which no regex can do. It must not add, invent, or
// restructure. Heavily guarded: on any failure, a truncated return, an empty return, or a return
// that is not clearly SHORTER than the input (a reduction pass only ever cuts), the original body
// is kept — so a bad pass can never make the script worse.
async function refineAssembledBody(body: string, facts: string, startedAt: number): Promise<string> {
  if (!body || !body.trim() || !facts || !facts.trim()) return body;
  if (Date.now() - startedAt > 240_000) return body; // out of budget — keep as-is
  try {
    const approxTokens = Math.min(8000, Math.max(1500, Math.round(body.length / 3) + 500));
    const msg = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: approxTokens,
      temperature: 0,
      system: `You are a strict line editor making ONLY reduction changes to a finished documentary voiceover script, judged by MEANING (not word-matching). Three jobs:

(1) NOVELTY-BASED DE-REPETITION. For each point/theme/figure, ask what a paragraph CONTRIBUTES that has not already been communicated — not whether it looks similar. First mention: keep. Second: keep only if it adds new evidence or a genuinely new angle. Third and beyond: delete unless it carries a NEW fact. A theme reworded across section after section with no new information is padding — keep the 1-2 most developed instances and DELETE the rest. Do not reword the survivors. Watch specifically for: a MECHANISM re-explained more than once (e.g. how a royalty pool splits money by share of plays — explain it ONCE, in full, then refer back without re-teaching it), and a single DISTINCTION restated repeatedly (e.g. an alleged figure vs. the settled/forfeited figure, the "$10M vs $8M" kind of point — make it once). Collapse these to a single clear statement.
  RE-DERIVED CALCULATIONS AND RE-EXPLAINED MECHANISMS ARE PADDING (the most common bloat in a research-heavy script). If the script WALKS A NUMBER once — builds the arithmetic to a figure, e.g. accounts × bots × streams/day = 661,440 streams/day → dollars/year — it must NOT rebuild that same derivation again later. State the walk ONCE, in full, at its strongest spot; every later mention REFERENCES the figure ("that same 661,440-a-day number", "the projection above") without re-deriving it. Same for a MECHANISM or CAUSAL CHAIN explained step by step (selling → thinner book → larger move → more selling): teach it ONCE, then refer back without re-teaching. Collapse a second or third full re-derivation to a single referencing clause; keep the most developed instance, delete the rebuilds. This is distinct from adding a NEW number or a NEW step — those stay. THE SAME APPLIES TO RESTATING THE SAME SOURCED EVIDENCE FOR EMPHASIS: quoting or paraphrasing the same document line two or three times ("the indictment's language is exact…", then "the indictment uses precise language…"), or re-asserting the same fact with fresh framing, is padding UNLESS the repeat changes the fact's SIGNIFICANCE. State the evidence once, at its strongest; a later mention may point back to it but must add a new angle, never replay it. EXEMPTION: the OPENING HOOK is off-limits. A hook that names a number or image the body later explains in full is INTENTIONAL (the hook teases, the body pays off) — it is NOT a re-derivation to collapse. Never cut or alter the first paragraph to satisfy this rule; preserve the opening exactly and apply de-repetition only from the body that follows it.
  THIS APPLIES TO THE THESIS ITSELF, NOT JUST FACTS (the most common over-narration in a strong script). Once the video's central conclusion is established and proven, RESTATING IT in new words is padding — "the promise broke", "the value proposition dissolved", "the social contract eroded", "it stopped being what it was", "that identity no longer held" are all the same claim, and a reader only needs it landed ONCE, hardest, where the evidence is strongest. Cut the interpretive echoes: after the thesis is proven, let the NUMBERS and the STORY carry it and STOP telling the viewer what it all means. Delete sentences whose only job is to re-assert a conclusion the script already earned (keep the single strongest statement of it, cut the variations). Prosecuting the same point after you have won it drains the back half of a long script.

(2) CLASSIFY AND CUT INFERENCE-AS-FACT. Read every factual-sounding sentence as one of: DIRECT FACT (in the FACTS below), SUPPORTED INFERENCE (the facts plainly entail it), UNSUPPORTED INFERENCE / SPECULATION (a cause, motive, role, intent, cooperation, or conclusion the facts do NOT establish), or NARRATIVE FRAMING. For UNSUPPORTED INFERENCE or SPECULATION: delete it, or soften to state only what the record says ("the indictment names a publicist but does not detail their role"). Watch the interpretation triggers — "this means", "this suggests", "the gap reflects", "the reason is", "what this really means", "which tells us", a legal-theory breakdown, or a forfeiture/number "gap" explanation — and verify each against the FACTS: if the facts don't carry that exact interpretation, cut or attribute it ("the DOJ said…"). Cut editorial mind-reading ("the record goes quiet exactly where you'd want it to speak").

ALSO SOFTEN ANALYTICAL-INFERENCE OVERREACH — the way a DATA/economics script overstates while sounding confident. Keep the investigation framing; recast only the connective claim to what the evidence supports: (a) FALSE-DICHOTOMY ACCOUNTING — "only ~50% passed through, which means the other half went somewhere else" implies a clean second bucket the study never itemized; recast to "the rest was absorbed elsewhere in the business" (no quantity, no location). (b) CORRELATION-AS-CAUSATION — "these two survey numbers are cause and effect" is unsupported; recast to "put them side by side and the tension is obvious". (c) UNPROVEN PERMANENCE / ABSOLUTES — "some exits are permanent" -> "some may not come back"; "millions can no longer afford it" -> "millions no longer consider it affordable"; "nobody noticed" -> "without the industry ever announcing it". (d) COORDINATED INTENT — "restaurants discovered/found a lever", "operators were widening the gap" -> "another lever was available", "prices stayed well above where the cost shock alone would put them". (e) EPISTEMIC PRECISION — a HYPOTHESIS or proposed mechanism narrated as settled fact, or a CORRELATION stated as causation, especially in a neat scientific/mechanistic causal chain ("that pattern points to a specific cause"; "reduced X means Y fails, so Z follows" told as fact). MARK it as what the evidence supports: "one hypothesis is…", "researchers propose…", "this may help explain…", "associated with" not "causes". Keep the mechanism and its vividness; add only the epistemic frame. If the facts flag the science as contested or unresolved, the script must not resolve it. These are REPHRASES, not cuts — the sentence and its drama stay.

ALSO CUT ATMOSPHERIC SPECULATION — unobserved states, moods, or consensus stated as fact to set a scene. These sound authoritative but the facts do not establish them: "nobody could explain where the listeners had gone", "no one in the industry could agree", "the royalty pools didn't add up", "the system was treated as airtight", "money the system may never account for", "investigators were baffled", "the platforms had no answer". Nobody measured "nobody could explain"; it is invented atmosphere. Delete it, or reduce to the mechanical fact ("platforms pay by stream count, on the assumption a stream means a listener"). A claim about what a whole group knew, felt, agreed, or could not do is unsupported unless a fact states it.

(3) TRIM A WEAK ENDING. The last lines should land on the story's MEANING or its consequence. If the script instead ends on a WEAK closer, delete that trailing material so it stops on the strong sourced beat that precedes it (a consequence, the biggest figure, the resolved outcome, or the callback). Weak closers to cut: a caveat or methodology note; a hedge or "we don't know / the record is silent" line; an official's press-release quote used as the final word ("the U.S. Attorney said the brazen scheme is over"); and an open "who else was involved / questions remain / the full story may never be known" ending. Do not write a new ending — cut back to the strong line already present (for this kind of story the strongest close is the meaning already stated in the facts: the streams were fake, the artists were fake, the listeners were fake, but the money was real).

(4) SOFTEN OVERSTATEMENT TO THE DEFENSIBLE CLAIM (do NOT delete — REPHRASE, keep the punch). Certainty-as-retention is the sharpest accuracy loss: the line reads confident but claims more than the record. Rewrite each such line to the strongest version the FACTS actually support, preserving the voice and the drama:
  (a) PRESERVE ATTRIBUTION/ALLEGATION. If a fact is alleged / "prosecutors say" / "the indictment claims" / "charged", the script must NOT upgrade it to proved or settled fact. Keep "prosecutors say", "according to the indictment", "allegedly".
  (b) NEVER ASSERT AN ACTION/DETECTION A SOURCE DID NOT CLAIM. E.g. do not say "Spotify's fraud system flagged the account" when the source only says Spotify's preventative measures limited royalties there to about $60,000 — rewrite to exactly that: "Spotify said its preventative measures limited his royalties there to about $60,000."
  (c) NEVER SCALE A SINGLE-PLATFORM FIGURE TO THE WHOLE SCHEME. "millions flowing out of Spotify" when Spotify was ~$60k of a ~$10M total is false — name the platform-specific figure as platform-specific.
  (d) KEEP RANGES AS RANGES. "1,000 to 10,000 songs a month" must not become "10,000 songs a month".
  (e) STRIP ABSOLUTE / UNCHECKABLE CHARACTERIZATIONS — universal claims the record does not support and often CONTRADICTS. Watch every/never/nobody/none/all + "indistinguishable"/"invisible"/"undetectable"/"uninterrupted"/"perfect", applied to detection, verification, conversion, or concealment: "invisible from the outside", "indistinguishable from a real listener", "never verified", "nobody audits whether the listeners were real", "largely uninterrupted for roughly seven years", "every registration converted into a royalty payment". These are false here — documented warnings (2018/2019) and the 2023 payment halt mean it was NOT invisible or uninterrupted. Recast to what the record supports: "invisible from the outside" -> "designed to resemble legitimate listening"; "largely uninterrupted" -> "despite warnings along the way"; "every registration converted" -> the actual documented rate.
  (f) DON'T UPGRADE LEGAL STATUS. "agreed to forfeit $8,091,843.64" must NOT become "a federal judge entered a forfeiture judgment"; "charged"/"pleaded guilty"/"agreed to" are each precise — keep the exact one the facts state.
  (g) DATES VERBATIM. Every case-event date must match the FACTS exactly — never shift a day or month ("March 20" when the fact says March 19 is an error). Copy the fact's date.
  (h) STAT FIDELITY — STATE A STATISTIC ONLY AS ITS SOURCE FRAMES IT (niche-agnostic, the most common overstatement in a research-heavy script). Match the CLAIM to what the figure actually measures:
    - A RANGE or a SHARE is not a THRESHOLD. "47% call $5–$9.99 a fair price" does NOT mean "nearly half said [a specific higher price] crossed what they considered fair" — keep it as the share-who-consider-a-range-fair that it is; do not convert it into a line drawn at one number.
    - A SAMPLE / SUBSET figure is not the WHOLE population. "prices rose 77.4% across 30 menu items at 6 chains" is not "fast food rose 77.4%" — name the sample ("across a basket of items at major chains"). Same logic as (c), generalized beyond one platform.
    - An ILLUSTRATIVE / EXAMPLE figure is not UNIVERSAL. "a restaurant operating around a 5% margin" (an illustrative case) must NOT become "operators preserved their 5%" or "the industry's 5% margin" — keep it as the example it is ("for a business running on a margin that thin…").
    - A PER-UNIT or ELASTICITY figure is not a headline total, and a MODELED/PROJECTED number is not a MEASURED one — keep "estimated"/"modeled"/"projected" where the source used it.
    - TWO STUDIES ARE NOT DIRECTLY COMPARABLE unless they measure the same thing the same way. When the script sets one study's number beside another's (e.g. "Berkeley found 1.5–2.1%, but NBER found 3.3–3.6%"), do NOT phrase it as two readings of one variable — a different method, population, window, or comparison group produces a different number without contradiction. Frame it as "a separate study, using a different comparison, found a larger effect", not as one measurement beating another. The disagreement is a legitimate story beat; presenting incomparable figures as head-to-head is the overstatement.
  (i) ATTRIBUTE AN INTERESTED-PARTY ESTIMATE. A projection or figure from an advocacy group, trade association, or a company about its own industry (e.g. an Employment Policies Institute estimate, a restaurant-association projection) must be ATTRIBUTED in the narration ("a 2026 analysis from the Employment Policies Institute argues…"), never laundered into a neutral, established fact. Keep the attribution the fact carries; if the fact names the body, the script must too.
  (j) DON'T IMPLY AN INDEX / INSTITUTION EXISTED BEFORE IT DID. Do not attach a modern index or body to a date before it existed in that form ("the S&P 500's return in 1929" — the modern index did not exist then). If the point rests on long-run or reconstructed data, say so ("reconstructed long-run returns", "data later stitched back to that era"), never phrasing it as the actual index measuring the period live.
  (k) A RETURN IS NOT PURCHASING POWER. An investment return percentage measures the change in an asset's value, not inflation or buying power: "a -40% ten-year return" is NOT "40% of purchasing power erased". Keep a return as a return ("the investment lost about 40% of its value over the decade"); only call something a purchasing-power or real-terms change when the fact actually measured that.
This is a REPHRASE, not a cut: the sentence stays, just recast to what the evidence backs. Model: "Spotify's fraud-detection system flagged the account" -> "Spotify said its preventative measures limited his royalties there to about $60,000." | "nearly half said $6.50 crossed the line of fair" -> "nearly half said a fair meal runs five to ten dollars, and the combos now push past that." | "operators preserved their 5%" -> "for an operator running on a margin that thin, raising the menu price was the lever left."

HARD RULES: This is a SURGICAL edit — change as LITTLE as possible. The vast majority of this script is good and MUST be preserved verbatim; a 20-minute script should come back nearly the same length (keep AT LEAST ~85% of it). You are not rewriting or condensing — you are removing only a CLEAR redundancy (a point already fully made) or a CLEARLY unsupported line, and lightly rephrasing overstatement to the defensible claim. When in doubt, KEEP the line — especially a vivid, evidence-grounded framing line (those are the retention and must survive; only fabrications and direct contradictions of the record are cut). Do NOT add any NEW fact, claim, or figure not in the FACTS. Do NOT invent, do NOT change the voice/hook/structure, do NOT condense good prose. Preserve the opening line exactly. Output ONLY the revised script text, nothing else.`,
      messages: [{
        role: "user",
        content: `FACTS — the only things the record establishes; PRESERVE their qualifiers (alleged/prosecutors-say, estimated/modeled), their scope (which platform, which sample, which range vs threshold, illustrative vs universal), and their attribution (which body said it):\n"""\n${facts.slice(0, 40000)}\n"""\n\nSCRIPT TO EDIT:\n"""\n${body}\n"""\n\nReturn the revised script — redundancy removed, unsupported inference cut, overstatement (including any statistic pushed past what its source frames) rephrased to the defensible claim, nothing new added.`,
      }],
    });
    const out = msg.content[0]?.type === "text" ? msg.content[0].text.trim().replace(/^["“']|["”']$/g, "").trim() : "";
    // Guards: non-trivial, not truncated mid-sentence, not gutted, and not ballooned. This is now a
    // reduce+rephrase pass, so a SMALL growth is allowed (softening adds short qualifiers like
    // "prosecutors say"); reject only real growth (went off-task / started adding) or a gut.
    if (!out || out.length < 200) return body;
    if (out.length > body.length * 1.12) return body;       // ballooned — adding, not softening
    // A surgical de-rep/soften pass trims; it does NOT remove two-thirds of a good script. The old
    // 0.30 floor let a pathological 62% gut through (20071 -> 7566 chars), which is what produced the
    // 6-minute output. Reject anything under 0.72 — that is over-cutting good content, not editing;
    // keep the original and let the deterministic passes + the re-fill handle the rest.
    // Floor 0.45 (not 0.72): the re-fill now runs AFTER refine, so a de-rep cut is SAFE — whatever
    // refine removes (repetition, unsupported lines) gets re-filled from DISTINCT unused facts, not
    // the cut repetition. The old 0.72 floor rejected de-rep wholesale, which is exactly why the
    // repetition survived (661,440 6x, four platforms 3x) while length "landed" via the repetition.
    // Reject only a catastrophic <45% survival (a broken/refused pass); otherwise apply the cut and
    // let re-fill restore length WITH depth.
    if (out.length < body.length * 0.45) { console.log(`[refine] REJECTED catastrophic-cut ${body.length} -> ${out.length} (kept original)`); return body; }
    if (!/[.!?"'”’)\]]\s*$/.test(out)) return body;          // truncated at max_tokens
    console.log(`[refine] semantic pass: ${body.length} -> ${out.length} chars`);
    return out;
  } catch (e) {
    console.error("[refine] semantic pass failed, keeping original:", (e as any)?.message);
    return body;
  }
}

// CERTAINTY-DISCIPLINE pass (the "Dramatic Truth Rule") — STAGES 2+3. Clears the accuracy ceiling
// WITHOUT flattening the voice: it never swaps absolute words. Stage 1 (flagOverstatementRisk) is a
// cheap deterministic pre-filter that only marks candidate sentences; this pass sends ONLY the
// flagged sentences to a judge that, against the approved FACTS, KEEPs a sentence whose propositions
// are supported/entailed (or are pure metaphor/contrast/framing) and REWRITEs one that intensifies
// scope/certainty/causation/exclusivity/quantity/knowledge beyond the facts — rewriting AROUND the
// true core so the dramatic proposition survives (often more memorable). Runs on the FINAL assembled
// body (after refill/weave), which is where overstatement lands. One LLM round-trip; heavily guarded.
type CertaintyResult = { text: string; status: "ok" | "failed"; reason?: string };
async function applyCertaintyDiscipline(body: string, facts: string, startedAt: number): Promise<CertaintyResult> {
  if (!body || !body.trim() || !facts || !facts.trim()) return { text: body, status: "ok" };
  if (Date.now() - startedAt > 250_000) return { text: body, status: "ok" };
  const paras = body.split(/\n\n+/);
  // Flatten to sentences, tagging each with an id, and collect the flagged ones for the judge.
  type Sent = { pi: number; si: number; text: string };
  const all: Sent[] = [];
  const sentsByPara: string[][] = paras.map((p) => splitSentences(p));
  sentsByPara.forEach((ss, pi) => ss.forEach((text, si) => all.push({ pi, si, text })));
  const allFlagged = all.filter((s) => flagOverstatementRisk(s.text));
  const flaggedTotal = allFlagged.length; // TRUE pre-cap count — the leading indicator for whether
  // the upstream writer discipline reduced produced overstatements (the logged number was pinned at
  // the 30-cap on every run, so it could never move; report the real total now).
  const flagged = allFlagged.slice(0, 30); // still cap the JUDGE batch for latency
  if (!flagged.length) { console.log("[certainty] flaggedTotal=0"); return { text: body, status: "ok" }; }
  {
    const system = `You enforce the DRAMATIC TRUTH RULE on flagged documentary sentences. A sentence may intensify emotion, imagery, contrast, pacing, and narrative IMPLICATION freely. It may NOT intensify the evidence's SCOPE, CERTAINTY, CAUSATION, EXCLUSIVITY, QUANTITY, or KNOWLEDGE/INTENT beyond the approved facts.

DEFAULT IS REWRITE, NOT KEEP. A sentence was flagged because it carries an absolute, a superlative, a causal claim, an institutional claim, or an exclusivity claim. Return KEEP ONLY when one of these is true: (a) an approved fact DIRECTLY ENTAILS the flagged claim at that exact scope/certainty; or (b) the intensity is PURE metaphor, rhetorical contrast, or vivid description that no reasonable viewer would read as a factual claim ("the operation became a factory", "the streams were fake, the money was real"). In every other case return REWRITE. When unsure whether a fact entails the claim, REWRITE.

Hard rules that ALWAYS force REWRITE:
- EXPANDING AN OFFICIAL'S CHARACTERIZATION. Never enlarge a quoted official label. The DOJ said "First Criminal Case Involving Artificially Inflated Music Streaming" — so "the first criminal case in American history" is unsupported (it added "American history"); rewrite to "one of the earliest criminal cases to put AI-generated music inside the machinery of the scheme."
- ROLE/FUNCTION about a co-conspirator. "his job was to keep improving them", "he was a partner with skin in the game" impute a role the record doesn't define — rewrite to what IS supported ("financially incentivized", "paid a share"), hedged.
- CLAIMING A PLATFORM DETECTED THE SCHEME OR DROVE THE INVESTIGATION. The ~$60K fact means one platform limited ITS OWN exposure; it does NOT establish that platform caught Smith or tipped investigators. "the platform that was not fooled", "handed investigators exactly the discrepancy they needed" are unsupported — rewrite to "one platform's measures limited its own exposure to roughly $60,000."
- An ABSOLUTE about human listening / universal scope ("no human choosing to hear it", "the industry hadn't built its defenses around it") — rewrite to the mechanism ("The stream didn't need a fan. It needed a system capable of generating the play.").

When you REWRITE: find the strongest TRUE proposition underneath and rewrite AROUND it, keeping the rhythm and the punch — the accurate version should be as memorable as the original. NEVER flatten to a dry hedge, NEVER just swap "every"->"some", NEVER add a new fact.

WORKED FIXTURES (input -> KEEP/REWRITE):
- "not a single person choosing to hear it / no human audience at all" -> REWRITE: "The stream didn't need a fan. It needed a system capable of generating the play."
- "the first criminal case in history built around AI" -> REWRITE: "one of the earliest criminal cases to put AI-generated music inside the machinery of the scheme."
- "something the industry hadn't built its defenses around yet" -> REWRITE: "The defenses were catching pieces of the operation. The operation was already changing."
- "every dollar Smith collected was a dollar the royalty pool didn't pay out to someone who had actually made something" -> REWRITE: "The streams were fake. The money they generated wasn't."
- "the only thing you could point to in the real world was a man in Cornelius" -> REWRITE: "Behind the millions of artificial streams was something remarkably ordinary: a man in Cornelius, working from a system designed to manufacture the numbers."
- "the platforms were only catching pieces of it" -> KEEP only if partial detection is in the facts, sharpened: "The platforms were catching pieces of the operation. Smith kept adapting."
- "the operation became a factory" -> KEEP (metaphor). "the streams were fake, the money was real" -> KEEP (contrast).

Output ONLY JSON: {"results":[{"i":<index>,"action":"KEEP"|"REWRITE","rewrite":"<new sentence, only if REWRITE>"}]}.`;
    const user = `APPROVED FACTS (the only established truth — anything beyond these, at greater scope/certainty, is unsupported):\n"""\n${facts.slice(0, 40000)}\n"""\n\nFLAGGED SENTENCES (each was flagged for an absolute/superlative/causal/institutional/exclusivity marker — REWRITE unless a fact entails it or it is pure metaphor/contrast):\n${flagged.map((s, i) => `${i}. ${s.text}`).join("\n")}\n\nJudge each by the Dramatic Truth Rule and output the JSON.`;
    // Through the shared structured boundary: an unparseable/invalid reply is retried ONCE and then
    // reported as FAILED — never swallowed into a silent SUCCESS with the body unchanged (the old bug).
    const res = await callStructuredLLM<any[]>({
      model: "claude-sonnet-4-6", max_tokens: 4000, temperature: 0.3, system, user, kind: "object",
      label: "certainty",
      validate: (v) => (v && Array.isArray((v as any).results) ? (v as any).results : null),
    });
    if (!res.ok) {
      console.error(`[certainty] FAILED reason=${res.reason} — body unchanged, pipeline DEGRADED`);
      return { text: body, status: "failed", reason: res.reason };
    }
    const results: any[] = res.value;
    let rewrites = 0;
    for (const r of results) {
      if (r?.action !== "REWRITE") continue;
      const idx = Number(r.i);
      const rw = typeof r.rewrite === "string" ? r.rewrite.trim() : "";
      if (!Number.isInteger(idx) || idx < 0 || idx >= flagged.length) continue;
      if (!rw || rw.length < 8) continue;
      // Guard: a rewrite should be a comparable-length recast, not a balloon (invention) or a stub.
      const orig = flagged[idx].text;
      if (rw.length > orig.length * 2.2) continue;
      if (attributionMismatch(orig, rw, facts.split("\n")) || introducesUnsupportedName(orig, rw, facts)) continue; // wrong person credited / invented name
      const tgt = flagged[idx];
      if (sentsByPara[tgt.pi] && sentsByPara[tgt.pi][tgt.si] === orig) { sentsByPara[tgt.pi][tgt.si] = rw; rewrites++; }
    }
    if (!rewrites) { console.log(`[certainty] flaggedTotal=${flaggedTotal} judged=${flagged.length} rewrites=0 (all KEEP)`); return { text: body, status: "ok" }; }
    const rebuilt = sentsByPara.map((ss) => ss.join(" ").trim()).filter(Boolean).join("\n\n");
    // Never let the pass gut the script; a certainty recast is length-neutral-ish.
    if (rebuilt.split(/\s+/).filter(Boolean).length < body.split(/\s+/).filter(Boolean).length * 0.75) return { text: body, status: "ok" };
    console.log(`[certainty] flaggedTotal=${flaggedTotal} judged=${flagged.length} rewrites=${rewrites}`);
    return { text: rebuilt, status: "ok" };
  }
}

// SELF-REVIEW + AUTO-REVISE — the internalized "give it to ChatGPT for notes" step. After every other
// pass has run, one editor-grade LLM call reads the WHOLE assembled script against a publish rubric
// (hook strength, retention/pacing, natural voice, no AI-tells, accuracy of figures) and returns a
// SMALL set of TARGETED sentence rewrites for only the weakest spots — a flat hook, a telly/generic
// line, an AI-tell, a limp ending. It rewrites AROUND the weak spot keeping every fact and the voice,
// never adds a new specific, and is bounded so it can polish but never gut or restructure the script.
type SelfReviewResult = { text: string; status: "ok" | "failed"; reason?: string; rewrites?: number };
// PROTECTED LINES — the lines that carry the voice (callbacks, character lines, the closing line,
// refrains) are exactly what a polish pass sands down, because a distinctive line looks "unpolished"
// to a rewriter (seen live: "Every line on it was love." -> "Every line on it was her looking after
// her mother."). So they are LOCKED in code, not just asked nicely: (a) any sentence repeated 3+ times
// verbatim is a deliberate refrain ("Your one page."), deterministically; (b) a fast parallel call
// picks the 6-8 most distinctive voice-carrying lines. Self-review edits to these are discarded,
// except accuracy (claim) and a required CTA cut, which always win.
export function findRefrains(sentences: string[]): Set<number> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const counts = new Map<string, number>();
  for (const s of sentences) { const k = norm(s); if (k) counts.set(k, (counts.get(k) || 0) + 1); }
  const out = new Set<number>();
  sentences.forEach((s, i) => { if ((counts.get(norm(s)) || 0) >= 3) out.add(i); });
  return out;
}
async function pickProtectedLines(sentences: string[], voiceProfile?: string): Promise<Set<number>> {
  const res = await callStructuredLLM<number[]>({
    model: "claude-haiku-4-5-20251001", max_tokens: 300, temperature: 0, kind: "object", label: "protect-lines",
    system: `You pick the lines an editor must NOT touch. Return the 6-8 sentences that carry this script's VOICE and emotional architecture: callbacks to the opening, lines that define the narrator's character, the most memorable emotional lines, and the final closing line. Prefer short, distinctive lines. Never pick a plain informational sentence. Output ONLY JSON: {"keep":[<sentence index>, ...]}`,
    user: `${voiceProfile ? `CREATOR VOICE:\n${voiceProfile.slice(0, 900)}\n\n` : ""}SCRIPT SENTENCES (index. text):\n${sentences.map((s, i) => `${i}. ${s}`).join("\n")}`,
    validate: (v) => { const k = (v as any)?.keep; return Array.isArray(k) ? k.map(Number).filter((x: number) => Number.isInteger(x)) : null; },
  });
  return new Set(res.ok ? (res.value as number[]).filter((i) => i >= 0 && i < sentences.length).slice(0, 8) : []);
}

export async function applySelfReview(body: string, facts: string, startedAt: number, opts?: { noCta?: boolean; voiceProfile?: string }): Promise<SelfReviewResult> {
  if (!body || !body.trim()) return { text: body, status: "ok" };
  if (Date.now() - startedAt > 250_000) return { text: body, status: "ok" };
  const noCta = !!opts?.noCta;
  const voice = (opts?.voiceProfile || "").trim();
  const paras = body.split(/\n\n+/);
  type Sent = { pi: number; si: number; text: string };
  const sentsByPara: string[][] = paras.map((p) => splitSentences(p));
  const all: Sent[] = [];
  sentsByPara.forEach((ss, pi) => ss.forEach((text, si) => all.push({ pi, si, text })));
  if (all.length < 6) return { text: body, status: "ok" };
  const n = all.length;
  // Kick off protected-line selection in PARALLEL with the review so it adds no wall-clock time.
  const protectP = pickProtectedLines(all.map((s) => s.text), voice || undefined).catch(() => new Set<number>());
  const voiceBlock = voice
    ? `\n\nTHE CREATOR'S CHOSEN VOICE (this script is deliberately written in it — the VOICE WINS over the topic's or niche's usual conventions, e.g. a Kurzgesagt voice on a true-crime story stays Kurzgesagt):\n"""\n${voice.slice(0, 900)}\n"""\nThis voice's signature habits (its rhetorical questions, asides, refrains, fragments or long sentences, tidy summaries, repetition for effect) are ON PURPOSE. Never flag them as AI-tells or rhythm problems, and never rewrite a line toward a more generic style. Every rewrite must sound like THIS voice.`
    : "";
  const system = `You are a top-tier YouTube documentary script editor doing a FINAL polish pass — the notes a sharp editor gives before a script goes to record. The script already passed accuracy and structure checks. Your job is to find the genuine weak spots and either REWRITE or CUT just those, so the finished script reads like a great human-written video with nothing left to fix. Two actions: "rewrite" (replace a sentence) or "cut" (delete a sentence entirely).

WHAT TO FIX (most sentences are fine — leave them):
1. CLAIM / EVIDENCE BOUNDARY (high priority — REWRITE): a sentence that states an INTERPRETATION as hard fact, or intensifies a documented point past what the facts support. Keep the punch, pull the certainty back to what's earned. Examples of the failure: "the system was designed to exploit your psychology" (the facts show it was optimized for engagement — that's not the same as a designed intent to exploit), "X was the product" stated as literal fact when it's a rhetorical claim, "they all agreed" when the sources actually made different arguments. Rewrite to the strongest TRUE version ("optimized relentlessly for engagement", "had become how the product worked", "were pointing at the same underlying problem"), never a limp hedge.
2. REDUNDANT RE-EXPLANATION (CUT): the script explains the same mechanism or makes the same point it already made earlier. Once a point has landed, a later sentence that re-explains it (the same "algorithm → engagement → outrage" loop a third time) is padding — CUT it. Cut the WEAKER restatement, never the first/strongest statement of a point. This is the most valuable fix for a script that sags in the middle.
3. AI-TELLS / GENERIC LINES (REWRITE): hollow phrasing ("it's important to note", "plays a crucial role", "the reality is", "what's fascinating is", "in conclusion", "at the end of the day"), or a sentence that just announces what the next part will do. Make it something a person would actually say — or CUT it if it adds nothing.
4. HOOK (REWRITE): if the opening 1-3 sentences don't create immediate tension, sharpen them (facts present only).
5. TOO MANY ENDINGS (CUT): if the script "finishes" several times, keep the single strongest closing line and CUT the weaker between-endings so the ending accelerates to one clean landing.
1b. UNSUPPORTED DETAIL (high priority — REWRITE to what the facts support, or CUT): a sentence that states a specific FACTUAL detail that appears NOWHERE in the approved facts. This covers: an action or event ("he applied, he tested, he was issued documentation"), a habit or behavior ("he paid his bills, kept to himself"), a relationship or role ("a network held around him"), a count ("through two arrests" when the facts give one), a named detail ("the booking photo"), and outside BACKGROUND or HISTORY ("the service has been hunting fugitives since the nineteenth century", "honor camps were a fixture of mid-century corrections"). Being true in the real world does NOT make it supported: if the facts don't say it, it isn't. Rewrite to the strongest version the facts DO support (keep the voice), or CUT it if nothing supports it. NOT this item: interpretation, emotion, framing, rhetorical lines, and transitions that assert no new fact ("He did not stay long enough to matter.", "That is not running.") — leave those alone. Compare against the WHOLE fact list before flagging; never flag a detail that a fact states in other words.
6. COUNT MISMATCH (REWRITE): a sentence that announces a number of items ("Two failures", "three reasons") followed by a list with a DIFFERENT number. Fix the announced number to match what actually follows.
6b. OFF-VOICE RHYTHM (REWRITE): this script will be READ ALOUD. ${voice ? `Judge rhythm against the CREATOR'S VOICE below, not a generic standard: fix only a sentence whose cadence breaks from how this creator talks (a long, written-style sentence in a punchy voice; a choppy fragment in a flowing voice; a stiff formal construction a person wouldn't say aloud).` : `Fix a sentence that reads as written rather than spoken (stiff formal construction, a mouthful a narrator would stumble on), or a run of sentences so alike in length and opening that the pace goes flat.`} NEVER "fix" deliberate repetition: refrains, parallel lists ("Two hundred here, ninety there."), or a run of short sentences that lands a beat ("I was a lawyer. I knew better.") are craft, not monotony.${noCta ? `
7. UNWANTED CTA (CUT — REQUIRED): the creator turned the CTA OFF for this script, so it must NOT ask the viewer to subscribe, like, comment, or watch another video. CUT every sentence that makes any such ask (e.g. "subscribe", "if this is the kind of story...", "there are more stories like this"). End on the closing narrative line.` : ""}

HARD RULES:
- KEEP EVERY FACT. Add NO new specific (number, name, date, place, quote) not already in that sentence or the approved facts. Rephrase, never re-research.
- Preserve the surrounding VOICE and rhythm — a rewrite must be indistinguishable in style from the lines around it.
- Touch a sentence ONLY if genuinely weak/redundant/unsupported. At most 18 edits total; a clean script needs few. Spend edits on accuracy (claim, unsupported) FIRST. Never touch a strong sentence.
- A rewrite is roughly the same length as the original (recast, not expansion/stub). A cut removes exactly one sentence.
- RESTRAINT: do not rewrite a sentence merely because another version sounds more polished. A line with character, even slightly informal, is worth more than a smoother generic one. Change only what weakens accuracy, clarity, or flow.${voiceBlock}

Output ONLY JSON: {"edits":[{"i":<sentence index>,"action":"rewrite"|"cut","issue":"claim|unsupported|redundant|ai-tell|hook|ending|count|rhythm|cta","rewrite":"<new sentence, only for rewrite>"}]}`;
  const user = `APPROVED FACTS (the only established truth — never introduce a specific beyond these):\n"""\n${(facts || "").slice(0, 40000)}\n"""\n\nSCRIPT SENTENCES (index. text) — the first few are the HOOK, the last few are the ENDING${noCta ? " (this script must end with NO CTA)" : ""}:\n${all.map((s, i) => `${i}. ${s.text}`).join("\n")}\n\nReturn JSON: rewrite overstated/AI-tell/hook/ending lines, cut redundant re-explanations${noCta ? " and every CTA/subscribe ask" : ""}.`;
  const res = await callStructuredLLM<any[]>({
    model: "claude-sonnet-4-6", max_tokens: 4000, temperature: 0.4, system, user, kind: "object",
    label: "self-review",
    validate: (v) => { const o = v as any; const arr = Array.isArray(o?.edits) ? o.edits : (Array.isArray(o?.rewrites) ? o.rewrites : null); return arr; },
  });
  if (!res.ok) { console.error(`[self-review] FAILED reason=${res.reason} — body unchanged`); return { text: body, status: "failed", reason: res.reason }; }
  const protectedIdx = new Set<number>([...findRefrains(all.map((s) => s.text)), ...(await protectP)]);
  let rewrites = 0, cuts = 0, blocked = 0, unsupported = 0;
  // Cut budget lowered (was 15%): the structure pass now owns repetition/endings, and stacked cuts
  // were leaving fragments and gutted endings in the benchmark.
  const MAX_CUTS = Math.max(3, Math.floor(n * 0.15)); // measured: the lower cap + rewrite-first scored worse (6.00 vs 6.57)
  for (const r of (res.value as any[]).slice(0, 18)) {
    const idx = Number(r?.i);
    if (!Number.isInteger(idx) || idx < 0 || idx >= n) continue;
    const t = all[idx];
    const orig = t.text;
    if (!sentsByPara[t.pi] || sentsByPara[t.pi][t.si] !== orig) continue; // already edited / mismatch
    const action = r?.action === "cut" ? "cut" : "rewrite";
    // Locked line: only an accuracy fix or a required CTA removal may touch it.
    const issue = String(r?.issue || "");
    if (protectedIdx.has(idx) && !(issue === "claim" || issue === "unsupported" || (noCta && issue === "cta"))) { blocked++; continue; }
    if (action === "cut") {
      if (cuts >= MAX_CUTS) continue;
      // The ending is protected from cuts (only a CTA the creator turned off may go).
      if (cutWithOrphans(sentsByPara, t.pi, t.si, issue === "unsupported" || issue === "claim" ? "accuracy" : "style") < 0) { blocked++; continue; }
      cuts++; if (issue === "unsupported") unsupported++;
    } else {
      const rw = typeof r?.rewrite === "string" ? r.rewrite.trim() : "";
      if (!rw || rw.length < 8 || rw === orig) continue;
      if (rw.length > orig.length * 2.2) continue; // no ballooning (invention guard)
      if (!quoteBalanceKept(orig, rw)) { blocked++; continue; }
      if (attributionMismatch(orig, rw, facts.split("\n")) || introducesUnsupportedName(orig, rw, facts)) { blocked++; continue; }
      sentsByPara[t.pi][t.si] = rw; rewrites++; if (issue === "unsupported") unsupported++;
    }
  }
  if (!rewrites && !cuts) { console.log(`[self-review] sentences=${n} edits=0 protected=${protectedIdx.size} blocked=${blocked} voice=${voice ? "yes" : "no"}`); return { text: body, status: "ok", rewrites: 0 }; }
  const rebuilt = sentsByPara.map((ss) => ss.filter(Boolean).join(" ").trim()).filter(Boolean).join("\n\n");
  // Anti-gut floor: a polish (even with de-rep cuts + CTA removal) stays well above 80% of length.
  if (rebuilt.split(/\s+/).filter(Boolean).length < body.split(/\s+/).filter(Boolean).length * 0.80) { console.log("[self-review] backed off — rebuilt too short"); return { text: body, status: "ok", rewrites: 0 }; }
  console.log(`[self-review] sentences=${n} rewrites=${rewrites} cuts=${cuts} unsupported=${unsupported} protected=${protectedIdx.size} blocked=${blocked} voice=${voice ? "yes" : "no"}${noCta ? " noCta" : ""}`);
  return { text: rebuilt, status: "ok", rewrites: rewrites + cuts };
}

// Cut a sentence AND any elliptical fragment it strands. A cut can orphan a short neighbor that only
// made sense against it (seen live: "...and he stayed. Not for months." after the follow-up sentence
// was cut). A neighbor of <= 4 words that opens elliptically ("Not...", "Just...", "Or...") goes too.
const ELLIPTICAL_RE = /^(?:not|no|never|just|only|or|and|but|nor|even|instead|not even)\b/i;
// A sentence whose subject lives in the sentence before it ("She denied it. Said they had the wrong
// person."). Seen live: cutting the first left "Said they had the wrong person." as a subjectless line.
export const SUBJECTLESS_RE = /^(?:Said|Told|Kept|Asked|Insisted|Claimed|Denied|Added|Admitted|Swore|Refused|Tried|Then\s+(?:said|told|asked|kept|denied|relented)|So\s+(?:was|were|did|had|is|are)|Neither\s+(?:was|were|did|had)|The\s+kind\s+(?:that|of\s+\w+\s+that))\b/;
// "style" cuts (repetition, structure) are refused when they'd strand such a sentence; "accuracy" cuts
// (the line is wrong) take the stranded continuation with them. Returns -1 when refused.
function cutWithOrphans(sentsByPara: string[][], pi: number, si: number, mode: "style" | "accuracy" = "style"): number {
  const row = sentsByPara[pi];
  const after = row.slice(si + 1).find(Boolean);
  if (after && SUBJECTLESS_RE.test(after.trim())) {
    if (mode === "style") return -1;
    row[row.indexOf(after, si + 1)] = "";
  }
  row[si] = "";
  let extra = 0;
  for (const j of [si - 1, si + 1]) {
    const nb = row[j];
    if (nb && nb.split(/\s+/).filter(Boolean).length <= 4 && ELLIPTICAL_RE.test(nb.trim())) { row[j] = ""; extra++; }
  }
  // The sentence AFTER a cut that answers it ("What it shows is...") now answers nothing: drop it.
  const next = row[si + 1];
  if (next && BACKREF_RE.test(next.trim()) && (BACKREF_RE.exec(next.trim())?.[0] || "").trim()) { row[si + 1] = ""; extra++; }
  return extra;
}

// FACT DISCIPLINE — its own pass. The unsupported-detail check started as one of eight items in
// self-review and was barely used on a real run (caught 1 of ~6 inventions: a guessed age "in his
// eighties" for a man of 79, "he drifted, he kept moving" against a sourced "flawless 16-year
// residency", invented neighbors/landlords). Same lesson as the voice and certainty passes: give
// the hard thing its own turn with nothing competing. Judges EVERY sentence against the facts for
// (a) specifics absent from the facts and (b) claims the facts contradict, then rewrites to what the
// facts support or cuts. Interpretation and voice lines are out of scope. Bounded like the others.
// Deterministic age check: an age stated in the script ("in his eighties", "a 79-year-old", "aged 79")
// is supported only if the facts state an age in that same range. The model reliably GUESSES ages
// (seen live: "a man in his eighties" for a man of 79), so detection can't be left to it.
const DECADES: Record<string, number> = { teens: 10, twenties: 20, thirties: 30, forties: 40, fifties: 50, sixties: 60, seventies: 70, eighties: 80, nineties: 90 };
const AGE_ONES: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const AGE_TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
function spelledNum(w: string): number | null {
  const m = w.toLowerCase().match(/^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)?[\s-]?(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)?$/);
  if (!m || (!m[1] && !m[2])) return null;
  return (m[1] ? AGE_TENS[m[1]] : 0) + (m[2] ? AGE_ONES[m[2]] : 0);
}
function agesIn(text: string): { lo: number; hi: number }[] {
  const out: { lo: number; hi: number }[] = [];
  const t = text.toLowerCase();
  for (const m of t.matchAll(/\bin (?:his|her|their) (?:early |mid-?|late )?(teens|twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties)\b/g)) out.push({ lo: DECADES[m[1]], hi: DECADES[m[1]] + 9 });
  for (const m of t.matchAll(/\b(?:aged?|at age)\s+(\d{1,3})\b|\b(\d{1,3})[- ]years?[- ]old\b/g)) { const n = Number(m[1] || m[2]); out.push({ lo: n, hi: n }); }
  for (const m of t.matchAll(/\b((?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-](?:one|two|three|four|five|six|seven|eight|nine))?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)[- ]years?[- ]old\b/g)) { const n = spelledNum(m[1]); if (n) out.push({ lo: n, hi: n }); }
  return out;
}
// Ages the facts support by ARITHMETIC: a birth year ("born March 29, 1943", "born in 1936") and any
// other year in the facts give age = year - birth (or one less, before the birthday). The model did
// not do this math and cut a correct "nineteen years old" (born 1943, crime in 1962).
function birthDerivedAges(facts: string): { lo: number; hi: number }[] {
  const births = [...facts.matchAll(/\bborn\b[^.\n]{0,30}?\b(1[89]\d{2}|20\d{2})\b/gi)].map((m) => Number(m[1]));
  if (!births.length) return [];
  const years = [...new Set((facts.match(/\b(1[89]\d{2}|20\d{2})\b/g) || []).map(Number))];
  return births.flatMap((b) => years.filter((y) => y > b).map((y) => ({ lo: y - b - 1, hi: y - b })));
}
function factAgeRanges(facts: string) { return [...agesIn(facts), ...birthDerivedAges(facts)]; }
export function unsupportedAgeSentences(sentences: string[], facts: string): number[] {
  const factAges = factAgeRanges(facts);
  return sentences.flatMap((sn, i) => agesIn(sn).some((a) => !factAges.some((f) => a.lo <= f.hi && f.lo <= a.hi)) ? [i] : []);
}
// Sentences whose stated age IS supported (directly or by birth-date arithmetic): protected from edits.
export function supportedAgeSentences(sentences: string[], facts: string): number[] {
  const factAges = factAgeRanges(facts);
  return sentences.flatMap((sn, i) => { const a = agesIn(sn); return a.length && a.every((x) => factAges.some((f) => x.lo <= f.hi && f.lo <= x.hi)) ? [i] : []; });
}

type FactCheckResult = { text: string; status: "ok" | "failed"; reason?: string; edits?: number };
export async function applyFactDiscipline(body: string, facts: string, startedAt: number): Promise<FactCheckResult> {
  if (!body || !body.trim() || !facts || !facts.trim()) return { text: body, status: "ok" };
  if (Date.now() - startedAt > 245_000) return { text: body, status: "ok" };
  const paras = body.split(/\n\n+/);
  const sentsByPara: string[][] = paras.map((p) => splitSentences(p));
  const all: { pi: number; si: number; text: string }[] = [];
  sentsByPara.forEach((ss, pi) => ss.forEach((text, si) => all.push({ pi, si, text })));
  if (all.length < 6) return { text: body, status: "ok" };
  const n = all.length;
  const mustFix = unsupportedAgeSentences(all.map((x) => x.text), facts);
  // Superlatives whose scope drifted from the research ("longest fugitive hunt" vs the source's
  // "longest successful manhunt"): must-fix, with the source's exact phrase handed over.
  const supNotes: string[] = [];
  // Misattributed borrowed phrases: must-fix, naming the research's actual speaker.
  for (const ma of misattributedPhrases(all.map((x) => x.text), facts.split("\n"))) {
    if (!mustFix.includes(ma.i)) mustFix.push(ma.i);
    supNotes.push(`sentence ${ma.i}: credits the words "${ma.phrase}" to "${ma.credited}", but the research attributes them to ${ma.speaker}. Rewrite to credit ${ma.speaker}`);
  }
  // Names the research never mentions (seen live: "Ed was a Phoenix nurse"; the nurse is Clifton
  // Goodenough). A capitalized word absent from the facts that never appears lowercase anywhere in the
  // script is a name, not a sentence-opening word ("Thirteen", "Not" also appear lowercase).
  const OPENERS = new Set(["it", "he", "she", "they", "we", "i", "you", "his", "her", "their", "its", "our", "the", "a", "an", "and", "but", "or", "so", "not", "no", "yes", "then", "now", "that", "this", "these", "those", "there", "here", "what", "when", "where", "why", "how", "who", "which", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "in", "on", "at", "by", "for", "from", "of", "to", "with", "after", "before", "until", "since", "while", "if", "as", "just", "still", "even", "only", "every", "each", "all", "some", "most", "none", "nobody", "nothing", "everyone", "everything", "maybe", "because", "though", "although", "yet", "once", "twice", "never", "always", "also", "back", "years", "year", "months", "days"]);
  // Apostrophes split too, so "Hare" in "O'Hare" counts as in the research.
  const lowerFacts = ` ${facts.toLowerCase().replace(/[^a-z0-9' ]+/g, " ")} ${facts.toLowerCase().replace(/[^a-z0-9 ]+/g, " ")} `;
  all.forEach((x, i) => {
    const names = [...new Set(x.text.match(/\b[A-Z][a-z]{1,}\b/g) || [])].filter((w) => !OPENERS.has(w.toLowerCase()) && !(w.length > 4 && /(?:ly|ed|ing|tion|ment|ness|ous|ive|able)$/.test(w)) && !lowerFacts.includes(` ${w.toLowerCase()} `) && !new RegExp(`(?:^|[^A-Za-z])${w.toLowerCase()}(?:[^A-Za-z]|$)`).test(body.replace(new RegExp(`\\b${w}\\b`, "g"), "")));
    if (!names.length) return;
    if (!mustFix.includes(i)) mustFix.push(i);
    supNotes.push(`sentence ${i}: names ${names.map((w) => `"${w}"`).join(", ")}, which the research never mentions. If it is a person or place, replace it with the right one from the facts or remove it`);
  });
  for (const ey of eventYearMismatches(all.map((x) => x.text), facts)) {
    if (!mustFix.includes(ey.i)) mustFix.push(ey.i);
    supNotes.push(ey.missingYear
      ? `sentence ${ey.i}: gives "${ey.event}" a month and day but no year, so after the script's ${ey.said} it sounds like ${ey.said}; the research has ${ey.research}. Add the year`
      : `sentence ${ey.i}: puts "${ey.event}" in ${ey.said}, but the research has it in ${ey.research}. Fix the year (and any dateline or "N months earlier" that depends on it)`);
  }
  all.forEach((x, i) => { const fv = foreverContradicted(x.text, facts); if (fv) { if (!mustFix.includes(i)) mustFix.push(i); supNotes.push(`sentence ${i}: says "${fv}", but the research has him found later. Drop the absolute`); } });
  for (const am of ageYearMismatches(all.map((x) => x.text), facts)) {
    if (!mustFix.includes(am.i)) mustFix.push(am.i);
    supNotes.push(`sentence ${am.i}: says ${am.said} years old in ${am.year}, but by the research's ages and dates he or she was about ${am.expected} then. Fix the age or drop it`);
  }
  all.forEach((x, i) => { const mm = superlativeMismatches(x.text, facts); if (mm.length) { if (!mustFix.includes(i)) mustFix.push(i); supNotes.push(`sentence ${i}: ${mm.map((q) => q.source ? `"${q.said}" must use the source's exact wording "${q.source}" and keep its attribution` : `"${q.said}" is a superlative the facts don't state: remove it`).join("; ")}`); } });
  // Voice lines are locked here too (same picker as self-review, run in parallel): a softer
  // "unsupported" edit must not strip a voice line; a hard contradiction or a must-fix still may.
  const protectP = pickProtectedLines(all.map((x) => x.text)).catch(() => new Set<number>());
  const system = `You are a documentary fact-checker. A script was written from an APPROVED FACT SHEET. Find every sentence that states a FACTUAL detail the facts do not support, and fix it. Three failures:
1. UNSUPPORTED: a specific stated as fact that appears NOWHERE in the facts — an action, process, or event ("he applied, he tested"), a habit or behavior ("kept to himself", "paid his bills"), movement or whereabouts ("he drifted from state to state"), people or relationships ("neighbors", "landlords", "a network", "someone who helped him"), a number, age, or duration the facts don't give (an age is supported ONLY if the facts give it or give both a birth year and the date), a named detail ("the booking photo"), or outside background/history ("since the nineteenth century"). Being true in the real world does NOT make it supported.
2. INSINUATION, SPECULATION, OR INTENT DRESSED AS NARRATIVE: a hint or open question that plants a claim the facts don't make, especially about real people ("a small circle can shelter a person. It can also fund one.", "neither one had been ruled out", "it's hard not to wonder"), a motive or intention the facts don't state ("a paper trail deliberately kept thin", "he chose to"), a softened guess that still plants a claim ("someone who might have helped him", "he probably"), or an invented duration or effort for a process ("months of pulling threads", "years of investigative work"). A hedge word does not make an unsupported claim acceptable.
2b. A REAL PERSON'S THOUGHTS OR FEELINGS ("he seemed to have moved on", "he never looked back"), AGENCY KNOWLEDGE, INACTION, OR TIMING not in the facts ("had no idea where he was", "nobody pursued him", "closed his file", "in a matter of months"), ERA GENERALIZATIONS ("not unusual for the era"), outside GEOGRAPHY ("halfway down the Atlantic coast"), and invented TERMS of a sentence/probation/parole ("do not drive", "stay out of trouble") unless the facts state them.
3. CONTRADICTED: a claim that conflicts with a fact, including one implied by facts taken together (if the facts say he had a "flawless 16-year residency" in one state, "he kept moving" contradicts it).
4. ATTRIBUTED CLAIM STATED AS FACT: the facts give a claim only as someone's account ("his wife told investigators he gambled", "he said he sold it after a trading loss", "according to prosecutors"), and the script states it as plain truth ("He sold it because the gambling had stripped him"). Worst when the facts hold a different account from someone else. Rewrite to keep the attribution ("His wife told investigators it was gambling.") and, when the accounts differ, don't pick a side. This includes the SUBJECT'S OWN ACCOUNT: what the research gives only from his memoir, an interview, or his letters ("he crossed a border", "he sat on a rock near a foreign border") must be attributed ("By his own account, ...", "In his memoir, he wrote ..."). Facts tagged [his own account] or [family account] are exactly these.
5. TWO FIGURES FOR ONE QUANTITY: under FIGURES ACROSS THE SCRIPT you get every dollar figure in the whole script. If this sentence gives a figure for the SAME quantity as a different figure elsewhere (the family "collected $47,000" vs restitution "covering the survivor payments" of $78,600), the viewer hears a contradiction. Rewrite the LATER of the two so the difference is explained, using only what the facts say about each figure (who reported it, when, or what it measures), e.g. "Early reports put the benefits at $47,000. The court's figure was more than $78,600." Different quantities that happen to differ are fine: leave them.
FIX: "rewrite" to the strongest version the facts DO support, in the same voice and about the same length (drop or generalize only the unsupported part, e.g. "a man in his eighties" -> "an old man"); or "cut" if nothing in it is supported. Compare against the WHOLE fact sheet first; a fact phrased differently still supports it.
OUT OF SCOPE (never flag): interpretation, emotion, rhetorical or transitional lines, framing that asserts no new fact ("That is not running.", "Boring is very hard to find."), and arithmetic correctly derived from fact dates.
Output ONLY JSON: {"edits":[{"i":<sentence index>,"action":"rewrite"|"cut","kind":"unsupported"|"speculation"|"contradicted"|"attributed"|"figure","rewrite":"<new sentence, only for rewrite>"}]}`;
  // Every dollar figure in the WHOLE script, so a window can see a conflicting figure outside itself
  // (seen live, Jones: "$47,000" in one window, "$78,600 ... covering the survivor payments" in another).
  const MONEY_RE = /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|thousand))?/gi;
  const figures = all.flatMap((x, i) => (x.text.match(MONEY_RE) || []).map((f) => ({ i, f: f.replace(/\s+/g, " "), text: x.text })));
  const figBlock = new Set(figures.map((g) => g.f.toLowerCase())).size >= 2
    ? `\nFIGURES ACROSS THE SCRIPT (sentence index: figure, in context):\n${figures.slice(0, 40).map((g) => `${g.i}: ${g.f} :: ${g.text.slice(0, 160)}`).join("\n")}\n`
    : "";
  // Likely pairs, found by code (the model alone left "$47,000 ... collected" and "$78,600 ... covering
  // the survivor payments" both standing): two sentences with DIFFERENT dollar figures that share 2+
  // topic words. The later one becomes must-fix with both figures named.
  const FIG_STOP = new Set(["about", "after", "their", "there", "these", "which", "would", "years", "every", "first", "money", "dollars", "more", "than", "goes", "paid"]);
  const topicWords = (t: string) => new Set((t.toLowerCase().replace(MONEY_RE, " ").match(/[a-z]{5,}/g) || []).filter((w) => !FIG_STOP.has(w)).map((w) => w.slice(0, 6)));
  for (let x = 0; x < figures.length; x++) for (let y = x + 1; y < figures.length; y++) {
    const A = figures[x], B = figures[y];
    if (A.i === B.i || A.f.toLowerCase() === B.f.toLowerCase()) continue;
    // Already explained: some sentence names both figures (a second explanation would repeat or
    // contradict it; seen live).
    const pairKey = [A.f, B.f].map((f) => f.replace(/[\s$,]/g, "").toLowerCase()).sort().join("|");
    if (all.some((x2) => figurePairsInSentence(x2.text).includes(pairKey))) continue;
    const ta = topicWords(A.text), tb = topicWords(B.text);
    const shared = [...ta].filter((w) => tb.has(w));
    if (shared.length < 2) continue;
    const later = Math.max(A.i, B.i), [lf, ef, ei] = later === B.i ? [B.f, A.f, A.i] : [A.f, B.f, B.i];
    if (!mustFix.includes(later)) mustFix.push(later);
    supNotes.push(`sentence ${later}: gives ${lf} where sentence ${ei} gives ${ef}, and both seem to be about the same thing. If they are the same quantity, rewrite sentence ${later} so the viewer hears WHY they differ, from what the facts say about each figure (who reported it, when, what it covers). If they measure different things, make that plain in a few words`);
  }
  // CHUNKED + PARALLEL: one call over ~170 sentences caught about half the inventions on a fresh script.
  // Each call now judges a window of ~60 sentences (with the WHOLE fact sheet), all windows at once,
  // so recall goes up and wall-clock time does not.
  const WIN = 60;
  const windows: number[][] = [];
  for (let a = 0; a < n; a += WIN) windows.push(Array.from({ length: Math.min(WIN, n - a) }, (_, k) => a + k));
  const results = await Promise.all(windows.map((idxs) => {
    const mf = mustFix.filter((i) => idxs.includes(i));
    const user = `APPROVED FACTS:\n"""\n${facts.slice(0, 40000)}\n"""\n${figBlock}\nSCRIPT SENTENCES (index. text) — a window of the script; judge every one:\n${idxs.map((i) => `${i}. ${all[i].text}`).join("\n")}\n${mf.length ? `\nMUST FIX (an age the facts do not state, a superlative whose wording drifted from the source, words credited to the wrong source, a name the research never mentions, or two figures that clash; fix only that part, keep the rest): sentence ${mf.join(", ")}\n${supNotes.filter((n) => mf.some((i) => n.startsWith(`sentence ${i}:`))).join("\n")}\n` : ""}\nReturn JSON edits for every unsupported, speculative, or contradicted sentence in this window.`;
    return callStructuredLLM<any[]>({
      model: "claude-sonnet-4-6", max_tokens: 4000, temperature: 0, system, user, kind: "object", label: "fact-discipline",
      validate: (v) => { const o = v as any; return Array.isArray(o?.edits) ? o.edits : null; },
    });
  }));
  const okResults = results.filter((r) => r.ok);
  if (!okResults.length) { const reason = (results[0] as any)?.reason; console.error(`[fact-check] FAILED reason=${reason} — body unchanged`); return { text: body, status: "failed", reason }; }
  const edits: any[] = okResults.flatMap((r) => (r as any).value as any[]);
  const protectedIdx = new Set<number>([...findRefrains(all.map((x) => x.text)), ...(await protectP)]);
  const must = new Set(mustFix);
  const ageOk = new Set(supportedAgeSentences(all.map((x) => x.text), facts)); // correct ages: hands off
  let rewrites = 0, cuts = 0, orphans = 0, blocked = 0;
  const byKind: Record<string, number> = {};
  const MAX_CUTS = Math.max(5, Math.floor(n * 0.12));
  for (const r of edits.slice(0, 40)) {
    const idx = Number(r?.i);
    if (!Number.isInteger(idx) || idx < 0 || idx >= n) continue;
    const t = all[idx];
    if (!sentsByPara[t.pi] || sentsByPara[t.pi][t.si] !== t.text) continue;
    if (ageOk.has(idx)) { blocked++; continue; }
    // Attribution and figure fixes are accuracy fixes: like a contradiction, they may rewrite a protected
    // voice line (never cut it).
    // Accuracy fixes (a contradiction, a misattribution, a figure clash, any must-fix) often need a
    // clause more than the original (seen live: a 160-char fix for two clashing accounts of how Jones
    // was found was refused against a 150 cap). They get the wider allowance.
    const framing = r?.kind === "attributed" || r?.kind === "figure" || r?.kind === "contradicted" || must.has(idx) || supNotes.some((nt) => nt.startsWith(`sentence ${idx}: gives $`));
    if (protectedIdx.has(idx) && r?.kind !== "contradicted" && !must.has(idx) && !(framing && r?.action !== "cut")) { blocked++; continue; }
    if (r?.action === "cut") {
      if (cuts >= MAX_CUTS) continue;
      orphans += cutWithOrphans(sentsByPara, t.pi, t.si, "accuracy"); cuts++;
    } else {
      const rw = typeof r?.rewrite === "string" ? r.rewrite.trim() : "";
      // An attribution or an explained figure needs a few more words than a plain correction.
      // Short sentences need a fixed allowance, not a ratio (seen live: "More than $78,600 goes to the
      // Social Security Administration." is ~60 chars, so every explanation of the $47,000 was dropped).
      // A short sentence ("Garnished wages.", 16 chars) needs room to be corrected at all.
      const maxLen = framing ? Math.max(t.text.length * 2.4, t.text.length + 220) : Math.max(t.text.length * 1.6, t.text.length + 60);
      if (!rw || rw.length < 8 || rw === t.text) continue;
      if (rw.length > maxLen) { console.log(`[fact-check] refused over-long rewrite (${rw.length} > ${Math.round(maxLen)}): ${rw.slice(0, 120)}`); continue; }
      if (!quoteBalanceKept(t.text, rw)) { blocked++; continue; }
      const misCredit = attributionMismatch(t.text, rw, facts.split("\n"));
      if (misCredit) { blocked++; console.log(`[fact-check] refused rewrite: ${misCredit}`); continue; }
      const newName = introducesUnsupportedName(t.text, rw, facts);
      if (newName) { blocked++; console.log(`[fact-check] refused rewrite: new name "${newName}" not in the research`); continue; }
      if (introducesPipelineWords(t.text, rw)) { blocked++; console.log(`[fact-check] refused rewrite: pipeline words: ${rw.slice(0, 100)}`); continue; }
      sentsByPara[t.pi][t.si] = rw.replace(/\s*(?:—|–|--)\s*/g, ", "); rewrites++;
      if (framing) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
    }
  }
  if (!rewrites && !cuts) { console.log(`[fact-check] sentences=${n} edits=0 mustFix=${mustFix.length} blocked=${blocked}`); return { text: body, status: "ok", edits: 0 }; }
  const rebuilt = sentsByPara.map((ss) => ss.filter(Boolean).join(" ").trim()).filter(Boolean).join("\n\n");
  if (rebuilt.split(/\s+/).length < body.split(/\s+/).length * 0.85) { console.log("[fact-check] backed off — rebuilt too short"); return { text: body, status: "ok", edits: 0 }; }
  console.log(`[fact-check] sentences=${n} rewrites=${rewrites} cuts=${cuts} orphans=${orphans} mustFix=${mustFix.length} blocked=${blocked} framing=${JSON.stringify(byKind)} figures=${figures.length}`);
  return { text: rebuilt, status: "ok", edits: rewrites + cuts };
}

// Overused sentence openers, counted in code (seen in the baseline: "I believe" x7 in one script,
// "Unfortunately for..." x3 in a few minutes). A voice's signature opener is fine at its natural rate;
// past ~2 uses (and ~3% of sentences) it's a tic. Returns the opener and the sentence indices using it.
export function overusedOpeners(sentences: string[]): { opener: string; idx: number[] }[] {
  const by = new Map<string, number[]>();
  sentences.forEach((s, i) => {
    const w = s.trim().replace(/^["“'‘(]+/, "").split(/\s+/).slice(0, 2).join(" ").toLowerCase().replace(/[^a-z' ]/g, "");
    if (w.split(" ").length < 2 || /^(the|a|an|he|she|it|they|and|but|in|on|this|that|there|his|her|what|for|so|then|when|by)\b/.test(w) && !/^(i believe|i think|and that|but that|that is|this is|here is|what makes)/.test(w)) return;
    by.set(w, [...(by.get(w) || []), i]);
  });
  const limit = Math.max(2, Math.round(sentences.length * 0.03));
  return [...by.entries()].filter(([, ix]) => ix.length > limit).map(([opener, idx]) => ({ opener, idx }));
}

// Exact FIGURES stated more than once ("$8,091,843.64" twice, "$3.625 billion" twice): the second
// mention should refer back, not restate. Distinctive figures only (money, or 4+ digit numbers).
export function repeatedFigures(sentences: string[]): { figure: string; first: number; again: number[] }[] {
  const seen = new Map<string, number[]>();
  sentences.forEach((s, i) => {
    for (const m of s.matchAll(/\$\s?\d[\d,]*(?:\.\d+)?(?:\s*(?:million|billion|trillion))?|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/gi)) {
      const k = m[0].replace(/\s+/g, " ").toLowerCase();
      if (k.replace(/[^0-9]/g, "").length < 3) continue;
      seen.set(k, [...(seen.get(k) || []), i]);
    }
  });
  return [...seen.entries()].filter(([, ix]) => new Set(ix).size > 1).map(([figure, ix]) => { const u = [...new Set(ix)]; return { figure, first: u[0], again: u.slice(1) }; });
}
// Repeated SENTENCE SHAPES: the "It wasn't X. It was Y." / "Not X. Y." kicker, and any 4-word sentence
// stem used 3+ times ("This is consistent with what..."). The judge called it "an AI performing profundity".
export function repeatedShapes(sentences: string[]): { shape: string; idx: number[] }[] {
  const out: { shape: string; idx: number[] }[] = [];
  const kick: number[] = [];
  sentences.forEach((s, i) => {
    const prev = sentences[i - 1] || "";
    if (/^(?:it|that|this|he|she|they)\s+(?:was|is|wasn['’]t|isn['’]t)\s+(?:not\s+)?(?:a|an|the|just)?\b/i.test(s) && /\b(?:wasn['’]t|isn['’]t|was not|is not|not)\b/i.test(prev) && s.split(/\s+/).length <= 9) kick.push(i);
  });
  if (kick.length > 2) out.push({ shape: "\"It wasn't X. It was Y.\" kicker", idx: kick });
  const stems = new Map<string, number[]>();
  sentences.forEach((s, i) => { const w = s.toLowerCase().replace(/[^a-z' ]/g, "").split(/\s+/).filter(Boolean); if (w.length >= 6) { const k = w.slice(0, 4).join(" "); stems.set(k, [...(stems.get(k) || []), i]); } });
  for (const [k, ix] of stems) if (ix.length >= 3) out.push({ shape: `"${k}..."`, idx: ix });
  return out;
}

// STRUCTURE PASS — the baseline's lowest craft score was REPETITION (5.2/10): not repeated facts (those
// are guarded) but the same ARGUMENT re-made in fresh words across sections ("stillness was the strategy"
// x4, "costs rose, prices rose faster, the gap is unexplained" x4). Plus false endings, announced
// feelings, overused openers, and a hook promising what the body never delivers. One structural editor
// pass; every cut must cite the EARLIER sentence that already made the point (code verifies it's
// earlier, so the first and strongest statement always survives). Bounded and protected-line aware.
type StructureResult = { text: string; status: "ok" | "failed"; edits?: number };
// CUT SEAMS. Every cutting pass (fact-check, structure, self-review) removes sentences one at a time,
// and a cut can strand its neighbor: "Not years before, not at the start." after the line saying she
// told her husband was cut as a restatement; "A 19-year-old girl, Michigan, mid-1970s." after the
// mug-shot line went (seen live, LeFevre, 21 structure cuts). Phrase lists can't cover every shape, so
// diff the text from before the cutting passes against the result, find each PURE deletion (sentences
// gone with nothing in their place), and return the surviving sentences on either side of it.
const seamNorm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
export function findCutSeams(before: string, after: string): { removed: string[]; prev: number; next: number }[] {
  const A = splitSentences(before.replace(/\n\n+/g, " ")).map(seamNorm);
  const Araw = splitSentences(before.replace(/\n\n+/g, " "));
  const B = splitSentences(after.replace(/\n\n+/g, " ")).map(seamNorm);
  const n = A.length, m = B.length;
  if (!n || !m || n * m > 400_000) return [];
  const L: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m;) { if (A[i] === B[j]) { pairs.push([i, j]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
  const seams: { removed: string[]; prev: number; next: number }[] = [];
  const bounds: [number, number][] = [[-1, -1], ...pairs, [n, m]];
  for (let k = 1; k < bounds.length; k++) {
    const [ia, ib] = bounds[k - 1], [ja, jb] = bounds[k];
    // A pure deletion: sentences dropped from the old text, nothing new inserted at that spot.
    if (ja - ia > 1 && jb - ib === 1) seams.push({ removed: Araw.slice(ia + 1, ja), prev: ib, next: jb < m ? jb : -1 });
  }
  return seams;
}

async function repairCutSeams(before: string, after: string, facts: string): Promise<string> {
  const seams = findCutSeams(before, after).filter((sm) => sm.prev >= 0 || sm.next >= 0).slice(0, 30);
  if (!seams.length) return after;
  const paras = after.split(/\n\n+/);
  const sentsByPara: string[][] = paras.map((p) => splitSentences(p));
  const flat: { pi: number; si: number }[] = [];
  sentsByPara.forEach((ss, pi) => ss.forEach((_, si) => flat.push({ pi, si })));
  const textAt = (i: number) => (i >= 0 && flat[i] ? sentsByPara[flat[i].pi][flat[i].si] : "");
  const list = seams.map((sm, k) => `[${k}]\nPREV: ${textAt(sm.prev) || "(start of script)"}\nREMOVED: ${sm.removed.join(" ")}\nNEXT: ${textAt(sm.next) || "(end of script)"}`).join("\n\n");
  const system = `You check the SEAMS of a YouTube voiceover script after editing passes removed sentences. For each seam you see the sentence before (PREV), what was removed (REMOVED, cut as a repeat or as inaccurate), and the sentence after (NEXT). The removal is final. Your only job: does PREV or NEXT now fail to make sense when heard without REMOVED? Broken means: it has no subject, refers to something only REMOVED said ("Not years before." when REMOVED said when it happened; "The kind that tears." describing a noun only REMOVED had; "Which means..." concluding from REMOVED), answers or continues a line that is gone, or a fragment that only worked after REMOVED. If both read fine, skip the seam. If one is broken, fix THAT sentence so it stands on its own: rewrite it briefly, or cut it if it has nothing left to say. A rewrite may carry over the one detail from REMOVED it needs ONLY if the FACTS below support that detail; never add anything else, never add quote marks. Keep the creator's plain voice. Output ONLY JSON: {"fixes":[{"seam":0,"target":"next","action":"rewrite","text":"..."}]} (target "prev" or "next"; action "rewrite" or "cut"). Usually most seams are fine.`;
  const res = await callStructuredLLM<any[]>({
    model: "claude-sonnet-4-6", max_tokens: 3000, temperature: 0.2, system,
    user: `FACTS (for any detail carried over):\n${facts.slice(0, 40_000)}\n\nSEAMS:\n${list}`,
    kind: "object", label: "seams",
    validate: (v) => (Array.isArray((v as any)?.fixes) ? (v as any).fixes : null),
  });
  if (!res.ok) { console.error(`[seams] FAILED reason=${res.reason}`); return after; }
  let rewrites = 0, cuts = 0, refused = 0;
  const done = new Set<number>();
  for (const f of res.value) {
    const sm = seams[Number(f?.seam)];
    if (!sm) continue;
    const idx = f?.target === "prev" ? sm.prev : sm.next;
    if (idx < 0 || !flat[idx] || done.has(idx)) continue;
    const { pi, si } = flat[idx];
    const orig = sentsByPara[pi][si];
    if (f?.action === "cut") { sentsByPara[pi][si] = ""; cuts++; done.add(idx); continue; }
    const rw = typeof f?.text === "string" ? f.text.trim().replace(/\s*(?:—|–|--)\s*/g, ", ") : "";
    if (!rw || rw === orig || rw.length > orig.length * 2 + 80 || !quoteBalanceKept(orig, rw) || attributionMismatch(orig, rw, facts.split("\n")) || introducesUnsupportedName(orig, rw, facts) || introducesPipelineWords(orig, rw)) { refused++; continue; }
    sentsByPara[pi][si] = rw; rewrites++; done.add(idx);
  }
  console.log(`[seams] checked=${seams.length} rewrites=${rewrites} cuts=${cuts} refused=${refused}`);
  return sentsByPara.map((ss) => ss.filter(Boolean).join(" ").trim()).filter(Boolean).join("\n\n");
}

export async function applyStructurePass(body: string, startedAt: number, opts?: { voiceProfile?: string; facts?: string }): Promise<StructureResult> {
  if (!body || !body.trim()) return { text: body, status: "ok" };
  if (Date.now() - startedAt > 245_000) return { text: body, status: "ok" };
  const paras = body.split(/\n\n+/);
  const sentsByPara: string[][] = paras.map((p) => splitSentences(p));
  const all: { pi: number; si: number; text: string }[] = [];
  sentsByPara.forEach((ss, pi) => ss.forEach((text, si) => all.push({ pi, si, text })));
  const n = all.length;
  if (n < 12) return { text: body, status: "ok" };
  const texts = all.map((x) => x.text);
  const tics = overusedOpeners(texts);
  const protectP = pickProtectedLines(texts, opts?.voiceProfile).catch(() => new Set<number>());
  const system = `You are the structural editor of a YouTube documentary script that will be HEARD, not read. The facts are already checked; do not touch accuracy. Fix only these, in priority order:
1. RESTATED ARGUMENTS (CUT): a sentence that re-makes a point, thesis, or insight the script ALREADY made earlier, even in completely different words (e.g. "his stillness was the strategy" said again later as "staying put is what kept him hidden"). Cut the LATER restatement. For each cut you MUST give "same_as": the index of the EARLIER sentence that already made that point. Never cut the first statement of a point. Never cut a sentence that adds a new fact or a new turn.
1b. RE-TOLD FACTS (CUT or SHRINK): a later sentence that re-explains a FACT an earlier section already delivered (the $800 purchase, who a person is, how a mechanism worked). Code lists likely ones under RE-TOLD below with the earlier sentence; judge each: CUT it (same_as = that earlier index) when it adds nothing; REWRITE it to a few-word back-reference ("that $800 card", "Goodenough, the Phoenix nurse") when the sentence must stay for flow; KEEP it when it adds a new fact or is the story arriving at a moment the opening only flashed forward to.
2. FALSE ENDINGS (CUT): if the script wraps up, then keeps going, then wraps up again, cut the earlier wrap-up lines so it ends ONCE (give "same_as" = the final closing sentence's index).
3. ANNOUNCED FEELINGS (REWRITE or CUT): a line that tells the viewer how to feel or that a moment is powerful ("the detail that stays with you", "this is the part that is genuinely hard to process", "and that is chilling", "it's worth sitting with that"). Rewrite it to simply deliver the content, or cut it.
4. OVERUSED OPENERS (REWRITE): sentences listed under OVERUSED below; rewrite all but the first two to open differently, same meaning.
5. HOOK PROMISE (REWRITE the hook only, sentences 0-2): if the hook promises a reveal or answer the body never delivers, rewrite the hook to promise what the body ACTUALLY delivers. Keep its tension and facts. Leave the hook alone if it is honest.
Keep the voice: every rewrite must sound like the surrounding lines. A rewrite is about the same length. At most 25 edits.
Output ONLY JSON: {"edits":[{"i":<index>,"action":"cut"|"rewrite","type":"restated|retold|ending|feeling|opener|hook|figure|shape","same_as":<earlier index, for cuts>,"rewrite":"<only for rewrite>"}]}`;
  const figs = repeatedFigures(texts);
  const shapes = repeatedShapes(texts);
  // Figure/shape requirements were tried and measured worse (double run, 14 scripts each); the
  // detectors stay for the benchmark's code checks.
  const required: string[] = [];
  // Re-told facts found by code, as HINTS the editor judges (hard requirements measured worse before).
  const retold = retoldFacts(texts, all.map((x) => x.pi)).slice(0, 15);
  const retoldBlock = retold.length ? `RE-TOLD (likely re-explanations of an earlier fact; cut, shrink to a back-reference, or keep if it adds something new):\n${retold.map((r) => `- sentence ${r.i} re-tells sentence ${r.same_as}`).join("\n")}\n\n` : "";
  const user = `${retoldBlock}${required.length ? `REQUIRED (found by code):\n${required.join("\n")}\n\n` : ""}${tics.length ? `OVERUSED OPENERS (rewrite all but the first two of each):\n${tics.map((t) => `- "${t.opener}..." at sentences ${t.idx.join(", ")}`).join("\n")}\n\n` : ""}SCRIPT SENTENCES (index. text), paragraphs separated by blank lines:\n${all.map((x, i) => `${i > 0 && all[i - 1].pi !== x.pi ? "\n" : ""}${i}. ${x.text}`).join("\n")}`;
  const res = await callStructuredLLM<any[]>({
    model: "claude-sonnet-4-6", max_tokens: 5000, temperature: 0, system, user, kind: "object", label: "structure-pass",
    validate: (v) => { const o = v as any; return Array.isArray(o?.edits) ? o.edits : null; },
  });
  if (!res.ok) { console.error(`[structure] FAILED reason=${res.reason} — body unchanged`); return { text: body, status: "failed" }; }
  const protectedIdx = new Set<number>([...findRefrains(texts), ...(await protectP)]);
  const ticIdx = new Set(tics.flatMap((t) => t.idx.slice(2)));
  const figIdx = new Set(figs.flatMap((f) => f.again));
  const shapeIdx = new Set(shapes.flatMap((sh) => sh.idx.slice(1)));
  const lastPara = sentsByPara.length - 1;
  let cuts = 0, rewrites = 0, refused = 0;
  const MAX_CUTS = Math.max(4, Math.floor(n * 0.12));
  const byType: Record<string, number> = {};
  for (const r of (res.value as any[]).slice(0, 25)) {
    const idx = Number(r?.i), type = String(r?.type || "");
    if (!Number.isInteger(idx) || idx < 0 || idx >= n) continue;
    const t = all[idx];
    if (!sentsByPara[t.pi] || sentsByPara[t.pi][t.si] !== t.text) continue;
    if (protectedIdx.has(idx) && !["opener", "figure", "shape"].includes(type)) { refused++; continue; }
    if (type === "hook" && idx > 2) { refused++; continue; }
    if (type === "opener" && !ticIdx.has(idx)) { refused++; continue; }
    if (type === "figure" && !figIdx.has(idx)) { refused++; continue; }
    if (type === "shape" && !shapeIdx.has(idx)) { refused++; continue; }
    if (r?.action === "cut") {
      const same = Number(r?.same_as);
      // A cut must point at a DIFFERENT sentence that made the point: earlier for a restatement,
      // the final close for a false ending. Otherwise it could delete the only statement of a point.
      const valid = type === "ending" ? Number.isInteger(same) && same > idx : Number.isInteger(same) && same < idx && same >= 0;
      if (!valid && type !== "feeling") { refused++; continue; }
      if (cuts >= MAX_CUTS) continue;
      if (cutWithOrphans(sentsByPara, t.pi, t.si) < 0) { refused++; continue; }
      cuts++;
    } else {
      const rw = typeof r?.rewrite === "string" ? r.rewrite.trim() : "";
      if (!rw || rw.length < 8 || rw === t.text || rw.length > t.text.length * 1.8) continue;
      if (!quoteBalanceKept(t.text, rw)) { refused++; continue; }
      if (opts?.facts && introducesUnsupportedName(t.text, rw, opts.facts)) { refused++; continue; }
      sentsByPara[t.pi][t.si] = rw; rewrites++;
    }
    byType[type] = (byType[type] || 0) + 1;
  }
  if (!cuts && !rewrites) { console.log(`[structure] sentences=${n} edits=0 refused=${refused}`); return { text: body, status: "ok", edits: 0 }; }
  const rebuilt = sentsByPara.map((ss) => ss.filter(Boolean).join(" ").trim()).filter(Boolean).join("\n\n");
  if (rebuilt.split(/\s+/).length < body.split(/\s+/).length * 0.82) { console.log("[structure] backed off — rebuilt too short"); return { text: body, status: "ok", edits: 0 }; }
  console.log(`[structure] sentences=${n} cuts=${cuts} rewrites=${rewrites} refused=${refused} retoldHints=${retold.length} ${JSON.stringify(byType)} tics=${JSON.stringify(tics.map((t) => `${t.opener}x${t.idx.length}`))}`);
  return { text: rebuilt, status: "ok", edits: cuts + rewrites };
}

// CHUNKED PATH — assemble the client-written sections into one script object and run the ENTIRE
// generation tail on the whole (finalizeScript). This is the server half of mode:"finalize": the
// client looped mode:"section" (one section per request, none of them running tail passes), then
// hands the assembled sections here so every whole-script silent-fix + safety pass runs exactly
// once, on the joined body. By routing through finalizeScript it CANNOT skip a pass the one-shot
// path runs — they are the same code.
export async function assembleFinalizeScript(
  input: ScriptGenerationInput,
  sections: { title?: string; content?: string }[],
  presetHook: string | null,
): Promise<GeneratedScript> {
  const startedAt = Date.now();
  const clean = (sections || [])
    .filter((s) => s && typeof s.content === "string" && s.content.trim().length > 0)
    .map((s) => ({ title: String(s.title || ""), content: String(s.content).trim() }));
  const body = clean.map((s) => s.content).join("\n\n");
  const title = input.selectedTitle || input.targetTopic || input.sourceTitle || "";
  const script = {
    title,
    hook: presetHook || "",
    fullScript: body,
    script: body,
    body,
    content: body,
    sections: clean,
    sectionwise: true,
  } as unknown as GeneratedScript;
  return finalizeScript(script, input, { startedAt, presetHook });
}

// NOTE (Move #8 #4): a deterministic "seven years -> 2017 to 2024" strip was tried and REVERTED —
// a blind token replace shattered real prose ("For nearly seven years" -> "For from 2017 to 2024",
// dangling "...through 2024. since 2017.") and does not generalize across niches ("for three
// decades", "over eleven months"). Enforcement stays: the prompt COMPUTED DURATION COUNTS rule +
// the grounding check, which already soft-flags a spelled span not present in the facts. A future
// grammar-aware replacer would have to rewrite whole phrases and re-sync the hook, and must be
// verified on live prose before shipping — not a blind string swap.

// Force the body to OPEN on the hook verbatim. Peels as many leading sentences off the
// body as the hook contains (so a paraphrased 1- or 2-sentence opening is replaced, not
// duplicated) and prepends the hook. No-op when the body already starts with the hook.
export function restampHook(body: string, hook: string): string {
  const h = (hook || "").trim();
  if (!h) return body;
  const lead = body.replace(/^\s+/, "");
  if (lead.toLowerCase().startsWith(h.toLowerCase())) return body;
  const hookSentences = (h.match(/[^.!?]+[.!?]["'”’)]?/g) || [h]).length;
  const sentRe = /^\s*[^.!?]*[.!?]["'”’)]?/;
  let rest = lead;
  for (let i = 0; i < hookSentences; i++) {
    const m = rest.match(sentRe);
    if (!m || !m[0].trim()) break;
    rest = rest.slice(m[0].length);
  }
  rest = rest.replace(/^\s+/, "");
  return rest ? `${h} ${rest}` : h;
}

// ---- MOVE #9 fix #2: deterministic detection + GUARDED rewrite of the hook/callback ----
// "Force it, don't ask." Prompt nudges failed ~3 runs (hook opened vague, ending teased). The
// rewrite itself is an LLM call (preview-gated), but the two GUARDS are pure and deterministic:
//   (a) it fires ONLY when detection clearly says the hook is vague / the ending teases — so it
//       never touches a hook/callback that already works;
//   (b) it keeps the ORIGINAL on any rewrite failure or empty/oversized return.
// Worst case is therefore "fails to improve an already-failing hook" — it cannot regress a good
// one. Detection is deliberately CONSERVATIVE (under-fire): a false negative is cheap, a false
// positive touches the finished script.

// A hook is vague when it opens on an abstract windup instead of a concrete image/paradox. Tight
// on purpose — only the specific failing shapes.
export function hookIsVague(hook: string): boolean {
  const h = (hook || "").trim();
  if (!h) return false;
  const first = h.split(/(?<=[.!?])\s/)[0] || h;
  return /\b(something (?:was|kept|had been|felt|is|isn'?t|wasn'?t)\s+(?:quietly|slowly|going|deeply|off|wrong|draining|happening|moving|building|right|not right|adding up)|something (?:strange|odd|off|weird|unusual|suspicious|wrong)\b|there (?:was|is) something\b|something didn'?t (?:add up|feel right|make sense|seem right)|for (?:years|decades|nearly [\w-]+ years|the better part of [\w-]+ years|a (?:long )?(?:time|while))[,\s]+(?:something|a scheme|a system|nobody|no one|few|it)\b|few (?:people )?(?:noticed|realized|knew|understood)|nobody (?:noticed|realized|suspected|knew)\b|no one (?:noticed|suspected)\b|quietly (?:draining|operating|building|happening|slipping|moving)|in the shadows|beneath the surface|behind the scenes,?\s+(?:something|a\b))/i.test(first);
}

// A hook FACT-DUMPS when it hands over the explanation in the opening — the mechanism nouns
// (bots, AI, fraud, scheme, indictment) or the precise money figure. That leaves no curiosity
// gap: the hook answers its own question, which is exactly why even Skripr's "good" number-led
// hooks don't pull and why the open-loop check correctly flags "nothing deferred". The fix is to
// make the hook WITHHOLD the payoff (lead with the strange situation), not to loosen the check.
export function hookDumpsPayoff(hook: string, opts?: { allowMoney?: boolean }): boolean {
  const h = (hook || "");
  const mechanism = /\b(bots?|bot accounts?|artificial intelligence|\bA\.?I\.?\b|fraud\w*|scheme|indict\w+|laundered|money laundering|algorithm|shell compan\w+)\b/i.test(h);
  // A money/number lead is only a "payoff dump" when the payoff IS the figure (a fraud's scale, the
  // total stolen). For a stat/data/curiosity/controversy archetype the creator DELIBERATELY leads
  // with the number — that price or percentage IS the curiosity hook, not a spoiled reveal — so the
  // caller passes allowMoney to skip the money trigger and stop rewriting a correctly number-led hook.
  const money = opts?.allowMoney ? false : /[$£€]\s?\d|\b\d+(?:\.\d+)?\s*million\b|\bmillion dollars\b/i.test(h);
  return mechanism || money;
}

// An ending fails when it TEASES a follow-up ("what happened next", "who assembled it", "where
// this case takes a turn the charging documents don't explain") instead of landing on a concrete
// sourced fact. Fires only when it teases AND does not land.
export function endingTeasesWithoutLanding(closing: string): boolean {
  const c = (closing || "");
  const teases = /\b(what (?:happened|comes|came) (?:next|after|to)|who (?:assembled|built|was behind|else was)|more consequential than|not what anyone expected|the (?:real )?question (?:remains|is|becomes)|remains? to be seen|only time will tell|what (?:investigators|prosecutors|they) (?:found|discovered|would find)|still (?:out there|unanswered)|may never (?:be )?know|(?:where|when) (?:this|the) (?:case|story|investigation) (?:takes?|took|turns?|turned|goes|went)|takes? a (?:direction|turn)|the charging documents (?:don'?t|do not) (?:explain|say|cover)|that'?s where (?:it|this|the story))\b/i.test(c);
  if (!teases) return false;
  const lands = /\b(forfeit\w*|pleaded guilty|pled guilty|guilty plea|convicted|sentenced|settlement|verdict|judgment|restitution|ordered to pay)\b/i.test(c) || /[$£€]\s?\d|\b\d[\d,]{2,}\b/.test(c);
  return !lands;
}

// Detect paragraphs that OPEN by restating an earlier paragraph's opening figure or line — the
// "Ten thousand accounts. That number comes directly from the indictment." drumbeat repeated
// across sections that trips the padding check. Signature = the opener's leading number, else its
// first five normalized words. Returns the indices of the REPEATS (the later occurrences).
export function repeatedOpeners(paras: string[]): number[] {
  const seen = new Map<string, number>();
  const repeats: number[] = [];
  paras.forEach((p, i) => {
    const t = (p || "").trim();
    if (!t) return;
    const firstSent = t.split(/(?<=[.!?])\s/)[0] || t;
    const num = firstSent.match(/\b\d[\d,]*(?:\.\d+)?\b/);
    const sig = num ? `n:${num[0].replace(/,/g, "")}` : `w:${firstSent.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 5).join(" ")}`;
    if (sig.length <= 2) return;
    if (seen.has(sig)) repeats.push(i);
    else seen.set(sig, i);
  });
  return repeats;
}

// Guarded LLM rewrite of one paragraph whose opener repeats an earlier one — reword ONLY the
// opening so it does not restate the same figure/line, keeping the paragraph's content. Null on failure.
async function rewriteRepeatedOpener(paragraph: string, startedAt: number): Promise<string | null> {
  if (Date.now() - startedAt > 252_000) return null;
  try {
    const msg = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      temperature: 0.4,
      system: "You lightly edit one paragraph of a documentary script. Output ONLY the edited paragraph as plain prose — no label, no quotes.",
      messages: [{ role: "user", content: `This paragraph opens by RESTATING a figure/line the script already opened an earlier section with (a repetitive drumbeat). Rewrite ONLY its opening sentence so it does NOT lead with that same number or the same "that number comes from the indictment" restatement — open it a different way and move straight into the section's substance. Keep every fact and the rest of the paragraph. Invent nothing. If the paragraph does NOT actually open by restating an earlier figure or line, output it UNCHANGED. Never comment on the paragraph or the request.

Paragraph:
${paragraph}` }],
    });
    const t = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    return t || null;
  } catch { return null; }
}

// GUARD (pure): is a rewrite usable? Non-empty, not absurdly long, not a refusal/echo.
export function isUsableRewrite(s: string | null | undefined, maxWords = 70): boolean {
  const t = (s || "").trim();
  if (!t) return false;
  const w = t.split(/\s+/).length;
  if (w < 3 || w > maxWords) return false;
  if (/^(i (?:can'?t|cannot|won'?t)|as an ai|sorry|here('?s| is)\b)/i.test(t)) return false;
  // Model commentary about the request instead of prose (seen live 2026-10-07: "Wait — the paragraph you've shared
  // contains no restated figure..." landed in a Jones script). Reject it so the original paragraph is kept.
  // Also seen in testing: "I need to see the actual paragraph you want me to edit. You've only shared a scene heading".
  if (/^(wait|note:|hmm|i need (?:to see )?(?:the|a|an|more))\b|\b(you(?:'?ve| have)? (?:only )?(?:shared|provided|given|sent)|the paragraph (?:you|provided|above)|(?:paragraph|text) (?:you want|to edit)|this paragraph (?:does|doesn'?t|already)|no (?:change|edit)s? (?:is |are )?needed|as requested)\b/i.test(t)) return false;
  return true;
}
// GUARD (pure): the hook/ending to actually use — the rewrite only when usable, else the original.
export function chooseRewrite(original: string, rewritten: string | null | undefined, maxWords = 70): string {
  return isUsableRewrite(rewritten, maxWords) ? (rewritten as string).trim() : original;
}

// LLM rewrite of ONLY the hook (preview-gated). Targeted, device-from-facts, defers the payoff,
// respects the voice. Returns null on any failure so the guard keeps the original.
async function rewriteVagueHook(originalHook: string, sourceMaterial: string | undefined, voiceProfile: string | undefined, startedAt: number, hookType?: string): Promise<string | null> {
  if (Date.now() - startedAt > 245_000) return null;
  const facts = (sourceMaterial || "").slice(0, 2200);
  if (!facts.trim()) return null;
  try {
    const msg = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 260,
      temperature: 0.7,
      system: "You rewrite the cold-open hook of a documentary script. Output ONLY the new hook as plain speakable prose — no label, no quotes, no commentary.",
      messages: [{ role: "user", content: `The current hook FAILS because it opens on a vague windup instead of a concrete image, or it hands over the answer instead of creating a mystery ("${originalHook}"). Rewrite it so it opens on something concrete and WITHHOLDS the explanation.
${hookType ? `\nHOOK ARCHETYPE (serve this — it is the shape the creator chose): ${hookType}. Honor its mechanic — a curiosity/data hook may lead with the striking figure, a myth-bust opens by naming the belief it will break, a reframe flips an assumption, a question hook poses the question. Do NOT convert every archetype into the same paradox opener.\n` : ""}
FACTS (use ONLY these; invent nothing):
${facts}

The MECHANIC to reproduce is: open on the strangest concrete thing the facts give you, then STOP before explaining it — make the viewer ask "how is that possible?" That mechanic is the only thing to copy from any example; it is NOT a template for the wording.

Rules for the new hook (2 to 4 short sentences, at most ~55 words):
- VARY THE OPENER. Do NOT default to the word "Imagine" — it is one option among many and it is overused. Open however the archetype and the facts land hardest: a bare paradox, a concrete scene, the striking figure itself, the belief you are about to break, a direct question. Reach for the opener that fits THIS hook, not a reflex.
- LEAD WITH THE STRANGE, CONCRETE THING drawn from the facts — the specific image, contradiction, or figure that makes the viewer ask "how is that possible?" — never a vague abstract windup ("something was quietly changing").
- WITHHOLD THE MECHANISM. Do NOT name the cause or the how in the hook (no "because", no explanation of the driver). The hook states the situation; the video answers it. (A number the archetype is built on may stay; the EXPLANATION of it may not.)
- BUILD WITH RHYTHM where it helps — a short accumulating list can land hard.
- Use only what the facts state; invent nothing.${voiceProfile ? `\n- Render the wording in this creator's voice, but keep the withholding. If the voice never uses second person ("imagine you..."), do NOT use it: ${voiceProfile.slice(0, 400)}` : ""}` }],
    });
    const t = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    return t || null;
  } catch { return null; }
}

// LLM rewrite of ONLY the final beat (preview-gated) so it lands on a concrete sourced fact
// instead of a cliffhanger tease. Returns null on failure.
async function rewriteTeasingEnding(originalEnding: string, hookText: string, sourceMaterial: string | undefined, startedAt: number): Promise<string | null> {
  if (Date.now() - startedAt > 250_000) return null;
  const facts = (sourceMaterial || "").slice(0, 2000);
  if (!facts.trim()) return null;
  try {
    const msg = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 220,
      temperature: 0.4,
      system: "You rewrite the final beat of a documentary script. Output ONLY the new closing beat as plain speakable prose — no label, no quotes.",
      messages: [{ role: "user", content: `The current ending TEASES an unresolved follow-up instead of landing: "${originalEnding}". Rewrite the final beat.

HOOK it should call back to: "${hookText}"
FACTS (use ONLY these):
${facts}

The new ending (1 to 3 sentences, short and hard):
- RETURN to the concrete image or thread from the hook.
- LAND on a REAL sourced fact: the settled figure, the guilty plea, the documented outcome. No cliffhanger, no "what happened next", no teased revelation.
- Use only what the facts state. Stop on the strongest line.` }],
    });
    const t = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    return t || null;
  } catch { return null; }
}

export interface HookGenerationInput {
  topic: string;
  niche: string;
  tone: string;
  count?: number;
  // Few-shot block of real, high-performing hooks for this niche (with their
  // actual view counts), built by getNicheHookExamplesBlock. When present, the
  // model models new hooks on proven winners and calibrates retention scores
  // against real performance instead of guessing.
  nicheFrameworks?: string;
  // Hooks creators actually kept/copied for this niche (feedback loop), built
  // by getKeptHooksBlock. The strongest signal — proven by real taste, not just
  // views — so it's weighted above the view-based examples.
  keptHooks?: string;
}

export interface GeneratedHook {
  text: string;
  type: string;
  predictedRetention: number;
  reasoning: string;
}

export async function generateHooks(input: HookGenerationInput): Promise<GeneratedHook[]> {
  const count = input.count || 10;

  // Learning layer: when we have real high-performing hooks captured for this
  // niche, show them as few-shot examples AND use their view counts to anchor
  // the predicted-retention scores, so scores reflect real performance bands
  // instead of an uncalibrated guess.
  const keptBlock = input.keptHooks
    ? `
HOOKS CREATORS ACTUALLY KEPT IN THIS NICHE — the strongest signal there is: real creators generated many options and chose to USE these. They reflect proven taste for this audience. Weight these above everything else — match their voice, rhythm, and opening move (never their exact wording):
${input.keptHooks}
`
    : "";

  const learningBlock = input.nicheFrameworks
    ? `
${keptBlock}
PROVEN HOOKS FROM THIS NICHE — real, high-performing videos with their actual view counts. Study what makes them work (the tension, the specificity, the opening move) and write NEW hooks that use the same mechanics on this topic. Never copy their wording, names, or numbers — only their structure and energy:
${input.nicheFrameworks}

RETENTION CALIBRATION — score each hook's predictedRetention against these real winners, not on a curve:
- A hook whose mechanics closely match a proven high-view example here earns a high score (85-95).
- A solid hook using a known pattern but with less tension or specificity sits mid (68-82).
- A generic, vague, or warmup-style opener scores low (45-65).
Do NOT inflate scores. Most hooks are average; reserve 90+ for hooks that genuinely rival the proven examples above.
`
    : `
${keptBlock}
RETENTION CALIBRATION — be honest and conservative. Reserve 85+ only for hooks with sharp tension, hyper-specific detail, and an irresistible open loop. Generic or warmup-style openers must score in the 45-65 range. Do NOT inflate scores.
`;

  const userPrompt = `Generate ${count} YouTube video hooks for:
Topic: "${input.topic}"
Niche: ${input.niche}
Tone: ${input.tone}

Use one of these proven hook types (set "type" to the matching name):
${HOOK_TYPES_PROMPT}
${learningBlock}
For each hook, provide:
- The exact hook text (what the creator says in the first 5-10 seconds)
- The hook type
- Predicted retention score (0-100) — how many viewers will stay past the hook (calibrated per the rules above)
- Brief reasoning for why this hook works

Output JSON array:
[
  {
    "text": "string",
    "type": "string",
    "predictedRetention": number,
    "reasoning": "string"
  }
]

Sort by predictedRetention descending.`;

  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response");
  const hooks = extractJSON(content.text, "array") as GeneratedHook[];
  if (!Array.isArray(hooks)) throw new Error("Expected an array of hooks");
  return hooks;
}

export interface MetadataGenerationInput {
  script: string;
  title: string;
  niche: string;
  targetKeywords?: string[];
}

export interface GeneratedMetadata {
  titles: string[];
  description: string;
  tags: string[];
  thumbnailText: string[];
  hashtags: string[];
  // PACKAGING ENGINE: the shared brief every asset is generated from, plus the single recommended
  // title. All optional so older callers/UI keep working.
  videoDna?: {
    centralStory?: string;
    primaryEntities?: string[];
    coreConflict?: string;
    mostSurprisingFact?: string;
    strongestNumber?: string;
    timeElement?: string;
    stakes?: string;
    viewerPromise?: string;
    openLoops?: string[];
  };
  packagingAngle?: string;
  coreHookWhy?: string;
  bestTitle?: string;
  bestTitleWhy?: string;
  strategy?: string;
  bestTitleScores?: { curiosity?: number; clarity?: number; specificity?: number; accuracy?: number; browse?: number; search?: number; overall?: number };
  searchWinner?: string;
  thumbnailWinner?: string;
}

export async function generateMetadata(input: MetadataGenerationInput): Promise<GeneratedMetadata> {
  const currentYear = new Date().getFullYear();
  // Learned from Outlier Finder: the story engines + packaging templates that recurred
  // among real over-performers in this niche. Guides the packaging angle, never dictates it.
  const learnedPatterns = await getNicheOutlierPatterns(input.niche);

  const userPrompt = `You are a YouTube PACKAGING engineer. Do NOT write the assets independently. FIRST extract the video's story, then pick ONE packaging angle, then generate every asset (titles, description, tags, thumbnail text, hashtags) FROM that same brief, each optimized for its own YouTube job. The whole package must feel like one intentional thing built around one story, not five separate generations.

VIDEO INFO:
Title: "${input.title}"
Niche: ${input.niche}
Script (first 2000 chars):
"""
${input.script.slice(0, 2000)}
"""
${input.targetKeywords ? `Target keywords: ${input.targetKeywords.join(", ")}` : ""}
Current year: ${currentYear}
${learnedPatterns ? `\n${learnedPatterns}\nUse these only as structural guidance for the packaging angle and titles when they genuinely fit THIS story — imitate the shape, never the wording, and never bend the true story to match a pattern.\n` : ""}
━━━ STEP 1: VIDEO DNA (extract from the script and title, ground everything else in it) ━━━
Fill each field from ONLY what the script/title support, invent nothing:
- centralStory: one sentence, what the video is actually about
- primaryEntities: the exact names/subjects a viewer would type into search (people, orgs, events)
- coreConflict: the central tension or contradiction
- mostSurprisingFact: the single most striking true detail
- strongestNumber: the most compelling real figure from the script, or "" if none
- timeElement: any span/date that adds weight ("20 years", "2017 to 2024"), or ""
- stakes: what was at risk / who was affected
- viewerPromise: what the viewer gets by watching
- openLoops: the 2 to 4 unanswered questions the story raises that a viewer would want resolved (who found her, how did they recognize her, why did investigators miss her, how did she hold the identity). These are the strongest raw material for browse titles and thumbnails, a title can POSE one of these loops without answering it

━━━ STEP 2: CORE HOOK ━━━
In one sentence ("packagingAngle"), the single most sellable framing of this story, the hook every asset points at (e.g. "the wanted fugitive hiding behind an ordinary suburban identity"). Choose the framing the DNA best supports, not the flashiest. Then in one sentence ("coreHookWhy"), say WHY it is the strongest hook, leading with the SINGLE sharpest contradiction (e.g. wanted fugitive vs ordinary suburban life), not a mix of several details.
NO ABSOLUTES IN THE HOOK: do not end the hook on an unverifiable universal like "and no one noticing", "nobody knew", "fooling everyone". State the DOCUMENTED outcome instead: "while maintaining the identity for 23 years" or "until her identity was uncovered in 1999". The documented outcome is stronger and safer than a universal claim.

━━━ FACTUAL INHERITANCE (hard rule, inherited from the script) ━━━
No title, thumbnail, or description may claim MORE than the script establishes. No invented outcome, superlative, number, causal link, or "first/biggest/only" the script does not support. A packaging angle SHARPENS the true story, it never upgrades it. If the script does not establish it, the package cannot assert it.
CLASSIFICATION DISCIPLINE (labels matter, especially for real people): a loaded label ("terrorist", "killer", "fraudster", "extremist", "predator") may be used ONLY at the level the script/record supports. Distinguish a VERIFIED descriptor (the record states it as fact), a LEGAL/HISTORICAL allegation (indicted, charged, accused, alleged, suspected), and an EDITORIAL characterization (your framing). If the record only alleges or indicts, the package must say "indicted for", "accused of", "alleged", never state the flat verified label as settled fact. When unsure, use the more precise, less absolute wording. This is the packaging engine, so an aggressive label that outruns the record is a real legal and factual problem, not just a style note.
SAME FOR SUPERLATIVES AND RANKINGS: do not introduce "most wanted", "first", "biggest", "deadliest", "worst", "#1", or any ranking/superlative unless the script explicitly establishes it. "FBI's Most Wanted" is a specific status; use it only if the source says so, otherwise "wanted by the FBI".

━━━ STEP 3: TITLES (exactly 10, each PREFIXED with SEARCH:, BROWSE:, or HYBRID:) ━━━
${EXPERT_ATTRIBUTION_RULE}
COUNT IS MANDATORY: output EXACTLY 10 titles — EXACTLY 4 SEARCH, then EXACTLY 4 BROWSE, then EXACTLY 2 HYBRID. Not 5/4/1, not 4/5/1 — 4/4/2. Before you finish, COUNT the HYBRID titles: there must be two. Every title delivers the packaging angle, but each uses a DIFFERENT archetype so these are 10 distinct concepts, never 10 rewrites of one line.
ONE SHARED STORY SPINE, THREE DISCOVERY CONTEXTS: all three buckets derive from the SAME video DNA and the SAME documented facts — they never invent different facts. They optimize for different contexts only: SEARCH answers "who is this?" (carry the searchable entities), BROWSE answers "why should I care?" (the story's contradiction and stakes), HYBRID answers "both". The factual core is identical across all ten; only the framing changes.

SEARCH (first 4): keyword-AWARE, not a keyword string. Include the strongest searchable entity or topic naturally in the first 5 words, under 60 characters, but it must still read like a title a human would click, never a search query. "Kathleen Soliah SLA fugitive caught after 20 years hiding" is a query and is WRONG; "How Kathleen Soliah Hid From the FBI for 20 Years" carries the same entities and is right. Rotate archetypes across the four: Entity + Investigation ("how they were found"), Entity + Hidden Life, Entity + Time span, Entity + Event.
BROWSE (next 4): curiosity, contradiction, or stakes, no keyword stuffing, 6 to 11 words, opens a loop the viewer must click to close. Rotate archetypes: Hidden Identity, Ordinary vs Extraordinary, Time ("They vanished for 20 years. Then..."), Unexpected Discovery, Contradiction.
HYBRID (last 2): a recognizable entity plus a curiosity/story promise, works on both surfaces. It must keep a real curiosity mechanism, never just an informational label. "Kathleen Soliah Hid in Plain Sight for 20 Years. Then TV Exposed Her." works (name + specificity + curiosity + payoff tease); "The SLA Fugitive Who Was Caught by a Television Broadcast" is too flat, it only informs.

CONCRETE OVER GENERIC (applies to every title): a specific image beats a vague claim. "Raised three kids while the FBI searched for her" beats "fooled everyone for two decades"; give the viewer a picture, not an abstraction. Cut generic filler like "fooled everyone", "shocking truth", "you won't believe".
DO NOT SPOIL A TWIST: if the video's payoff is a late REVERSAL — an unexpected verdict, who-won, a surprise the viewer wouldn't predict — the title must set up the premise/stakes WITHOUT revealing which way it resolves. "The Hijacker Who Won His Case in Court" spoils it; "He Hijacked a Plane in 1972. 41 Years Later They Found Him." withholds it. An EXPECTED outcome ("how X was caught") is fine to state; only a genuine reversal must be held back.
STRONGEST CONCRETE CONTRADICTION (the best packaging move, model the bestTitle on this): the strongest titles pair TWO DOCUMENTED specifics in tension and deliver the story's core absurdity concisely and accurately — the story's own contradiction, not an adjective, is the hook. "How a Pipe-Bomb Suspect Hid as a Church Volunteer for 23 Years" works because it frames the fugitive method with documented specifics — the criminal status (pipe-bomb SUSPECT) against the ordinary role (church volunteer) plus the real duration — in one clean line. Build from the sharpest documented role/identity contrast the facts give you (fugitive vs suburban mom, wanted vs churchgoer), and never reach for "insane/notorious/shocking" when the true contrast already carries it. A concise, accurate contradiction beats a hype word every time.
LEGAL-STATUS + CLAIM-SCOPE PRECISION (hard): match the documented status and never upgrade involvement into a specific physical act. "pipe-bomb suspect" or "wanted in a pipe-bomb case" — NOT "she planted pipe bombs" unless the record says she personally placed them; "won an extradition ruling" not "beat the FBI"; "convicted in connection with a killing" not "killed". Use the less specific, accurate wording when unsure.
INDICTMENT IS NOT CONVICTION: "indicted for bombing" reads as an established act/conviction. Prefer "indicted in a bombing case" / "wanted for a bombing" / "charged in connection with". Keep the accusation an accusation.
ONE CANONICAL DURATION: if the facts contain more than one defensible span (e.g. 23 and 24 years from 1975 to 1999), pick ONE and use it consistently across EVERY title, thumbnail, and the description. Never mix spans across assets, and never invent a span outside the facts.
NARRATIVE-COMPRESSION LADDER for the discovery/exposure beat: "a TV broadcast helped end her 23-year disappearance" or "a TV broadcast exposed her identity" are acceptable (the qualifier / the accurate verb keep them honest); "a TV show found/caught/ended it" overstates the cause. Keep the qualifier.
NUMERIC CONSISTENCY (hard): every number in a title — a duration, age, year, count, dollar amount — must match a number in the researched facts. Never adjust one to sound better (if the facts say 23 years, never write 28). An invented or altered number is a factual error, not a style choice.
BUT NOT HYPER-SPECIFIC TRIVIA: do not jam a precise factual detail into a title just because it is in the script. The editorial test for ANY specific detail (in a title, thumbnail, or the description) is NOT "is this interesting?" but "does this detail strengthen the video's central promise?" A house size (five-bedroom), a neighborhood name (St. Paul), a docket number, an exact address almost never strengthen the hook, they just make it longer. "disappeared into suburbia for two decades" beats "disappeared into a five-bedroom Tudor". Reject a title whose main distinguishing feature is an incidental detail, and never recommend one as the best title.
STRICT IDENTITY: use a person's EXACT name or verified alias as the script gives it. Do not compress or invent a familiar form ("Sara" for "Sara Jane Olson"), and do not assert a name/alias the script does not establish. Avoid unwarranted second person: "lived next door and nobody knew" beats "lived next door to YOU and nobody knew" unless the story is genuinely about the viewer. Do NOT assign a gender, name, role, or identity to an UNNAMED person the script leaves unspecified: if the record says "a television viewer recognized her" without saying who, write "a TV viewer did", never "HE didn't" or "a man recognized her". An invented "he", "she", or role is an unsupported specific, same as an invented number.
FACTUAL COHERENCE (hard): every title must accurately characterize what happened and make logical sense. Do not mischaracterize the event to sound punchy: "a TV viewer recognized her" is accurate, "a TV viewer solved the indictment" is not. And do not write a contradiction that does not parse ("20 YEARS. NO HIDING." is nonsense). If a punchy phrasing distorts the fact or reads as a non-sequitur, use the accurate version.
NO ABSOLUTE / EXCLUSIVITY CLAIMS (hard, verified in code — a title that trips this is dropped as the recommended pick): never "fooled everyone", "no one noticed", "nobody knew", "the FBI missed her", "never left the country", or any universal/geographic claim the facts don't establish. Use the documented outcome: "living in Minnesota", "without her identity being uncovered until 1999", "she wasn't recognized for 23 years". The documented version is both safer and stronger.
NO TABLOID COMPRESSION OF THE OFFENSE: match the documented legal wording. "wanted for bombing police cars" or "indicted for planting pipe bombs" (if the record supports personal placement) — not the loose "bombing cops". Keep the offense precise.
NO INVENTED ORDINARY-LIFE DETAIL: the "ordinary role" half of a contradiction must be documented. "became a suburban mom" / "church volunteer" only if the facts state it; do NOT invent "joined the PTA", "ran a book club", "coached little league", "drove carpool", "coached the team" for color. Use ONLY the documented roles (e.g. mother of three, community theater actor, church volunteer, doctor's wife) — never a plausible-sounding activity the facts don't state. An invented ordinary activity is an unsupported specific exactly like an invented number. Also do not swap a documented role for a different or narrower one: "acted in community theater" is not "coached community theater", and "church volunteer" is not "church choir" (choir is a specific role the facts don't state). Keep the documented role's exact scope.

━━━ STEP 4: PACKAGING PICKS + SCORES ━━━
Do not just list titles, make the packaging call:
- "bestTitle": the single strongest overall title, verbatim, no SEARCH/BROWSE/HYBRID prefix. Judge on click-through, curiosity, clarity, accuracy, and thumbnail pairing. Prefer a title built on the story's strongest DOCUMENTED CONTRADICTION with concrete specifics (like the pipe-bomb-suspect / church-volunteer example) over one leaning on a hype adjective; specificity and an accurate contrast should win.
- "strategy": the bestTitle's packaging strategy in a few words (e.g. "Contradiction + identity mystery", "Entity + hidden life", "Reversal + ticking clock").
- "bestTitleWhy": one short sentence on why it wins.
- "bestTitleScores": integer 0-10 for curiosity, clarity, specificity (concrete verifiable anchors vs generic adjectives), accuracy (does not overstate or invent), browse, search, and overall. Score every dimension HONESTLY (a browse-first title may genuinely be a 5 on search, keep that, it is useful information — a low search score means the title is built for Browse, not that the package is weak). But "overall" is the GOAL-DEPENDENT PACKAGING SCORE: how strong this title is as packaging FOR ITS OWN STRATEGY, NOT a flat average. Do NOT let a deliberately low search score drag it down when the title is browse-first: a strong browse title with search 5 should still score about 9 overall, because it is doing its job. Weight overall toward the surface the title is built for.
- "searchWinner": the single best SEARCH title (verbatim, no prefix) for someone actively searching this topic.
- "thumbnailWinner": the thumbnail-text option (verbatim, from your thumbnailText list) that best COMPLEMENTS the bestTitle, forming one package. It must add the mystery or the sharp moment the title does NOT already state, never repeat the title's own contrast. If bestTitle is "She Planted Bombs. Then She Coached Community Theater.", do NOT pick "BOMBS. THEN BOOK CLUB." (same contrast restated), pick one that adds a new layer like "WANTED. UNDETECTED." Title says what happened; thumbnail says the mystery.

━━━ STEP 5: DESCRIPTION (sounds like the creator typed it, never a keyword paragraph) ━━━
The first 2 to 3 sentences appear ABOVE the fold and are indexed most heavily by YouTube search, so front-load the core hook and the primary entity naturally.
Structure, each block separated by a blank line:
- 2 to 3 sentence opening: the core hook plus the primary entity, compelling and keyword-natural. Prioritize the strongest SEARCH ENTITIES and the STORY, not an exhaustive list of facts. Apply the same editorial test as the titles: an incidental detail (a docket number, a house size, a neighborhood name, a minor date) that does not strengthen the central promise does NOT belong here, however interesting it is. ATTRIBUTE ALLEGATIONS PRECISELY: keep the documented legal status (indicted for, accused of, alleged, linked to, implicated in) and do not compress several allegations into an implied personal act. "indicted in connection with pipe bombs and linked to a bank-robbery murder" is correct; wording that lets the reader assume she personally planted the bombs or fired the shot is not. Do NOT characterize the investigation as a failure ("how investigators failed to find her"); use the neutral documented framing ("why investigators couldn't locate her for more than two decades", "how investigators eventually tracked her down").
- a short block on what the viewer will discover (the promise, the stakes)
- one line of channel-appropriate CTA (subscribe, or a related-video nudge)
- final line: 3 to 5 relevant hashtags
DO NOT include timestamps, chapter markers, "0:00 Intro" lines, or a chapter list anywhere in the description. This video has no timestamps.

━━━ STEP 6: TAGS (about 20, plain text, NO # prefix, entity-first taxonomy) ━━━
Build a search/entity map from the Video DNA, not a keyword dump. Work the tiers in order, then dedupe and drop anything not truly about this video:
- Tier 1, primary entities: the exact names/subjects from the DNA (people, orgs, events), plus their closest exact-match forms
- Tier 2, core topic: the subject the video covers
- Tier 3, name and search variants: alternate names and forms a viewer might type ("X case", "X FBI", a person's other known name)
- Tier 4, long-tail viewer queries: specific questions people search ("how X was caught", "where X was hiding")
- Tier 5, accurate adjacent context: closely related concepts that genuinely describe the video
Every tag must be truthful to the script. DEDUPE AND PRIORITIZE, do not pad: drop near-duplicates that add no new search coverage (keep "Kathleen Soliah" and the alternate name "Sara Jane Olson", but you do not need "Kathleen Soliah story", "Kathleen Soliah arrest", AND "how Kathleen Soliah was caught" all at once, keep the one or two strongest). Fewer, distinct, high-value tags beat 20 filler phrases. Spell every entity name EXACTLY correctly (this matters most in tags and hashtags, a misspelled name is a dead tag).

━━━ STEP 7: THUMBNAIL TEXT (exactly 5 options, max 4 words each) ━━━
Thumbnail text drives CTR on Browse and Suggested. Each option should:
- Create an open loop or strong emotion
- Work WITHOUT seeing the video
- Be specific over generic (numbers beat adjectives)
- Obey the same factual rules as titles: no absolutes and no institutional-failure framing. "THE FBI MISSED HER" assigns failure the record doesn't establish; use "THE FBI COULDN'T FIND HER" or "23 YEARS. NO ARREST." A contradiction pair ("WANTED. VOLUNTEERING.") is ideal only if both halves are documented.

QUOTE-FIRST THUMBNAIL TEXT (do this whenever the script allows it): the single best thumbnail text is a SHORT VERBATIM QUOTE spoken by someone in the story, taken word for word from the script above. Three words in someone's actual voice ("YOU A COP?") beats any phrase you could write, because it is real, it is specific, and it makes the viewer hear a person rather than read a label. Scan the script for quoted speech and lead your options with the sharpest one that fits in four words. Never invent a quote or alter its wording to fit; if the script has no quoted speech, write normal thumbnail text instead.

THUMBNAIL AND TITLE MUST NOT SAY THE SAME THING. They are two halves of one information gap: the title names the ordeal ("How an ATF Agent Survived the Mongols' Loyalty Test"), the thumbnail shows the sharpest moment ("YOU A COP?"). Together they pose a question the video answers. If an option merely restates words already in the title, replace it.
EACH OPTION MUST PARSE AND EARN ITS PLACE. Prefer a clean, instantly-readable contradiction or image ("HIDING IN PLAIN SIGHT", "BOMBS. THEN BOOK CLUB.") over a literal or awkward line. Avoid the merely literal ("TV SHOW CAUGHT HER") and the non-sequitur ("20 YEARS. NO HIDING." does not parse). If a line needs the video to make sense, cut it.

━━━ STEP 8: HASHTAGS (3 to 5 only, each prefixed with #) ━━━
YouTube only surfaces the first few, and a long list reads as spam. Use 3 to 5, no more: primary subject, primary topic, then the broader niche. Do not pad to a number.

━━━ VOICE: WRITE LIKE A PERSON, NOT A MARKETING BOT (critical) ━━━
This metadata is published under the creator's name, so it has to sound like they typed it.
- NEVER use an em dash or en dash anywhere (— or –). Use a comma, or start a new sentence. This applies to titles, the description, thumbnail text, everything.
- No exclamation points. No emojis. No ALL-CAPS words for hype.
- Banned hype words: unlock, unleash, supercharge, revolutionary, game-changer, ultimate guide, dive in, delve, elevate, harness, leverage, seamless, effortless, transform your, secrets revealed.
- Contractions always (don't, you'll, it's). Plain everyday words over corporate ones.
- No fabricated numbers. Never invent a statistic, dollar figure, study, or percentage that is not in the script above.
- Write the description in short blocks of 2 to 3 sentences, the way a creator actually writes, not one dense keyword paragraph.

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON, no markdown fences. Fill videoDna and packagingAngle FIRST, then generate the rest from them:
{
  "videoDna": { "centralStory": "...", "primaryEntities": ["..."], "coreConflict": "...", "mostSurprisingFact": "...", "strongestNumber": "...", "timeElement": "...", "stakes": "...", "viewerPromise": "...", "openLoops": ["...", "..."] },
  "packagingAngle": "one-sentence core hook every asset points at",
  "coreHookWhy": "one sentence on why it is the strongest hook",
  "titles": ["SEARCH: [title]", "SEARCH: [title]", "SEARCH: [title]", "SEARCH: [title]", "BROWSE: [title]", "BROWSE: [title]", "BROWSE: [title]", "BROWSE: [title]", "HYBRID: [title]", "HYBRID: [title]"],
  "bestTitle": "the single recommended title, verbatim, no prefix",
  "strategy": "the packaging strategy in a few words",
  "bestTitleWhy": "one short sentence",
  "bestTitleScores": { "curiosity": 9, "clarity": 9, "specificity": 9, "accuracy": 10, "browse": 9, "search": 7, "overall": 9 },
  "searchWinner": "the single best SEARCH title, verbatim, no prefix",
  "thumbnailWinner": "the single strongest thumbnail-text option, verbatim",
  "description": "Full description following STEP 5 (no timestamps, no chapters)",
  "tags": ["tier1 entity", "tier1 entity", "core topic", "search variant", "search variant", "long tail query", "long tail query", "long tail query", "adjacent context", "adjacent context"],
  "thumbnailText": ["OPTION 1", "OPTION 2", "OPTION 3", "OPTION 4", "OPTION 5"],
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}`;

  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3200,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response");
  const metadata = extractJSON(content.text, "object") as GeneratedMetadata;

  // Post-process: strip any # prefixes
  metadata.tags = metadata.tags.map(tag => tag.replace(/^#+/, "").trim());

  // Belt-and-suspenders over the voice rules above, same as the script pass does.
  // Metadata is published under the creator's name, so a stray em dash is a tell.
  // Dashes become commas (their usual job is a clause break), then the cleanup
  // passes fix the fallout: doubled commas, a comma stranded before punctuation,
  // and a dash that ended the line.
  const deDash = (s: string) => s
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*([.!?,;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .replace(/,$/, "");

  metadata.titles = (metadata.titles || []).map(deDash);
  metadata.thumbnailText = (metadata.thumbnailText || []).map(deDash);
  metadata.tags = metadata.tags.map(deDash);
  if (typeof metadata.bestTitle === "string") metadata.bestTitle = deDash(metadata.bestTitle);
  if (typeof metadata.searchWinner === "string") metadata.searchWinner = deDash(metadata.searchWinner);
  if (typeof metadata.thumbnailWinner === "string") metadata.thumbnailWinner = deDash(metadata.thumbnailWinner);

  // Deterministic factual gate on the packaging titles — the SAME validator Viral Magnet
  // uses. A title that trips a warning (fabricated/altered number, absolute exclusivity like
  // "fooled everyone", causal overreach like "a TV show found her", institutional-failure
  // framing, or a scope upgrade) must not be the RECOMMENDED pick. We keep every title in the
  // list (the creator can still choose one), but never let bestTitle or searchWinner carry a
  // warning when a clean alternative exists. Titles may still carry a SEARCH/BROWSE/HYBRID prefix.
  {
    const stripBucketPrefix = (s: string) => s.replace(/^\s*(SEARCH|BROWSE|HYBRID)\s*:\s*/i, "").trim();
    const pkgSource = `${input.title}\n${input.script.slice(0, 4000)}`;
    // NON-DESTRUCTIVE. We never remove titles from the list — the creator sees every
    // option. We only make sure the RECOMMENDED picks (bestTitle + searchWinner) don't
    // lead with a clear PHRASE-BASED factual problem (an absolute like "the whole time"
    // / "nobody thought to look", a causal overreach like "broadcast ended it", a scope /
    // attachment / label error, or over-length). If a pick trips one, swap it for a
    // clean alternative already in the list. We deliberately IGNORE the number rule here
    // (it false-positives on thin sources that don't restate a real year/duration — that
    // is what collapsed the list before) and interpretive "institutional" framing (a
    // fair, creator-judgeable call). Titles carry a SEARCH/BROWSE/HYBRID prefix.
    const phraseFlagged = (s?: string) =>
      !!s && validateTitle(stripBucketPrefix(s), pkgSource).some((w) => w.type !== "institutional" && w.type !== "number");
    const cleanAlts = (metadata.titles || []).filter((t) => !phraseFlagged(t));
    if (phraseFlagged(metadata.bestTitle) && cleanAlts.length) {
      metadata.bestTitle = stripBucketPrefix(cleanAlts[0]);
    }
    if (phraseFlagged(metadata.searchWinner) && cleanAlts.length) {
      const altSearch = cleanAlts.find((t) => /^\s*SEARCH\s*:/i.test(t)) || cleanAlts[0];
      metadata.searchWinner = stripBucketPrefix(altSearch);
    }
    // Same non-destructive rule for the recommended thumbnail: keep the full thumbnail
    // list, but if the WINNER leads with a flagged claim ("23 YEARS. NEVER FOUND." — she
    // was found), pair the title with a clean option from the list instead.
    if (phraseFlagged(metadata.thumbnailWinner)) {
      const cleanThumb = (metadata.thumbnailText || []).find((t) => !phraseFlagged(t));
      if (cleanThumb) metadata.thumbnailWinner = cleanThumb;
    }
  }
  // Belt-and-suspenders tag dedup: drop exact case-insensitive duplicates the model may have emitted
  // despite the dedup instruction (keeps first occurrence, preserves order).
  {
    const seen = new Set<string>();
    metadata.tags = (metadata.tags || []).filter((t) => {
      const k = t.toLowerCase().trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  if (typeof metadata.description === "string") {
    // Belt-and-suspenders: chapters/timestamps are removed from this feature, so strip any line the
    // model still emitted that is a timestamp/chapter marker ("0:00 Intro", "1:23 - The Turn"),
    // then clean each surviving line and collapse the blank lines the removal can leave behind.
    const isTimestampLine = (l: string) => /^\s*\(?\d{1,2}:\d{2}(?::\d{2})?\)?\s*[-–—:.)]?\s*\S/.test(l) || /^\s*(chapters?|timestamps?)\s*:?\s*$/i.test(l);
    metadata.description = metadata.description
      .split("\n")
      .filter((line) => !isTimestampLine(line))
      .map((line) => (line.trim() ? deDash(line) : ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return metadata;
}
