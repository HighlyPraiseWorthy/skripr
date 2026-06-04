"use client";

import { useState, useEffect, useRef } from "react";
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
  danger: "#f87171",
  success: "#34d399",
  warning: "#fbbf24",
};

export default function CompliancePage() {
  const { isLoaded, isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [niche, setNiche] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  const nicheOptions = NICHES.map(n => ({ value: n.id, label: n.name }));

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) setError("auth");
    fetch("/api/user/plan").then(r=>r.json()).then(d=>setPlan(d.plan||"free")).catch(()=>setPlan("free"));
  }, [isLoaded, isSignedIn]);

  async function handleCheck() {
    if (!script.trim() || !title.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compliance/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, title, niche }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Compliance check failed");
      setReport(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }

  const scoreColor = (s: number) =>
    s >= 75 ? C.success : s >= 50 ? C.warning : s >= 25 ? "#fb923c" : C.danger;

  /* ══ AUTH ══ */
  if (error === "auth") {
    return (
      <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ borderRadius: 24, background: C.cardBg, border: `1px solid ${C.border}`, padding: 64, textAlign: "center" }}>
            <p style={{ color: C.textBright, fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Sign in to use Compliance Checker</p>
            <p style={{ color: C.textDim, fontSize: 15, marginBottom: 28 }}>Check your scripts before publishing to avoid demonetization</p>
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
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: 64, textAlign: "center" }}>
            <p style={{ color: C.textDim }}>Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  if (plan === "free") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: "40px 20px" }}>
        <div style={{ background: "#12122a", border: "1px solid rgba(99,102,241,0.35)", borderRadius: 18, padding: "44px 48px", maxWidth: 440, textAlign: "center" }}>
          <div style={{ fontSize: 38, marginBottom: 16 }}>🔒</div>
          <h2 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}>Starter Plan Required</h2>
          <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, margin: "0 0 28px" }}>Compliance Checker is available on Starter and above. Upgrade to scan your scripts for demonetization risk across 6 YouTube policy dimensions.</p>
          <a href="/dashboard/settings" style={{ display: "inline-block", background: "linear-gradient(135deg,#6366f1,#7c3aed)", color: "white", padding: "13px 32px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>Upgrade to Starter →</a>
        </div>
      </div>
    );
  }


  return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
      {/* Glows */}
      <div aria-hidden style={{ position: "fixed", top: -160, right: -100, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.14) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden style={{ position: "fixed", bottom: -180, left: -120, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.09) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, marginBottom: 6 }}>Compliance Checker</h1>
          <p style={{ color: C.textDim, fontSize: 15, lineHeight: 1.6 }}>Check your script before publishing to avoid demonetization</p>
        </div>

        {/* Input Card */}
        <div style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 12 }}>SCRIPT TO CHECK</div>

          {/* Title */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>Video Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Your video title"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 12, background: "#1a1a3a", color: C.text, fontSize: 14, fontWeight: 500, border: `1px solid ${C.border}`, outline: "none" }}
            />
          </div>

          {/* Niche */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>Niche</label>
            <select
              value={niche}
              onChange={e => setNiche(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 12, background: "#1a1a3a", color: C.text, fontSize: 14, fontWeight: 500, border: `1px solid ${C.border}`, outline: "none", cursor: "pointer" }}
            >
              <option value="">Select niche…</option>
              {nicheOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Textarea */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>Script Content</label>
            <textarea
              ref={textareaRef}
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder="Paste your full script here…"
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 12,
                background: "#1a1a3a",
                color: C.text,
                fontSize: 14,
                border: `1px solid ${C.border}`,
                outline: "none",
                minHeight: 200,
                resize: "vertical",
                lineHeight: 1.6,
              }}
            />
          </div>

          <button
            onClick={handleCheck}
            disabled={isLoading || !script.trim() || !title.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              borderRadius: 14,
              background: "linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: isLoading || !script.trim() || !title.trim() ? "not-allowed" : "pointer",
              opacity: isLoading || !script.trim() || !title.trim() ? 0.5 : 1,
              boxShadow: "0 0 22px rgba(99,102,241,0.30)",
            }}
          >
            {isLoading ? "Checking…" : "Run Compliance Check"}
          </button>
          {error && <p style={{ color: C.danger, fontSize: 13, marginTop: 10 }}>{error}</p>}
        </div>

        {/* Report */}
        {report && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Score card */}
            <div style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: C.textBright, marginBottom: 4 }}>Compliance Score</h3>
                <p style={{ color: C.textDim, fontSize: 13 }}>{report.summary}</p>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 44, fontWeight: 700, color: scoreColor(report.overallScore || 0), lineHeight: 1 }}>
                  {report.overallScore || 0}
                </span>
                <span style={{ fontSize: 15, color: C.textDim }}>/100</span>
              </div>
            </div>

            {/* Risk badge */}
            <div>
              <span
                style={{
                  display: "inline-block",
                  padding: "6px 14px",
                  borderRadius: 10,
                  background: report.riskLevel === "low"
                    ? "rgba(52,211,153,0.12)"
                    : report.riskLevel === "medium"
                      ? "rgba(251,191,36,0.12)"
                      : "rgba(248,113,113,0.12)",
                  color: report.riskLevel === "low"
                    ? C.success
                    : report.riskLevel === "medium"
                      ? C.warning
                      : C.danger,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                }}
              >
                {report.riskLevel?.toUpperCase()} RISK
              </span>
            </div>

            {/* Individual checks */}
            {report.checks?.map((check: any) => (
              <div key={check.id} style={{ borderRadius: 16, background: C.cardBg, border: `1px solid ${C.border}`, padding: "18px 22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 600, color: C.textBright }}>{check.name}</h4>
                      <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: check.status === "pass" ? "rgba(52,211,153,0.12)" : check.status === "warn" ? "rgba(251,191,36,0.12)" : "rgba(248,113,113,0.12)", color: check.status === "pass" ? C.success : check.status === "warn" ? C.warning : C.danger, textTransform: "uppercase" }}>{check.status}</span>
                    </div>
                    <p style={{ color: C.textDim, fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>{check.details}</p>
                    {check.suggestions?.length > 0 && (
                      <ul style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {check.suggestions.map((s: string, i: number) => (
                          <li key={i} style={{ fontSize: 12, color: C.accent, display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <span style={{ color: C.accent, flexShrink: 0 }}>→</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span style={{ fontSize: 22, fontWeight: 700, color: scoreColor(check.score || 0) }}>{check.score || 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
