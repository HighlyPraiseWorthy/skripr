// Post-draft fact verification. This is the pass a careful human (or a second
// reviewer chat) runs on a finished script: pull out every specific factual
// claim, check each against the live web, then correct what is wrong, cut what
// cannot be sourced, and flag what still needs a human look. It is what took a
// grounded draft from ~8.8 credibility to shippable in testing, catching a wrong
// escape date, an unverifiable Vienna meeting, and a loose program name.
//
// It runs on demand, not on every generation, because it is expensive: a Claude
// extraction, a Perplexity verification, and a Claude apply pass. You spend that
// on a script you intend to use, the same way you would invoke a reviewer.
//
// Sourcing discipline is preserved end to end: Claude never asserts a fact,
// Perplexity supplies the verdicts and citations, and the apply step may only
// correct to a Perplexity-sourced value or soften/cut. Nothing new is invented.

import { Anthropic } from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return _client;
}

export type ClaimStatus = "confirmed" | "corrected" | "unverified";
export interface VerifiedClaim {
  claim: string;
  status: ClaimStatus;
  correction?: string; // the right value, when contradicted
  source?: string;      // citation URL
  note?: string;        // short explanation
}
export interface VerifyResult {
  hook: string;
  body: string;
  changes: string[];      // what the apply step changed
  stillVerify: string[];  // claims a human should check before publishing
  report: VerifiedClaim[]; // full per-claim result
  ran: boolean;           // false when verification could not run (no key, etc.)
}

function clean(s: string): string {
  return typeof s === "string"
    ? s.replace(/—/g, ", ").replace(/\s,\s/g, ", ")
        .replace(/\[\/?[A-Z][A-Z _-]*\]/g, "")
        .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, " ").trim()
    : s;
}

export async function verifyScriptFacts(input: { hook: string; body: string; title?: string }): Promise<VerifyResult> {
  const hook = input.hook || "";
  const body = input.body || "";
  const empty: VerifyResult = { hook, body, changes: [], stillVerify: [], report: [], ran: false };
  if (!body.trim()) return empty;
  const pkey = process.env.PERPLEXITY_API_KEY;
  if (!pkey) return empty; // no verifier available; leave the script untouched

  const fullText = `${input.title ? input.title + "\n\n" : ""}${hook}\n\n${body}`.slice(0, 9000);

  // 1) Extract the discrete, checkable claims.
  let claims: string[] = [];
  try {
    const msg = await anthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      temperature: 0,
      messages: [{
        role: "user",
        content: `Pull the specific, checkable factual claims out of this script: dates, names, job titles, place names, program or system names, dollar figures, counts, sentences, and specific events. Ignore opinion, framing, and general statements. Return each as a short standalone claim a fact-checker could verify.

SCRIPT:
"""
${fullText}
"""

Output ONLY a JSON array of claim strings, most important first, at most 15.`,
      }],
    });
    const t = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const m = t.match(/\[[\s\S]*\]/);
    if (m) { const arr = JSON.parse(m[0]); if (Array.isArray(arr)) claims = arr.filter((c) => typeof c === "string" && c.trim()).slice(0, 15); }
  } catch { /* extraction failed */ }
  if (!claims.length) return empty;

  // 2) Verify each claim against the live web.
  let report: VerifiedClaim[] = [];
  try {
    const prompt = `Verify each claim below against reliable sources. For each, decide:
- "confirmed": a real source supports it as stated.
- "contradicted": a real source shows it is wrong. Give the correct value in "correction" and a source URL.
- "unverified": you cannot find a reliable source either way.

Be strict. Do not mark something confirmed on a hunch. Prefer primary or well-established sources.

CLAIMS:
${claims.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Output ONLY JSON, one object per claim in order:
[{"status":"confirmed|contradicted|unverified","correction":"the right value if contradicted, else empty","source":"url or empty"}]`;
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${pkey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", temperature: 0, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return empty;
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content || "";
    const citations: string[] = Array.isArray(data?.citations) ? data.citations.filter((c: any) => typeof c === "string") : [];
    const m = content.match(/\[[\s\S]*\]/);
    const arr = m ? JSON.parse(m[0]) : [];
    if (Array.isArray(arr)) {
      report = claims.map((claim, i) => {
        const v = arr[i] || {};
        const raw = String(v.status || "").toLowerCase();
        const status: ClaimStatus = raw === "contradicted" ? "corrected" : raw === "confirmed" ? "confirmed" : "unverified";
        const source = (typeof v.source === "string" && /^https?:\/\//.test(v.source)) ? v.source : (citations[i] || undefined);
        return {
          claim,
          status,
          correction: typeof v.correction === "string" && v.correction.trim() ? v.correction.trim().slice(0, 240) : undefined,
          source,
        };
      });
    }
  } catch { return empty; }
  if (!report.length) return empty;

  const corrections = report.filter((r) => r.status === "corrected" && r.correction);
  const unverified = report.filter((r) => r.status === "unverified");

  // 3) Apply: correct contradicted claims to the sourced value, soften or cut the
  // unverifiable ones. Conservative editing, same discipline as the self-review.
  let outHook = hook, outBody = body, changes: string[] = [];
  if (corrections.length || unverified.length) {
    try {
      const msg = await anthropic().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        temperature: 0,
        messages: [{
          role: "user",
          content: `You are applying verified fact-check results to a finished YouTube script. Make ONLY these edits, nothing else. Preserve the voice, structure, and everything not listed. No em dashes, no exclamation points.

CORRECT these to the verified value (a source confirmed the script was wrong):
${corrections.length ? corrections.map((c) => `- Script claim: "${c.claim}"\n  Correct to: ${c.correction}`).join("\n") : "(none)"}

COULD NOT be verified, so soften to a qualitative phrasing or remove the specific, never assert it as fact and never invent a replacement:
${unverified.length ? unverified.map((c) => `- "${c.claim}"`).join("\n") : "(none)"}

TITLE: ${input.title || ""}
HOOK:
"""
${hook}
"""
BODY:
"""
${body}
"""

Output ONLY JSON:
{"hook":"corrected hook","body":"corrected body, full text","changes":["one short line per edit made"]}`,
        }],
      });
      const t = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const m = t.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        const nh = typeof parsed.hook === "string" && parsed.hook.trim() ? clean(parsed.hook) : hook;
        const nb = typeof parsed.body === "string" && parsed.body.trim() ? clean(parsed.body) : body;
        // Guard against a gutted response.
        if (nb.length >= body.length * 0.6) {
          outHook = nh; outBody = nb;
          changes = Array.isArray(parsed.changes) ? parsed.changes.filter((c: any) => typeof c === "string" && c.trim()).map((c: string) => c.trim().slice(0, 200)).slice(0, 15) : [];
        }
      }
    } catch { /* apply failed: keep the original, still return the report */ }
  }

  const stillVerify = unverified.map((r) => r.claim);
  return { hook: outHook, body: outBody, changes, stillVerify, report, ran: true };
}
