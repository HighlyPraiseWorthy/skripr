"use client";
import { useState, useEffect, useRef } from "react";
import GenerationProgress from "@/components/GenerationProgress";
import { joinHookBody } from "@/lib/script-text";
import { VoiceSelect } from "@/components/VoiceSelect";
import { CompanionCtaToggle, SoftCtaToggle, NoCtaToggle } from "@/components/CompanionCtaToggle";
import StorytellingPicker from "@/components/StorytellingPicker";
import ResearchStep from "@/components/ResearchStep";
import { toHookFamily } from "@/lib/hook-families";
import { validateTitle } from "@/lib/title-validate";
import { applyFinalCheck } from "@/lib/final-check-client";

const C = {
  bg: "#080c12", card: "#0d1520", cardHover: "#111d2e",
  border: "rgba(255,255,255,0.07)", borderAccent: "rgba(77,184,255,0.30)",
  accent: "#1a8fd1", accentDim: "#4db8ff", textBright: "#e8edf5",
  textDim: "#a6c0d8", green: "#34d399",
};

const EMOTION_COLOR: Record<string, string> = {
  curiosity: "#4db8ff", fear: "#f87171", anger: "#fb923c",
  excitement: "#34d399", surprise: "#9de4ff",
};

type Phase = "loading" | "pick-case" | "research" | "angles" | "storytelling" | "finish" | "generating" | "result";
const HOOK_TYPES = [
  { type: "CONTROVERSY", label: "Controversy", emoji: "⚡" },
  { type: "CURIOSITY GAP", label: "Curiosity Gap", emoji: "🧠" },
  { type: "REFRAME", label: "Reframe", emoji: "🪞" },
  { type: "MYTH-BUST", label: "Myth-Bust", emoji: "💥" },
  { type: "STORY", label: "Story", emoji: "🎬" },
  { type: "PATTERN INTERRUPT", label: "Pattern Interrupt", emoji: "🔄" },
  { type: "FEAR/STAKES", label: "Fear / Stakes", emoji: "🔥" },
  { type: "OVERLOOKED MECHANISM", label: "Overlooked Mechanism", emoji: "🔑" },
];
type Angle = { hookType: string; hookPremise: string; titleSuggestion: string; whyItWorks: string; audienceEmotion: string; warnings?: string[]; factCount?: number; spineName?: string; viewerQuestion?: string; checked?: boolean; corrections?: string[]; fixes?: { why: string[]; diffs: { field: string; was: string; now: string }[] }; };
type HookRanking = { scope: "niche" | "all"; ranks: { type: string; label: string; share: number; n: number }[] };
type Brief = { topic: string; niche: string; videoLength: string; hookTypeFilter?: string | null; voiceProfileId?: string | null; angles: Angle[]; hookRanking?: HookRanking | null; };

const Spinner = ({ label, sub }: { label: string; sub?: string }) => (
  <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, fontFamily: "system-ui, sans-serif" }}>
    <div style={{ width: 44, height: 44, border: "3px solid rgba(77,184,255,0.15)", borderTop: "3px solid #4db8ff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <div style={{ fontSize: 15, fontWeight: 600, color: C.accentDim }}>{label}</div>
    {sub && <div style={{ fontSize: 12, color: C.textDim }}>{sub}</div>}
    <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
  </div>
);

export default function ScriptBriefPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<Angle | null>(null);
  const [sourceMaterial, setSourceMaterial] = useState<string>("");
  const [script, setScript] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [appliedMagnetTitle] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [companionCta, setCompanionCta] = useState(false);
  const [softCta, setSoftCta] = useState(false);
  const [noCta, setNoCta] = useState(false);
  const [sourceVerdict, setSourceVerdict] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [topicKind, setTopicKind] = useState<string | null>(null);
  // Grounding resolved BEFORE the hook cards are written. Without this the cards
  // are composed with no knowledge of the real case and hedge ("someone who
  // allegedly sold satellite technology") instead of naming it.
  const [grounding, setGrounding] = useState<any | null>(null);
  const [groundCases, setGroundCases] = useState<any[]>([]);
  const [groundedOn, setGroundedOn] = useState<any | null>(null);
  const [groundNote, setGroundNote] = useState("");
  const [userPlan, setUserPlan] = useState<string>("free");
  // RESEARCH-BEFORE-ANGLES: the case + deepened fact objects are held so the visible ResearchStep
  // seeds them (no re-research), and the angles are then written from EXACTLY the facts the creator
  // approved there. approvedFactsRef captures the checked set on continue.
  const [researchCase, setResearchCase] = useState<{ name: string; summary?: string; when?: string; sources?: string[] } | null>(null);
  const [researchFacts, setResearchFacts] = useState<{ fact: string; source: string | null; context?: boolean }[]>([]);
  // The upstream deepen's adjudication flags, held so the visible ResearchStep can seed its
  // SOURCES-DISAGREE and DOUBLE-CHECK panels (the step skips its own deepen when facts are preset,
  // so without threading these the panels never appear on the common cache-hit re-run).
  const [researchConflicts, setResearchConflicts] = useState<{ fact: string; source: string | null; note: string }[]>([]);
  const [researchVerify, setResearchVerify] = useState<{ fact: string; source: string | null; note: string }[]>([]);
  const approvedFactsRef = useRef<{ fact: string; source: string | null }[]>([]);
  // Hook type now lives on the Angle step (moved off the Brief). Changing it regenerates the angles.
  const [hookFilter, setHookFilter] = useState<string | null>(null);
  const [openFix, setOpenFix] = useState<number | null>(null);
  const [refetchingAngles, setRefetchingAngles] = useState(false);
  const [selectedViralWord, setSelectedViralWord] = useState<string | null>(null);
  // Chunked-generation progress: {done, total} while the client loops the section writes; null on
  // the one-shot path (no per-section steps to report).
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);
  const [finalChecking, setFinalChecking] = useState(false);
  const storyChoiceRef = useRef<{ mode: string; techniques: string[]; note?: string; structure?: { structure?: any; structureFamilyId?: string } }>({ mode: "", techniques: [] });
  // ONE-MOVE (auto-pilot): set from the brief. When true, script-brief drives every phase itself —
  // auto-approve the (already auto-resolved) facts, auto-pick the best-scoring angle, use Skripr's
  // recommended storytelling, and generate — so the creator goes setup -> finished script in one move.
  const autoMode = !!(brief as any)?.auto;
  const autoFiredRef = useRef<Record<string, boolean>>({});

  // Auto-pilot orchestration: advance each phase the moment it is reached, once. Guarded so each
  // step fires exactly once. The intermediate phases render a single progress screen (below).
  useEffect(() => {
    if (!autoMode || !brief) return;
    if (phase === "research" && !autoFiredRef.current.research) {
      autoFiredRef.current.research = true;
      void continueFromResearch();
    } else if (phase === "angles" && Array.isArray(brief.angles) && brief.angles.length && !autoFiredRef.current.angles) {
      autoFiredRef.current.angles = true;
      void autoAngleToGenerate(brief.angles);
    }
  }, [autoMode, phase, brief?.angles?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pick the best angle deterministically (fewest title-validator warnings = cleanest/most accurate;
  // ties keep list order, which already leads with the strongest), fetch Skripr's recommended
  // storytelling for the topic, then generate — no user stops.
  async function autoAngleToGenerate(angles: Angle[]) {
    if (!brief) return;
    // Fewest title warnings first; on a tie, prefer the hook type proven winners in this niche open
    // with most (brief.hookRanking). Evidence breaks ties, it never overrides a cleaner title.
    const top = brief.hookRanking?.ranks?.[0]?.type || null;
    const isTop = (a: Angle) => (top && toHookFamily(a.hookType) === top ? 0 : 1);
    const best = [...angles].sort((a, b) =>
      (validateTitle(a.titleSuggestion || "").length - validateTitle(b.titleSuggestion || "").length) || (isTop(a) - isTop(b)))[0] || angles[0];
    setSelectedAngle(best);
    let mode = "", techniques: string[] = [];
    try {
      const r = await fetch("/api/storytelling/recommend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: brief.topic, niche: brief.niche, angle: best.hookPremise || best.titleSuggestion, videoLength: brief.videoLength }),
      });
      const d = await r.json();
      mode = d?.mode?.id || "";
      // Same selection the StorytellingPicker uses: a source video's original style if present,
      // otherwise the recommended set for the topic. (Outlier topic path has no source -> recommended.)
      const techs = (Array.isArray(d?.originalStyle) && d.originalStyle.length) ? d.originalStyle : (Array.isArray(d?.recommended) ? d.recommended : []);
      techniques = techs.map((t: any) => (typeof t === "string" ? t : t?.id)).filter(Boolean);
    } catch { /* fall through: generation uses its own storytelling defaults */ }
    await generateWithStory(mode, techniques, undefined, best);
  }

  useEffect(() => {
    fetch("/api/user/plan").then(r => r.json()).then(d => setUserPlan(d.plan || "free")).catch(() => {});
    try {
      const stored = sessionStorage.getItem("skripr_script_brief");
      if (!stored) { window.location.href = "/dashboard/scripts/new"; return; }
      const b: Brief = JSON.parse(stored);
      setBrief(b);
      setHookFilter(b.hookTypeFilter || null);
      if ((b as any).viralMagnetWord) setSelectedViralWord((b as any).viralMagnetWord);
      if (b.voiceProfileId) setVoiceId(b.voiceProfileId);
      // Carry CTA prefs chosen on the setup screen (esp. one-move/auto, which skips the Finish step).
      if (typeof (b as any).companionCta === "boolean") setCompanionCta((b as any).companionCta);
      if (typeof (b as any).softCta === "boolean") setSoftCta((b as any).softCta);
      if (typeof (b as any).noCta === "boolean") setNoCta((b as any).noCta);
      // Restore grounding so a reload does not lose the case the cards were built on.
      const gb = (b as any).grounding;
      if (gb) { setGrounding(gb); if (gb.caseName) setGroundedOn({ name: gb.caseName, summary: gb.caseSummary, when: gb.when, sources: gb.sources || [] }); }
      if ((b as any).topicKind) setTopicKind((b as any).topicKind);
      if ((b as any).sourceVerdict) setSourceVerdict((b as any).sourceVerdict);
      if (b.angles?.length > 0) setPhase("angles");
      // A case was already chosen on the previous screen: honor it, do not re-resolve. Go straight to
      // the research review (facts get deepened there), then angles are written from what's approved.
      else if (gb?.caseName) goToResearch(b, { name: gb.caseName, summary: gb.caseSummary, when: gb.when, sources: gb.sources || [] }, [], gb);
      else groundThenAngles(b);
    } catch { window.location.href = "/dashboard/scripts/new"; }
  }, []);

  // Store the resolved case + any pre-deepened facts, then show the VISIBLE ResearchStep. Angles are
  // written AFTER, from the approved facts — the research-before-angles order the wizard now enforces.
  function goToResearch(b: Brief, caseObj: { name: string; summary?: string; when?: string; sources?: string[] } | null, factObjs: { fact: string; source: string | null; context?: boolean }[], g?: any) {
    if (caseObj) { setResearchCase(caseObj); setGroundedOn(caseObj); }
    setResearchFacts(factObjs);
    if (g) setGrounding(g);
    setPhase("research");
  }

  // Look it up first, then write the cards. If several real cases fit the title,
  // ask which one before writing anything, since composing five cards about the
  // wrong case wastes the call and misleads the creator.
  async function groundThenAngles(b: Brief) {
    setPhase("loading");
    let g: any = null;
    try {
      const gr = await fetch("/api/research/find", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: b.topic, niche: b.niche }),
      });
      const gd = await gr.json();
      if (gr.ok) {
        g = {
          kind: gd.kind, verdict: gd.verdict,
          facts: (gd.facts || []).map((f: any) => f?.source ? `${f.fact} (source: ${f.source})` : f?.fact).filter(Boolean),
        };
        setTopicKind(gd.kind || null);
        setSourceVerdict(gd.verdict || null);
        setGroundNote(typeof gd.verdictNote === "string" ? gd.verdictNote : "");
        const cands = Array.isArray(gd.candidates) ? gd.candidates : [];
        // AUTO skips the pick-case hop: use the top authority-ranked candidate (cands[0]) and proceed
        // exactly as the single-case path. Guided mode still asks when several cases fit.
        if (gd.kind === "event" && cands.length > 1 && !(b as any).auto) {
          setGrounding(g); setGroundCases(cands); setPhase("pick-case");
          return;
        }
        if (gd.kind === "event" && cands.length >= 1) {
          let c = cands[0];
          g = { ...g, caseName: c.name, caseSummary: c.summary, when: c.when, sources: c.sources || [] };
          // Deepen the identified case at the LENGTH-SIZED budget, then hand the fact objects to the
          // research review (no re-research there). Angles are written after, from the approved set.
          let factObjs: { fact: string; source: string | null; context?: boolean }[] = [];
          try {
            const rr = await fetch("/api/research/find", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "deepen", caseName: c.name, caseSummary: c.summary || "", niche: b.niche, kind: "event", targetMinutes: (b as any).targetMinutes, topicAnchor: b.topic }),
            });
            const rd = await rr.json();
            if (rr.ok && Array.isArray(rd.facts)) {
              factObjs = rd.facts.filter((f: any) => f && typeof f.fact === "string").map((f: any) => ({ fact: f.fact, source: f.source ?? null, context: !!f.context }));
              g.facts = factObjs.map((f) => (f.source ? `${f.fact} (source: ${f.source})` : f.fact));
              // The case label came from memory; use the version checked against the sourced facts.
              if (typeof rd.cleanCaseName === "string" && rd.cleanCaseName) { c = { ...c, name: rd.cleanCaseName, summary: typeof rd.cleanCaseSummary === "string" ? rd.cleanCaseSummary : c.summary }; g.caseName = c.name; g.caseSummary = c.summary; }
              setResearchConflicts(Array.isArray(rd.conflicts) ? rd.conflicts : []);
              setResearchVerify(Array.isArray(rd.verify) ? rd.verify : []);
            }
          } catch { /* keep the topic-level facts */ }
          setGrounding(g);
          goToResearch(b, { name: c.name, summary: c.summary, when: c.when, sources: c.sources || [] }, factObjs, g);
          return;
        }
        // PHENOMENON / no-specific-case (non-event, or an event with none identified). The resolve
        // returns only a thin handful of facts; we must DEEPEN to trigger the two-tier gather (Pool A
        // hard + Pool B sourced context), passing kind so isExplainer is true and the phenomenon
        // context questions fire. Without this the wizard seeded the ~6 shallow resolve facts and the
        // deep pass never ran, which is why a 20-min phenomenon brief returned 6 facts.
        let phenomFactObjs: { fact: string; source: string | null; context?: boolean }[] = [];
        try {
          const rr = await fetch("/api/research/find", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "deepen", caseName: b.topic, caseSummary: b.niche || "", niche: b.niche, kind: gd.kind || "claim", targetMinutes: (b as any).targetMinutes, topicAnchor: b.topic }),
          });
          const rd = await rr.json();
          if (rr.ok && Array.isArray(rd.facts)) {
            phenomFactObjs = rd.facts.filter((f: any) => f && typeof f.fact === "string").map((f: any) => ({ fact: f.fact, source: f.source ?? null, context: !!f.context }));
            g.facts = phenomFactObjs.map((f) => (f.source ? `${f.fact} (source: ${f.source})` : f.fact));
            setResearchConflicts(Array.isArray(rd.conflicts) ? rd.conflicts : []);
            setResearchVerify(Array.isArray(rd.verify) ? rd.verify : []);
          }
        } catch { /* fall back to the thin resolve facts below */ }
        if (!phenomFactObjs.length) {
          phenomFactObjs = (Array.isArray(gd.facts) ? gd.facts : [])
            .filter((f: any) => f && typeof f.fact === "string")
            .map((f: any) => ({ fact: f.fact, source: f.source ?? null, context: !!f.context }));
        }
        setGrounding(g);
        goToResearch(b, null, phenomFactObjs, g);
        return;
      }
    } catch { /* grounding is best effort */ }
    // Resolve failed entirely: still show the research review so the user can research the topic.
    goToResearch(b, null, [], g);
  }

  // ResearchStep -> angles. Build the grounding from EXACTLY the approved (checked) facts, then write
  // the hook angles from it. This is the research-before-angles handoff.
  async function continueFromResearch(sm?: string, v?: any, k?: any) {
    if (!brief) return;
    setSourceMaterial(sm || "");
    if (v) setSourceVerdict(v);
    if (k) setTopicKind(k);
    const approved = approvedFactsRef.current.length ? approvedFactsRef.current : researchFacts;
    const c = researchCase;
    const g: any = {
      ...(grounding || {}),
      kind: k || topicKind || "event", verdict: "documented",
      caseName: c?.name || (grounding as any)?.caseName,
      caseSummary: c?.summary || (grounding as any)?.caseSummary || "",
      when: c?.when || (grounding as any)?.when || "",
      sources: c?.sources || (grounding as any)?.sources || [],
      facts: approved.map((f) => (f.source ? `${f.fact} (source: ${f.source})` : f.fact)),
    };
    setGrounding(g);
    await fetchAngles(brief, g);
  }

  async function fetchAngles(b: Brief, g?: any, hookOverride?: string | null, exclude?: Angle[]) {
    setPhase("loading");
    const hook = hookOverride !== undefined ? hookOverride : (hookFilter ?? b.hookTypeFilter ?? null);
    try {
      const res = await fetch("/api/suggest-script-angles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: b.topic, niche: b.niche, videoLength: b.videoLength, hookTypeFilter: hook, viralMagnetWord: (b as any).viralMagnetWord || null, grounding: (g ?? grounding) || undefined, lockedTitle: (b as any).lockTitle ? b.topic : undefined, seedAngle: (b as any).seedAngle || undefined, excludeAngles: exclude && exclude.length ? exclude.map((a) => `${a.titleSuggestion} | ${a.hookPremise}`) : undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const updated = { ...b, thinFacts: data.thinResearch ? Number(data.factCount) || 0 : null, niche: data.detectedNiche || b.niche, hookTypeFilter: hook, angles: data.angles ?? [], hookRanking: data.hookRanking ?? b.hookRanking ?? null, grounding: (g ?? grounding) || undefined, topicKind: topicKind || undefined, sourceVerdict: sourceVerdict || undefined };
      sessionStorage.setItem("skripr_script_brief", JSON.stringify(updated));
      setBrief(updated);
      setPhase("angles");
    } catch (e: any) { setError(e?.message || "Failed to generate angles"); setPhase("angles"); }
  }

  // Hook type chosen ON the angle step: set it and regenerate the angles for that hook, from the
  // SAME approved grounding (no re-research).
  async function chooseHook(hook: string | null) {
    setHookFilter(hook);
    if (!brief) return;
    setRefetchingAngles(true);
    await fetchAngles(brief, grounding, hook);
    setRefetchingAngles(false);
  }

  // The grounded case, formatted for the script prompt, so skipping the research
  // step does not discard the grounding the hook cards were built on.
  function buildUpstreamSourceMaterial(): string {
    if (!groundedOn && !grounding?.facts?.length) return "";
    const parts: string[] = [];
    if (groundedOn) {
      parts.push(`REAL CASE THIS VIDEO IS ABOUT: ${groundedOn.name}${groundedOn.when ? ` (${groundedOn.when})` : ""}`);
      if (groundedOn.summary) parts.push(groundedOn.summary);
      if (Array.isArray(groundedOn.sources) && groundedOn.sources.length) parts.push(`(sources: ${groundedOn.sources.join(", ")})`);
    }
    if (grounding?.facts?.length) parts.push(grounding.facts.map((f: string) => `- ${f}`).join("\n"));
    return parts.join("\n");
  }

  // Research already happened BEFORE the angles (research-before-angles). Picking an angle now goes
  // straight to the storytelling step, then generate — no second research pass.
  function handlePickAngle(angle: Angle) {
    if (!brief) return;
    setSelectedAngle(angle); setError(null);
    setPhase("storytelling");
  }

  async function generateWithStory(storytellingMode: string, storytellingTechniques: string[], directorNote?: string, angleOverride?: Angle) {
    const angle = angleOverride || selectedAngle;
    if (!brief || !angle) return;
    setPhase("generating"); setError(null); setGenProgress(null);
    // Shared payload — identical across the one-shot path and every chunked call, so plan, each
    // section, and finalize all see the same inputs.
    // The card's own research warnings travel with it (seen live: the card flagged "a decade behind bars"
    // against "10 to 20 years", and the script still opened with "a decade-long prison sentence").
    const corrections = Array.isArray(angle.warnings) && angle.warnings.length ? ` RESEARCH CORRECTIONS (follow these over the hook's wording where they conflict): ${angle.warnings.join(" | ")}` : "";
    const payload: any = {
      transcript: "", topic: brief.topic, niche: brief.niche,
      videoLength: brief.videoLength || "medium",
      targetMinutes: (brief as any).targetMinutes ?? undefined,
      viralMagnetWord: selectedViralWord || (brief as any).viralMagnetWord || undefined,
      voiceProfileId: voiceId || undefined,
      companionCta,
      softCta,
      noCta,
      sourceVerdict: sourceVerdict || undefined,
      topicKind: topicKind || undefined,
      hookType: angle.hookType,
      // The specific premise of the angle the user picked — so the hook generator delivers THIS
      // angle instead of every hook type opening on the same top fact.
      anglePremise: angle.hookPremise ? angle.hookPremise + corrections : undefined,
      // Where the picked card's payoff lands: the hook opens on the card's TENSION and never on this.
      anglePayoff: angle.whyItWorks || undefined,
      angleQuestion: angle.viewerQuestion || undefined,
      // The winning structure the creator kept in the storytelling step (or "none" for Skripr's own planner).
      structure: storyChoiceRef.current.structure?.structure || undefined,
      structureFamilyId: storyChoiceRef.current.structure?.structureFamilyId || undefined,
      angle: `Hook type: ${angle.hookType}. Opening hook to adapt: "${angle.hookPremise}". Suggested title: ${angle.titleSuggestion}${angle.viewerQuestion ? `. The question the hook opens, held unanswered until the payoff: ${angle.viewerQuestion}` : ""}${corrections}`,
      storytellingMode, storytellingTechniques,
      // Carry the Outlier-DNA seed (if this brief came from "Research this idea") into the
      // director note so the script is built on the proven structure, not a generic one.
      directorNote: [(brief as any)?.seedAngle ? `Structural pattern to follow (from a proven outlier): ${(brief as any).seedAngle}` : "", directorNote].filter(Boolean).join(" ") || undefined,
      sourceMaterial: [buildUpstreamSourceMaterial(), sourceMaterial].filter(Boolean).join("\n\n") || undefined,
      selectedTitle: ((brief as any)?.lockTitle ? brief?.topic : angle.titleSuggestion) || undefined,
    };
    const post = async (extra: any) => {
      const res = await fetch("/api/scripts/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...extra }),
      });
      return res.json().catch(() => null);
    };
    try {
      // CHUNKED GENERATION — the 20-min timeout fix for topic scripts. The plan call builds the story
      // blueprint (once); each section is its own short request carrying that blueprint back so the
      // plan is stable; finalize runs the tail passes on the assembled whole. Falls back to the
      // one-shot path if the blueprint can't be built or any step fails.
      let data: any = null;
      const plan = await post({ mode: "plan" });
      if (plan?.limitReached) { window.location.href = "/dashboard/settings?upgrade=1"; return; }
      if (plan && !plan.error && typeof plan.total === "number" && plan.total >= 2) {
        const total: number = plan.total;
        const blueprint = plan.blueprint; // undefined for a measured plan; present for a topic blueprint
        const sections: { title: string; content: string }[] = [];
        let priorTail = "";
        setGenProgress({ done: 0, total });
        let chunkFailed = false;
        for (let i = 0; i < total; i++) {
          const sec = await post({ mode: "section", sectionIndex: i, priorTail, blueprint, priorText: sections.map((x) => x.content).join("\n\n"), presetHook: plan.presetHook ?? null });
          if (!sec || sec.error || typeof sec.text !== "string" || !sec.text.trim()) { chunkFailed = true; break; }
          sections.push({ title: sec.name || `Section ${i + 1}`, content: sec.text });
          priorTail = typeof sec.tail === "string" ? sec.tail : sec.text.split(/\s+/).slice(-40).join(" ");
          setGenProgress({ done: i + 1, total });
        }
        if (!chunkFailed && sections.length >= 2) {
          data = await post({ mode: "finalize", sections, presetHook: plan.presetHook ?? null, blueprint });
          if (!data || data.error) {
            if (data?.limitReached) { window.location.href = "/dashboard/settings?upgrade=1"; return; }
            setError(data?.error || "The script was written but the final pass didn't complete. Please try again."); setPhase("finish"); setGenProgress(null); return;
          }
        }
      }
      // Fallback: no blueprint/measurable structure, or a step failed — one-shot path.
      if (!data || data.error) {
        setGenProgress(null);
        data = await post({});
      }
      if (!data || data.error) {
        if (data?.limitReached) { window.location.href = "/dashboard/settings?upgrade=1"; return; }
        setError(data?.error || "The connection dropped while generating. Please try again."); setPhase("finish"); setGenProgress(null); return;
      }
      // FINAL CHECK: a whole-script read against the research, as its own request (shared helper).
      setFinalChecking(true);
      data = await applyFinalCheck(data, { sourceMaterial: payload.sourceMaterial, blueprint: plan?.blueprint, topic: payload.topic });
      setFinalChecking(false);
      setScript(data); setSavedId(data.savedId ?? null); setPhase("result"); setGenProgress(null);
    } catch (e: any) { setError(e?.message || "Failed to generate script"); setPhase("finish"); setGenProgress(null); }
  }

  async function handleSave() {
    if (!script || saving || savedId) return;
    setSaving(true);
    try {
      if (!appliedMagnetTitle && (script as any).savedId) { setSavedId((script as any).savedId); return; }
      const t = appliedMagnetTitle || script.title || selectedAngle?.titleSuggestion || "Untitled Script";
      const h = script.hook || "";
      const b = script.fullScript || script.script || script.body || script.content || "";
      const content = joinHookBody(h, b);
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const res = await fetch("/api/scripts/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, content, niche: brief?.niche || "", topic: brief?.topic || "", wordCount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSavedId(data.id);
    } catch (e: any) { setError(e?.message || "Failed to save"); setTimeout(() => setError(null), 3000); }
    finally { setSaving(false); }
  }

  async function runVerify() {
    if (!script || verifying) return;
    setVerifying(true);
    try {
      const b = script.fullScript || script.script || script.body || script.content || "";
      const res = await fetch("/api/scripts/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook: script.hook || "", body: b, title: appliedMagnetTitle || script.title || "" }),
      });
      const d = await res.json();
      if (d && d.ran) {
        // Write the corrected text into every body field so copy + display both use
        // it, and stash the report for the panel.
        setScript((prev: any) => prev ? {
          ...prev,
          hook: d.hook ?? prev.hook,
          fullScript: d.body ?? prev.fullScript, script: d.body ?? prev.script,
          body: d.body ?? prev.body, content: d.body ?? prev.content,
          factVerify: d,
        } : prev);
      } else {
        setScript((prev: any) => prev ? { ...prev, factVerify: { ran: false } } : prev);
      }
    } catch { /* leave script untouched */ }
    finally { setVerifying(false); }
  }

  function copyScript() {
    if (!script) return;
    const parts: string[] = [];
    const t = appliedMagnetTitle || script.title || "";
    if (t) parts.push("TITLE: " + t);
    const b = script.fullScript || script.script || script.body || script.content || "";
    // The body already opens with the hook (the opening section carries it), so copy the body as the
    // single source of truth — never separately prepend the hook. The old startsWith check duplicated
    // the hook whenever a finalize pass edited the body's opening so it no longer matched script.hook.
    if (b) parts.push(b);
    else if (script.hook) parts.push(script.hook);
    navigator.clipboard.writeText(parts.join("\n\n"));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  // ONE-MOVE: in auto-pilot, every intermediate phase (grounding, research review, angle pick) is
  // driven automatically, so show ONE progress screen instead of flashing each step's UI. The
  // "generating" phase keeps its own section-progress screen below.
  if (autoMode && (phase === "loading" || phase === "pick-case" || phase === "research" || phase === "angles")) {
    // Show the actual stage, not a bare spinner, so the creator sees Skripr working through the flow.
    const stage =
      phase === "angles" ? { n: 3, label: "Shaping the winning angle & structure…" }
      : phase === "research" ? { n: 2, label: "Pulling and cross-checking the facts…" }
      : { n: 1, label: "Finding the real case behind the idea…" };
    return <Spinner label={`Step ${stage.n} of 4 — ${stage.label}`} sub="Skripr is building the whole script for you — no steps to click. Writing begins once the research and angle are locked." />;
  }

  // RESEARCH comes BEFORE the angles now — no angle exists yet, so this gates on the brief/case.
  if (phase === "research" && brief) return (
    <ResearchStep
      topic={researchCase?.name || brief.topic || ""}
      topicAnchor={brief.topic}
      niche={brief.niche}
      angle={brief.topic}
      angleLabel={researchCase?.name || brief.topic}
      targetMinutes={(brief as any).targetMinutes}
      presetKind={(topicKind as any) || undefined}
      presetCase={researchCase ? { name: researchCase.name, summary: researchCase.summary || "", when: researchCase.when || "", whyItFits: "", sources: researchCase.sources || [] } : undefined}
      presetFacts={researchFacts.length ? researchFacts : undefined}
      presetConflicts={researchFacts.length ? researchConflicts : undefined}
      presetVerify={researchFacts.length ? researchVerify : undefined}
      onFactsApproved={(fs) => { approvedFactsRef.current = fs; }}
      onContinue={(sm, v, k) => { void continueFromResearch(sm, v, k); }}
      onBack={() => (window.location.href = "/dashboard/scripts/new")}
    />
  );

  if (phase === "storytelling" && selectedAngle) return (
    <StorytellingPicker
      topic={brief?.topic || selectedAngle.titleSuggestion || ""}
      niche={brief?.niche}
      angle={selectedAngle.hookPremise || selectedAngle.titleSuggestion}
      angleLabel={selectedAngle.titleSuggestion || selectedAngle.hookPremise}
      // The research, so the notes step can derive producer and research notes (it never received
      // it here, so only a hidden channel default was ever sent).
      sourceMaterial={buildUpstreamSourceMaterial() || undefined}
      caseName={groundedOn?.name}
      topicKind={(topicKind as any) || undefined}
      // Storytelling technique is its own decision; capture it and advance to the FINISH step
      // (voice / viral magnet / CTAs) rather than generating straight away.
      onGenerate={(mode, techniques, note, structure) => { storyChoiceRef.current = { mode, techniques, note, structure }; setPhase("finish"); }}
      onBack={() => setPhase("angles")}
    />
  );

  if (phase === "loading") return <Spinner label="Reading up on your topic..." sub="Finding the real case, then building hook angles around it" />;

  // Several real cases fit this title, so ask before writing five cards about the
  // wrong one. This runs BEFORE the hook cards exist, which is the whole point.
  if (phase === "pick-case") return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, letterSpacing: -0.3, marginBottom: 6 }}>Which real case is this about?</h1>
        <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.6, marginBottom: 4 }}>
          Your topic matches more than one documented story. Pick one and every hook angle will be built on it, with its real names and dates.
        </p>
        {groundNote && <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.6, marginBottom: 16 }}>{groundNote}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {groundCases.map((c: any, i: number) => (
            <button key={i}
              onClick={() => {
                setGroundedOn(c);
                setSourceVerdict("documented");
                const g: any = { ...(grounding || {}), caseName: c.name, caseSummary: c.summary, when: c.when, sources: c.sources || [] };
                setGrounding(g);
                if (brief) {
                  const b = brief;
                  void (async () => {
                    setPhase("loading");
                    let factObjs: { fact: string; source: string | null; context?: boolean }[] = [];
                    let shown: any = c;
                    try {
                      const rr = await fetch("/api/research/find", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "deepen", caseName: c.name, caseSummary: c.summary || "", niche: b.niche, kind: "event", targetMinutes: (b as any).targetMinutes, topicAnchor: b.topic }),
                      });
                      const rd = await rr.json();
                      if (rr.ok && Array.isArray(rd.facts)) {
                        factObjs = rd.facts.filter((f: any) => f && typeof f.fact === "string").map((f: any) => ({ fact: f.fact, source: f.source ?? null, context: !!f.context }));
                        g.facts = factObjs.map((f) => (f.source ? `${f.fact} (source: ${f.source})` : f.fact));
                        // The case label came from memory; use the version checked against the sourced facts.
                        if (typeof rd.cleanCaseName === "string" && rd.cleanCaseName) { shown = { ...c, name: rd.cleanCaseName, summary: typeof rd.cleanCaseSummary === "string" ? rd.cleanCaseSummary : c.summary }; g.caseName = shown.name; g.caseSummary = shown.summary; setGroundedOn(shown); }
                        setGrounding({ ...g });
                        setResearchConflicts(Array.isArray(rd.conflicts) ? rd.conflicts : []);
                        setResearchVerify(Array.isArray(rd.verify) ? rd.verify : []);
                      }
                    } catch { /* keep the topic-level facts */ }
                    // Research-before-angles: review the facts, THEN write the hook angles.
                    goToResearch(b, { name: shown.name, summary: shown.summary, when: shown.when, sources: shown.sources || [] }, factObjs, g);
                  })();
                }
              }}
              style={{ textAlign: "left", cursor: "pointer", padding: "14px 16px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, color: C.textBright }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{c.name}{c.when && <span style={{ color: C.textDim, fontWeight: 500 }}> · {c.when}</span>}</div>
              {c.summary && <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, marginTop: 4 }}>{c.summary}</div>}
              {c.whyItFits && <div style={{ fontSize: 12.5, color: C.accent, lineHeight: 1.5, marginTop: 5 }}>Fits your title: {c.whyItFits}</div>}
              {Array.isArray(c.sources) && c.sources.length > 0 && (
                <div style={{ fontSize: 11, color: "#7ed8ff", marginTop: 5, wordBreak: "break-all" }}>{c.sources.slice(0, 2).join("  ")}</div>
              )}
            </button>
          ))}
        </div>
        <button onClick={() => { if (brief) goToResearch(brief, null, researchFacts, grounding); }}
          style={{ marginTop: 16, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12.5, color: C.textDim }}>
          None of these, continue without a specific case
        </button>
      </div>
    </div>
  );
  // FINISH — the last decision screen: voice, viral magnet, CTAs. Then Generate.
  if (phase === "finish" && selectedAngle) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <button onClick={() => setPhase("storytelling")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: C.textDim, marginBottom: 16 }}>&#8592; Back</button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, letterSpacing: -0.3, marginBottom: 6 }}>Finishing touches</h1>
          <p style={{ fontSize: 13, color: C.textDim, marginBottom: 20 }}>Pick a voice and calls to action. Then generate.</p>

          <VoiceSelect value={voiceId} onChange={setVoiceId} />
          <NoCtaToggle value={noCta} onChange={(v) => { setNoCta(v); if (v) { setCompanionCta(false); setSoftCta(false); } }} />
          {!noCta && <CompanionCtaToggle value={companionCta} onChange={setCompanionCta} />}
          {!noCta && <SoftCtaToggle value={softCta} onChange={setSoftCta} />}

          <button
            onClick={() => { const s = storyChoiceRef.current; void generateWithStory(s.mode, s.techniques, s.note); }}
            style={{ marginTop: 22, width: "100%", padding: "13px 24px", borderRadius: 14, background: "linear-gradient(135deg,#0e6499,#1a8fd1,#4db8ff)", color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 4px 24px rgba(77,184,255,0.35)" }}>
            ✦ Generate Script
          </button>
        </div>
      </div>
    );
  }

  if (phase === "generating") return (
    <GenerationProgress
      label="Building your script..."
      sub={finalChecking ? "final check against the research" : genProgress ? `writing section ${genProgress.done} of ${genProgress.total}` : (selectedAngle?.hookType || "") + " hook"}
      expectedMs={45000 + ((brief as any)?.targetMinutes || 5) * 5000}
    />
  );

  if (phase === "result" && script) {
    const title = appliedMagnetTitle || script.title || selectedAngle?.titleSuggestion || "";
    const hook = script.hook || "";
    const body = script.script || script.fullScript || script.body || script.content || "";
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>&#10022;</span>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: C.textBright, letterSpacing: -0.3 }}>Your Script</h1>
              {selectedAngle && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: "rgba(77,184,255,0.11)", color: C.accentDim, border: "1px solid rgba(77,184,255,0.22)" }}>{selectedAngle.hookType}</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={runVerify} disabled={verifying} style={{ padding: "8px 16px", borderRadius: 9, background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.35)", color: C.green, fontSize: 12, fontWeight: 600, cursor: verifying ? "wait" : "pointer" }}>
                {verifying ? "Verifying against sources..." : script.factVerify?.ran ? "Re-verify facts" : "Verify facts"}
              </button>
              <button onClick={copyScript} style={{ padding: "8px 16px", borderRadius: 9, background: copied ? "rgba(52,211,153,0.12)" : "rgba(77,184,255,0.11)", border: "1px solid " + (copied ? "rgba(52,211,153,0.4)" : "rgba(99,102,241,0.3)"), color: copied ? C.green : C.accentDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {copied ? "Copied!" : "Copy Script"}
              </button>
            </div>
          </div>

          {title && (
            <div style={{ background: "rgba(77,184,255,0.07)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 6 }}>TITLE</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright, lineHeight: 1.4 }}>{title}</div>
            </div>
          )}

          {/* Fact verification report: results of the on-demand web check. */}
          {script.factVerify?.ran && (
            <div style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.28)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: 0.4, marginBottom: 7 }}>
                FACT-CHECKED AGAINST SOURCES
              </div>
              {Array.isArray(script.factVerify.changes) && script.factVerify.changes.length > 0 && (
                <div style={{ marginBottom: script.factVerify.stillVerify?.length ? 12 : 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.textBright, marginBottom: 4 }}>Corrected in the script:</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {script.factVerify.changes.map((c: string, i: number) => (
                      <li key={i} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(script.factVerify.stillVerify) && script.factVerify.stillVerify.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#fbbf24", marginBottom: 4 }}>Could not confirm, check these yourself:</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {script.factVerify.stillVerify.map((c: string, i: number) => (
                      <li key={i} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(!script.factVerify.changes?.length && !script.factVerify.stillVerify?.length) && (
                <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>Every checkable claim in the script confirmed against a source. Nothing to fix.</div>
              )}
            </div>
          )}
          {script.factVerify && !script.factVerify.ran && (
            <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 12, padding: "12px 18px", marginBottom: 16, fontSize: 12.5, color: C.textDim }}>
              Fact verification could not run right now. Your script is unchanged.
            </div>
          )}

          {/* Self-review corrections: what the accuracy pass changed before you saw it. */}
          {Array.isArray(script.reviewChanges) && script.reviewChanges.length > 0 && (
            <div style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: 0.4, marginBottom: 7 }}>AUTO-CORRECTED FOR ACCURACY</div>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                {script.reviewChanges.map((c: string, i: number) => (
                  <li key={i} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Deterministic fact scan: dates and dollar figures in the script that
              were not in the researched source material. Verify these before voice. */}
          {/* The "VERIFY BEFORE PUBLISHING" figure panel was removed on purpose: surfacing "these
             numbers might be the model's recall" makes the output feel untrustworthy. Skripr verifies
             figures itself (the self-review pass), so nothing is punted to the creator. factCheck data
             is still produced internally for that pass; it is just never shown. */}

          {hook && (
            <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 8 }}>HOOK &middot; {selectedAngle?.hookType}</div>
              <div style={{ fontSize: 13, color: C.textBright, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{hook}</div>
            </div>
          )}
          {body && (
            <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "18px 22px", marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 12 }}>SCRIPT</div>
              <div style={{ fontSize: 13, color: "#aec5dd", lineHeight: 1.9, whiteSpace: "pre-wrap", maxHeight: 520, overflowY: "auto" }}>{body}</div>
            </div>
          )}
          {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!savedId ? (
              <button onClick={handleSave} disabled={saving} style={{ width: "100%", height: 48, borderRadius: 12, background: saving ? "rgba(77,184,255,0.07)" : "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", color: saving ? C.accentDim : "#fff", border: saving ? "1px solid rgba(99,102,241,0.2)" : "none", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {saving ? "Saving..." : "Save Script"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)", color: C.green, fontSize: 13, fontWeight: 700 }}>&#10003; Saved!</div>
                <a href={"/dashboard/scripts/" + savedId} style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Open in editor</a>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setPhase("angles"); setScript(null); setSelectedAngle(null); setSavedId(null); }} style={{ flex: 1, height: 40, borderRadius: 10, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.13)", color: C.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Try another hook</button>
              <a href="/dashboard/scripts/new" style={{ flex: 1, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.13)", color: C.textDim, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>New topic</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <a href="/dashboard/scripts/new" style={{ fontSize: 12, color: C.textDim, textDecoration: "none", marginBottom: 16, display: "inline-block" }}>&#8592; Back</a>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>&#10022;</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, letterSpacing: -0.3 }}>Pick Your Hook Angle</h1>
          </div>
          <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>Each card uses a different psychological hook. Pick the one that fits your style.</p>
        </div>

        {brief && (
          <div style={{ background: "rgba(77,184,255,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 0.5 }}>TOPIC</div>
              {brief.hookTypeFilter && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(77,184,255,0.13)", color: C.accentDim }}>{brief.hookTypeFilter}</span>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>{brief.topic}</div>
            {brief.niche && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{brief.niche}</div>}
            {/* What these cards were actually built on. */}
            {groundedOn && (
              <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, color: C.green }}>GROUNDED ON A REAL CASE</div>
                <div style={{ fontSize: 12.5, color: C.textBright, marginTop: 2 }}>
                  {groundedOn.name}{groundedOn.when ? ` · ${groundedOn.when}` : ""}
                </div>
                {groundCases.length > 1 && (
                  <button onClick={() => setPhase("pick-case")}
                    style={{ marginTop: 4, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: C.accent, fontWeight: 600 }}>
                    change
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {error && <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{error}</div>}
        {typeof (brief as any)?.thinFacts === "number" && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.25)", color: "#fcd34d", fontSize: 12.5, lineHeight: 1.5, marginBottom: 16 }}>
            {(brief as any).thinFacts === 0 ? "No research behind these cards, so they're built from the title alone." : `Only ${(brief as any).thinFacts} fact${(brief as any).thinFacts === 1 ? "" : "s"} in your research, so these cards can only retell one story.`} Go back and add research for different angles and a stronger video.
          </div>
        )}

        {/* HOOK TYPE lives here now (moved off the Brief). Changing it regenerates the angles for
            that hook, from the same approved research. */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 0.5, marginBottom: 10 }}>
            HOOK TYPE <span style={{ fontWeight: 400 }}>· optional, pick a psychological approach{refetchingAngles ? " · regenerating…" : ""}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, opacity: refetchingAngles ? 0.6 : 1, pointerEvents: refetchingAngles ? "none" : "auto" }}>
            <button key="__all" onClick={() => { if (hookFilter) void chooseHook(null); }}
              style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: !hookFilter ? "1.5px solid rgba(77,184,255,0.50)" : "1px solid rgba(99,102,241,0.2)",
                background: !hookFilter ? "rgba(77,184,255,0.13)" : "rgba(77,184,255,0.04)",
                color: !hookFilter ? "#7ed8ff" : "#a6c0d8", transition: "all 0.15s" }}>
              ✨ All types
            </button>
            {HOOK_TYPES.map(({ type, label, emoji }) => {
              const active = hookFilter === type;
              const rank = brief?.hookRanking?.ranks?.findIndex((r) => r.type === type) ?? -1;
              const rk = rank >= 0 ? brief!.hookRanking!.ranks[rank] : null;
              return (
                <button key={type} onClick={() => void chooseHook(active ? null : type)}
                  style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: active ? "1.5px solid rgba(77,184,255,0.50)" : "1px solid rgba(99,102,241,0.2)",
                    background: active ? "rgba(77,184,255,0.13)" : "rgba(77,184,255,0.04)",
                    color: active ? "#7ed8ff" : "#a6c0d8", transition: "all 0.15s" }}>
                  {emoji} {label}
                  {rank === 0 && rk && (
                    <span title={`${Math.round(rk.share * 100)}% of the breakout videos Skripr has studied${brief?.hookRanking?.scope === "niche" ? " in this niche" : ""} open this way`}
                      style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(52,211,153,0.14)", color: "#34d399" }}>
                      🏆 Top {brief?.hookRanking?.scope === "niche" ? "in niche" : "pick"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(brief?.angles ?? []).map((a, i) => {
            const ec = EMOTION_COLOR[a.audienceEmotion?.toLowerCase() || ""] || C.accentDim;
            return (
              <div key={i} onClick={() => handlePickAngle(a)}
                style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 16, padding: "20px 22px", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.cardHover; (e.currentTarget as HTMLElement).style.borderColor = C.borderAccent; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.card; (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: ec, letterSpacing: 0.5 }}>{a.hookType}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: ec + "22", color: ec, border: "1px solid " + ec + "44" }}>triggers {a.audienceEmotion}</span>
                    {typeof a.factCount === "number" && a.factCount > 0 && (
                      <span title={a.spineName ? `Story: ${a.spineName}` : undefined} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "rgba(77,184,255,0.08)", color: C.accentDim, border: "1px solid rgba(77,184,255,0.2)" }}>built on {a.factCount} facts</span>
                    )}
                    {a.checked && (
                      <span role={a.fixes && a.fixes.diffs.length ? "button" : undefined}
                        onClick={(e) => { if (a.fixes && a.fixes.diffs.length) { e.stopPropagation(); setOpenFix(openFix === i ? null : i); } }}
                        title={a.fixes && a.fixes.diffs.length ? "See what was fixed" : "Every claim on this card was checked against your research"}
                        style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "rgba(34,197,94,0.08)", color: "#86efac", border: "1px solid rgba(34,197,94,0.25)", cursor: a.fixes && a.fixes.diffs.length ? "pointer" : "default" }}>
                        ✓ checked{a.fixes && a.fixes.diffs.length ? ` · ${a.fixes.why.length || a.fixes.diffs.length} fixed ${openFix === i ? "▴" : "▾"}` : ""}
                      </span>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff" }}>&#8594;</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.textBright, lineHeight: 1.5, marginBottom: 10 }}>&#8220;{a.hookPremise}&#8221;</div>
                {!(brief as any)?.lockTitle && (
                  <div style={{ background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.13)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, marginBottom: 4 }}>TITLE</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#9de4ff", lineHeight: 1.4 }}>{a.titleSuggestion}</div>
                  </div>
                )}
                {a.viewerQuestion && (
                  <div title="The question this hook opens. The video holds the answer until the payoff." style={{ fontSize: 12, color: C.textBright, opacity: 0.85, lineHeight: 1.45, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, marginRight: 6 }}>VIEWER ASKS</span>{a.viewerQuestion}
                  </div>
                )}
                <div style={{ fontSize: 11, color: C.textDim, fontStyle: "italic" }}>{a.whyItWorks}</div>
                {openFix === i && a.fixes && a.fixes.diffs.length > 0 && (
                  <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.18)", cursor: "default" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#86efac", letterSpacing: 0.4, marginBottom: 6 }}>FIXED BEFORE YOU SAW IT</div>
                    {a.fixes.why.map((w, k) => <div key={k} style={{ fontSize: 11.5, color: C.textBright, lineHeight: 1.45, marginBottom: 4 }}>• {w}</div>)}
                    {a.fixes.diffs.map((d, k) => (
                      <div key={k} style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim }}>{d.field.toUpperCase()}</div>
                        <div style={{ fontSize: 11.5, color: "#fca5a5", textDecoration: "line-through", lineHeight: 1.45 }}>{d.was}</div>
                        <div style={{ fontSize: 11.5, color: "#bbf7d0", lineHeight: 1.45 }}>{d.now}</div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Warnings are never shown (creator decision, 2026-10-06): after three repair rounds and the last-resort
                    sentence cut, anything left still reaches the script as RESEARCH CORRECTIONS (see anglePremise). */}
              </div>
            );
          })}
        </div>

        {(brief?.angles ?? []).length > 0 && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button onClick={() => brief && fetchAngles(brief, undefined, undefined, brief.angles)} style={{ background: "none", border: "none", color: C.textDim, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
              Generate different hook angles
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
