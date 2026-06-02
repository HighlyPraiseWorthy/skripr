"use client";
import { useState, useEffect } from "react";

const C = {
  bg: "#0a0a0f", card: "#13131a", cardHover: "#1a1a24",
  border: "rgba(255,255,255,0.07)", borderAccent: "rgba(99,102,241,0.35)",
  accent: "#6366f1", accentDim: "#818cf8", textBright: "#f1f5f9",
  textDim: "#64748b", green: "#34d399",
};

type Phase = "loading" | "niches" | "loading-angles" | "angles" | "generating" | "result";

type BridgeNiche = {
  name: string;
  parentNiche: string;
  hook: string;
  algorithmNote: string;
  titlePreview: string;
};

type BlendedAngle = {
  angle: string;
  description: string;
  audience: string;
  titleSuggestion: string;
  blendExplained: string;
};

type Brief = {
  hookAnalysis: { hook: string; hookType: string; whyItWorks: string };
  structure: { timestamp: string; section: string; description: string; purpose: string }[];
  retentionTriggers: { trigger: string; example: string; timestamp: string }[];
  titleFormula: { formula: string; psychology: string; remixExamples: string[] };
  remixFramework: string;
  videoTitle: string;
  channelTitle: string;
};

const Spinner = ({ label, sub }: { label: string; sub?: string }) => (
  <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, fontFamily: "system-ui, sans-serif" }}>
    <div style={{ width: 44, height: 44, border: "3px solid rgba(99,102,241,0.2)", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <div style={{ fontSize: 15, fontWeight: 600, color: C.accentDim }}>{label}</div>
    {sub && <div style={{ fontSize: 12, color: C.textDim }}>{sub}</div>}
    <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
  </div>
);

export default function NicheBendBriefPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [niches, setNiches] = useState<BridgeNiche[]>([]);
  const [selectedNiche, setSelectedNiche] = useState<BridgeNiche | null>(null);
  const [angles, setAngles] = useState<BlendedAngle[]>([]);
  const [selectedAngle, setSelectedAngle] = useState<BlendedAngle | null>(null);
  const [script, setScript] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("skripr_niche_bend_brief");
      if (!stored) { window.location.href = "/dashboard/niche-bend"; return; }
      const b: Brief = JSON.parse(stored);
      setBrief(b);
      fetchBridgeNiches(b);
    } catch { window.location.href = "/dashboard/niche-bend"; }
  }, []);

  async function fetchBridgeNiches(b: Brief) {
    setPhase("loading");
    try {
      const res = await fetch("/api/suggest-bridge-niches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoTitle: b.videoTitle, channelTitle: b.channelTitle,
          remixFramework: b.remixFramework, hookType: b.hookAnalysis.hookType,
          titleFormula: b.titleFormula,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNiches(data.niches ?? []);
      setPhase("niches");
    } catch (e: any) { setError(e?.message || "Failed to generate bridge niches"); setPhase("niches"); }
  }

  async function handlePickNiche(niche: BridgeNiche) {
    if (!brief) return;
    setSelectedNiche(niche); setPhase("loading-angles"); setError(null);
    try {
      const res = await fetch("/api/suggest-niche-bend-angles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoTitle: brief.videoTitle, hookType: brief.hookAnalysis.hookType,
          titleFormula: brief.titleFormula, remixFramework: brief.remixFramework,
          bridgeSubNiche: niche,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAngles(data.angles ?? []);
      setPhase("angles");
    } catch (e: any) { setError(e?.message || "Failed to generate angles"); setPhase("niches"); }
  }

  async function handlePickAngle(angle: BlendedAngle) {
    if (!brief || !selectedNiche) return;
    setSelectedAngle(angle); setPhase("generating"); setError(null);
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: "", topic: angle.angle, niche: angle.audience, videoLength: (brief as any).targetMinutes >= 14 ? "long" : "medium", targetMinutes: (brief as any).targetMinutes ?? 15,
          hookType: brief.hookAnalysis.hookType, hookScript: brief.hookAnalysis.hook,
          titleFormula: angle.titleSuggestion, remixFramework: brief.remixFramework,
          contentStructure: brief.structure, retentionTriggers: brief.retentionTriggers,
          angle: "Blend these two niches: " + angle.blendExplained,
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
    } catch (e: any) { setError(e?.message || "Failed to save"); setTimeout(() => setError(null), 3000); }
    finally { setSaving(false); }
  }

  function copyScript() {
    if (!script) return;
    const parts: string[] = [];
    if (script.title) parts.push("TITLE: " + script.title);
    if (script.hook) parts.push("HOOK:\n" + script.hook);
    const b = script.script || script.fullScript || script.body || script.content || "";
    if (b) parts.push(b);
    navigator.clipboard.writeText(parts.join("\n\n"));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  if (phase === "loading") return <Spinner label="Finding your bridge sub-niches..." sub="Analyzing niche · algorithm signals · blend potential" />;
  if (phase === "loading-angles") return <Spinner label={"Blending niches: " + (selectedNiche?.name || "")} sub="Generating angles that fuse both communities" />;
  if (phase === "generating") return <Spinner label="Building your blended script..." sub={"Angle: " + (selectedAngle?.angle || "")} />;

  if (phase === "result" && script) {
    const title = script.title || selectedAngle?.titleSuggestion || "";
    const hook = script.hook || "";
    const body = script.script || script.fullScript || script.body || script.content || "";
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>↬</span>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: C.textBright, letterSpacing: -0.3 }}>Blended Script</h1>
              {selectedNiche && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: "rgba(139,92,246,0.12)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.25)" }}>
                  + {selectedNiche.name}
                </span>
              )}
            </div>
            <button onClick={copyScript}
              style={{ padding: "8px 16px", borderRadius: 9, background: copied ? "rgba(52,211,153,0.12)" : "rgba(99,102,241,0.12)", border: "1px solid " + (copied ? "rgba(52,211,153,0.4)" : "rgba(99,102,241,0.3)"), color: copied ? C.green : C.accentDim, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
              {copied ? "✓ Copied!" : "Copy Script"}
            </button>
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
          {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!savedId ? (
              <button onClick={handleSave} disabled={saving}
                style={{ width: "100%", height: 48, borderRadius: 12, background: saving ? "rgba(99,102,241,0.08)" : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: saving ? C.accentDim : "#fff", border: saving ? "1px solid rgba(99,102,241,0.2)" : "none", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: saving ? "none" : "0 4px 20px rgba(99,102,241,0.35)", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {saving ? "Saving..." : "✦ Save Script"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)", color: C.green, fontSize: 13, fontWeight: 700 }}>✓ Script saved</div>
                <a href={"/dashboard/scripts/" + savedId}
                  style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
                  Open in editor →
                </a>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setPhase("angles"); setScript(null); setSelectedAngle(null); setSavedId(null); }}
                style={{ flex: 1, height: 40, borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", color: C.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ← Try another angle
              </button>
              <button onClick={() => { setPhase("niches"); setSelectedNiche(null); setScript(null); setSavedId(null); }}
                style={{ flex: 1, height: 40, borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", color: C.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Different sub-niche
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "angles" && selectedNiche) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <button onClick={() => setPhase("niches")} style={{ fontSize: 12, color: C.textDim, background: "none", border: "none", cursor: "pointer", marginBottom: 16, padding: 0 }}>← Change sub-niche</button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>↬</span>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, letterSpacing: -0.3 }}>Choose Your Blended Angle</h1>
            </div>
            <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>Each angle fuses your niche with <strong style={{ color: "#c4b5fd" }}>{selectedNiche.name}</strong> to reach both communities.</p>
          </div>
          {error && <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{error}</div>}
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
                  <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 7, padding: "6px 10px", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, marginRight: 6 }}>TITLE →</span>
                    <span style={{ fontSize: 11, color: "#c4b5fd", fontWeight: 600 }}>{a.titleSuggestion}</span>
                  </div>
                  {a.blendExplained && (
                    <div style={{ fontSize: 11, color: "#a78bfa", fontStyle: "italic" }}>↬ {a.blendExplained}</div>
                  )}
                </div>
                <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff" }}>→</div>
              </div>
            ))}
          </div>
          {angles.length > 0 && brief && (
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button onClick={() => handlePickNiche(selectedNiche)} style={{ background: "none", border: "none", color: C.textDim, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Generate different angles</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default: niche selection phase
  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <a href="/dashboard/niche-bend" style={{ fontSize: 12, color: C.textDim, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}>← Back to Niche Bend</a>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>↬</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, letterSpacing: -0.3 }}>Pick Your Bridge Sub-Niche</h1>
          </div>
          <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>Each card shows a sub-niche that blends with your content. Titles are previewed using your video’s own formula.</p>
        </div>
        {brief && (
          <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 6 }}>ANALYZING FRAMEWORK FROM</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textBright, marginBottom: 8 }}>{brief.videoTitle}</div>
            {brief.titleFormula?.formula && (
              <div style={{ fontSize: 11, color: "#c4b5fd" }}>Formula: {brief.titleFormula.formula}</div>
            )}
          </div>
        )}
        {error && <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {niches.map((n, i) => (
            <div key={i} onClick={() => handlePickNiche(n)}
              style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 16, padding: "20px 22px", cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.cardHover; (e.currentTarget as HTMLElement).style.borderColor = C.borderAccent; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.card; (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.textBright }}>{n.name}</div>
                    {n.parentNiche && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(139,92,246,0.12)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.25)" }}>{n.parentNiche}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.textDim }}>{n.hook}</div>
                </div>
                <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", marginLeft: 16 }}>→</div>
              </div>
              {n.titlePreview && (
                <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, marginBottom: 4 }}>TITLE PREVIEW (your formula + this blend)</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#c4b5fd", lineHeight: 1.4 }}>{n.titlePreview}</div>
                </div>
              )}
              {n.algorithmNote && (
                <div style={{ fontSize: 11, color: "#64748b" }}>⚡ {n.algorithmNote}</div>
              )}
            </div>
          ))}
        </div>
        {niches.length > 0 && brief && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button onClick={() => fetchBridgeNiches(brief)} style={{ background: "none", border: "none", color: C.textDim, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Generate different sub-niches</button>
          </div>
        )}
      </div>
    </div>
  );
}
