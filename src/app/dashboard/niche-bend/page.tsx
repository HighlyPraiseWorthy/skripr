"use client";
import { useState, useEffect } from "react";

const C = {
  bg: "#080c12", card: "#0d1520", cardHover: "#111d2e",
  border: "rgba(255,255,255,0.07)", borderAccent: "rgba(77,184,255,0.30)",
  accent: "#1a8fd1", accentDim: "#4db8ff", textBright: "#e8edf5",
  textDim: "#a6c0d8", green: "#34d399",
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
  const [plan, setPlan] = useState<string | null>(null);
  const [videoMinutes, setVideoMinutes] = useState<number>(15);
  const [extraSeconds, setExtraSeconds] = useState<number>(26);

  // ── Persist state across navigation ───────────────────────────────────────
  useEffect(() => {
    fetch("/api/user/plan").then(r=>r.json()).then(d=>setPlan(d.plan||"free")).catch(()=>setPlan("free"));
    try {
      const saved = localStorage.getItem("skripr_nb_state");
      if (!saved) return;
      const s = JSON.parse(saved);
      if (s.url) setUrl(s.url);
      if (s.result) setResult(s.result);
      if (s.videoMinutes) setVideoMinutes(s.videoMinutes);
      if (s.extraSeconds) setExtraSeconds(s.extraSeconds);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("skripr_nb_state", JSON.stringify({
        url, result, videoMinutes, extraSeconds,
      }));
    } catch {}
  }, [url, result, videoMinutes, extraSeconds]);


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
      sourceNiche: (result as any).niche || null,
      targetMinutes: videoMinutes,
    };
    sessionStorage.setItem("skripr_niche_bend_brief", JSON.stringify(brief));
    window.location.href = "/dashboard/scripts/niche-bend-brief";
  }

  if (plan === "free") {
    // Sell at the wall: preview what the analysis hands back so the lock
    // shows the outcome instead of just blocking.
    const gives = [
      { icon: "🪝", label: "Hook formula", desc: "why the opening grabbed viewers" },
      { icon: "📈", label: "Retention triggers", desc: "the beats that held watch time" },
      { icon: "🌉", label: "Bridge niches", desc: "where to cross it into yours" },
    ];
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: "40px 20px" }}>
        <div style={{ background: "#0d1520", border: "1px solid rgba(77,184,255,0.30)", borderRadius: 18, padding: "40px 44px", maxWidth: 520, textAlign: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "#7ed8ff", textTransform: "uppercase" }}>⚡ Turn any viral video into your script</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "18px 0 22px", textAlign: "left" }}>
            {gives.map(g => (
              <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(77,184,255,0.14)", background: "rgba(77,184,255,0.05)" }}>
                <span style={{ fontSize: 18 }}>{g.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e8edf5" }}>{g.label}</div>
                  <div style={{ fontSize: 12, color: "#a6c0d8" }}>{g.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <h2 style={{ color: "#e8edf5", fontSize: 22, fontWeight: 700, margin: "0 0 10px" }}>Reverse-engineer any viral video</h2>
          <p style={{ color: "#a6c0d8", fontSize: 15, lineHeight: 1.7, margin: "0 0 26px" }}>Paste a YouTube link and Skripr breaks down exactly why it worked, then hands you a ready-to-write brief bent into your niche.</p>
          <a href="/dashboard/settings" style={{ display: "inline-block", background: "linear-gradient(135deg,#0e6499,#1a8fd1)", color: "white", padding: "13px 32px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: 16 }}>Get Starter →</a>
        </div>
      </div>
    );
  }


  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>↬</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, letterSpacing: -0.3 }}>Niche Bend</h1>
          </div>
          <p style={{ fontSize: 15, color: C.textDim, maxWidth: 500, lineHeight: 1.6 }}>
            Paste a video from your niche. We’ll find bridge sub-niches that blend with your content
            to break out of the algorithmic bubble and reach new audiences.
          </p>
        </div>

        <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 16, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textDim, letterSpacing: 0.5, marginBottom: 10 }}>PASTE A VIDEO FROM YOUR NICHE</div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAnalyze()}
              placeholder="https://youtube.com/watch?v=..."
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: C.textBright, fontSize: 15, outline: "none" }}
            />
            <button onClick={handleAnalyze} disabled={loading || !url.trim()}
              style={{ padding: "10px 20px", borderRadius: 10, background: loading ? "rgba(77,184,255,0.13)" : "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", color: loading ? C.accentDim : "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: !url.trim() ? 0.5 : 1, whiteSpace: "nowrap" }}>
              {loading ? "Analyzing..." : "Analyze"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 15, marginBottom: 16 }}>{error}</div>
        )}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: "40px 0" }}>
            <div style={{ width: 40, height: 40, border: "3px solid rgba(77,184,255,0.15)", borderTop: "3px solid #4db8ff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <div style={{ fontSize: 15, color: C.accentDim, fontWeight: 600 }}>Extracting viral framework...</div>
            <div style={{ fontSize: 13, color: C.textDim }}>hook type · structure · retention triggers · title formula</div>
            <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
          </div>
        )}

        {result && (
          <div>
            <div style={{ background: "rgba(77,184,255,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 10 }}>VIDEO ANALYZED</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.textBright, marginBottom: 4, lineHeight: 1.4 }}>{result.title}</div>
              <div style={{ fontSize: 14, color: C.textDim, marginBottom: 14 }}>{result.channelTitle}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: "rgba(77,184,255,0.13)", color: C.accentDim }}>{result.hookAnalysis.hookType} HOOK</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: "rgba(77,184,255,0.13)", color: C.accentDim }}>{result.structure?.length ?? 0} SECTIONS</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: "rgba(77,184,255,0.13)", color: C.accentDim }}>{result.retentionTriggers?.length ?? 0} RETENTION TRIGGERS</span>
              </div>
              {result.titleFormula?.formula && (
                <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9de4ff", marginBottom: 4 }}>TITLE FORMULA (used to preview bridge niches)</div>
                  <div style={{ fontSize: 14, color: C.textBright }}>{result.titleFormula.formula}</div>
                </div>
              )}
            </div>


            {/* Video length slider */}
            <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 12, background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.11)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#a6c0d8", letterSpacing: 0.5 }}>VIDEO LENGTH</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#7ed8ff" }}>~{videoMinutes}:{String(extraSeconds).padStart(2, "0")} on YouTube</span>
              </div>
              <input
                type="range" min={10} max={20} step={1}
                value={videoMinutes}
                onChange={e => { setVideoMinutes(Number(e.target.value)); setExtraSeconds(20 + Math.floor(Math.random() * 30)); }}
                style={{ width: "100%", accentColor: "#1a8fd1", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#a6c0d8", marginTop: 6 }}>
                <span>10 min</span><span>12 min</span><span>15 min</span><span>18 min</span><span>20 min</span>
              </div>
            </div>
            <button onClick={handleFindBridgeNiches}
              style={{ width: "100%", height: 52, borderRadius: 12, background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", color: "#fff", border: "none", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 24px rgba(77,184,255,0.35)" }}>
              <span style={{ fontSize: 18 }}>↬</span>
              Find My Bridge Sub-Niches
              <span style={{ fontSize: 16, opacity: 0.8 }}>→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
