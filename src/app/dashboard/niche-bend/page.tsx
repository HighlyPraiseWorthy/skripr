"use client";

import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import type { Niche } from "@/lib/data/niches";
import { NICHES, getAdjacentNiches, calculateBendPotential } from "@/lib/data/niches";

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
  badgeBg: "rgba(99,102,241,0.12)",
  badgeText: "#a5b4fc",
  inputBg: "#1a1a3a",
  inputBorder: "rgba(99,102,241,0.12)",
};

interface MagnetWordOption {
  id: string; word: string; grade: string;
  lift_range: string; why_it_works: string; category: string;
}

interface CrossoverIdea {
  title: string; description: string; viralPotential: number;
  competitionLevel: string; format: string; reasoning?: string;
  hookType?: string; framework?: string;
}

function sectionGlow(key: string) {
  const colors: Record<string, [string, string]> = {
    violet: ["#6366f1", "#a855f7"], blue: ["#3b82f6", "#06b6d4"],
  };
  const [c1, c2] = colors[key] || colors.violet;
  return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
}

export default function NicheBendPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { openSignIn } = useClerk();

  // shared state
  const [selectedNiche, setSelectedNiche] = useState("");
  const [adjacentNiches, setAdjacentNiches] = useState<Niche[]>([]);
  const [selectedAdjacent, setSelectedAdjacent] = useState("");
  const [ideas, setIdeas] = useState<CrossoverIdea[]>([]);
  const [magnetWords, setMagnetWords] = useState<MagnetWordOption[]>([]);
  const [selectedMagnetWord, setSelectedMagnetWord] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [magnetGradeFilter, setMagnetGradeFilter] = useState<string>("all");
  const [appliedMagnetWord, setAppliedMagnetWord] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // tab
  const [bendTab, setBendTab] = useState<"video" | "niches">("video");
  // competitor video tab
  const [sourceVideoUrl, setSourceVideoUrl] = useState("");
  const [sourceVideoTranscript, setSourceVideoTranscript] = useState("");
  const [sourceVideoTitle, setSourceVideoTitle] = useState("");
  const [sourceExtracting, setSourceExtracting] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const nicheOptions = NICHES.map(n => ({ value: n.id, label: n.name }));

  useEffect(() => {
    fetch("/api/user/plan").then(r => r.json()).then(d => setUserPlan(d.plan || "free")).catch(() => {});
    fetch("/api/magnet-words").then(r => r.json()).then(d => setMagnetWords(d.words || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (isLoaded && !isSignedIn) setError("auth");
  }, [isLoaded, isSignedIn]);

  function handleNicheSelect(nicheId: string) {
    setSelectedNiche(nicheId);
    setSelectedAdjacent("");
    setIdeas([]);
    setAppliedMagnetWord(null);
    setAdjacentNiches(getAdjacentNiches(nicheId));
  }

  async function extractSourceTranscript() {
    if (!sourceVideoUrl) return;
    setSourceExtracting(true);
    setSourceError(null);
    setSourceVideoTranscript("");
    setSourceVideoTitle("");
    try {
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: sourceVideoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to extract transcript");
      setSourceVideoTranscript(data.transcript || "");
      setSourceVideoTitle(data.title || "");
    } catch (e: any) {
      setSourceError(e.message || "Failed to extract transcript. Try pasting manually.");
    } finally {
      setSourceExtracting(false);
    }
  }

  async function generateIdeas() {
    if (bendTab === "niches" && (!selectedNiche || !selectedAdjacent)) return;
    if (bendTab === "video" && !sourceVideoTranscript) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/niche-bend/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nicheA: selectedNiche,
          nicheB: selectedAdjacent,
          viralMagnetWord: selectedMagnetWord || undefined,
          sourceVideoTranscript: bendTab === "video" ? (sourceVideoTranscript || undefined) : undefined,
          sourceVideoTitle: bendTab === "video" ? (sourceVideoTitle || undefined) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate ideas");
      setAppliedMagnetWord(selectedMagnetWord);
      setIdeas(data.ideas || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }

  const bendPotential = selectedNiche && selectedAdjacent
    ? calculateBendPotential(selectedNiche, selectedAdjacent) : 0;

  /* ══ AUTH GATE ══ */
  if (error === "auth") return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ borderRadius: 24, background: C.cardBg, border: `1px solid ${C.border}`, padding: 64, textAlign: "center", maxWidth: 480 }}>
        <p style={{ color: C.textBright, fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Sign in to use the Niche Bend Engine</p>
        <p style={{ color: C.textDim, fontSize: 15, marginBottom: 28 }}>Discover crossover opportunities and break out of your algorithm bubble</p>
        <button onClick={() => openSignIn?.()} style={{ padding: "12px 28px", borderRadius: 14, background: sectionGlow("violet"), color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer" }}>Sign In</button>
      </div>
    </div>
  );

  if (!isLoaded) return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: C.textDim, fontSize: 15 }}>Loading…</p>
    </div>
  );

  /* ══ PAGE ══ */
  return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
      <div aria-hidden style={{ position: "fixed", top: -160, right: -100, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden style={{ position: "fixed", bottom: -180, left: -120, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.09) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, marginBottom: 6 }}>Niche Bend Engine</h1>
          <p style={{ color: C.textDim, fontSize: 15, lineHeight: 1.6 }}>Find crossover opportunities between niches to break out of your algorithmic bubble</p>
        </div>

        {/* ── Main Tab Card (mirrors Scripts page) ── */}
        <div style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 24 }}>
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
            <button
              onClick={() => setBendTab("video")}
              style={{
                flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "14px 22px", cursor: "pointer",
                background: bendTab === "video" ? sectionGlow("violet") : "rgba(99,102,241,0.04)",
                border: "none",
                borderBottom: bendTab === "video" ? "2px solid transparent" : `2px solid ${C.border}`,
                color: bendTab === "video" ? "#fff" : C.textDim,
                fontSize: 14, fontWeight: bendTab === "video" ? 700 : 500,
                transition: "all 0.15s",
              }}
            >
              🎬 Competitor Video
            </button>
            <button
              onClick={() => setBendTab("niches")}
              style={{
                flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "14px 22px", cursor: "pointer",
                background: bendTab === "niches" ? sectionGlow("violet") : "rgba(99,102,241,0.04)",
                border: "none",
                borderBottom: bendTab === "niches" ? "2px solid transparent" : `2px solid ${C.border}`,
                color: bendTab === "niches" ? "#fff" : C.textDim,
                fontSize: 14, fontWeight: bendTab === "niches" ? 700 : 500,
                transition: "all 0.15s",
              }}
            >
              🔀 Niche Bend Engine
            </button>
          </div>

          {/* Tab content */}
          <div style={{ padding: "24px 24px 28px" }}>

            {/* ── Niche pickers (shared) ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 8 }}>YOUR NICHE</p>
                <select
                  value={selectedNiche}
                  onChange={e => handleNicheSelect(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 12, background: C.inputBg, color: C.text, fontSize: 14, fontWeight: 500, border: `1px solid ${C.inputBorder}`, outline: "none", cursor: "pointer", appearance: "auto" }}
                >
                  <option value="">Select your niche…</option>
                  {nicheOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {selectedNiche && (
                  <div style={{ marginTop: 10, padding: "10px 13px", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.10)", fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>
                    {NICHES.find(n => n.id === selectedNiche)?.description}
                    <div style={{ display: "flex", gap: 12, marginTop: 5, fontSize: 11 }}>
                      <span>Avg RPM: ${NICHES.find(n => n.id === selectedNiche)?.avgRPM}</span>
                      <span>Competition: {NICHES.find(n => n.id === selectedNiche)?.competitionLevel}</span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 8 }}>BRIDGE TO</p>
                <select
                  value={selectedAdjacent}
                  onChange={e => setSelectedAdjacent(e.target.value)}
                  disabled={!selectedNiche}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 12, background: !selectedNiche ? "#0d0d1f" : C.inputBg, color: !selectedNiche ? C.textDim : C.text, fontSize: 14, fontWeight: 500, border: `1px solid ${C.inputBorder}`, outline: "none", cursor: !selectedNiche ? "not-allowed" : "pointer", opacity: !selectedNiche ? 0.5 : 1, appearance: "auto" }}
                >
                  <option value="">Select adjacent niche…</option>
                  {adjacentNiches.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
                {selectedAdjacent && (
                  <div style={{ marginTop: 10, padding: "10px 13px", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.10)", fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>
                    {NICHES.find(n => n.id === selectedAdjacent)?.description}
                    <div style={{ display: "flex", gap: 12, marginTop: 5, fontSize: 11 }}>
                      <span>Avg RPM: ${NICHES.find(n => n.id === selectedAdjacent)?.avgRPM}</span>
                      <span>Competition: {NICHES.find(n => n.id === selectedAdjacent)?.competitionLevel}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bend Potential Score — only in Niche Bend Engine tab */}
            {bendTab === "niches" && selectedNiche && selectedAdjacent && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderRadius: 14, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.10)", marginBottom: 20 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.textBright, marginBottom: 2 }}>Bend Potential Score</p>
                  <p style={{ fontSize: 12, color: C.textDim }}>How strong is this crossover opportunity?</p>
                </div>
                <div style={{ fontSize: 34, fontWeight: 700, color: bendPotential >= 70 ? C.success : bendPotential >= 40 ? "#fbbf24" : C.danger, letterSpacing: -1, lineHeight: 1 }}>
                  {bendPotential}<span style={{ fontSize: 16, fontWeight: 400, color: C.textDim }}>/100</span>
                </div>
              </div>
            )}

            {/* ── Competitor Video tab content ── */}
            {bendTab === "video" && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ color: C.textDim, fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
                  Paste a viral competitor video URL. Skripr extracts the transcript, reverse-engineers the hook/structure/pacing, and transplants that exact framework into your niche crossover.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="url"
                    value={sourceVideoUrl}
                    onChange={e => setSourceVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    disabled={sourceExtracting}
                    style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: C.inputBg, color: C.text, fontSize: 13, border: `1px solid ${C.inputBorder}`, outline: "none", opacity: sourceExtracting ? 0.6 : 1 }}
                  />
                  <button
                    onClick={extractSourceTranscript}
                    disabled={sourceExtracting || !sourceVideoUrl}
                    style={{ padding: "10px 18px", borderRadius: 10, cursor: sourceExtracting || !sourceVideoUrl ? "not-allowed" : "pointer", background: sourceExtracting ? C.border : sectionGlow("blue"), color: "#fff", fontSize: 13, fontWeight: 600, border: "none", opacity: sourceExtracting || !sourceVideoUrl ? 0.5 : 1, whiteSpace: "nowrap" }}
                  >
                    {sourceExtracting ? "Extracting…" : "Extract Transcript"}
                  </button>
                </div>
                {sourceVideoTitle && (
                  <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.20)", fontSize: 13, color: C.textBright }}>
                    ✓ <span style={{ fontWeight: 700 }}>Source locked:</span> "{sourceVideoTitle}"
                    {sourceVideoTranscript && <span style={{ color: C.textDim, marginLeft: 8 }}>· {Math.max(1, Math.floor((sourceVideoTranscript.match(/\s/g) || []).length))} words</span>}
                  </div>
                )}
                {sourceError && (
                  <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.20)", fontSize: 12, color: C.danger }}>⚠ {sourceError}</div>
                )}
              </div>
            )}

            {/* ── Niche Bend Engine tab content ── */}
            {bendTab === "niches" && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ color: C.textDim, fontSize: 13, lineHeight: 1.6 }}>
                  Select both niches above and generate crossover ideas that bridge them — no reference video needed. Pure algorithmic crossover.
                </p>
              </div>
            )}

            {/* ── Viral Magnet (shared) ── */}
            {magnetWords.length > 0 && (
              <div style={{ marginBottom: 20, borderRadius: 14, border: "1px solid rgba(99,102,241,0.18)", background: "rgba(99,102,241,0.04)", padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 14 }}>🧲</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.textBright }}>Viral Magnet</span>
                  <span style={{ fontSize: 11, color: C.textDim }}>Pick a word to power every title</span>
                  {selectedMagnetWord && <button onClick={() => setSelectedMagnetWord(null)} style={{ marginLeft: "auto", fontSize: 10, color: C.textDim, background: "none", border: "none", cursor: "pointer" }}>Clear</button>}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {["all", "S", "A", "B", "C"].map(g => {
                    const gc: Record<string, string> = { all: "#818cf8", S: "#f59e0b", A: "#818cf8", B: "#34d399", C: "#64748b" };
                    const isActive = magnetGradeFilter === g;
                    const color = gc[g] || "#818cf8";
                    return (
                      <button key={g} onClick={() => setMagnetGradeFilter(g)} style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", border: isActive ? `1.5px solid ${color}` : "1px solid rgba(99,102,241,0.18)", background: isActive ? `${color}18` : "transparent", color: isActive ? color : C.textDim }}>
                        {g === "all" ? "All" : `${g}-tier`}
                      </button>
                    );
                  })}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: C.textDim, alignSelf: "center" }}>
                    {magnetWords.filter(w => magnetGradeFilter === "all" || w.grade === magnetGradeFilter).length} words
                  </span>
                </div>
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, maxHeight: 160, overflowY: "auto", filter: userPlan === "free" ? "blur(3px)" : "none", pointerEvents: userPlan === "free" ? "none" : "auto", userSelect: userPlan === "free" ? "none" : "auto" }}>
                    {magnetWords.filter(mw => magnetGradeFilter === "all" || mw.grade === magnetGradeFilter).map(mw => {
                      const gc = mw.grade === "S" ? "#f59e0b" : mw.grade === "A" ? "#818cf8" : mw.grade === "B" ? "#34d399" : "#64748b";
                      const isSel = selectedMagnetWord === mw.word;
                      return (
                        <button key={mw.id} onClick={() => setSelectedMagnetWord(isSel ? null : mw.word)} title={mw.why_it_works} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, cursor: "pointer", border: isSel ? `1.5px solid ${gc}` : "1px solid rgba(99,102,241,0.16)", background: isSel ? `${gc}18` : "rgba(0,0,0,0.10)" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isSel ? gc : C.textBright }}>{mw.word}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: `${gc}22`, color: gc }}>{mw.grade}</span>
                        </button>
                      );
                    })}
                  </div>
                  {userPlan === "free" && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, background: "rgba(10,10,20,0.60)", backdropFilter: "blur(1px)" }}>
                      <span style={{ fontSize: 15 }}>🔒</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.textBright }}>Starter+ feature</span>
                      <span style={{ fontSize: 11, color: C.textDim }}>Upgrade to use Viral Magnet</span>
                      <a href="/pricing" style={{ marginTop: 4, fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 7, background: "linear-gradient(135deg,#6366f1,#818cf8)", color: "#fff", textDecoration: "none" }}>Upgrade →</a>
                    </div>
                  )}
                </div>
                {selectedMagnetWord && (
                  <div style={{ marginTop: 10, fontSize: 11, color: C.textDim, padding: "6px 10px", borderRadius: 7, background: "rgba(99,102,241,0.06)" }}>
                    🧲 Every title will be crafted with <span style={{ color: C.textBright, fontWeight: 700 }}>"{selectedMagnetWord}"</span> naturally woven in
                  </div>
                )}
              </div>
            )}

            {/* ── Generate button ── */}
            <button
              onClick={generateIdeas}
              disabled={isLoading || (bendTab === "niches" ? (!selectedNiche || !selectedAdjacent) : !sourceVideoTranscript)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", borderRadius: 14, background: sectionGlow("violet"), color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: isLoading || (bendTab === "niches" ? (!selectedNiche || !selectedAdjacent) : !sourceVideoTranscript) ? "not-allowed" : "pointer", opacity: isLoading || (bendTab === "niches" ? (!selectedNiche || !selectedAdjacent) : !sourceVideoTranscript) ? 0.6 : 1, boxShadow: "0 0 22px rgba(99,102,241,0.30)", transition: "opacity 150ms, transform 150ms" }}
              onMouseEnter={e => { if (!isLoading) e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {isLoading ? "Generating…" : "✦ Generate Crossover Ideas"}
            </button>
            {error && <p style={{ color: C.danger, fontSize: 13, marginTop: 10 }}>{error}</p>}
          </div>
        </div>

        {/* ── Ideas list ── */}
        {ideas.length > 0 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.textBright, marginBottom: 8, letterSpacing: -0.3 }}>Crossover Ideas</h2>
            {appliedMagnetWord && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14, padding: "5px 12px", borderRadius: 8, background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.20)" }}>
                <span>🧲</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>Viral Magnet active:</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.textBright }}>"{appliedMagnetWord}"</span>
                <span style={{ fontSize: 11, color: C.textDim }}>— woven into every title</span>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ideas.map((idea, i) => (
                <div key={i} style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "20px 22px" }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textBright, marginBottom: 6 }}>{idea.title}</h3>
                    <p style={{ color: C.textDim, fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{idea.description}</p>
                    {idea.hookType && (
                      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                        <span style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(59,130,246,0.12)", color: "#60a5fa", fontSize: 11, fontWeight: 600 }}>Hook: {idea.hookType}</span>
                        <span style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(168,85,247,0.12)", color: "#c084fc", fontSize: 11, fontWeight: 600 }}>Framework: {idea.framework}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <span style={{ padding: "4px 10px", borderRadius: 8, background: idea.viralPotential >= 70 ? "rgba(52,211,153,0.12)" : idea.viralPotential >= 40 ? "rgba(251,191,36,0.12)" : "rgba(248,113,113,0.12)", color: idea.viralPotential >= 70 ? C.success : idea.viralPotential >= 40 ? "#fbbf24" : C.danger, fontSize: 12, fontWeight: 600 }}>
                        Viral Potential: {idea.viralPotential}%
                      </span>
                      <span style={{ padding: "4px 10px", borderRadius: 8, background: C.badgeBg, color: C.badgeText, fontSize: 12, fontWeight: 600 }}>{idea.format}</span>
                    </div>
                    
                    <a
                      href={`/dashboard/scripts/new?topic=${encodeURIComponent(idea.title)}&niche=${encodeURIComponent(selectedNiche)}&adjacent=${encodeURIComponent(selectedAdjacent)}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
                    >
                      ✦ Generate Script
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
