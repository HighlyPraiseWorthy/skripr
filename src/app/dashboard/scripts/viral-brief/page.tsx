"use client";
import { useState, useEffect } from "react";
import GenerationProgress from "@/components/GenerationProgress";
import { joinHookBody, bodyStartsWithHook } from "@/lib/script-text";
import { VoiceSelect } from "@/components/VoiceSelect";
import { CompanionCtaToggle, SoftCtaToggle } from "@/components/CompanionCtaToggle";
import StorytellingPicker from "@/components/StorytellingPicker";
import ResearchStep from "@/components/ResearchStep";

const C = {
  bg: "#080c12", card: "#0d1520", cardHover: "#111d2e",
  border: "rgba(255,255,255,0.07)", borderAccent: "rgba(77,184,255,0.30)",
  accent: "#1a8fd1", accentDim: "#4db8ff", textBright: "#e8edf5",
  textDim: "#a6c0d8", green: "#34d399",
};

type Phase = "loading" | "pick-case" | "angles" | "research" | "storytelling" | "generating" | "result" | "resolve-error";
type Angle = { angle: string; description: string; audience: string; titleSuggestion: string; swap?: string | null; slot?: string; factRefs?: number[]; 
  // Short label for the progress screen. The composite outline sent to generation runs
  // to several hundred words, which swamped the box it was displayed in.
  displayLabel?: string; };
// Structural slots (research-before-cards). Each card fills one, so the picker
// reads as distinct entry points instead of five variations on the same beat.
const SLOT_LABELS: Record<string, string> = {
  // Case shape (documentary / true crime)
  setup: "SETUP", mechanism: "MECHANISM", climax: "CLIMAX", aftermath: "AFTERMATH", contested: "CONTESTED",
  // Explainer shape (science / Kurzgesagt): a mechanism and a sense of scale, not a climax
  premise: "PREMISE", scale: "SCALE", consequence: "CONSEQUENCE", "open-question": "OPEN QUESTION",
};
// The slots are a RUNNING ORDER, not a menu. Read in sequence they are the video, which
// is why picking one card and discarding the rest threw away most of the research.
const SLOT_ORDER = ["setup", "premise", "mechanism", "scale", "climax", "consequence", "aftermath", "contested", "open-question"];
const orderedSlots = (as: Angle[]) =>
  [...as].sort((a, b) => SLOT_ORDER.indexOf(a.slot || "") - SLOT_ORDER.indexOf(b.slot || ""));

// Which section should carry the weight, derived from the SOURCE video rather than
// guessed: find its longest section, take that section's position as a fraction of the
// runtime, and pick the slot sitting at the same relative position in our running order.
function derivePeakSlot(structure: { timestamp?: string }[] | undefined, cards: Angle[]): string | null {
  const withSlots = orderedSlots(cards.filter((c) => c.slot));
  if (!withSlots.length) return null;
  const toSec = (t?: string) => {
    const m = String(t || "").match(/^(?:(\d+):)?(\d+):(\d{2})$/);
    return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
  };
  const secs = (structure || []).map((s) => toSec(s?.timestamp)).filter((n): n is number => n !== null);
  if (secs.length >= 3) {
    let bestIdx = 0, bestSpan = 0;
    for (let i = 0; i < secs.length - 1; i++) {
      const span = secs[i + 1] - secs[i];
      if (span > bestSpan) { bestSpan = span; bestIdx = i; }
    }
    const frac = bestIdx / Math.max(1, secs.length - 1);
    return withSlots[Math.min(withSlots.length - 1, Math.round(frac * (withSlots.length - 1)))].slot || null;
  }
  // No usable timestamps: fall back to the natural peak of each shape.
  const preferred = ["climax", "scale", "mechanism"];
  return preferred.find((p) => withSlots.some((c) => c.slot === p)) || withSlots[withSlots.length - 1].slot || null;
}
type Brief = {
  hookAnalysis: { hook: string; hookType: string; whyItWorks: string };
  structure: { timestamp: string; section: string; description: string; purpose: string }[];
  retentionTriggers: { trigger: string; example: string; timestamp: string }[];
  titleFormula: { formula: string; psychology: string; remixExamples?: string[] };
  remixFramework: string; selectedTitle: string; selectedTitleDescription?: string; selectedTitleAudience?: string; videoTitle: string; channelTitle: string; niche?: string;
  sourceTranscript?: string;
  sourceEntities?: string[];
};

const Spinner = () => (
  <>
    <div style={{ width: 44, height: 44, border: "3px solid rgba(77,184,255,0.15)", borderTop: "3px solid #4db8ff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
  </>
);

// The resolved case-flow is otherwise transient React state, so a reload or a back
// navigation loses the confirm screen and the picked case, and a fresh (often different)
// resolution takes its place. Persisting it keyed to the remix title makes the case the
// user picked a durable artifact they own, not something re-rolled on every navigation.
const FLOW_KEY = "skripr_viral_flow";
const RESUMABLE_PHASES: Phase[] = ["pick-case", "angles", "research", "storytelling"];

export default function ViralBriefPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [angles, setAngles] = useState<Angle[]>([]);
  const [selectedAngle, setSelectedAngle] = useState<Angle | null>(null);
  const [sourceMaterial, setSourceMaterial] = useState<string>("");
  const [script, setScript] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [companionCta, setCompanionCta] = useState(false);
  const [softCta, setSoftCta] = useState(false);
  const [sourceVerdict, setSourceVerdict] = useState<string | null>(null);
  const [topicKind, setTopicKind] = useState<string | null>(null);
  // Case resolved BEFORE angles, so the angles, the facts, and the script all
  // descend from one settled case instead of being reconciled after the fact.
  const [groundedCase, setGroundedCase] = useState<any | null>(null);
  const [caseChoices, setCaseChoices] = useState<any[]>([]);
  const [resolving, setResolving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [groundingRunning, setGroundingRunning] = useState(false);
  const [manualCase, setManualCase] = useState("");
  // Research-before-cards: the case is deepened at confirm time, and the resulting
  // facts feed BOTH the slot cards and the research step (no re-fetch). Held here so
  // both downstream phases read the same fact set.
  const [deepFacts, setDeepFacts] = useState<{ fact: string; source: string | null; context?: boolean }[]>([]);
  // MOVE #5 — what the research honestly supports vs what the length slider asked for, so the
  // confirm/angle step can tell the truth about supportable length instead of padding.
  const [honesty, setHonesty] = useState<{ honestMinutes?: number; requestedMinutes?: number; factCount?: number; contextCount?: number; budget?: number } | null>(null);
  const [deepConflicts, setDeepConflicts] = useState<{ fact: string; source: string | null; note: string }[]>([]);
  // How heavily YouTube already covers each candidate case, shown ON the confirm card so
  // "47 videos, top one 2.3M views" (or "this is really a Spike Lee film") changes the
  // decision while it is still free to change.
  const [saturation, setSaturation] = useState<Record<string, any>>({});
  // Titles from the OTHER angle cards, kept so the creator can publish under a different
  // card's title than the angle they built on — those are natural A/B variants.
  const [altTitles, setAltTitles] = useState<string[]>([]);
  // Both result-page panels collapse by default. People land here to read the script;
  // the alternate titles and the framework check are reference, not the main event.
  const [showAltTitles, setShowAltTitles] = useState(false);
  // Which section carries the weight. Defaults from the source video's longest section,
  // so a new user gets a well-shaped video with zero decisions and an experienced one
  // has a single meaningful lever.
  const [peakSlot, setPeakSlot] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("skripr_viral_brief");
      if (!stored) { window.location.href = "/dashboard/viral-remixer"; return; }
      const b: Brief = JSON.parse(stored);
      setBrief(b);
      // Resume an in-progress flow for THIS remix so a reload or back-navigation returns to
      // the same case-confirm screen (or angles) instead of re-resolving from scratch and
      // losing the picked case. Keyed to the remix title so a different remix starts fresh.
      const savedFlow = sessionStorage.getItem(FLOW_KEY);
      if (savedFlow) {
        const f = JSON.parse(savedFlow);
        if (f && f.titleKey === b.selectedTitle && RESUMABLE_PHASES.includes(f.phase)) {
          setCaseChoices(Array.isArray(f.caseChoices) ? f.caseChoices : []);
          setGroundedCase(f.groundedCase ?? null);
          setTopicKind(f.topicKind ?? null);
          setSourceVerdict(f.sourceVerdict ?? null);
          setDeepFacts(Array.isArray(f.deepFacts) ? f.deepFacts : []);
          setDeepConflicts(Array.isArray(f.deepConflicts) ? f.deepConflicts : []);
          setAngles(Array.isArray(f.angles) ? f.angles : []);
          setSelectedAngle(f.selectedAngle ?? null);
          setPeakSlot(f.peakSlot ?? null);
          setSourceMaterial(typeof f.sourceMaterial === "string" ? f.sourceMaterial : "");
          setPhase(f.phase);
          return; // resumed — do NOT re-resolve and overwrite the picked case
        }
      }
      groundThenAngles(b);
    } catch { window.location.href = "/dashboard/viral-remixer"; }
  }, []);

  // Snapshot the case-flow whenever it changes, but only in resumable phases (never the
  // transient "loading"/"generating" or the "result" phase whose script isn't persisted),
  // so a reload restores the last stable step rather than a half-written one.
  useEffect(() => {
    if (!brief || !RESUMABLE_PHASES.includes(phase)) return;
    try {
      sessionStorage.setItem(FLOW_KEY, JSON.stringify({
        titleKey: brief.selectedTitle, phase,
        caseChoices, groundedCase, topicKind, sourceVerdict,
        deepFacts, deepConflicts, angles, selectedAngle, peakSlot, sourceMaterial,
      }));
    } catch { /* storage unavailable — the flow just won't resume, no worse than before */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, brief, caseChoices, groundedCase, topicKind, sourceVerdict, deepFacts, deepConflicts, angles, selectedAngle, peakSlot, sourceMaterial]);

  // Saturation for each candidate, fetched as soon as the confirm screen appears.
  // Best-effort and non-blocking: the card renders immediately and the coverage line
  // fills in, so a slow YouTube call never holds up the decision.
  useEffect(() => {
    if (phase !== "pick-case" || !caseChoices.length) return;
    let cancelled = false;
    (async () => {
      // Only the top candidates. A YouTube search costs 100 quota units against a
      // 10,000/day default, so fetching coverage for every candidate on every confirm
      // screen burns the same quota the Voice Match channel scan needs.
      for (const c of caseChoices.slice(0, 2)) {
        if (cancelled || !c?.name || saturation[c.name]) continue;
        try {
          const r = await fetch("/api/research/find", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "saturation", caseName: c.name }),
          });
          const d = await r.json();
          if (!cancelled && d?.saturation) setSaturation((p) => ({ ...p, [c.name]: d.saturation }));
        } catch { /* coverage is a bonus signal, never a blocker */ }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, caseChoices]);

  // Resolve the real case the remix title is about, THEN write angles on it. A
  // single clear case grounds silently; several show a picker; none (or an
  // explainer) proceeds ungated.
  // Deepen the confirmed case FIRST, then build slot cards from the facts. This is
  // the research-before-cards path: the deepen that used to run at the research step
  // runs here instead, so the cards are grounded in the real fact set (endings that
  // actually happened, an aftermath slot, etc.) rather than a 2-sentence blurb.
  async function groundAndAngles(c: any, kindOverride?: string, briefOverride?: Brief) {
    const kind = kindOverride || topicKind || "event";
    // On the mount path setBrief() has not flushed yet, so the caller passes the brief
    // directly. Reading it from state here would silently skip the whole deepen.
    const b = briefOverride || brief;
    setGroundedCase(c);
    setSourceVerdict("documented");
    setPhase("loading");
    let facts: { fact: string; source: string | null }[] = [];
    let conflicts: { fact: string; source: string | null; note: string }[] = [];
    let caseName = c.name, when = c.when;
    if (b) {
      try {
        const rr = await fetch("/api/research/find", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "deepen", caseName: c.name, caseSummary: c.summary, niche: b.niche, sourcePayoff: b.hookAnalysis?.whyItWorks, sourceSubject: b.videoTitle, kind, topicAnchor: b.selectedTitle, targetMinutes: (b as any).targetMinutes }),
        });
        const rd = await rr.json();
        if (rr.ok) {
          facts = Array.isArray(rd.facts) ? rd.facts : [];
          conflicts = Array.isArray(rd.conflicts) ? rd.conflicts : [];
          setDeepFacts(facts);
          setDeepConflicts(conflicts);
          setHonesty({ honestMinutes: rd.honestMinutes, requestedMinutes: rd.requestedMinutes, factCount: rd.factCount, contextCount: rd.contextCount, budget: rd.budget });
          if (typeof rd.caseName === "string" && rd.caseName.trim()) caseName = rd.caseName.trim();
          if (typeof rd.when === "string" && rd.when.trim()) when = rd.when.trim();
          if (caseName !== c.name || when !== c.when) setGroundedCase({ ...c, name: caseName, when });
        }
      } catch { /* fall through to blurb-grounded angles */ }
    }
    const factStrings = facts.map((f) => (f.source ? `${f.fact} (source: ${f.source})` : f.fact));
    const g = { kind, verdict: "documented", caseName, caseSummary: c.summary, when, sources: c.sources || [], facts: factStrings, hasConflict: conflicts.length > 0 };
    if (b) await fetchAngles(b, g);
  }

  function groundedGroundingFrom(): any | null {
    if (!groundedCase) return null;
    return { kind: topicKind || "event", verdict: "documented", caseName: groundedCase.name, caseSummary: groundedCase.summary, when: groundedCase.when, sources: groundedCase.sources || [], facts: deepFacts.map((f) => (f.source ? `${f.fact} (source: ${f.source})` : f.fact)) };
  }

  async function groundThenAngles(b: Brief, isRetry = false) {
    setResolving(true);
    setError(null);
    try {
      const r = await fetch("/api/research/find", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: b.selectedTitle, angle: b.selectedTitle, niche: b.niche }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d) {
        setTopicKind(d.kind || null);
        setSourceVerdict(d.verdict || null);
        const cands = Array.isArray(d.candidates) ? d.candidates : [];
        console.log("[viral-brief] resolve", { ok: r.ok, kind: d.kind, candidates: cands.length, title: b.selectedTitle });
        // Always confirm the case, even when only one resolved. The pick-case screen
        // doubles as the approval + override step for every kind, so the creator signs
        // off on what the script grounds in rather than a case being chosen silently.
        if (cands.length >= 1) {
          setCaseChoices(cands); setResolving(false); setPhase("pick-case"); return;
        }
        // ZERO CANDIDATES for ANY kind (including "event"). This used to fall through to
        // ungrounded generic angles, which FABRICATE a mechanism ("spectral analysis
        // fingerprints", "streams clustering at identical times") — the silent-fallback
        // blocker. Never render ungrounded: ground on the chosen title itself so real
        // research runs and the script is written on evidence, not invented specifics.
        console.warn("[viral-brief] resolve returned 0 candidates — grounding on the title, not ungrounded angles", { kind: d.kind, title: b.selectedTitle });
        setResolving(false);
        await groundAndAngles(
          { name: b.selectedTitle, summary: b.selectedTitleDescription || "", when: "", sources: [] as string[] },
          d.kind || "event",
          b,
        );
        return;
      }
      // HARD FAILURE (non-200 or unparseable body). Retry once, then surface an error —
      // NEVER silently render ungrounded, fabrication-prone angles.
      console.error("[viral-brief] resolve failed", { status: r.status, isRetry });
      if (!isRetry) { return groundThenAngles(b, true); }
      setResolving(false); setError("Research could not resolve this topic right now."); setPhase("resolve-error");
      return;
    } catch (e) {
      console.error("[viral-brief] resolve threw", { error: (e as any)?.message, isRetry });
      if (!isRetry) { return groundThenAngles(b, true); }
      setResolving(false); setError("Research is temporarily unavailable. Please try again in a moment."); setPhase("resolve-error");
    }
  }

  async function fetchAngles(b: Brief, g?: any) {
    let grounding = (g ?? groundedGroundingFrom()) || undefined;
    // LAST-LINE GUARANTEE: slot cards need at least 3 facts. Several routes reach this
    // function (fail-safe, scope pick, regenerate, ungrounded fall-through) and any one
    // of them arriving without facts silently produces legacy free-form cards with no
    // slot badges and no fact panel. Rather than trust every caller, deepen here when
    // the facts are missing, so the cards are grounded no matter how we got here.
    if (!Array.isArray(grounding?.facts) || grounding.facts.length < 3) {
      try {
        const subject = grounding?.caseName || b.selectedTitle;
        const rr = await fetch("/api/research/find", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "deepen", caseName: subject, caseSummary: grounding?.caseSummary || b.selectedTitleDescription || "",
            niche: b.niche, sourcePayoff: b.hookAnalysis?.whyItWorks, sourceSubject: b.videoTitle,
            kind: grounding?.kind || topicKind || "claim", topicAnchor: b.selectedTitle,
            targetMinutes: (b as any).targetMinutes,
          }),
        });
        const rd = await rr.json();
        const fs = Array.isArray(rd?.facts) ? rd.facts : [];
        if (fs.length) {
          setDeepFacts(fs);
          if (Array.isArray(rd.conflicts)) setDeepConflicts(rd.conflicts);
          setHonesty({ honestMinutes: rd.honestMinutes, requestedMinutes: rd.requestedMinutes, factCount: rd.factCount, contextCount: rd.contextCount, budget: rd.budget });
          grounding = {
            ...(grounding || {}),
            kind: grounding?.kind || topicKind || "claim",
            verdict: "documented",
            caseName: (typeof rd.caseName === "string" && rd.caseName.trim()) || subject,
            caseSummary: grounding?.caseSummary || b.selectedTitleDescription || "",
            when: (typeof rd.when === "string" && rd.when.trim()) || grounding?.when || "",
            sources: grounding?.sources || [],
            facts: fs.map((f: any) => (f?.source ? `${f.fact} (source: ${f.source})` : f?.fact)).filter(Boolean),
            hasConflict: Array.isArray(rd.conflicts) && rd.conflicts.length > 0,
          };
        }
      } catch { /* proceed ungrounded rather than block the flow */ }
    }
    try {
      const res = await fetch("/api/suggest-viral-angles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hookType: b.hookAnalysis.hookType, hookAnalysis: b.hookAnalysis, remixFramework: b.remixFramework, selectedTitle: b.selectedTitle, selectedTitleDescription: b.selectedTitleDescription, selectedTitleAudience: b.selectedTitleAudience, titleFormula: b.titleFormula, videoTitle: b.videoTitle, niche: b.niche, grounding }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const got: Angle[] = data.angles ?? [];
      setAngles(got);
      setPeakSlot(derivePeakSlot(b.structure, got));
      setPhase("angles");
    } catch (e: any) { setError(e?.message || "Failed to generate angles"); setPhase("angles"); }
  }

  // Pick an angle → go to the storytelling step (don't generate yet).
  // THE DEFAULT PATH: use every researched section, in running order, with one of them
  // weighted as the peak. Picking a single card discarded three quarters of the research
  // that was just paid for, and the slots read in sequence ARE the video.
  function handleUseOutline() {
    if (!brief) return;
    const cards = orderedSlots(angles.filter((a) => a.slot));
    if (!cards.length) return;
    const peak = peakSlot && cards.some((c) => c.slot === peakSlot) ? peakSlot : cards[cards.length - 1].slot;
    const outline = cards
      .map((c, i) => {
        const label = SLOT_LABELS[c.slot || ""] || (c.slot || "").toUpperCase();
        const isPeak = c.slot === peak;
        return `${i + 1}. ${label}${isPeak ? " — THE PEAK, this section must be the longest by a wide margin and slow right down" : ""}: ${c.description || c.angle}`;
      })
      .join("\n");
    const composite: Angle = {
      displayLabel: `${cards.map((c) => SLOT_LABELS[c.slot || ""] || c.slot).join(" → ")}${peak ? `  ·  peak: ${SLOT_LABELS[peak] || peak}` : ""}`,
      angle: `Build ONE video that runs through these sections in this exact order, each one leading into the next:\n${outline}`,
      description: cards.map((c) => c.angle).join(" · "),
      audience: cards[0]?.audience || "",
      titleSuggestion: brief.selectedTitle,
      slot: peak || undefined,
      // A full-video build uses the WHOLE researched set (case + context facts), not only the
      // facts the cards happened to cite. Passing every fact is what gives the writer the
      // distinct context material (detection, prior cases, victims, response) to fill length
      // without recycling the core five numbers — and the claim check then validates against
      // that same full set. Cards still each rest on their own factRefs for the panel.
      factRefs: deepFacts.length ? deepFacts.map((_, i) => i + 1) : Array.from(new Set(cards.flatMap((c) => c.factRefs || []))),
    };
    setAltTitles([]);
    setSelectedAngle(composite);
    setError(null);
    setPhase("research");
  }

  function handlePickAngle(angle: Angle) {
    if (!brief) return;
    // The angle you build on and the title you publish under do not have to come from
    // the same card. Keep the other cards' titles as A/B variants instead of discarding
    // three good titles the moment one card is picked.
    // Only offer alternates when the cards genuinely proposed different titles. With a
    // locked remix title every card carries the same string, so there is nothing to A/B.
    setAltTitles(
      Array.from(new Set(angles.map((a) => a.titleSuggestion)))
        .filter((t) => t && t !== angle.titleSuggestion)
        .slice(0, 4)
    );
    setSelectedAngle(angle); setError(null); setPhase("research");
  }

  async function generateWithStory(storytellingMode: string, storytellingTechniques: string[], directorNote?: string) {
    const angle = selectedAngle;
    if (!brief || !angle) return;
    setPhase("generating"); setError(null);
    // Scope the facts the SCRIPT may use to the selected sections, not the whole library.
    // The library accumulates across runs so a script could otherwise reach for a fact no
    // chosen section carries (the different-population DataReportal figure). Fall back to
    // whatever the research step assembled when the angle carries no fact refs.
    const scopedSource = (Array.isArray(angle.factRefs) && angle.factRefs.length)
      ? angle.factRefs.map((r) => deepFacts[r - 1]).filter(Boolean)
          .map((f) => (f.source ? `- ${f.fact} (source: ${f.source})` : `- ${f.fact}`)).join("\n")
      : sourceMaterial;
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: "", topic: angle.angle, niche: angle.audience, videoLength: (brief as any).targetMinutes >= 14 ? "long" : "medium", targetMinutes: (brief as any).targetMinutes ?? 15,
          hookType: brief.hookAnalysis.hookType, hookScript: brief.hookAnalysis.hook,
          // WHY the source's hook works is the actual instruction; the archetype name
          // alone ("Controversy/Stat") says nothing about execution. This was extracted,
          // displayed in the UI, and never reached generation.
          hookWhyItWorks: brief.hookAnalysis.whyItWorks,
          titleFormula: angle.titleSuggestion, remixFramework: brief.remixFramework,
          contentStructure: brief.structure, retentionTriggers: brief.retentionTriggers,
          voiceProfileId: voiceId || undefined,
          companionCta,
          softCta,
          sourceVerdict: sourceVerdict || undefined,
          topicKind: topicKind || undefined,
          storytellingMode, storytellingTechniques, directorNote: directorNote || undefined, sourceMaterial: scopedSource || undefined,
          selectedTitle: angle.titleSuggestion || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!data || data.error) {
        if (data?.limitReached) { window.location.href = "/dashboard/settings?upgrade=1"; return; }
        setError(data?.error || "The connection dropped while generating. Please try again."); setPhase("angles"); return;
      }
      setScript(data); setSavedId(data.savedId ?? null); setPhase("result");
    } catch (e: any) { setError(e?.message || "Failed to generate script"); setPhase("angles"); }
  }

  // Facts the SELECTED sections are allowed to draw on, so the grounding check judges the
  // script against its own scope, not the whole accumulated library.
  function scopedFactStrings(): string[] {
    const refs = selectedAngle?.factRefs;
    return (Array.isArray(refs) && refs.length)
      ? refs.map((r) => deepFacts[r - 1]?.fact).filter(Boolean) as string[]
      : deepFacts.map((f) => f.fact);
  }

  async function runGroundingCheck() {
    if (!script || groundingRunning) return;
    setGroundingRunning(true);
    try {
      const b = script.fullScript || script.script || script.body || script.content || "";
      const res = await fetch("/api/scripts/grounding", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: joinHookBody(script.hook || "", b), facts: scopedFactStrings() }),
      });
      const d = await res.json();
      setScript((prev: any) => prev ? { ...prev, semanticGrounding: d?.ran ? d : { ran: false } } : prev);
    } catch {
      setScript((prev: any) => prev ? { ...prev, semanticGrounding: { ran: false } } : prev);
    } finally { setGroundingRunning(false); }
  }

  async function runVerify() {
    if (!script || verifying) return;
    setVerifying(true);
    try {
      const b = script.fullScript || script.script || script.body || script.content || "";
      const res = await fetch("/api/scripts/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook: script.hook || "", body: b, title: script.title || selectedAngle?.titleSuggestion || "" }),
      });
      const d = await res.json();
      if (d && d.ran) {
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
    } catch { /* leave untouched */ }
    finally { setVerifying(false); }
  }

  function copyScript() {
    if (!script) return;
    const parts: string[] = [];
    if (script.title) parts.push("TITLE: " + script.title);
    const body = script.fullScript || script.script || script.body || script.content || "";
    if (script.hook && !bodyStartsWithHook(body, script.hook)) parts.push("HOOK:\n" + script.hook);
    if (body) parts.push(body);
    navigator.clipboard.writeText(parts.join("\n\n"));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    if (!script || saving || savedId) return;
    setSaving(true);
    try {
      if ((script as any).savedId) { setSavedId((script as any).savedId); return; }
      const t = script.title || selectedAngle?.titleSuggestion || "Untitled Script";
      const h = script.hook || "";
      const b = script.fullScript || script.script || script.body || script.content || "";
      const content = joinHookBody(h, b);
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const res = await fetch("/api/scripts/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, content, niche: selectedAngle?.audience || "", topic: selectedAngle?.angle || "", wordCount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSavedId(data.id);
    } catch (e: any) {
      setError(e?.message || "Failed to save");
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (phase === "research" && selectedAngle) return (
    <ResearchStep
      topic={selectedAngle.angle}
      topicAnchor={brief?.selectedTitle}
      niche={selectedAngle.audience || brief?.niche}
      angle={selectedAngle.titleSuggestion || selectedAngle.angle}
      angleLabel={selectedAngle.titleSuggestion || selectedAngle.angle}
      onContinue={(sm, v, k) => { setSourceMaterial(sm || ""); setSourceVerdict(v || null); setTopicKind(k || null); setPhase("storytelling"); }}
      onBack={() => setPhase("angles")}
      presetCase={groundedCase || undefined}
      presetFacts={deepFacts.length ? deepFacts : undefined}
      presetConflicts={deepConflicts.length ? deepConflicts : undefined}
      sourcePayoff={brief?.hookAnalysis?.whyItWorks || brief?.remixFramework || undefined}
      sourceSubject={brief?.videoTitle || undefined}
    />
  );

  // Several real cases fit the remix title. Pick one BEFORE angles, so the angles
  // are written about it.
  if (phase === "pick-case") return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, marginBottom: 6 }}>
          {topicKind === "explainer" || topicKind === "hypothetical" || topicKind === "claim"
            ? (caseChoices.length > 1 ? "Which version of this are you making?" : "Confirm the scope")
            : (caseChoices.length > 1 ? "Which real case is this about?" : "Confirm the case")}
        </h1>
        <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.6, marginBottom: 16 }}>
          {topicKind === "explainer" || topicKind === "hypothetical" || topicKind === "claim"
            ? "This topic could be several different videos. Pick the one you're actually making and Skripr researches that specific question, so the script explains one thing properly instead of skimming all of them."
            : caseChoices.length > 1
              ? "Your remix title matches more than one documented story. Pick one and every angle and the script will be built on it, with its real names and dates."
              : "This is the real case your title points to. Confirm it and every angle and the script will be built on it, with its real names and dates — or name a different case below."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {caseChoices.map((c: any, i: number) => (
            <button key={i}
              onClick={() => void groundAndAngles(c)}
              style={{ textAlign: "left", cursor: "pointer", padding: "14px 16px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, color: C.textBright }}>
              {/* No date shown here on purpose: the resolver's guessed range fluctuates
                  run to run and can be confidently wrong. The real range is derived from
                  the sourced facts after you continue, and shown on the grounded case. */}
              <div style={{ fontSize: 15, fontWeight: 700 }}>{c.name}</div>
              {c.summary && <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, marginTop: 4 }}>{c.summary}</div>}
              {c.whyItFits && <div style={{ fontSize: 12.5, color: C.accentDim, lineHeight: 1.5, marginTop: 5 }}>Fits your title: {c.whyItFits}</div>}
              {c.authorityTier && (
                <div style={{ fontSize: 11, color: c.authorityTier === "high" ? "#7ee6b0" : c.authorityTier === "medium" ? "#9fb6cc" : "#e6b45a", marginTop: 5, fontWeight: 600 }}>
                  {c.authorityTier === "high" ? "◆ Well documented (DOJ / major outlets)" : c.authorityTier === "medium" ? "◇ Some reliable coverage" : "△ Thinly sourced — verify before committing"}
                </div>
              )}
              {c.guardWarning && (
                <div style={{ fontSize: 11.5, color: "#e6b45a", marginTop: 5, lineHeight: 1.45 }}>⚠ {c.guardWarning}</div>
              )}
              {/* Competition signal. Knowing a case is saturated (or is really a famous
                  film) changes the decision while changing it is still free. */}
              {saturation[c.name] && (() => {
                const s = saturation[c.name];
                const tone = s.tier === "saturated" ? "#e6b45a" : s.tier === "covered" ? "#9fb6cc" : s.tier === "unknown" ? "#9fb6cc" : "#7ee6b0";
                return (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12, color: tone, lineHeight: 1.5 }}>
                      {s.tier === "saturated" ? "▲" : s.tier === "covered" ? "•" : s.tier === "unknown" ? "?" : "✦"} {s.label}
                    </div>
                    {Array.isArray(s.topTitles) && s.topTitles.length > 0 ? (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 10.5, color: C.textDim, fontWeight: 600 }}>Top videos on this case:</div>
                        {s.topTitles.map((t: string, ti: number) => (
                          <div key={ti} style={{ fontSize: 11, color: C.textDim, lineHeight: 1.45, marginTop: 2 }}>• {t}</div>
                        ))}
                        <div style={{ fontSize: 10.5, color: C.accentDim, marginTop: 3, lineHeight: 1.4 }}>If all three tell the same story, the obvious angle is taken — find the one they miss.</div>
                      </div>
                    ) : s.topTitle && <div style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>Top video: {s.topTitle}</div>}
                    {s.adaptationWarning && <div style={{ fontSize: 11.5, color: "#e6b45a", marginTop: 4, lineHeight: 1.45 }}>⚠ {s.adaptationWarning}</div>}
                  </div>
                );
              })()}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.textBright, marginBottom: 7 }}>Know the exact case you want? Name it.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
            <input
              value={manualCase}
              onChange={(e) => setManualCase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualCase.trim() && brief) {
                  // Naming a specific case IS an override of the resolver's guess. A title
                  // the resolver classified as a claim/explainer ("Alcohol is bad for you")
                  // becomes a concrete case study the moment the creator names the person
                  // or incident — so reset the kind to "event", or a stale "claim" drives
                  // the wrong notes (science-accuracy, correlational) and wrong technique
                  // suppressions (Main Character, Villain) all the way to the script.
                  void groundAndAngles({ name: manualCase.trim(), summary: "", when: "", sources: [] as string[] }, "event");
                }
              }}
              placeholder="e.g. Greg Scarpa Sr."
              style={{ flex: 1, minWidth: 240, padding: "9px 12px", borderRadius: 9, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.borderAccent}`, color: C.textBright, fontSize: 13, outline: "none" }}
            />
            <button onClick={() => {
                if (manualCase.trim() && brief) {
                  // See the Enter handler above: a named case is always an "event", never
                  // the resolver's original claim/explainer classification.
                  void groundAndAngles({ name: manualCase.trim(), summary: "", when: "", sources: [] as string[] }, "event");
                }
              }}
              style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#0e6499,#1a8fd1)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              Use this case
            </button>
          </div>
        </div>
        <button onClick={() => { setPhase("loading"); if (brief) void fetchAngles(brief, null); }}
          style={{ marginTop: 14, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12.5, color: C.textDim }}>
          None of these, continue without a specific case
        </button>
      </div>
    </div>
  );

  if (phase === "storytelling" && selectedAngle) return (
    <StorytellingPicker
      topic={selectedAngle.angle}
      niche={selectedAngle.audience || brief?.niche}
      angle={selectedAngle.titleSuggestion || selectedAngle.angle}
      angleLabel={selectedAngle.titleSuggestion || selectedAngle.angle}
      sourceTitle={brief?.videoTitle}
      sourceMaterial={sourceMaterial || undefined}
      caseName={groundedCase?.name}
      slot={selectedAngle.slot}
      topicKind={(topicKind as any) || undefined}
      onGenerate={generateWithStory}
      onBack={() => setPhase("research")}
    />
  );

  if (phase === "loading") return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "system-ui, sans-serif" }}>
      <Spinner />
      <div style={{ fontSize: 15, fontWeight: 600, color: C.accentDim }}>Crafting angles from viral DNA...</div>
      <div style={{ fontSize: 12, color: C.textDim }}>Analyzing hook · structure · retention mechanics</div>
    </div>
  );

  // Resolution hard-failed (after a retry). We deliberately do NOT render angles here: an
  // ungrounded angle set fabricates specifics, so a failed resolution surfaces as an honest
  // error the creator can retry, never a factless generic script.
  if (phase === "resolve-error") return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 30 }}>⚠</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.textBright, textAlign: "center" }}>Couldn&apos;t research this topic</div>
      <div style={{ fontSize: 13, color: C.textDim, textAlign: "center", maxWidth: 420, lineHeight: 1.55 }}>
        {error || "Research is temporarily unavailable."} Skripr won&apos;t write a script on invented facts, so nothing was generated. Try again in a moment.
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <button onClick={() => { if (brief) void groundThenAngles(brief); }}
          style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#0e6499,#1a8fd1,#4db8ff)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Try again
        </button>
        <button onClick={() => { window.location.href = "/dashboard/viral-remixer"; }}
          style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Start over
        </button>
      </div>
    </div>
  );

  if (phase === "generating") return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "system-ui, sans-serif" }}>
      <GenerationProgress
        label="Building your script..."
        fullScreen={false}
        expectedMs={45000 + (((brief as any)?.targetMinutes ?? 15) * 5000)}
      />
      {selectedAngle && (
        <div style={{ textAlign: "center", padding: "12px 20px", borderRadius: 10, background: "rgba(77,184,255,0.07)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>ANGLE</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textBright, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
            {selectedAngle.displayLabel || selectedAngle.angle}
          </div>
        </div>
      )}
      <div style={{ fontSize: 12, color: C.textDim }}>Applying viral hook · structure · retention triggers</div>
    </div>
  );

  if (phase === "result" && script) {
    const title = script.title || selectedAngle?.titleSuggestion || "";
    const hook = script.hook || "";
    const body = script.script || script.fullScript || script.body || script.content || "";
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>✦</span>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: C.textBright, letterSpacing: -0.3 }}>Your Script</h1>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setPhase("angles"); setScript(null); setSelectedAngle(null); }}
                style={{ padding: "8px 14px", borderRadius: 9, background: "rgba(77,184,255,0.07)", border: "1px solid rgba(99,102,241,0.2)", color: C.accentDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ← Try another angle
              </button>
              <button onClick={runGroundingCheck} disabled={groundingRunning}
                style={{ padding: "8px 14px", borderRadius: 9, background: "rgba(126,230,176,0.10)", border: "1px solid rgba(126,230,176,0.35)", color: "#7ee6b0", fontSize: 12, fontWeight: 600, cursor: groundingRunning ? "wait" : "pointer" }}>
                {groundingRunning ? "Reading every claim..." : script.semanticGrounding?.ran ? "Re-check claims" : "Check claims vs facts"}
              </button>
              <button onClick={runVerify} disabled={verifying}
                style={{ padding: "8px 14px", borderRadius: 9, background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.35)", color: C.green, fontSize: 12, fontWeight: 600, cursor: verifying ? "wait" : "pointer" }}>
                {verifying ? "Verifying against sources..." : script.factVerify?.ran ? "Re-verify facts" : "Verify facts"}
              </button>
              <button onClick={copyScript}
                style={{ padding: "8px 16px", borderRadius: 9, background: copied ? "rgba(52,211,153,0.12)" : "rgba(77,184,255,0.11)", border: "1px solid " + (copied ? "rgba(52,211,153,0.4)" : "rgba(99,102,241,0.3)"), color: copied ? C.green : C.accentDim, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                {copied ? "✓ Copied!" : "Copy Script"}
              </button>
            </div>
          </div>
          {title && (
            <div style={{ background: "rgba(77,184,255,0.07)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 6 }}>TITLE</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright, lineHeight: 1.4 }}>{title}</div>
              {/* The angle you built on and the title you publish under are separate
                  decisions. The other cards' titles are natural A/B variants for this
                  same script, so offer them instead of discarding them at pick time. */}
              {/* Collapsed by default: most of the time the creator is here to read the
                  script, not to shop for an alternate title. */}
              {altTitles.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <button onClick={() => setShowAltTitles((v) => !v)}
                    style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                    <span style={{ fontSize: 10, color: C.textDim, transform: showAltTitles ? "rotate(90deg)" : "none", transition: "transform .12s" }}>▶</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: 0.5 }}>
                      {altTitles.length} ALTERNATE {altTitles.length === 1 ? "TITLE" : "TITLES"} (A/B VARIANTS)
                    </span>
                  </button>
                  {showAltTitles && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                      {altTitles.map((t, i) => (
                        <button key={i} onClick={() => setScript((s: any) => ({ ...s, title: t }))}
                          style={{ textAlign: "left", cursor: "pointer", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", color: C.textBright, fontSize: 12.5 }}>
                          {t} <span style={{ color: C.textDim, fontSize: 11 }}>· {t.length} chars</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* GOVERNING PRINCIPLE — the accuracy/safety and framework-fidelity panels are no longer
              surfaced. Skripr fixes silently: the person-insinuation cut, the trailing implied-
              revelation cut, and the other accuracy guards run server-side in generateScript and the
              user receives a clean script with no scorecard — no "FRAMEWORK FIDELITY", no "SAFETY
              8/9", no "BEST PRACTICE". A quiet internal record (script._autoCuts) is kept in plumbing
              only, for preview verification and self-learning telemetry, never rendered. The only
              soft panel that remains is the creative-choice "catchy lines you're keeping" one below,
              which is authorship the user is deliberately choosing, not a compliance flag. */}

          {/* Semantic grounding — the "vivid + true" check. Vivid retellings of real facts
              are kept; only claims that assert something the facts don't carry are named.
              This is the sentence-level grounding the deterministic checks can't see. */}
          {script.semanticGrounding && (
            <div style={{ background: script.semanticGrounding.ran && script.semanticGrounding.findings?.length ? "rgba(224,102,102,0.06)" : "rgba(126,230,176,0.06)", border: `1px solid ${script.semanticGrounding.ran && script.semanticGrounding.findings?.length ? "rgba(224,102,102,0.3)" : "rgba(126,230,176,0.3)"}`, borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              {!script.semanticGrounding.ran ? (
                <div style={{ fontSize: 12.5, color: C.textDim }}>Couldn&apos;t read the claims right now — try again in a moment.</div>
              ) : !script.semanticGrounding.findings?.length ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7ee6b0", letterSpacing: 0.4 }}>EVERY CLAIM STANDS ON A FACT</div>
                  <div style={{ fontSize: 12, color: C.textDim, marginTop: 4, lineHeight: 1.5 }}>The vivid lines are dressed-up versions of your sourced facts, not new claims. Nothing asserts more than the evidence supports.</div>
                </div>
              ) : (() => {
                // Culpability findings are CUT silently server-side and never reach the user
                // (governing principle: safety problems are fixed, not flagged). Defensively filter
                // any out here too, so a "MUST FIX" panel can never render.
                const soft = script.semanticGrounding.findings.filter((f: any) => f.verdict !== "culpability");
                if (!soft.length) return null;
                return (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#f0a3a3", letterSpacing: 0.4, marginBottom: 3 }}>⚠ {soft.length} CATCHY LINE{soft.length === 1 ? "" : "S"} THAT GO{soft.length === 1 ? "ES" : ""} BEYOND YOUR FACTS</div>
                  <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 10, lineHeight: 1.5 }}>These sound great, but they assert something no fact backs. Keep them if you want the punch, but you&apos;re choosing it on purpose, not by accident.</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {soft.map((f: any, i: number) => (
                      <div key={i} style={{ paddingLeft: 10, borderLeft: `2px solid ${f.verdict === "contradicts" ? "#e06666" : f.verdict === "narrative" ? "#d98cff" : "#e6b45a"}` }}>
                        <div style={{ fontSize: 12.5, color: C.textBright, lineHeight: 1.45 }}>&ldquo;{f.claim}&rdquo;</div>
                        <div style={{ fontSize: 11.5, color: f.verdict === "contradicts" ? "#f0a3a3" : f.verdict === "narrative" ? "#d98cff" : "#e6b45a", marginTop: 2 }}>{f.verdict === "contradicts" ? "Contradicts a fact" : f.verdict === "narrative" ? "Unsupported argument across the script" : "Not in your facts"}: {f.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })()}
            </div>
          )}

          {script.factVerify?.ran && (
            <div style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.28)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: 0.4, marginBottom: 7 }}>FACT-CHECKED AGAINST SOURCES</div>
              {Array.isArray(script.factVerify.changes) && script.factVerify.changes.length > 0 && (
                <div style={{ marginBottom: script.factVerify.stillVerify?.length ? 12 : 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.textBright, marginBottom: 4 }}>Corrected in the script:</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {script.factVerify.changes.map((c: string, i: number) => (<li key={i} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>{c}</li>))}
                  </ul>
                </div>
              )}
              {Array.isArray(script.factVerify.stillVerify) && script.factVerify.stillVerify.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#fbbf24", marginBottom: 4 }}>Could not confirm, check these yourself:</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {script.factVerify.stillVerify.map((c: string, i: number) => (<li key={i} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>{c}</li>))}
                  </ul>
                </div>
              )}
              {(!script.factVerify.changes?.length && !script.factVerify.stillVerify?.length) && (
                <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>Every checkable claim confirmed against a source. Nothing to fix.</div>
              )}
            </div>
          )}
          {script.factVerify && !script.factVerify.ran && (
            <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 12, padding: "12px 18px", marginBottom: 16, fontSize: 12.5, color: C.textDim }}>
              Fact verification could not run right now. Your script is unchanged.
            </div>
          )}
          {hook && (
            <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 8 }}>HOOK · {brief?.hookAnalysis.hookType}</div>
              <div style={{ fontSize: 13, color: C.textBright, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{hook}</div>
            </div>
          )}
          {body && (
            <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "18px 22px", marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 12 }}>SCRIPT</div>
              <div style={{ fontSize: 13, color: "#aec5dd", lineHeight: 1.9, whiteSpace: "pre-wrap", maxHeight: 520, overflowY: "auto" }}>{body}</div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!savedId ? (
              <button onClick={handleSave} disabled={saving}
                style={{ width: "100%", height: 48, borderRadius: 12, background: saving ? "rgba(77,184,255,0.07)" : "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", color: saving ? C.accentDim : "#fff", border: saving ? "1px solid rgba(99,102,241,0.2)" : "none", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: saving ? "none" : "0 4px 20px rgba(77,184,255,0.30)", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {saving ? "Saving..." : "✦ Save Script"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)", color: C.green, fontSize: 13, fontWeight: 700, gap: 6 }}>
                  ✓ Script saved
                </div>
                <a href={"/dashboard/scripts/" + savedId}
                  style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
                  Open in editor →
                </a>
              </div>
            )}
            <a href="/dashboard/viral-remixer"
              style={{ width: "100%", height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.13)", color: C.textDim, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
              Analyze another video
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Slot mode = the grounded, fact-derived cards. In that mode the slot cards are
  // the real options and the raw-title card is demoted to a link below; the two-fact
  // floor also decides whether we even have enough sourced material to proceed.
  const slotMode = angles.some((a) => a.slot);
  const underSourced = slotMode && angles.length <= 1;
  const suppressed = slotMode ? Math.max(0, 5 - angles.length) : 0;
  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <a href="/dashboard/viral-remixer" style={{ fontSize: 12, color: C.textDim, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
            ← Back to Viral Remixer
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>✦</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, letterSpacing: -0.3 }}>Choose Your Angle</h1>
          </div>
          {/* The title is decided upstream and pinned here, so it is visually obvious
              that picking an angle is a sub-selection, not a replacement. */}
          {brief?.selectedTitle && (
            <div style={{ marginTop: 10, marginBottom: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.28)" }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: C.green }}>YOUR TITLE, LOCKED</span>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.textBright, marginTop: 3 }}>{brief.selectedTitle}</div>
              <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 3 }}>Every angle below builds this video. Picking one changes what the script focuses on, never the title.</div>
            </div>
          )}
          <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>{angles.some((a) => a.slot)
            ? "This is your video's outline, built from the facts you researched. Read top to bottom, the sections are the running order. Click a section to make it the peak — the one that gets told at length — then build."
            : "Pick the angle that fits your niche. Script builds around it using the viral framework."}</p>
        </div>
        {brief && (
          <div style={{ background: "rgba(77,184,255,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 8 }}>VIRAL FRAMEWORK LOADED FROM</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textBright, marginBottom: 10, lineHeight: 1.4 }}>{brief.videoTitle}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: "rgba(77,184,255,0.13)", color: C.accentDim }}>{brief.hookAnalysis.hookType} HOOK</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: "rgba(77,184,255,0.13)", color: C.accentDim }}>{brief.structure?.length ?? 0} SECTIONS</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: "rgba(77,184,255,0.13)", color: C.accentDim }}>{brief.retentionTriggers?.length ?? 0} RETENTION TRIGGERS</span>
              {brief.selectedTitle && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: "rgba(77,184,255,0.12)", color: "#9de4ff" }}>
                  TITLE: {brief.selectedTitle.slice(0, 40)}{brief.selectedTitle.length > 40 ? "…" : ""}
                </span>
              )}
            </div>
          </div>
        )}
        {error && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}
        <VoiceSelect value={voiceId} onChange={setVoiceId} />
        <CompanionCtaToggle value={companionCta} onChange={setCompanionCta} />
              <SoftCtaToggle value={softCta} onChange={setSoftCta} />

        {/* Under-sourced floor: too little sourced material for even two grounded
            cards. Don't render a sparse list that reads as broken — name the state
            and offer the two real remedies. */}
        {underSourced && (
          <div style={{ marginBottom: 16, padding: "18px 20px", borderRadius: 14, background: "rgba(217,160,69,0.07)", border: "1px solid #d9a04540" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e6b45a", marginBottom: 4 }}>Not enough sourced material for this case yet</div>
            <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.55 }}>Skripr only builds angle cards on facts it can cite, and it couldn&apos;t find enough here. Two ways forward: go back and <strong style={{ color: C.textBright }}>name a more specific case</strong>, or continue and <strong style={{ color: C.textBright }}>paste your own facts</strong> at the research step.</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Legacy (non-slot) mode: the raw remix title leads. In slot mode it is
              demoted to a link below the grounded cards, so the guarded, fact-checked
              cards are the primary options and the unguarded title is the fallback. */}
          {brief?.selectedTitle && !slotMode && (
            <div
              onClick={() => handlePickAngle({
                angle: brief.selectedTitle,
                description: brief.selectedTitleDescription || "Build the script exactly as this remix title promises.",
                audience: brief.selectedTitleAudience || "",
                titleSuggestion: brief.selectedTitle,
              })}
              style={{ background: "rgba(77,184,255,0.07)", border: "1px solid rgba(77,184,255,0.45)", borderRadius: 14, padding: "18px 20px", cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "flex-start", gap: 16 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(77,184,255,0.12)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(77,184,255,0.07)"; }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(77,184,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15, color: "#9de4ff" }}>★</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#7ed8ff", letterSpacing: 0.6, marginBottom: 5 }}>YOUR PICK, THE TITLE YOU CHOSE</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright, marginBottom: 4, lineHeight: 1.3 }}>{brief.selectedTitle}</div>
                {brief.selectedTitleDescription && (
                  <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, marginBottom: 8 }}>{brief.selectedTitleDescription}</div>
                )}
                {brief.selectedTitleAudience && (
                  <div style={{ fontSize: 11, color: C.textDim }}><span style={{ color: "#a6c0d8" }}>Audience: </span>{brief.selectedTitleAudience}</div>
                )}
              </div>
              <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>→</div>
            </div>
          )}
          {(slotMode ? orderedSlots(angles) : angles).map((a, i) => (
            <div key={i} onClick={() => { if (slotMode) { setPeakSlot(a.slot || null); } else { handlePickAngle(a); } }}
              style={{ background: slotMode && a.slot === peakSlot ? "rgba(52,211,153,0.07)" : C.card, border: `1px solid ${slotMode && a.slot === peakSlot ? "rgba(52,211,153,0.45)" : C.border}`, borderRadius: 14, padding: "18px 20px", cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "flex-start", gap: 16 }}
              onMouseEnter={e => { if (!(slotMode && a.slot === peakSlot)) { (e.currentTarget as HTMLElement).style.background = C.cardHover; (e.currentTarget as HTMLElement).style.borderColor = C.borderAccent; } }}
              onMouseLeave={e => { if (!(slotMode && a.slot === peakSlot)) { (e.currentTarget as HTMLElement).style.background = C.card; (e.currentTarget as HTMLElement).style.borderColor = C.border; } }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: slotMode && a.slot === peakSlot ? "rgba(52,211,153,0.22)" : "rgba(77,184,255,0.11)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 700, color: slotMode && a.slot === peakSlot ? "#7ee6b0" : C.accentDim }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {a.slot && SLOT_LABELS[a.slot] && (
                  <div style={{ display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: "#7ee6b0", background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 6, padding: "2px 8px", marginBottom: 6 }}>
                    {SLOT_LABELS[a.slot]}{a.factRefs && a.factRefs.length > 0 && <span style={{ color: "#a6c0d8", fontWeight: 600 }}> · {a.factRefs.length} facts</span>}
                  </div>
                )}
                {slotMode && a.slot === peakSlot && (
                  <div style={{ display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: "#0b2018", background: "#7ee6b0", borderRadius: 6, padding: "2px 8px", marginBottom: 6, marginLeft: 6 }}>
                    ★ THE PEAK
                  </div>
                )}
                {a.swap && (
                  <div style={{ display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: 0.4, color: "#4db8ff", background: "rgba(77,184,255,0.12)", border: "1px solid rgba(77,184,255,0.3)", borderRadius: 6, padding: "2px 8px", marginBottom: 6, marginLeft: a.slot ? 6 : 0 }}>
                    🔀 WHITE-SPACE SWAP · {a.swap}
                  </div>
                )}
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright, marginBottom: 4, lineHeight: 1.3 }}>{a.angle}</div>
                <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, marginBottom: 8 }}>{a.description}</div>
                {/* Only show a per-card title when it actually differs from the locked
                    one. Repeating the same title on every card is noise, and showing a
                    DIFFERENT one is the bug that let an angle replace the user's choice. */}
                {a.titleSuggestion && a.titleSuggestion !== brief?.selectedTitle && (
                  <div style={{ background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.13)", borderRadius: 7, padding: "6px 10px", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, marginRight: 6 }}>TITLE →</span>
                    <span style={{ fontSize: 11, color: "#9de4ff", fontWeight: 600 }}>{a.titleSuggestion}</span>
                  </div>
                )}
                {/* The facts this card rests on, shown so you can catch a wrong or
                    contaminated fact BEFORE building a script on it. "2 facts" is a
                    number to trust; the facts themselves are checkable. */}
                {a.slot && a.factRefs && a.factRefs.length > 0 && deepFacts.length > 0 && (
                  <div style={{ marginBottom: 8, borderLeft: "2px solid rgba(52,211,153,0.35)", paddingLeft: 10 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, color: "#7ee6b0", marginBottom: 4 }}>BUILT ON THESE FACTS — CHECK THEM</div>
                    {a.factRefs.map((r) => deepFacts[r - 1]).filter(Boolean).map((f, k) => (
                      <div key={k} style={{ fontSize: 11, color: C.textDim, lineHeight: 1.45, marginBottom: 3 }}>
                        • {f.fact}
                        {f.source && <a href={f.source} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#7ed8ff", marginLeft: 4, wordBreak: "break-all" }}>[{(() => { try { return new URL(f.source).hostname.replace(/^www\./, ""); } catch { return "source"; } })()}]</a>}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, color: C.textDim }}><span style={{ color: "#a6c0d8" }}>Audience: </span>{a.audience}</div>
                {/* Secondary control: some videos genuinely should be narrow. Kept, but
                    demoted, because the default now uses everything that was researched. */}
                {slotMode && (
                  <button onClick={(e) => { e.stopPropagation(); handlePickAngle(a); }}
                    style={{ marginTop: 8, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11.5, color: C.textDim, textDecoration: "underline" }}>
                    Or make a whole video about just this section
                  </button>
                )}
              </div>
              <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: slotMode ? "transparent" : "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", border: slotMode ? `1px solid ${a.slot === peakSlot ? "#7ee6b0" : C.border}` : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: slotMode ? (a.slot === peakSlot ? "#7ee6b0" : C.textDim) : "#fff", boxShadow: slotMode ? "none" : "0 2px 8px rgba(99,102,241,0.3)" }}>
                {slotMode ? (a.slot === peakSlot ? "★" : "☆") : "→"}
              </div>
            </div>
          ))}

          {/* FACT SUFFICIENCY. Length is chosen before research runs, so this is the first
              screen where both are known. A long target on a thin fact set does not make a
              longer video, it makes a padded one — and every fabrication this session
              appeared in the gap between what the evidence supported and what the word
              count demanded. Surfaced where the user can still act on it. */}
          {/* MOVE #5 — HONESTY CEILING. The pipeline already dug the core case and then real
              surrounding context toward the per-minute budget; if it still falls short, tell
              the truth about the supportable length rather than padding. The message IS the
              feature. Uses the server's authoritative reckoning (2.5 load-bearing facts per
              narrated minute), not a client guess. */}
          {slotMode && !underSourced && honesty?.honestMinutes && honesty?.requestedMinutes
            && honesty.honestMinutes < Math.round(honesty.requestedMinutes * 0.85) && (() => {
            const supp = honesty.honestMinutes!;
            const asked = honesty.requestedMinutes!;
            const ctx = honesty.contextCount || 0;
            const applyHonest = () => {
              // Re-target to the honest length AND rebuild the plan at N, exactly as if the
              // slider had been set to N. Without the rebuild + the honesty re-target this was
              // a dead click: the ceiling reads honesty.requestedMinutes (from the server), so
              // changing only brief.targetMinutes left the warning up and nothing regenerated.
              const nb = { ...(brief as any), targetMinutes: supp };
              setBrief(nb);
              try { sessionStorage.setItem("skripr_viral_brief", JSON.stringify(nb)); } catch { /* best effort */ }
              setHonesty((h) => (h ? { ...h, requestedMinutes: supp } : h));
              // Rebuild the angle plan from the facts already researched — pass them in so
              // fetchAngles does NOT re-deepen (facts are unchanged; only the target shrank).
              const g = {
                kind: topicKind || "event", verdict: "documented",
                caseName: groundedCase?.name, caseSummary: groundedCase?.summary, when: groundedCase?.when,
                sources: groundedCase?.sources || [],
                facts: deepFacts.map((f) => (f.source ? `${f.fact} (source: ${f.source})` : f.fact)),
              };
              setPhase("loading");
              void fetchAngles(nb, g);
            };
            return (
              <div style={{ marginTop: 4, marginBottom: 4, padding: "12px 16px", borderRadius: 12, background: "rgba(217,160,69,0.07)", border: "1px solid #d9a04540" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#e6b45a" }}>This case honestly supports about {supp} minutes, not {asked}</div>
                <div style={{ fontSize: 12, color: C.textDim, marginTop: 3, lineHeight: 1.55 }}>
                  {honesty.factCount} sourced facts{ctx > 0 ? ` (including ${ctx} of real surrounding context)` : ""} carry about {supp} minutes. Skripr already researched the case and its context to the limit of what is documented. Pushing to {asked} minutes means padding, and padding is where invented facts come from. Choose a length the evidence can carry, or pick a richer case.
                </div>
                <button onClick={applyHonest}
                  style={{ marginTop: 9, padding: "8px 14px", borderRadius: 9, border: "1px solid #d9a04566", background: "rgba(217,160,69,0.12)", color: "#e6b45a", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  Set the target to {supp} minutes
                </button>
              </div>
            );
          })()}

          {/* PRIMARY ACTION: build the whole video from every researched section. This
              is the default because the slots in order ARE the video — picking one card
              threw away most of the research that was just paid for. */}
          {slotMode && !underSourced && (
            <button onClick={handleUseOutline}
              style={{ width: "100%", marginTop: 6, padding: "16px 20px", borderRadius: 14, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#0e6499,#1a8fd1,#4db8ff)", color: "#fff", textAlign: "left", boxShadow: "0 6px 26px rgba(77,184,255,0.32)" }}>
              <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>Build the full video from all {angles.filter((a) => a.slot).length} sections →</span>
              <span style={{ display: "block", fontSize: 12.5, color: "rgba(255,255,255,0.85)", marginTop: 3 }}>
                In order, using every fact you researched{peakSlot ? `, with ${SLOT_LABELS[peakSlot] || peakSlot} as the peak` : ""}.
              </span>
            </button>
          )}

          {/* Slot mode: explain any suppressed slots so fewer-than-five doesn't read
              as breakage, then offer the raw title as a demoted fallback link. */}
          {slotMode && suppressed > 0 && !underSourced && (
            <div style={{ fontSize: 11.5, color: C.textDim, textAlign: "center", padding: "2px 0" }}>
              {suppressed} {suppressed === 1 ? "angle" : "angles"} suppressed — not enough sourced material to build them honestly.
            </div>
          )}
          {slotMode && brief?.selectedTitle && (
            <button
              onClick={() => handlePickAngle({
                angle: brief.selectedTitle,
                description: brief.selectedTitleDescription || "Build the script exactly as this remix title promises.",
                audience: brief.selectedTitleAudience || "",
                titleSuggestion: brief.selectedTitle,
              })}
              style={{ background: "none", border: `1px dashed ${C.border}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", color: C.textDim, fontSize: 12.5, textAlign: "center" }}>
              Or skip the grounded angles and use your exact title: <span style={{ color: "#9de4ff" }}>{brief.selectedTitle}</span>
            </button>
          )}
        </div>
        {angles.length > 0 && brief && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button onClick={() => { setPhase("loading"); fetchAngles(brief, groundedGroundingFrom() || undefined); }}
              style={{ background: "none", border: "none", color: C.textDim, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
              Generate different angles
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
