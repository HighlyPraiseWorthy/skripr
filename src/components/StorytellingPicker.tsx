"use client";

import { useEffect, useState } from "react";

// Phase 2 UI for the storytelling engine. Shown after the user picks an angle,
// before the script is written. Calls /api/storytelling/recommend, then lets the
// user accept Skripr's recommended set (pre-selected), match the source video's
// own style (uploads only), or customize. Core techniques stay on. The server
// resolves dependencies again, so any selection that reaches generation is
// coherent regardless of what's checked here.

type Tech = { id: string; name: string; value: string };
type RecResponse = {
  mode: { id: string; name: string; blurb: string };
  recommended: Tech[];
  all: Tech[];
  core: string[];
  originalStyle: Tech[] | null;
};

const C = {
  bg: "#080c12", card: "#0d1520", border: "rgba(77,184,255,0.14)",
  accent: "#4db8ff", text: "#e8edf5", dim: "#a2bcd6", green: "#34d399", purple: "#7c6fff",
};

export default function StorytellingPicker(props: {
  topic: string;
  niche?: string;
  angle?: string;
  sourceTitle?: string;
  sourceTranscript?: string;
  busy?: boolean;
  onGenerate: (mode: string, techniqueIds: string[], sourceMaterial?: string) => void;
  onBack?: () => void;
}) {
  const [data, setData] = useState<RecResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState<"recommended" | "original" | "custom">("recommended");

  // Research / source material — lives here (after the angle is chosen) so it
  // can be grounded in the actual angle. Real numbers in the script come only
  // from what's collected here.
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [researching, setResearching] = useState(false);
  const [facts, setFacts] = useState<{ fact: string; source: string | null }[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [researchError, setResearchError] = useState<string | null>(null);

  async function findResearch() {
    if (researching) return;
    setResearching(true); setResearchError(null);
    try {
      const res = await fetch("/api/research/find", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: props.topic, angle: props.angle, niche: props.niche }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Research lookup failed");
      const fs = Array.isArray(d.facts) ? d.facts : [];
      setFacts(fs); setPicked(new Set(fs.map((_: any, i: number) => i)));
      if (fs.length === 0) setResearchError("No citable facts found — try a more specific topic.");
    } catch (e: any) { setResearchError(e?.message || "Research lookup failed"); }
    finally { setResearching(false); }
  }

  function addFactsToSource() {
    const chosen = facts.filter((_, i) => picked.has(i));
    if (chosen.length === 0) return;
    const block = chosen.map((f) => `- ${f.fact}${f.source ? ` (source: ${f.source})` : ""}`).join("\n");
    setSourceMaterial((p) => (p.trim() ? p.trim() + "\n" + block : block));
    setFacts([]); setPicked(new Set());
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/storytelling/recommend", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: props.topic, niche: props.niche, angle: props.angle,
            sourceTitle: props.sourceTitle, sourceTranscript: props.sourceTranscript,
          }),
        });
        const d: RecResponse = await res.json();
        if ((d as any).error) throw new Error((d as any).error);
        setData(d);
        setSelected(new Set(d.recommended.map((t) => t.id)));
      } catch (e: any) {
        setError(e?.message || "Couldn't load recommendations");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const core = new Set(data?.core || []);

  function applyPreset(kind: "recommended" | "original") {
    if (!data) return;
    const src = kind === "original" ? (data.originalStyle || []) : data.recommended;
    setSelected(new Set(src.map((t) => t.id)));
    setChoice(kind);
  }

  function toggle(id: string) {
    if (core.has(id)) return; // core stays on
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setChoice("custom");
  }

  const wrap: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4,8,12,0.82)",
    backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
  };
  const panel: React.CSSProperties = {
    width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", background: C.card,
    border: `1px solid ${C.border}`, borderRadius: 20, padding: "26px 26px 22px", boxShadow: "0 20px 80px rgba(0,0,0,0.5)",
  };
  const presetCard = (active: boolean): React.CSSProperties => ({
    textAlign: "left", width: "100%", cursor: "pointer", borderRadius: 12, padding: "12px 14px",
    border: `1px solid ${active ? C.accent : C.border}`, background: active ? "rgba(77,184,255,0.10)" : "transparent",
    transition: "all .15s", marginBottom: 8,
  });

  return (
    <div style={wrap} role="dialog" aria-modal="true">
      <div style={panel}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Choose your storytelling style</div>
        <div style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.5, marginBottom: 18 }}>
          How Skripr shapes the narrative to hold attention. Pick a preset or customize — core techniques stay on.
        </div>

        {loading && <div style={{ color: C.dim, fontSize: 14, padding: "30px 0", textAlign: "center" }}>Analyzing the best techniques for this topic…</div>}
        {error && <div style={{ color: "#f87171", fontSize: 14, marginBottom: 12 }}>{error}</div>}

        {data && (
          <>
            {/* Presets */}
            {data.originalStyle && data.originalStyle.length > 0 && (
              <button style={presetCard(choice === "original")} onClick={() => applyPreset("original")}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.purple }}>🎬 Match the original video's style</div>
                <div style={{ fontSize: 12.5, color: C.dim, marginTop: 3 }}>
                  {data.originalStyle.map((t) => t.name).join(" · ")}
                </div>
              </button>
            )}
            <button style={presetCard(choice === "recommended")} onClick={() => applyPreset("recommended")}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>✦ Skripr recommended — {data.mode.name}</div>
              <div style={{ fontSize: 12.5, color: C.dim, marginTop: 3 }}>
                {data.recommended.map((t) => t.name).join(" · ")}
              </div>
            </button>

            {/* Customize list */}
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.dim, margin: "16px 0 8px" }}>
              Customize techniques
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.all.map((t) => {
                const on = selected.has(t.id);
                const locked = core.has(t.id);
                return (
                  <button key={t.id} onClick={() => toggle(t.id)} disabled={locked}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left", width: "100%",
                      cursor: locked ? "default" : "pointer", borderRadius: 10, padding: "10px 12px",
                      border: `1px solid ${on ? C.accent : C.border}`, background: on ? "rgba(77,184,255,0.08)" : "transparent",
                      opacity: locked ? 0.85 : 1, transition: "all .12s",
                    }}>
                    <span style={{
                      flexShrink: 0, width: 18, height: 18, borderRadius: 5, marginTop: 1,
                      border: `1px solid ${on ? C.accent : C.dim}`, background: on ? C.accent : "transparent",
                      color: C.bg, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{on ? "✓" : ""}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>
                        {t.name}{locked && <span style={{ fontSize: 10.5, fontWeight: 600, color: C.green, marginLeft: 6 }}>ALWAYS ON</span>}
                      </span>
                      <span style={{ display: "block", fontSize: 12.5, color: C.dim, lineHeight: 1.45, marginTop: 1 }}>{t.value}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Research / source material */}
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.dim, margin: "18px 0 8px" }}>
              Research / source material <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>— optional, grounds real numbers</span>
            </div>
            <textarea
              value={sourceMaterial}
              onChange={(e) => setSourceMaterial(e.target.value)}
              placeholder="Paste facts, stats, or article text. Real numbers in the script come only from what's here — everything else stays hedged."
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: "#0a1220", color: C.text, fontSize: 13, border: `1px solid ${C.border}`, outline: "none", resize: "vertical", lineHeight: 1.55, fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <button onClick={findResearch} disabled={researching}
              style={{ marginTop: 8, padding: "8px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: `1px solid ${C.purple}55`, background: `${C.purple}1a`, color: "#b9adff", cursor: researching ? "wait" : "pointer" }}>
              {researching ? "Finding research…" : "✦ Find research for me"}
            </button>
            {researchError && <p style={{ fontSize: 11, color: "#f87171", marginTop: 6 }}>{researchError}</p>}
            {facts.length > 0 && (
              <div style={{ marginTop: 10, border: `1px solid ${C.purple}40`, borderRadius: 10, padding: 12, background: `${C.purple}0d` }}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>Uncheck any you don't trust. A citation isn't a guarantee — verify before publishing.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {facts.map((f, i) => {
                    const on = picked.has(i);
                    return (
                      <div key={i} onClick={() => setPicked((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                        style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer", padding: "7px 9px", borderRadius: 8, border: `1px solid ${on ? `${C.purple}70` : C.border}`, background: on ? `${C.purple}14` : "transparent" }}>
                        <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 4, marginTop: 2, border: `1px solid ${on ? C.purple : C.dim}`, background: on ? C.purple : "transparent", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{on ? "✓" : ""}</span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 12.5, color: C.text, lineHeight: 1.45 }}>{f.fact}</span>
                          {f.source && <a href={f.source} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "block", fontSize: 11, color: "#7ed8ff", marginTop: 2, wordBreak: "break-all" }}>{f.source}</a>}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button onClick={addFactsToSource} disabled={picked.size === 0}
                  style={{ marginTop: 9, padding: "7px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: "none", background: "linear-gradient(135deg,#5b4fd6,#7c6fff)", color: "#fff", cursor: picked.size ? "pointer" : "not-allowed", opacity: picked.size ? 1 : 0.5 }}>
                  Add {picked.size} to source material ↑
                </button>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              {props.onBack && (
                <button onClick={props.onBack} disabled={props.busy}
                  style={{ padding: "12px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Back
                </button>
              )}
              <button
                onClick={() => props.onGenerate(data.mode.id, [...selected], sourceMaterial.trim() || undefined)}
                disabled={props.busy}
                style={{
                  flex: 1, padding: "12px 18px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg,#0e6499,#1a8fd1,#4db8ff)", color: "#fff",
                  fontSize: 15, fontWeight: 700, cursor: props.busy ? "wait" : "pointer", opacity: props.busy ? 0.6 : 1,
                  boxShadow: "0 0 22px rgba(77,184,255,0.26)",
                }}>
                {props.busy ? "Generating…" : `Generate with ${selected.size} techniques →`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
