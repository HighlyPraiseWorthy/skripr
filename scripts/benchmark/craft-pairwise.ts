// CRAFT PAIRWISE (Evidence Integrity, 2026-10-07): did a fix cost craft? For each case and run, the baseline final
// and the experiment final are judged blind, side by side, in BOTH orders (position bias cancels; a dimension only
// counts as a win when both orders agree, otherwise tie). Dimensions are the ones the fix could plausibly hurt.
// Also counts concrete specifics per 1,000 words (numbers + named entities), deterministically, as retention.
//   npx tsx --env-file=.env.local scripts/benchmark/craft-pairwise.ts <baselineDir> <experimentDir>
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";

const [baseDir, expDir] = process.argv.slice(2);
const DIMS = ["specificity", "naturalness", "flow", "hook", "useful_detail"] as const;
const SYSTEM = `You are a senior editor for faceless YouTube documentary channels. Compare two scripts on the same topic, written from the same research. Judge each dimension independently:
- specificity: concrete, vivid, particular moments and figures vs generic narration
- naturalness: sounds like a human narrator, sentences read smoothly aloud, no stilted or patched-together lines
- flow: ideas connect, transitions work, no abrupt gaps or missing steps
- hook: the opening grabs and opens a question
- useful_detail: the viewer learns real, interesting particulars
For each dimension answer "A", "B", or "tie" (use tie when the difference is small). Output ONLY JSON: {"specificity":"A","naturalness":"tie","flow":"B","hook":"tie","useful_detail":"A","note":"one line"}`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "", timeout: 180_000, maxRetries: 1 });
async function compare(a: string, b: string) {
  for (let t = 0; t < 2; t++) {
    try {
      const m = await client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 800, temperature: 0, system: SYSTEM,
        messages: [{ role: "user", content: `SCRIPT A:\n"""\n${a}\n"""\n\nSCRIPT B:\n"""\n${b}\n"""` }] });
      const x = m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
      return JSON.parse(x.slice(x.indexOf("{"), x.lastIndexOf("}") + 1));
    } catch { /* retry */ }
  }
  return null;
}
const specifics = (t: string) => (t.match(/\$?\d[\d,.]*%?/g) || []).length + (t.match(/(?<=[a-z,;]\s)[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g) || []).length;
const load = (d: string) => Object.fromEntries(readdirSync(d).filter((f) => /-run\d+\.json$/.test(f)).map((f) => [f.replace(".json", ""), JSON.parse(readFileSync(join(d, f), "utf8"))]));

(async () => {
  const B = load(baseDir), E = load(expDir);
  const keys = Object.keys(E).filter((k) => B[k]);
  const tally: Record<string, { exp: number; base: number; tie: number }> = Object.fromEntries(DIMS.map((d) => [d, { exp: 0, base: 0, tie: 0 }]));
  const rows: any[] = [];
  await Promise.all(keys.map(async (k) => {
    const base = B[k].final, exp = E[k].final;
    const [o1, o2] = await Promise.all([compare(base, exp), compare(exp, base)]); // o1: A=base; o2: A=exp
    const res: any = { key: k, wordsBase: base.split(/\s+/).length, wordsExp: exp.split(/\s+/).length,
      specPer1kBase: +((specifics(base) / base.split(/\s+/).length) * 1000).toFixed(1), specPer1kExp: +((specifics(exp) / exp.split(/\s+/).length) * 1000).toFixed(1), notes: [o1?.note, o2?.note] };
    for (const d of DIMS) {
      const v1 = o1?.[d] === "A" ? "base" : o1?.[d] === "B" ? "exp" : "tie";
      const v2 = o2?.[d] === "A" ? "exp" : o2?.[d] === "B" ? "base" : "tie";
      const v = v1 === v2 ? v1 : "tie";
      res[d] = v; tally[d][v as "exp" | "base" | "tie"]++;
    }
    rows.push(res);
    console.log(`${k}: ${DIMS.map((d) => `${d}=${res[d]}`).join(" ")} | words ${res.wordsBase}->${res.wordsExp} | specifics/1k ${res.specPer1kBase}->${res.specPer1kExp}`);
  }));
  const avg = (f: string) => +(rows.reduce((s, r) => s + r[f], 0) / Math.max(1, rows.length)).toFixed(1);
  const summary = { pairs: rows.length, tally, words: { base: avg("wordsBase"), exp: avg("wordsExp") }, specificsPer1k: { base: avg("specPer1kBase"), exp: avg("specPer1kExp") } };
  writeFileSync(join(expDir, "craft-pairwise.json"), JSON.stringify({ summary, rows }, null, 1));
  console.log("\nCRAFT", JSON.stringify(summary, null, 1));
})();
