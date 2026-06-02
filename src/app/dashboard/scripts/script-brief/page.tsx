"use client";
import { useState, useEffect } from "react";

const C = {
  bg: "#0a0a0f", card: "#13131a", cardHover: "#1a1a24",
  border: "rgba(255,255,255,0.07)", borderAccent: "rgba(99,102,241,0.35)",
  accent: "#6366f1", accentDim: "#818cf8", textBright: "#f1f5f9",
  textDim: "#64748b", green: "#34d399",
};

const EMOTION_COLOR: Record<string, string> = {
  curiosity: "#818cf8", fear: "#f87171", anger: "#fb923c",
  excitement: "#34d399", surprise: "#c4b5fd",
};

type Phase = "loading" | "angles" | "generating" | "result";
type Angle = { hookType: string; hookPremise: string; titleSuggestion: string; whyItWorks: string; audienceEmotion: string; };
type Brief = { topic: string; niche: string; videoLength: string; hookTypeFilter?: string | null; angles: Angle[]; };

const Spinner = ({ label, sub }: { label: string; sub?: string }) => (
  <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, fontFamily: "system-ui, sans-serif" }}>
    <div style={{ width: 44, height: 44, border: "3px solid rgba(99,102,241,0.2)", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <div style={{ fontSize: 15, fontWeight: 600, color: C.accentDim }}>{label}</div>
    {sub && <div style={{ fontSize: 12, color: C.textDim }}>{sub}</div>}
    <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
  </div>
);

export default function ScriptBriefPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<Angle | null>(null);
  const [script, setScript] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedMagnet, setSelectedMagnet] = useState<number | null>(null);
  const [appliedMagnetTitle, setAppliedMagnetTitle] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("skripr_script_brief");
      if (!stored) { window.location.href = "/dashboard/scripts/new"; return; }
      const b: Brief = JSON.parse(stored);
      setBrief(b);
      if (b.angles?.length > 0) setPhase("angles");
      else fetchAngles(b);
    } catch { window.location.href = "/dashboard/scripts/new"; }
  }, []);

  async function fetchAngles(b: Brief) {
    setPhase("loading");
    try {
      const res = await fetch("/api/suggest-script-angles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: b.topic, niche: b.niche, videoLength: b.videoLength, hookTypeFilter: b.hookTypeFilter || null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const updated = { ...b, angles: data.angles ?? [] };
      sessionStorage.setItem("skripr_script_brief", JSON.stringify(updated));
      setBrief(updated);
      setPhase("angles");
    } catch (e: any) { setError(e?.message || "Failed to generate angles"); setPhase("angles"); }
  }

  async function handlePickAngle(angle: Angle) {
    if (!brief) return;
    setSelectedAngle(angle); setPhase("generating"); setError(null);
    setSelectedMagnet(null); setAppliedMagnetTitle(null);
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: "", topic: brief.topic, niche: brief.niche,
          videoLength: brief.videoLength || "medium",
          hookType: angle.hookType,
          angle: `Hook type: ${angle.hookType}. Opening hook to adapt: "${angle.hookPremise}". Suggested title: ${angle.titleSuggestion}`,
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

  async function handleSave() {
    if (!script || saving || savedId) return;
    setSaving(true);
    try {
      const t = appliedMagnetTitle || script.title || selectedAngle?.titleSuggestion || "Untitled Script";
      const h = script.hook || "";
      const b = script.script || script.fullScript || script.body || script.content || "";
      const content = [h, b].filter(Boolean).join("\n\n");
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const res = await fetch("/api/scripts/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, content, niche: brief?.niche || "", topic: brief?.topic || "", wordCount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSavedId(data.id);
    } catch (e: any) { setError(e?.message || "Failed to save"); setTimeout(() => setError(null), 3000); }
    finally { setSaving(false); }
  }

  function copyScript() {
    if (!script) return;
    const parts: string[] = [];
    const t = appliedMagnetTitle || script.title || "";
    if (t) parts.push("TITLE: " + t);
    if (script.hook) parts.push("HOOK:\n" + script.hook);
    const b = script.script || script.fullScript || script.body || script.content || "";
    if (b) parts.push(b);
    navigator.clipboard.writeText(parts.join("\n\n"));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  if (phase === "loading") return <Spinner label="Finding your best hook angles..." sub="Analyzing topic, audience psychology, and hook strategies" />;
  if (phase === "generating") return <Spinner label="Building your script..." sub={(selectedAngle?.hookType || "") + " hook"} />;

  if (phase === "result" && script) {
    const title = appliedMagnetTitle || script.title || selectedAngle?.titleSuggestion || "";
    const hook = script.hook || "";
    const body = script.script || script.fullScript || script.body || script.content || "";
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>&#10022;</span>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: C.textBright, letterSpacing: -0.3 }}>Your Script</h1>
              {selectedAngle && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: "rgba(99,102,241,0.12)", color: C.accentDim, border: "1px solid rgba(99,102,241,0.25)" }}>{selectedAngle.hookType}</span>}
            </div>
            <button onClick={copyScript} style={{ padding: "8px 16px", borderRadius: 9, background: copied ? "rgba(52,211,153,0.12)" : "rgba(99,102,241,0.12)", border: "1px solid " + (copied ? "rgba(52,211,153,0.4)" : "rgba(99,102,241,0.3)"), color: copied ? C.green : C.accentDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {copied ? "Copied!" : "Copy Script"}
            </button>
          </div>

          {title && (
            <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 6 }}>TITLE</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright, lineHeight: 1.4 }}>{title}</div>
            </div>
          )}

          {/* Viral Magnet */}
          {script.magnetSuggestions && script.magnetSuggestions.length > 0 && (
            <div style={{ marginBottom: 16, borderRadius: 14, border: "1px solid rgba(99,102,241,0.20)", background: "rgba(99,102,241,0.04)", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 15 }}>&#129522;</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.textBright }}>Viral Magnet</span>
                <span style={{ fontSize: 11, color: C.textDim }}>Add one word to pull more clicks</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: selectedMagnet !== null ? 10 : 0 }}>
                {script.magnetSuggestions.map((s: any, i: number) => {
                  const gc: Record<string, string> = { S: "#f59e0b", A: "#818cf8", B: "#34d399", C: "#64748b" };
                  const active = selectedMagnet === i;
                  const col = gc[s.word?.grade] || C.accentDim;
                  return (
                    <button key={i} onClick={() => setSelectedMagnet(active ? null : i)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: active ? `1.5px solid ${col}` : "1px solid rgba(99,102,241,0.18)", background: active ? "rgba(99,102,241,0.12)" : "transparent", color: active ? col : C.textDim, transition: "all 0.15s" }}>
                      {s.word?.word} <span style={{ fontSize: 10, opacity: 0.8 }}>{s.word?.grade}</span>
                    </button>
                  );
                })}
              </div>
              {selectedMagnet !== null && script.magnetSuggestions[selectedMagnet] && (() => {
                const s = script.magnetSuggestions[selectedMagnet];
                const gc: Record<string, string> = { S: "#f59e0b", A: "#818cf8", B: "#34d399", C: "#64748b" };
                const col = gc[s.word?.grade] || C.accentDim;
                const isApplied = appliedMagnetTitle === s.injectedTitle;
                return (
                  <div style={{ borderRadius: 10, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(99,102,241,0.14)", padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: col }}>{s.word?.word}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: col + "22", color: col }}>{s.word?.grade}-tier</span>
                      <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: C.green }}>{s.word?.lift_range} lift</span>
                    </div>
                    <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: 10 }}>{s.word?.why_it_works}</p>
                    <div style={{ borderRadius: 8, background: "rgba(99,102,241,0.06)", padding: "8px 12px", marginBottom: 10, fontSize: 12 }}>
                      <div style={{ color: C.textDim, marginBottom: 4 }}>Before: {script.title}</div>
                      <div style={{ color: C.textBright, fontWeight: 600 }}>After: {s.injectedTitle}</div>
                    </div>
                    <button onClick={() => setAppliedMagnetTitle(isApplied ? null : s.injectedTitle)} style={{ width: "100%", padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: isApplied ? "rgba(248,113,113,0.10)" : "linear-gradient(135deg,#6366f1,#7c3aed)", color: isApplied ? "#f87171" : "#fff" }}>
                      {isApplied ? "Remove Viral Magnet" : "Apply Viral Magnet"}
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {hook && (
            <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 8 }}>HOOK &middot; {selectedAngle?.hookType}</div>
              <div style={{ fontSize: 13, color: C.textBright, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{hook}</div>
            </div>
          )}
          {body && (
            <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "18px 22px", marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 12 }}>SCRIPT</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.9, whiteSpace: "pre-wrap", maxHeight: 520, overflowY: "auto" }}>{body}</div>
            </div>
          )}
          {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!savedId ? (
              <button onClick={handleSave} disabled={saving} style={{ width: "100%", height: 48, borderRadius: 12, background: saving ? "rgba(99,102,241,0.08)" : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: saving ? C.accentDim : "#fff", border: saving ? "1px solid rgba(99,102,241,0.2)" : "none", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {saving ? "Saving..." : "&#10022; Save Script"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)", color: C.green, fontSize: 13, fontWeight: 700 }}>&#10003; Saved!</div>
                <a href={"/dashboard/scripts/" + savedId} style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Open in editor</a>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setPhase("angles"); setScript(null); setSelectedAngle(null); setSavedId(null); setAppliedMagnetTitle(null); }} style={{ flex: 1, height: 40, borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", color: C.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Try another hook</button>
              <a href="/dashboard/scripts/new" style={{ flex: 1, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", color: C.textDim, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>New topic</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <a href="/dashboard/scripts/new" style={{ fontSize: 12, color: C.textDim, textDecoration: "none", marginBottom: 16, display: "inline-block" }}>&#8592; Back</a>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>&#10022;</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, letterSpacing: -0.3 }}>Pick Your Hook Angle</h1>
          </div>
          <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>Each card uses a different psychological hook. Pick the one that fits your style.</p>
        </div>

        {brief && (
          <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 0.5 }}>TOPIC</div>
              {brief.hookTypeFilter && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: C.accentDim }}>{brief.hookTypeFilter}</span>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>{brief.topic}</div>
            {brief.niche && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{brief.niche}</div>}
          </div>
        )}

        {error && <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(brief?.angles ?? []).map((a, i) => {
            const ec = EMOTION_COLOR[a.audienceEmotion?.toLowerCase() || ""] || C.accentDim;
            return (
              <div key={i} onClick={() => handlePickAngle(a)}
                style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 16, padding: "20px 22px", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.cardHover; (e.currentTarget as HTMLElement).style.borderColor = C.borderAccent; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.card; (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: ec, letterSpacing: 0.5 }}>{a.hookType}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: ec + "22", color: ec, border: "1px solid " + ec + "44" }}>triggers {a.audienceEmotion}</span>
                  </div>
                  <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff" }}>&#8594;</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.textBright, lineHeight: 1.5, marginBottom: 10 }}>&#8220;{a.hookPremise}&#8221;</div>
                <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, marginBottom: 4 }}>TITLE</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#c4b5fd", lineHeight: 1.4 }}>{a.titleSuggestion}</div>
                </div>
                <div style={{ fontSize: 11, color: C.textDim, fontStyle: "italic" }}>{a.whyItWorks}</div>
              </div>
            );
          })}
        </div>

        {(brief?.angles ?? []).length > 0 && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button onClick={() => brief && fetchAngles(brief)} style={{ background: "none", border: "none", color: C.textDim, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
              Generate different hook angles
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
