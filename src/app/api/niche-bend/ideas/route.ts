import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Anthropic } from "@anthropic-ai/sdk";

export const maxDuration = 60;

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  }
  return anthropicClient;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { nicheA, nicheB, viralMagnetWord, sourceVideoTranscript, sourceVideoTitle, previousTitles } = await req.json();
    if (!nicheA && !nicheB && !sourceVideoTranscript) return NextResponse.json({ error: "Either two niches or a source video transcript is required" }, { status: 400 });

    const magnetInstruction = viralMagnetWord
      ? `\n\nVIRAL MAGNET REQUIREMENT: Every single title MUST naturally incorporate the word "${viralMagnetWord}". Weave it in so it feels organic and compelling — not forced. Position it where it creates the most curiosity or urgency in the title.`
      : "";

    const hasSource = !!sourceVideoTranscript;
    const truncatedTranscript = hasSource ? sourceVideoTranscript.slice(0, 1500) : "";

    const sourceSection = hasSource
      ? [
          `REFERENCE VIDEO TO REVERSE-ENGINEER:`,
          `Title: "${sourceVideoTitle || "Unknown"}"`,
          `Transcript:`,
          `"""`,
          truncatedTranscript,
          `"""`,
          ``,
          `STRUCTURAL ANALYSIS REQUIRED:`,
          `Before generating ideas, extract from the reference video:`,
          `1. Hook type: (question/stat/story/myth-bust/bold-claim/direct-address/teaser/pattern-interrupt)`,
          `2. Core framework: (mistake/case-study/system/comparison/hidden-cause/transformation/ranking/experiment)`,
          `3. Pacing pattern: (how quickly it moves, when the key insight drops)`,
          `4. Emotional trigger: (what makes viewers keep watching — fear/curiosity/aspiration/controversy)`,
          ``,
          `Then generate 10 niche-bend ideas that TRANSPLANT this exact framework into the "${nicheA}" x "${nicheB}" crossover.`,
          `Each idea MUST use the same hook type and framework — only the subject matter changes.`,
        ].join("\n")
      : [
          `Generate 10 YouTube video ideas that bridge two niches: "${nicheA}" and "${nicheB}".`,
          `These should be "niche bend" ideas — videos that intentionally cross-pollinate between the two niches to break out of algorithmic bubbles.`,
        ].join("\n");

    const extraFields = hasSource
      ? `- hookType: the hook type transplanted from the reference video\n- framework: the framework transplanted from the reference video\n`
      : "";

    const extraJson = hasSource
      ? `,\n    "hookType": "string",\n    "framework": "string"`
      : "";

    const prompt = [
      sourceSection,
      previousTitles && previousTitles.length > 0
        ? `\nAVOID REPETITION: Do NOT generate ideas similar to these already-seen titles:\n${previousTitles.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}\nEvery idea must be meaningfully different in angle, hook type, and subject matter.`
        : "",
      magnetInstruction,
      ``,
      `For each idea, provide:`,
      `- Title: MUST pass all three: (1) searchable keyword present, (2) emotional trigger word present (quietly/secretly/actually/everyone gets wrong/hidden/nobody mentions/cost you/revealed), (3) curiosity gap present (implies hidden answer or counterintuitive truth). NEVER start with "How to", "The best", "Complete guide", "Overview". Use openers like: "the problem nobody talks about with...", "why this stopped working", "what nobody tells you about...", "the part everyone misses"`,
      `- Description (2-3 sentences explaining the concept)`,
      `- Viral potential score (0-100)`,
      `- Format (list, challenge, comparison, story, experiment, reaction, educational, documentary)`,
      `- Why it works (brief reasoning)`,
      extraFields,
      `Respond with ONLY a valid JSON array. No preamble, no explanation, no markdown code fences. Start your response with [ and end with ]. Sort by viralPotential descending.`,
      ``,
      `[`,
      `  {`,
      `    "title": "string",`,
      `    "description": "string",`,
      `    "viralPotential": number,`,
      `    "competitionLevel": "low|medium|high",`,
      `    "format": "string",`,
      `    "reasoning": "string"` + extraJson,
      `  }`,
      `]`,
    ].join("\n");

    const response = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const rawContent = response.content[0];
    if (rawContent.type !== "text") {
      return NextResponse.json({ error: "Unexpected response type from Claude" }, { status: 500 });
    }

    const codeBlock = rawContent.text.match(/\s*\`\`\`(?:json)?\s*\n([\s\S]*?)\n\`\`\`/);
    const jsonText = codeBlock ? codeBlock[1]
      : (rawContent.text.match(/\[[\s\S]*\]/) || [null])[0];
    if (!jsonText) {
      return NextResponse.json({ error: "Could not parse ideas from response", debug: rawContent.text.slice(0, 500) }, { status: 500 });
    }
    let ideas: any[];
    try { ideas = JSON.parse(jsonText); }
    catch (e: any) {
      return NextResponse.json({ error: "Generated response was malformed JSON — try again" }, { status: 500 });
    }

    return NextResponse.json({ ideas, viralMagnetWord: viralMagnetWord || null, sourceUsed: hasSource });
  } catch (error: any) {
    console.error("Niche bend ideas error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate ideas" }, { status: 500 });
  }
}
