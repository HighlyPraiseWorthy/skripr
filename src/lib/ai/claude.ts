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
  videoLength: "short" | "medium" | "long";
  tone: "educational" | "entertaining" | "storytelling" | "hype";
  ttsOptimized: boolean;
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
4. CTA PLACEMENT: Don't wait until the end. Place a soft CTA at the 60-70% mark where retention typically drops, then a hard CTA at the end.
5. STRUCTURE: Follow the exact structural pattern of the source viral video but apply it to the new topic.

Output valid JSON matching the specified schema. Be specific and actionable. No fluff.`;

export async function generateScript(input: ScriptGenerationInput): Promise<GeneratedScript> {
  const lengthGuide = {
    short: "60-90 seconds, 150-200 words",
    medium: "5-8 minutes, 700-1200 words",
    long: "10-20 minutes, 1500-3000 words",
  };

  const userPrompt = `Source viral video:
Title: "${input.sourceTitle}"
Niche: ${input.sourceNiche}
Transcript excerpt (first 2000 chars):
"""
${input.sourceTranscript.slice(0, 2000)}
"""

Generate a NEW script about: "${input.targetTopic}"
Target niche: ${input.targetNiche}
Video length: ${lengthGuide[input.videoLength]}
Tone: ${input.tone}
TTS optimized: ${input.ttsOptimized ? "Yes — short sentences, mark pauses with [PAUSE], mark emphasis with [EMPHASIS]" : "No"}

Analyze the source video's structure (hook type, retention beat placement, pacing, CTA style) and apply that EXACT structural pattern to the new topic.

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
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in Claude response");
  }

  const script: GeneratedScript = JSON.parse(jsonMatch[0]);
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
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response");

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found");

  return JSON.parse(jsonMatch[0]);
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
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found");

  const metadata: GeneratedMetadata = JSON.parse(jsonMatch[0]);

  // Post-process: strip any # prefixes from tags regardless of what Claude returns
  metadata.tags = metadata.tags.map(tag => tag.replace(/^#+/, "").trim());

  return metadata;
}
