// The 8 user-facing hook types (the angle picker). Every BANKED hook is labeled with one of these,
// so what Skripr learns from scans maps 1:1 onto what users choose. Before this, scans saved hooks
// under 12+ mechanic names ("Scene-Setter", "Teaser", "Bold Claim"), so the data could never say
// "Story hooks win in true crime". Generation still writes with its finer-grained mechanics
// (HOOK_TYPES in ai/claude.ts); these 8 are the LEARNING + RECOMMENDATION vocabulary.
export const HOOK_FAMILIES = [
  { type: "CONTROVERSY", label: "Controversy", def: "challenges a belief the viewer holds, or states a provocative/bold verdict" },
  { type: "CURIOSITY GAP", label: "Curiosity Gap", def: "says something exists or is coming and withholds the payoff (teasers, 'by the end you'll know'), OR leads with a striking stat, extreme fact, or impressive result the viewer now needs explained" },
  { type: "REFRAME", label: "Reframe", def: "recasts something familiar so it means the opposite or something new" },
  { type: "MYTH-BUST", label: "Myth-Bust", def: "names a common wrong assumption and promises the real answer ('the real reason why...')" },
  { type: "STORY", label: "Story", def: "opens inside a specific moment, scene, or person's experience (cold opens, scene-setting)" },
  { type: "PATTERN INTERRUPT", label: "Pattern Interrupt", def: "a jarring FIRST moment that doesn't fit what a video normally opens with: a sound or clip played cold, an odd object shown, an outburst, a non-sequitur. NOT a superlative, stat, or credential (those are Curiosity Gap)" },
  { type: "FEAR/STAKES", label: "Fear / Stakes", def: "makes the cost of not knowing, or a looming danger, feel immediate and personal" },
  { type: "OVERLOOKED MECHANISM", label: "Overlooked Mechanism", def: "promises how something actually works, the unglamorous mechanism nobody explains" },
] as const;
export type HookFamily = (typeof HOOK_FAMILIES)[number]["type"];
export const HOOK_FAMILY_TYPES = HOOK_FAMILIES.map((f) => f.type) as readonly string[];
export const HOOK_FAMILIES_PROMPT = HOOK_FAMILIES.map((f) => `- ${f.type}: ${f.def}`).join("\n");

// Deterministic mapping from any legacy/mechanic label to a family. Used as a backstop when a model
// answers off-list; the LLM classification from the hook TEXT is preferred where available.
const LEGACY: Record<string, HookFamily> = {
  "story": "STORY", "scene setter": "STORY", "story setter": "STORY", "cold open": "STORY", "direct address": "STORY",
  "teaser": "CURIOSITY GAP", "curiosity gap": "CURIOSITY GAP", "question": "CURIOSITY GAP", "result": "CURIOSITY GAP",
  "data drop": "CURIOSITY GAP", "stat": "CURIOSITY GAP", "challenge stat": "CURIOSITY GAP", "challenge question": "CURIOSITY GAP",
  "myth bust": "MYTH-BUST",
  "controversy": "CONTROVERSY", "bold claim": "CONTROVERSY", "provocation": "CONTROVERSY", "challenge": "CONTROVERSY",
  "reframe": "REFRAME",
  "pattern interrupt": "PATTERN INTERRUPT",
  "fear stakes": "FEAR/STAKES", "fear": "FEAR/STAKES", "stakes": "FEAR/STAKES",
  "overlooked mechanism": "OVERLOOKED MECHANISM", "mechanism": "OVERLOOKED MECHANISM",
};
export function toHookFamily(label: unknown): HookFamily | null {
  const k = String(label || "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  if (!k) return null;
  const exact = HOOK_FAMILIES.find((f) => f.type.toLowerCase().replace(/[^a-z]+/g, " ").trim() === k);
  if (exact) return exact.type;
  return LEGACY[k] ?? null;
}

// Rank the 8 families by how often PROVEN WINNERS use them. Every banked hook already comes from a
// video that broke out (an Outlier-scan breakout or a viral video a creator remixed), so "share of
// winning videos that opened this way" is the fair signal. Raw view counts were tried and rejected:
// they mostly measure CHANNEL SIZE (Pattern Interrupt "won" on 5 hooks from Kurzgesagt-scale channels).
// Median views is kept only as a tiebreak + display. A type needs >= minN examples to be ranked.
export type HookRank = { type: HookFamily; label: string; n: number; share: number; medianViews: number };
export function rankHookFamilies(rows: { hook_type: string | null; source_views: number | null }[], minN = 3): HookRank[] {
  const by = new Map<HookFamily, number[]>();
  let total = 0;
  for (const r of rows) {
    const f = toHookFamily(r.hook_type);
    if (!f) continue;
    total++;
    (by.get(f) || by.set(f, []).get(f)!).push(Number(r.source_views) || 0);
  }
  const med = (v: number[]) => { const x = v.filter(Boolean).sort((a, b) => a - b); return x.length ? x[Math.floor(x.length / 2)] : 0; };
  return [...by.entries()]
    .filter(([, v]) => v.length >= minN)
    .map(([type, v]) => ({ type, label: HOOK_FAMILIES.find((f) => f.type === type)!.label, n: v.length, share: v.length / total, medianViews: med(v) }))
    .sort((a, b) => b.n - a.n || b.medianViews - a.medianViews);
}
