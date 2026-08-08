// Vet proposed angles against the grounding facts BEFORE they are shown. Angle
// cards used to reach the creator unchecked, so a fabricated salary ("$140 a
// week"), an unsupported superlative ("the CIA's greatest failure"), a misstated
// event ("arrested for an unrelated reason"), or a false relationship (calling the
// Australia grievance and the Rhyolite material "two different things" when Pine
// Gap is Rhyolite's ground station) could be picked and seed the whole script.
//
// Two layers, same split as the script guards:
//   - deterministic: dates and dollar figures in an angle not in the facts
//   - LLM: superlatives, misstated events, and false relationships the facts
//     contradict, which regex cannot see
//
// Honest ceiling: the LLM check can only catch a relationship error when the facts
// actually establish the relationship. Thin facts mean subtle errors still pass.

import { Anthropic } from "@anthropic-ai/sdk";
import { factCheckAgainstSource } from "@/lib/fact-check";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return _client;
}

/**
 * Returns a parallel array of warning lists, one per angle. An empty list means
 * the angle looked sound. Never throws: on any failure it returns only whatever
 * the deterministic scan found (or all-empty), so vetting can't block angles.
 */
export async function vetAngles(angles: string[], sourceText: string): Promise<string[][]> {
  const warnings: string[][] = angles.map(() => []);
  if (!angles.length) return warnings;

  // Layer 1: deterministic number scan (needs facts to check against).
  if (sourceText && sourceText.trim()) {
    angles.forEach((a, i) => {
      const { unverified } = factCheckAgainstSource(a, sourceText);
      for (const u of unverified) warnings[i].push(`Unverified figure: ${u}`);
    });
  }

  // Layer 2: LLM check for the errors regex can't see. Only runs with facts to
  // check against; without them there is no ground truth to judge an angle by.
  if (sourceText && sourceText.trim()) {
    try {
      const list = angles.map((a, i) => `[${i}] ${a}`).join("\n\n");
      const msg = await client().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 900,
        temperature: 0,
        messages: [{
          role: "user",
          content: `You are fact-checking proposed YouTube video angles against an APPROVED FACT SHEET. Flag ONLY real problems the facts establish. Do not flag matters of taste, emphasis, or interpretation.

Flag an angle when it:
- states a specific (number, salary, date, name, place) the facts do not support
- makes an unsupported superlative claim ("the greatest", "the first ever", "the biggest") the facts do not establish
- misstates a documented event (contradicts the facts)
- asserts a RELATIONSHIP the facts contradict, for example calling two things "unrelated" or "two different things" when the facts connect them, or claiming a link the facts do not support

APPROVED FACTS:
"""
${sourceText.slice(0, 5000)}
"""

ANGLES:
${list}

Output ONLY JSON, an array with one entry per angle index that has a problem (omit sound angles):
[{"i":0,"issues":["short plain-English description of the problem"]}]`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const m = text.match(/\[[\s\S]*\]/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            const i = Number(entry?.i);
            if (Number.isInteger(i) && i >= 0 && i < warnings.length && Array.isArray(entry.issues)) {
              for (const issue of entry.issues) {
                if (typeof issue === "string" && issue.trim()) warnings[i].push(issue.trim().slice(0, 200));
              }
            }
          }
        }
      }
    } catch { /* LLM vet failed: keep the deterministic warnings only */ }
  }

  return warnings;
}

// Build the fact string an angle is checked against, from the grounding context
// the angle routes already carry.
export function groundingToSourceText(grounding: any): string {
  if (!grounding) return "";
  const parts: string[] = [];
  if (grounding.caseName) parts.push(String(grounding.caseName));
  if (grounding.caseSummary) parts.push(String(grounding.caseSummary));
  if (Array.isArray(grounding.facts)) parts.push(...grounding.facts.map((f: any) => String(f)));
  return parts.filter(Boolean).join("\n");
}
