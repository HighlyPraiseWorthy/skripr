"use client";

import { useEffect, useMemo, useState } from "react";
import { deriveDirectorNotes, composeDirectorNote } from "@/lib/director-notes";

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
  angleLabel?: string;
  // Grounded research + case, used to auto-derive the Director's notes so the user
  // gets the reviewer-grade guidance without hand-writing it. Optional: with no
  // research the block simply doesn't render.
  sourceMaterial?: string;
  caseName?: string;
  // The chosen card's structural slot, so the derived climax note aims at the peak of
  // THIS angle rather than defaulting to the takedown.
  slot?: string;
  // Content kind, so a "mechanism" slot on an explainer gets the patient-explanation note
  // rather than the crime-story "scene where it nearly came apart" note.
  topicKind?: "event" | "explainer" | "hypothetical" | "claim";
  // The 4th argument carries the WINNING STRUCTURE the creator kept (or "none" for Skripr's own planner).
  onGenerate: (mode: string, techniqueIds: string[], directorNote?: string, structure?: { structure?: any; structureFamilyId?: string }) => void;
  onBack?: () => void;
}) {
  const [data, setData] = useState<RecResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState<"recommended" | "original" | "custom">("recommended");
  const [directorNote, setDirectorNote] = useState("");
  // WINNING STRUCTURE: the story shape from this niche's outlier winners that the research can fill.
  const [structure, setStructure] = useState<any | null>(null);
  const [structLoading, setStructLoading] = useState(false);
  const [structOff, setStructOff] = useState(false);
  const loadStructure = (familyId?: string) => {
    if (!props.sourceMaterial) return;
    setStructLoading(true);
    fetch("/api/structure/choose", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ niche: props.niche, topic: props.topic, angle: props.angle, sourceMaterial: props.sourceMaterial, familyId }) })
      .then((r) => r.json()).then((d) => { if (d?.structure) setStructure(d.structure); }).catch(() => {}).finally(() => setStructLoading(false));
  };
  useEffect(() => { loadStructure(); }, [props.sourceMaterial]); // eslint-disable-line react-hooks/exhaustive-deps
  // Auto-derived notes from the grounded research + angle. Recomputed only when the
  // inputs change; the user checks/unchecks each and the checked set is prepended to
  // whatever they type, so they never have to hand-write the derivable guidance.
  const baseNotes = useMemo(
    () => deriveDirectorNotes({ sourceMaterial: props.sourceMaterial, angle: props.angle, caseName: props.caseName, slot: props.slot, topicKind: props.topicKind }),
    [props.sourceMaterial, props.angle, props.caseName, props.slot, props.topicKind],
  );
  // PRODUCER'S NOTES: written from the chosen card + research (opening scene, act order, payoff,
  // attribution, privacy), so a creator who doesn't know what to write still gets producer guidance.
  const [producerNotes, setProducerNotes] = useState<{ source: string; note: string; on: boolean }[]>([]);
  useEffect(() => {
    if (!props.sourceMaterial || !props.angle) return;
    let alive = true;
    fetch("/api/director-note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: props.topic, angle: props.angle, title: props.angleLabel, sourceMaterial: props.sourceMaterial }) })
      .then((r) => r.json()).then((d) => { if (alive && Array.isArray(d?.notes)) { setProducerNotes(d.notes.map((n: any) => ({ source: String(n.source || "Producer"), note: String(n.note || ""), on: true })).filter((n: any) => n.note)); setDropped(new Set()); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [props.sourceMaterial, props.angle]);
  const derivedNotes = useMemo(() => [...producerNotes, ...baseNotes], [producerNotes, baseNotes]);
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  const checkedNotes = derivedNotes.filter((_, i) => !dropped.has(i)).map((n) => n.note);
  const finalDirectorNote = () => composeDirectorNote(checkedNotes, directorNote);
  // A derived note must not instruct a technique the technique set omits, or the two
  // systems fight (the climax note firing while The Climax is unchecked). Each active
  // note that depends on a technique force-enables it.
  const requiredTechniques = useMemo(() => {
    const req = new Set<string>();
    const blob = checkedNotes.join(" ").toLowerCase();
    if (blob.includes("climax")) req.add("climax");
    if (blob.includes("aftermath")) { req.add("escalation"); req.add("emotional-progression"); }
    return req;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedNotes.join("|")]);

  // The SUPPRESSION side, which is where the real risk lives. A technique can actively
  // fight an accuracy note: The Villain needs an enemy with agency, so pairing it with
  // correlational findings pushes the script to assert causation the evidence does not
  // support. Each suppression carries the reason, so the user overrides knowingly.
  const suppressed = useMemo(() => {
    const out = new Map<string, string>();
    const blob = checkedNotes.join(" ").toLowerCase();
    if (blob.includes("correlational") || blob.includes("never that x causes")) {
      out.set("villain", "your findings are correlational, and a villain implies a cause");
    }
    if (blob.includes("do not name a culprit")) {
      out.set("villain", "the cause here was never proven, so there is no culprit to cast");
    }
    if (blob.includes("unproven allegations")) {
      out.set("villain", "the allegations about this living person are unproven");
    }
    if (blob.includes("don't imply a clean win") || blob.includes("did not fully hold")) {
      out.set("climax", "the case did not hold, so a triumphant peak would misrepresent it");
    }
    const sci = ["premise", "mechanism", "scale", "consequence", "open-question"].includes((props.slot || "").toLowerCase());
    if (sci) {
      if (!out.has("villain")) out.set("villain", "an explainer has no antagonist; the subject is a system, not a character");
      out.set("main-character", "an explainer has no protagonist; forcing one turns the viewer into a character");
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedNotes.join("|"), props.slot]);
  // Only auto-notes worth showing appear once research exists (more than the single
  // channel-default line).
  const showAutoNotes = props.sourceMaterial ? derivedNotes.length > 0 : false;

  // Reflect the note-required techniques in the checked set so the user SEES that
  // e.g. The Climax is on because the climax note is active (not a silent override).
  useEffect(() => {
    if (requiredTechniques.size === 0 && suppressed.size === 0) return;
    setSelected((prev) => {
      let changed = false;
      const next = new Set(prev);
      requiredTechniques.forEach((id) => { if (!next.has(id)) { next.add(id); changed = true; } });
      suppressed.forEach((_reason, id) => { if (next.has(id)) { next.delete(id); changed = true; } });
      return changed ? next : prev;
    });
  }, [requiredTechniques, suppressed]);

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
        // When a source video's technique set exists, DEFAULT TO IT. Copying the shape
        // of the video being remixed is the entire premise of a remix, and the generic
        // recommendation is both weaker and unstable run to run. The generic set stays
        // available as the fallback for when there is no source to model.
        const hasOriginal = Array.isArray(d.originalStyle) && d.originalStyle.length > 0;
        setSelected(new Set((hasOriginal ? d.originalStyle! : d.recommended).map((t) => t.id)));
        setChoice(hasOriginal ? "original" : "recommended");
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
        <div style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.5, marginBottom: props.angleLabel ? 12 : 18 }}>
          How Skripr shapes the narrative to hold attention. Pick a preset or customize, core techniques stay on.
        </div>
        {props.angleLabel && (
          <div style={{ marginBottom: 16, padding: "10px 12px", borderRadius: 10, background: "rgba(77,184,255,0.06)", border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: C.accent }}>YOUR ANGLE</span>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginTop: 3 }}>{props.angleLabel}</div>
          </div>
        )}

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
              <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>✦ Skripr recommended, {data.mode.name}</div>
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
                        {suppressed.has(t.id) && !on && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#e6b45a", marginLeft: 6 }}>TURNED OFF</span>}
                      </span>
                      {/* Say WHY a technique was turned off, so an override is informed
                          rather than blind — same principle as the notes checklist. */}
                      {suppressed.has(t.id) && !on
                        ? <span style={{ display: "block", fontSize: 12, color: "#e6b45a", lineHeight: 1.45, marginTop: 1 }}>Off because {suppressed.get(t.id)}. You can switch it back on.</span>
                        : <span style={{ display: "block", fontSize: 12.5, color: C.dim, lineHeight: 1.45, marginTop: 1 }}>{t.value}</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* WINNING STRUCTURE from the niche's outlier data, with its evidence; the creator can switch or turn it off. */}
            {props.sourceMaterial && (structLoading || structure) && (
              <div style={{ marginTop: 18, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.dim, marginBottom: 6 }}>Structure from winning videos</div>
                {structLoading && !structure && <div style={{ fontSize: 12.5, color: C.dim }}>Matching your research to the story shapes that won in this niche…</div>}
                {structure && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: structOff ? C.dim : C.text }}>
                      {structOff ? "Off: Skripr will plan its own structure" : structure.source === "family" ? structure.name : "This niche's winning skeleton"}
                    </div>
                    {!structOff && (
                      <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, marginTop: 3 }}>
                        {structure.source === "family" && structure.evidence
                          ? `From ${structure.evidence.videos} winning videos across ${structure.evidence.channels} channels (median ${structure.evidence.medianOutlierX}x their channel's usual views)${structure.scope === "cross-niche" ? ", across niches" : ""}. Fits your research ${structure.fit}/10.`
                          : "No winning shape fits this research closely, so Skripr uses the parts nearly all winning videos in this niche share."}
                      </div>
                    )}
                    {!structOff && (
                      <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, marginTop: 8 }}>
                        {structure.stages.map((s: any, i: number) => <span key={i}>{i ? " → " : ""}{s.name} <span style={{ color: C.dim }}>{s.sharePct}%</span></span>)}
                      </div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      {(structure.alternatives || []).filter((a: any) => a.familyId !== structure.familyId).slice(0, 4).map((a: any) => (
                        <button key={a.familyId} onClick={() => { setStructOff(false); loadStructure(a.familyId); }} disabled={structLoading}
                          style={{ fontSize: 11.5, padding: "5px 9px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, cursor: "pointer" }}>
                          {a.name} · fits {a.fit}/10
                        </button>
                      ))}
                      <button onClick={() => setStructOff((v) => !v)}
                        style={{ fontSize: 11.5, padding: "5px 9px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, cursor: "pointer" }}>
                        {structOff ? "Use the winning structure" : "Let Skripr plan its own"}
                      </button>
                    </div>
                    {(structure.tableStakes?.length > 0 || structure.differentiators?.length > 0) && (
                      <div style={{ fontSize: 11.5, color: C.dim, lineHeight: 1.5, marginTop: 10 }}>
                        {structure.tableStakes?.length > 0 && <div>Every winning video in this niche uses: {structure.tableStakes.join(", ")}.</div>}
                        {structure.differentiators?.length > 0 && <div>What sets winners apart here: {structure.differentiators.map((d: any) => `${d.name} (${d.winnersPct}% of winners vs ${d.basePct}% of below-average videos)`).join(", ")}.</div>}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Auto-derived Director's notes. Each line is computed from the research,
                the case type, or the angle, with its reason shown, so the guidance a
                careful editor would give is on by default and teachable, not magic. */}
            {showAutoNotes && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.dim, marginBottom: 6 }}>Skripr set these directions from your research</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {derivedNotes.map((n, i) => {
                    const on = !dropped.has(i);
                    return (
                      <div key={i} onClick={() => setDropped((p) => { const s = new Set(p); s.has(i) ? s.delete(i) : s.add(i); return s; })}
                        style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer", padding: "8px 10px", borderRadius: 9, border: `1px solid ${on ? `${C.accent}55` : C.border}`, background: on ? "rgba(77,184,255,0.06)" : "transparent" }}>
                        <span style={{ flexShrink: 0, width: 15, height: 15, borderRadius: 4, marginTop: 2, border: `1px solid ${on ? C.accent : C.dim}`, background: on ? C.accent : "transparent", color: "#fff", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{on ? "✓" : ""}</span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "inline-block", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: C.accent, background: "rgba(77,184,255,0.1)", padding: "1px 6px", borderRadius: 5, marginBottom: 3 }}>{n.source}</span>
                          <span style={{ display: "block", fontSize: 12.5, color: C.text, lineHeight: 1.45 }}>{n.note}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 6, lineHeight: 1.4 }}>Uncheck any you don&apos;t want. These shape how the story is told, never what counts as true.</div>
              </div>
            )}

            {/* Actions */}
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.dim, marginBottom: 6 }}>{showAutoNotes ? "Add your own (optional)" : "Director’s notes (optional)"}</div>
              <textarea
                value={directorNote}
                onChange={(e) => setDirectorNote(e.target.value)}
                placeholder="Anything the script must DO or AVOID: casting (&ldquo;treat the twins as two distinct people&rdquo;), where to aim the climax (&ldquo;stage it on the wire call&rdquo;), tone (&ldquo;no Narcos glamour, open on the decision&rdquo;). These shape how the story is told, never what counts as true."
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: "#0a1220", color: C.text, fontSize: 13, border: `1px solid ${C.border}`, outline: "none", resize: "vertical", lineHeight: 1.5, fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              {props.onBack && (
                <button onClick={props.onBack} disabled={props.busy}
                  style={{ padding: "12px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Back
                </button>
              )}
              <button
                onClick={() => props.onGenerate(data.mode.id, [...new Set([...selected, ...requiredTechniques])], finalDirectorNote(), structOff ? { structureFamilyId: "none" } : structure ? { structure } : undefined)}
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
