"use client";
import { useState, useEffect } from "react";

const C = {
  card: "#0d1520", border: "rgba(77,184,255,0.12)",
  accentDim: "#4db8ff", textBright: "#e8edf5", textDim: "#7a9bb5", green: "#34d399",
};

export function VoiceMatchCard() {
  const [profile, setProfile] = useState<{ styleGuide: string; updatedAt: string } | null>(null);
  const [samples, setSamples] = useState("");
  const [building, setBuilding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/voice-profile")
      .then(r => r.json())
      .then(d => setProfile(d.profile ?? null))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function buildProfile() {
    setBuilding(true); setError(null);
    try {
      const res = await fetch("/api/voice-profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to build profile");
      setProfile(data.profile);
      setSamples("");
      setEditing(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBuilding(false);
    }
  }

  async function removeProfile() {
    await fetch("/api/voice-profile", { method: "DELETE" }).catch(() => {});
    setProfile(null);
    setEditing(false);
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.textBright }}>🎙️ Voice Match</div>
        {profile && !editing && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)", color: C.green }}>ACTIVE</span>
        )}
      </div>
      <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, marginBottom: 14 }}>
        Paste 2–3 of your past scripts (or video transcripts) and Skripr learns your voice — sentence rhythm,
        humor, signature phrases, CTA style. Every script you generate after that sounds like you, not a generic narrator.
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 12.5, marginBottom: 12 }}>{error}</div>
      )}

      {!loaded ? (
        <div style={{ fontSize: 12, color: C.textDim }}>Loading...</div>
      ) : profile && !editing ? (
        <>
          <div style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12, maxHeight: 180, overflowY: "auto" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.accentDim, letterSpacing: 0.6, marginBottom: 8 }}>YOUR VOICE PROFILE</div>
            <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{profile.styleGuide}</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setEditing(true)} style={{ padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: C.accentDim, background: "rgba(77,184,255,0.08)", border: "1px solid rgba(77,184,255,0.2)", cursor: "pointer" }}>
              Rebuild with new samples
            </button>
            <button onClick={removeProfile} style={{ padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: "#fca5a5", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>
              Remove
            </button>
          </div>
        </>
      ) : (
        <>
          <textarea
            value={samples}
            onChange={e => setSamples(e.target.value)}
            placeholder={"Paste 2-3 of your past scripts or video transcripts here...\n\nThe more representative the samples, the better the match."}
            style={{ width: "100%", minHeight: 160, borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(0,0,0,0.25)", color: C.textBright, padding: "12px 14px", fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={buildProfile}
              disabled={building || samples.trim().length < 400}
              style={{ padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#fff", border: "none", cursor: building ? "wait" : "pointer", background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", opacity: building || samples.trim().length < 400 ? 0.6 : 1 }}
            >
              {building ? "Analyzing your voice..." : "Build My Voice Profile"}
            </button>
            {editing && (
              <button onClick={() => { setEditing(false); setError(null); }} style={{ background: "none", border: "none", color: C.textDim, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>
                Cancel
              </button>
            )}
            <span style={{ fontSize: 11, color: C.textDim, marginLeft: "auto" }}>
              {samples.trim().length < 400 ? `${Math.max(0, 400 - samples.trim().length)} more characters needed` : `${samples.trim().length.toLocaleString()} characters`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
