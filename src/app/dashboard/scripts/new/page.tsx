"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GenerationProgress from "@/components/GenerationProgress";
import { VoiceSelect } from "@/components/VoiceSelect";
import { CompanionCtaToggle, SoftCtaToggle } from "@/components/CompanionCtaToggle";
import StorytellingPicker from "@/components/StorytellingPicker";
import ResearchStep from "@/components/ResearchStep";

const C = {
  bg: "#080c12", cardBg: "#0d1520", border: "rgba(77,184,255,0.11)",
  accent: "#4db8ff", text: "#e8edf5", textDim: "#a6c0d8",
  textBright: "#e8edf5", danger: "#f87171", badgeBg: "rgba(77,184,255,0.11)", badgeText: "#7ed8ff",
};
const grad = "linear-gradient(135deg,#0e6499,#1a8fd1,#4db8ff)";

type Step = "input" | "research" | "storytelling" | "generating" | "result";
type InputMode = "url" | "paste" | "topic";

interface MagnetWordOption {
  id: string;
  word: string;
  grade: string;
  lift_range: string;
  why_it_works: string;
  category: string;
}

interface MagnetSuggestion {
  word: {
    word: string; grade: string; category: string;
    lift_range: string; why_it_works: string;
    example_before: string; example_after: string;
  };
  injectedTitle: string;
  score: number;
}

interface GeneratedScript {
  title: string; content: string; hook: string;
  fullScript?: string; sections?: unknown[]; structurePattern?: string;
  niche?: string; wordCount: number; estimatedDuration: number;
  magnetSuggestions?: MagnetSuggestion[];
}

function InputGroup({ label, hint, required, children, style }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label style={{ display: "block", fontSize: 16, fontWeight: 500, color: C.text, marginBottom: 6 }}>
        {label}{required && <span style={{ color: C.danger, marginLeft: 4 }}>*</span>}
      </label>
      {hint && <p style={{ color: C.textDim, fontSize: 15, marginBottom: 6, marginTop: -4 }}>{hint}</p>}
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 12,
  background: "#0a1220", color: C.text, fontSize: 14, fontWeight: 500,
  border: `1px solid ${C.border}`, outline: "none", boxSizing: "border-box",
} as React.CSSProperties;

export default function NewScriptPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [inputMode, setInputMode] = useState<InputMode>("topic");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [pastedTranscript, setPastedTranscript] = useState("");
  const [niche, setNiche] = useState("");
  const [topic, setTopic] = useState("");
  const [videoMinutes, setVideoMinutes] = useState<number>(15);
  const [extraSeconds, setExtraSeconds] = useState<number>(26);
  const [transcriptText, setTranscriptText] = useState("");
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [verifyingScript, setVerifyingScript] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [companionCta, setCompanionCta] = useState(false);
  const [softCta, setSoftCta] = useState(false);
  const [sourceVerdict, setSourceVerdict] = useState<string | null>(null);
  const [topicKind, setTopicKind] = useState<string | null>(null);
  // Grounding resolved at the TOPIC stage, before angles, so the angle cards can
  // name the real case. Cached per topic: one lookup feeds the angles, the script,
  // and the research step.
  const [grounding, setGrounding] = useState<any | null>(null);
  const [groundCases, setGroundCases] = useState<any[]>([]);
  const [groundedOn, setGroundedOn] = useState<any | null>(null);
  const [groundNote, setGroundNote] = useState("");
  const [groundUnresolved, setGroundUnresolved] = useState(false);
  const [manualCase, setManualCase] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [upgradeWall, setUpgradeWall] = useState(false);
  const [magnetWords, setMagnetWords] = useState<MagnetWordOption[]>([]);
  const [selectedViralWord, setSelectedViralWord] = useState<string | null>(null);
  const [magnetGradeFilterScript, setMagnetGradeFilterScript] = useState<string>("all");
  const [lastUsedTranscript, setLastUsedTranscript] = useState<string>("");
  const [transcriptWordCount, setTranscriptWordCount] = useState<number | null>(null);
  const [transcriptSource, setTranscriptSource] = useState<"auto" | "paste" | null>(null);
  const [selectedMagnet, setSelectedMagnet] = useState<number | null>(null);
  const [appliedMagnetTitle, setAppliedMagnetTitle] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [nicheBendSource, setNicheBendSource] = useState<string | null>(null);
  const [hookRewriteCount, setHookRewriteCount] = useState(0);
  const [rewritingHook, setRewritingHook] = useState(false);
  const [pendingHook, setPendingHook] = useState<string | null>(null);
  const [viralFramework, setViralFramework] = useState<{remixFramework: string; hookType: string; titleFormula: string; selectedTitle?: string} | null>(null);
  const [angle, setAngle] = useState("");
  const [pendingTranscript, setPendingTranscript] = useState<string>("");
  const [sourceMaterial, setSourceMaterial] = useState<string>("");
  const [suggestingAngles, setSuggestingAngles] = useState(false);
  const [angleSuggestions, setAngleSuggestions] = useState<string[]>([]);
  const [angleWarnings, setAngleWarnings] = useState<string[][]>([]);
  const [selectedHookType, setSelectedHookType] = useState<string | null>(null);
  const [lockTitle, setLockTitle] = useState(false);

  // ── Persist state across navigation ───────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("skripr_sg_state");
      if (!saved) return;
      const s = JSON.parse(saved);
      if (s.inputMode) setInputMode(s.inputMode);
      if (s.youtubeUrl) setYoutubeUrl(s.youtubeUrl);
      if (s.topic) setTopic(s.topic);
      if (s.niche) setNiche(s.niche);
      if (s.pastedTranscript) setPastedTranscript(s.pastedTranscript);
      if (s.videoMinutes) setVideoMinutes(s.videoMinutes);
      if (s.extraSeconds) setExtraSeconds(s.extraSeconds);
      if (s.selectedHookType !== undefined) setSelectedHookType(s.selectedHookType);
      if (s.magnetWords?.length) setMagnetWords(s.magnetWords);
      // Never restore "result"/"generating": the script object isn't persisted,
      // so restoring those steps renders a blank page. Fresh visits start at input.
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("skripr_sg_state", JSON.stringify({
        inputMode, youtubeUrl, topic, niche, pastedTranscript,
        videoMinutes, extraSeconds, selectedHookType,
        magnetWords,
      }));
    } catch {}
  }, [inputMode, youtubeUrl, topic, niche, pastedTranscript, videoMinutes, extraSeconds, selectedHookType, magnetWords, step]);


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("topic");
    const n = params.get("niche");
    const adj = params.get("adjacent");
    if (t) { setTopic(t); setNicheBendSource(t); }
    if (n && adj) setNiche(`${n} × ${adj}`);
    else if (n) setNiche(n);
    const rfParam = params.get("remixFramework");
    const htParam = params.get("hookType");
    const tfParam = params.get("titleFormula");
    const stParam = params.get("selectedTitle");
    if (rfParam) setViralFramework({ remixFramework: rfParam, hookType: htParam || "", titleFormula: tfParam || "", selectedTitle: stParam || "" });
    // Auto-fire generation if coming from Niche Bend
    if (t) {
      setStep("generating");
      const topicVal = t;
      const nicheVal = (n && adj) ? `${n} × ${adj}` : (n || "");
      fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "", topic: topicVal, niche: nicheVal, videoLength: videoMinutes >= 14 ? "long" : "medium", targetMinutes: videoMinutes, viralMagnetWord: selectedViralWord || undefined, voiceProfileId: voiceId || undefined, companionCta, softCta, angle: undefined, remixFramework: rfParam || undefined, hookType: htParam || undefined, titleFormula: tfParam || undefined }),
      })
        .then(r => r.json().catch(() => null))
        .then(data => {
          if (!data || data.error) {
            if (data?.limitReached) {
              setUpgradeWall(true);
            } else {
              setError(data?.error || "The connection dropped while generating. Please try again.");
            }
            setStep("input");
          } else { setGeneratedScript(data); setAppliedMagnetTitle(null); setSelectedMagnet(null); setHookRewriteCount(0); setSavedId((data as any).savedId ?? null); setStep("result"); }
        })
        .catch(e => { setError(e.message); setStep("input"); });
    }
  }, []);

  // Prefill from the free Video Ideas Generator. Uses a separate `prefillTopic`
  // param (not `topic`, which auto-fires generation) and falls back to the
  // localStorage stash so the idea survives the sign-up redirect. Fills the
  // Topic Only box without auto-generating.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("topic")) return; // the auto-fire path owns this case
    let pending = params.get("prefillTopic");
    if (!pending) {
      try { pending = localStorage.getItem("skripr_pending_topic"); } catch {}
    }
    if (pending && pending.trim()) {
      setInputMode("topic");
      setTopic(pending.trim());
      try { localStorage.removeItem("skripr_pending_topic"); } catch {}
      return;
    }
    // From the free transcript tool: carry the proven video's URL into URL mode.
    let pendingUrl = params.get("prefillUrl");
    if (!pendingUrl) {
      try { pendingUrl = localStorage.getItem("skripr_pending_url"); } catch {}
    }
    if (pendingUrl && pendingUrl.trim()) {
      setInputMode("url");
      setYoutubeUrl(pendingUrl.trim());
      try { localStorage.removeItem("skripr_pending_url"); } catch {}
    }
  }, []);

  useEffect(() => {
    fetch("/api/user/plan").then(r => r.json()).then(d => setUserPlan(d.plan || "free")).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/magnet-words").then(r => r.json()).then(d => setMagnetWords(d.words || [])).catch(() => {});
  }, []);

  async function handleExtractOrProceed() {
    setError(null);
    setUpgradeWall(false);
    if (inputMode === "topic") {
      if (!topic.trim()) { setError("Please enter a topic first."); return; }
      await runGenerate("");
      return;
    } else if (inputMode === "paste") {
      if (!pastedTranscript.trim()) { setError("Please paste a transcript first."); return; }
      setTranscriptText(pastedTranscript.trim());
      setTranscriptWordCount(pastedTranscript.trim().split(/\s+/).filter(Boolean).length);
      setTranscriptSource("paste");
      await runGenerate(pastedTranscript.trim());
    } else {
      if (!youtubeUrl.trim()) {
        if (nicheBendSource) { await runGenerate(""); return; }
        setError("Please enter a YouTube URL."); return;
      }
      setExtracting(true);
      try {
        const res = await fetch("/api/transcript", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ youtubeUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to extract transcript");
        setTranscriptText(data.transcript);
        setTranscriptWordCount(data.transcript.trim().split(/\s+/).filter(Boolean).length);
        setTranscriptSource("auto");
        await runGenerate(data.transcript);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to extract transcript");
      } finally {
        setExtracting(false);
      }
    }
  }

  // Interactive path: hold the transcript and show the storytelling step before
  // writing. The query-param auto-gen path keeps generating directly (server
  // auto-selects the mode there).
  function runGenerate(transcript: string) {
    setPendingTranscript(transcript);
    setStep("research");
  }

  // The grounded case resolved at the topic stage, formatted for the script prompt.
  // Without this, skipping the research step would throw away the grounding the
  // angles were already built on.
  // Ground on ONE specific case: research it, set it as the grounding, and rewrite
  // the angles from it. Shared so the picker and the manual override behave
  // identically. The manual path is the deterministic escape hatch when live
  // search keeps drifting: type "Christopher Boyce" and you get Boyce, every time.
  async function groundOnCase(c: { name: string; summary?: string; when?: string; sources?: string[] }) {
    setGroundedOn({ name: c.name, summary: c.summary || "", when: c.when || "", sources: c.sources || [] });
    setGroundUnresolved(false);
    setManualOpen(false);
    setSourceVerdict("documented");
    setSuggestingAngles(true);
    setAngleSuggestions([]);
    // Build grounding CLEAN for this case. Do NOT spread the previous grounding:
    // it still holds the prior case's facts, and if the fresh research returns
    // nothing, those stale facts would ship under this case's name and the angle
    // generator would build a video about the wrong story. Facts start empty and
    // are filled ONLY from research about THIS case.
    const g: any = { kind: "event", verdict: "documented", caseName: c.name, caseSummary: c.summary || "", when: c.when || "", sources: c.sources || [], facts: [] };
    try {
      // Deepen: Claude names the documentary-critical questions, Perplexity sources
      // the answers, so the angles get real programs, motives, and settings instead
      // of hedging around them.
      const rr = await fetch("/api/research/find", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deepen", caseName: c.name, caseSummary: c.summary || "", niche }),
      });
      const rd = await rr.json();
      if (rr.ok && Array.isArray(rd.facts) && rd.facts.length) {
        g.facts = rd.facts.map((f: any) => f?.source ? `${f.fact} (source: ${f.source})` : f?.fact).filter(Boolean);
      }
    } catch { /* fresh research failed: ground on the case name + summary only, no borrowed facts */ }
    setGrounding(g);
    try {
      const res = await fetch("/api/suggest-angles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, niche, grounding: g }),
      });
      const data = await res.json();
      if (data.angles) { setAngleSuggestions(data.angles); setAngleWarnings(Array.isArray(data.warnings) ? data.warnings : []); }
    } catch {}
    setSuggestingAngles(false);
  }

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

  async function runVerifyScript() {
    if (!generatedScript || verifyingScript) return;
    setVerifyingScript(true);
    try {
      const b = generatedScript.fullScript || generatedScript.content || "";
      const res = await fetch("/api/scripts/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook: generatedScript.hook || "", body: b, title: appliedMagnetTitle || generatedScript.title || "" }),
      });
      const d = await res.json();
      setGeneratedScript((prev: any) => prev ? (d && d.ran
        ? { ...prev, hook: d.hook ?? prev.hook, fullScript: d.body ?? prev.fullScript, content: d.body ?? prev.content, factVerify: d }
        : { ...prev, factVerify: { ran: false } }) : prev);
    } catch { /* leave untouched */ }
    finally { setVerifyingScript(false); }
  }

  async function doGenerate(transcript: string, storytellingMode: string, storytellingTechniques: string[], sourceMaterial?: string) {
    setLastUsedTranscript(transcript);
    setStep("generating");
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, niche: niche || undefined, topic: topic || undefined, videoLength: videoMinutes >= 14 ? "long" : "medium", targetMinutes: videoMinutes, voiceProfileId: voiceId || undefined, companionCta, softCta, sourceVerdict: sourceVerdict || undefined, topicKind: topicKind || undefined,
          sourceMaterial: [buildUpstreamSourceMaterial(), sourceMaterial].filter(Boolean).join("\n\n") || undefined,
          sourceVideoId: youtubeUrl ? youtubeUrl.match(/[?&]v=([^&]+)/)?.[1] : undefined, viralMagnetWord: selectedViralWord || undefined, angle: angle || undefined, remixFramework: viralFramework?.remixFramework || undefined, hookType: viralFramework?.hookType || undefined, titleFormula: viralFramework?.selectedTitle || viralFramework?.titleFormula || undefined,
          storytellingMode, storytellingTechniques, selectedTitle: lockTitle && topic.trim() ? topic.trim() : undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || "The connection dropped while generating. Please try again.");
      setGeneratedScript({
        title: data.title, content: data.fullScript || data.content, hook: data.hook,
        structurePattern: data.sections?.length ? `${data.sections.length}-section` : undefined,
        niche: data.niche || niche, wordCount: data.wordCount, estimatedDuration: data.estimatedDuration,
      });
      setHookRewriteCount(0); setSavedId((data as any).savedId ?? null); setStep("result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate script");
      setStep("input");
    }
  }

  async function saveScript() {
    if (!generatedScript) return;
    // Already auto-saved server-side and unmodified, don't create a duplicate row
    if (savedId && !appliedMagnetTitle && hookRewriteCount === 0) {
      router.push("/dashboard/scripts");
      return;
    }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/scripts/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: appliedMagnetTitle || generatedScript.title, content: generatedScript.fullScript || generatedScript.content,
          niche: generatedScript.niche || niche, topic: topic || null,
          wordCount: generatedScript.wordCount, estimatedDuration: generatedScript.estimatedDuration,
          sourceVideoId: youtubeUrl ? youtubeUrl.match(/[?&]v=([^&]+)/)?.[1] : null,
          structurePattern: generatedScript.structurePattern,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.limitReached) {
          throw new Error(data.error + " Go to Settings → upgrade your plan.");
        }
        throw new Error(data.error || "Failed to save script");
      }
      router.push("/dashboard/scripts");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save script");
    } finally {
      setSaving(false);
    }
  }

  const canProceed = inputMode === "url" ? youtubeUrl.trim().length > 0 : inputMode === "paste" ? pastedTranscript.trim().length > 50 : topic.trim().length > 3;

  return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
      <div aria-hidden style={{ position: "fixed", top: -160, right: -100, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle,rgba(77,184,255,0.12) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto" }}>
        {viralFramework && (
          <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 12, background: "rgba(77,184,255,0.11)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 18 }}>🔥</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#7ed8ff", marginBottom: 3 }}>Viral framework loaded</div>
              <div style={{ fontSize: 12, color: "#aec5dd", lineHeight: 1.5 }}>
                Hook: <span style={{ color: "#e8edf5" }}>{viralFramework.hookType}</span>
                {viralFramework.titleFormula && <> · Formula: <span style={{ color: "#e8edf5" }}>{viralFramework.titleFormula}</span></>}
              </div>
              {viralFramework.selectedTitle && (
                <div style={{ fontSize: 12, color: "#aec5dd", marginTop: 4 }}>
                  Title: <span style={{ color: "#7ed8ff", fontWeight: 600 }}>{viralFramework.selectedTitle}</span>
                </div>
              )}
              <div style={{ fontSize: 12, color: "#aec5dd", marginTop: 4 }}>Fill in your topic and niche below, then click <strong style={{ color: "#7ed8ff" }}>Generate Script</strong>.</div>
            </div>
          </div>
        )}
        <Link href="/dashboard/scripts" style={{ color: C.accent, fontSize: 13, fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}>
          <span style={{ fontSize: 14 }}>←</span> Back to Scripts
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, marginBottom: 4 }}>New Script</h1>
        <p style={{ color: C.textDim, fontSize: 14, marginBottom: 28 }}>Generate a viral script from a YouTube video or paste your own transcript</p>

        {error && (
          <div style={{ borderRadius: 14, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", padding: "14px 18px", marginBottom: 20 }}>
            <p style={{ color: C.danger, fontSize: 14 }}>{error}</p>
          </div>
        )}

        {/* ─── INPUT STEP ─── */}
        {step === "input" && (
          <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px" }}>
          {upgradeWall && (
            <div style={{ marginBottom: 20, borderRadius: 16, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.18)", padding: "24px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>🚀</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.textBright }}>You've used all your free scripts</span>
              </div>
              <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, marginBottom: 18 }}>
                Free accounts include 2 scripts per month. Upgrade to Starter for 20 scripts, Niche Bend Engine, Viral Magnet, and Title Generator.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <a href="/dashboard/settings" style={{ flex: 1, display: "block", textAlign: "center", padding: "11px", borderRadius: 10, background: "linear-gradient(135deg,#0e6499,#1a8fd1,#4db8ff)", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none", boxShadow: "0 0 18px rgba(77,184,255,0.26)" }}>
                  Upgrade to Starter, $19/mo
                </a>
                <button onClick={() => setUpgradeWall(false)} style={{ padding: "11px 16px", borderRadius: 10, background: "transparent", border: "1px solid rgba(77,184,255,0.18)", color: C.textDim, fontSize: 13, cursor: "pointer" }}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
            {/* Tab switcher */}
            <div style={{ display: "flex", gap: 4, marginBottom: 22, background: "rgba(77,184,255,0.05)", borderRadius: 12, padding: 4 }}>
              {(["url", "paste", "topic"] as InputMode[]).map(mode => (
                <button key={mode} onClick={() => setInputMode(mode)} style={{
                  flex: 1, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                  border: "none", cursor: "pointer", transition: "all 0.15s",
                  background: inputMode === mode ? grad : "transparent",
                  color: inputMode === mode ? "#fff" : C.textDim,
                }}>
                  {mode === "url" ? "🔗  YouTube URL" : mode === "paste" ? "📋  Paste Transcript" : "✍️  Topic Only"}
                </button>
              ))}
            </div>

            {inputMode === "url" ? (
              <div>
                <InputGroup label="YouTube Video URL" hint="Paste any public YouTube video link" required>
                  <input type="text" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..." style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(77,184,255,0.30)"}
                    onBlur={e => e.currentTarget.style.borderColor = C.border} />
                </InputGroup>
                {/* How to get transcript tip */}
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.09)" }}>
                  <p style={{ color: C.textDim, fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                    💡 <strong style={{ color: C.accent }}>Tip:</strong> If auto-extraction fails, switch to "Paste Transcript", on YouTube, click <strong style={{ color: C.textBright }}>⋯ → Show transcript</strong> and paste it here.
                  </p>
                </div>
              </div>
            ) : inputMode === "paste" ? (
              <div>
                <InputGroup label="Paste Transcript" hint='On YouTube: click "⋯" below the video → "Show transcript" → copy all text' required>
                  <textarea value={pastedTranscript} onChange={e => setPastedTranscript(e.target.value)}
                    placeholder="Paste the full transcript text here..."
                    rows={10}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, fontFamily: "inherit" }} />
                </InputGroup>
                {pastedTranscript.trim().length > 0 && (
                  <p style={{ color: C.textDim, fontSize: 12, marginTop: 6 }}>
                    ~{pastedTranscript.trim().split(/\s+/).length.toLocaleString()} words
                  </p>
                )}
              </div>
            ) : null
            }

            {inputMode === "topic" ? (<>
              {/* ── Topic FIRST with red asterisk ── */}
              <div style={{ marginTop: 0 }}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: C.textBright, letterSpacing: 0.1 }}>Topic</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", padding: "2px 7px", borderRadius: 5, letterSpacing: 0.4 }}>REQUIRED</span>
                  </div>
                  <p style={{ fontSize: 15, color: C.textDim, margin: 0, lineHeight: 1.4 }}>What should your script be about? Be specific, the more focused the topic, the better the script.</p>
                </div>
                <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="e.g., morning routine, product review" style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(77,184,255,0.30)"}
                  onBlur={e => e.currentTarget.style.borderColor = C.border} />
              </div>

              {/* ── Suggest Angles, between topic and angle ── */}
              {topic.trim().length > 3 && (
                <div style={{ marginTop: 14 }}>
                  <button
                    onClick={async () => {
                      setSuggestingAngles(true);
                      setAngleSuggestions([]);
                      setGroundUnresolved(false);
                      // Ground FIRST, then ask for angles. Angles used to be written
                      // blind, which is why they came back naming nobody. Reuse a
                      // cached lookup so pressing this twice does not pay twice.
                      let g = grounding;
                      if (!g) {
                        try {
                          const gr = await fetch("/api/research/find", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ topic, niche }),
                          });
                          const gd = await gr.json();
                          if (gr.ok) {
                            g = {
                              kind: gd.kind, verdict: gd.verdict,
                              facts: (gd.facts || []).map((f: any) => f?.source ? `${f.fact} (source: ${f.source})` : f?.fact).filter(Boolean),
                            };
                            setGrounding(g);
                            setTopicKind(gd.kind || null);
                            setSourceVerdict(gd.verdict || null);
                            setGroundNote(typeof gd.verdictNote === "string" ? gd.verdictNote : "");
                            const cands = Array.isArray(gd.candidates) ? gd.candidates : [];
                            setGroundCases(cands);
                            // One clear match: ground on it silently. Several: let the
                            // creator choose, since picking the wrong case is worse
                            // than asking.
                            if (gd.kind === "event" && cands.length === 1) {
                              const c = cands[0];
                              setGroundedOn(c);
                              g = { ...g, caseName: c.name, caseSummary: c.summary, when: c.when, sources: c.sources || [] };
                              // Re-research the identified case. The angles may now only
                              // use facts they are given, so richer case-specific facts
                              // directly raise the ceiling on how concrete they can be.
                              try {
                                const rr = await fetch("/api/research/find", {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ action: "deepen", caseName: c.name, caseSummary: c.summary || "", niche }),
                                });
                                const rd = await rr.json();
                                if (rr.ok && Array.isArray(rd.facts) && rd.facts.length) {
                                  g.facts = rd.facts.map((f: any) => f?.source ? `${f.fact} (source: ${f.source})` : f?.fact).filter(Boolean);
                                }
                              } catch { /* keep the topic-level facts */ }
                              setGrounding(g);
                            }
                            // Several real cases fit: wait for the pick. Writing the
                            // angles now would build them on whichever case happened
                            // to be first and make the picker decorative.
                            if (gd.kind === "event" && cands.length > 1) {
                              setSuggestingAngles(false);
                              return;
                            }
                            // No case identified for an EVENT: the topic-level facts
                            // may describe a different story than the title, so
                            // grounding angles in them yields confident angles about
                            // the wrong subject. Stop and let the creator decide.
                            if (gd.kind === "event" && cands.length === 0) {
                              setGroundUnresolved(true);
                              setSuggestingAngles(false);
                              return;
                            }
                          }
                        } catch { /* grounding is best effort, angles still work */ }
                      }
                      try {
                        const res = await fetch("/api/suggest-angles", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ topic, niche, grounding: g || undefined }),
                        });
                        const data = await res.json();
                        if (data.angles) { setAngleSuggestions(data.angles); setAngleWarnings(Array.isArray(data.warnings) ? data.warnings : []); }
                      } catch {}
                      setSuggestingAngles(false);
                    }}
                    disabled={suggestingAngles}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      width: "100%", padding: "12px 20px", borderRadius: 12,
                      cursor: suggestingAngles ? "wait" : "pointer",
                      background: suggestingAngles ? "rgba(77,184,255,0.09)" : "linear-gradient(135deg,rgba(77,184,255,0.16),rgba(77,184,255,0.15))",
                      border: "1px solid rgba(77,184,255,0.40)",
                      color: "#7ed8ff", fontSize: 14, fontWeight: 700,
                      opacity: suggestingAngles ? 0.7 : 1, transition: "all 150ms",
                      boxShadow: suggestingAngles ? "none" : "0 0 20px rgba(77,184,255,0.16)",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{suggestingAngles ? "⟳" : "✦"}</span>
                    {suggestingAngles ? "Reading up on this first…" : "✦ Find the real story and suggest angles"}
                  </button>
                  {/* Grounded-on line: what the script will actually be about.
                      One line when a single real case fits, a picker when several do. */}
                  {groundedOn && (
                    <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.28)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: "#34d399" }}>GROUNDED ON A REAL CASE</div>
                      <div style={{ fontSize: 13, color: "#e8edf5", lineHeight: 1.5, marginTop: 3 }}>
                        {groundedOn.name}{groundedOn.when ? ` · ${groundedOn.when}` : ""}
                      </div>
                      {groundedOn.summary && <div style={{ fontSize: 12, color: "#a6c0d8", lineHeight: 1.55, marginTop: 3 }}>{groundedOn.summary}</div>}
                      <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                        {groundCases.length > 1 && (
                          <button onClick={() => setGroundedOn(null)}
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11.5, color: "#4db8ff", fontWeight: 600 }}>
                            other matches
                          </button>
                        )}
                        <button onClick={() => setManualOpen((v) => !v)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11.5, color: "#4db8ff", fontWeight: 600 }}>
                          wrong case? name it
                        </button>
                      </div>
                      {manualOpen && (
                        <div style={{ marginTop: 10, display: "flex", gap: 7, flexWrap: "wrap" as const }}>
                          <input
                            value={manualCase}
                            onChange={(e) => setManualCase(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && manualCase.trim()) groundOnCase({ name: manualCase.trim() }); }}
                            placeholder="Name the person or case, e.g. Christopher Boyce"
                            style={{ flex: 1, minWidth: 200, padding: "8px 11px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(77,184,255,0.25)", color: "#e8edf5", fontSize: 13, outline: "none" }}
                          />
                          <button onClick={() => manualCase.trim() && groundOnCase({ name: manualCase.trim() })}
                            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#0e6499,#1a8fd1)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                            Use this
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {!groundedOn && groundCases.length > 0 && (
                    <div style={{ marginTop: 12, padding: "11px 12px", borderRadius: 10, background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.2)" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#4db8ff" }}>Which real case is this about?</div>
                      <div style={{ fontSize: 11.5, color: "#a6c0d8", marginTop: 2, lineHeight: 1.5 }}>
                        Pick one and the angles and script use its real names and dates.
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 9 }}>
                        {groundCases.map((c: any, i: number) => (
                          <button key={i}
                            onClick={() => groundOnCase(c)}
                            style={{ textAlign: "left", cursor: "pointer", padding: "9px 11px", borderRadius: 9, border: "1px solid rgba(77,184,255,0.16)", background: "rgba(255,255,255,0.03)", color: "#e8edf5" }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}{c.when && <span style={{ color: "#a6c0d8", fontWeight: 500 }}> · {c.when}</span>}</div>
                            {c.summary && <div style={{ fontSize: 12, color: "#a6c0d8", lineHeight: 1.5, marginTop: 2 }}>{c.summary}</div>}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setManualOpen((v) => !v)}
                        style={{ marginTop: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11.5, color: "#4db8ff", fontWeight: 600 }}>
                        None of these? Name the case
                      </button>
                      {manualOpen && (
                        <div style={{ marginTop: 10, display: "flex", gap: 7, flexWrap: "wrap" as const }}>
                          <input
                            value={manualCase}
                            onChange={(e) => setManualCase(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && manualCase.trim()) groundOnCase({ name: manualCase.trim() }); }}
                            placeholder="Name the person or case, e.g. Christopher Boyce"
                            style={{ flex: 1, minWidth: 200, padding: "8px 11px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(77,184,255,0.25)", color: "#e8edf5", fontSize: 13, outline: "none" }}
                          />
                          <button onClick={() => manualCase.trim() && groundOnCase({ name: manualCase.trim() })}
                            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#0e6499,#1a8fd1)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                            Use this
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {groundUnresolved && !groundedOn && (
                    <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fbbf24" }}>Could not pin this to one real case</div>
                      {groundNote && <div style={{ fontSize: 12.5, color: "#e8edf5", lineHeight: 1.55, marginTop: 4 }}>{groundNote}</div>}
                      <div style={{ fontSize: 12, color: "#a6c0d8", lineHeight: 1.55, marginTop: 5 }}>
                        The research came back about the subject area rather than one story, so building angles on it risks a video about the wrong thing. Name the exact person or case and Skripr grounds on that, or continue and write your own angle below.
                      </div>
                      <div style={{ marginTop: 9, display: "flex", gap: 7, flexWrap: "wrap" as const }}>
                        <input
                          value={manualCase}
                          onChange={(e) => setManualCase(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && manualCase.trim()) groundOnCase({ name: manualCase.trim() }); }}
                          placeholder="Name the person or case, e.g. Christopher Boyce"
                          style={{ flex: 1, minWidth: 200, padding: "8px 11px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(251,191,36,0.35)", color: "#e8edf5", fontSize: 13, outline: "none" }}
                        />
                        <button onClick={() => manualCase.trim() && groundOnCase({ name: manualCase.trim() })}
                          style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#0e6499,#1a8fd1)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                          Ground on this
                        </button>
                      </div>
                      <button
                        onClick={async () => {
                          setGroundUnresolved(false);
                          setSuggestingAngles(true);
                          try {
                            // Deliberately WITHOUT grounding: unpinned facts would
                            // ground the angles in a story we cannot vouch for.
                            const res = await fetch("/api/suggest-angles", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ topic, niche }),
                            });
                            const data = await res.json();
                            if (data.angles) { setAngleSuggestions(data.angles); setAngleWarnings(Array.isArray(data.warnings) ? data.warnings : []); }
                          } catch {}
                          setSuggestingAngles(false);
                        }}
                        style={{ marginTop: 9, background: "none", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#fbbf24", fontWeight: 600 }}>
                        Suggest angles anyway
                      </button>
                    </div>
                  )}
                  {groundNote && !groundUnresolved && !groundedOn && groundCases.length === 0 && (
                    <p style={{ fontSize: 11.5, color: "#a6c0d8", marginTop: 10, lineHeight: 1.5 }}>{groundNote}</p>
                  )}
                  {angleSuggestions.length > 0 && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <p style={{ fontSize: 11, color: "#a6c0d8", marginBottom: 2 }}>Pick one, or edit it below:</p>
                      {angleSuggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setAngle(s)}
                          style={{
                            textAlign: "left", padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                            background: angle === s ? "rgba(77,184,255,0.12)" : "rgba(77,184,255,0.04)",
                            border: `1px solid ${angle === s ? "rgba(77,184,255,0.35)" : "rgba(77,184,255,0.13)"}`,
                            color: angle === s ? "#e8edf5" : "#aec5dd",
                            fontSize: 13, lineHeight: 1.5, transition: "all 0.12s",
                          }}
                        >
                          {angle === s && <span style={{ color: "#34d399", marginRight: 6 }}>✓</span>}
                          {s}
                          {Array.isArray(angleWarnings[i]) && angleWarnings[i].length > 0 && (
                            <span style={{ display: "block", marginTop: 7, fontSize: 11, color: "#fbbf24", lineHeight: 1.5 }}>
                              {angleWarnings[i].map((w, j) => (
                                <span key={j} style={{ display: "block" }}>&#9888; {w}</span>
                              ))}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── YOUR ANGLE ── */}
              <div style={{ marginTop: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 600, color: "rgba(129,140,248,0.9)", letterSpacing: 0.3, marginBottom: 7 }}>
                  <span>🎯</span> YOUR ANGLE
                  <span style={{ fontSize: 14, fontWeight: 400, color: "#a6c0d8", marginLeft: 4 }}>,  the counterintuitive truth that drives the script (optional but it sharpens the script)</span>
                </label>
                <textarea
                  value={angle}
                  onChange={e => setAngle(e.target.value)}
                  placeholder="e.g. It's not the caffeine, it's the cortisol timing. Most people drink coffee during the worst 90-minute window of their day and it silently wrecks their focus."
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 12,
                    background: "#0a1220", color: "#e8edf5", fontSize: 13,
                    border: "1px solid rgba(77,184,255,0.13)", outline: "none",
                    resize: "vertical", lineHeight: 1.6, fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(77,184,255,0.40)"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(77,184,255,0.13)"}
                />
                {angle && (
                  <p style={{ fontSize: 11, color: "#34d399", marginTop: 5 }}>
                    ✓ Angle locked, our AI will build the entire script around this perspective
                  </p>
                )}
              </div>

              {/* ── Niche BELOW angle in topic mode ── */}
              <InputGroup label="Niche (optional)" hint="e.g. fitness, tech, science" style={{ marginTop: 16 }}>
                <input type="text" value={niche} onChange={e => setNiche(e.target.value)}
                  placeholder="e.g., fitness, tech, cooking" style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(77,184,255,0.30)"}
                  onBlur={e => e.currentTarget.style.borderColor = C.border} />
              </InputGroup>
            </>) : (<>
              {/* ── Niche first in url/paste mode ── */}
              <InputGroup label="Niche (optional)" hint="e.g. fitness, tech, science" style={{ marginTop: 16 }}>
                <input type="text" value={niche} onChange={e => setNiche(e.target.value)}
                  placeholder="e.g., fitness, tech, cooking" style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(77,184,255,0.30)"}
                  onBlur={e => e.currentTarget.style.borderColor = C.border} />
              </InputGroup>

              {/* ── Topic optional in url/paste mode ── */}
              <InputGroup label="Topic (optional)" hint="What should the script be about?" style={{ marginTop: 16 }}>
                <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="e.g., morning routine, product review" style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(77,184,255,0.30)"}
                  onBlur={e => e.currentTarget.style.borderColor = C.border} />
                {/* ── Angle Field ── */}
                <div style={{ marginTop: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 600, color: "rgba(129,140,248,0.9)", letterSpacing: 0.3, marginBottom: 7 }}>
                    <span>🎯</span> YOUR ANGLE
                    <span style={{ fontSize: 14, fontWeight: 400, color: "#a6c0d8", marginLeft: 4 }}>,  the counterintuitive truth that drives the script (optional but it sharpens the script)</span>
                  </label>
                  <textarea
                    value={angle}
                    onChange={e => setAngle(e.target.value)}
                    placeholder="e.g. It's not the caffeine, it's the cortisol timing. Most people drink coffee during the worst 90-minute window of their day and it silently wrecks their focus."
                    rows={3}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 12,
                      background: "#0a1220", color: "#e8edf5", fontSize: 13,
                      border: "1px solid rgba(77,184,255,0.13)", outline: "none",
                      resize: "vertical", lineHeight: 1.6, fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(77,184,255,0.40)"}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(77,184,255,0.13)"}
                  />
                  {angle && (
                    <p style={{ fontSize: 11, color: "#34d399", marginTop: 5 }}>
                      ✓ Angle locked, our AI will build the entire script around this perspective
                    </p>
                  )}
                </div>
              </InputGroup>
            </>)}
            {/* ─── Source Confidence Badge ─── */}
            {transcriptWordCount !== null && transcriptSource !== null && (
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 8, background: transcriptSource === "paste" ? "rgba(52,211,153,0.08)" : "rgba(251,191,36,0.08)", border: `1px solid ${transcriptSource === "paste" ? "rgba(52,211,153,0.25)" : "rgba(251,191,36,0.25)"}` }}>
                <span style={{ fontSize: 13 }}>{transcriptSource === "paste" ? "✓" : "⚡"}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: transcriptSource === "paste" ? "#34d399" : "#fbbf24" }}>
                  {transcriptSource === "paste" ? "Manual transcript" : "Auto-extracted"}
                </span>
                <span style={{ fontSize: 11, color: C.textDim }}>·</span>
                <span style={{ fontSize: 11, color: C.textDim }}>{transcriptWordCount.toLocaleString()} words</span>
                {transcriptSource === "auto" && transcriptWordCount < 200 && (
                  <span style={{ fontSize: 10, color: "#f87171", marginLeft: 4 }}>⚠ Short, consider pasting manually</span>
                )}
              </div>
            )}

            {/* ─── Voice picker (pre-gen) ─── */}
            <div style={{ marginTop: 16 }}>
              <VoiceSelect value={voiceId} onChange={setVoiceId} />
              <CompanionCtaToggle value={companionCta} onChange={setCompanionCta} />
              <SoftCtaToggle value={softCta} onChange={setSoftCta} />
            </div>

            {/* ─── Viral Magnet Picker (pre-gen) ─── */}

            {magnetWords.length > 0 && (
              <div style={{ marginTop: 16, marginBottom: 16, borderRadius: 14, border: "1px solid rgba(77,184,255,0.16)", background: "rgba(77,184,255,0.04)", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 14 }}>🧲</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.textBright }}>Viral Magnet</span>
                  <span style={{ fontSize: 13, color: C.textDim }}>Pick a word to bake into the title</span>
                  {selectedViralWord && (
                    <button onClick={() => setSelectedViralWord(null)} style={{ marginLeft: "auto", fontSize: 10, color: C.textDim, background: "none", border: "none", cursor: "pointer" }}>
                      Clear
                    </button>
                  )}
                  {userPlan === "free" && (
                    <span style={{ marginLeft: selectedViralWord ? 4 : "auto", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "rgba(77,184,255,0.11)", color: C.badgeText }}>STARTER+</span>
                  )}
                </div>
                {/* Grade filter tabs */}
                <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                  {["all", "S", "A", "B", "C"].map(g => {
                    const gColors: Record<string, string> = { all: "#4db8ff", S: "#f59e0b", A: "#4db8ff", B: "#34d399", C: "#a6c0d8" };
                    const isActive = magnetGradeFilterScript === g;
                    const gc = gColors[g] || "#4db8ff";
                    return (
                      <button key={g} onClick={() => setMagnetGradeFilterScript(g)} style={{
                        padding: "5px 12px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer",
                        border: isActive ? `1.5px solid ${gc}` : "1px solid rgba(77,184,255,0.14)",
                        background: isActive ? `${gc}18` : "transparent",
                        color: isActive ? gc : C.textDim, transition: "all 0.1s",
                      }}>
                        {g === "all" ? "All" : `${g}-tier`}
                      </button>
                    );
                  })}
                  <span style={{ marginLeft: "auto", fontSize: 10, color: C.textDim, alignSelf: "center" }}>
                    {magnetWords.filter(w => magnetGradeFilterScript === "all" || w.grade === magnetGradeFilterScript).length} words
                  </span>
                </div>
                {/* Word grid, scrollable, gated for free users */}
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, maxHeight: 180, overflowY: "auto", filter: userPlan === "free" ? "blur(3px)" : "none", pointerEvents: userPlan === "free" ? "none" : "auto", userSelect: userPlan === "free" ? "none" : "auto" }}>
                    {magnetWords
                      .filter(mw => magnetGradeFilterScript === "all" || mw.grade === magnetGradeFilterScript)
                      .map(mw => {
                        const gc = mw.grade === "S" ? "#f59e0b" : mw.grade === "A" ? "#4db8ff" : mw.grade === "B" ? "#34d399" : "#a6c0d8";
                        const isSelected = selectedViralWord === mw.word;
                        return (
                          <button key={mw.id} onClick={() => setSelectedViralWord(isSelected ? null : mw.word)} title={mw.why_it_works} style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "4px 9px", borderRadius: 6, cursor: "pointer",
                            border: isSelected ? `1.5px solid ${gc}` : "1px solid rgba(77,184,255,0.12)",
                            background: isSelected ? `${gc}18` : "rgba(0,0,0,0.08)",
                            transition: "all 0.12s",
                          }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: isSelected ? gc : C.textBright }}>{mw.word}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 5px", borderRadius: 4, background: `${gc}22`, color: gc }}>{mw.grade}</span>
                          </button>
                        );
                      })}
                  </div>
                  {userPlan === "free" && (() => {
                    // Sell at the wall: preview the 3 highest-graded words clearly so
                    // the lock creates desire instead of just blocking.
                    const rank: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };
                    const top = [...magnetWords].sort((a, b) => (rank[a.grade] ?? 9) - (rank[b.grade] ?? 9)).slice(0, 3);
                    return (
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 8, background: "rgba(8,12,18,0.80)", backdropFilter: "blur(1px)", padding: "0 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: C.badgeText, textTransform: "uppercase" }}>🧲 Top words in your niche right now</span>
                        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "center" }}>
                          {top.map(mw => {
                            const gc = mw.grade === "S" ? "#f59e0b" : mw.grade === "A" ? "#4db8ff" : mw.grade === "B" ? "#34d399" : "#a6c0d8";
                            return (
                              <span key={mw.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: `1px solid ${gc}55`, background: `${gc}14` }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: C.textBright }}>{mw.word}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: `${gc}22`, color: gc }}>{mw.grade}</span>
                              </span>
                            );
                          })}
                        </div>
                        <span style={{ fontSize: 11, color: C.textBright, maxWidth: 340, lineHeight: 1.45 }}>
                          Bake one into your title and our AI weaves it through your hook to lift click-through.
                        </span>
                        <a href="/pricing" style={{ marginTop: 2, fontSize: 11, fontWeight: 700, padding: "6px 16px", borderRadius: 7, background: "linear-gradient(135deg,#0e6499,#4db8ff)", color: "#fff", textDecoration: "none" }}>Get Starter →</a>
                      </div>
                    );
                  })()}
                </div>
                {selectedViralWord && (
                  <div style={{ marginTop: 8, fontSize: 11, color: C.textDim, padding: "5px 9px", borderRadius: 6, background: "rgba(77,184,255,0.05)" }}>
                    🧲 <span style={{ color: C.textBright, fontWeight: 600 }}>"{selectedViralWord}"</span> will be woven into your title and hook by our AI
                  </div>
                )}
              </div>
            )}

            {/* Video length slider, all modes */}
            <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 12, background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.11)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#a6c0d8", letterSpacing: 0.5 }}>VIDEO LENGTH</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#7ed8ff" }}>~{videoMinutes}:{String(extraSeconds).padStart(2, "0")} on YouTube</span>
              </div>
              <input
                type="range" min={10} max={20} step={1}
                value={videoMinutes}
                onChange={e => { setVideoMinutes(Number(e.target.value)); setExtraSeconds(20 + Math.floor(Math.random() * 30)); }}
                style={{ width: "100%", accentColor: "#1a8fd1", cursor: "pointer", height: 4 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#a6c0d8", marginTop: 6 }}>
                <span>10 min</span><span>12 min</span><span>15 min</span><span>18 min</span><span>20 min</span>
              </div>
            </div>

            {/* Hook type picker, topic mode */}
            {inputMode === "topic" && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#a6c0d8", letterSpacing: 0.5, marginBottom: 10 }}>
                  HOOK TYPE <span style={{ fontWeight: 400, color: "#a6c0d8" }}>,  optional, pick a psychological approach</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { type: "CONTROVERSY", label: "Controversy", emoji: "⚡" },
                    { type: "CURIOSITY GAP", label: "Curiosity Gap", emoji: "🧠" },
                    { type: "REFRAME", label: "Reframe", emoji: "🪞" },
                    { type: "MYTH-BUST", label: "Myth-Bust", emoji: "💥" },
                    { type: "STORY", label: "Story", emoji: "🎬" },
                    { type: "PATTERN INTERRUPT", label: "Pattern Interrupt", emoji: "🔄" },
                    { type: "FEAR/STAKES", label: "Fear / Stakes", emoji: "🔥" },
                    { type: "OVERLOOKED MECHANISM", label: "Overlooked Mechanism", emoji: "🔑" },
                  ].map(({ type, label, emoji }) => {
                    const active = selectedHookType === type;
                    return (
                      <button key={type}
                        onClick={() => setSelectedHookType(active ? null : type)}
                        style={{
                          padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          border: active ? "1.5px solid rgba(77,184,255,0.50)" : "1px solid rgba(99,102,241,0.2)",
                          background: active ? "rgba(77,184,255,0.13)" : "rgba(77,184,255,0.04)",
                          color: active ? "#7ed8ff" : "#a6c0d8",
                          transition: "all 0.15s",
                        }}>
                        {emoji} {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Keep the typed topic as the title. When the topic already IS the
                title the creator wants, the hook cards should vary the hook, not
                invent competing titles. */}
            {inputMode === "topic" && topic.trim() && (
              <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12, cursor: "pointer", fontSize: 13, color: C.textDim }}>
                <input type="checkbox" checked={lockTitle} onChange={(e) => setLockTitle(e.target.checked)} style={{ width: 15, height: 15, accentColor: "#4db8ff", cursor: "pointer" }} />
                <span>Use my topic as the title. The hook angles will keep <span style={{ color: C.textBright }}>&#8220;{topic.trim()}&#8221;</span> and vary only the hook.</span>
              </label>
            )}

            {/* Guided brief, topic only */}
            {inputMode === "topic" && topic.trim() && (
              <button
                onClick={() => {
                  // Carry any case already grounded on this screen so script-brief
                  // does not re-resolve and ask "which real case" a second time.
                  const brief: any = { topic: topic.trim(), niche: niche.trim(), videoLength: videoMinutes >= 14 ? "long" : "medium", targetMinutes: videoMinutes, hookTypeFilter: selectedHookType || null, lockTitle, viralMagnetWord: selectedViralWord || null, voiceProfileId: voiceId || null, angles: [] };
                  if (grounding || groundedOn) {
                    brief.grounding = { ...(grounding || {}), ...(groundedOn ? { caseName: groundedOn.name, caseSummary: groundedOn.summary, when: groundedOn.when, sources: groundedOn.sources || [] } : {}) };
                    brief.topicKind = topicKind || undefined;
                    brief.sourceVerdict = sourceVerdict || undefined;
                  }
                  sessionStorage.setItem("skripr_script_brief", JSON.stringify(brief));
                  window.location.href = "/dashboard/scripts/script-brief";
                }}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px 24px", borderRadius: 14, background: grad, color: "#fff",
                  fontSize: 14, fontWeight: 700, border: "none", width: "100%", marginTop: 16,
                  cursor: "pointer", boxShadow: "0 4px 24px rgba(77,184,255,0.35)",
                }}>
                ✦ Find My Hook Angle →
              </button>
            )}

            {/* Direct generate, URL or paste modes */}
            {inputMode !== "topic" && (
              <button onClick={handleExtractOrProceed} disabled={!canProceed || extracting}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px 24px", borderRadius: 14, background: grad, color: "#fff",
                  fontSize: 14, fontWeight: 600, border: "none", width: "100%", marginTop: 20,
                  cursor: !canProceed || extracting ? "not-allowed" : "pointer",
                  opacity: !canProceed || extracting ? 0.5 : 1,
                  boxShadow: "0 0 22px rgba(77,184,255,0.26)",
                }}>
                {extracting ? "Extracting transcript..." : "Extract & Generate Script"}
              </button>
            )}
          </div>
        )}

        {/* ─── RESEARCH STEP ─── */}
        {step === "research" && (
          <ResearchStep
            topic={topic || lastUsedTranscript.slice(0, 120)}
            niche={niche}
            angle={angle}
            angleLabel={angle || undefined}
            onContinue={(sm, v, k) => { setSourceMaterial(sm || ""); setSourceVerdict(v || null); setTopicKind(k || null); setStep("storytelling"); }}
            onBack={() => setStep("input")}
          />
        )}

        {/* ─── STORYTELLING STEP ─── */}
        {step === "storytelling" && (
          <StorytellingPicker
            topic={topic || lastUsedTranscript.slice(0, 120)}
            niche={niche}
            angle={angle}
            angleLabel={angle || undefined}
            sourceTranscript={inputMode !== "topic" ? pendingTranscript : undefined}
            onGenerate={(mode, techniques) => doGenerate(pendingTranscript, mode, techniques, sourceMaterial)}
            onBack={() => setStep("research")}
          />
        )}

        {/* ─── GENERATING ─── */}
        {step === "generating" && (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: 52, marginBottom: 18, filter: "drop-shadow(0 0 20px rgba(77,184,255,0.40))" }}>✦</div>
            <p style={{ color: C.textBright, fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Generating your script…</p>
            <p style={{ color: C.textDim, fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>Analyzing structure and crafting viral content</p>
            <GenerationProgress fullScreen={false} expectedMs={45000 + videoMinutes * 5000} />
          </div>
        )}

        {/* ─── RESULT ─── */}
        {step === "result" && generatedScript && (
          <div>
            <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {generatedScript.niche && <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: C.badgeBg, color: C.badgeText, textTransform: "uppercase" }}>{generatedScript.niche}</span>}
                {generatedScript.structurePattern && <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(77,184,255,0.09)", color: "#7ed8ff" }}>{generatedScript.structurePattern}</span>}
                <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(77,184,255,0.07)", color: C.textDim }}>{(generatedScript.wordCount || 0).toLocaleString()} words</span>
                <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(77,184,255,0.07)", color: C.textDim }}>~{Math.round((generatedScript.estimatedDuration || 0) / 60) || 1} min</span>
              </div>
              <h2 style={{ fontSize: 21, fontWeight: 700, color: C.textBright, letterSpacing: -0.3, marginBottom: 16 }}>{generatedScript.title}</h2>
              <div style={{ marginBottom: 16 }}>
                <button onClick={runVerifyScript} disabled={verifyingScript}
                  style={{ padding: "8px 16px", borderRadius: 9, background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.35)", color: "#34d399", fontSize: 12, fontWeight: 600, cursor: verifyingScript ? "wait" : "pointer" }}>
                  {verifyingScript ? "Verifying against sources..." : (generatedScript as any).factVerify?.ran ? "Re-verify facts" : "Verify facts against sources"}
                </button>
              </div>
              {(generatedScript as any).factVerify?.ran && (
                <div style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.28)", borderRadius: 12, padding: "13px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#34d399", letterSpacing: 0.4, marginBottom: 7 }}>FACT-CHECKED AGAINST SOURCES</div>
                  {Array.isArray((generatedScript as any).factVerify.changes) && (generatedScript as any).factVerify.changes.length > 0 && (
                    <div style={{ marginBottom: (generatedScript as any).factVerify.stillVerify?.length ? 12 : 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.textBright, marginBottom: 4 }}>Corrected in the script:</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {(generatedScript as any).factVerify.changes.map((c: string, i: number) => (<li key={i} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>{c}</li>))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray((generatedScript as any).factVerify.stillVerify) && (generatedScript as any).factVerify.stillVerify.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#fbbf24", marginBottom: 4 }}>Could not confirm, check these yourself:</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {(generatedScript as any).factVerify.stillVerify.map((c: string, i: number) => (<li key={i} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>{c}</li>))}
                      </ul>
                    </div>
                  )}
                  {(!(generatedScript as any).factVerify.changes?.length && !(generatedScript as any).factVerify.stillVerify?.length) && (
                    <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>Every checkable claim confirmed against a source. Nothing to fix.</div>
                  )}
                </div>
              )}
                            {Array.isArray((generatedScript as any).reviewChanges) && (generatedScript as any).reviewChanges.length > 0 && (
                <div style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 12, padding: "13px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#34d399", letterSpacing: 0.4, marginBottom: 7 }}>AUTO-CORRECTED FOR ACCURACY</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                    {(generatedScript as any).reviewChanges.map((c: string, i: number) => (
                      <li key={i} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
                            {Array.isArray((generatedScript as any).factCheck?.unverified) && (generatedScript as any).factCheck.unverified.length > 0 && (
                <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 12, padding: "13px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", letterSpacing: 0.4, marginBottom: 5 }}>VERIFY BEFORE PUBLISHING</div>
                  <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.6, marginBottom: 9 }}>
                    These dates or figures are in the script but were not in the sourced research, so they may be the model&apos;s own recall. Check each before you record.
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {(generatedScript as any).factCheck.unverified.map((u: string, i: number) => (
                      <span key={i} style={{ fontSize: 12, fontWeight: 600, color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 7, padding: "4px 10px" }}>{u}</span>
                    ))}
                  </div>
                </div>
              )}
              {generatedScript.hook && (
                <div style={{ borderRadius: 14, padding: "14px 16px", marginBottom: 16, background: "rgba(77,184,255,0.07)", border: "1px solid rgba(77,184,255,0.14)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: 0.5, margin: 0 }}>HOOK</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, color: hookRewriteCount >= 3 ? "#f87171" : C.textDim, fontWeight: 500 }}>
                        {3 - hookRewriteCount} rewrite{3 - hookRewriteCount !== 1 ? "s" : ""} left
                      </span>
                      <button
                        onClick={async () => {
                          if (hookRewriteCount >= 3 || rewritingHook) return;
                          setRewritingHook(true);
                          try {
                            const res = await fetch("/api/rewrite-hook", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ hook: generatedScript.hook, topic, niche }),
                            });
                            const data = await res.json();
                            if (data.hook) {
                              setPendingHook(data.hook);
                              setHookRewriteCount(n => n + 1);
                            }
                          } catch {}
                          setRewritingHook(false);
                        }}
                        disabled={hookRewriteCount >= 3 || rewritingHook}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "4px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                          cursor: hookRewriteCount >= 3 ? "not-allowed" : rewritingHook ? "wait" : "pointer",
                          background: hookRewriteCount >= 3 ? "transparent" : "rgba(77,184,255,0.12)",
                          border: `1px solid ${hookRewriteCount >= 3 ? "rgba(77,184,255,0.09)" : "rgba(77,184,255,0.30)"}`,
                          color: hookRewriteCount >= 3 ? C.textDim : "#4db8ff",
                          opacity: hookRewriteCount >= 3 ? 0.45 : rewritingHook ? 0.7 : 1,
                          transition: "all 150ms",
                        }}
                      >
                        {rewritingHook ? "⟳ Rewriting…" : hookRewriteCount >= 3 ? "Limit reached" : "↺ Rewrite Hook"}
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: 14, color: C.textBright, lineHeight: 1.6, margin: 0 }}>{generatedScript.hook}</p>
                  {pendingHook && (
                    <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(77,184,255,0.09)", border: "1px solid rgba(77,184,255,0.24)" }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#7ed8ff", margin: "0 0 6px 0", letterSpacing: 0.4 }}>✨ NEW HOOK, confirm to apply:</p>
                      <p style={{ fontSize: 14, color: C.textBright, lineHeight: 1.6, margin: "0 0 12px 0" }}>{pendingHook}</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => {
                            setGeneratedScript(prev => {
                              if (!prev) return null;
                              const applyHook = (text: string | undefined) => {
                                if (!text) return text;
                                const firstBreak = text.indexOf("\n\n");
                                if (firstBreak > 0) return pendingHook + "\n\n" + text.slice(firstBreak + 2);
                                const singleBreak = text.indexOf("\n");
                                return singleBreak > 0 ? pendingHook + "\n" + text.slice(singleBreak + 1) : pendingHook;
                              };
                              return {
                                ...prev,
                                hook: pendingHook,
                                content: applyHook(prev.content) ?? prev.content,
                                fullScript: prev.fullScript ? applyHook(prev.fullScript) : prev.fullScript,
                              };
                            });
                            setPendingHook(null);
                          }}
                          style={{ padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#1a8fd1", color: "#fff", border: "none", cursor: "pointer" }}
                        >
                          ✓ Use this hook
                        </button>
                        <button
                          onClick={() => setPendingHook(null)}
                          style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "none", color: C.textDim, border: `1px solid ${C.border}`, cursor: "pointer" }}
                        >
                          ✗ Discard
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div style={{ borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                {(generatedScript.fullScript || generatedScript.content || "")
                  .split(/\n\n+/)
                  .map(b => b.trim()).filter(Boolean)
                  .map((block, idx, arr) => {
                    const isHdr = /^\[.+\]$/.test(block) || (/^[A-Z][A-Z\s\-:\/]{2,}$/.test(block) && block.length <= 40);
                    const text = block.replace(/^\[|\]$/g, "").trim();
                    return (
                      <div key={idx} style={{
                        padding: isHdr ? "10px 22px 8px" : "16px 22px",
                        borderBottom: idx < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                        background: isHdr ? "rgba(77,184,255,0.06)" : "transparent",
                      }}>
                        {isHdr
                          ? <span style={{ fontSize: 10, fontWeight: 700, color: "#4db8ff", letterSpacing: 1, textTransform: "uppercase" }}>{text}</span>
                          : <p style={{ fontSize: 14, color: C.textBright, lineHeight: 1.85, margin: 0 }}>{text}</p>
                        }
                      </div>
                    );
                  })
                }
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              {/* ─── Viral Magnet Section ─── */}
              {generatedScript.magnetSuggestions && generatedScript.magnetSuggestions.length > 0 && (
                <div style={{ marginBottom: 20, borderRadius: 14, border: "1px solid rgba(77,184,255,0.18)", background: "rgba(77,184,255,0.04)", padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 16 }}>🧲</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.textBright, letterSpacing: 0.2 }}>Viral Magnet</span>
                    <span style={{ fontSize: 11, color: C.textDim, marginLeft: 4 }}>Add one word to pull more clicks</span>
                    {userPlan === "free" && (
                      <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(77,184,255,0.13)", color: C.badgeText }}>STARTER+</span>
                    )}
                  </div>

                  {/* Word selector tabs */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    {generatedScript.magnetSuggestions.map((s, i) => {
                      const gradeColors: Record<string, string> = { S: "#f59e0b", A: "#4db8ff", B: "#34d399", C: "#a6c0d8" };
                      const isSelected = selectedMagnet === i;
                      return (
                        <button key={i} onClick={() => setSelectedMagnet(isSelected ? null : i)} style={{
                          padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                          border: isSelected ? `1.5px solid ${gradeColors[s.word.grade] || C.accent}` : `1px solid rgba(77,184,255,0.16)`,
                          background: isSelected ? "rgba(77,184,255,0.11)" : "transparent",
                          color: isSelected ? (gradeColors[s.word.grade] || C.accent) : C.textDim,
                          transition: "all 0.15s",
                        }}>
                          {s.word.word}
                          <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.8 }}>{s.word.grade}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Expanded card */}
                  {selectedMagnet !== null && generatedScript.magnetSuggestions[selectedMagnet] && (() => {
                    const s = generatedScript.magnetSuggestions![selectedMagnet];
                    const gradeColors: Record<string, string> = { S: "#f59e0b", A: "#4db8ff", B: "#34d399", C: "#a6c0d8" };
                    const gc = gradeColors[s.word.grade] || C.accent;
                    const isApplied = appliedMagnetTitle === s.injectedTitle;
                    const canApply = userPlan !== "free";
                    return (
                      <div style={{ borderRadius: 10, background: "rgba(0,0,0,0.18)", border: `1px solid rgba(77,184,255,0.12)`, padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 18, fontWeight: 800, color: gc }}>{s.word.word}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: `${gc}22`, color: gc }}>{s.word.grade}-tier</span>
                          <span style={{ fontSize: 11, color: C.textDim, marginLeft: 4 }}>{s.word.category}</span>
                          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#34d399" }}>{s.word.lift_range} lift</span>
                        </div>
                        <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: 12 }}>{s.word.why_it_works}</p>
                        <div style={{ borderRadius: 8, background: "rgba(77,184,255,0.05)", padding: "10px 12px", marginBottom: 12, fontSize: 12 }}>
                          <div style={{ color: C.textDim, marginBottom: 4 }}>
                            <span style={{ opacity: 0.6 }}>Before: </span>{generatedScript.title}
                          </div>
                          <div style={{ color: C.textBright, fontWeight: 600 }}>
                            <span style={{ color: gc }}>After: </span>{s.injectedTitle}
                          </div>
                        </div>
                        {canApply ? (
                          <button onClick={() => {
                            if (isApplied) { setAppliedMagnetTitle(null); }
                            else { setAppliedMagnetTitle(s.injectedTitle); }
                          }} style={{
                            width: "100%", padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
                            border: "none", transition: "all 0.15s",
                            background: isApplied ? "rgba(248,113,113,0.10)" : `linear-gradient(135deg,#0e6499,#1a8fd1,#4db8ff)`,
                            color: isApplied ? "#f87171" : "#fff",
                            boxShadow: isApplied ? "none" : "0 0 16px rgba(77,184,255,0.24)",
                          }}>
                            {isApplied ? "Remove Viral Magnet" : "Apply Viral Magnet"}
                          </button>
                        ) : (
                          <div style={{ width: "100%", padding: "9px", borderRadius: 9, fontSize: 12, fontWeight: 600, textAlign: "center", background: "rgba(77,184,255,0.05)", color: C.textDim, border: "1px solid rgba(77,184,255,0.11)" }}>
                            🔒 Upgrade to Starter for Viral Magnet
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Live title preview */}
                  {appliedMagnetTitle && (
                    <div style={{ marginTop: 12, borderRadius: 8, background: "rgba(77,184,255,0.07)", border: "1px solid rgba(77,184,255,0.18)", padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, color: C.textDim, marginRight: 6 }}>🧲 Viral Magnet title:</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>{appliedMagnetTitle}</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <button onClick={() => runGenerate(lastUsedTranscript)} style={{ width: "100%", padding: "12px 20px", borderRadius: 14, background: "rgba(77,184,255,0.07)", color: C.accent, fontSize: 14, fontWeight: 500, border: "1px solid rgba(77,184,255,0.16)", cursor: "pointer" }}>
                  ↻ Regenerate
                </button>
                <span style={{ fontSize: 11, color: "#a6c0d8", textAlign: "center" }}>Uses 1 credit</span>
              </div>
              <button onClick={saveScript} disabled={saving} style={{ flex: 2, padding: "12px 20px", borderRadius: 14, background: grad, color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1, boxShadow: "0 0 22px rgba(77,184,255,0.26)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {saving ? "Saving…" : savedId && !appliedMagnetTitle && hookRewriteCount === 0 ? "✓ Saved, View in My Scripts" : "✦ Save Script"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
