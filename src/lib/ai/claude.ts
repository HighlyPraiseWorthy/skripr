import { Anthropic } from "@anthropic-ai/sdk";
import { fingerprintToBrief, readProhibitions, stripStandaloneTics, type VoiceFingerprint } from "@/lib/voice-metrics";
import { buildStorytellingBlock } from "@/lib/storytelling";
import { stripInsinuations, stripImpliedRevelation, dedupeAdjacentParagraphs, collapseRepeatedAnchors, stripSchemeDurationClaim, stripStaleFutureDates, stripSourceLeaks } from "@/lib/script-compliance";
import { buildVarietyBlock } from "@/lib/ai/phrase-variety";

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  }
  return _anthropic;
}

export interface ScriptGenerationInput {
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

const buildSystemPrompt = ({ softCta = false, sourceVerdict, topicKind = "event" }: { softCta?: boolean; sourceVerdict?: "documented" | "partial" | "unverified"; topicKind?: "event" | "explainer" | "hypothetical" | "claim" } = {}) => `You are Skripr's AI script engine. You specialize in writing YouTube scripts for faceless channels that are optimized for retention, algorithm performance, and AI voice (TTS) delivery.

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
4. CTA PLACEMENT: ${softCta
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
  sourceMaterial?: string;
  voiceProfile?: string;
}): Promise<string | null> {
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
${input.hookWhyItWorks ? `\nWHY THE SOURCE'S HOOK WORKED (reproduce this mechanism, not its wording): ${String(input.hookWhyItWorks).slice(0, 400)}` : ""}
${input.hookScript ? `\nThe source's own opening, for shape only — never reuse its wording: "${String(input.hookScript).slice(0, 200)}"` : ""}
${input.sourceMaterial ? `\nSOURCED FACTS — any number or specific you use must come from here, exactly as stated:\n${input.sourceMaterial.slice(0, 2500)}` : ""}
${input.voiceProfile ? `\nWRITE IT IN THIS CREATOR'S VOICE:\n${input.voiceProfile.slice(0, 900)}` : ""}
${retryNote ? `\nYOUR PREVIOUS ATTEMPT FAILED: ${retryNote} Fix that.` : ""}

Rules:
- Do NOT restate the title or the thesis. The viewer just read the title; repeating it carries zero new information.
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

// Write one section against its own brief. Small, focused calls: the model has one job,
// one word budget, and the beats that belong here — nothing to trade the structure against.
export async function writeSection(
  spec: SectionSpec,
  index: number,
  total: number,
  context: { topic: string; title: string; sourceMaterial?: string; previousTail: string; recipe?: string; voice?: string },
): Promise<string> {
  const msg = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: Math.min(8000, spec.targetWords * 3 + 800),
    temperature: 0.8,
    system: `You write one section of a YouTube voiceover script IN A SPECIFIC CREATOR'S VOICE. The voice is not a finishing touch — it is how you write every sentence from the first word. Output ONLY that section's prose — no headings, no labels, no commentary, no JSON. Plain speakable text. NEVER use these generic narrator tics, in any variation: "read that again", "pause on that", "sit with that", "let that sink in", "think about what that means", "here's the thing", "that's not a metaphor", or "That's not X. That's Y." They belong to no creator and mark writing as machine-made.`,
    messages: [{
      role: "user",
      content: `VIDEO: "${context.title}"
TOPIC/ANGLE: ${context.topic}
${context.recipe ? `\nTHE SOURCE VIDEO'S RECIPE (this remix follows it): ${context.recipe}\n` : ""}
YOU ARE WRITING SECTION ${index + 1} OF ${total}: "${spec.name}"
ITS JOB IN THE VIDEO: ${spec.purpose || "advance the argument"}
LENGTH: about ${spec.targetWords} words. This is a budget, not a suggestion — stay within about 10%.
REACH THAT LENGTH BY ELABORATION, NEVER BY REPETITION. Hit the word budget by going DEEPER on the facts you have: explain the mechanism in causal, step-by-step detail; unpack what a figure means in real economic and human terms (against a normal comparison, who gained, who lost and how much); render the key moment as a scene, beat by beat; place it in its context and precedent. That is how a good narrator fills the time. Do NOT restate a number, name, or claim you have already made — repeating "the same figure" three times is padding and will be cut. And never invent a fact to reach length: every specific still comes only from the source material. If you are short, deepen an existing fact; do not repeat one and do not make one up.
${spec.isPeak ? `THIS IS THE PEAK OF THE VIDEO. It is the longest section by design. Slow down, go beat by beat, and let it breathe. Do not summarize what happens here — render it.\n` : ""}
${spec.triggers.length ? `RETENTION BEATS THAT BELONG IN THIS SECTION (place them here, reproduce the MECHANIC not the wording):\n${spec.triggers.map((t) => `- ${t}`).join("\n")}\n` : ""}
${context.previousTail ? `THE SECTION BEFORE THIS ONE ENDED LIKE THIS (continue naturally, never repeat it):\n"...${context.previousTail}"\n` : "This is the OPENING section — it carries the hook.\n"}
${context.sourceMaterial ? `\nSOURCE MATERIAL — every specific you state must come from here. Do not add a number, name, date, or claim that is not present:\n${context.sourceMaterial.slice(0, 5000)}\n` : ""}
${context.voice ? `\nWRITE THIS ENTIRE SECTION IN THIS CREATOR'S VOICE — their sentence rhythm, fragment use, diction, energy and way of addressing (or not addressing) the viewer. Obey their never-does absolutely:\n${context.voice.slice(0, 1600)}\n` : ""}

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
      const text = await writeSection(plan[i], i, plan.length, { ...context, previousTail });
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
${input.companionCta
  ? `COMPANION VIDEO CTA: End the script with a brief, natural call to action that points viewers to a RELATED video on this channel, phrased so it is true whether the creator places it on the end screen or in the description — e.g. "that video is either above this one right now or linked in the description." Keep the reference GENERAL — do NOT invent a specific title or topic for that video.`
  : `NO COMPANION VIDEO: The creator may not have a related video to point to. Do NOT reference, tease, or claim that another video exists on this channel — no "watch my other video", "the next video is already waiting", "the video right after this", "above this one", or "linked in the description". Close instead with only a subscribe / comment / apply-this-now style CTA.`}
${input.voiceProfile ? `
CREATOR VOICE PROFILE — this creator's audience knows their voice; the script must sound like THEM, not like a generic narrator. Follow this profile for rhythm, diction, energy, humor, address, transitions, and CTA style. It overrides the generic Tone setting AND the default paragraph/sentence-rhythm formatting above: match THIS creator's sentence length, fragments, pacing, and pattern interrupts even if that means short punches and choppy lines. Sounding like this creator is the priority. THE PROFILE'S "NEVER-DOES" LIST IS ABSOLUTE and outranks every generic craft rule in this prompt, including the explainer-form defaults: if it says this creator never addresses the viewer as "you", never opens on a rhetorical question, or never editorializes, then your script does not do those things either, no matter what a general rule above recommends. Negative space is what makes a voice recognisable. It NEVER overrides the banned-phrases list, the anti-fabrication rule, the no-sponsor rule, or the voiceover-only rule (plain speakable prose, no bracketed markers):

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
    system: buildSystemPrompt({ softCta: !!input.softCta, sourceVerdict: input.sourceVerdict, topicKind: input.topicKind }),
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
  const bodyKey = ["fullScript", "script", "body", "content"].find(
    (k) => typeof (script as any)[k] === "string" && (script as any)[k].trim().length > 0,
  );

  // LENGTH BACKSTOP (runs FIRST, so the passes below act on the final-length text). One place for
  // every path — the one-shot blob, the one-shot section build, and the chunked build. Long
  // scripts only (>= 1200 target words); extendScriptToLength is itself a no-op unless the body is
  // under 88% of target, so a script already at length pays nothing.
  const targetWords = input.targetMinutes ? Math.round(input.targetMinutes * 130) : null;
  if (targetWords && targetWords >= 1200 && bodyKey) {
    try {
      const before = (script as any)[bodyKey].split(/\s+/).filter(Boolean).length;
      (script as any)[bodyKey] = await extendScriptToLength((script as any)[bodyKey], targetWords, input.targetTopic || "", input.targetNiche || "", startedAt);
      const after = (script as any)[bodyKey].split(/\s+/).filter(Boolean).length;
      if (after !== before) console.log(`[extend] field=${bodyKey} target=${targetWords} before=${before} after=${after}`);
    } catch (e) {
      console.error("[extend] backstop failed, keeping assembled body:", e);
    }
  }

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
  if (hookText && (hookIsVague(openerText) || hookDumpsPayoff(openerText))) {
    const rewritten = await rewriteVagueHook(hookText, input.sourceMaterial, input.voiceProfile, startedAt);
    const withholds = isUsableRewrite(rewritten, 60) && !hookDumpsPayoff((rewritten as string).trim());
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
  const applyBodyPass = (fn: (t: string) => { text: string; cuts: string[] }, tag: string) => {
    for (const k of ["fullScript", "script", "body", "content", "outro"]) {
      const cur = (script as any)[k];
      if (typeof cur === "string" && cur.trim()) {
        const { text, cuts } = fn(cur);
        if (cuts.length) { (script as any)[k] = text; autoCuts.push(...cuts.map((c) => `${tag}: ${c}`)); }
      }
    }
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
  // Source-leak CUT first — a leaked proper noun from the source video's story is a fabrication
  // about this subject; remove it before anything else reasons about the body.
  applyBodyPass((t) => stripSourceLeaks(t, input.sourceEntities, input.sourceMaterial), "source-leak");
  applyBodyPass(dedupeAdjacentParagraphs, "dedupe");
  // De-repetition: collapse an anchor fact drummed 3+ times across the whole body, keeping the
  // elaborated instances and cutting the bare restatements. Runs after dedupe (adjacent copies
  // already gone) and on the assembled body, so it catches an anchor spread across sections.
  applyBodyPass(collapseRepeatedAnchors, "repetition");
  applyBodyPass(stripSchemeDurationClaim, "duration");
  applyBodyPass((t) => stripStaleFutureDates(t, nowMs), "stale-date");

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
    (script as any)._autoCuts = [...new Set(autoCuts)]; // internal record, never shown to the user
    console.log(`[safety] silently cut ${autoCuts.length} accuracy/safety line(s) (insinuation + trailing implied-revelation)`);
  }

  return script;
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
export function hookDumpsPayoff(hook: string): boolean {
  const h = (hook || "");
  const mechanism = /\b(bots?|bot accounts?|artificial intelligence|\bA\.?I\.?\b|fraud\w*|scheme|indict\w+|laundered|money laundering|algorithm|shell compan\w+)\b/i.test(h);
  const money = /[$£€]\s?\d|\b\d+(?:\.\d+)?\s*million\b|\bmillion dollars\b/i.test(h);
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
      messages: [{ role: "user", content: `This paragraph opens by RESTATING a figure/line the script already opened an earlier section with (a repetitive drumbeat). Rewrite ONLY its opening sentence so it does NOT lead with that same number or the same "that number comes from the indictment" restatement — open it a different way and move straight into the section's substance. Keep every fact and the rest of the paragraph. Invent nothing.

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
  return true;
}
// GUARD (pure): the hook/ending to actually use — the rewrite only when usable, else the original.
export function chooseRewrite(original: string, rewritten: string | null | undefined, maxWords = 70): string {
  return isUsableRewrite(rewritten, maxWords) ? (rewritten as string).trim() : original;
}

// LLM rewrite of ONLY the hook (preview-gated). Targeted, device-from-facts, defers the payoff,
// respects the voice. Returns null on any failure so the guard keeps the original.
async function rewriteVagueHook(originalHook: string, sourceMaterial: string | undefined, voiceProfile: string | undefined, startedAt: number): Promise<string | null> {
  if (Date.now() - startedAt > 245_000) return null;
  const facts = (sourceMaterial || "").slice(0, 2200);
  if (!facts.trim()) return null;
  try {
    const msg = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 260,
      temperature: 0.5,
      system: "You rewrite the cold-open hook of a documentary script. Output ONLY the new hook as plain speakable prose — no label, no quotes, no commentary.",
      messages: [{ role: "user", content: `The current hook FAILS because it hands over the answer instead of creating a mystery ("${originalHook}"). Rewrite it to WITHHOLD.

FACTS (use ONLY these; invent nothing):
${facts}

The best hooks work like this benchmark, which leads with a paradox and withholds the explanation: "Imagine opening Spotify and discovering one of the biggest artists in the world has billions of streams. Except there is no superstar. No concerts. No fans. No human audience at all. The music is mostly AI. And the listeners? They're bots." It makes you ask HOW before it ever explains.

Rules for the new hook (2 to 4 short sentences, at most ~55 words):
- LEAD WITH THE STRANGE SITUATION OR PARADOX drawn from the facts — the thing that makes no sense and makes the viewer ask "how is that possible?" (e.g. a song playing that no human ever chose to hear; an artist with millions of streams and zero fans). NOT the biggest number.
- WITHHOLD THE EXPLANATION. Do NOT put the mechanism or the payoff in the hook: no "bots", no "AI", no "fraud", no "scheme", no "indictment", no dollar figure. Those are the reveal — save them for later. The hook states the mystery; the video answers it.
- BUILD WITH RHYTHM where it helps — an accumulating list of absences lands hard ("No fans. No concerts. No human audience.").
- Use only what the facts state; invent nothing.${voiceProfile ? `\n- Render the wording in this creator's voice, but keep the paradox and the withholding. If the voice never uses second person ("imagine you..."), do NOT use it: ${voiceProfile.slice(0, 400)}` : "\n- You may address the viewer directly (\"Imagine opening Spotify...\") — it pulls the viewer in."}` }],
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
}

export async function generateMetadata(input: MetadataGenerationInput): Promise<GeneratedMetadata> {
  const currentYear = new Date().getFullYear();

  const userPrompt = `You are a YouTube SEO and algorithm expert. Generate metadata that optimizes for all three YouTube discovery surfaces: Search, Browse (home feed), and Suggested Videos.

VIDEO INFO:
Title: "${input.title}"
Niche: ${input.niche}
Script (first 1200 chars):
"""
${input.script.slice(0, 1200)}
"""
${input.targetKeywords ? `Target keywords: ${input.targetKeywords.join(", ")}` : ""}
Current year: ${currentYear}

━━━ TITLES (generate exactly 10) ━━━
${EXPERT_ATTRIBUTION_RULE}

The three YouTube discovery surfaces need different title strategies:

SEARCH titles (first 4) — These surface when users type queries into YouTube search.
Rules: Primary keyword in the first 5 words. Under 60 characters. Informational framing.
Example pattern: "How to [keyword] in [timeframe]" or "[Keyword]: [specific benefit]"

BROWSE titles (next 4) — These surface on home feeds and recommendations.
Rules: Lead with emotion, curiosity, or a specific number. No keyword stuffing. 
Create an open loop the viewer must click to close. 7-10 words.
Example pattern: "I [did X] for [N days] and [surprising result]" or "The [thing] nobody tells you about [topic]"

HYBRID titles (last 2) — Work for both surfaces.
Rules: Primary keyword present but framed as a curiosity gap or personal result.

━━━ DESCRIPTION ━━━
The first 2-3 sentences appear ABOVE the fold (before Show More) and are indexed most heavily by YouTube search. Front-load the primary keyword naturally.

Structure:
- Sentence 1: Hook + primary keyword (what this video is about, make it compelling)
- Sentence 2-3: Secondary keywords + what viewer will learn/get
- [blank line]
- Timestamps (if applicable): 0:00 Intro, etc.
- [blank line]
- 2-3 related resource links or channel info
- [blank line]
- End with exactly 3 relevant hashtags on the final line

━━━ TAGS (exactly 20, plain text, NO # prefix) ━━━
Tags determine which "topic cluster" YouTube places your video in — affecting Suggested Videos placement alongside similar content.

Tag strategy:
- Tags 1-3: Exact match primary keyword and its closest variations (these are your anchor tags)
- Tags 4-10: Long-tail phrases (3-5 words) that viewers actually search — be specific
- Tags 11-16: Niche category terms that major channels in this space would use (cluster-matching tags)
- Tags 17-20: Broad discovery terms that expand reach beyond the core audience

━━━ THUMBNAIL TEXT (exactly 5 options, max 4 words each) ━━━
Thumbnail text drives CTR on Browse and Suggested. Each option should:
- Create an open loop or strong emotion
- Work WITHOUT seeing the video
- Be specific over generic (numbers beat adjectives)

QUOTE-FIRST THUMBNAIL TEXT (do this whenever the script allows it): the single best thumbnail text is a SHORT VERBATIM QUOTE spoken by someone in the story, taken word for word from the script above. Three words in someone's actual voice ("YOU A COP?") beats any phrase you could write, because it is real, it is specific, and it makes the viewer hear a person rather than read a label. Scan the script for quoted speech and lead your options with the sharpest one that fits in four words. Never invent a quote or alter its wording to fit; if the script has no quoted speech, write normal thumbnail text instead.

THUMBNAIL AND TITLE MUST NOT SAY THE SAME THING. They are two halves of one information gap: the title names the ordeal ("How an ATF Agent Survived the Mongols' Loyalty Test"), the thumbnail shows the sharpest moment ("YOU A COP?"). Together they pose a question the video answers. If an option merely restates words already in the title, replace it.

━━━ HASHTAGS (exactly 10, each prefixed with #) ━━━
Mix: 3 niche-specific, 4 topic-specific, 3 broad discovery

━━━ VOICE: WRITE LIKE A PERSON, NOT A MARKETING BOT (critical) ━━━
This metadata is published under the creator's name, so it has to sound like they typed it.
- NEVER use an em dash or en dash anywhere (— or –). Use a comma, or start a new sentence. This applies to titles, the description, thumbnail text, everything.
- No exclamation points. No emojis. No ALL-CAPS words for hype.
- Banned hype words: unlock, unleash, supercharge, revolutionary, game-changer, ultimate guide, dive in, delve, elevate, harness, leverage, seamless, effortless, transform your, secrets revealed.
- Contractions always (don't, you'll, it's). Plain everyday words over corporate ones.
- No fabricated numbers. Never invent a statistic, dollar figure, study, or percentage that is not in the script above.
- Write the description in short blocks of 2 to 3 sentences, the way a creator actually writes, not one dense keyword paragraph.

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON, no markdown fences:
{
  "titles": ["SEARCH: [title]", "SEARCH: [title]", "SEARCH: [title]", "SEARCH: [title]", "BROWSE: [title]", "BROWSE: [title]", "BROWSE: [title]", "BROWSE: [title]", "HYBRID: [title]", "HYBRID: [title]"],
  "description": "Full description following the structure above",
  "tags": ["exact match keyword", "keyword variation", "keyword 2", "long tail phrase 1", "long tail phrase 2", "long tail phrase 3", "long tail phrase 4", "long tail phrase 5", "long tail phrase 6", "long tail phrase 7", "niche category 1", "niche category 2", "niche category 3", "niche category 4", "niche category 5", "niche category 6", "broad term 1", "broad term 2", "broad term 3", "broad term 4"],
  "thumbnailText": ["OPTION 1", "OPTION 2", "OPTION 3", "OPTION 4", "OPTION 5"],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8", "#tag9", "#tag10"]
}`;

  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
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
  if (typeof metadata.description === "string") {
    // Preserve the blank-line structure of the description, clean each line.
    metadata.description = metadata.description
      .split("\n")
      .map((line) => (line.trim() ? deDash(line) : ""))
      .join("\n");
  }

  return metadata;
}
