"use client";

import { useState, useEffect, useRef } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { NICHES } from "@/lib/data/niches";

const C = {
  bg: "#0b0b17",
  cardBg: "#12122a",
  border: "rgba(99,102,241,0.12)",
  accent: "#818cf8",
  text: "#e2e8f0",
  textDim: "#64748b",
  textBright: "#f1f5f9",
  badgeBg: "rgba(99,102,241,0.12)",
  badgeText: "#a5b4fc",
  danger: "#f87171",
};

export default function MetadataPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [niche, setNiche] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const nicheOptions = NICHES.map(n => ({ value: n.id, label: n.name }));

  useEffect(() => {
    if (isLoaded && !isSignedIn) setError("auth");
  }, [isLoaded, isSignedIn]);

  async function handleGenerate() {
    if (!script.trim() || !title.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/metadata/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, title, niche }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate metadata");
      setMetadata(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }

  /* ══ AUTH ══ */
  if (error === "auth") {
    return (
      <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ borderRadius: 24, background: C.cardBg, border: `1px solid ${C.border}`, padding: 64, textAlign: "center" }}>
            <p style={{ color: C.textBright, fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Sign in to use Metadata Generator</p>
            <p style={{ color: C.textDim, fontSize: 15, marginBottom: 28 }}>Generate titles, descriptions, tags, and thumbnail text</p>
            <button onClick={() => openSignIn?.()} style={{ padding: "12px 28px", borderRadius: 14, background: "linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)", color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer", boxShadow: "0 0 22px rgba(99,102,241,0.30)" }}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
        <div style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: 64, textAlign: "center" }}><p style={{ color: C.textDim }}>Loading…</p></div>
      </div>
    );
  }

  return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
      <div aria-hidden style={{ position: "fixed", top: -160, right: -100, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.14) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden style={{ position: "fixed", bottom: -180, left: -120, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.09) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, marginBottom: 6 }}>Metadata Generator</h1>
          <p style={{ color: C.textDim, fontSize: 15, lineHeight: 1.6 }}>Generate titles, descriptions, tags, and thumbnail text</p>
        </div>

        {/* Input Card */}
        <div style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 16 }}>VIDEO INFO</div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>Working Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Your video title" style={{ width: "100%", padding: "10px 14px", borderRadius: 12, background: "#1a1a3a", color: C.text, fontSize: 14, fontWeight: 500, border: `1px solid ${C.border}`, outline: "none" }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>Niche</label>
            <select value={niche} onChange={e => setNiche(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 12, background: "#1a1a3a", color: C.text, fontSize: 14, fontWeight: 500, border: `1px solid ${C.border}`, outline: "none", cursor: "pointer" }}>
              <option value="">Select niche…</option>
              {nicheOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>Script / Content</label>
            <textarea
              ref={textareaRef}
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder="Paste your script or content outline…"
              style={{ width: "100%", padding: 14, borderRadius: 12, background: "#1a1a3a", color: C.text, fontSize: 14, border: `1px solid ${C.border}`, outline: "none", minHeight: 160, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading || !script.trim() || !title.trim()}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", borderRadius: 14, background: "linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)", color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: isLoading || !script.trim() || !title.trim() ? "not-allowed" : "pointer", opacity: isLoading || !script.trim() || !title.trim() ? 0.5 : 1, boxShadow: "0 0 22px rgba(99,102,241,0.30)" }}
          >
            {isLoading ? "Generating…" : "✦ Generate Metadata"}
          </button>
          {error && <p style={{ color: C.danger, fontSize: 13, marginTop: 10 }}>{error}</p>}
        </div>

        {/* Results */}
        {metadata && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Title options */}
            <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "20px 22px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 12 }}>TITLE OPTIONS</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {metadata.titles?.map((t: string, i: number) => (
                  <div key={i} style={{ padding: "10px 14px", borderRadius: 10, background: "#1a1a3a" }}>
                    <span style={{ fontSize: 12, color: C.textDim, marginRight: 10, fontWeight: 600 }}>{i + 1}.</span>
                    <span style={{ fontSize: 14, color: C.textBright, fontWeight: 500 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "20px 22px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 12 }}>DESCRIPTION</p>
              <pre style={{ fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>{metadata.description}</pre>
            </div>

            {/* Tags + Thumbnail */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Tags */}
              <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "20px 22px" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 12 }}>TAGS</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {metadata.tags?.map((tag: string, i: number) => (
                    <span key={i} style={{ padding: "4px 10px", borderRadius: 7, background: C.badgeBg, color: C.badgeText, fontSize: 12, fontWeight: 600 }>{tag}</span>
                  ))}
                </div>
              </div>

              {/* Thumbnail Text */}
              <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "20px 22px" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 12 }}>THUMBNAIL TEXT</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {metadata.thumbnailText?.map((t: string, i: number) => (
                    <span key={i} style={{ padding: "8px 12px", borderRadius: 8, background: "#1a1a3a", fontSize: 13, color: C.textBright, fontWeight: 500, border: `1px solid ${C.border}` }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
