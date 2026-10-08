// accuracy_judge_v3 (2026-10-08, DRAFT until it passes the human holdout). Mirrors the procedure that matched the
// human adjudication (92% on serious errors): ONE sentence per call, the FULL numbered research, every sentence split
// into atomic claims, every verdict tied to a quoted research fact that code verifies, and severity decided only
// after support. Calibrated to the creator's stricter line (failure-set-v1/human.json): plain arithmetic on research
// inputs is fine; added description, places, titles, mechanisms or roles are not.
import Anthropic from "@anthropic-ai/sdk";

export const ACCURACY_JUDGE_V3 = "accuracy_judge_v3";
export const V3_STATUSES = ["supported", "derived", "unsupported", "misattached", "overstated", "contradicted"] as const;
export const V3_ERRORS = new Set(["unsupported", "misattached", "overstated", "contradicted"]);

const RULES = `You are the fact-checker for a documentary script. The RESEARCH below is the CLOSED universe of facts the script may state. Your own knowledge never supports a claim, even when the claim is true in the real world.

You will get ONE script sentence. Do this in order:

STEP 1. Split the sentence into ATOMIC claims: each separate checkable statement about the real world (who, what, when, where, how many, how much, what someone said, did, knew or intended, a status, a title or role, a place, a cause, a comparison or superlative, a mechanism, a physical scene detail, a reference to a film, book, person or event). A supported part never covers an unsupported part: "He testified before Congress that the unwinding would cause a severe liquidity problem" is TWO claims (the quote, and that it was testimony before Congress).
Skip pure narration that states no checkable fact (rhetorical lines, emotional framing, transitions, a callback to a scene already established).

STEP 2. For each claim decide SUPPORT, using only the research:
- supported: a research fact states it. Paraphrase is fine, but a paraphrase that ADDS description (a place, a setting, a role, a manner, a motive, "on Wall Street", "reached him", "the cognitively dominant one") is not supported for the added part.
- derived: it follows by plain arithmetic or date calculation from research facts (1959 to 1975 = 16 years; Sept 26 to Nov 17 = under two months), or is a rounding of a research number. Only arithmetic and rounding count as derived; interpretation does not.
- unsupported: the research does not establish it.
- misattached: the research has this number, name or detail, but attached to a different event, person, population, document, time or place (a figure for non-manager wages stated as fast-food wages; a survey result attributed to a different survey; an amount someone was ordered to REPAY stated as what someone RECEIVED).
- overstated: the research says something weaker or different (correlation stated as cause; "subgroups differed" stated as which one was higher; one study stated as consistent findings; "registered to vote" stated as "voted").
- contradicted: the research states the opposite or a different value for exactly this (if research sources disagree with each other, a claim matching ANY of them is supported).

STEP 3. For every claim, quote the research: "quote" is an exact span copied from the cited fact (the supporting span; for misattached/overstated/contradicted the span it was taken from or conflicts with; empty only for unsupported).

STEP 4. Only now decide SEVERITY for each claim that is not supported or derived. "material": true ONLY when the claim states a false or unestablished FACT that a viewer would retain as part of the record:
- a wrong or added place, person, title, organization, number, amount, date, duration or sequence (e.g. "testified before Congress", "then president of the New York Fed", "in Brooklyn", "a full standard deviation below");
- a fact attached to the wrong thing (a figure for one population, survey, payment or event stated as another's);
- what a source, study, court or person said or found, stated wrongly or more strongly than the research (a correlation stated as a finding of cause; "studies consistently show" when the research hedges; a quote put in the wrong mouth);
- an event, action or physical scene detail presented as having happened that the research does not record.
"material": false for the narrator's own interpretation or analysis (what something meant, why it worked, how significant or unusual it was, what institutions or people were weighing), general statements about how things typically work, hedged speculation ("may have"), and harmless color, even when the research does not establish them. These are still errors (status stays unsupported/overstated), just not material.

Output ONLY JSON: {"claims":[{"claim":"exact words from the sentence","status":"...","fact":"F12","quote":"exact research span","material":false,"why":"one short line"}]}`;

const norm = (t: string) => String(t || "").toLowerCase().replace(/[‘’“”"']/g, "").replace(/[^a-z0-9$%.]+/g, " ").replace(/\.(?!\d)/g, " ").replace(/\s+/g, " ").trim();
const words = (t: string) => norm(t).split(" ").filter((w) => w.length >= 3 || /\d/.test(w));
// A quote is verified when 80%+ of its words occur in the cited fact (allows light ellipsis/punctuation drift).
const quoteIn = (q: string, fact: string) => { const w = words(q); if (w.length < 2) return false; const F = new Set(words(fact)); return w.filter((x) => F.has(x)).length / w.length >= 0.8; };

export interface V3Claim { claim: string; status: string; fact: string; quote: string; verified: boolean; material: boolean; why: string }
export interface V3Sentence { i: number; sentence: string; claims: V3Claim[]; error: boolean; material: boolean; failed?: boolean }

export async function judgeSentencesV3(sentences: string[], facts: { fact: string; source?: string | null }[], opts: { model?: string; concurrency?: number } = {}): Promise<V3Sentence[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "", timeout: 300_000, maxRetries: 2 });
  const model = opts.model || "claude-opus-5-5";
  const research = facts.map((f, k) => `F${k}: ${f.fact}`).join("\n");
  const out: V3Sentence[] = new Array(sentences.length);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < sentences.length; i = next++) {
      const s = sentences[i];
      let parsed: any = null;
      for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        try {
          const m = await client.messages.create({
            model, max_tokens: 16000, ...(model.includes("opus") ? {} : { temperature: 0 }),
            // Research is identical for every sentence of a case: cache it so per-sentence calls stay cheap.
            system: [{ type: "text", text: RULES }, { type: "text", text: `RESEARCH:\n${research}`, cache_control: { type: "ephemeral" } }] as any,
            messages: [{ role: "user", content: `SENTENCE:\n${s}` }],
          });
          const t = m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
          parsed = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
        } catch { /* retry */ }
      }
      if (!parsed) { out[i] = { i, sentence: s, claims: [], error: false, material: false, failed: true }; continue; }
      const claims: V3Claim[] = (Array.isArray(parsed.claims) ? parsed.claims : []).map((c: any) => {
        let status = (V3_STATUSES as readonly string[]).includes(c?.status) ? String(c.status) : "unsupported";
        const id = String(c?.fact || ""); const k = /^F\d+$/.test(id) ? Number(id.slice(1)) : -1;
        const verified = k >= 0 && k < facts.length && quoteIn(String(c?.quote || ""), facts[k].fact);
        // Evidence is required: a "supported"/"derived" verdict whose quote isn't in the cited fact is not accepted.
        if ((status === "supported" || status === "derived") && !verified) status = "unsupported";
        return { claim: String(c?.claim || ""), status, fact: id, quote: String(c?.quote || "").slice(0, 300), verified, material: V3_ERRORS.has(status) && !!c?.material, why: String(c?.why || "").slice(0, 300) };
      });
      const errs = claims.filter((c) => V3_ERRORS.has(c.status));
      out[i] = { i, sentence: s, claims, error: errs.length > 0, material: errs.some((c) => c.material) };
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency || 6) }, worker));
  return out;
}
