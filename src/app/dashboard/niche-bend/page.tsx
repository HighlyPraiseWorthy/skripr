"use client";
import { useState } from "react";

const C = {
  bg: "#0a0a0f", card: "#13131a", cardHover: "#1a1a24",
  border: "rgba(255,255,255,0.07)", borderAccent: "rgba(99,102,241,0.35)",
  accent: "#6366f1", accentDim: "#818cf8", textBright: "#f1f5f9",
  textDim: "#64748b", green: "#34d399",
};

type AnalysisResult = {
  title: string; channelTitle: string;
  hookAnalysis: { hook: string; hookType: string; whyItWorks: string };
  structure: { timestamp: string; section: string; description: string; purpose: string }[];
  retentionTriggers: { trigger: string; example: string; timestamp: string }[];
  titleFormula: { formula: string; psychology: string; remixExamples: string[] };
  remixFramework: string;
};

export default function NicheBendPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!url.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/viral-remixer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) { setError(e?.message || "Failed to analyze video"); }
    finally { setLoading(false); }
  }

  function handleFindBridgeNiches() {
    if (!result) return;
    const brief = {
      hookAnalysis: result.hookAnalysis,
      structure: result.structure,
      retentionTriggers: result.retentionTriggers,
      titleFormula: result.titleFormula,
      remixFramework: result.remixFramework,
      videoTitle: result.title,
      channelTitle: result.channelTitle,
    };
    sessionStorage.setItem("skripr_niche_bend_brief", JSON.stringify(brief));
    window.location.href = "/dashboard/scripts/niche-bend-brief";
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>↬</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, letterSpacing: -0.3 }}>Niche Bend</h1>
            <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(99,102,241,0.12)", color: C.accentDim, border: "1px solid rgba(99,102,241,0.25)", padding: "2px 8px", borderRadius: 6 }}>BETA</span>
          </div>
          <p style={{ fontSize: 13, color: C.textDim, maxWidth: 500, lineHeight: 1.6 }}>
            Paste a video from your niche. We’ll find bridge sub-niches that blend with your content
            to break out of the algorithmic bubble and reach new audiences.
          </p>
        </div>

        <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 16, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 0.5, marginBottom: 10 }}>PASTE A VIDEO FROM YOUR NICHE</div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAnalyze()}
              placeholder="https://youtube.com/watch?v=..."
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: C.textBright, fontSize: 13, outline: "none" }}
            />
            <button onClick={handleAnalyze} disabled={loading || !url.trim()}
              style={{ padding: "10px 20px", borderRadius: 10, background: loading ? "rgba(99,102,241,0.15)" : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: loading ? C.accentDim : "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: !url.trim() ? 0.5 : 1, whiteSpace: "nowrap" }}>
              {loading ? "Analyzing..." : "Analyze"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: "40px 0" }}>
            <div style={{ width: 40, height: 40, border: "3px solid rgba(99,102,241,0.2)", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <div style={{ fontSize: 13, color: C.accentDim, fontWeight: 600 }}>Extracting viral framework...</div>
            <div style={{ fontSize: 11, color: C.textDim }}>hook type · structure · retention triggers · title formula</div>
            <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
          </div>
        )}

        {result && (
          <div>
            <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 10 }}>VIDEO ANALYZED</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textBright, marginBottom: 4, lineHeight: 1.4 }}>{result.title}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>{result.channelTitle}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: "rgba(99,102,241,0.15)", color: C.accentDim }}>{result.hookAnalysis.hookType} HOOK</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: "rgba(99,102,241,0.15)", color: C.accentDim }}>{result.structure?.length ?? 0} SECTIONS</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: "rgba(99,102,241,0.15)", color: C.accentDim }}>{result.retentionTriggers?.length ?? 0} RETENTION TRIGGERS</span>
              </div>
              {result.titleFormula?.formula && (
                <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#c4b5fd", marginBottom: 4 }}>TITLE FORMULA (used to preview bridge niches)</div>
                  <div style={{ fontSize: 12, color: C.textBright }}>{result.titleFormula.formula}</div>
                </div>
              )}
            </div>

            <button onClick={handleFindBridgeNiches}
              style={{ width: "100%", height: 52, borderRadius: 12, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 24px rgba(99,102,241,0.4)" }}>
              <span style={{ fontSize: 18 }}>↬</span>
              Find My Bridge Sub-Niches
              <span style={{ fontSize: 14, opacity: 0.8 }}>→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
