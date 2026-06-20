"use client";
import { useState, useEffect } from "react";

interface MagnetWord {
  id: string; word: string; grade: string;
  category: string; lift_range: string; why_it_works: string;
  proofCount?: number; topViews?: number;
}

interface MagnetPair { word: string; why: string; proofCount?: number; }

interface TitleResult {
  title: string;
  type: "same-formula" | "new-formula";
  formula: string;
  magnetWords?: string[];
  magnetWord?: string;
  whyItWorks: string;
}

interface GenerateResult {
  detectedFormula: string;
  titles: TitleResult[];
}

const C = {
  bg: "#080c12", cardBg: "#0d1520", border: "rgba(77,184,255,0.11)",
  accent: "#1a8fd1", text: "#e8edf5", textDim: "#a6c0d8",
  textBright: "#e8edf5", badgeBg: "rgba(77,184,255,0.11)", badgeText: "#7ed8ff",
};

const gradeColors: Record<string, string> = { S: "#f59e0b", A: "#4db8ff", B: "#34d399", C: "#a6c0d8" };

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
  const [trending, setTrending] = useState<MagnetWord[]>([]);
  const [pairs, setPairs] = useState<MagnetPair[]>([]);
  const [pairsFor, setPairsFor] = useState<string | null>(null);
  const [pairsLoading, setPairsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/user/plan").then(r=>r.json()).then(d=>setPlan(d.plan||"free")).catch(()=>setPlan("free"));
    fetch("/api/magnet-words").then(r => r.json()).then(d => { setWords(d.words || []); setTrending(d.trending || []); }).catch(() => {});
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

  // #1 Pairing: suggest the next word that amplifies the WHOLE current
  // selection. Updates as words are added/removed; hides once 3 are picked.
  const selKey = selected.join(",");
  useEffect(() => {
    if (plan === "free") return;
    const pickedNames = selected.map(id => words.find(w => w.id === id)?.word).filter(Boolean) as string[];
    if (pickedNames.length === 0 || pickedNames.length >= 3) { setPairs([]); setPairsFor(null); return; }
    let cancelled = false;
    setPairsLoading(true);
    fetch("/api/magnet-pairs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: pickedNames, topic: title.trim() || undefined }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) { setPairs(d.pairs || []); setPairsFor(pickedNames.join(" + ")); } })
      .catch(() => { if (!cancelled) setPairs([]); })
      .finally(() => { if (!cancelled) setPairsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey, words.length, plan]);

  const addWordByName = (name: string) => {
    const w = words.find(x => x.word.toLowerCase() === name.toLowerCase());
    if (!w) return;
    setSelected(prev => prev.includes(w.id) || prev.length >= 3 ? prev : [...prev, w.id]);
  };

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

  if (plan === "free") {
    // Sell at the wall: preview the 3 highest-graded words so the lock
    // shows real niche-specific value instead of just blocking.
    const rank: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };
    const top = [...words].sort((a, b) => (rank[a.grade] ?? 9) - (rank[b.grade] ?? 9)).slice(0, 3);
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: "40px 20px" }}>
        <div style={{ background: "#0d1520", border: "1px solid rgba(77,184,255,0.30)", borderRadius: 18, padding: "40px 44px", maxWidth: 480, textAlign: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "#7ed8ff", textTransform: "uppercase" }}>🧲 Top words in your niche right now</span>
          {top.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", margin: "16px 0 22px" }}>
              {top.map(mw => {
                const gc = mw.grade === "S" ? "#f59e0b" : mw.grade === "A" ? "#4db8ff" : mw.grade === "B" ? "#34d399" : "#a6c0d8";
                return (
                  <span key={mw.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: `1px solid ${gc}55`, background: `${gc}14` }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#e8edf5" }}>{mw.word}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: `${gc}22`, color: gc }}>{mw.grade}</span>
                  </span>
                );
              })}
            </div>
          )}
          <h2 style={{ color: "#e8edf5", fontSize: 22, fontWeight: 700, margin: top.length ? "0 0 10px" : "8px 0 10px" }}>Bake proven words into every title</h2>
          <p style={{ color: "#a6c0d8", fontSize: 15, lineHeight: 1.7, margin: "0 0 26px" }}>These are the highest-performing words in your niche, graded S/A/B/C from live data. Pick up to three and our AI rewrites your title around them to lift click-through.</p>
          <a href="/dashboard/settings" style={{ display: "inline-block", background: "linear-gradient(135deg,#0e6499,#1a8fd1)", color: "white", padding: "13px 32px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: 16 }}>Unlock with Starter →</a>
        </div>
      </div>
    );
  }


  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 28 }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>🧲</span>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, margin: 0 }}>Viral Magnet Titles</h1>
          </div>
          <p style={{ color: C.textDim, fontSize: 16, margin: 0 }}>
            Add one high-pull word to any title and generate 8 click-optimized variations
          </p>
        </div>

        {/* ── Input card ── */}
        <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px", marginBottom: 20 }}>

          {/* Title */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Your Video Title <span style={{ color: "#f87171" }}>*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. How I Lost 20 Pounds in 90 Days"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 12,
                background: "#0a1220", color: C.text, fontSize: 16, fontWeight: 500,
                border: `1px solid ${C.border}`, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Script */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>
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
                background: "#0a1220", color: C.text, fontSize: 16,
                border: `1px solid ${C.border}`, outline: "none",
                resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
          </div>

          {/* #2 Trending in proven titles — real occurrences from the captured pool */}
          {trending.length > 0 && (
            <div style={{ marginBottom: 18, padding: "12px 14px", borderRadius: 12, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.22)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", letterSpacing: 0.5, marginBottom: 8 }}>🔥 PROVEN ON YOUTUBE</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {trending.map(w => (
                  <button key={w.id} onClick={() => addWordByName(w.word)} disabled={selected.includes(w.id) || selected.length >= 3}
                    title="A high-CTR word proven in real YouTube titles"
                    style={{ padding: "5px 11px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: selected.includes(w.id) || selected.length >= 3 ? "default" : "pointer", border: "1px solid rgba(245,158,11,0.3)", background: selected.includes(w.id) ? "rgba(245,158,11,0.18)" : "transparent", color: "#fcd34d", opacity: !selected.includes(w.id) && selected.length >= 3 ? 0.4 : 1 }}>
                    {w.word}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* #1 Pairing: the next word that amplifies the whole current selection */}
          {selected.length > 0 && selected.length < 3 && (pairsLoading || pairs.length > 0) && (
            <div style={{ marginBottom: 18, padding: "12px 14px", borderRadius: 12, background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.22)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#c4b5fd", letterSpacing: 0.5, marginBottom: 8 }}>
                ⚡ {selected.length === 1 ? "PAIRS WELL WITH" : "ADD ONE MORE TO AMPLIFY"} “{pairsFor || selectedWords.map(w => w.word).join(" + ")}”
              </div>
              {pairsLoading ? (
                <div style={{ fontSize: 12, color: C.textDim }}>Finding words that amplify it…</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {pairs.map(p => {
                    const w = words.find(x => x.word.toLowerCase() === p.word.toLowerCase());
                    const isSel = w ? selected.includes(w.id) : false;
                    return (
                      <button key={p.word} onClick={() => addWordByName(p.word)} disabled={isSel || selected.length >= 3}
                        title={p.why}
                        style={{ padding: "5px 11px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: isSel || selected.length >= 3 ? "default" : "pointer", border: "1px solid rgba(167,139,250,0.3)", background: isSel ? "rgba(167,139,250,0.18)" : "transparent", color: "#ddd6fe", opacity: !isSel && selected.length >= 3 ? 0.4 : 1 }}>
                        + {p.word}
                      </button>
                    );
                  })}
                </div>
              )}
              {!pairsLoading && pairs.length > 0 && (
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 8, lineHeight: 1.5 }}>{pairs[0].why}</div>
              )}
            </div>
          )}

          {/* Word picker */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <label style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
                Select 1–3 Viral Magnet Words <span style={{ color: "#f87171" }}>*</span>
              </label>
              <span style={{ fontSize: 13, color: selected.length === 3 ? "#fb923c" : C.textDim, fontWeight: 600 }}>
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
                  <div key={grade} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: gc, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>
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
                            title={w.why_it_works}
                            style={{
                              padding: "5px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                              cursor: isDisabled ? "not-allowed" : "pointer",
                              border: isSel ? `1.5px solid ${gc}` : "1px solid rgba(77,184,255,0.16)",
                              background: isSel ? `${gc}22` : "transparent",
                              color: isSel ? gc : isDisabled ? "rgba(148,163,184,0.3)" : C.textDim,
                              opacity: isDisabled ? 0.4 : 1,
                              transition: "all 0.1s",
                            }}
                          >
                            {w.word}
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
              <div style={{ marginTop: 10, padding: "9px 14px", borderRadius: 10, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.12)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: C.textDim, fontWeight: 600 }}>Selected:</span>
                {selectedWords.map(w => (
                  <span key={w.id} style={{ fontSize: 13, fontWeight: 700, color: gradeColors[w.grade], padding: "2px 8px", borderRadius: 6, background: `${gradeColors[w.grade]}18` }}>
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
              background: canGenerate ? "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)" : "rgba(77,184,255,0.22)",
              color: "#fff", border: "none", borderRadius: 14,
              fontSize: 16, fontWeight: 700,
              cursor: canGenerate ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: canGenerate ? "0 4px 24px rgba(77,184,255,0.30)" : "none",
              transition: "all 0.15s",
            }}
          >
            {loading ? "⟳ Generating 8 titles…" : "✦ Generate Viral Titles"}
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ borderRadius: 14, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", padding: "14px 18px", marginBottom: 20 }}>
            <p style={{ color: "#f87171", fontSize: 16, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div>
            {/* Original title — baseline to compare the variants against */}
            <div style={{ marginBottom: 14, borderRadius: 14, background: "rgba(122,155,181,0.06)", border: "1px dashed rgba(122,155,181,0.3)", padding: "12px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: 1, marginBottom: 5 }}>YOUR ORIGINAL</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#cbd5e1", margin: 0, lineHeight: 1.4 }}>{title}</p>
            </div>
            {result.detectedFormula && (
              <div style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.13)" }}>
                <span style={{ fontSize: 13, color: C.textDim }}>Original formula detected:</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#7ed8ff" }}>{result.detectedFormula}</span>
              </div>
            )}

            {sameFormula.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <SectionDivider label="Same Formula — Upgraded" color="#1a8fd1" />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sameFormula.map((t, i) => <TitleCard key={i} t={t} copied={copied} onCopy={copyTitle} />)}
                </div>
              </div>
            )}

            {newFormula.length > 0 && (
              <div>
                <SectionDivider label="New Formulas — Fresh Angles" color="#1a8fd1" />
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
      <div style={{ height: 1, flex: 1, background: "rgba(77,184,255,0.12)" }} />
      <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ height: 1, flex: 1, background: "rgba(77,184,255,0.12)" }} />
    </div>
  );
}

function TitleCard({ t, copied, onCopy }: { t: TitleResult; copied: string | null; onCopy: (s: string) => void }) {
  const isCopied = copied === t.title;
  return (
    <div style={{ borderRadius: 14, background: "#0d1520", border: "1px solid rgba(77,184,255,0.12)", padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: "#e8edf5", margin: "0 0 7px 0", lineHeight: 1.4 }}>{t.title}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {(() => {
            const words = (t.magnetWords && t.magnetWords.length ? t.magnetWords : (t.magnetWord ? [t.magnetWord] : []));
            const paired = words.length >= 2;
            return (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: paired ? "rgba(167,139,250,0.16)" : "rgba(77,184,255,0.13)", color: paired ? "#c4b5fd" : "#7ed8ff" }}>
                🧲 {words.join(" + ") || "—"}{paired ? "  ⚡paired" : ""}
              </span>
            );
          })()}
          {t.formula && <span style={{ fontSize: 10, color: "#a6c0d8", fontStyle: "italic" }}>{t.formula}</span>}
        </div>
        {t.whyItWorks && (
          <p style={{ fontSize: 13, color: "#a6c0d8", margin: "6px 0 0 0", lineHeight: 1.5 }}>{t.whyItWorks}</p>
        )}
      </div>
      <button
        onClick={() => onCopy(t.title)}
        style={{
          flexShrink: 0, padding: "7px 14px", borderRadius: 9, fontSize: 14, fontWeight: 600,
          cursor: "pointer",
          background: isCopied ? "rgba(52,211,153,0.12)" : "rgba(77,184,255,0.09)",
          border: `1px solid ${isCopied ? "rgba(52,211,153,0.3)" : "rgba(77,184,255,0.20)"}`,
          color: isCopied ? "#34d399" : "#4db8ff",
          transition: "all 0.12s",
        }}
      >
        {isCopied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}
