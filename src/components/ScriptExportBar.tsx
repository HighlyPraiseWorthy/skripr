"use client";

import { useState, useEffect } from "react";

const C = {
  accent: "#818cf8",
  textDim: "#64748b",
  textBright: "#f1f5f9",
  border: "rgba(99,102,241,0.12)",
};

const BTN = {
  padding: "8px 16px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid rgba(99,102,241,0.20)",
  background: "rgba(99,102,241,0.08)",
  color: C.accent,
  display: "flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap" as const,
  transition: "background 150ms, border-color 150ms",
};

const TTS_TOOLS = [
  { name: "ElevenLabs", url: "https://elevenlabs.io/app/speech-synthesis", emoji: "🎙️" },
  { name: "Murf", url: "https://murf.ai/studio", emoji: "🔊" },
  { name: "Play.ht", url: "https://play.ht/studio", emoji: "▶️" },
];

export function ScriptExportBar({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  const [copied, setCopied] = useState(false);
  const [showTTS, setShowTTS] = useState(false);
  const wordCount = content.trim().split(/\s+/).length;
  const estMinutes = Math.round(wordCount / 140); // avg speaking pace

  // Inject print CSS once on mount
  useEffect(() => {
    const id = "skripr-print-css";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        #skripr-print-root { display: block !important; }
        @page { margin: 2cm; }
      }
      #skripr-print-root {
        display: none;
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: #fff;
        z-index: 99999;
        padding: 0;
        font-family: Georgia, serif;
      }
      #skripr-print-root h1 {
        font-size: 20px;
        color: #111;
        margin-bottom: 8px;
        font-family: -apple-system, sans-serif;
      }
      #skripr-print-root .meta {
        font-size: 11px;
        color: #666;
        margin-bottom: 24px;
        font-family: -apple-system, sans-serif;
      }
      #skripr-print-root .body {
        font-size: 14px;
        line-height: 1.9;
        color: #111;
        white-space: pre-wrap;
      }
    `;
    document.head.appendChild(style);
  }, []);

  function handleCopy() {
    const text = `${title}\n\n${content}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setShowTTS(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleTXT() {
    const text = `SKRIPR SCRIPT\n${"=".repeat(60)}\n\nTitle: ${title}\nWords: ${wordCount} (~${estMinutes} min)\nGenerated: ${new Date().toLocaleDateString()}\n\n${"=".repeat(60)}\n\n${content}`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePDF() {
    // Build the print-only div
    let root = document.getElementById("skripr-print-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "skripr-print-root";
      document.body.appendChild(root);
    }
    root.innerHTML = `
      <h1>${title.replace(/</g, "&lt;")}</h1>
      <div class="meta">${wordCount} words &nbsp;·&nbsp; ~${estMinutes} min &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString()} &nbsp;·&nbsp; skripr.vercel.app</div>
      <div class="body">${content.replace(/</g, "&lt;")}</div>
    `;
    window.print();
  }

  return (
    <div>
      {/* Export toolbar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 16,
        flexWrap: "wrap",
      }}>
        {/* Stats */}
        <span style={{ fontSize: 11, color: C.textDim, marginRight: 4 }}>
          {wordCount} words · ~{estMinutes} min
        </span>

        <div style={{ flex: 1 }} />

        {/* Copy */}
        <button onClick={handleCopy} style={{
          ...BTN,
          background: copied ? "rgba(52,211,153,0.12)" : BTN.background,
          borderColor: copied ? "rgba(52,211,153,0.3)" : "rgba(99,102,241,0.20)",
          color: copied ? "#34d399" : C.accent,
        }}>
          {copied ? "✓ Copied" : "📋 Copy Script"}
        </button>

        {/* TXT */}
        <button onClick={handleTXT} style={BTN}>
          ⬇ Download TXT
        </button>

        {/* PDF */}
        <button onClick={handlePDF} style={BTN}>
          🖨 Export PDF
        </button>
      </div>

      {/* TTS strip — appears after copy */}
      {showTTS && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: "rgba(52,211,153,0.06)",
          border: "1px solid rgba(52,211,153,0.18)",
          borderRadius: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 12, color: "#34d399", fontWeight: 600 }}>Script copied — open your TTS tool:</span>
          {TTS_TOOLS.map((t) => (
            <a
              key={t.name}
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: C.accent,
                background: "rgba(99,102,241,0.10)",
                border: "1px solid rgba(99,102,241,0.20)",
                padding: "4px 10px",
                borderRadius: 7,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              {t.emoji} {t.name}
            </a>
          ))}
          <button
            onClick={() => setShowTTS(false)}
            style={{ fontSize: 12, color: C.textDim, background: "none", border: "none", cursor: "pointer", marginLeft: "auto" }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
