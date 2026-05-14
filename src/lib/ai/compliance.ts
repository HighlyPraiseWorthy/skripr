export interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  status: "pass" | "warn" | "fail" | "pending";
  score: number;
  details: string;
  suggestions: string[];
}

export interface ComplianceReport {
  overallScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  checks: ComplianceCheck[];
  summary: string;
  timestamp: string;
}

/**
 * Run compliance checks on a script before publishing.
 * This is a simplified version. Production would integrate with
 * YouTube's APIs and more sophisticated detection models.
 */
export async function runComplianceCheck(
  script: string,
  title: string,
  niche: string
): Promise<ComplianceReport> {
  const checks: ComplianceCheck[] = [];

  // 1. Content uniqueness check
  const uniquenessScore = checkContentUniqueness(script);
  checks.push({
    id: "content-uniqueness",
    name: "Content Uniqueness",
    description: "Checks if your content is sufficiently original",
    status: uniquenessScore > 70 ? "pass" : uniquenessScore > 40 ? "warn" : "fail",
    score: uniquenessScore,
    details: uniquenessScore > 70 ? "Content appears original" : "Some phrases may overlap with existing content",
    suggestions: uniquenessScore > 70 ? [] : [
      "Rewrite sections that sound generic or commonly used",
      "Add personal anecdotes or unique perspectives",
      "Use specific examples instead of general statements",
    ],
  });

  // 2. AI voice risk
  const aiRiskScore = checkAIVoiceRisk(script);
  checks.push({
    id: "ai-voice-risk",
    name: "AI Voice Detection Risk",
    description: "Estimates risk of being flagged for AI-generated voice",
    status: aiRiskScore < 30 ? "pass" : aiRiskScore < 60 ? "warn" : "fail",
    score: 100 - aiRiskScore,
    details: aiRiskScore < 30 ? "Low risk of AI voice detection" : "Script patterns may trigger AI voice detection",
    suggestions: aiRiskScore < 30 ? [] : [
      "Add more conversational fillers and natural speech patterns",
      "Vary sentence length more dramatically",
      "Include rhetorical questions and direct audience address",
      "Add personal opinions and subjective statements",
    ],
  });

  // 3. Metadata compliance
  const metadataScore = checkMetadataCompliance(title, niche);
  checks.push({
    id: "metadata-compliance",
    name: "Metadata Compliance",
    description: "Checks title and metadata for policy compliance",
    status: metadataScore > 80 ? "pass" : metadataScore > 50 ? "warn" : "fail",
    score: metadataScore,
    details: metadataScore > 80 ? "Metadata looks clean" : "Some metadata elements may need adjustment",
    suggestions: metadataScore > 80 ? [] : [
      "Avoid clickbait that doesn't deliver on the promise",
      "Ensure title accurately represents the content",
      "Remove any misleading claims or exaggerations",
    ],
  });

  // 4. Visual originality guidance
  checks.push({
    id: "visual-originality",
    name: "Visual Originality Guidance",
    description: "Guidance on making your visuals more original",
    status: "pass",
    score: 75,
    details: "Visual originality depends on your specific footage and images",
    suggestions: [
      "Use original footage when possible instead of stock",
      "Add custom graphics, text overlays, and animations",
      "Create unique thumbnail designs that stand out",
      "Use consistent branding elements across videos",
    ],
  });

  const overallScore = Math.round(checks.reduce((sum, c) => sum + c.score, 0) / checks.length);
  const riskLevel = overallScore > 75 ? "low" : overallScore > 50 ? "medium" : overallScore > 25 ? "high" : "critical";

  return {
    overallScore,
    riskLevel,
    checks,
    summary: `Compliance score: ${overallScore}/100. Risk level: ${riskLevel}. ${checks.filter(c => c.status === "fail").length} issues need attention.`,
    timestamp: new Date().toISOString(),
  };
}

function checkContentUniqueness(script: string): number {
  // Simplified heuristic: check for generic phrases
  const genericPhrases = [
    "in today's video", "without further ado", "let's dive in",
    "before we begin", "as you can see", "it's worth noting",
    "first and foremost", "at the end of the day", "the bottom line",
  ];
  
  const lowerScript = script.toLowerCase();
  let genericCount = 0;
  for (const phrase of genericPhrases) {
    if (lowerScript.includes(phrase)) genericCount++;
  }
  
  // More generic phrases = lower uniqueness
  const penalty = genericCount * 8;
  return Math.max(10, 95 - penalty);
}

function checkAIVoiceRisk(script: string): number {
  // Heuristic: AI-generated scripts tend to have uniform sentence structure
  const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  
  if (lengths.length < 3) return 50;
  
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  
  // Low variance in sentence length = more AI-like
  const uniformityScore = Math.max(0, 100 - stdDev * 10);
  
  // Check for AI-typical phrases
  const aiPhrases = ["it's important to note", "in conclusion", "furthermore", "moreover", "additionally"];
  let aiPhraseCount = 0;
  const lowerScript = script.toLowerCase();
  for (const phrase of aiPhrases) {
    if (lowerScript.includes(phrase)) aiPhraseCount++;
  }
  
  return Math.min(100, uniformityScore + aiPhraseCount * 10);
}

function checkMetadataCompliance(title: string, niche: string): number {
  let score = 90;
  
  // Penalize all-caps words
  const capsWords = title.match(/\b[A-Z]{3,}\b/g);
  if (capsWords && capsWords.length > 2) score -= 15;
  
  // Penalize excessive punctuation
  if ((title.match(/!/g) || []).length > 1) score -= 10;
  if ((title.match(/\?/g) || []).length > 2) score -= 5;
  
  // Penalize clickbait patterns
  const clickbait = ["you won't believe", "shocking", "mind blown", "this changed everything", "gone wrong", "gone sexual"];
  const lowerTitle = title.toLowerCase();
  for (const phrase of clickbait) {
    if (lowerTitle.includes(phrase)) score -= 15;
  }
  
  return Math.max(10, score);
}