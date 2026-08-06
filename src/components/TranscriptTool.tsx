"use client";
import { useState } from "react";
import Link from "next/link";

const C = {
  bg: "#080c12", card: "#0d1520", borderAccent: "rgba(77,184,255,0.30)",
  accent: "#1a8fd1", accentDim: "#4db8ff", text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8",
};

type Result = { transcript: string; title: string; channelTitle: string; words: number; readingMinutes: number };

export default function TranscriptTool() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    if (!url.trim()) { setError("Paste a YouTube link first."); return; }
    setLoading(true); setError(null); setRes(null);
    try {
      const r = await fetch("/api/youtube-transcript", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: url }),
      });
      // A gateway error or timeout returns an HTML body, and r.json() would then
      // throw a SyntaxError that surfaced to the user as "Unexpected token '<'".
      const data = await r.json().catch(() => null);
      if (!data) throw new Error("Could not get that transcript, please try again");
      if (data.error) throw new Error(data.error);
      setRes(data);
    } catch (e: any) {
      setError(e?.message || "Something went wrong, try again");
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (!res) return;
    navigator.clipboard?.writeText(res.transcript).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }).catch(() => {});
  }

  // Carry the video into Skripr so the script flow starts from the same proven
  // video. localStorage survives the sign-up redirect (which drops query params).
  function handoff() {
    try { localStorage.setItem("skripr_pending_url", url.trim()); } catch {}
  }

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 15, outline: "none",
  } as const;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.borderAccent}`, borderRadius: 18, padding: "24px 24px 26px" }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.dim, letterSpacing: 0.4, marginBottom: 7, textTransform: "uppercase" }}>
        YouTube video link
      </label>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && run()}
        placeholder="https://www.youtube.com/watch?v=..."
        style={{ ...inputStyle, marginBottom: 14 }}
      />

      <button onClick={run} disabled={loading} style={{
        width: "100%", height: 50, borderRadius: 12, border: "none",
        background: loading ? "rgba(77,184,255,0.14)" : "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)",
        color: loading ? C.accentDim : "#fff", fontSize: 16, fontWeight: 700, cursor: loading ? "wait" : "pointer",
      }}>
        {loading ? "Getting transcript..." : "Get transcript"}
      </button>

      {error && (
        <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 14 }}>{error}</div>
      )}

      {res && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: C.dim }}>
              {res.title ? <span style={{ color: C.muted, fontWeight: 600 }}>{res.title}</span> : "Transcript"}
              <span style={{ marginLeft: 8 }}>{res.words.toLocaleString()} words, about {res.readingMinutes} min read</span>
            </div>
            <button onClick={copy} style={{ fontSize: 13, fontWeight: 700, color: C.accentDim, background: "none", border: "1px solid rgba(77,184,255,0.3)", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>
              {copied ? "Copied" : "Copy transcript"}
            </button>
          </div>
          <div style={{ maxHeight: 340, overflowY: "auto", background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.16)", borderRadius: 12, padding: "16px 18px", fontSize: 14.5, color: C.muted, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
            {res.transcript}
          </div>

          <div style={{ marginTop: 22, padding: "20px 22px", borderRadius: 14, background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.22)", textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>That video worked. Now write yours.</div>
            <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>
              Skripr reverse-engineers the hook, structure, and pacing behind this video and writes a fresh script on your topic, in your voice. Two scripts free, no card.
            </div>
            <Link href="/sign-up" onClick={handoff} style={{ display: "inline-block", padding: "12px 28px", borderRadius: 10, background: C.accentDim, color: C.bg, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
              Turn this into my script
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
