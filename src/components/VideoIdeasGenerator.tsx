"use client";
import { useState } from "react";
import Link from "next/link";

const C = {
  bg: "#080c12", card: "#0d1520", borderAccent: "rgba(77,184,255,0.30)",
  accent: "#1a8fd1", accentDim: "#4db8ff", text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8",
};

type Idea = { title: string; why: string };

export default function VideoIdeasGenerator() {
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [seen, setSeen] = useState<string[]>([]);

  async function generate() {
    if (!niche.trim()) { setError("Add your niche or topic first."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/youtube-video-ideas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, exclude: seen }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const fresh: Idea[] = Array.isArray(data.ideas) ? data.ideas : [];
      setIdeas(fresh);
      setSeen((p) => Array.from(new Set([...p, ...fresh.map((i) => i.title)])));
    } catch (e: any) {
      setError(e?.message || "Something went wrong, try again");
    } finally {
      setLoading(false);
    }
  }

  // Stash the idea so it survives the sign-up redirect (which drops query params),
  // and also pass it as prefillTopic for users who are already signed in.
  function handoff(title: string) {
    try { localStorage.setItem("skripr_pending_topic", title); } catch {}
  }

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 15, outline: "none",
  } as const;
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: C.dim, letterSpacing: 0.4, marginBottom: 7, textTransform: "uppercase" as const };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.borderAccent}`, borderRadius: 18, padding: "24px 24px 26px" }}>
      <label style={labelStyle}>Your niche or topic</label>
      <input
        value={niche}
        onChange={(e) => setNiche(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && generate()}
        placeholder="e.g. personal finance for beginners"
        style={{ ...inputStyle, marginBottom: 14 }}
      />

      <button onClick={generate} disabled={loading} style={{
        width: "100%", height: 50, borderRadius: 12, border: "none",
        background: loading ? "rgba(77,184,255,0.14)" : "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)",
        color: loading ? C.accentDim : "#fff", fontSize: 16, fontWeight: 700, cursor: loading ? "wait" : "pointer",
      }}>
        {loading ? "Generating..." : ideas.length > 0 ? "Generate more ideas" : "Generate video ideas"}
      </button>

      {error && (
        <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 14 }}>{error}</div>
      )}

      {ideas.length > 0 && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {ideas.map((idea, i) => (
            <div key={i} style={{ background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.16)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.35, marginBottom: 5 }}>{idea.title}</div>
              <div style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.55, marginBottom: 12 }}>{idea.why}</div>
              <Link
                href={`/dashboard/scripts/new?prefillTopic=${encodeURIComponent(idea.title)}`}
                onClick={() => handoff(idea.title)}
                style={{ display: "inline-block", fontSize: 13, fontWeight: 700, color: C.bg, background: C.accentDim, borderRadius: 8, padding: "8px 14px", textDecoration: "none" }}
              >
                Turn this into a script →
              </Link>
            </div>
          ))}
        </div>
      )}

      {ideas.length > 0 && (
        <div style={{ marginTop: 22, padding: "20px 22px", borderRadius: 14, background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.22)", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Got an idea worth making?</div>
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>Pick one above and Skripr writes the full script in your voice. Your idea carries straight into the topic box. Two scripts free, no card.</div>
          <Link href="/sign-up" style={{ display: "inline-block", padding: "12px 28px", borderRadius: 10, background: C.accentDim, color: C.bg, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </div>
      )}
    </div>
  );
}
