// SEMANTIC GROUNDING — the "vivid + true" check.
//
// The deterministic grounding check matches figures and stock phrases. It cannot see a
// substantive claim that carries no number: "the same circuitry that responds to food
// and sex", "just enough dopamine to come back", "basically a drug". Those are exactly
// the claims a science-flavoured audience catches, and they are the last route to a
// script that reads as sourced but isn't.
//
// The distinction this pass must hold, and the reason it needs a model rather than a
// regex: being VIVID about a true fact is the goal, not a violation. "Your brain treats
// a like a warm meal" is a good, catchy retelling of "reward regions activate" and must
// PASS. Only a claim that introduces a NEW substantive fact no supplied fact supports —
// a mechanism, a named thing, a comparison, a cause — should be flagged. It reads each
// claim against the scoped facts and asks: is this a dressed-up version of something we
// have, or a new assertion we do not?
//
// On demand, not every generation: it is one Claude call over the whole script, spent on
// a draft you intend to publish.
import { Anthropic } from "@anthropic-ai/sdk";
import { extractJSON } from "@/lib/ai/claude";

let _client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return _client;
}

export interface GroundingFinding {
  // The exact sentence or short span from the script.
  claim: string;
  // "unsupported" = asserts a substantive fact no supplied fact backs.
  // "contradicts" = says something a supplied fact directly disagrees with.
  // "narrative" = a sustained THESIS the script advances across several sentences (an
  //   institutional cover-up, a conspiracy, a systemic intent, a grand causal story) that
  //   no fact establishes — the risk that hides between individually-defensible sentences.
  verdict: "unsupported" | "contradicts" | "narrative";
  // One short, plain sentence: what is being asserted that the facts don't carry.
  note: string;
}

export interface SemanticGroundingResult {
  ran: boolean;
  findings: GroundingFinding[];
  // How many substantive claims were judged, so "0 findings" reads as "checked", not "skipped".
  claimsChecked: number;
}

export async function checkSemanticGrounding(
  script: string,
  facts: string[],
): Promise<SemanticGroundingResult> {
  const body = (script || "").trim();
  const factList = (facts || []).map((f) => String(f || "").trim()).filter(Boolean);
  if (body.split(/\s+/).length < 60 || factList.length === 0) {
    return { ran: false, findings: [], claimsChecked: 0 };
  }
  try {
    const msg = await anthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1600,
      temperature: 0,
      system: "You are a fact-grounding checker for a YouTube script. You judge whether the substantive claims in a script are supported by a supplied set of facts. You output ONLY a JSON array.",
      messages: [{
        role: "user",
        content: `Below is a SCRIPT and the FACTS it is allowed to draw on. Find claims in the script that assert something the facts do not support.

CRITICAL — WHAT IS AND IS NOT A PROBLEM:
- A VIVID or CATCHY retelling of a supported fact is GOOD, not a problem. If a fact says "receiving likes activates reward-related brain regions", then "your brain lights up the way it does for a warm meal" is FINE — it dramatizes a supported fact. Do not flag style, analogies, metaphors, rhetorical framing, or emotional emphasis.
- Interpretation and argument built ON a fact are fine, as long as the underlying fact is there.
- FLAG only a claim that introduces a NEW SUBSTANTIVE FACT the facts do not carry: a specific mechanism, a named thing, a cause-and-effect, a comparison presented as real, or a physiological/technical assertion. Examples of what to flag: "the same circuitry that responds to food and sex" when no fact mentions sex; "just enough dopamine to come back" when no fact mentions dopamine; "it's basically a drug" when no fact makes that comparison; "designers were told to target the nucleus accumbens" when no fact links the two.
- "contradicts" is stronger than "unsupported": use it only when a fact directly disagrees with the script.
- When unsure whether something is vivid-but-true versus a new claim, do NOT flag it. False alarms train the writer to ignore you. Only flag claims you are confident go beyond the facts.

ALSO CHECK THE ARGUMENT, NOT JUST THE SENTENCES (verdict "narrative"):
A script can stay clean sentence-by-sentence and still advance a THESIS the facts never establish — the dangerous failure that pure span-matching misses. Read the script as a whole and ask: does it build a sustained interpretation across several sentences or paragraphs that no supplied fact supports? The classic case is an INSTITUTIONAL COVER-UP or CONSPIRACY or DELIBERATE SYSTEMIC INTENT: the facts document events (a camera was installed, children were fathered, a report was filed), and the script threads them into "the institution knew and buried it" or "this was designed to happen" when NO fact states knowledge, intent, concealment, or coordination. Other forms: a grand causal story ("this is why X collapsed"), an attributed motive no fact gives, a pattern-of-behavior claim built from one instance. When you find one, emit ONE finding with verdict "narrative": set "claim" to the single most representative sentence that carries the thesis, and in "note" name the throughline and what is missing (e.g. "Script argues a deliberate cover-up; no fact states the institution knew or concealed anything"). Flag at most 2 such theses, only when you are confident the argument outruns the facts. Do not flag a script for merely stating documented events in a dramatic order.

FACTS (the only things the script may assert as true):
${factList.map((f, i) => `${i + 1}. ${f}`).join("\n")}

SCRIPT:
"""
${body.slice(0, 9000)}
"""

Output ONLY a JSON array, most serious first, empty if the script stays within its facts:
[{"claim":"the exact sentence or short span from the script","verdict":"unsupported|contradicts|narrative","note":"one short plain sentence naming what is asserted that the facts do not carry"}]`,
      }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const arr = extractJSON(text, "array");
    const findings: GroundingFinding[] = Array.isArray(arr)
      ? arr
          .filter((x: any) => x && typeof x.claim === "string" && x.claim.trim())
          .map((x: any): GroundingFinding => ({
            claim: String(x.claim).trim().slice(0, 240),
            verdict: x.verdict === "contradicts" ? "contradicts" : x.verdict === "narrative" ? "narrative" : "unsupported",
            note: String(x.note || "").trim().slice(0, 200),
          }))
          .slice(0, 12)
      : [];
    return { ran: true, findings, claimsChecked: findings.length };
  } catch (e) {
    console.error("[semantic-grounding] failed:", (e as any)?.message);
    return { ran: false, findings: [], claimsChecked: 0 };
  }
}
