"use client";
import { useState, useEffect } from "react";

const C = {
  bg: "#080c12",
  card: "#0d1520",
  border: "rgba(77,184,255,0.12)",
  accent: "#1a8fd1",
  accentDim: "#4db8ff",
  textBright: "#e8edf5",
  textDim: "#7a9bb5",
  green: "#34d399",
};

interface Analysis {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  hookAnalysis: { hook: string; hookType: string; whyItWorks: string };
  structure: { timestamp: string; section: string; description: string; purpose: string }[];
  retentionTriggers: { trigger: string; example: string; timestamp: string }[];
  titleFormula: { formula: string; psychology: string; remixExamples?: string[]; remixTitles?: RemixTitle[] };
  remixFramework: string;
}

type RemixTitle = { title: string; description?: string; audience?: string; scope?: string };

// Normalize old (string[]) and new (rich object) shapes so cached results keep working
function getRemixOptions(tf: Analysis["titleFormula"]): RemixTitle[] {
  if (tf.remixTitles?.length) return tf.remixTitles;
  return (tf.remixExamples ?? []).map((t) => ({ title: t }));
}

export default function ViralRemixerPage() {
  const [url, setUrl] = useState("");
  const [selectedRemix, setSelectedRemix] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [videoMinutes, setVideoMinutes] = useState<number>(15);
  const [extraSeconds, setExtraSeconds] = useState<number>(26);

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);

  // ── Persist state across navigation ───────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("skripr_vr_state");
      if (!saved) return;
      const s = JSON.parse(saved);
      if (s.url) setUrl(s.url);
      if (s.result) setResult(s.result);
      if (s.selectedRemix !== undefined) setSelectedRemix(s.selectedRemix);
      if (s.videoMinutes) setVideoMinutes(s.videoMinutes);
      if (s.extraSeconds) setExtraSeconds(s.extraSeconds);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("skripr_vr_state", JSON.stringify({
        url, result, selectedRemix, videoMinutes, extraSeconds,
      }));
    } catch {}
  }, [url, result, selectedRemix, videoMinutes, extraSeconds]);

  async function handleAnalyze() {
    if (!url.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/viral-remixer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleUseFramework() {
    if (!result) return;
    const brief = {
      hookAnalysis: result.hookAnalysis,
      structure: result.structure,
      retentionTriggers: result.retentionTriggers,
      titleFormula: result.titleFormula,
      remixFramework: result.remixFramework,
      selectedTitle: getRemixOptions(result.titleFormula)[selectedRemix]?.title ?? "",
      selectedTitleDescription: getRemixOptions(result.titleFormula)[selectedRemix]?.description ?? "",
      selectedTitleAudience: getRemixOptions(result.titleFormula)[selectedRemix]?.audience ?? "",
      videoTitle: result.title,
      channelTitle: result.channelTitle,
      targetMinutes: videoMinutes,
    };
    sessionStorage.setItem("skripr_viral_brief", JSON.stringify(brief));
    window.location.href = "/dashboard/scripts/viral-brief";
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>🔥</span>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, letterSpacing: -0.3, textAlign: "center" as const }}>Viral Remixer</h1>
        </div>
        <p style={{ fontSize: 16, color: C.textDim, maxWidth: 520, lineHeight: 1.6, textAlign: "center" as const, margin: "0 auto 24px" }}>
          Paste any YouTube URL. Get the hook type, content structure, and retention triggers that made it go viral — then script it for your own niche.
        </p>
      </div>

      {/* Input */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", marginBottom: 24, maxWidth: 680, margin: "0 auto 24px" }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.25)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "0 14px", height: 42 }}>
            <svg width="18" height="13" viewBox="0 0 18 13" fill="none"><rect width="18" height="13" rx="3" fill="#FF0000"/><path d="M7 9.5V3.5L13 6.5L7 9.5Z" fill="white"/></svg>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAnalyze()}
              placeholder="https://youtube.com/watch?v=..."
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, color: C.textBright }}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !url.trim()}
            style={{
              height: 42, padding: "0 20px", background: loading ? "rgba(77,184,255,0.35)" : C.accent, color: "#fff",
              border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer",
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            }}
          >
            {loading ? "⟳ Analyzing…" : "↗ Analyze video"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", borderRadius: 12, padding: "12px 16px", color: "#f87171", fontSize: 15, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.textDim, fontSize: 16 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔍</div>
          Fetching transcript and analyzing framework...
        </div>
      )}

      {result && (
        <>
          {/* Video strip */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
            <img src={result.thumbnail} alt="" style={{ width: 100, height: 56, borderRadius: 8, objectFit: "cover", background: "#0a1220" }} onError={e => (e.currentTarget.style.display = "none")} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.textBright, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.title}</div>
              <div style={{ fontSize: 14, color: C.textDim }}>
                {result.channelTitle}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(52,211,153,0.08)", color: C.green, fontSize: 13, padding: "1px 8px", borderRadius: 8, border: `1px solid rgba(52,211,153,0.18)`, marginLeft: 8 }}>
                  ✓ Transcript loaded
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>

            {/* Hook */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 10 }}>🎣 HOOK ANALYSIS</div>
              <div style={{ display: "inline-flex", background: "rgba(77,184,255,0.09)", color: C.accentDim, fontSize: 13, padding: "2px 10px", borderRadius: 8, border: `1px solid rgba(77,184,255,0.20)`, marginBottom: 10, fontWeight: 600 }}>
                {result.hookAnalysis.hookType} hook
              </div>
              <div style={{ fontSize: 15, color: C.textBright, fontStyle: "italic", lineHeight: 1.6, marginBottom: 10, borderLeft: `2px solid ${C.accent}`, paddingLeft: 10 }}>
                "{result.hookAnalysis.hook}"
              </div>
              <div style={{ fontSize: 14, color: C.textDim, lineHeight: 1.65 }}>{result.hookAnalysis.whyItWorks}</div>
            </div>

            {/* Structure */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 12 }}>📐 CONTENT STRUCTURE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.structure.slice(0, 5).map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 36, fontSize: 10, color: C.accentDim, fontWeight: 600, flexShrink: 0, paddingTop: 1 }}>{s.timestamp}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.textBright }}>{s.section}</div>
                      <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.5 }}>{s.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Retention */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 12 }}>🔒 RETENTION TRIGGERS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.retentionTriggers.map((t, i) => (
                  <div key={i} style={{ background: "rgba(0,0,0,0.20)", borderRadius: 8, padding: "9px 12px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.textBright, marginBottom: 3 }}>{t.trigger} <span style={{ color: C.accentDim, fontWeight: 400, fontSize: 13 }}>at {t.timestamp}</span></div>
                    <div style={{ fontSize: 13, color: C.textDim, fontStyle: "italic", lineHeight: 1.5 }}>"{t.example}"</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Title formula */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 12 }}>📋 TITLE FORMULA</div>
              <div style={{ background: "rgba(77,184,255,0.07)", border: `1px solid rgba(77,184,255,0.16)`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 14, color: C.accentDim, fontFamily: "monospace", fontWeight: 600, lineHeight: 1.6 }}>{result.titleFormula.formula}</div>
              </div>
              <div style={{ fontSize: 14, color: C.textDim, lineHeight: 1.6, marginBottom: 8 }}>{result.titleFormula.psychology}</div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 8 }}>PICK YOUR REMIX TITLE</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {getRemixOptions(result.titleFormula).map((opt, i, all) => {
                    const wideStart = all.findIndex(o => o.scope === "wide");
                    const groupLabel = i === 0 && all.some(o => o.scope)
                      ? "SAME LANE — adjacent to this video's topic"
                      : i === wideStart && wideStart > 0
                        ? "NEW NICHE — same formula, different worlds"
                        : null;
                    return (
                      <div key={i}>
                        {groupLabel && (
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: 0.6, margin: i === 0 ? "0 0 6px" : "12px 0 6px" }}>{groupLabel}</div>
                        )}
                        {/* Compact row; only the selected title expands to show its detail */}
                        <div
                          onClick={() => setSelectedRemix(i)}
                          style={{
                            padding: selectedRemix === i ? "10px 12px" : "7px 12px", borderRadius: 8, cursor: "pointer",
                            border: `1px solid ${selectedRemix === i ? "rgba(77,184,255,0.50)" : C.border}`,
                            background: selectedRemix === i ? "rgba(77,184,255,0.12)" : "rgba(255,255,255,0.03)",
                            transition: "all 0.15s",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: selectedRemix === i ? "#7ed8ff" : C.textDim, flexShrink: 0 }}>{i + 1}</span>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: selectedRemix === i ? "#e8edf5" : C.textDim, lineHeight: 1.4, whiteSpace: selectedRemix === i ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opt.title}</div>
                            <span style={{ marginLeft: "auto", fontSize: 10, color: C.textDim, flexShrink: 0, transform: selectedRemix === i ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</span>
                          </div>
                          {selectedRemix === i && (opt.description || opt.audience) && (
                            <div style={{ marginTop: 8, paddingLeft: 18, borderLeft: "2px solid rgba(77,184,255,0.25)", marginLeft: 3 }}>
                              {opt.description && (
                                <div style={{ fontSize: 12, color: "#b9cfe0", lineHeight: 1.55 }}>{opt.description}</div>
                              )}
                              {opt.audience && (
                                <div style={{ fontSize: 11, color: "#7ed8ff", lineHeight: 1.55, marginTop: 5 }}>
                                  <span style={{ fontWeight: 700, letterSpacing: 0.4 }}>AUDIENCE:</span> {opt.audience}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Video length */}
          <div style={{ marginBottom: 20, padding: "18px 20px", borderRadius: 14, background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.11)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#8aa4bf", letterSpacing: 0.5, textTransform: "uppercase" }}>Video Length</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#7ed8ff" }}>~{videoMinutes}:{String(extraSeconds).padStart(2, "0")} on YouTube</span>
            </div>
            <input
              type="range" min={10} max={20} step={1}
              value={videoMinutes}
              onChange={e => { setVideoMinutes(Number(e.target.value)); setExtraSeconds(20 + Math.floor(Math.random() * 30)); }}
              style={{ width: "100%", accentColor: "#1a8fd1", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#7a9bb5", marginTop: 8 }}>
              <span>10 min</span><span>12 min</span><span>15 min</span><span>18 min</span><span>20 min</span>
            </div>
          </div>

          {/* Framework summary + CTA */}
          <div style={{ background: "rgba(77,184,255,0.05)", border: `1px solid rgba(77,184,255,0.18)`, borderRadius: 14, padding: "20px 22px" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.textBright, marginBottom: 6 }}>Script this framework for your niche</div>
            <div style={{ fontSize: 14, color: C.textDim, lineHeight: 1.6, marginBottom: 18 }}>{result.remixFramework}</div>
            <button
              onClick={handleUseFramework}
              style={{
                width: "100%", height: 50,
                background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)",
                color: "#fff", border: "none", borderRadius: 12,
                fontSize: 16, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                letterSpacing: 0.2,
                boxShadow: "0 4px 24px rgba(77,184,255,0.35), 0 1px 0 rgba(255,255,255,0.12) inset",
              }}
            >
              <span style={{ fontSize: 17 }}>✦</span>
              Choose Your Angle &amp; Build Script
              <span style={{ fontSize: 16, opacity: 0.8 }}>→</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
