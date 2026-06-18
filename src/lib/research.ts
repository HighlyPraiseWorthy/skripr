// Auto-sourcing via Perplexity Sonar. Given a topic/angle, fetch real,
// citable facts so the script can be grounded in verifiable numbers. Returns
// facts each paired with a source URL for the user to approve/verify. Dormant
// until PERPLEXITY_API_KEY is set — callers surface the error gracefully.

export interface ResearchFact { fact: string; source: string | null }
export type ResearchResult =
  | { ok: true; facts: ResearchFact[]; citations: string[] }
  | { ok: false; error: string };

export async function findResearch(input: { topic: string; angle?: string; niche?: string }): Promise<ResearchResult> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { ok: false, error: "Research sourcing isn't set up yet." };
  const topic = (input.topic || "").slice(0, 200);
  if (!topic.trim()) return { ok: false, error: "Add a topic first." };

  const prompt = `Find verified, citable facts for a YouTube video.
Topic: ${topic}${input.angle ? `\nAngle: ${String(input.angle).slice(0, 200)}` : ""}${input.niche ? `\nNiche: ${input.niche}` : ""}

Return the 5-8 most useful SPECIFIC facts — real numbers, percentages, dollar figures, dates, or named study findings — that a creator could state on camera. Only include facts you can attribute to a real source. Output ONLY a JSON array, no prose:
[{"fact":"the specific fact, including the exact number","source":"the source URL it comes from"}]`;

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", temperature: 0.2, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { ok: false, error: `Research lookup failed (${res.status}).` };
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content || "";
    const citations: string[] = Array.isArray(data?.citations) ? data.citations.filter((c: any) => typeof c === "string") : [];

    let facts: ResearchFact[] = [];
    try {
      const m = content.match(/\[[\s\S]*\]/);
      const arr = JSON.parse(m ? m[0] : content);
      if (Array.isArray(arr)) {
        facts = arr
          .filter((x: any) => x && typeof x.fact === "string" && x.fact.trim())
          .map((x: any, i: number) => ({
            fact: String(x.fact).trim().slice(0, 400),
            // prefer the model's per-fact source; fall back to the citations list by index
            source: (typeof x.source === "string" && /^https?:\/\//.test(x.source)) ? x.source : (citations[i] || null),
          }))
          .slice(0, 8);
      }
    } catch { /* unparseable — facts stays empty, citations still returned */ }

    if (facts.length === 0 && citations.length === 0) {
      return { ok: false, error: "No citable facts found for this topic." };
    }
    return { ok: true, facts, citations };
  } catch (e: any) {
    return { ok: false, error: e?.name === "TimeoutError" ? "Research lookup timed out." : (e?.message || "Research lookup failed.") };
  }
}
