"use client";
import { useState, useEffect } from "react";

const C = {
  bg: "#080c12", card: "#0d1520", border: "rgba(77,184,255,0.12)",
  accentDim: "#4db8ff", textBright: "#e8edf5", textDim: "#a6c0d8", green: "#34d399",
};

type Voice = { id: string; name: string; source: string; styleGuide: string; isActive: boolean; updatedAt: string; canReanalyze?: boolean };

export default function VoicesPage() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [max, setMax] = useState(5);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  // create form
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<"scripts" | "channel">("scripts");
  const [name, setName] = useState("");
  const [samples, setSamples] = useState("");
  const [channel, setChannel] = useState("");
  const [building, setBuilding] = useState(false);
  const [reanalyzeTarget, setReanalyzeTarget] = useState<string | null>(null);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

  async function refresh() {
    try {
      const d = await fetch("/api/voice-profile").then(r => r.json());
      setVoices(d.profiles ?? []);
      if (d.max) setMax(d.max);
    } catch {}
    setLoaded(true);
  }
  useEffect(() => { refresh(); }, []);

  async function build() {
    setBuilding(true); setError(null);
    try {
      const base = mode === "scripts" ? { name, samples } : { name, channel };
      const body = reanalyzeTarget ? { ...base, reanalyzeId: reanalyzeTarget } : base;
      const res = await fetch("/api/voice-profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to build voice");
      setName(""); setSamples(""); setChannel(""); setShowForm(false); setReanalyzeTarget(null);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBuilding(false);
    }
  }

  async function activate(id: string | null) {
    setSwitching(true); setError(null);
    try {
      await fetch("/api/voice-profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await refresh();
    } catch (e: any) { setError(e.message); }
    finally { setSwitching(false); }
  }

  async function remove(id: string) {
    setError(null);
    await fetch("/api/voice-profile", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    await refresh();
  }

  async function reanalyze(v: Voice) {
    setError(null);
    if (v.canReanalyze) {
      // One-click: the channel is stored, just re-fetch + regenerate in place.
      setReanalyzingId(v.id);
      try {
        const res = await fetch("/api/voice-profile", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reanalyzeId: v.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Re-analyze failed");
        await refresh();
      } catch (e: any) { setError(e.message); }
      finally { setReanalyzingId(null); }
    } else {
      // No stored channel (older profile / pasted scripts): re-enter the source once.
      setReanalyzeTarget(v.id); setName(v.name);
      setMode(v.source === "channel" ? "channel" : "scripts");
      setChannel(""); setSamples(""); setShowForm(true);
    }
  }

  const anyActive = voices.some(v => v.isActive);
  const canBuildFromScripts = samples.trim().length >= 400;
  const canBuildFromChannel = channel.trim().length >= 2;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>🎙️</span>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, margin: 0 }}>Voice Match</h1>
          </div>
          <p style={{ fontSize: 13, color: C.textDim, margin: 0, lineHeight: 1.6 }}>
            Save up to {max} voices from your scripts or any YouTube channel. The active voice shapes every script Skripr writes —
            cover any niche in any voice you've saved.
          </p>
        </div>
        <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 0.5, marginBottom: 20 }}>
          {voices.length}/{max} VOICES SAVED
        </div>

        {error && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {!loaded ? (
          <div style={{ textAlign: "center", color: C.textDim, fontSize: 13, padding: "40px 0" }}>Loading your voices...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {/* Default voice option */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, background: C.card, border: `1px solid ${!anyActive ? "rgba(77,184,255,0.45)" : C.border}`, borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.textBright }}>Skripr Default</div>
                <div style={{ fontSize: 12, color: C.textDim }}>The standard high-retention narrator voice</div>
              </div>
              {!anyActive ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 6, background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)", color: C.green }}>ACTIVE</span>
              ) : (
                <button onClick={() => activate(null)} disabled={switching} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.accentDim, background: "rgba(77,184,255,0.08)", border: "1px solid rgba(77,184,255,0.2)", cursor: "pointer" }}>
                  Use this voice
                </button>
              )}
            </div>

            {voices.map(v => (
              <div key={v.id} style={{ background: C.card, border: `1px solid ${v.isActive ? "rgba(77,184,255,0.45)" : C.border}`, borderRadius: 14, padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.textBright }}>{v.name}</div>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "rgba(77,184,255,0.10)", color: C.textDim, letterSpacing: 0.5 }}>
                        {v.source === "channel" ? "FROM CHANNEL" : "FROM SCRIPTS"}
                      </span>
                    </div>
                    <button onClick={() => setExpanded(expanded === v.id ? null : v.id)} style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, color: C.accentDim, cursor: "pointer", marginTop: 3 }}>
                      {expanded === v.id ? "Hide voice profile ▲" : "View voice profile ▼"}
                    </button>
                  </div>
                  {v.isActive ? (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 6, background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)", color: C.green, flexShrink: 0 }}>ACTIVE</span>
                  ) : (
                    <button onClick={() => activate(v.id)} disabled={switching} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.accentDim, background: "rgba(77,184,255,0.08)", border: "1px solid rgba(77,184,255,0.2)", cursor: "pointer", flexShrink: 0 }}>
                      Use this voice
                    </button>
                  )}
                  <button onClick={() => reanalyze(v)} disabled={reanalyzingId === v.id} title="Re-analyze — refresh this voice with the latest analysis" style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.accentDim, background: "rgba(77,184,255,0.08)", border: "1px solid rgba(77,184,255,0.2)", cursor: reanalyzingId === v.id ? "wait" : "pointer", flexShrink: 0, whiteSpace: "nowrap", opacity: reanalyzingId === v.id ? 0.6 : 1 }}>
                    {reanalyzingId === v.id ? "Refreshing…" : "↻ Re-analyze"}
                  </button>
                  <button onClick={() => remove(v.id)} title="Delete voice" style={{ background: "none", border: "none", color: C.textDim, fontSize: 15, cursor: "pointer", flexShrink: 0 }}>🗑</button>
                </div>
                {expanded === v.id && (
                  <div style={{ marginTop: 12, background: "rgba(0,0,0,0.25)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", maxHeight: 220, overflowY: "auto" }}>
                    <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{v.styleGuide}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add voice */}
        {loaded && voices.length < max && !showForm && (
          <button onClick={() => setShowForm(true)} style={{ width: "100%", padding: "14px 0", borderRadius: 14, fontSize: 14, fontWeight: 700, color: "#fff", border: "none", cursor: "pointer", background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", boxShadow: "0 4px 16px rgba(77,184,255,0.25)" }}>
            + Add a Voice
          </button>
        )}

        {showForm && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(["scripts", "channel"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", color: mode === m ? "#e8edf5" : C.textDim, background: mode === m ? "rgba(77,184,255,0.13)" : "rgba(255,255,255,0.03)", border: `1px solid ${mode === m ? "rgba(77,184,255,0.4)" : C.border}` }}>
                  {m === "scripts" ? "📝 Paste scripts" : "📺 From YouTube channel"}
                </button>
              ))}
            </div>

            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={mode === "channel" ? "Voice name (optional — defaults to channel name)" : "Voice name (e.g. My Voice, Hormozi Style)"}
              style={{ width: "100%", height: 42, borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(0,0,0,0.25)", color: C.textBright, padding: "0 14px", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 10 }}
            />

            {mode === "scripts" ? (
              <textarea
                value={samples}
                onChange={e => setSamples(e.target.value)}
                placeholder={"Paste 2-3 scripts or video transcripts in this voice...\n\nThe more representative the samples, the better the match."}
                style={{ width: "100%", minHeight: 150, borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(0,0,0,0.25)", color: C.textBright, padding: "12px 14px", fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 }}
              />
            ) : (
              <>
                <input
                  value={channel}
                  onChange={e => setChannel(e.target.value)}
                  placeholder="Channel URL or @handle (e.g. @AlexHormozi)"
                  style={{ width: "100%", height: 42, borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(0,0,0,0.25)", color: C.textBright, padding: "0 14px", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 6 }}
                />
                <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.5, marginBottom: 10 }}>
                  Skripr pulls transcripts from the channel's top videos and learns the voice from them.
                </div>
              </>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={build}
                disabled={building || (mode === "scripts" ? !canBuildFromScripts : !canBuildFromChannel)}
                style={{ padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#fff", border: "none", cursor: building ? "wait" : "pointer", background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", opacity: building || (mode === "scripts" ? !canBuildFromScripts : !canBuildFromChannel) ? 0.6 : 1 }}
              >
                {building ? (mode === "channel" ? "Fetching transcripts & analyzing..." : "Analyzing the voice...") : (reanalyzeTarget ? "Re-analyze Voice" : "Build Voice Profile")}
              </button>
              <button onClick={() => { setShowForm(false); setError(null); setReanalyzeTarget(null); }} style={{ background: "none", border: "none", color: C.textDim, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>
                Cancel
              </button>
              {mode === "scripts" && (
                <span style={{ fontSize: 11, color: C.textDim, marginLeft: "auto" }}>
                  {samples.trim().length < 400 ? `${400 - samples.trim().length} more characters needed` : `${samples.trim().length.toLocaleString()} characters`}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
