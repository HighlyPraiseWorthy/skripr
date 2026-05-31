"use client";
import { useState } from "react";

const C = {
  bg: "#0d0d1f",
  card: "#12122a",
  border: "rgba(99,102,241,0.13)",
  accent: "#6366f1",
  accentDim: "#818cf8",
  textBright: "#f1f5f9",
  textDim: "#64748b",
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
  titleFormula: { formula: string; psychology: string; remixExamples: string[] };
  remixFramework: string;
}

export default function ViralRemixerPage() {
  const [url, setUrl] = useState("");
  const [selectedRemix, setSelectedRemix] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);

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
    const params = new URLSearchParams({
      remixFramework: result.remixFramework,
      hookType: result.hookAnalysis.hookType,
      titleFormula: result.titleFormula.formula,
      selectedTitle: result.titleFormula.remixExamples?.[selectedRemix] ?? "",
    });
    window.location.href = `/dashboard/scripts/new?${params.toString()}`;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>🔥</span>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, letterSpacing: -0.3 }}>Viral Remixer</h1>
          <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(52,211,153,0.10)", color: C.green, border: `1px solid rgba(52,211,153,0.20)`, padding: "2px 8px", borderRadius: 6 }}>FREE</span>
        </div>
        <p style={{ fontSize: 14, color: C.textDim, maxWidth: 520, lineHeight: 1.6 }}>
          Paste any YouTube URL. Get the hook type, content structure, and retention triggers that made it go viral — then script it for your own niche.
        </p>
      </div>

      {/* Input */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.25)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "0 14px", height: 42 }}>
            <svg width="18" height="13" viewBox="0 0 18 13" fill="none"><rect width="18" height="13" rx="3" fill="#FF0000"/><path d="M7 9.5V3.5L13 6.5L7 9.5Z" fill="white"/></svg>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAnalyze()}
              placeholder="https://youtube.com/watch?v=..."
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: C.textBright }}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !url.trim()}
            style={{
              height: 42, padding: "0 20px", background: loading ? "rgba(99,102,241,0.4)" : C.accent, color: "#fff",
              border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer",
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            }}
          >
            {loading ? "⟳ Analyzing…" : "↗ Analyze video"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", borderRadius: 12, padding: "12px 16px", color: "#f87171", fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.textDim, fontSize: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔍</div>
          Fetching transcript and analyzing framework...
        </div>
      )}

      {result && (
        <>
          {/* Video strip */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
            <img src={result.thumbnail} alt="" style={{ width: 100, height: 56, borderRadius: 8, objectFit: "cover", background: "#1a1a3a" }} onError={e => (e.currentTarget.style.display = "none")} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.textBright, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.title}</div>
              <div style={{ fontSize: 12, color: C.textDim }}>
                {result.channelTitle}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(52,211,153,0.08)", color: C.green, fontSize: 11, padding: "1px 8px", borderRadius: 8, border: `1px solid rgba(52,211,153,0.18)`, marginLeft: 8 }}>
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
              <div style={{ display: "inline-flex", background: "rgba(99,102,241,0.10)", color: C.accentDim, fontSize: 11, padding: "2px 10px", borderRadius: 8, border: `1px solid rgba(99,102,241,0.22)`, marginBottom: 10, fontWeight: 600 }}>
                {result.hookAnalysis.hookType} hook
              </div>
              <div style={{ fontSize: 13, color: C.textBright, fontStyle: "italic", lineHeight: 1.6, marginBottom: 10, borderLeft: `2px solid ${C.accent}`, paddingLeft: 10 }}>
                "{result.hookAnalysis.hook}"
              </div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.65 }}>{result.hookAnalysis.whyItWorks}</div>
            </div>

            {/* Structure */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 12 }}>📐 CONTENT STRUCTURE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.structure.slice(0, 5).map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 36, fontSize: 10, color: C.accentDim, fontWeight: 600, flexShrink: 0, paddingTop: 1 }}>{s.timestamp}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.textBright }}>{s.section}</div>
                      <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>{s.description}</div>
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
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.textBright, marginBottom: 3 }}>{t.trigger} <span style={{ color: C.accentDim, fontWeight: 400, fontSize: 11 }}>at {t.timestamp}</span></div>
                    <div style={{ fontSize: 11, color: C.textDim, fontStyle: "italic", lineHeight: 1.5 }}>"{t.example}"</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Title formula */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 12 }}>📋 TITLE FORMULA</div>
              <div style={{ background: "rgba(99,102,241,0.08)", border: `1px solid rgba(99,102,241,0.18)`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: C.accentDim, fontFamily: "monospace", fontWeight: 600, lineHeight: 1.6 }}>{result.titleFormula.formula}</div>
              </div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: 8 }}>{result.titleFormula.psychology}</div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 8 }}>PICK YOUR REMIX TITLE</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(result.titleFormula.remixExamples ?? []).map((title, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedRemix(i)}
                      style={{
                        padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                        border: `1px solid ${selectedRemix === i ? "rgba(99,102,241,0.6)" : C.border}`,
                        background: selectedRemix === i ? "rgba(99,102,241,0.14)" : "rgba(255,255,255,0.03)",
                        color: selectedRemix === i ? "#e2e8f0" : C.textDim,
                        transition: "all 0.15s",
                        display: "flex", alignItems: "center", gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, color: selectedRemix === i ? "#a5b4fc" : C.textDim, flexShrink: 0 }}>{i + 1}</span>
                      {title}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Framework summary + CTA */}
          <div style={{ background: "rgba(99,102,241,0.06)", border: `1px solid rgba(99,102,241,0.20)`, borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.textBright, marginBottom: 4 }}>Script this framework for your niche</div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, maxWidth: 480 }}>{result.remixFramework}</div>
            </div>
            <button
              onClick={handleUseFramework}
              style={{ height: 40, padding: "0 20px", background: C.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}
            >
              ↗ Use this framework
            </button>
          </div>
        </>
      )}
    </div>
  );
}
