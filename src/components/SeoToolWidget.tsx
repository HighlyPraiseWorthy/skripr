"use client";
import { useState } from "react";
import Link from "next/link";
import type { SeoToolId } from "@/lib/data/seo-tools";

const C = {
  bg: "#080c12", card: "#0d1520", borderAccent: "rgba(77,184,255,0.30)",
  accent: "#1a8fd1", accentDim: "#4db8ff", text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8",
};

const TITLE_STYLES = ["Catchy", "Curiosity", "Bold", "Clean"];

export default function SeoToolWidget({ tool, inputLabel, placeholder }: { tool: SeoToolId; inputLabel: string; placeholder: string }) {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [style, setStyle] = useState("Catchy");
  const [keyPoints, setKeyPoints] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [tags, setTags] = useState<string[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [hooks, setHooks] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [seen, setSeen] = useState<string[]>([]);

  const hasResult = tags.length > 0 || titles.length > 0 || hooks.length > 0 || !!description;

  async function generate() {
    if (!topic.trim()) { setError("Add a video topic first."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/youtube-seo-tools", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, topic, keywords, style, keyPoints, exclude: seen }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (tool === "tags") {
        const fresh: string[] = Array.isArray(data.tags) ? data.tags : [];
        setTags(fresh);
        setSeen((p) => Array.from(new Set([...p, ...fresh])));
      } else if (tool === "title") {
        const fresh: string[] = Array.isArray(data.titles) ? data.titles : [];
        setTitles(fresh);
        setSeen((p) => Array.from(new Set([...p, ...fresh])));
      } else if (tool === "hook") {
        const fresh: string[] = Array.isArray(data.hooks) ? data.hooks : [];
        setHooks(fresh);
        setSeen((p) => Array.from(new Set([...p, ...fresh])));
      } else {
        setDescription(typeof data.description === "string" ? data.description : "");
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong, try again");
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string, label?: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label || text);
      setTimeout(() => setCopied(null), 1200);
    }).catch(() => {});
  }

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 15, outline: "none",
  } as const;
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: C.dim, letterSpacing: 0.4, marginBottom: 7, textTransform: "uppercase" as const };

  const noun = tool === "tags" ? "tags" : tool === "title" ? "titles" : tool === "hook" ? "hooks" : "description";
  const btnLabel = loading
    ? "Generating..."
    : hasResult
      ? (tool === "description" ? "Generate again" : `Generate more ${noun}`)
      : tool === "description" ? "Generate description" : `Generate ${noun}`;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.borderAccent}`, borderRadius: 18, padding: "24px 24px 26px" }}>
      <label style={labelStyle}>{inputLabel}</label>
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && generate()}
        placeholder={placeholder}
        style={{ ...inputStyle, marginBottom: 14 }}
      />

      {tool === "tags" && (
        <>
          <label style={labelStyle}>Extra keywords (optional)</label>
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. for beginners, 2026" style={{ ...inputStyle, marginBottom: 16 }} />
        </>
      )}
      {(tool === "title" || tool === "hook") && (
        <>
          <label style={labelStyle}>{tool === "hook" ? "Tone" : "Vibe"}</label>
          <select value={style} onChange={(e) => setStyle(e.target.value)} style={{ ...inputStyle, marginBottom: 16, cursor: "pointer" }}>
            {TITLE_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </>
      )}
      {tool === "description" && (
        <>
          <label style={labelStyle}>Key points (optional)</label>
          <textarea value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} placeholder="anything specific the video covers" rows={3} style={{ ...inputStyle, marginBottom: 16, resize: "vertical" }} />
        </>
      )}

      <button onClick={generate} disabled={loading} style={{
        width: "100%", height: 50, borderRadius: 12, border: "none",
        background: loading ? "rgba(77,184,255,0.14)" : "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)",
        color: loading ? C.accentDim : "#fff", fontSize: 16, fontWeight: 700, cursor: loading ? "wait" : "pointer",
      }}>
        {btnLabel}
      </button>

      {error && (
        <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 14 }}>{error}</div>
      )}

      {/* Tags result */}
      {tool === "tags" && tags.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.dim }}>{tags.length} tags</span>
            <button onClick={() => copy(tags.join(", "), "all")} style={{ fontSize: 13, fontWeight: 700, color: C.accentDim, background: "none", border: "1px solid rgba(77,184,255,0.3)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>
              {copied === "all" ? "Copied" : "Copy all"}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tags.map((t, i) => (
              <button key={i} onClick={() => copy(t)} title="Click to copy" style={{ fontSize: 13.5, color: C.muted, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.16)", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>
                {copied === t ? "Copied" : t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Titles result */}
      {tool === "title" && titles.length > 0 && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {titles.map((t, i) => (
            <button key={i} onClick={() => copy(t)} title="Click to copy" style={{ textAlign: "left", fontSize: 15.5, fontWeight: 600, color: C.text, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.16)", borderRadius: 10, padding: "12px 15px", cursor: "pointer" }}>
              {copied === t ? "Copied to clipboard" : t}
            </button>
          ))}
        </div>
      )}

      {/* Hooks result */}
      {tool === "hook" && hooks.length > 0 && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {hooks.map((t, i) => (
            <button key={i} onClick={() => copy(t)} title="Click to copy" style={{ textAlign: "left", fontSize: 15.5, fontWeight: 500, color: C.text, lineHeight: 1.5, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.16)", borderRadius: 10, padding: "13px 16px", cursor: "pointer" }}>
              {copied === t ? "Copied to clipboard" : t}
            </button>
          ))}
        </div>
      )}

      {/* Description result */}
      {tool === "description" && description && (
        <div style={{ marginTop: 20 }}>
          <div style={{ position: "relative", background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.16)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{description}</div>
          </div>
          <button onClick={() => copy(description, "desc")} style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: C.accentDim, background: "none", border: "1px solid rgba(77,184,255,0.3)", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>
            {copied === "desc" ? "Copied" : "Copy description"}
          </button>
        </div>
      )}

      {hasResult && (
        <div style={{ marginTop: 22, padding: "20px 22px", borderRadius: 14, background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.22)", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Now write the video that earns them.</div>
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>Skripr turns a proven video into a ready-to-record script in your voice. Two scripts free, no card.</div>
          <Link href="/sign-up" style={{ display: "inline-block", padding: "12px 28px", borderRadius: 10, background: C.accentDim, color: C.bg, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </div>
      )}
    </div>
  );
}
