"use client";
import { useState } from "react";
import Link from "next/link";
import { NAME_NICHES } from "@/lib/data/channel-name-niches";

const C = {
  bg: "#080c12", card: "#0d1520", border: "rgba(255,255,255,0.08)",
  borderAccent: "rgba(77,184,255,0.30)", accent: "#1a8fd1", accentDim: "#4db8ff",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8",
};

const STYLES = ["Catchy", "Clean", "Funny", "Bold", "Minimal", "Brandable"];

type NameIdea = { name: string; vibe: string };

export default function ChannelNameGenerator({ defaultNiche = "" }: { defaultNiche?: string }) {
  const [niche, setNiche] = useState(defaultNiche);
  const [keywords, setKeywords] = useState("");
  const [style, setStyle] = useState("Catchy");
  const [loading, setLoading] = useState(false);
  const [names, setNames] = useState<NameIdea[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/channel-name-generator", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, keywords, style, exclude: seen }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const fresh: NameIdea[] = Array.isArray(data.names) ? data.names : [];
      setNames(fresh);
      setSeen((prev) => Array.from(new Set([...prev, ...fresh.map((n) => n.name)])));
    } catch (e: any) {
      setError(e?.message || "Something went wrong, try again");
    } finally {
      setLoading(false);
    }
  }

  function copy(name: string) {
    navigator.clipboard?.writeText(name).then(() => {
      setCopied(name);
      setTimeout(() => setCopied(null), 1200);
    }).catch(() => {});
  }

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 15, outline: "none",
  } as const;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.borderAccent}`, borderRadius: 18, padding: "24px 24px 26px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.dim, letterSpacing: 0.4, marginBottom: 7, textTransform: "uppercase" }}>Niche or format</label>
          <select value={niche} onChange={(e) => setNiche(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="">Any</option>
            {NAME_NICHES.map((n) => (
              <option key={n.id} value={n.name}>{n.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.dim, letterSpacing: 0.4, marginBottom: 7, textTransform: "uppercase" }}>Vibe</label>
          <select value={style} onChange={(e) => setStyle(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.dim, letterSpacing: 0.4, marginBottom: 7, textTransform: "uppercase" }}>Words or themes (optional)</label>
      <input
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && generate()}
        placeholder="e.g. cozy, late night, beginner friendly"
        style={{ ...inputStyle, marginBottom: 16 }}
      />

      <button
        onClick={generate}
        disabled={loading}
        style={{
          width: "100%", height: 50, borderRadius: 12, border: "none",
          background: loading ? "rgba(77,184,255,0.14)" : "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)",
          color: loading ? C.accentDim : "#fff", fontSize: 16, fontWeight: 700,
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "Generating names..." : names.length ? "Generate more names" : "Generate channel names"}
      </button>

      {error && (
        <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 14 }}>{error}</div>
      )}

      {names.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginTop: 20 }}>
            {names.map((n, i) => (
              <button
                key={i}
                onClick={() => copy(n.name)}
                title="Click to copy"
                style={{
                  textAlign: "left", background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.16)",
                  borderRadius: 12, padding: "13px 15px", cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 15.5, fontWeight: 700, color: C.text }}>{n.name}</div>
                <div style={{ fontSize: 12.5, color: C.dim, marginTop: 3 }}>{copied === n.name ? "Copied" : n.vibe}</div>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 22, padding: "20px 22px", borderRadius: 14, background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.22)", textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Got your name? Now write your first video.</div>
            <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>Skripr turns a proven video into a ready-to-record script in your voice. Two scripts free, no card.</div>
            <Link href="/sign-up" style={{ display: "inline-block", padding: "12px 28px", borderRadius: 10, background: C.accentDim, color: C.bg, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>Start free, 2 scripts</Link>
          </div>
        </>
      )}
    </div>
  );
}
