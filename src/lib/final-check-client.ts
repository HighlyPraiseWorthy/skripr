// Client side of the FINAL CHECK (see src/lib/ai/final-check.ts). Every page that makes a script calls
// this after generation, so each one gets the same whole-script read against the research. It never
// blocks the result: no research, a failed call, or no changes all return the script as generated.
export async function applyFinalCheck(data: any, ctx: { sourceMaterial?: string; blueprint?: unknown; topic?: string }): Promise<any> {
  try {
    const body0: string = data?.fullScript || data?.script || data?.body || data?.content || "";
    const hasFacts = (typeof ctx.sourceMaterial === "string" && ctx.sourceMaterial.trim().length > 0) || Array.isArray(ctx.blueprint);
    if (!body0.trim() || !hasFacts) return data;
    const res = await fetch("/api/scripts/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "polish", hook: data?.hook || "", body: body0, title: data?.title, savedId: data?.savedId ?? null, sourceMaterial: ctx.sourceMaterial, blueprint: ctx.blueprint, topic: ctx.topic }),
    });
    const fc = await res.json().catch(() => null);
    if (!fc || fc.error || fc.status !== "ok" || typeof fc.body !== "string" || !fc.body.trim()) return data;
    const out = { ...data, hook: fc.hook || data.hook, finalCheckChanges: fc.changes || [] };
    for (const k of ["fullScript", "script", "body", "content"]) if (typeof out[k] === "string") out[k] = fc.body;
    return out;
  } catch {
    return data;
  }
}
