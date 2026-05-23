import { Anthropic } from "@anthropic-ai/sdk";

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
  tone: "educational" | "entertaining" | "storytelling" | "hype";
  ttsOptimized: boolean;
  viralMagnetWord?: string;
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

const SYSTEM_PROMPT = `You are Skripr's AI script engine. You specialize in writing YouTube scripts for faceless channels that are optimized for retention, algorithm performance, and AI voice (TTS) delivery.

Your scripts follow these principles:
1. HOOK: First 5 seconds must grab attention. Use one of these proven patterns: question hook, stat hook, story hook, controversy hook, "what if" hook, list hook, result hook, myth-bust hook.
2. RETENTION BEATS: Every 30-45 seconds, include a pattern interrupt, open loop, curiosity gap, or callback reference to keep viewers watching.
3. TTS OPTIMIZATION: Short sentences (max 15 words). Natural conversational tone. Mark pauses with [PAUSE]. Mark emphasis with [EMPHASIS]word[/EMPHASIS].
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

export async function generateScript(input: ScriptGenerationInput): Promise<GeneratedScript> {
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
4. Retention beats: keep the same number of pattern interrupts and reframes in the same positions
5. Tone and voice: match the conversational register (casual/authoritative/storytelling)
6. CTA style: mirror how the reference closes and asks for the subscribe/action
The content adapts to the new topic — the structure is preserved.`
    : `Write an original, highly engaging script on this topic. No source transcript — create fresh content with a strong hook, clear structure, and compelling CTA.`;

  const userPrompt = `${sourceSection}

${hasTranscript
  ? (input.targetTopic
    ? `Recreate the reference structure above, adapted for this new topic: "${input.targetTopic}"`
    : `Recreate this reference script faithfully — same topic, same niche, same key arguments. Improve only the hook strength, title, section structure, and retention beats. Do NOT change what the video is about.`)
  : `Generate a highly engaging original script about: "${input.targetTopic || "the requested topic"}"`}
Target niche: ${input.targetNiche}
Video length: ${lengthGuide[input.videoLength]}
Tone: ${input.tone}
TTS optimized: ${input.ttsOptimized ? "Yes — short sentences, mark pauses with [PAUSE], mark emphasis with [EMPHASIS]" : "No"}

TITLE RULES — the generated "title" field MUST obey all of these:
1. NEVER start with: "How to use", "The best", "Complete guide", "Overview of", "Introduction to", "Everything you need to know", "Top 10 ways to", "Explained in"
2. MUST contain all three layers simultaneously:
   - Searchable: a keyword phrase the target audience actually types into YouTube
   - Emotional trigger: a word/phrase signaling stakes, surprise, loss, urgency, or insider advantage (use: quietly · secretly · actually · really · everyone gets wrong · nobody mentions · hidden · exposed · cost you · revealed)
   - Curiosity gap: implies a hidden answer, common mistake, or counterintuitive truth
3. MUST fail the "generic test" — it cannot work for a different video with only the topic word swapped
4. Express ONE idea only

STRONG TITLE OPENERS (use these patterns naturally):
"the problem nobody talks about with..."
"what nobody tells you about..."
"the part everyone misses about..."
"why this stopped working — and..."
"the truth about..."
"what's actually going on with..."
"why [topic] is quietly..."
"the hidden downside of..."

STRONG TITLE CLOSERS (end with tension):
"(most people get this wrong)"
"(and why it works)"
"(the actual formula)"
"(what changed completely)"
"(no one is talking about)"
"(the real story)"

BAD TITLE → GOOD TITLE examples:
❌ "How to Use AI for YouTube Scripts" → ✅ "why AI scripts are quietly killing your channel (and what to use instead)"
❌ "The Best Script Generator for Creators" → ✅ "the part everyone misses when picking a script tool"
❌ "YouTube Script Writing Explained" → ✅ "what actually makes someone click your video (most creators get this wrong)"
${input.viralMagnetWord ? `
VIRAL MAGNET REQUIREMENT: The title field MUST naturally incorporate the word "${input.viralMagnetWord}". Weave it in where it creates maximum curiosity or urgency — not forced, but inevitable.` : ""}

HOOK RULES — the "hook" field MUST use one of these 8 proven patterns. Pick the one that fits the topic best:
1. Question — Surface a pain or curiosity directly: "Have you ever wondered why [X] never works?" / "What would you do if [scenario]?"
2. Stat/Number — Lead with a surprising data point: "73% of creators who [X] will [bad outcome] within [timeframe]."
3. Story — Drop into a scene with no setup: "Three years ago I [specific situation]..." — present tense, immediate.
4. Myth-bust — Challenge the dominant belief: "Every guide about [topic] tells you [X]. Here's why that's backwards."
5. Bold claim — State a counterintuitive result first: "This one [thing] is responsible for [outsized outcome] — and almost nobody uses it."
6. Direct address — Speak to a specific person in a specific moment: "If you've ever [relatable struggle], stop what you're doing."
7. Teaser — Promise a specific, concrete payoff: "By the end of this you'll know the exact [thing] that [specific result]."
8. Pattern interrupt — Subvert expectations immediately: "Most videos about [topic] start with [common approach]. We're skipping all of that."

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

  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const script = extractJSON(content.text, "object") as GeneratedScript;
  return script;
}

export interface HookGenerationInput {
  topic: string;
  niche: string;
  tone: string;
  count?: number;
}

export interface GeneratedHook {
  text: string;
  type: string;
  predictedRetention: number;
  reasoning: string;
}

export async function generateHooks(input: HookGenerationInput): Promise<GeneratedHook[]> {
  const count = input.count || 10;

  const userPrompt = `Generate ${count} YouTube video hooks for:
Topic: "${input.topic}"
Niche: ${input.niche}
Tone: ${input.tone}

Use these 8 proven hook types: question, stat, story, controversy, "what if", list, result, myth-bust.

For each hook, provide:
- The exact hook text (what the creator says in the first 5-10 seconds)
- The hook type
- Predicted retention score (0-100) — how many viewers will stay past the hook
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

  const userPrompt = `Generate YouTube metadata for this video:
Title: "${input.title}"
Niche: ${input.niche}
Script excerpt (first 1000 chars):
"""
${input.script.slice(0, 1000)}
"""
${input.targetKeywords ? `Target keywords: ${input.targetKeywords.join(", ")}` : ""}

Important rules:
- Current year is ${currentYear}. Use ${currentYear} for any year references unless the script mentions a different year.
- Tags must be plain text only — no "#" symbols, no quotes, no special characters.
- The description must end with exactly 3 relevant hashtags on the final line.
- The separate "hashtags" array must contain 10 hashtags, each prefixed with "#".

Output JSON:
{
  "titles": ["10 title options, optimized for CTR and search"],
  "description": "Full YouTube description with timestamps, keywords, links, ending with exactly 3 hashtags on the final line",
  "tags": ["20 plain-text tags, NO # prefix, mix of broad and niche-specific"],
  "thumbnailText": ["5 thumbnail text options, max 4 words each"],
  "hashtags": ["10 hashtags each prefixed with #"]
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
