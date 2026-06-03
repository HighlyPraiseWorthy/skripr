"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

const C = {
  bg: "#0b0b17",
  cardBg: "#12122a",
  border: "rgba(99,102,241,0.12)",
  accent: "#818cf8",
  text: "#e2e8f0",
  textDim: "#64748b",
  textBright: "#f1f5f9",
  success: "#10b981",
  danger: "#f87171",
};

export default function ABTitlesPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [savedTitles, setSavedTitles] = useState<string[]>([]);
  const [copiedTitle, setCopiedTitle] = useState<string | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem("skripr_meta_saved");
      if (s) setSavedTitles(JSON.parse(s));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("skripr_meta_saved", JSON.stringify(savedTitles));
    } catch {}
  }, [savedTitles]);

  const removeTitle = (t: string) => setSavedTitles(prev => prev.filter(x => x !== t));
  const copyTitle = (t: string) => {
    navigator.clipboard.writeText(t).catch(() => {});
    setCopiedTitle(t);
    setTimeout(() => setCopiedTitle(null), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 24px", maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, margin: 0 }}>A/B Title Testing</h1>
          {savedTitles.length > 0 && (
            <button
              onClick={() => setSavedTitles([])}
              style={{ fontSize: 12, color: C.textDim, cursor: "pointer", background: "none", border: "none", padding: 0 }}
            >
              Clear all
            </button>
          )}
        </div>
        <p style={{ fontSize: 14, color: C.textDim, margin: 0 }}>
          Titles you starred in the Metadata Generator. Use one at a time, check CTR after 48 hours, then swap.
        </p>
      </div>

      {savedTitles.length === 0 ? (
        /* Empty state */
        <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>☆</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.textBright, marginBottom: 8 }}>No saved titles yet</p>
          <p style={{ fontSize: 13, color: C.textDim, marginBottom: 24, lineHeight: 1.6 }}>
            Go to Metadata Generator, generate titles for your video,<br />and click the ☆ star on any title to save it here.
          </p>
          <Link
            href="/dashboard/metadata"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#7c3aed)", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
          >
            Open Metadata Generator
          </Link>
        </div>
      ) : (
        <>
          {/* A/B strategy tip */}
          <div style={{ borderRadius: 14, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.18)", padding: "14px 18px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16, marginTop: 1 }}>💡</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.success, margin: "0 0 4px 0", letterSpacing: 0.3, textTransform: "uppercase" }}>A/B Testing Workflow</p>
              <p style={{ fontSize: 12, color: C.textDim, margin: 0, lineHeight: 1.6 }}>
                Pick one title → upload video → wait 48 hours → check CTR in YouTube Studio.<br />
                If CTR is below 4%, swap to the next title. Repeat until you find the winner.
              </p>
            </div>
          </div>

          {/* Title list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {savedTitles.map((t, i) => (
              <div
                key={i}
                style={{ borderRadius: 14, background: C.cardBg, border: `1px solid ${C.border}`, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: C.textDim, minWidth: 20 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 14, color: C.textBright, fontWeight: 500, lineHeight: 1.4 }}>{t}</span>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => copyTitle(t)}
                    style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: copiedTitle === t ? "rgba(16,185,129,0.12)" : "rgba(99,102,241,0.10)", border: `1px solid ${copiedTitle === t ? "rgba(16,185,129,0.35)" : "rgba(99,102,241,0.25)"}`, color: copiedTitle === t ? C.success : C.accent, transition: "all 0.12s", whiteSpace: "nowrap" }}
                  >
                    {copiedTitle === t ? "✓ Copied" : "Copy"}
                  </button>
                  <button
                    onClick={() => removeTitle(t)}
                    style={{ padding: "6px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: C.danger }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add more link */}
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <Link
              href="/dashboard/metadata"
              style={{ fontSize: 13, color: C.textDim, textDecoration: "none" }}
            >
              ☆ Add more titles from Metadata Generator
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
