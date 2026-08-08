"use client";

import { useState } from "react";

// Dedicated step shown AFTER the angle is picked and BEFORE the storytelling
// step. Optional: the user can auto-source cited facts (Perplexity) or paste
// their own, or skip. Whatever they keep grounds real numbers in the script.

export type Verdict = "documented" | "partial" | "unverified";

export interface SubjectCandidate {
  name: string; summary: string; when: string; whyItFits: string; sources: string[];
}

const C = {
  bg: "#080c12", card: "#0d1520", border: "rgba(77,184,255,0.14)",
  accent: "#4db8ff", text: "#e8edf5", dim: "#a2bcd6", green: "#34d399", purple: "#4db8ff",
};

export default function ResearchStep(props: {
  topic: string;
  niche?: string;
  angle?: string;
  angleLabel?: string;
  onContinue: (sourceMaterial?: string, verdict?: Verdict) => void;
  onBack?: () => void;
}) {
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [researching, setResearching] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [verdictNote, setVerdictNote] = useState("");
  const [facts, setFacts] = useState<{ fact: string; source: string | null }[]>([]);
  const [candidates, setCandidates] = useState<SubjectCandidate[] | null>(null);
  const [pickedSubject, setPickedSubject] = useState<SubjectCandidate | null>(null);
  const [resolving, setResolving] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function findResearch() {
    if (researching) return;
    setResearching(true); setError(null);
    try {
      const res = await fetch("/api/research/find", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: props.topic, angle: props.angle, niche: props.niche }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Research lookup failed");
      const fs = Array.isArray(d.facts) ? d.facts : [];
      setFacts(fs); setPicked(new Set(fs.map((_: any, i: number) => i)));
      const v = d.verdict === "documented" || d.verdict === "partial" ? d.verdict : "unverified";
      setVerdict(v);
      setVerdictNote(typeof d.verdictNote === "string" ? d.verdictNote : "");
      if (v !== "documented") void resolveSubjects();
    } catch (e: any) { setError(e?.message || "Research lookup failed"); }
    finally { setResearching(false); }
  }

  // The topic is usually a TITLE, not a claim ("The Hunt for the Man Who Sold
  // America's Satellites" is a real story, it just needs naming). So when the
  // premise is not documented, offer the real cases it maps to rather than
  // stopping at "unverified".
  async function resolveSubjects() {
    if (resolving) return;
    setResolving(true);
    try {
      const res = await fetch("/api/research/find", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: props.topic, niche: props.niche, action: "resolve" }),
      });
      const d = await res.json();
      if (res.ok && Array.isArray(d.candidates)) setCandidates(d.candidates);
    } catch { /* non-blocking: the verdict banner still stands on its own */ }
    finally { setResolving(false); }
  }

  // Picking a real case grounds the script on it: its sourced summary becomes
  // source material, and a focused research pass replaces the vague topic-level
  // one, which is what finally gives the script real names and dates to use.
  async function pickSubject(c: SubjectCandidate) {
    setPickedSubject(c);
    setVerdict("documented");
    setVerdictNote(`Grounded on a real documented case: ${c.name}${c.when ? ` (${c.when})` : ""}.`);
    setResearching(true);
    try {
      const res = await fetch("/api/research/find", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: `${c.name}. ${c.summary}`, niche: props.niche }),
      });
      const d = await res.json();
      const fs = Array.isArray(d?.facts) ? d.facts : [];
      if (fs.length) { setFacts(fs); setPicked(new Set(fs.map((_: any, i: number) => i))); }
    } catch { /* keep the candidate's own summary as grounding */ }
    finally { setResearching(false); }
  }

  // Checked facts are included automatically, no separate "add" step. Combine
  // them with any pasted text into the final source material on Continue.
  function buildSourceMaterial(): string | undefined {
    const chosen = facts
      .filter((_, i) => picked.has(i))
      .map((f) => `- ${f.fact}${f.source ? ` (source: ${f.source})` : ""}`)
      .join("\n");
    const subject = pickedSubject
      ? `REAL CASE THIS VIDEO IS ABOUT: ${pickedSubject.name}${pickedSubject.when ? ` (${pickedSubject.when})` : ""}\n${pickedSubject.summary}${pickedSubject.sources.length ? `\n(sources: ${pickedSubject.sources.join(", ")})` : ""}`
      : "";
    const manual = sourceMaterial.trim();
    return [subject, chosen, manual].filter(Boolean).join("\n\n") || undefined;
  }

  const includedCount = facts.filter((_, i) => picked.has(i)).length;
  const grounded = includedCount > 0 || sourceMaterial.trim().length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4,8,12,0.86)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} role="dialog" aria-modal="true">
      <div style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 22, padding: "28px 28px 22px", boxShadow: "0 24px 90px rgba(0,0,0,0.55)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#0e6499,#4db8ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, boxShadow: "0 4px 18px rgba(77,184,255,0.4)" }}>📚</div>
          <div>
            <div style={{ fontSize: 21, fontWeight: 700, color: C.text }}>Ground it in real research</div>
            <div style={{ fontSize: 13, color: C.dim }}>Optional, add cited facts and Skripr states real numbers instead of hedging.</div>
          </div>
        </div>

        {/* Angle context */}
        {props.angleLabel && (
          <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(77,184,255,0.06)", border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: C.accent }}>YOUR ANGLE</span>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginTop: 3 }}>{props.angleLabel}</div>
          </div>
        )}

        {/* Hero: auto-source */}
        <button onClick={findResearch} disabled={researching}
          style={{
            width: "100%", marginTop: 16, padding: "16px 18px", borderRadius: 14, border: "none", cursor: researching ? "wait" : "pointer",
            background: "linear-gradient(135deg,#0e6499 0%,#4db8ff 55%,#7ed8ff 100%)", color: "#fff", textAlign: "left",
            boxShadow: "0 6px 26px rgba(77,184,255,0.4)", display: "flex", alignItems: "center", gap: 14,
          }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>{researching ? "⏳" : "✦"}</span>
          <span>
            <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>{researching ? "Searching the web for facts…" : "Find research for me"}</span>
            <span style={{ display: "block", fontSize: 12.5, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>Skripr pulls real, cited stats for this topic, you just approve them.</span>
          </span>
        </button>
        {error && <p style={{ fontSize: 12, color: "#fca5a5", marginTop: 8 }}>{error}</p>}

        {/* Verdict on the premise itself. Shown BEFORE generation so the creator
            can change course while it is still cheap, rather than discovering a
            fabricated case after the script reads as researched. */}
        {verdict && (() => {
          const V = {
            documented: { tone: "#34d399", icon: "✓", label: "Sources describe this", body: "The record supports this premise. Verify the specifics before publishing anyway." },
            partial: { tone: "#fbbf24", icon: "!", label: "Subject is real, this specific claim is not sourced", body: "Sources exist for the broader subject, but not for this exact event or framing. Skripr will write it without asserting specifics it cannot source. Paste real sources below to state them." },
            unverified: { tone: "#f87171", icon: "✕", label: "No sources found for this specific claim", body: "Nothing found describing this event. If it is real, paste your sources below. If it is not, change the topic, because a script written on this would sound researched while inventing the case." },
          }[verdict];
          return (
            <div style={{ marginTop: 12, borderRadius: 12, padding: "12px 14px", background: `${V.tone}12`, border: `1px solid ${V.tone}50` }}>
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, background: V.tone, color: "#08131f", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{V.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: V.tone }}>{V.label}</div>
                  {verdictNote && <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55, marginTop: 4 }}>{verdictNote}</div>}
                  <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.55, marginTop: 4 }}>{V.body}</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Real cases this title maps to. A creator types a TITLE, and a title is
            not a claim to verify, it is a story to identify. */}
        {(resolving || (candidates && candidates.length > 0)) && !pickedSubject && (
          <div style={{ marginTop: 12, borderRadius: 12, padding: "13px 14px", background: "rgba(77,184,255,0.06)", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.accent }}>
              {resolving ? "Finding the real cases this could be about…" : "Which real case is this video about?"}
            </div>
            {!resolving && (
              <div style={{ fontSize: 11.5, color: C.dim, marginTop: 3, lineHeight: 1.5 }}>
                Pick one and Skripr builds the script on that documented story, with its real names and dates.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 11 }}>
              {(candidates || []).map((c, i) => (
                <button key={i} onClick={() => pickSubject(c)}
                  style={{ textAlign: "left", cursor: "pointer", padding: "11px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.03)", color: C.text }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>
                    {c.name}{c.when && <span style={{ color: C.dim, fontWeight: 500 }}> · {c.when}</span>}
                  </div>
                  {c.summary && <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.55, marginTop: 3 }}>{c.summary}</div>}
                  {c.whyItFits && <div style={{ fontSize: 11.5, color: C.accent, lineHeight: 1.5, marginTop: 4 }}>Fits your title: {c.whyItFits}</div>}
                  {c.sources.length > 0 && (
                    <div style={{ fontSize: 10.5, color: "#7ed8ff", marginTop: 4, wordBreak: "break-all" }}>{c.sources.slice(0, 2).join("  ")}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Found facts */}
        {facts.length > 0 && (
          <div style={{ marginTop: 12, border: `1px solid ${C.purple}45`, borderRadius: 12, padding: 14, background: `${C.purple}0e` }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: "#b9adff", marginBottom: 3 }}>✓ {includedCount} FACTS WILL BE USED IN YOUR SCRIPT</div>
            <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 10 }}>These are added automatically, uncheck any you don't want. A citation isn't a guarantee, so verify before publishing.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {facts.map((f, i) => {
                const on = picked.has(i);
                return (
                  <div key={i} onClick={() => setPicked((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                    style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer", padding: "8px 10px", borderRadius: 8, border: `1px solid ${on ? `${C.purple}70` : C.border}`, background: on ? `${C.purple}16` : "transparent" }}>
                    <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 4, marginTop: 2, border: `1px solid ${on ? C.purple : C.dim}`, background: on ? C.purple : "transparent", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{on ? "✓" : ""}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 13, color: C.text, lineHeight: 1.45 }}>{f.fact}</span>
                      {f.source && <a href={f.source} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "block", fontSize: 11, color: "#7ed8ff", marginTop: 2, wordBreak: "break-all" }}>{f.source}</a>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Manual paste */}
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.dim, margin: "18px 0 8px" }}>
          Or add your own
        </div>
        <textarea
          value={sourceMaterial}
          onChange={(e) => setSourceMaterial(e.target.value)}
          placeholder="Paste facts, stats, study findings, or article text. Real numbers come only from what's here."
          rows={4}
          style={{ width: "100%", padding: "11px 13px", borderRadius: 12, background: "#0a1220", color: C.text, fontSize: 13, border: `1px solid ${grounded ? `${C.green}55` : C.border}`, outline: "none", resize: "vertical", lineHeight: 1.55, fontFamily: "inherit", boxSizing: "border-box" }}
        />
        {grounded && <p style={{ fontSize: 11.5, color: C.green, marginTop: 6 }}>✓ Grounded, the script can cite these specifics</p>}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          {props.onBack && (
            <button onClick={props.onBack}
              style={{ padding: "12px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Back
            </button>
          )}
          <button onClick={() => props.onContinue(buildSourceMaterial(), verdict ?? undefined)}
            style={{ flex: 1, padding: "12px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#0e6499,#1a8fd1,#4db8ff)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 0 22px rgba(77,184,255,0.26)" }}>
            {includedCount > 0 ? `Continue with ${includedCount} fact${includedCount === 1 ? "" : "s"} →` : grounded ? "Continue →" : "Skip, continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
