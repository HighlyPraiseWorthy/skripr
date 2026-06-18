import { Anthropic } from "@anthropic-ai/sdk";
import { buildStorytellingBlock } from "@/lib/storytelling";

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
  companionCta?: boolean;
  // Storytelling engine: narrative mode id + the resolved technique ids the
  // script should weave in. When omitted, the route auto-selects. Rendered into
  // the prompt via buildStorytellingBlock.
  storytellingMode?: string;
  storytellingTechniques?: string[];
  // Creator-provided research / source material (pasted articles, notes, or
  // auto-sourced facts). The script MAY state specific facts/numbers/studies
  // that appear here; anything not in it still obeys the anti-fabrication rule.
  sourceMaterial?: string;
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

const SYSTEM_PROMPT = `You are Skripr's AI script engine. You specialize in writing YouTube scripts for faceless channels that are optimized for retention, algorithm performance, and AI voice (TTS) delivery.

Your scripts follow these principles:
1. HOOK: First 5 seconds must grab attention using one of the proven hook types defined in the HOOK RULES section below (Cold Open, Question, Data Drop, Provocation, Curiosity Gap, Myth-Bust, Bold Claim, Direct Address, Teaser, Pattern Interrupt, Scene-Setter, Story).
2. RETENTION BEATS: Use three precision mechanics — not generic pattern interrupts:
   a) RE-HOOK AT 0:30: The 30-second cliff is the #1 drop-off point. Place a hard re-hook at the 30-second mark — a new tension, a surprising pivot, or a "but here's what nobody tells you" moment. This is mandatory, not optional.
   b) ESCALATING OPEN LOOPS: Place open loops at the 1/3 and 2/3 points of the script. The 2/3 loop must be more urgent and higher-stakes than the 1/3 loop — escalate intensity, don't just repeat the pattern. The viewer must feel it would be a mistake to stop now.
   c) CALLBACK THREADING: Plant at least one seemingly throwaway detail or curious aside in the first 20% of the script. Return to it and pay it off in the final 20%. This creates the "I can't believe that came back" moment that drives shares and rewatch.
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
4. CTA PLACEMENT: Don't wait until the end. Place a soft CTA at the 60-70% mark where retention typically drops, then a hard CTA at the end.
5. STRUCTURE: Follow the exact structural pattern of the source viral video but apply it to the new topic.
6. ANTI-REPETITION: Never start two consecutive sentences with the same word. Vary sentence length — mix short punchy sentences with longer ones. Never repeat a key point already made; build forward only.
7. NO FABRICATED FACTS: Never state a specific statistic, percentage, dollar figure, year, named study, or named survey unless it appears in the provided source material. Use soft framing instead: "research suggests", "studies have shown", "experts estimate". Never attribute a quote or claim to a named real person unless it was in the source material. A creator will read this on camera — an invented number destroys their credibility.

${EXPERT_ATTRIBUTION_RULE}

7. NO SPONSORS, ADS, OR PROMOS (critical): The source transcript may contain sponsor reads, ad segments, or promotions for a product, app, brand, charity, newsletter, course, Patreon, donation match, or affiliate offer (e.g. "this video's sponsor", "use code X", "go to brand.com", "first-time donors", "link in the description"). These are NOT part of the video's content — they are a paid insertion belonging to a different creator's deal. Completely ignore and exclude them. Never name the sponsor, never reproduce the ad slot, never write a "and that's why I want to mention [brand]" segment, never invent your own sponsor read. Treat the transcript as if the sponsored portions were never there. The script you output must contain ZERO brand names, products, or promotional asks other than the channel's own subscribe/like CTA.

7. ORIGINAL METAPHORS — COPYRIGHT-SAFE BUT BOLD (critical): Metaphors, analogies, comparisons, and catchphrases are the original creative expression of whoever wrote the source. Reusing one is plagiarism even when the facts around it are public. So: NEVER reuse, lightly reword, or closely paraphrase any metaphor, analogy, vivid comparison, opening image, or signature phrase that appears in the provided source material. If the source compares an allergy to "a spider in your bedroom and a nuclear bomb," you must NOT use spiders, bedrooms, or nuclear bombs at all — invent a completely different image for that idea.
   This is NOT a license to be bland. The opposite: invent your OWN bold, surprising, concrete metaphors that hook the viewer just as hard. Every script should have 2-4 of these original comparisons — a familiar everyday thing reframed in a shocking or vivid way (the kind of line a viewer screenshots). Make them yours: different domain, different objects, different picture than anything in the source, but every bit as memorable. Creativity is required; copying someone else's creativity is forbidden.

7. VARIETY ROTATION — BANNED PHRASES (never use any of these, ever):
"Here's the thing", "But here's the thing", "Here's the deal", "Here's what's crazy",
"Wait until you see this", "You won't believe what happens next", "And that's where it gets interesting",
"Now here's where it gets good", "The truth is", "The reality is", "At the end of the day",
"Think about it", "Let that sink in", "That's right", "You heard that correctly",
"Mind-blowing", "Game-changer", "This changes everything", "This is huge",
"Stick around", "Stay with me", "Bear with me", "Trust me on this one".

Instead, use these SLOT ALTERNATIVES by position in the script:

SLOT 1 — HOOK PIVOT (replacing "Here's the thing"):
"What most people miss is—" / "The part nobody talks about:" / "What actually happens is—" /
"The real story is simpler than you think." / "Except it's not what you expect." /
"The problem starts earlier than that." / "That assumption is exactly wrong." /
"Most advice skips this entirely." / "The data tells a different story."

SLOT 2 — TENSION BUILD (replacing "Wait until you see this"):
"It gets worse." / "That's not even the surprising part." / "Now watch what happens." /
"The next part is where most people quit." / "This is where it breaks down." /
"And this is the part that actually matters." / "Pay attention to this next bit." /
"The shift happens here." / "Everything changes at this point."

SLOT 3 — COUNTERINTUITIVE REVEAL:
"Counterintuitively—" / "The opposite turned out to be true." / "The data showed something unexpected." /
"That logic has a flaw." / "Flip it around." / "Most people get this backwards." /
"The evidence points the other way." / "That's where the assumption breaks." /
"What actually drives this is—"

SLOT 4 — EXAMPLE INTRO (replacing "For example"):
"Take [X]." / "Look at what happened with [X]." / "A real case: [X]." /
"[X] ran this exact experiment." / "This played out with [X]." /
"The clearest version of this is [X]." / "Case in point—" / "[X] learned this the hard way."

SLOT 5 — CONSEQUENCE/STAKES:
"The downstream effect:" / "What that costs you:" / "Over 12 months, that compounds." /
"Multiply that by a year." / "That gap widens fast." / "The compounding here is brutal." /
"Left unchecked, that becomes—" / "That single habit determines—"

SLOT 6 — SOLUTION PIVOT:
"The fix is less obvious than you'd expect." / "The lever is smaller than people think." /
"One change moves everything." / "The adjustment is counterintuitive." /
"Most solutions target the symptom. This targets the cause." /
"The answer isn't more — it's different." / "Strip it back to this one thing:"

SLOT 7 — PROOF/CREDIBILITY:
"The research is consistent here:" / "Multiple studies point to the same thing:" /
"Practitioners who've done this for years say—" / "The pattern shows up across industries." /
"This has been tested extensively." / "The evidence is hard to ignore:"

SLOT 8 — CALL TO ACTION (replacing "Stay till the end"):
"Test this today." / "One thing to try this week:" / "Start with just this one piece." /
"The fastest way to see this work:" / "Apply this before anything else." /
"The entry point is simpler than you think." / "You can implement this in one sitting."

SLOT 9 — OUTRO/CLOSE (replacing "That's it for today"):
"That's the framework." / "Now you have the full picture." / "You know what most people don't." /
"The next step is yours." / "Start with step one." / "That's the whole system." /
"Everything else builds on this."

Rotate through these alternatives. Never use the same phrase twice in a single script.

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

9. SCRIPT FORMATTING (critical): Format the fullScript as full, flowing paragraphs — like a polished documentary narration read aloud. Each paragraph is 3 to 5 sentences that build one idea completely before the blank line. Vary sentence length WITHIN the paragraph for rhythm. Do NOT chop the script into a stack of one-line fragments: avoid standalone single-sentence paragraphs, and never use two-or-three-word dramatic fragments as their own paragraph (e.g. "A year later." / "That turned out to be wrong." / "So the mystery deepens." on their own line is a FAILURE). Reserve a rare one-line paragraph for a single genuine punch per segment at most. The goal is smooth, confident flow, never choppy. A content segment must still be multiple paragraphs, but each paragraph must be substantial.

CRITICAL: Never use em dashes (—) anywhere in the script output. Use commas, periods, or colons instead.

Output valid JSON matching the specified schema. Be specific and actionable. No fluff.`;


/**
 * Safely extract JSON from a Claude text response.
 * Claude often wraps JSON in ```json code blocks or appends
 * explanatory text (with { } characters) before/after the JSON block.
 */
function extractJSON(text: string, kind: "object" | "array"): unknown {
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
async function extendScriptToLength(fullScript: string, targetWords: number, topic: string, niche: string, startedAt: number): Promise<string> {
  const count = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const words = count(fullScript);
  if (words >= targetWords * 0.8) return fullScript;
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
    messages: [{ role: "user", content: `Topic: ${topic}\nNiche: ${niche}\n\nScript so far (conclusion removed):\n\n${body}\n\nThis script is ${words} words; the final target is ${targetWords} words. Write approximately ${Math.min(needed, 1500)} words of NEW body segments that will be inserted before the conclusion. Each segment must open with a re-hook (open loop, pattern interrupt, or raised stakes) and go deep: concrete examples, story beats, specific detail. Format as full flowing paragraphs of 3-5 sentences each, like documentary narration. Do NOT chop into one-line fragments or stacks of single-sentence paragraphs, and do NOT write one giant paragraph either. Do NOT write any conclusion, callback, or wrap-up. Do NOT repeat existing content.` }],
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
Video length: ${targetWords ? `${input.targetMinutes} minutes (~${targetWords} words spoken aloud)` : lengthGuide[input.videoLength]}
${targetWords && targetWords >= 1200 ? `
CRITICAL LENGTH REQUIREMENT — scripts shorter than ${targetWords} words are FAILURES:
- Structure the body as ${Math.max(4, Math.ceil((input.targetMinutes || 10) / 3))} distinct segments of roughly ${Math.round(targetWords / Math.max(4, Math.ceil((input.targetMinutes || 10) / 3)))} words EACH.
- Open every segment with a re-hook: an open loop, a pattern interrupt, or raised stakes.
- Inside every segment, go deep before moving on: one concrete example, one story beat, AND one piece of evidence or specific detail. Never compress or summarize a point you can expand.
- Do NOT begin any conclusion, callback, or wrap-up until the cumulative word count has reached ${targetWords} words.
- A segment is NOT one paragraph. Break every segment into multiple flowing paragraphs of 3-5 sentences each. Do NOT produce choppy one-line fragments or stacks of single-sentence paragraphs — write smooth, full paragraphs like documentary narration.
- A viewer asked for a ${input.targetMinutes}-minute video. Delivering 8 minutes of content is a broken promise.` : ""}
Tone: ${input.tone}
Voiceover delivery: plain spoken prose only — no [PAUSE], [EMPHASIS], or any bracketed markers. Every word must be speakable.
${input.companionCta
  ? `COMPANION VIDEO CTA: End the script with a brief, natural call to action that points viewers to a RELATED video on this channel, phrased so it is true whether the creator places it on the end screen or in the description — e.g. "that video is either above this one right now or linked in the description." Keep the reference GENERAL — do NOT invent a specific title or topic for that video.`
  : `NO COMPANION VIDEO: The creator may not have a related video to point to. Do NOT reference, tease, or claim that another video exists on this channel — no "watch my other video", "the next video is already waiting", "the video right after this", "above this one", or "linked in the description". Close instead with only a subscribe / comment / apply-this-now style CTA.`}
${input.voiceProfile ? `
CREATOR VOICE PROFILE — this creator's audience knows their voice; the script must sound like THEM, not like a generic narrator. Follow this profile for rhythm, diction, energy, humor, address, transitions, and CTA style. It overrides the generic Tone setting above, but NEVER overrides the banned-phrases list, formatting rules, anti-fabrication rule, no-sponsor rule, or voiceover-only rule:

${input.voiceProfile}
` : ""}
${buildStorytellingBlock(input.storytellingMode, input.storytellingTechniques)}
${input.sourceMaterial ? `
VERIFIED SOURCE MATERIAL (provided by the creator) — you MAY state specific statistics, numbers, percentages, dollar figures, dates, named studies, and direct quotes ONLY when they appear in this material, and you SHOULD weave them in naturally for authority. This is a deliberate exception to the soft-framing rule, but ONLY for facts grounded here. For ANY claim NOT supported by this material, keep the soft-framing rule ("research suggests", "studies have shown"). Never invent a number, never attach a number to this material that isn't in it, and never copy long passages verbatim — restate facts in the script's own voice:
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
TITLE RULES — the generated "title" field MUST follow these viral patterns. Study these real titles that got 3M–10M+ views:

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
  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
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
    throw e;
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
  if (targetWords && targetWords >= 1200 && bodyKey) {
    try {
      const before = (script as any)[bodyKey].split(/\s+/).filter(Boolean).length;
      (script as any)[bodyKey] = await extendScriptToLength((script as any)[bodyKey], targetWords, input.targetTopic, input.targetNiche, startedAt);
      const after = (script as any)[bodyKey].split(/\s+/).filter(Boolean).length;
      console.log(`[extend] field=${bodyKey} target=${targetWords} before=${before} after=${after}`);
    } catch (e) {
      console.error("[extend] continuation failed, returning base script:", e);
    }
  } else if (targetWords && targetWords >= 1200) {
    console.error("[extend] no body field found on script object; keys:", Object.keys(script || {}));
  }

  return script;
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
    system: SYSTEM_PROMPT,
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

━━━ HASHTAGS (exactly 10, each prefixed with #) ━━━
Mix: 3 niche-specific, 4 topic-specific, 3 broad discovery

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
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response");
  const metadata = extractJSON(content.text, "object") as GeneratedMetadata;

  // Post-process: strip any # prefixes
  metadata.tags = metadata.tags.map(tag => tag.replace(/^#+/, "").trim());

  return metadata;
}
