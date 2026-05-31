"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const C = {
  bg: "#0a0a0f", card: "#13131a", border: "rgba(255,255,255,0.07)",
  accent: "#6366f1", accentDim: "#818cf8", textBright: "#f1f5f9",
  textDim: "#64748b", badgeBg: "rgba(99,102,241,0.12)",
};

type SavedFormula = {
  id: string;
  formula: string;
  hookType: string;
  psychology: string;
  remixFramework?: string;
  savedAt: string;
};

export default function FormulasPage() {
  const [formulas, setFormulas] = useState<SavedFormula[]>([]);

  useEffect(() => {
    try {
      const sf = JSON.parse(localStorage.getItem("skripr_saved_formulas") || "[]");
      setFormulas(sf);
    } catch {}
  }, []);

  function deleteFormula(id: string) {
    const updated = formulas.filter(f => f.id !== id);
    setFormulas(updated);
    localStorage.setItem("skripr_saved_formulas", JSON.stringify(updated));
  }

  function useFormula(f: SavedFormula) {
    const params = new URLSearchParams({
      remixFramework: f.remixFramework || "",
      hookType: f.hookType,
      titleFormula: f.formula,
      selectedTitle: "",
    });
    window.location.href = `/dashboard/scripts/new?${params.toString()}`;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>📋</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, letterSpacing: -0.3 }}>Formula Library</h1>
          </div>
          <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>
            Your saved title formulas from Viral Remixer. Click <strong style={{ color: C.accentDim }}>Use</strong> to generate a script with that formula.
          </p>
        </div>

        {formulas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.textBright, marginBottom: 6 }}>No saved formulas yet</div>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 20, maxWidth: 320, margin: "0 auto 20px" }}>
              Analyze a viral video in Viral Remixer, then click <strong style={{ color: C.accentDim }}>💾 Save Formula</strong> to build your library.
            </div>
            <Link
              href="/dashboard/viral-remixer"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", background: C.accent, color: "#fff", borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
            >
              🔥 Go to Viral Remixer
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: C.textDim }}>{formulas.length} formula{formulas.length !== 1 ? "s" : ""} saved</span>
              <Link href="/dashboard/viral-remixer" style={{ fontSize: 12, color: C.accentDim, textDecoration: "none", fontWeight: 600 }}>
                + Analyze new video →
              </Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {formulas.map(f => (
                <div key={f.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px" }}>
                  {/* Hook type badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: C.badgeBg, color: C.accentDim, letterSpacing: 0.4 }}>
                      {f.hookType.toUpperCase()} HOOK
                    </span>
                    <span style={{ fontSize: 11, color: C.textDim, marginLeft: "auto" }}>
                      {new Date(f.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>

                  {/* Formula pattern */}
                  <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: C.accentDim, fontFamily: "monospace", fontWeight: 600, lineHeight: 1.6 }}>{f.formula}</div>
                  </div>

                  {/* Psychology */}
                  {f.psychology && (
                    <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, marginBottom: 12 }}>{f.psychology}</div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => useFormula(f)}
                      style={{ flex: 1, height: 36, background: C.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                    >
                      ↗ Use Formula
                    </button>
                    <button
                      onClick={() => deleteFormula(f.id)}
                      style={{ width: 36, height: 36, background: "none", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, color: "#ef4444", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      title="Delete formula"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
