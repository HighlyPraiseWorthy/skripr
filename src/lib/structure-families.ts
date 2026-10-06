// STRUCTURE FAMILIES (2026-10-06). The story shapes that WIN in a niche, built from the Outlier Finder /
// Viral Remixer data (full-transcript structures + how far each video beat its own channel's usual views).
//
// Why families, not one formula: the data showed winners and below-average videos spend nearly the same
// share of runtime on each part, and use nearly the same techniques. What differs is the SHAPE of the story
// (manhunt / second life, cold-case breakthrough, heist, rise and fall...), so a script follows the winning
// family its own facts can carry. Rules that keep it honest:
//   - "winning" = at least 2x the video's own channel's median views (raw views mostly measure channel size);
//   - at most 3 videos per channel per niche, and a family needs winners from 2+ channels;
//   - technique guidance only names "table stakes" (nearly everyone uses it) and "differentiators" (a large
//     gap between winners and below-average videos with enough of both), never "winners use X" alone.
// Stored as one row per niche in viral_frameworks (video_id "fam:<niche>", niche and title NULL so every
// existing reader skips it); the table can't take new columns.
import { Anthropic } from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/db/supabase";
import { TECHNIQUES } from "@/lib/storytelling";

export interface FamilyStage { name: string; role: string; sharePct: number; does: string }
export interface StructureFamily {
  id: string; name: string;
  fits: string;               // what a story must have for this shape (the facts that fill its stages)
  stages: FamilyStage[];
  evidence: { videos: number; channels: number; medianOutlierX: number; examples: { title: string; channel: string; x: number }[] };
}
export interface TechniqueStat { id: string; name: string; winnersPct: number; basePct: number; gap: number }
export interface NicheStructure {
  niche: string; builtAt: string; winners: number; baseline: number;
  families: StructureFamily[];
  tableStakes: TechniqueStat[];      // used by >=80% of winners AND of below-average videos
  differentiators: TechniqueStat[];  // |gap| >= 15 points, with >=20 winners and >=10 below-average videos
  setupSharePct: { winners: number; baseline: number };
  // The parts nearly all winners share, in their usual order and runtime share (median start and share per
  // role): the fallback when no family fits a story.
  skeleton: { role: string; sharePct: number; usedByPct: number }[];
}
export const ALL_NICHES = "_all"; // cross-niche structure for niches without enough winners yet

const WIN_X = 2, BASE_X = 1.2, PER_CHANNEL = 3;
const techName = (id: string) => TECHNIQUES.find((t) => t.id === id)?.name || id;
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

function techniqueStats(win: any[], base: any[]) {
  const pct = (set: any[], id: string) => set.length ? Math.round(100 * set.filter((r) => (r.title_formula?.techniques || []).some((t: any) => t.id === id)).length / set.length) : 0;
  const all = TECHNIQUES.map((t) => ({ id: t.id, name: t.name, winnersPct: pct(win, t.id), basePct: pct(base, t.id), gap: pct(win, t.id) - pct(base, t.id) }));
  const enough = win.length >= 20 && base.length >= 10;
  return {
    tableStakes: all.filter((t) => t.winnersPct >= 80 && t.basePct >= 80).sort((a, b) => b.winnersPct - a.winnersPct),
    differentiators: enough ? all.filter((t) => Math.abs(t.gap) >= 15).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)) : [],
  };
}

export async function buildNicheStructure(niche: string): Promise<NicheStructure | null> {
  if (!supabaseAdmin) return null;
  const q = supabaseAdmin.from("viral_frameworks").select("video_id, video_title, structure, title_formula").not("video_id", "like", "pat:%").not("video_id", "like", "fam:%").limit(3000);
  const { data } = niche === ALL_NICHES ? await q : await q.eq("niche", niche);
  const rows = (data || []).filter((r: any) => r.title_formula?.shape && Array.isArray(r.structure) && typeof r.title_formula?.outlierX === "number");
  // Winners, strongest first, capped per channel so one channel's house style can't dominate.
  const perChannel = new Map<string, number>();
  const winners = rows.filter((r: any) => r.title_formula.outlierX >= WIN_X).sort((a: any, b: any) => b.title_formula.outlierX - a.title_formula.outlierX)
    .filter((r: any) => { const c = r.title_formula.channelTitle || "?"; const n = perChannel.get(c) || 0; if (n >= PER_CHANNEL) return false; perChannel.set(c, n + 1); return true; });
  const baseline = rows.filter((r: any) => r.title_formula.outlierX < BASE_X);
  if (winners.length < 8) return null;

  const { tableStakes, differentiators } = techniqueStats(winners, baseline);
  const setupShare = (set: any[]) => Math.round(median(set.map((r: any) => (r.structure || []).filter((s: any) => s.role === "setup" || s.role === "backstory").reduce((a: number, s: any) => a + (Number(s.sharePct) || 0), 0))));

  // SKELETON: for each role, how many winners use it, its median start and its median share of runtime.
  const roles = new Map<string, { starts: number[]; shares: number[]; videos: number }>();
  for (const r of winners) {
    const seen = new Set<string>();
    for (const s of r.structure || []) {
      const role = String(s?.role || ""); if (!role || role === "sponsor") continue;
      const e = roles.get(role) || { starts: [], shares: [], videos: 0 };
      e.starts.push(Number(s.startPct) || 0); e.shares.push(Number(s.sharePct) || 0);
      if (!seen.has(role)) { e.videos++; seen.add(role); }
      roles.set(role, e);
    }
  }
  const skeletonRaw = [...roles.entries()].map(([role, e]) => ({ role, start: median(e.starts), share: median(e.shares), usedByPct: Math.round((100 * e.videos) / winners.length) }))
    .filter((x) => x.usedByPct >= 40).sort((a, b) => a.start - b.start);
  const skTotal = skeletonRaw.reduce((a, x) => a + x.share, 0) || 1;
  const skeleton = skeletonRaw.map((x) => ({ role: x.role, sharePct: Math.round((x.share / skTotal) * 100), usedByPct: x.usedByPct }));

  const list = winners.map((r: any, i: number) => `[${i}] "${r.video_title}" (${r.title_formula.channelTitle}, ${r.title_formula.outlierX}x its channel) shape: ${r.title_formula.shape}\n    ${(r.structure || []).map((s: any) => `${s.role || "?"}:${s.section} ${s.sharePct || 0}%`).join(" → ")}`).join("\n");
  let families: StructureFamily[] = [];
  try {
    const msg = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "", timeout: 120_000, maxRetries: 1 }).messages.create({
      model: "claude-opus-5-5", max_tokens: 6000,
      messages: [{ role: "user", content: `These are the WINNING ${niche} YouTube videos (each beat its own channel's usual views by 2x or more), with each video's story shape and full structure (role:section share-of-runtime).

Group them into 3 to 6 STORY-SHAPE FAMILIES: videos whose stories are built the same way end to end (e.g. "manhunt / second life", "cold-case breakthrough", "heist", "rise and fall", "mole hunt"). A family is a SHAPE, not a topic. Every video goes in exactly one family; a video that fits none goes in no family.

For each family give:
- "name": 2-5 words
- "fits": one sentence: what a story's research must contain for this shape to work (the material that fills its stages)
- "stages": 5 to 9 stages in order, each {"name", "role" (cold_open | setup | second_hook | backstory | escalation | turn | climax | resolution | callback | context), "sharePct" (typical share of runtime across the family's videos; all stages sum to about 100), "does" (one sentence: what this stage does for the viewer)}
- "members": the [index] numbers of its videos

WINNERS:
${list}

Output ONLY JSON: {"families":[{"name":"...","fits":"...","stages":[{"name":"...","role":"...","sharePct":10,"does":"..."}],"members":[0,3]}]}` }],
    });
    const text = msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    families = (Array.isArray(j?.families) ? j.families : []).map((f: any, k: number) => {
      const members = [...new Set<number>((f.members || []).map(Number).filter((n: number) => Number.isInteger(n) && winners[n]))].map((n) => winners[n]);
      const channels = new Set(members.map((r: any) => r.title_formula.channelTitle));
      const stages: FamilyStage[] = (Array.isArray(f.stages) ? f.stages : []).map((s: any) => ({ name: String(s?.name || "").slice(0, 60), role: String(s?.role || "").split(/\s*\|\s*/)[0], sharePct: Math.max(1, Number(s?.sharePct) || 0), does: String(s?.does || "").slice(0, 200) })).filter((s: FamilyStage) => s.name);
      const total = stages.reduce((a, s) => a + s.sharePct, 0) || 1;
      stages.forEach((s) => { s.sharePct = Math.round((s.sharePct / total) * 100); });
      return {
        id: `${niche}-${k}`, name: String(f.name || "").slice(0, 60), fits: String(f.fits || "").slice(0, 300), stages,
        evidence: { videos: members.length, channels: channels.size, medianOutlierX: +median(members.map((r: any) => r.title_formula.outlierX)).toFixed(1),
          examples: members.slice(0, 3).map((r: any) => ({ title: String(r.video_title).slice(0, 90), channel: r.title_formula.channelTitle, x: r.title_formula.outlierX })) },
      } as StructureFamily;
    })
    // Evidence floor: a shape that won for one channel only is that channel's style, not the niche's.
      .filter((f: StructureFamily) => f.name && f.stages.length >= 4 && f.evidence.videos >= 3 && f.evidence.channels >= 2)
      .sort((a: StructureFamily, b: StructureFamily) => b.evidence.medianOutlierX * Math.sqrt(b.evidence.videos) - a.evidence.medianOutlierX * Math.sqrt(a.evidence.videos));
  } catch (e: any) {
    console.error(`[structure] families failed for ${niche}:`, e?.message || e);
  }
  return { niche, builtAt: new Date().toISOString(), winners: winners.length, baseline: baseline.length, families, tableStakes, differentiators,
    setupSharePct: { winners: setupShare(winners), baseline: setupShare(baseline) }, skeleton };
}

export async function saveNicheStructure(s: NicheStructure): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("viral_frameworks").upsert({ video_id: `fam:${s.niche}`, niche: null, video_title: null, structure: s as any, remix_framework: `structure families built ${s.builtAt}` }, { onConflict: "video_id" });
}

export async function getNicheStructure(niche: string | null | undefined): Promise<NicheStructure | null> {
  if (!supabaseAdmin || !niche) return null;
  try {
    const { data } = await supabaseAdmin.from("viral_frameworks").select("structure").eq("video_id", `fam:${niche}`).maybeSingle();
    const s = data?.structure as any;
    return s && Array.isArray(s.families) ? (s as NicheStructure) : null;
  } catch { return null; }
}

// What a script in this niche should use: the niche's own families when it has them, otherwise the cross-niche
// structure built from all niches' winners (so every niche gets data-backed guidance, not only the big ones).
export async function getStructureFor(niche: string | null | undefined): Promise<NicheStructure | null> {
  const own = await getNicheStructure(niche);
  if (own && own.families.length) return own;
  return getNicheStructure(ALL_NICHES);
}

// Rebuild every niche that has enough winners (and the cross-niche set). Skips a niche rebuilt in the last
// 6 days unless forced, so the weekly cron can't be used to burn model calls.
export async function rebuildAllStructures(opts: { force?: boolean; max?: number } = {}): Promise<{ niche: string; families: number; status: string }[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin.from("viral_frameworks").select("niche, title_formula").not("video_id", "like", "pat:%").not("video_id", "like", "fam:%").limit(3000);
  const winners = new Map<string, number>();
  for (const r of data || []) { const t: any = r.title_formula; if (r.niche && t?.shape && Number(t.outlierX) >= WIN_X) winners.set(r.niche, (winners.get(r.niche) || 0) + 1); }
  const niches = [...[...winners.entries()].filter(([, n]) => n >= 8).map(([k]) => k), ALL_NICHES];
  const out: { niche: string; families: number; status: string }[] = [];
  let rebuilt = 0;
  for (const niche of niches) {
    // The daily cron rebuilds at most a few stale niches per run (each takes about a minute).
    if (opts.max !== undefined && rebuilt >= opts.max) { out.push({ niche, families: 0, status: "deferred to the next run" }); continue; }
    const prev = await getNicheStructure(niche);
    if (!opts.force && prev && Date.now() - new Date(prev.builtAt).getTime() < 6 * 864e5) { out.push({ niche, families: prev.families.length, status: "fresh" }); continue; }
    const s = await buildNicheStructure(niche);
    if (!s) { out.push({ niche, families: 0, status: "not enough winners after the per-channel cap" }); continue; }
    if (!s.families.length && prev?.families.length) { out.push({ niche, families: prev.families.length, status: "kept previous (rebuild found none)" }); continue; }
    await saveNicheStructure(s);
    rebuilt++;
    out.push({ niche, families: s.families.length, status: "built" });
  }
  return out;
}

// CHOOSE A STRUCTURE FOR ONE SCRIPT. Candidates: the niche's own families plus the cross-niche ones (so a
// fugitive story can use a true-crime "mystery" shape, and a science script can use "layered reveal").
// The model scores how well THIS research fills each family's stages (0-10), and maps facts onto the best
// one's stages. Choice: highest fit; within 1 point, the niche's own family, then stronger evidence. Below a
// fit of 6, no family is forced: the niche skeleton (the parts nearly all winners share) is used instead.
export interface ChosenStructure {
  source: "family" | "skeleton";
  familyId: string | null; name: string; fit: number; reason: string;
  scope: "niche" | "cross-niche";
  evidence: StructureFamily["evidence"] | null;
  stages: { name: string; role?: string; sharePct: number; does: string; factIdx?: number[] }[];
  alternatives: { familyId: string; name: string; fit: number; scope: "niche" | "cross-niche"; evidence: StructureFamily["evidence"] }[];
  tableStakes: string[]; differentiators: { name: string; winnersPct: number; basePct: number }[];
}
export async function chooseStructure(input: { niche: string | null | undefined; facts: string[]; angle?: string; topic?: string; familyId?: string | null }): Promise<ChosenStructure | null> {
  const own = await getNicheStructure(input.niche);
  const all = await getNicheStructure(ALL_NICHES);
  const base = own && own.families.length ? own : all;
  if (!base) return null;
  const cands = [
    ...(own?.families || []).map((f) => ({ f, scope: "niche" as const })),
    ...(all?.families || []).map((f) => ({ f, scope: "cross-niche" as const })),
  ];
  const facts = input.facts.slice(0, 120);
  const numbered = facts.map((f, i) => `${i}. ${String(f).slice(0, 260)}`).join("\n");
  const guidance = { tableStakes: base.tableStakes.map((t) => t.name), differentiators: base.differentiators.map((t) => ({ name: t.name, winnersPct: t.winnersPct, basePct: t.basePct })) };
  const skeletonStages = base.skeleton.map((k) => ({ name: k.role.replace(/_/g, " "), role: k.role, sharePct: k.sharePct, does: `the ${k.role.replace(/_/g, " ")} part, as winning videos in this niche use it` }));
  if (!cands.length || facts.length < 6) return { source: "skeleton", familyId: null, name: "Niche skeleton", fit: 0, reason: "not enough families or facts to match", scope: own?.families.length ? "niche" : "cross-niche", evidence: null, stages: skeletonStages, alternatives: [], ...guidance };
  for (let attempt = 0; attempt < 2; attempt++) try {
    const msg = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "", timeout: 60_000, maxRetries: 1 }).messages.create({
      model: "claude-sonnet-4-6", max_tokens: 3000, temperature: 0.2,
      messages: [{ role: "user", content: `A YouTube documentary is being written about: "${String(input.topic || "").slice(0, 160)}"${input.angle ? `\nThe creator's chosen angle: "${String(input.angle).slice(0, 400)}"` : ""}

Below are STORY-SHAPE FAMILIES (shapes that won in this niche or across niches) and the researched FACTS. For EACH family, score 0-10 how well these facts can FILL every stage of that shape, honestly: a stage the facts can't fill lowers the score; never invent material to fit a shape. Then, for the single best-fitting family, map fact indices onto each of its stages (in its stage order).

FAMILIES:
${cands.map((c, i) => `[${i}] ${c.f.name}: ${c.f.fits}\n    stages: ${c.f.stages.map((s) => s.name).join(" → ")}`).join("\n")}

FACTS:
${numbered}

Output ONLY JSON: {"scores":[{"i":0,"fit":7,"why":"one line"}],"best":0,"stageFacts":[[0,3],[5]]}` }],
    });
    const text = msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const scored = (Array.isArray(j?.scores) ? j.scores : []).map((s: any) => ({ i: Number(s?.i), fit: Math.max(0, Math.min(10, Number(s?.fit) || 0)), why: String(s?.why || "").slice(0, 200) }))
      .filter((s: any) => cands[s.i]);
    const evidenceScore = (e: StructureFamily["evidence"]) => e.medianOutlierX * Math.sqrt(e.videos);
    const ranked = [...scored].sort((a: any, b: any) => (b.fit - a.fit) || (cands[a.i].scope === "niche" ? -1 : 1) || evidenceScore(cands[b.i].f.evidence) - evidenceScore(cands[a.i].f.evidence));
    // Within 1 point of the top fit, prefer the niche's own shape, then the stronger evidence.
    const top = ranked[0];
    const near = ranked.filter((s: any) => top && s.fit >= top.fit - 1);
    const pick = input.familyId ? scored.find((s: any) => cands[s.i].f.id === input.familyId) || null
      : near.sort((a: any, b: any) => (cands[a.i].scope === "niche" ? 0 : 1) - (cands[b.i].scope === "niche" ? 0 : 1) || evidenceScore(cands[b.i].f.evidence) - evidenceScore(cands[a.i].f.evidence))[0];
    const alternatives = ranked.map((s: any) => ({ familyId: cands[s.i].f.id, name: cands[s.i].f.name, fit: s.fit, scope: cands[s.i].scope, evidence: cands[s.i].f.evidence }));
    if (!pick || (!input.familyId && pick.fit < 6)) return { source: "skeleton", familyId: null, name: "Niche skeleton", fit: pick?.fit || 0, reason: "no winning shape fits this research well (best fit below 6/10)", scope: own?.families.length ? "niche" : "cross-niche", evidence: null, stages: skeletonStages, alternatives, ...guidance };
    const fam = cands[pick.i].f;
    // Fact mapping is only trusted for the family the model mapped (its "best"); otherwise stages carry no hints.
    const mapped = Number(j?.best) === pick.i && Array.isArray(j?.stageFacts) ? j.stageFacts : [];
    const stages = fam.stages.map((s, k) => ({ ...s, factIdx: (Array.isArray(mapped[k]) ? mapped[k] : []).map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n < facts.length) }));
    return { source: "family", familyId: fam.id, name: fam.name, fit: pick.fit, reason: pick.why, scope: cands[pick.i].scope, evidence: fam.evidence, stages, alternatives, ...guidance };
  } catch (e: any) {
    console.error(`[structure] choose attempt ${attempt + 1} failed:`, e?.message || e); // a malformed reply gets one retry
  }
  return null;
}
