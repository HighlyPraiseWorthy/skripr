"use client";
import { useState, useEffect } from "react";
import GenerationProgress from "@/components/GenerationProgress";
import { joinHookBody, bodyStartsWithHook } from "@/lib/script-text";
import { VoiceSelect } from "@/components/VoiceSelect";
import { CompanionCtaToggle, SoftCtaToggle } from "@/components/CompanionCtaToggle";
import StorytellingPicker from "@/components/StorytellingPicker";
import ResearchStep from "@/components/ResearchStep";

const C = {
  bg: "#080c12", card: "#0d1520", cardHover: "#111d2e",
  border: "rgba(255,255,255,0.07)", borderAccent: "rgba(77,184,255,0.30)",
  accent: "#1a8fd1", accentDim: "#4db8ff", textBright: "#e8edf5",
  textDim: "#a6c0d8", green: "#34d399",
};

const EMOTION_COLOR: Record<string, string> = {
  curiosity: "#4db8ff", fear: "#f87171", anger: "#fb923c",
  excitement: "#34d399", surprise: "#9de4ff",
};

type Phase = "loading" | "pick-case" | "angles" | "research" | "storytelling" | "generating" | "result";
type Angle = { hookType: string; hookPremise: string; titleSuggestion: string; whyItWorks: string; audienceEmotion: string; };
type Brief = { topic: string; niche: string; videoLength: string; hookTypeFilter?: string | null; voiceProfileId?: string | null; angles: Angle[]; };

const Spinner = ({ label, sub }: { label: string; sub?: string }) => (
  <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, fontFamily: "system-ui, sans-serif" }}>
    <div style={{ width: 44, height: 44, border: "3px solid rgba(77,184,255,0.15)", borderTop: "3px solid #4db8ff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <div style={{ fontSize: 15, fontWeight: 600, color: C.accentDim }}>{label}</div>
    {sub && <div style={{ fontSize: 12, color: C.textDim }}>{sub}</div>}
    <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
  </div>
);

export default function ScriptBriefPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<Angle | null>(null);
  const [sourceMaterial, setSourceMaterial] = useState<string>("");
  const [script, setScript] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedMagnet, setSelectedMagnet] = useState<number | null>(null);
  const [appliedMagnetTitle, setAppliedMagnetTitle] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [companionCta, setCompanionCta] = useState(false);
  const [softCta, setSoftCta] = useState(false);
  const [sourceVerdict, setSourceVerdict] = useState<string | null>(null);
  const [topicKind, setTopicKind] = useState<string | null>(null);
  // Grounding resolved BEFORE the hook cards are written. Without this the cards
  // are composed with no knowledge of the real case and hedge ("someone who
  // allegedly sold satellite technology") instead of naming it.
  const [grounding, setGrounding] = useState<any | null>(null);
  const [groundCases, setGroundCases] = useState<any[]>([]);
  const [groundedOn, setGroundedOn] = useState<any | null>(null);
  const [groundNote, setGroundNote] = useState("");
  const [userPlan, setUserPlan] = useState<string>("free");

  useEffect(() => {
    fetch("/api/user/plan").then(r => r.json()).then(d => setUserPlan(d.plan || "free")).catch(() => {});
    try {
      const stored = sessionStorage.getItem("skripr_script_brief");
      if (!stored) { window.location.href = "/dashboard/scripts/new"; return; }
      const b: Brief = JSON.parse(stored);
      setBrief(b);
      if (b.voiceProfileId) setVoiceId(b.voiceProfileId);
      // Restore grounding so a reload does not lose the case the cards were built on.
      const gb = (b as any).grounding;
      if (gb) { setGrounding(gb); if (gb.caseName) setGroundedOn({ name: gb.caseName, summary: gb.caseSummary, when: gb.when, sources: gb.sources || [] }); }
      if ((b as any).topicKind) setTopicKind((b as any).topicKind);
      if ((b as any).sourceVerdict) setSourceVerdict((b as any).sourceVerdict);
      if (b.angles?.length > 0) setPhase("angles");
      // A case was already chosen on the previous screen: honor it, do not
      // re-resolve and ask again. Just write the hook cards on that case.
      else if (gb?.caseName) fetchAngles(b, gb);
      else groundThenAngles(b);
    } catch { window.location.href = "/dashboard/scripts/new"; }
  }, []);

  // Look it up first, then write the cards. If several real cases fit the title,
  // ask which one before writing anything, since composing five cards about the
  // wrong case wastes the call and misleads the creator.
  async function groundThenAngles(b: Brief) {
    setPhase("loading");
    let g: any = null;
    try {
      const gr = await fetch("/api/research/find", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: b.topic, niche: b.niche }),
      });
      const gd = await gr.json();
      if (gr.ok) {
        g = {
          kind: gd.kind, verdict: gd.verdict,
          facts: (gd.facts || []).map((f: any) => f?.source ? `${f.fact} (source: ${f.source})` : f?.fact).filter(Boolean),
        };
        setTopicKind(gd.kind || null);
        setSourceVerdict(gd.verdict || null);
        setGroundNote(typeof gd.verdictNote === "string" ? gd.verdictNote : "");
        const cands = Array.isArray(gd.candidates) ? gd.candidates : [];
        if (gd.kind === "event" && cands.length > 1) {
          setGrounding(g); setGroundCases(cands); setPhase("pick-case");
          return;
        }
        // No case identified: drop the facts rather than build cards on material
        // that may describe a different story than the title.
        if (gd.kind === "event" && cands.length === 0) {
          g = { ...g, facts: [] };
        }
        if (gd.kind === "event" && cands.length === 1) {
          const c = cands[0];
          setGroundedOn(c);
          g = { ...g, caseName: c.name, caseSummary: c.summary, when: c.when, sources: c.sources || [] };
          // Re-research the identified case: the hook cards may only use facts they
          // are given, so case-specific facts raise the ceiling on their concreteness.
          try {
            const rr = await fetch("/api/research/find", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "deepen", caseName: c.name, caseSummary: c.summary || "", niche: b.niche }),
            });
            const rd = await rr.json();
            if (rr.ok && Array.isArray(rd.facts) && rd.facts.length) {
              g.facts = rd.facts.map((f: any) => f?.source ? `${f.fact} (source: ${f.source})` : f?.fact).filter(Boolean);
            }
          } catch { /* keep the topic-level facts */ }
        }
        setGrounding(g);
      }
    } catch { /* grounding is best effort, the cards still get written */ }
    await fetchAngles(b, g);
  }

  async function fetchAngles(b: Brief, g?: any) {
    setPhase("loading");
    try {
      const res = await fetch("/api/suggest-script-angles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: b.topic, niche: b.niche, videoLength: b.videoLength, hookTypeFilter: b.hookTypeFilter || null, viralMagnetWord: (b as any).viralMagnetWord || null, grounding: (g ?? grounding) || undefined, lockedTitle: (b as any).lockTitle ? b.topic : undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const updated = { ...b, angles: data.angles ?? [], grounding: (g ?? grounding) || undefined, topicKind: topicKind || undefined, sourceVerdict: sourceVerdict || undefined };
      sessionStorage.setItem("skripr_script_brief", JSON.stringify(updated));
      setBrief(updated);
      setPhase("angles");
    } catch (e: any) { setError(e?.message || "Failed to generate angles"); setPhase("angles"); }
  }

  // The grounded case, formatted for the script prompt, so skipping the research
  // step does not discard the grounding the hook cards were built on.
  function buildUpstreamSourceMaterial(): string {
    if (!groundedOn && !grounding?.facts?.length) return "";
    const parts: string[] = [];
    if (groundedOn) {
      parts.push(`REAL CASE THIS VIDEO IS ABOUT: ${groundedOn.name}${groundedOn.when ? ` (${groundedOn.when})` : ""}`);
      if (groundedOn.summary) parts.push(groundedOn.summary);
      if (Array.isArray(groundedOn.sources) && groundedOn.sources.length) parts.push(`(sources: ${groundedOn.sources.join(", ")})`);
    }
    if (grounding?.facts?.length) parts.push(grounding.facts.map((f: string) => `- ${f}`).join("\n"));
    return parts.join("\n");
  }

  // Pick an angle → research step → storytelling step → generate.
  function handlePickAngle(angle: Angle) {
    if (!brief) return;
    setSelectedAngle(angle); setError(null);
    setSelectedMagnet(null); setAppliedMagnetTitle(null);
    setPhase("research");
  }

  async function generateWithStory(storytellingMode: string, storytellingTechniques: string[]) {
    const angle = selectedAngle;
    if (!brief || !angle) return;
    setPhase("generating"); setError(null);
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: "", topic: brief.topic, niche: brief.niche,
          videoLength: brief.videoLength || "medium",
          targetMinutes: (brief as any).targetMinutes ?? undefined,
          viralMagnetWord: (brief as any).viralMagnetWord || undefined,
          voiceProfileId: voiceId || undefined,
          companionCta,
          softCta,
          sourceVerdict: sourceVerdict || undefined,
          topicKind: topicKind || undefined,
          hookType: angle.hookType,
          angle: `Hook type: ${angle.hookType}. Opening hook to adapt: "${angle.hookPremise}". Suggested title: ${angle.titleSuggestion}`,
          storytellingMode, storytellingTechniques,
          sourceMaterial: [buildUpstreamSourceMaterial(), sourceMaterial].filter(Boolean).join("\n\n") || undefined,
          selectedTitle: ((brief as any)?.lockTitle ? brief?.topic : angle.titleSuggestion) || undefined,
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
      if (!appliedMagnetTitle && (script as any).savedId) { setSavedId((script as any).savedId); return; }
      const t = appliedMagnetTitle || script.title || selectedAngle?.titleSuggestion || "Untitled Script";
      const h = script.hook || "";
      const b = script.fullScript || script.script || script.body || script.content || "";
      const content = joinHookBody(h, b);
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
    const b = script.fullScript || script.script || script.body || script.content || "";
    if (script.hook && !bodyStartsWithHook(b, script.hook)) parts.push("HOOK:\n" + script.hook);
    if (b) parts.push(b);
    navigator.clipboard.writeText(parts.join("\n\n"));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  if (phase === "research" && selectedAngle) return (
    <ResearchStep
      topic={brief?.topic || selectedAngle.titleSuggestion || ""}
      niche={brief?.niche}
      angle={selectedAngle.hookPremise || selectedAngle.titleSuggestion}
      angleLabel={selectedAngle.titleSuggestion || selectedAngle.hookPremise}
      onContinue={(sm, v, k) => { setSourceMaterial(sm || ""); setSourceVerdict(v || null); setTopicKind(k || null); setPhase("storytelling"); }}
      onBack={() => setPhase("angles")}
    />
  );

  if (phase === "storytelling" && selectedAngle) return (
    <StorytellingPicker
      topic={brief?.topic || selectedAngle.titleSuggestion || ""}
      niche={brief?.niche}
      angle={selectedAngle.hookPremise || selectedAngle.titleSuggestion}
      angleLabel={selectedAngle.titleSuggestion || selectedAngle.hookPremise}
      onGenerate={generateWithStory}
      onBack={() => setPhase("research")}
    />
  );

  if (phase === "loading") return <Spinner label="Reading up on your topic..." sub="Finding the real case, then building hook angles around it" />;

  // Several real cases fit this title, so ask before writing five cards about the
  // wrong one. This runs BEFORE the hook cards exist, which is the whole point.
  if (phase === "pick-case") return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, letterSpacing: -0.3, marginBottom: 6 }}>Which real case is this about?</h1>
        <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.6, marginBottom: 4 }}>
          Your topic matches more than one documented story. Pick one and every hook angle will be built on it, with its real names and dates.
        </p>
        {groundNote && <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.6, marginBottom: 16 }}>{groundNote}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {groundCases.map((c: any, i: number) => (
            <button key={i}
              onClick={() => {
                setGroundedOn(c);
                setSourceVerdict("documented");
                const g: any = { ...(grounding || {}), caseName: c.name, caseSummary: c.summary, when: c.when, sources: c.sources || [] };
                setGrounding(g);
                if (brief) {
                  const b = brief;
                  void (async () => {
                    setPhase("loading");
                    try {
                      const rr = await fetch("/api/research/find", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "deepen", caseName: c.name, caseSummary: c.summary || "", niche: b.niche }),
                      });
                      const rd = await rr.json();
                      if (rr.ok && Array.isArray(rd.facts) && rd.facts.length) {
                        g.facts = rd.facts.map((f: any) => f?.source ? `${f.fact} (source: ${f.source})` : f?.fact).filter(Boolean);
                        setGrounding({ ...g });
                      }
                    } catch { /* keep the topic-level facts */ }
                    await fetchAngles(b, g);
                  })();
                }
              }}
              style={{ textAlign: "left", cursor: "pointer", padding: "14px 16px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, color: C.textBright }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{c.name}{c.when && <span style={{ color: C.textDim, fontWeight: 500 }}> · {c.when}</span>}</div>
              {c.summary && <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, marginTop: 4 }}>{c.summary}</div>}
              {c.whyItFits && <div style={{ fontSize: 12.5, color: C.accent, lineHeight: 1.5, marginTop: 5 }}>Fits your title: {c.whyItFits}</div>}
              {Array.isArray(c.sources) && c.sources.length > 0 && (
                <div style={{ fontSize: 11, color: "#7ed8ff", marginTop: 5, wordBreak: "break-all" }}>{c.sources.slice(0, 2).join("  ")}</div>
              )}
            </button>
          ))}
        </div>
        <button onClick={() => { if (brief) void fetchAngles(brief, grounding); }}
          style={{ marginTop: 16, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12.5, color: C.textDim }}>
          None of these, continue without a specific case
        </button>
      </div>
    </div>
  );
  if (phase === "generating") return (
    <GenerationProgress
      label="Building your script..."
      sub={(selectedAngle?.hookType || "") + " hook"}
      expectedMs={45000 + ((brief as any)?.targetMinutes || 5) * 5000}
    />
  );

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
              {selectedAngle && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: "rgba(77,184,255,0.11)", color: C.accentDim, border: "1px solid rgba(77,184,255,0.22)" }}>{selectedAngle.hookType}</span>}
            </div>
            <button onClick={copyScript} style={{ padding: "8px 16px", borderRadius: 9, background: copied ? "rgba(52,211,153,0.12)" : "rgba(77,184,255,0.11)", border: "1px solid " + (copied ? "rgba(52,211,153,0.4)" : "rgba(99,102,241,0.3)"), color: copied ? C.green : C.accentDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {copied ? "Copied!" : "Copy Script"}
            </button>
          </div>

          {title && (
            <div style={{ background: "rgba(77,184,255,0.07)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 6 }}>TITLE</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright, lineHeight: 1.4 }}>{title}</div>
            </div>
          )}

          {/* Self-review corrections: what the accuracy pass changed before you saw it. */}
          {Array.isArray(script.reviewChanges) && script.reviewChanges.length > 0 && (
            <div style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: 0.4, marginBottom: 7 }}>AUTO-CORRECTED FOR ACCURACY</div>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                {script.reviewChanges.map((c: string, i: number) => (
                  <li key={i} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Deterministic fact scan: dates and dollar figures in the script that
              were not in the researched source material. Verify these before voice. */}
          {Array.isArray(script.factCheck?.unverified) && script.factCheck.unverified.length > 0 && (
            <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", letterSpacing: 0.4, marginBottom: 5 }}>VERIFY BEFORE PUBLISHING</div>
              <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.6, marginBottom: 9 }}>
                These dates or figures are in the script but were not in the sourced research, so they may be the model&apos;s own recall. Check each against a source before you record.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {script.factCheck.unverified.map((u: string, i: number) => (
                  <span key={i} style={{ fontSize: 12, fontWeight: 600, color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 7, padding: "4px 10px" }}>{u}</span>
                ))}
              </div>
            </div>
          )}

          {/* Viral Magnet */}
          {script.magnetSuggestions && script.magnetSuggestions.length > 0 && (
            <div style={{ marginBottom: 16, borderRadius: 14, border: "1px solid rgba(77,184,255,0.18)", background: "rgba(77,184,255,0.04)", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 15 }}>&#129522;</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.textBright }}>Viral Magnet</span>
                <span style={{ fontSize: 11, color: C.textDim }}>Add one word to pull more clicks</span>
                {userPlan === "free" && (
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "rgba(77,184,255,0.11)", color: "#7ed8ff" }}>STARTER+</span>
                )}
              </div>
              {userPlan === "free" ? (
                // Sell at the wall: preview the top suggested words but gate applying.
                <div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    {script.magnetSuggestions.slice(0, 3).map((s: any, i: number) => {
                      const gc: Record<string, string> = { S: "#f59e0b", A: "#4db8ff", B: "#34d399", C: "#a6c0d8" };
                      const col = gc[s.word?.grade] || C.accentDim;
                      return (
                        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 8, border: `1px solid ${col}55`, background: `${col}14` }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.textBright }}>{s.word?.word}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: `${col}22`, color: col }}>{s.word?.grade}</span>
                        </span>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: 12 }}>
                    Bake a proven word into your title, our AI rewrites it to pull more clicks.
                  </p>
                  <a href="/dashboard/settings" style={{ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "8px 18px", borderRadius: 8, background: "linear-gradient(135deg,#0e6499,#1a8fd1)", color: "#fff", textDecoration: "none" }}>Get Starter →</a>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: selectedMagnet !== null ? 10 : 0 }}>
                    {script.magnetSuggestions.map((s: any, i: number) => {
                      const gc: Record<string, string> = { S: "#f59e0b", A: "#4db8ff", B: "#34d399", C: "#a6c0d8" };
                      const active = selectedMagnet === i;
                      const col = gc[s.word?.grade] || C.accentDim;
                      return (
                        <button key={i} onClick={() => setSelectedMagnet(active ? null : i)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: active ? `1.5px solid ${col}` : "1px solid rgba(77,184,255,0.16)", background: active ? "rgba(77,184,255,0.11)" : "transparent", color: active ? col : C.textDim, transition: "all 0.15s" }}>
                          {s.word?.word} <span style={{ fontSize: 10, opacity: 0.8 }}>{s.word?.grade}</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedMagnet !== null && script.magnetSuggestions[selectedMagnet] && (() => {
                    const s = script.magnetSuggestions[selectedMagnet];
                    const gc: Record<string, string> = { S: "#f59e0b", A: "#4db8ff", B: "#34d399", C: "#a6c0d8" };
                    const col = gc[s.word?.grade] || C.accentDim;
                    const isApplied = appliedMagnetTitle === s.injectedTitle;
                    return (
                      <div style={{ borderRadius: 10, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(77,184,255,0.12)", padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: col }}>{s.word?.word}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: col + "22", color: col }}>{s.word?.grade}-tier</span>
                          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: C.green }}>{s.word?.lift_range} lift</span>
                        </div>
                        <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: 10 }}>{s.word?.why_it_works}</p>
                        <div style={{ borderRadius: 8, background: "rgba(77,184,255,0.05)", padding: "8px 12px", marginBottom: 10, fontSize: 12 }}>
                          <div style={{ color: C.textDim, marginBottom: 4 }}>Before: {script.title}</div>
                          <div style={{ color: C.textBright, fontWeight: 600 }}>After: {s.injectedTitle}</div>
                        </div>
                        <button onClick={() => setAppliedMagnetTitle(isApplied ? null : s.injectedTitle)} style={{ width: "100%", padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: isApplied ? "rgba(248,113,113,0.10)" : "linear-gradient(135deg,#0e6499,#1a8fd1)", color: isApplied ? "#f87171" : "#fff" }}>
                          {isApplied ? "Remove Viral Magnet" : "Apply Viral Magnet"}
                        </button>
                      </div>
                    );
                  })()}
                </>
              )}
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
              <div style={{ fontSize: 13, color: "#aec5dd", lineHeight: 1.9, whiteSpace: "pre-wrap", maxHeight: 520, overflowY: "auto" }}>{body}</div>
            </div>
          )}
          {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!savedId ? (
              <button onClick={handleSave} disabled={saving} style={{ width: "100%", height: 48, borderRadius: 12, background: saving ? "rgba(77,184,255,0.07)" : "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", color: saving ? C.accentDim : "#fff", border: saving ? "1px solid rgba(99,102,241,0.2)" : "none", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {saving ? "Saving..." : "Save Script"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)", color: C.green, fontSize: 13, fontWeight: 700 }}>&#10003; Saved!</div>
                <a href={"/dashboard/scripts/" + savedId} style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Open in editor</a>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setPhase("angles"); setScript(null); setSelectedAngle(null); setSavedId(null); setAppliedMagnetTitle(null); }} style={{ flex: 1, height: 40, borderRadius: 10, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.13)", color: C.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Try another hook</button>
              <a href="/dashboard/scripts/new" style={{ flex: 1, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.13)", color: C.textDim, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>New topic</a>
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
          <div style={{ background: "rgba(77,184,255,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 0.5 }}>TOPIC</div>
              {brief.hookTypeFilter && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(77,184,255,0.13)", color: C.accentDim }}>{brief.hookTypeFilter}</span>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>{brief.topic}</div>
            {brief.niche && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{brief.niche}</div>}
            {/* What these cards were actually built on. */}
            {groundedOn && (
              <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, color: C.green }}>GROUNDED ON A REAL CASE</div>
                <div style={{ fontSize: 12.5, color: C.textBright, marginTop: 2 }}>
                  {groundedOn.name}{groundedOn.when ? ` · ${groundedOn.when}` : ""}
                </div>
                {groundCases.length > 1 && (
                  <button onClick={() => setPhase("pick-case")}
                    style={{ marginTop: 4, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: C.accent, fontWeight: 600 }}>
                    change
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {error && <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <VoiceSelect value={voiceId} onChange={setVoiceId} />
        <CompanionCtaToggle value={companionCta} onChange={setCompanionCta} />
              <SoftCtaToggle value={softCta} onChange={setSoftCta} />

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
                  <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff" }}>&#8594;</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.textBright, lineHeight: 1.5, marginBottom: 10 }}>&#8220;{a.hookPremise}&#8221;</div>
                {!(brief as any)?.lockTitle && (
                  <div style={{ background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.13)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, marginBottom: 4 }}>TITLE</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#9de4ff", lineHeight: 1.4 }}>{a.titleSuggestion}</div>
                  </div>
                )}
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
