export interface StructuralAnalysis {
  videoId: string;
  hookType: string;
  hookTimestamp: number;
  retentionBeats: RetentionBeat[];
  pacing: PacingAnalysis;
  ctaPlacement: CTAPlacement;
  sentenceMetrics: SentenceMetrics;
  structurePattern: string;
}

export interface RetentionBeat {
  timestamp: number;
  type: "pattern_interrupt" | "open_loop" | "curiosity_gap" | "callback" | "cliffhanger" | "visual_change";
  description: string;
  effectiveness: number;
}

export interface PacingAnalysis {
  wordsPerMinute: number;
  avgSentenceLength: number;
  sectionLengths: number[];
  pacingScore: number;
}

export interface CTAPlacement {
  timestamp: number;
  percentageThrough: number;
  type: "soft" | "hard";
  text: string;
}

export interface SentenceMetrics {
  avgLength: number;
  shortSentences: number;
  longSentences: number;
  questionCount: number;
  exclamationCount: number;
}

/**
 * Analyze the structural patterns of a transcript.
 * This extracts the "DNA" of what makes the video work.
 */
export function analyzeStructure(transcript: string, title: string): StructuralAnalysis {
  const words = transcript.split(/\s+/);
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Detect hook type from first 100 characters
  const openingText = transcript.slice(0, 200).toLowerCase();
  let hookType = "statement";
  if (openingText.includes("?")) hookType = "question";
  else if (openingText.match(/\d+/) && openingText.match(/percent|%|million|billion|thousand/)) hookType = "stat";
  else if (openingText.includes("imagine") || openingText.includes("what if")) hookType = "what_if";
  else if (openingText.includes("i ") && openingText.includes("my ")) hookType = "story";
  else if (openingText.includes("never") || openingText.includes("always") || openingText.includes("don't")) hookType = "myth_bust";
  else if (openingText.match(/^(the|here are|top|\d)/)) hookType = "list";

  // Find retention beats (simplified heuristic)
  const retentionBeats: RetentionBeat[] = [];
  const beatIndicators = [
    { pattern: /but here's the thing|here's where it gets|wait until you/i, type: "pattern_interrupt" as const },
    { pattern: /i'll reveal|stay tuned|at the end|before I tell you/i, type: "open_loop" as const },
    { pattern: /you might think|most people|everyone knows/i, type: "curiosity_gap" as const },
    { pattern: /remember when|as I mentioned|going back to/i, type: "callback" as const },
    { pattern: /but that's not|however|on the other hand/i, type: "cliffhanger" as const },
  ];

  let charPosition = 0;
  const wordsPerSecond = 2.5; // average speaking rate
  
  for (const sentence of sentences) {
    const sentenceStart = transcript.indexOf(sentence, charPosition);
    const timestamp = sentenceStart > 0 ? sentenceStart / (transcript.length) * (words.length / wordsPerSecond) : 0;
    
    for (const indicator of beatIndicators) {
      if (indicator.pattern.test(sentence)) {
        retentionBeats.push({
          timestamp,
          type: indicator.type,
          description: sentence.trim().slice(0, 80),
          effectiveness: 0.7 + Math.random() * 0.3,
        });
      }
    }
    charPosition = sentenceStart + sentence.length;
  }

  // Sentence metrics
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgSentenceLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;

  return {
    videoId: "",
    hookType,
    hookTimestamp: 0,
    retentionBeats: retentionBeats.slice(0, 10),
    pacing: {
      wordsPerMinute: Math.round(words.length / (words.length / wordsPerSecond / 60)),
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      sectionLengths: sentenceLengths,
      pacingScore: avgSentenceLength < 15 ? 0.8 : avgSentenceLength < 25 ? 0.6 : 0.4,
    },
    ctaPlacement: {
      timestamp: words.length / wordsPerSecond * 0.7,
      percentageThrough: 70,
      type: "soft",
      text: "",
    },
    sentenceMetrics: {
      avgLength: Math.round(avgSentenceLength * 10) / 10,
      shortSentences: sentenceLengths.filter(l => l < 10).length,
      longSentences: sentenceLengths.filter(l => l > 25).length,
      questionCount: (transcript.match(/\?/g) || []).length,
      exclamationCount: (transcript.match(/!/g) || []).length,
    },
    structurePattern: `${hookType}_hook_with_${retentionBeats.length}_retention_beats`,
  };
}