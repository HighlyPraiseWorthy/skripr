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
  onGenerate: (mode: string, techniqueIds: string[]) => void;
  onBack?: () => void;
}) {
  const [data, setData] = useState<RecResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState<"recommended" | "original" | "custom">("recommended");

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

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              {props.onBack && (
                <button onClick={props.onBack} disabled={props.busy}
                  style={{ padding: "12px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Back
                </button>
              )}
              <button
                onClick={() => props.onGenerate(data.mode.id, [...selected])}
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
