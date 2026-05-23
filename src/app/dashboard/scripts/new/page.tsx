"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const C = {
  bg: "#0b0b17", cardBg: "#12122a", border: "rgba(99,102,241,0.12)",
  accent: "#818cf8", text: "#e2e8f0", textDim: "#64748b",
  textBright: "#f1f5f9", danger: "#f87171", badgeBg: "rgba(99,102,241,0.12)", badgeText: "#a5b4fc",
};
const grad = "linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)";

type Step = "input" | "generating" | "result";
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
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>
        {label}{required && <span style={{ color: C.danger, marginLeft: 4 }}>*</span>}
      </label>
      {hint && <p style={{ color: C.textDim, fontSize: 12, marginBottom: 6, marginTop: -4 }}>{hint}</p>}
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 12,
  background: "#1a1a3a", color: C.text, fontSize: 14, fontWeight: 500,
  border: `1px solid ${C.border}`, outline: "none",
} as React.CSSProperties;

export default function NewScriptPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [pastedTranscript, setPastedTranscript] = useState("");
  const [niche, setNiche] = useState("");
  const [topic, setTopic] = useState("");
  const [videoLength, setVideoLength] = useState<"short" | "medium" | "long" | "ultraLong">("long");
  const [transcriptText, setTranscriptText] = useState("");
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [upgradeWall, setUpgradeWall] = useState(false);
  const [magnetWords, setMagnetWords] = useState<MagnetWordOption[]>([]);
  const [selectedViralWord, setSelectedViralWord] = useState<string | null>(null);
  const [magnetGradeFilterScript, setMagnetGradeFilterScript] = useState<string>("all");
  const [transcriptWordCount, setTranscriptWordCount] = useState<number | null>(null);
  const [transcriptSource, setTranscriptSource] = useState<"auto" | "paste" | null>(null);
  const [selectedMagnet, setSelectedMagnet] = useState<number | null>(null);
  const [appliedMagnetTitle, setAppliedMagnetTitle] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [nicheBendSource, setNicheBendSource] = useState<string | null>(null);
  const [angle, setAngle] = useState("");
  const [suggestingAngles, setSuggestingAngles] = useState(false);
  const [angleSuggestions, setAngleSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("topic");
    const n = params.get("niche");
    const adj = params.get("adjacent");
    if (t) { setTopic(t); setNicheBendSource(t); }
    if (n && adj) setNiche(`${n} × ${adj}`);
    else if (n) setNiche(n);
    // Auto-fire generation if coming from Niche Bend
    if (t) {
      setStep("generating");
      const topicVal = t;
      const nicheVal = (n && adj) ? `${n} × ${adj}` : (n || "");
      fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "", topic: topicVal, niche: nicheVal, videoLength: "medium", viralMagnetWord: selectedViralWord || undefined, angle: undefined }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.error) {
            if (data.limitReached) {
              setUpgradeWall(true);
            } else {
              setError(data.error);
            }
            setStep("input");
          } else { setGeneratedScript(data); setAppliedMagnetTitle(null); setSelectedMagnet(null); setStep("result"); }
        })
        .catch(e => { setError(e.message); setStep("input"); });
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

  async function runGenerate(transcript: string) {
    setStep("generating");
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, niche: niche || undefined, topic: topic || undefined, videoLength,
          sourceVideoId: youtubeUrl ? youtubeUrl.match(/[?&]v=([^&]+)/)?.[1] : undefined, viralMagnetWord: selectedViralWord || undefined, angle: angle || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate script");
      setGeneratedScript({
        title: data.title, content: data.fullScript || data.content, hook: data.hook,
        structurePattern: data.sections?.length ? `${data.sections.length}-section` : undefined,
        niche: data.niche || niche, wordCount: data.wordCount, estimatedDuration: data.estimatedDuration,
      });
      setStep("result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate script");
      setStep("input");
    }
  }

  async function saveScript() {
    if (!generatedScript) return;
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
      <div aria-hidden style={{ position: "fixed", top: -160, right: -100, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.14) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto" }}>
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
            <div style={{ marginBottom: 20, borderRadius: 16, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.20)", padding: "24px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>🚀</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.textBright }}>You've used all your free scripts</span>
              </div>
              <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, marginBottom: 18 }}>
                Free accounts include 2 scripts per month. Upgrade to Starter for 12 scripts, humanized titles, Viral Magnet, and Niche Bend access.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <a href="/dashboard/settings" style={{ flex: 1, display: "block", textAlign: "center", padding: "11px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none", boxShadow: "0 0 18px rgba(99,102,241,0.30)" }}>
                  Upgrade to Starter — $19/mo
                </a>
                <button onClick={() => setUpgradeWall(false)} style={{ padding: "11px 16px", borderRadius: 10, background: "transparent", border: "1px solid rgba(99,102,241,0.20)", color: C.textDim, fontSize: 13, cursor: "pointer" }}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
            {/* Tab switcher */}
            <div style={{ display: "flex", gap: 4, marginBottom: 22, background: "rgba(99,102,241,0.06)", borderRadius: 12, padding: 4 }}>
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
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"}
                    onBlur={e => e.currentTarget.style.borderColor = C.border} />
                </InputGroup>
                {/* How to get transcript tip */}
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.10)" }}>
                  <p style={{ color: C.textDim, fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                    💡 <strong style={{ color: C.accent }}>Tip:</strong> If auto-extraction fails, switch to "Paste Transcript" — on YouTube, click <strong style={{ color: C.textBright }}>⋯ → Show transcript</strong> and paste it here.
                  </p>
                </div>
              </div>
            ) : inputMode === "paste" ? (
              inputMode === "paste" ? (
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
            )}

            <InputGroup label="Niche (optional)" hint="e.g. fitness, tech, science" style={{ marginTop: 16 }}>
              <input type="text" value={niche} onChange={e => setNiche(e.target.value)}
                placeholder="e.g., fitness, tech, cooking" style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"}
                onBlur={e => e.currentTarget.style.borderColor = C.border} />
            </InputGroup>

            <InputGroup label={inputMode === "topic" ? "Topic *" : "Topic (optional)"} hint={inputMode === "topic" ? "Required — what should your script be about?" : "What should the script be about?"} style={{ marginTop: 16 }}>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="e.g., morning routine, product review" style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"}
                onBlur={e => e.currentTarget.style.borderColor = C.border} />
              {/* ── Angle Field ── */}
              <div style={{ marginTop: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "rgba(129,140,248,0.9)", letterSpacing: 0.3, marginBottom: 7 }}>
                  <span>🎯</span> YOUR ANGLE
                  <span style={{ fontSize: 11, fontWeight: 400, color: "#64748b", marginLeft: 4 }}>— the counterintuitive truth that drives the script (optional but powerful)</span>
                </label>
                <textarea
                  value={angle}
                  onChange={e => setAngle(e.target.value)}
                  placeholder="e.g. It's not the caffeine — it's the cortisol timing. Most people drink coffee during the worst 90-minute window of their day and it silently wrecks their focus."
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 12,
                    background: "#1a1a3a", color: "#e2e8f0", fontSize: 13,
                    border: "1px solid rgba(99,102,241,0.15)", outline: "none",
                    resize: "vertical", lineHeight: 1.6, fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.45)"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.15)"}
                />
                {angle && (
                  <p style={{ fontSize: 11, color: "#34d399", marginTop: 5 }}>
                    ✓ Angle locked — Claude will build the entire script around this perspective
                  </p>
                )}
              </div>

              {/* ── Suggest Angles button (topic mode only) ── */}
              {inputMode === "topic" && topic.trim().length > 3 && (
                <div style={{ marginTop: 14 }}>
                  <button
                    onClick={async () => {
                      setSuggestingAngles(true);
                      setAngleSuggestions([]);
                      try {
                        const res = await fetch("/api/suggest-angles", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ topic, niche }),
                        });
                        const data = await res.json();
                        if (data.angles) setAngleSuggestions(data.angles);
                      } catch {}
                      setSuggestingAngles(false);
                    }}
                    disabled={suggestingAngles}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "8px 16px", borderRadius: 10, cursor: suggestingAngles ? "wait" : "pointer",
                      background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.25)",
                      color: "#818cf8", fontSize: 13, fontWeight: 600,
                      opacity: suggestingAngles ? 0.6 : 1, transition: "opacity 150ms",
                    }}
                  >
                    <span>{suggestingAngles ? "⟳" : "✦"}</span>
                    {suggestingAngles ? "Suggesting angles…" : "Suggest Angles for me"}
                  </button>
                  {angleSuggestions.length > 0 && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <p style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Pick one — or edit it above:</p>
                      {angleSuggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setAngle(s)}
                          style={{
                            textAlign: "left", padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                            background: angle === s ? "rgba(99,102,241,0.14)" : "rgba(99,102,241,0.05)",
                            border: `1px solid ${angle === s ? "rgba(99,102,241,0.40)" : "rgba(99,102,241,0.15)"}`,
                            color: angle === s ? "#e2e8f0" : "#94a3b8",
                            fontSize: 13, lineHeight: 1.5, transition: "all 0.12s",
                          }}
                        >
                          {angle === s && <span style={{ color: "#34d399", marginRight: 6 }}>✓</span>}
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </InputGroup>

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
                  <span style={{ fontSize: 10, color: "#f87171", marginLeft: 4 }}>⚠ Short — consider pasting manually</span>
                )}
              </div>
            )}

            {/* ─── Viral Magnet Picker (pre-gen) ─── */}
            {magnetWords.length > 0 && (
              <div style={{ marginBottom: 16, borderRadius: 14, border: "1px solid rgba(99,102,241,0.18)", background: "rgba(99,102,241,0.04)", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 14 }}>🧲</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.textBright }}>Viral Magnet</span>
                  <span style={{ fontSize: 11, color: C.textDim }}>Pick a word to bake into the title</span>
                  {selectedViralWord && (
                    <button onClick={() => setSelectedViralWord(null)} style={{ marginLeft: "auto", fontSize: 10, color: C.textDim, background: "none", border: "none", cursor: "pointer" }}>
                      Clear
                    </button>
                  )}
                  {userPlan === "free" && (
                    <span style={{ marginLeft: selectedViralWord ? 4 : "auto", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "rgba(99,102,241,0.12)", color: C.badgeText }}>STARTER+</span>
                  )}
                </div>
                {/* Grade filter tabs */}
                <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                  {["all", "S", "A", "B", "C"].map(g => {
                    const gColors: Record<string, string> = { all: "#818cf8", S: "#f59e0b", A: "#818cf8", B: "#34d399", C: "#64748b" };
                    const isActive = magnetGradeFilterScript === g;
                    const gc = gColors[g] || "#818cf8";
                    return (
                      <button key={g} onClick={() => setMagnetGradeFilterScript(g)} style={{
                        padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: "pointer",
                        border: isActive ? `1.5px solid ${gc}` : "1px solid rgba(99,102,241,0.16)",
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
                {/* Word grid — scrollable, gated for free users */}
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 120, overflowY: "auto", filter: userPlan === "free" ? "blur(3px)" : "none", pointerEvents: userPlan === "free" ? "none" : "auto", userSelect: userPlan === "free" ? "none" : "auto" }}>
                    {magnetWords
                      .filter(mw => magnetGradeFilterScript === "all" || mw.grade === magnetGradeFilterScript)
                      .map(mw => {
                        const gc = mw.grade === "S" ? "#f59e0b" : mw.grade === "A" ? "#818cf8" : mw.grade === "B" ? "#34d399" : "#64748b";
                        const isSelected = selectedViralWord === mw.word;
                        return (
                          <button key={mw.id} onClick={() => setSelectedViralWord(isSelected ? null : mw.word)} title={mw.why_it_works} style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "4px 9px", borderRadius: 6, cursor: "pointer",
                            border: isSelected ? `1.5px solid ${gc}` : "1px solid rgba(99,102,241,0.14)",
                            background: isSelected ? `${gc}18` : "rgba(0,0,0,0.08)",
                            transition: "all 0.12s",
                          }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? gc : C.textBright }}>{mw.word}</span>
                            <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 3px", borderRadius: 3, background: `${gc}22`, color: gc }}>{mw.grade}</span>
                          </button>
                        );
                      })}
                  </div>
                  {userPlan === "free" && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 8, background: "rgba(10,10,20,0.60)", backdropFilter: "blur(1px)" }}>
                      <span style={{ fontSize: 14 }}>🔒</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.textBright }}>Starter+ feature</span>
                      <span style={{ fontSize: 10, color: C.textDim }}>Upgrade to use Viral Magnet</span>
                      <a href="/pricing" style={{ marginTop: 3, fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 6, background: "linear-gradient(135deg,#6366f1,#818cf8)", color: "#fff", textDecoration: "none" }}>Upgrade →</a>
                    </div>
                  )}
                </div>
                {selectedViralWord && (
                  <div style={{ marginTop: 8, fontSize: 11, color: C.textDim, padding: "5px 9px", borderRadius: 6, background: "rgba(99,102,241,0.06)" }}>
                    🧲 <span style={{ color: C.textBright, fontWeight: 600 }}>"{selectedViralWord}"</span> will be woven into the title by Claude
                  </div>
                )}
              </div>
            )}

            <button onClick={handleExtractOrProceed} disabled={!canProceed || extracting}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 24px", borderRadius: 14, background: grad, color: "#fff",
                fontSize: 14, fontWeight: 600, border: "none", width: "100%", marginTop: 20,
                cursor: !canProceed || extracting ? "not-allowed" : "pointer",
                opacity: !canProceed || extracting ? 0.5 : 1,
                boxShadow: "0 0 22px rgba(99,102,241,0.30)",
              }}>
              {extracting ? "Extracting transcript…" : inputMode === "url" ? "Extract & Generate Script" : "✦ Generate Script"}
            </button>
          </div>
        )}

        {/* ─── GENERATING ─── */}
        {step === "generating" && (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: 52, marginBottom: 18, filter: "drop-shadow(0 0 20px rgba(99,102,241,0.45))" }}>✦</div>
            <p style={{ color: C.textBright, fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Generating your script…</p>
            <p style={{ color: C.textDim, fontSize: 14, lineHeight: 1.6 }}>Analyzing structure and crafting viral content</p>
            <div style={{ maxWidth: 320, margin: "28px auto 0", height: 3, borderRadius: 2, background: C.border, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "60%", borderRadius: 2, background: grad }} />
            </div>
          </div>
        )}

        {/* ─── RESULT ─── */}
        {step === "result" && generatedScript && (
          <div>
            <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {generatedScript.niche && <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: C.badgeBg, color: C.badgeText, textTransform: "uppercase" }}>{generatedScript.niche}</span>}
                {generatedScript.structurePattern && <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.10)", color: "#a5b4fc" }}>{generatedScript.structurePattern}</span>}
                <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.08)", color: C.textDim }}>{(generatedScript.wordCount || 0).toLocaleString()} words</span>
                <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.08)", color: C.textDim }}>~{Math.round((generatedScript.estimatedDuration || 0) / 60) || 1} min</span>
              </div>
              <h2 style={{ fontSize: 21, fontWeight: 700, color: C.textBright, letterSpacing: -0.3, marginBottom: 16 }}>{generatedScript.title}</h2>
              {generatedScript.hook && (
                <div style={{ borderRadius: 14, padding: "14px 16px", marginBottom: 16, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.16)" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: 0.5, marginBottom: 5 }}>HOOK</p>
                  <p style={{ fontSize: 14, color: C.textBright, lineHeight: 1.6 }}>{generatedScript.hook}</p>
                </div>
              )}
              <div style={{ maxHeight: 440, overflowY: "auto", borderRadius: 14, border: `1px solid ${C.border}` }}>
                <div style={{ padding: 20 }}>
                  <p style={{ fontSize: 14, color: C.textBright, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{generatedScript.fullScript || generatedScript.content}</p>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              {/* ─── Viral Magnet Section ─── */}
              {generatedScript.magnetSuggestions && generatedScript.magnetSuggestions.length > 0 && (
                <div style={{ marginBottom: 20, borderRadius: 14, border: "1px solid rgba(99,102,241,0.20)", background: "rgba(99,102,241,0.04)", padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 16 }}>🧲</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.textBright, letterSpacing: 0.2 }}>Viral Magnet</span>
                    <span style={{ fontSize: 11, color: C.textDim, marginLeft: 4 }}>Add one word to pull more clicks</span>
                    {userPlan === "free" && (
                      <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(99,102,241,0.15)", color: C.badgeText }}>STARTER+</span>
                    )}
                  </div>

                  {/* Word selector tabs */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    {generatedScript.magnetSuggestions.map((s, i) => {
                      const gradeColors: Record<string, string> = { S: "#f59e0b", A: "#818cf8", B: "#34d399", C: "#64748b" };
                      const isSelected = selectedMagnet === i;
                      return (
                        <button key={i} onClick={() => setSelectedMagnet(isSelected ? null : i)} style={{
                          padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                          border: isSelected ? `1.5px solid ${gradeColors[s.word.grade] || C.accent}` : `1px solid rgba(99,102,241,0.18)`,
                          background: isSelected ? "rgba(99,102,241,0.12)" : "transparent",
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
                    const gradeColors: Record<string, string> = { S: "#f59e0b", A: "#818cf8", B: "#34d399", C: "#64748b" };
                    const gc = gradeColors[s.word.grade] || C.accent;
                    const isApplied = appliedMagnetTitle === s.injectedTitle;
                    const canApply = userPlan !== "free";
                    return (
                      <div style={{ borderRadius: 10, background: "rgba(0,0,0,0.18)", border: `1px solid rgba(99,102,241,0.14)`, padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 18, fontWeight: 800, color: gc }}>{s.word.word}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: `${gc}22`, color: gc }}>{s.word.grade}-tier</span>
                          <span style={{ fontSize: 11, color: C.textDim, marginLeft: 4 }}>{s.word.category}</span>
                          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#34d399" }}>{s.word.lift_range} lift</span>
                        </div>
                        <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: 12 }}>{s.word.why_it_works}</p>
                        <div style={{ borderRadius: 8, background: "rgba(99,102,241,0.06)", padding: "10px 12px", marginBottom: 12, fontSize: 12 }}>
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
                            background: isApplied ? "rgba(248,113,113,0.10)" : `linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)`,
                            color: isApplied ? "#f87171" : "#fff",
                            boxShadow: isApplied ? "none" : "0 0 16px rgba(99,102,241,0.28)",
                          }}>
                            {isApplied ? "Remove Viral Magnet" : "Apply Viral Magnet"}
                          </button>
                        ) : (
                          <div style={{ width: "100%", padding: "9px", borderRadius: 9, fontSize: 12, fontWeight: 600, textAlign: "center", background: "rgba(99,102,241,0.06)", color: C.textDim, border: "1px solid rgba(99,102,241,0.12)" }}>
                            🔒 Upgrade to Starter to unlock Viral Magnet
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Live title preview */}
                  {appliedMagnetTitle && (
                    <div style={{ marginTop: 12, borderRadius: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.20)", padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, color: C.textDim, marginRight: 6 }}>🧲 Viral Magnet title:</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>{appliedMagnetTitle}</span>
                    </div>
                  )}
                </div>
              )}

              <button onClick={() => setStep("input")} style={{ flex: 1, padding: "12px 20px", borderRadius: 14, background: "rgba(99,102,241,0.08)", color: C.accent, fontSize: 14, fontWeight: 500, border: "1px solid rgba(99,102,241,0.18)", cursor: "pointer" }}>
                ← Regenerate
              </button>
              <button onClick={saveScript} disabled={saving} style={{ flex: 2, padding: "12px 20px", borderRadius: 14, background: grad, color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1, boxShadow: "0 0 22px rgba(99,102,241,0.30)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {saving ? "Saving…" : "✦ Save Script"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
