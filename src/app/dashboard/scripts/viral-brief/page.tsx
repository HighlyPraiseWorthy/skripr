"use client";
import { useState, useEffect } from "react";

const C = {
  bg: "#0a0a0f", card: "#13131a", cardHover: "#1a1a24",
  border: "rgba(255,255,255,0.07)", borderAccent: "rgba(99,102,241,0.35)",
  accent: "#6366f1", accentDim: "#818cf8", textBright: "#f1f5f9",
  textDim: "#64748b", green: "#34d399",
};

type Phase = "loading" | "angles" | "generating" | "result";
type Angle = { angle: string; description: string; audience: string; titleSuggestion: string; };
type Brief = {
  hookAnalysis: { hook: string; hookType: string; whyItWorks: string };
  structure: { timestamp: string; section: string; description: string; purpose: string }[];
  retentionTriggers: { trigger: string; example: string; timestamp: string }[];
  titleFormula: { formula: string; psychology: string; remixExamples: string[] };
  remixFramework: string; selectedTitle: string; videoTitle: string; channelTitle: string;
};

const Spinner = () => (
  <>
    <div style={{ width: 44, height: 44, border: "3px solid rgba(99,102,241,0.2)", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
  </>
);

export default function ViralBriefPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [angles, setAngles] = useState<Angle[]>([]);
  const [selectedAngle, setSelectedAngle] = useState<Angle | null>(null);
  const [script, setScript] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("skripr_viral_brief");
      if (!stored) { window.location.href = "/dashboard/viral-remixer"; return; }
      const b: Brief = JSON.parse(stored);
      setBrief(b);
      fetchAngles(b);
    } catch { window.location.href = "/dashboard/viral-remixer"; }
  }, []);

  async function fetchAngles(b: Brief) {
    try {
      const res = await fetch("/api/suggest-viral-angles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hookType: b.hookAnalysis.hookType, hookAnalysis: b.hookAnalysis, remixFramework: b.remixFramework, selectedTitle: b.selectedTitle, titleFormula: b.titleFormula, videoTitle: b.videoTitle }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAngles(data.angles ?? []);
      setPhase("angles");
    } catch (e: any) { setError(e?.message || "Failed to generate angles"); setPhase("angles"); }
  }

  async function handlePickAngle(angle: Angle) {
    if (!brief) return;
    setSelectedAngle(angle); setPhase("generating"); setError(null);
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: "", topic: angle.angle, niche: angle.audience, videoLength: (brief as any).targetMinutes >= 14 ? "long" : "medium", targetMinutes: (brief as any).targetMinutes ?? 15,
          hookType: brief.hookAnalysis.hookType, hookScript: brief.hookAnalysis.hook,
          titleFormula: angle.titleSuggestion, remixFramework: brief.remixFramework,
          contentStructure: brief.structure, retentionTriggers: brief.retentionTriggers,
        }),
      });
      const data = await res.json();
      if (data.error) {
        if (data.limitReached) { window.location.href = "/dashboard/settings?upgrade=1"; return; }
        setError(data.error); setPhase("angles"); return;
      }
      setScript(data); setPhase("result");
    } catch (e: any) { setError(e?.message || "Failed to generate script"); setPhase("angles"); }
  }

  function copyScript() {
    if (!script) return;
    const parts: string[] = [];
    if (script.title) parts.push("TITLE: " + script.title);
    if (script.hook) parts.push("HOOK:\n" + script.hook);
    const body = script.script || script.fullScript || script.body || script.content || "";
    if (body) parts.push(body);
    navigator.clipboard.writeText(parts.join("\n\n"));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    if (!script || saving || savedId) return;
    setSaving(true);
    try {
      const t = script.title || selectedAngle?.titleSuggestion || "Untitled Script";
      const h = script.hook || "";
      const b = script.script || script.fullScript || script.body || script.content || "";
      const content = [h, b].filter(Boolean).join("\n\n");
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

  if (phase === "loading") return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "system-ui, sans-serif" }}>
      <Spinner />
      <div style={{ fontSize: 15, fontWeight: 600, color: C.accentDim }}>Crafting angles from viral DNA...</div>
      <div style={{ fontSize: 12, color: C.textDim }}>Analyzing hook · structure · retention mechanics</div>
    </div>
  );

  if (phase === "generating") return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "system-ui, sans-serif" }}>
      <Spinner />
      <div style={{ fontSize: 15, fontWeight: 600, color: C.accentDim }}>Building your script...</div>
      {selectedAngle && (
        <div style={{ textAlign: "center", padding: "12px 20px", borderRadius: 10, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>ANGLE</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>{selectedAngle.angle}</div>
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
                style={{ padding: "8px 14px", borderRadius: 9, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: C.accentDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ← Try another angle
              </button>
              <button onClick={copyScript}
                style={{ padding: "8px 16px", borderRadius: 9, background: copied ? "rgba(52,211,153,0.12)" : "rgba(99,102,241,0.12)", border: "1px solid " + (copied ? "rgba(52,211,153,0.4)" : "rgba(99,102,241,0.3)"), color: copied ? C.green : C.accentDim, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                {copied ? "✓ Copied!" : "Copy Script"}
              </button>
            </div>
          </div>
          {title && (
            <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 6 }}>TITLE</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright, lineHeight: 1.4 }}>{title}</div>
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
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.9, whiteSpace: "pre-wrap", maxHeight: 520, overflowY: "auto" }}>{body}</div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!savedId ? (
              <button onClick={handleSave} disabled={saving}
                style={{ width: "100%", height: 48, borderRadius: 12, background: saving ? "rgba(99,102,241,0.08)" : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: saving ? C.accentDim : "#fff", border: saving ? "1px solid rgba(99,102,241,0.2)" : "none", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: saving ? "none" : "0 4px 20px rgba(99,102,241,0.35)", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {saving ? "Saving..." : "✦ Save Script"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)", color: C.green, fontSize: 13, fontWeight: 700, gap: 6 }}>
                  ✓ Script saved
                </div>
                <a href={"/dashboard/scripts/" + savedId}
                  style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
                  Open in editor →
                </a>
              </div>
            )}
            <a href="/dashboard/viral-remixer"
              style={{ width: "100%", height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", color: C.textDim, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
              Analyze another video
            </a>
          </div>
        </div>
      </div>
    );
  }

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
          <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>Pick the angle that fits your niche. Script builds around it using the viral framework.</p>
        </div>
        {brief && (
          <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 8 }}>VIRAL FRAMEWORK LOADED FROM</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textBright, marginBottom: 10, lineHeight: 1.4 }}>{brief.videoTitle}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: "rgba(99,102,241,0.15)", color: C.accentDim }}>{brief.hookAnalysis.hookType} HOOK</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: "rgba(99,102,241,0.15)", color: C.accentDim }}>{brief.structure?.length ?? 0} SECTIONS</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: "rgba(99,102,241,0.15)", color: C.accentDim }}>{brief.retentionTriggers?.length ?? 0} RETENTION TRIGGERS</span>
              {brief.selectedTitle && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: "rgba(139,92,246,0.15)", color: "#c4b5fd" }}>
                  TITLE: {brief.selectedTitle.slice(0, 40)}{brief.selectedTitle.length > 40 ? "…" : ""}
                </span>
              )}
            </div>
          </div>
        )}
        {error && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {angles.map((a, i) => (
            <div key={i} onClick={() => handlePickAngle(a)}
              style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: "18px 20px", cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "flex-start", gap: 16 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.cardHover; (e.currentTarget as HTMLElement).style.borderColor = C.borderAccent; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.card; (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 700, color: C.accentDim }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright, marginBottom: 4, lineHeight: 1.3 }}>{a.angle}</div>
                <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, marginBottom: 8 }}>{a.description}</div>
                <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 7, padding: "6px 10px", marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, marginRight: 6 }}>TITLE →</span>
                  <span style={{ fontSize: 11, color: "#c4b5fd", fontWeight: 600 }}>{a.titleSuggestion}</span>
                </div>
                <div style={{ fontSize: 11, color: C.textDim }}><span style={{ color: "#64748b" }}>Audience: </span>{a.audience}</div>
              </div>
              <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>→</div>
            </div>
          ))}
        </div>
        {angles.length > 0 && brief && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button onClick={() => { setPhase("loading"); fetchAngles(brief); }}
              style={{ background: "none", border: "none", color: C.textDim, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
              Generate different angles
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
