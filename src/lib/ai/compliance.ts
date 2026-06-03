import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

export async function runComplianceCheck(
  script: string,
  title: string,
  niche: string
): Promise<ComplianceReport> {
  const prompt = `You are a YouTube content policy expert. Analyze this script against YouTube's actual enforcement policies and return a detailed compliance report.

TITLE: "${title}"
NICHE: "${niche || "general"}"
SCRIPT:
${script.slice(0, 3500)}

Analyze the script across exactly these 6 policy dimensions:

1. ADVERTISER-FRIENDLY CONTENT (id: "advertiser-friendly")
YouTube's AFCG demonetizes content for:
- Strong profanity (especially in the first 30 seconds or title)
- Violence, injury, or graphic descriptions
- Sexual content or strong innuendo
- Drugs, tobacco, alcohol promoted positively
- Controversial social/political topics handled carelessly
- Shocking or disturbing content without clear educational framing
Score 0-100: 90-100 = fully monetizable, 70-89 = limited ads, below 70 = likely demonetized (yellow/red dollar sign)

2. COMMUNITY GUIDELINES RISK (id: "community-guidelines")
Content that gets videos removed:
- Hate speech targeting race, religion, gender, sexual orientation, disability
- Harassment, bullying, or targeted humiliation
- Promoting real-world violence or dangerous activities
- Encouraging self-harm or suicide
- Violent threats against specific people or groups
- Spam patterns or coordinated deception
Score 0-100: 100 = fully safe, below 50 = real removal risk

3. SENSITIVE TOPIC FLAGS (id: "sensitive-topics")
Topics that reduce distribution even without removal:
- Unverified medical/health claims ("cures", "reverses disease", specific dosages)
- Financial advice presented as guaranteed ("you will make money")
- Political or electoral content
- Conspiracy theory language or misinformation signals
- Religious controversy
Score 0-100: 100 = no flags, 60-80 = distribution reduced, below 60 = significant suppression likely

4. MISLEADING CONTENT (id: "misleading-content")
YouTube penalizes content that deceives viewers:
- Title promises something the script doesn't deliver
- Fake statistics or made-up facts presented as real
- Sensational claims without any evidence
- Clickbait framing designed to mislead rather than inform
- Deceptive setups (pretending something fake is real)
Score 0-100: 100 = fully honest, below 60 = misleading content flag risk

5. ENGAGEMENT INTEGRITY (id: "engagement-integrity")
YouTube's authenticity policies prohibit:
- Engagement bait: "comment YES if you agree", "type DONE when finished"
- Like/subscribe begging in the first 30 seconds
- Artificial urgency: "watch before YouTube deletes this", "they don't want you to see this"
- Subscriber milestone manipulation ("help me reach 10k!")
- View manipulation tactics
Score 0-100: 100 = authentic, below 70 = engagement bait violation risk

6. OVERALL MONETIZATION RISK (id: "monetization-risk")
Holistic assessment: would this video realistically get the yellow dollar sign?
- Does any single issue above trigger automated review?
- Would advertisers run ads against this content?
- Is the niche itself restricted (gambling, firearms, controversial news)?
- Does the content qualify for YouTube Premium revenue?
Score 0-100: 90-100 = strong monetization, 70-89 = some ads, 50-69 = limited, below 50 = likely no monetization

Return ONLY valid JSON with no markdown fences or explanation:
{
  "overallScore": <weighted average, monetization-risk counts double>,
  "riskLevel": "<low if score>=80, medium if 60-79, high if 40-59, critical if below 40>",
  "summary": "<2-3 sentences: honest overall verdict, biggest specific risk found, and the one most important fix>",
  "checks": [
    {
      "id": "<exact id from above>",
      "name": "<human name>",
      "description": "<one line what this checks>",
      "status": "<pass if score>=80, warn if 55-79, fail if below 55>",
      "score": <0-100>,
      "details": "<SPECIFIC: quote or reference the actual content in this script that triggered the score — do not write generic advice here, write what you actually found>",
      "suggestions": ["<specific actionable fix referencing the actual script content>", "<another specific fix>"]
    }
  ]
}

CRITICAL RULES:
1. Be specific to THIS script. Reference actual phrases by paraphrasing them (do NOT use double-quote characters inside JSON string values — this breaks JSON parsing). Describe the problematic content without quoting it verbatim.
2. All string values must be on a single line — no literal newlines inside JSON strings.
3. Generic advice is useless — tell them the exact issue and how to fix it.
4. Do not use the characters " or \ inside any string value.`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "";

  // Robust JSON extraction
  let data: any;
  try {
    const clean = raw.replace(/^```json\s*|^```\s*|```\s*$/gm, "").trim();
    // Extract just the JSON object between first { and last }
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON object found");
    const jsonStr = clean.slice(start, end + 1);
    data = JSON.parse(jsonStr);
  } catch (parseErr) {
    // Fallback: sanitize then re-parse
    const fallback = raw
      .replace(/^```json\s*|^```\s*|```\s*$/gm, "")
      .replace(/\r?\n/g, " ")
      .replace(/\t/g, " ")
      .replace(/[\x00-\x1F\x7F]/g, " ")
      .trim();
    const start = fallback.indexOf("{");
    const end = fallback.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Cannot extract JSON from response");
    data = JSON.parse(fallback.slice(start, end + 1));
  }

  return {
    ...data,
    timestamp: new Date().toISOString(),
  };
}
