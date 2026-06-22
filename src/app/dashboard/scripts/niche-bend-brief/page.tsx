"use client";
import { useState, useEffect } from "react";
import GenerationProgress from "@/components/GenerationProgress";
import { joinHookBody, bodyStartsWithHook } from "@/lib/script-text";
import { VoiceSelect } from "@/components/VoiceSelect";
import { CompanionCtaToggle } from "@/components/CompanionCtaToggle";
import StorytellingPicker from "@/components/StorytellingPicker";
import ResearchStep from "@/components/ResearchStep";

const C = {
  bg: "#080c12", card: "#0d1520", cardHover: "#111d2e",
  border: "rgba(255,255,255,0.07)", borderAccent: "rgba(77,184,255,0.30)",
  accent: "#1a8fd1", accentDim: "#4db8ff", textBright: "#e8edf5",
  textDim: "#a6c0d8", green: "#34d399",
};

type Phase = "loading" | "niches" | "loading-angles" | "angles" | "research" | "storytelling" | "generating" | "result";

type BridgeNiche = {
  name: string;
  parentNiche: string;
  hook: string;
  algorithmNote: string;
  titlePreview: string;
  rpmLabel?: string | null;
  bridgeRpm?: number | null;
  proof?: BlendProof | null;
  poolCount?: number | null;
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
  sourceNiche?: string | null;
};

type BlendProof = { tier: "proven" | "emerging" | "blue_ocean"; topViews: number; hitsOver100k: number; label: string };

const Spinner = ({ label, sub }: { label: string; sub?: string }) => (
  <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, fontFamily: "system-ui, sans-serif" }}>
    <div style={{ width: 44, height: 44, border: "3px solid rgba(77,184,255,0.15)", borderTop: "3px solid #4db8ff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <div style={{ fontSize: 15, fontWeight: 600, color: C.accentDim }}>{label}</div>
    {sub && <div style={{ fontSize: 12, color: C.textDim }}>{sub}</div>}
    <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
  </div>
);

export default function NicheBendBriefPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [niches, setNiches] = useState<BridgeNiche[]>([]);
  const [seenNiches, setSeenNiches] = useState<string[]>([]);
  const [selectedNiche, setSelectedNiche] = useState<BridgeNiche | null>(null);
  const [angles, setAngles] = useState<BlendedAngle[]>([]);
  const [selectedAngle, setSelectedAngle] = useState<BlendedAngle | null>(null);
  const [sourceMaterial, setSourceMaterial] = useState<string>("");
  const [script, setScript] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [companionCta, setCompanionCta] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("skripr_niche_bend_brief");
      if (!stored) { window.location.href = "/dashboard/niche-bend"; return; }
      const b: Brief = JSON.parse(stored);
      setBrief(b);
      fetchBridgeNiches(b);
    } catch { window.location.href = "/dashboard/niche-bend"; }
  }, []);

  async function fetchBridgeNiches(b: Brief, exclude: string[] = []) {
    setPhase("loading");
    try {
      const res = await fetch("/api/suggest-bridge-niches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoTitle: b.videoTitle, channelTitle: b.channelTitle,
          remixFramework: b.remixFramework, hookType: b.hookAnalysis.hookType,
          titleFormula: b.titleFormula, sourceNiche: b.sourceNiche || null,
          exclude,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const fresh: BridgeNiche[] = data.niches ?? [];
      setNiches(fresh);
      setSeenNiches(prev => Array.from(new Set([...prev, ...fresh.map(n => n.name)])));
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

  // Pick an angle → go to the storytelling step (don't generate yet).
  function handlePickAngle(angle: BlendedAngle) {
    if (!brief || !selectedNiche) return;
    setSelectedAngle(angle); setError(null); setPhase("research");
  }

  async function generateWithStory(storytellingMode: string, storytellingTechniques: string[]) {
    const angle = selectedAngle;
    if (!brief || !selectedNiche || !angle) return;
    setPhase("generating"); setError(null);
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: "", topic: angle.angle, niche: angle.audience, videoLength: (brief as any).targetMinutes >= 14 ? "long" : "medium", targetMinutes: (brief as any).targetMinutes ?? 15,
          hookType: brief.hookAnalysis.hookType, hookScript: brief.hookAnalysis.hook,
          titleFormula: angle.titleSuggestion, remixFramework: brief.remixFramework,
          contentStructure: brief.structure, retentionTriggers: brief.retentionTriggers,
          angle: "Blend these two niches: " + angle.blendExplained,
          voiceProfileId: voiceId || undefined,
          sourceNiche: brief.sourceNiche || undefined,
          bridgeNiche: selectedNiche.parentNiche || undefined,
          companionCta,
          storytellingMode, storytellingTechniques, sourceMaterial: sourceMaterial || undefined,
          selectedTitle: angle.titleSuggestion || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!data || data.error) {
        if (data?.limitReached) { window.location.href = "/dashboard/settings?upgrade=1"; return; }
        setError(data?.error || "The connection dropped while generating. Please try again."); setPhase("angles"); return;
      }
      setScript(data); setSavedId(data.savedId ?? null); setPhase("result");
    } catch (e: any) { setError(e?.message || "Failed to generate script"); setPhase("angles"); }
  }

  async function handleSave() {
    if (!script || saving || savedId) return;
    setSaving(true);
    try {
      if ((script as any).savedId) { setSavedId((script as any).savedId); return; }
      const t = script.title || selectedAngle?.titleSuggestion || "Untitled Script";
      const h = script.hook || "";
      const b = script.fullScript || script.script || script.body || script.content || "";
      const content = joinHookBody(h, b);
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
    const b = script.fullScript || script.script || script.body || script.content || "";
    if (script.hook && !bodyStartsWithHook(b, script.hook)) parts.push("HOOK:\n" + script.hook);
    if (b) parts.push(b);
    navigator.clipboard.writeText(parts.join("\n\n"));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  if (phase === "research" && selectedAngle) return (
    <ResearchStep
      topic={selectedAngle.angle}
      niche={selectedNiche?.parentNiche || selectedAngle.audience}
      angle={selectedAngle.titleSuggestion || selectedAngle.angle}
      angleLabel={selectedAngle.titleSuggestion || selectedAngle.angle}
      onContinue={(sm) => { setSourceMaterial(sm || ""); setPhase("storytelling"); }}
      onBack={() => setPhase("angles")}
    />
  );

  if (phase === "storytelling" && selectedAngle) return (
    <StorytellingPicker
      topic={selectedAngle.angle}
      niche={selectedNiche?.parentNiche || selectedAngle.audience}
      angle={selectedAngle.titleSuggestion || selectedAngle.angle}
      angleLabel={selectedAngle.titleSuggestion || selectedAngle.angle}
      sourceTitle={brief?.videoTitle}
      onGenerate={generateWithStory}
      onBack={() => setPhase("research")}
    />
  );

  if (phase === "loading") return <Spinner label="Finding your bridge sub-niches..." sub="Analyzing niche · algorithm signals · blend potential" />;
  if (phase === "loading-angles") return <Spinner label={"Blending niches: " + (selectedNiche?.name || "")} sub="Generating angles that fuse both communities" />;
  if (phase === "generating") return (
    <GenerationProgress
      label="Building your blended script..."
      sub={"Angle: " + (selectedAngle?.angle || "")}
      expectedMs={45000 + (((brief as any)?.targetMinutes ?? 15) * 5000)}
    />
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
              <span style={{ fontSize: 20 }}>↬</span>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: C.textBright, letterSpacing: -0.3 }}>Blended Script</h1>
              {selectedNiche && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: "rgba(77,184,255,0.10)", color: "#9de4ff", border: "1px solid rgba(77,184,255,0.22)" }}>
                  + {selectedNiche.name}
                </span>
              )}
            </div>
            <button onClick={copyScript}
              style={{ padding: "8px 16px", borderRadius: 9, background: copied ? "rgba(52,211,153,0.12)" : "rgba(77,184,255,0.11)", border: "1px solid " + (copied ? "rgba(52,211,153,0.4)" : "rgba(99,102,241,0.3)"), color: copied ? C.green : C.accentDim, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
              {copied ? "✓ Copied!" : "Copy Script"}
            </button>
          </div>
          {title && (
            <div style={{ background: "rgba(77,184,255,0.07)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
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
              <div style={{ fontSize: 13, color: "#aec5dd", lineHeight: 1.9, whiteSpace: "pre-wrap", maxHeight: 520, overflowY: "auto" }}>{body}</div>
            </div>
          )}
          {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!savedId ? (
              <button onClick={handleSave} disabled={saving}
                style={{ width: "100%", height: 48, borderRadius: 12, background: saving ? "rgba(77,184,255,0.07)" : "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", color: saving ? C.accentDim : "#fff", border: saving ? "1px solid rgba(99,102,241,0.2)" : "none", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: saving ? "none" : "0 4px 20px rgba(77,184,255,0.30)", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {saving ? "Saving..." : "✦ Save Script"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)", color: C.green, fontSize: 13, fontWeight: 700 }}>✓ Script saved</div>
                <a href={"/dashboard/scripts/" + savedId}
                  style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
                  Open in editor →
                </a>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setPhase("angles"); setScript(null); setSelectedAngle(null); setSavedId(null); }}
                style={{ flex: 1, height: 40, borderRadius: 10, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.13)", color: C.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ← Try another angle
              </button>
              <button onClick={() => { setPhase("niches"); setSelectedNiche(null); setScript(null); setSavedId(null); }}
                style={{ flex: 1, height: 40, borderRadius: 10, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.13)", color: C.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
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
            <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>Each angle fuses your niche with <strong style={{ color: "#9de4ff" }}>{selectedNiche.name}</strong> to reach both communities.</p>
          </div>
          {error && <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <VoiceSelect value={voiceId} onChange={setVoiceId} />
          <CompanionCtaToggle value={companionCta} onChange={setCompanionCta} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* The bridge sub-niche the user picked, always the first selectable option */}
            <div
              onClick={() => handlePickAngle({
                angle: selectedNiche.name,
                description: selectedNiche.hook || `Blend your topic with ${selectedNiche.name}.`,
                audience: selectedNiche.parentNiche || selectedNiche.name,
                titleSuggestion: selectedNiche.titlePreview || "",
                blendExplained: selectedNiche.hook || `${selectedNiche.name} (${selectedNiche.parentNiche})`,
              })}
              style={{ background: "rgba(77,184,255,0.07)", border: "1px solid rgba(77,184,255,0.45)", borderRadius: 14, padding: "18px 20px", cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "flex-start", gap: 16 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(77,184,255,0.12)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(77,184,255,0.07)"; }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(77,184,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15, color: "#9de4ff" }}>★</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#7ed8ff", letterSpacing: 0.6, marginBottom: 5 }}>YOUR PICK, {selectedNiche.parentNiche?.toUpperCase() || "BRIDGE"} BLEND</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright, marginBottom: 4, lineHeight: 1.3 }}>{selectedNiche.name}</div>
                {selectedNiche.hook && <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, marginBottom: 8 }}>{selectedNiche.hook}</div>}
                {selectedNiche.titlePreview && (
                  <div style={{ background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.13)", borderRadius: 7, padding: "6px 10px", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, marginRight: 6 }}>TITLE →</span>
                    <span style={{ fontSize: 11, color: "#9de4ff", fontWeight: 600 }}>{selectedNiche.titlePreview}</span>
                  </div>
                )}
                {(selectedNiche.proof || selectedNiche.rpmLabel) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {selectedNiche.proof && (() => {
                      const tone = selectedNiche.proof.tier === "proven"
                        ? { bg: "rgba(52,211,153,0.10)", bd: "rgba(52,211,153,0.3)", fg: "#34d399", icon: "✓" }
                        : selectedNiche.proof.tier === "emerging"
                          ? { bg: "rgba(251,146,60,0.10)", bd: "rgba(251,146,60,0.3)", fg: "#fb923c", icon: "📈" }
                          : { bg: "rgba(77,184,255,0.10)", bd: "rgba(77,184,255,0.3)", fg: "#9de4ff", icon: "🌊" };
                      return (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: tone.bg, border: `1px solid ${tone.bd}`, color: tone.fg }}>
                          {tone.icon} {selectedNiche.proof.label}
                        </span>
                      );
                    })()}
                    {selectedNiche.rpmLabel && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.28)", color: "#fde047" }}>
                        💰 {selectedNiche.rpmLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff" }}>→</div>
            </div>
            {angles.map((a, i) => (
              <div key={i} onClick={() => handlePickAngle(a)}
                style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: "18px 20px", cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "flex-start", gap: 16 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.cardHover; (e.currentTarget as HTMLElement).style.borderColor = C.borderAccent; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.card; (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(77,184,255,0.11)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 700, color: C.accentDim }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright, marginBottom: 4, lineHeight: 1.3 }}>{a.angle}</div>
                  <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, marginBottom: 8 }}>{a.description}</div>
                  <div style={{ background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.13)", borderRadius: 7, padding: "6px 10px", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, marginRight: 6 }}>TITLE →</span>
                    <span style={{ fontSize: 11, color: "#9de4ff", fontWeight: 600 }}>{a.titleSuggestion}</span>
                  </div>
                  {a.blendExplained && (
                    <div style={{ fontSize: 11, color: "#7ed8ff", fontStyle: "italic" }}>↬ {a.blendExplained}</div>
                  )}
                </div>
                <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff" }}>→</div>
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
        <div style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.22)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 12.5, color: "#a7e8cf", lineHeight: 1.55 }}>
            <strong style={{ color: C.green }}>Why bending works:</strong> saturated niches force you to compete on quality against thousands of channels. Intersections compete with almost no one, and pull from two recommendation pools at once.
          </div>
        </div>
        {brief && (
          <div style={{ background: "rgba(77,184,255,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 6 }}>ANALYZING FRAMEWORK FROM</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textBright, marginBottom: 8 }}>{brief.videoTitle}</div>
            {brief.titleFormula?.formula && (
              <div style={{ fontSize: 11, color: "#9de4ff" }}>Formula: {brief.titleFormula.formula}</div>
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
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(77,184,255,0.10)", color: "#9de4ff", border: "1px solid rgba(77,184,255,0.22)" }}>{n.parentNiche}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.textDim }}>{n.hook}</div>
                </div>
                <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", marginLeft: 16 }}>→</div>
              </div>
              {n.titlePreview && (
                <div style={{ background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.13)", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, marginBottom: 4 }}>TITLE PREVIEW (your formula + this blend)</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#9de4ff", lineHeight: 1.4 }}>{n.titlePreview}</div>
                </div>
              )}
              {n.algorithmNote && (
                <div style={{ fontSize: 11, color: "#a6c0d8", marginBottom: 10 }}>⚡ {n.algorithmNote}</div>
              )}
              {(n.proof || n.rpmLabel || n.poolCount) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {n.proof && (() => {
                    const tone = n.proof.tier === "proven"
                      ? { bg: "rgba(52,211,153,0.10)", bd: "rgba(52,211,153,0.3)", fg: "#34d399", icon: "✓" }
                      : n.proof.tier === "emerging"
                        ? { bg: "rgba(251,146,60,0.10)", bd: "rgba(251,146,60,0.3)", fg: "#fb923c", icon: "📈" }
                        : { bg: "rgba(77,184,255,0.10)", bd: "rgba(77,184,255,0.3)", fg: "#9de4ff", icon: "🌊" };
                    return (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: tone.bg, border: `1px solid ${tone.bd}`, color: tone.fg }}>
                        {tone.icon} {n.proof.label}
                      </span>
                    );
                  })()}
                  {n.rpmLabel && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.28)", color: "#fde047" }}>
                      💰 {n.rpmLabel}
                    </span>
                  )}
                  {n.poolCount ? (
                    <span title="A well-established niche with proven viral patterns" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.3)", color: "#c4b5fd" }}>
                      ✦ Strong niche match
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
        {niches.length > 0 && brief && (
          <div style={{ marginTop: 16, textAlign: "center", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
            <button onClick={() => fetchBridgeNiches(brief, seenNiches)} style={{ background: "none", border: "none", color: C.textDim, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Generate different sub-niches</button>
            {seenNiches.length >= 12 && (
              <button onClick={() => { setSeenNiches([]); fetchBridgeNiches(brief, []); }} style={{ background: "none", border: "none", color: "#7ed8ff", fontSize: 12, cursor: "pointer" }}>
                Seen a lot of options? ↺ Reset and start fresh
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
