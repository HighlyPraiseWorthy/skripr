"use client";

import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { NICHES } from "@/lib/data/niches";

const C = {
  bg: "#0b0b17",
  cardBg: "#12122a",
  border: "rgba(99,102,241,0.12)",
  accent: "#818cf8",
  text: "#e2e8f0",
  textDim: "#64748b",
  textBright: "#f1f5f9",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
};

const RANK_COLORS = [
  "rgba(251,191,36,0.12)",
  "rgba(156,163,175,0.12)",
  "rgba(251,146,60,0.12)",
  null,
];
const RANK_TEXT: Record<number, string> = {
  0: "#fbbf24",
  1: "#d1d5db",
  2: "#fb923c",
};

export default function HooksPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState("educational");
  const [isLoading, setIsLoading] = useState(false);
  const [hooks, setHooks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const nicheOptions = NICHES.map(n => ({ value: n.id, label: n.name }));
  const toneOptions = [
    { value: "educational", label: "Educational" },
    { value: "entertaining", label: "Entertaining" },
    { value: "storytelling", label: "Storytelling" },
    { value: "hype", label: "Hype / Energetic" },
  ];

  useEffect(() => {
    if (isLoaded && !isSignedIn) setError("auth");
  }, [isLoaded, isSignedIn]);

  async function handleGenerate() {
    if (!topic.trim() || !niche) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hooks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, niche, tone, count: 10 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate hooks");
      setHooks(data.hooks || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }

  const retentionColor = (r: number) => r >= 70 ? C.success : r >= 50 ? C.warning : C.danger;

  /* ══ AUTH ══ */
  if (error === "auth") {
    return (
      <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ borderRadius: 24, background: C.cardBg, border: `1px solid ${C.border}`, padding: 64, textAlign: "center" }}>
            <p style={{ color: C.textBright, fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Sign in to use the Hook Optimizer</p>
            <p style={{ color: C.textDim, fontSize: 15, marginBottom: 28 }}>Generate hooks ranked by predicted audience retention</p>
            <button onClick={() => openSignIn?.()} style={{ padding: "12px 28px", borderRadius: 14, background: "linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)", color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer", boxShadow: "0 0 22px rgba(99,102,241,0.30)" }}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
        <div style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: 64, textAlign: "center" }}>
          <p style={{ color: C.textDim }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
      <div aria-hidden style={{ position: "fixed", top: -160, right: -100, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.14) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden style={{ position: "fixed", bottom: -180, left: -120, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.09) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, marginBottom: 6 }}>Hook Optimizer</h1>
          <p style={{ color: C.textDim, fontSize: 15, lineHeight: 1.6 }}>Generate and rank hooks by predicted retention</p>
        </div>

        {/* Input Card */}
        <div style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 16 }}>GENERATE HOOKS</div>

          {/* Topic */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>Video Topic</label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g., 5 money habits that will make you rich"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 12, background: "#1a1a3a", color: C.text, fontSize: 14, fontWeight: 500, border: `1px solid ${C.border}`, outline: "none" }}
            />
          </div>

          {/* Niche + Tone */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>Niche</label>
              <select value={niche} onChange={e => setNiche(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 12, background: "#1a1a3a", color: C.text, fontSize: 14, fontWeight: 500, border: `1px solid ${C.border}`, outline: "none", cursor: "pointer" }}>
                <option value="">Select niche…</option>
                {nicheOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>Tone</label>
              <select value={tone} onChange={e => setTone(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 12, background: "#1a1a3a", color: C.text, fontSize: 14, fontWeight: 500, border: `1px solid ${C.border}`, outline: "none", cursor: "pointer" }}>
                {toneOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading || !topic.trim() || !niche}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "13px 28px",
              borderRadius: 14,
              background: "linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              border: "none",
              cursor: isLoading || !topic.trim() || !niche ? "not-allowed" : "pointer",
              opacity: isLoading || !topic.trim() || !niche ? 0.5 : 1,
              boxShadow: "0 0 22px rgba(99,102,241,0.30)",
            }}
          >
            {isLoading ? "Generating…" : "✦ Generate 10 Hooks"}
          </button>
          {error && <p style={{ color: C.danger, fontSize: 13, marginTop: 10 }}>{error}</p>}
        </div>

        {/* Hooks list */}
        {hooks.length > 0 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.textBright, marginBottom: 16, letterSpacing: -0.3 }}>Ranked Hooks</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {hooks.map((hook: any, i: number) => {
                const rankBg = i < 3 ? RANK_COLORS[i] : "rgba(99,102,241,0.08)";
                const rankText = RANK_TEXT[i] ?? C.accent;
                return (
                  <div key={i} style={{ borderRadius: 16, background: C.cardBg, border: `1px solid ${C.border}`, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                    {/* Rank */}
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: rankBg || "rgba(99,102,241,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: rankText }}>{i + 1}</span>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: C.textBright, fontSize: 14, fontWeight: 500, marginBottom: 6, lineHeight: 1.5 }}>{hook.text}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.12)", color: C.accent }}>{hook.type}</span>
                        <span style={{ fontSize: 12, color: C.textDim }}>Predicted retention: {hook.predictedRetention}%</span>
                      </div>
                      <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>{hook.reasoning}</p>
                    </div>

                    {/* Score */}
                    <div style={{ flexShrink: 0 }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: retentionColor(hook.predictedRetention || 0) }}>{hook.predictedRetention || 0}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
