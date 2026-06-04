"use client";
import { useState, useEffect } from "react";

interface MagnetWord {
  id: string; word: string; grade: string;
  category: string; lift_range: string; why_it_works: string;
}

interface TitleResult {
  title: string;
  type: "same-formula" | "new-formula";
  formula: string;
  magnetWord: string;
  whyItWorks: string;
}

interface GenerateResult {
  detectedFormula: string;
  titles: TitleResult[];
}

const C = {
  bg: "#0b0b17", cardBg: "#12122a", border: "rgba(99,102,241,0.12)",
  accent: "#6366f1", text: "#e2e8f0", textDim: "#64748b",
  textBright: "#f1f5f9", badgeBg: "rgba(99,102,241,0.12)", badgeText: "#a5b4fc",
};

const gradeColors: Record<string, string> = { S: "#f59e0b", A: "#818cf8", B: "#34d399", C: "#64748b" };

export default function ViralMagnetPage() {
  const [words, setWords] = useState<MagnetWord[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/plan").then(r=>r.json()).then(d=>setPlan(d.plan||"free")).catch(()=>setPlan("free"));
    fetch("/api/magnet-words").then(r => r.json()).then(d => setWords(d.words || [])).catch(() => {});
    try {
      const saved = localStorage.getItem("skripr_vm_state");
      if (!saved) return;
      const s = JSON.parse(saved);
      if (s.title) setTitle(s.title);
      if (s.script) setScript(s.script);
      if (s.selected) setSelected(s.selected);
      if (s.result) setResult(s.result);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("skripr_vm_state", JSON.stringify({ title, script, selected, result })); } catch {}
  }, [title, script, selected, result]);

  const toggleWord = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const selectedWords = words.filter(w => selected.includes(w.id));

  const handleGenerate = async () => {
    if (!title.trim() || selectedWords.length === 0) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/viral-magnet-titles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), script: script.trim() || undefined, magnetWords: selectedWords.map(w => w.word) }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const copyTitle = (t: string) => {
    navigator.clipboard.writeText(t).catch(() => {});
    setCopied(t); setTimeout(() => setCopied(null), 2000);
  };

  const sameFormula = result?.titles.filter(t => t.type === "same-formula") || [];
  const newFormula  = result?.titles.filter(t => t.type === "new-formula") || [];
  const canGenerate = !loading && title.trim().length > 0 && selectedWords.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 28 }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>🧲</span>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, margin: 0 }}>Viral Magnet Titles</h1>
          </div>
          <p style={{ color: C.textDim, fontSize: 14, margin: 0 }}>
            Add one high-pull word to any title and generate 8 click-optimized variations
          </p>
        </div>

        {/* ── Input card ── */}
        <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px", marginBottom: 20 }}>

          {/* Title */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Your Video Title <span style={{ color: "#f87171" }}>*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. How I Lost 20 Pounds in 90 Days"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 12,
                background: "#1a1a3a", color: C.text, fontSize: 14, fontWeight: 500,
                border: `1px solid ${C.border}`, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Script */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              Script / Description{" "}
              <span style={{ color: C.textDim, fontWeight: 400 }}>(optional — helps AI understand your video)</span>
            </label>
            <textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder="Paste your script, outline, or a brief description of what your video covers..."
              rows={3}
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 12,
                background: "#1a1a3a", color: C.text, fontSize: 14,
                border: `1px solid ${C.border}`, outline: "none",
                resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Word picker */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                Select 1–3 Viral Magnet Words <span style={{ color: "#f87171" }}>*</span>
              </label>
              <span style={{ fontSize: 11, color: selected.length === 3 ? "#fb923c" : C.textDim, fontWeight: 600 }}>
                {selected.length}/3 selected
              </span>
            </div>

            {words.length === 0 ? (
              <div style={{ height: 44, background: "rgba(255,255,255,0.03)", borderRadius: 10 }} />
            ) : (
              (["S", "A", "B", "C"] as const).map(grade => {
                const gradeWords = words.filter(w => w.grade === grade);
                if (!gradeWords.length) return null;
                const gc = gradeColors[grade];
                return (
                  <div key={grade} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: gc, letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>
                      {grade}-Tier · {grade === "S" ? "Exceptional" : grade === "A" ? "Strong" : grade === "B" ? "Good" : "Standard"}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {gradeWords.map(w => {
                        const isSel = selected.includes(w.id);
                        const isDisabled = !isSel && selected.length >= 3;
                        return (
                          <button
                            key={w.id}
                            onClick={() => toggleWord(w.id)}
                            disabled={isDisabled}
                            title={`${w.why_it_works} · ${w.lift_range} CTR lift`}
                            style={{
                              padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                              cursor: isDisabled ? "not-allowed" : "pointer",
                              border: isSel ? `1.5px solid ${gc}` : "1px solid rgba(99,102,241,0.18)",
                              background: isSel ? `${gc}22` : "transparent",
                              color: isSel ? gc : isDisabled ? "rgba(148,163,184,0.3)" : C.textDim,
                              opacity: isDisabled ? 0.4 : 1,
                              transition: "all 0.1s",
                            }}
                          >
                            {w.word}
                            <span style={{ marginLeft: 5, fontSize: 9, opacity: 0.65 }}>{w.lift_range}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}

            {/* Selected summary */}
            {selectedWords.length > 0 && (
              <div style={{ marginTop: 10, padding: "9px 14px", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.14)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>Selected:</span>
                {selectedWords.map(w => (
                  <span key={w.id} style={{ fontSize: 11, fontWeight: 700, color: gradeColors[w.grade], padding: "2px 8px", borderRadius: 6, background: `${gradeColors[w.grade]}18` }}>
                    {w.word} <span style={{ opacity: 0.6 }}>{w.grade}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            style={{
              width: "100%", height: 52, marginTop: 20,
              background: canGenerate ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" : "rgba(99,102,241,0.25)",
              color: "#fff", border: "none", borderRadius: 14,
              fontSize: 15, fontWeight: 700,
              cursor: canGenerate ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: canGenerate ? "0 4px 24px rgba(99,102,241,0.35)" : "none",
              transition: "all 0.15s",
            }}
          >
            {loading ? "⟳ Generating 8 titles…" : "✦ Generate Viral Titles"}
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ borderRadius: 14, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", padding: "14px 18px", marginBottom: 20 }}>
            <p style={{ color: "#f87171", fontSize: 14, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div>
            {result.detectedFormula && (
              <div style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)" }}>
                <span style={{ fontSize: 11, color: C.textDim }}>Original formula detected:</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc" }}>{result.detectedFormula}</span>
              </div>
            )}

            {sameFormula.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <SectionDivider label="Same Formula — Upgraded" color="#6366f1" />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sameFormula.map((t, i) => <TitleCard key={i} t={t} copied={copied} onCopy={copyTitle} />)}
                </div>
              </div>
            )}

            {newFormula.length > 0 && (
              <div>
                <SectionDivider label="New Formulas — Fresh Angles" color="#8b5cf6" />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {newFormula.map((t, i) => <TitleCard key={i} t={t} copied={copied} onCopy={copyTitle} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionDivider({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <div style={{ height: 1, flex: 1, background: "rgba(99,102,241,0.13)" }} />
      <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ height: 1, flex: 1, background: "rgba(99,102,241,0.13)" }} />
    </div>
  );
}

function TitleCard({ t, copied, onCopy }: { t: TitleResult; copied: string | null; onCopy: (s: string) => void }) {
  const isCopied = copied === t.title;
  if (plan === "free") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: "40px 20px" }}>
        <div style={{ background: "#12122a", border: "1px solid rgba(99,102,241,0.35)", borderRadius: 18, padding: "44px 48px", maxWidth: 440, textAlign: "center" }}>
          <div style={{ fontSize: 38, marginBottom: 16 }}>🔒</div>
          <h2 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}>Starter Plan Required</h2>
          <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, margin: "0 0 28px" }}>Viral Magnet Titles is available on Starter and above. Unlock word-tier analysis, S/A/B/C grade breakdowns, and AI title generation.</p>
          <a href="/dashboard/settings" style={{ display: "inline-block", background: "linear-gradient(135deg,#6366f1,#7c3aed)", color: "white", padding: "13px 32px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>Upgrade to Starter →</a>
        </div>
      </div>
    );
  }


  return (
    <div style={{ borderRadius: 14, background: "#12122a", border: "1px solid rgba(99,102,241,0.13)", padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", margin: "0 0 7px 0", lineHeight: 1.4 }}>{t.title}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
            🧲 {t.magnetWord}
          </span>
          {t.formula && <span style={{ fontSize: 10, color: "#475569", fontStyle: "italic" }}>{t.formula}</span>}
        </div>
        {t.whyItWorks && (
          <p style={{ fontSize: 11, color: "#475569", margin: "6px 0 0 0", lineHeight: 1.5 }}>{t.whyItWorks}</p>
        )}
      </div>
      <button
        onClick={() => onCopy(t.title)}
        style={{
          flexShrink: 0, padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600,
          cursor: "pointer",
          background: isCopied ? "rgba(52,211,153,0.12)" : "rgba(99,102,241,0.10)",
          border: `1px solid ${isCopied ? "rgba(52,211,153,0.3)" : "rgba(99,102,241,0.22)"}`,
          color: isCopied ? "#34d399" : "#818cf8",
          transition: "all 0.12s",
        }}
      >
        {isCopied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}
