"use client";

import { useState, useEffect } from "react";

const C = {
  accent: "#818cf8",
  textDim: "#64748b",
  textBright: "#f1f5f9",
};

const BTN: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
  cursor: "pointer", border: "1px solid rgba(99,102,241,0.20)",
  background: "rgba(99,102,241,0.08)", color: "#818cf8",
  display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
};

export function ScriptExportBar({ title, content }: { title: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const wordCount = content.trim().split(/\s+/).length;
  const estMinutes = Math.round(wordCount / 140);

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
      #skripr-print-root { display: none; position: fixed; top: 0; left: 0; width: 100%;
        background: #fff; z-index: 99999; font-family: Georgia, serif; padding: 2cm; }
      #skripr-print-root h1 { font-size: 20px; color: #111; margin-bottom: 8px; font-family: -apple-system, sans-serif; }
      #skripr-print-root .meta { font-size: 11px; color: #666; margin-bottom: 24px; font-family: -apple-system, sans-serif; }
      #skripr-print-root .body { font-size: 14px; line-height: 1.9; color: #111; white-space: pre-wrap; }
    `;
    document.head.appendChild(style);
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(`${title}\n\n${content}`).then(() => {
      setCopied(true);
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
    let root = document.getElementById("skripr-print-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "skripr-print-root";
      document.body.appendChild(root);
    }
    root.innerHTML = `<h1>${title.replace(/</g, "&lt;")}</h1><div class="meta">${wordCount} words &nbsp;·&nbsp; ~${estMinutes} min &nbsp;·&nbsp; ${new Date().toLocaleDateString()} &nbsp;·&nbsp; skripr.vercel.app</div><div class="body">${content.replace(/</g, "&lt;")}</div>`;
    window.print();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, color: C.textDim, marginRight: 4 }}>
        {wordCount} words · ~{estMinutes} min
      </span>
      <div style={{ flex: 1 }} />
      <button onClick={handleCopy} style={{
        ...BTN,
        background: copied ? "rgba(52,211,153,0.12)" : BTN.background,
        borderColor: copied ? "rgba(52,211,153,0.3)" : "rgba(99,102,241,0.20)",
        color: copied ? "#34d399" : C.accent,
      }}>
        {copied ? "✓ Copied" : "📋 Copy Script"}
      </button>
      <button onClick={handleTXT} style={BTN}>⬇ Download TXT</button>
      <button onClick={handlePDF} style={BTN}>🖨 Export PDF</button>
    </div>
  );
}
