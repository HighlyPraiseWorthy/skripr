"use client";

import { useState, useEffect } from "react";

// Dedicated step shown AFTER the angle is picked and BEFORE the storytelling
// step. Optional: the user can auto-source cited facts (Perplexity) or paste
// their own, or skip. Whatever they keep grounds real numbers in the script.

export type Verdict = "documented" | "partial" | "unverified";
export type TopicKind = "event" | "explainer" | "hypothetical" | "claim";

export interface SubjectCandidate {
  name: string; summary: string; when: string; whyItFits: string; sources: string[];
}

const C = {
  bg: "#080c12", card: "#0d1520", border: "rgba(77,184,255,0.14)",
  accent: "#4db8ff", text: "#e8edf5", dim: "#a2bcd6", green: "#34d399", purple: "#4db8ff",
};

// A fact as the library stores it: same shape the deepen path returns, plus a stable
// id (present once it has been through the library) so a user's "hide" survives later
// runs re-adding the same fact, and manual facts can be marked as the user's own.
type LibFact = { fact: string; source: string | null; id?: string; manual?: boolean };

export default function ResearchStep(props: {
  topic: string;
  // The STABLE remix title. The fact library keys on this, never on the drifting
  // resolved-case name, so facts accumulate across angle regenerations instead of each
  // run writing its own row. Falls back to `topic` when a flow doesn't supply it.
  topicAnchor?: string;
  niche?: string;
  angle?: string;
  angleLabel?: string;
  onContinue: (sourceMaterial?: string, verdict?: Verdict, kind?: TopicKind) => void;
  onBack?: () => void;
  // When the case was already resolved upstream (the reordered Remixer flow), pass
  // it here: the step deepens that case's facts instead of re-resolving, so the
  // whole flow stays anchored to one case.
  presetCase?: SubjectCandidate;
  // What made the source video work, used to bias which facts to fetch so the
  // remix reproduces the payoff, not just the structure.
  sourcePayoff?: string;
  // What the source video was ABOUT, so deepen can hunt for a documented bridge
  // between this case and that subject, the strongest possible cold open.
  sourceSubject?: string;
  // Research-before-cards: when the case was already deepened upstream (to build the
  // slot cards), pass those facts/conflicts here so this step SEEDS them instead of
  // re-running the whole deepen — same fact set, no second round-trip.
  presetFacts?: { fact: string; source: string | null }[];
  presetConflicts?: { fact: string; source: string | null; note: string }[];
}) {
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [researching, setResearching] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [verdictNote, setVerdictNote] = useState("");
  const [facts, setFacts] = useState<LibFact[]>([]);
  // The user's accumulating library for this topic: what they've hidden, and whether a
  // save is in flight. `dismissedIds` is the full hidden set (the dismiss endpoint
  // replaces, not appends, so we always send the whole set).
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [savingLib, setSavingLib] = useState(false);
  const [candidates, setCandidates] = useState<SubjectCandidate[] | null>(null);
  const [pickedSubject, setPickedSubject] = useState<SubjectCandidate | null>(null);
  const [kind, setKind] = useState<TopicKind | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // Answers Claude's review flagged as contradicting each other, shown to the
  // creator to resolve rather than silently picking one. Separate from the outage
  // state: "no-key" means the research service could not be reached, which must NOT
  // look like a case that simply had no findable facts.
  const [conflicts, setConflicts] = useState<{ fact: string; source: string | null; note: string }[]>([]);
  const [deepenStatus, setDeepenStatus] = useState<"ok" | "no-key" | "no-facts" | null>(null);
  // When the deepen pass renames the case (Rough Rider -> Black Biscuit), we show
  // it rather than swapping silently: the correction is model-derived, so the user
  // gets a chance to catch a bad rename, and it builds trust in the grounding.
  const [correctionNote, setCorrectionNote] = useState<string | null>(null);

  // Everything the library keys on flows through this one anchor.
  const anchor = (props.topicAnchor && props.topicAnchor.trim()) || props.topic;

  // Pull the accumulated library (id-bearing, so hide/edit works) and make it the
  // panel's source of truth. Called after any deepen and after any user edit. It only
  // REPLACES the shown facts when the library actually returned some, so a graceful
  // empty (tables absent, or a brand-new topic) never wipes the facts a deepen just
  // produced. Default new facts to checked; keep the user's existing checkmarks.
  async function loadLibrary(opts?: { keepPicked?: boolean }) {
    try {
      const res = await fetch("/api/research/find", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "library", caseName: pickedSubject?.name || props.topic, topicAnchor: anchor }),
      });
      const d = await res.json();
      const lib: LibFact[] = Array.isArray(d?.library) ? d.library : [];
      setDismissedIds(new Set(Array.isArray(d?.dismissed) ? d.dismissed : []));
      if (lib.length) {
        setFacts(lib);
        setPicked((prev) => {
          if (!opts?.keepPicked) return new Set(lib.map((_, i) => i));
          // Keep prior selections by matching on id where we can.
          return new Set(lib.map((_, i) => i).filter((i) => prev.has(i)));
        });
      }
    } catch { /* library is a bonus layer; the deepen facts already stand on their own */ }
  }

  // Hide a fact. Never deletes — the id joins the dismissed set (reversible) and the
  // fact stays in the row, so a later run re-adding it does not resurrect it.
  async function hideFact(id: string) {
    const next = new Set(dismissedIds); next.add(id);
    setDismissedIds(next);
    setFacts((fs) => fs.filter((f) => f.id !== id));
    try {
      await fetch("/api/research/find", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "library-dismiss", caseName: pickedSubject?.name || props.topic, topicAnchor: anchor, dismissed: Array.from(next) }),
      });
    } catch { /* best effort; local state already reflects the hide */ }
  }

  // Persist the user's own pasted facts INTO the library (not just this run's source
  // material). One fact per non-empty line. They come back marked manual, sorted first,
  // and survive every future run — this is what turns a researched topic into something
  // the user owns rather than re-rolls.
  async function saveManualFacts() {
    const lines = sourceMaterial.split("\n").map((l) => l.replace(/^\s*[-•]\s*/, "").trim()).filter(Boolean);
    if (!lines.length || savingLib) return;
    setSavingLib(true);
    try {
      const res = await fetch("/api/research/find", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "library-add", caseName: pickedSubject?.name || props.topic, topicAnchor: anchor, facts: lines.map((fact) => ({ fact, source: null })) }),
      });
      const d = await res.json();
      const lib: LibFact[] = Array.isArray(d?.library) ? d.library : [];
      if (lib.length) {
        setFacts(lib);
        // Auto-include the newly added manual facts (they sort to the front).
        setPicked((prev) => { const n = new Set(prev); lib.forEach((f, i) => { if (f.manual) n.add(i); }); return n; });
        setSourceMaterial("");
      }
    } catch { /* keep the text so the user can retry */ }
    finally { setSavingLib(false); }
  }

  async function findResearch() {
    if (researching) return;
    setResearching(true); setError(null); setConflicts([]); setDeepenStatus(null); setCorrectionNote(null);
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
      const k: TopicKind = d.kind === "explainer" || d.kind === "hypothetical" || d.kind === "claim" ? d.kind : "event";
      setVerdict(v); setKind(k);
      setVerdictNote(typeof d.verdictNote === "string" ? d.verdictNote : "");
      // Candidates ride along with the same call now, so no second lookup. Only an
      // EVENT has a real case to pick; the other kinds have no incident to resolve.
      if (k === "event" && Array.isArray(d.candidates)) setCandidates(d.candidates);
    } catch (e: any) { setError(e?.message || "Research lookup failed"); }
    finally { setResearching(false); }
  }

  // Picking a real case grounds the script on it: its sourced summary becomes
  // source material, and a focused research pass replaces the vague topic-level
  // one, which is what finally gives the script real names and dates to use.
  async function pickSubject(c: SubjectCandidate) {
    setPickedSubject(c);
    setConflicts([]); setDeepenStatus(null); setCorrectionNote(null);
    setVerdict("documented");
    setVerdictNote(`Grounded on a real documented case: ${c.name}${c.when ? ` (${c.when})` : ""}.`);
    setResearching(true);
    try {
      const res = await fetch("/api/research/find", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deepen", caseName: c.name, caseSummary: c.summary, niche: props.niche, sourcePayoff: props.sourcePayoff, sourceSubject: props.sourceSubject, topicAnchor: anchor }),
      });
      const d = await res.json();
      const fs = Array.isArray(d?.facts) ? d.facts : [];
      if (fs.length) { setFacts(fs); setPicked(new Set(fs.map((_: any, i: number) => i))); }
      // Swap in the id-bearing accumulated set so the creator can hide facts and their
      // own pasted facts persist. Bonus layer — the deepen facts above already stand.
      void loadLibrary();
      setConflicts(Array.isArray(d?.conflicts) ? d.conflicts : []);
      setDeepenStatus(d?.status === "no-key" || d?.status === "no-facts" || d?.status === "ok" ? d.status : null);
      // Entity locking at the source: if the deepen pass corrected the case name or
      // date, relabel the case everywhere. This is what stops the wrong operation
      // name (and a drifting date) from reaching the finished script, where a
      // Director's note cannot override it.
      const cName = typeof d?.caseName === "string" && d.caseName.trim() ? d.caseName.trim() : "";
      const cWhen = typeof d?.when === "string" && d.when.trim() ? d.when.trim() : "";
      if (cName || cWhen) {
        const fixed = { ...c, name: cName || c.name, when: cWhen || c.when };
        setPickedSubject(fixed);
        setVerdictNote(`Grounded on a real documented case: ${fixed.name}${fixed.when ? ` (${fixed.when})` : ""}.`);
        // Only announce a rename when the NAME actually changed, not on a date-only
        // or identical-string echo, so the note means something when it appears.
        if (cName && cName.toLowerCase() !== c.name.toLowerCase()) {
          setCorrectionNote(`Corrected from “${c.name}” to “${fixed.name}”. Skripr recognized the case under its canonical name; check it if it looks wrong.`);
        }
      }
    } catch { /* keep the candidate's own summary as grounding */ }
    finally { setResearching(false); }
  }

  // Reordered flow: a case was already resolved upstream. Deepen it on mount and
  // skip the picker, so this step just confirms it and lets the creator review facts.
  useEffect(() => {
    if (props.presetCase) {
      setKind("event");
      // Already deepened upstream: seed the facts instead of fetching them again.
      if (props.presetFacts && props.presetFacts.length) {
        setPickedSubject(props.presetCase);
        setVerdict("documented");
        setVerdictNote(`Grounded on a real documented case: ${props.presetCase.name}${props.presetCase.when ? ` (${props.presetCase.when})` : ""}.`);
        setFacts(props.presetFacts);
        setPicked(new Set(props.presetFacts.map((_, i) => i)));
        setConflicts(props.presetConflicts || []);
        setDeepenStatus("ok");
        // Upgrade the seeded facts to the id-bearing library view so hide/add work.
        void loadLibrary();
      } else {
        void pickSubject(props.presetCase);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deepen can chain several model calls (question gen, sourcing, a retry round,
  // review), so the wait runs tens of seconds. A single frozen "Searching…" past
  // ~15s reads as broken and people refresh mid-research, so step the label through
  // what is actually happening.
  const [researchMsg, setResearchMsg] = useState("Searching the web for facts…");
  useEffect(() => {
    if (!researching) { setResearchMsg("Searching the web for facts…"); return; }
    const steps = [
      "Locking the case identity…",
      "Pulling sourced facts…",
      "Filling gaps with broader questions…",
      "Double-checking every source…",
      "Almost there…",
    ];
    let i = 0;
    setResearchMsg(steps[0]);
    const id = setInterval(() => { i = Math.min(i + 1, steps.length - 1); setResearchMsg(steps[i]); }, 5000);
    return () => clearInterval(id);
  }, [researching]);

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
            <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>{researching ? researchMsg : "Find research for me"}</span>
            <span style={{ display: "block", fontSize: 12.5, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>Skripr pulls real, cited stats for this topic, you just approve them.</span>
          </span>
        </button>
        {error && <p style={{ fontSize: 12, color: "#fca5a5", marginTop: 8 }}>{error}</p>}

        {/* Verdict on the premise itself. Shown BEFORE generation so the creator
            can change course while it is still cheap, rather than discovering a
            fabricated case after the script reads as researched. */}
        {/* One resolved case must drive the verdict, the picker, and the facts.
            While an event has candidate cases and none is picked yet, the picker
            IS the answer: hide the verdict note (it may name a case the picker
            does not offer) and the topic-level facts (they span several unrelated
            people and would build a composite that never existed). */}
        {verdict && !(kind === "event" && candidates && candidates.length > 0 && !pickedSubject) && (() => {
          // Only an EVENT can fail to check out. For an explainer or a thought
          // experiment there is no incident to confirm, so the banner reports what
          // was found rather than casting doubt on the premise.
          const nonEvent = kind && kind !== "event";
          const V = nonEvent
            ? {
                tone: "#34d399", icon: "✓",
                label: kind === "hypothetical" ? "Grounded in the real science behind the scenario" : "Grounded in real sources",
                body: kind === "hypothetical"
                  ? "This is a thought experiment, so the scenario itself is not something to confirm. Skripr will reason from the real mechanisms below and will not claim it happened."
                  : "Facts below are sourced. Skripr can state these specifics instead of hedging.",
              }
            : {
                documented: { tone: "#34d399", icon: "✓", label: "Sources describe this", body: "The record supports this premise. Verify the specifics before publishing anyway." },
                partial: { tone: "#fbbf24", icon: "!", label: "Subject is real, this specific claim is not sourced", body: "Sources exist for the broader subject, but not for this exact event or framing. Pick the real case below, or paste sources, and Skripr can name specifics." },
                unverified: { tone: "#f87171", icon: "✕", label: "No sources found for this specific claim", body: "Nothing found describing this event. Pick the real case below if one fits, or paste your sources. Otherwise Skripr will write it without inventing names or dates." },
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
        {kind === "event" && candidates && candidates.length > 0 && !pickedSubject && (
          <div style={{ marginTop: 12, borderRadius: 12, padding: "13px 14px", background: "rgba(77,184,255,0.06)", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.accent }}>
              Which real case is this video about?
            </div>
            <div style={{ fontSize: 11.5, color: C.dim, marginTop: 3, lineHeight: 1.5 }}>
              Pick one and Skripr builds the script on that documented story, with its real names and dates.
            </div>
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

        {/* Case-identity correction. Announced, not silent, because the rename is
            model-derived and can be wrong in the same way the original label was. */}
        {correctionNote && pickedSubject && (
          <div style={{ marginTop: 12, border: `1px solid ${C.accent}55`, borderRadius: 12, padding: "10px 12px", background: "rgba(77,184,255,0.06)" }}>
            <span style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>✎ {correctionNote}</span>
          </div>
        )}

        {/* Research-service outage. A missing Perplexity key returns zero facts,
            which is indistinguishable from a case with no findable facts unless we
            say so — otherwise a prod outage reads as a research failure and the
            creator regenerates forever. This state is deliberately NOT an empty list. */}
        {deepenStatus === "no-key" && pickedSubject && (
          <div style={{ marginTop: 12, border: "1px solid #d9a04555", borderRadius: 12, padding: 14, background: "rgba(217,160,69,0.08)" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#e6b45a" }}>Research service unavailable right now</div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 4, lineHeight: 1.5 }}>Skripr couldn't reach the fact source to deepen this case. This is a temporary outage, not a lack of facts. Continue on the case summary, or try again in a moment.</div>
          </div>
        )}

        {/* Contradictions Claude's review found across the answers (one source says
            42 defendants, another says 16). Shown to the creator to resolve, never
            silently collapsed to whichever answer came back first. Excluded from the
            facts that auto-fill the script. */}
        {conflicts.length > 0 && (pickedSubject || !(kind === "event" && candidates && candidates.length > 0)) && (
          <div style={{ marginTop: 12, border: "1px solid #e0666655", borderRadius: 12, padding: 14, background: "rgba(224,102,102,0.07)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: "#f0a3a3", marginBottom: 3 }}>⚠ SOURCES DISAGREE — YOU DECIDE</div>
            <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 10 }}>These answers contradict each other, so Skripr left them out of your script. Check the sources and paste the right version below if you want it.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {conflicts.map((c, i) => (
                <div key={i} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.text, lineHeight: 1.45 }}>{c.fact}</span>
                  {c.note && <span style={{ display: "block", fontSize: 11.5, color: "#f0a3a3", marginTop: 3 }}>{c.note}</span>}
                  {c.source && <a href={c.source} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 11, color: "#7ed8ff", marginTop: 2, wordBreak: "break-all" }}>{c.source}</a>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Found facts */}
        {facts.length > 0 && (pickedSubject || !(kind === "event" && candidates && candidates.length > 0)) && (
          <div style={{ marginTop: 12, border: `1px solid ${C.purple}45`, borderRadius: 12, padding: 14, background: `${C.purple}0e` }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: "#b9adff", marginBottom: 3 }}>✓ {includedCount} FACTS WILL BE USED IN YOUR SCRIPT</div>
            <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 10 }}>These are added automatically, uncheck any you don't want. A citation isn't a guarantee, so verify before publishing.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {facts.map((f, i) => {
                const on = picked.has(i);
                return (
                  <div key={f.id || i} onClick={() => setPicked((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                    style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer", padding: "8px 10px", borderRadius: 8, border: `1px solid ${on ? `${C.purple}70` : C.border}`, background: on ? `${C.purple}16` : "transparent" }}>
                    <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 4, marginTop: 2, border: `1px solid ${on ? C.purple : C.dim}`, background: on ? C.purple : "transparent", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{on ? "✓" : ""}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 13, color: C.text, lineHeight: 1.45 }}>{f.fact}</span>
                      {f.manual && <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, color: C.green, marginLeft: 6, verticalAlign: "middle" }}>YOURS</span>}
                      {f.source && <a href={f.source} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "block", fontSize: 11, color: "#7ed8ff", marginTop: 2, wordBreak: "break-all" }}>{f.source}</a>}
                    </span>
                    {/* Hide, not delete: only offered once a fact carries a library id, so
                        the removal actually persists (reversible) rather than vanishing for
                        this run and returning on the next. */}
                    {f.id && (
                      <button title="Hide this fact" aria-label="Hide this fact"
                        onClick={(e) => { e.stopPropagation(); void hideFact(f.id!); }}
                        style={{ flexShrink: 0, background: "none", border: "none", color: C.dim, fontSize: 15, lineHeight: 1, cursor: "pointer", padding: "0 2px" }}>×</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Manual paste. "Save to my research" persists each line into the library so it
            survives every future run and angle regeneration; without saving, the text
            still grounds THIS script (it flows into the source material on Continue). */}
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.dim, margin: "18px 0 8px" }}>
          Or add your own
        </div>
        <textarea
          value={sourceMaterial}
          onChange={(e) => setSourceMaterial(e.target.value)}
          placeholder="Paste facts, stats, study findings, or article text — one fact per line. Real numbers come only from what's here."
          rows={4}
          style={{ width: "100%", padding: "11px 13px", borderRadius: 12, background: "#0a1220", color: C.text, fontSize: 13, border: `1px solid ${grounded ? `${C.green}55` : C.border}`, outline: "none", resize: "vertical", lineHeight: 1.55, fontFamily: "inherit", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <button onClick={saveManualFacts} disabled={!sourceMaterial.trim() || savingLib}
            style={{ padding: "8px 14px", borderRadius: 9, border: `1px solid ${C.green}55`, background: sourceMaterial.trim() ? `${C.green}18` : "transparent", color: sourceMaterial.trim() ? C.green : C.dim, fontSize: 12.5, fontWeight: 700, cursor: sourceMaterial.trim() && !savingLib ? "pointer" : "default" }}>
            {savingLib ? "Saving…" : "＋ Save to my research"}
          </button>
          <span style={{ fontSize: 11, color: C.dim, lineHeight: 1.4 }}>Saved facts stay with this topic for every future script.</span>
        </div>
        {grounded && <p style={{ fontSize: 11.5, color: C.green, marginTop: 6 }}>✓ Grounded, the script can cite these specifics</p>}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          {props.onBack && (
            <button onClick={props.onBack}
              style={{ padding: "12px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Back
            </button>
          )}
          <button onClick={() => props.onContinue(buildSourceMaterial(), verdict ?? undefined, kind ?? undefined)}
            style={{ flex: 1, padding: "12px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#0e6499,#1a8fd1,#4db8ff)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 0 22px rgba(77,184,255,0.26)" }}>
            {includedCount > 0 ? `Continue with ${includedCount} fact${includedCount === 1 ? "" : "s"} →` : grounded ? "Continue →" : "Skip, continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
