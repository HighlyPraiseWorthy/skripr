"use client";
import { useState } from "react";
import { ScriptExportBar } from "@/components/ScriptExportBar";

interface ScriptVersion {
  content: string;
  savedAt: string;
  label: string;
  wordCount: number;
}

const C = {
  accent: "#818cf8",
  textDim: "#64748b",
  textBright: "#f1f5f9",
  text: "#e2e8f0",
  border: "rgba(99,102,241,0.12)",
  cardBg: "#12122a",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ScriptEditor({
  scriptId,
  initialContent,
  initialVersions,
  title,
}: {
  scriptId: string;
  initialContent: string;
  initialVersions: ScriptVersion[];
  title: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<ScriptVersion[]>(initialVersions);

  // Title generator state
  const [showTitles, setShowTitles] = useState(false);
  const [titles, setTitles] = useState<string[] | null>(null);
  const [generatingTitles, setGeneratingTitles] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState<number | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const isDirty = content !== savedContent;

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/scripts/${scriptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setVersions(data.versions || []);
      setSavedContent(content);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setContent(savedContent);
    setIsEditing(false);
    setSaveError(null);
  }

  function handleRestore(v: ScriptVersion) {
    setContent(v.content);
    setIsEditing(true);
    setShowHistory(false);
  }

  async function handleGenerateTitles() {
    if (generatingTitles) return;
    setGeneratingTitles(true);
    setShowTitles(true);
    setTitles(null);
    setCopiedTitle(null);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/titles`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTitles(data.titles || []);
      setTitleError(null);
    } catch (e: any) {
      setTitles([]);
      setTitleError(e.message || "Unknown error");
    } finally {
      setGeneratingTitles(false);
    }
  }

  function copyTitle(t: string, i: number) {
    navigator.clipboard.writeText(t).then(() => {
      setCopiedTitle(i);
      setTimeout(() => setCopiedTitle(null), 2000);
    });
  }

  return (
    <div>
      <ScriptExportBar title={title} content={content} />

      {/* ── SCRIPT header row ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", letterSpacing: 0.5, textTransform: "uppercase" }}>SCRIPT</span>
        <div style={{ flex: 1, height: 1, background: C.border }} />

        {/* Titles button */}
        <button
          onClick={handleGenerateTitles}
          disabled={generatingTitles}
          style={{ fontSize: 11, color: showTitles ? "#f472b6" : C.textDim, background: showTitles ? "rgba(244,114,182,0.08)" : "none", border: showTitles ? "1px solid rgba(244,114,182,0.22)" : "1px solid rgba(99,102,241,0.16)", borderRadius: 6, padding: "3px 9px", cursor: generatingTitles ? "wait" : "pointer", fontWeight: 600 }}
        >
          {generatingTitles ? "✨ Generating…" : "✨ Titles"}
        </button>

        {/* Version history toggle */}
        {versions.length > 0 && (
          <button
            onClick={() => setShowHistory(v => !v)}
            style={{ fontSize: 11, color: showHistory ? C.accent : C.textDim, background: showHistory ? "rgba(99,102,241,0.10)" : "none", border: showHistory ? "1px solid rgba(99,102,241,0.20)" : "none", borderRadius: 6, padding: "3px 9px", cursor: "pointer", fontWeight: 600 }}
          >
            🕐 {versions.length} version{versions.length !== 1 ? "s" : ""}
          </button>
        )}

        {/* Edit / Save / Cancel */}
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            style={{ fontSize: 11, color: C.textDim, background: "none", border: "1px solid rgba(99,102,241,0.16)", borderRadius: 6, padding: "3px 9px", cursor: "pointer", fontWeight: 600 }}
          >
            ✏️ Edit
          </button>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={handleCancel}
              style={{ fontSize: 11, color: C.textDim, background: "none", border: "1px solid rgba(99,102,241,0.16)", borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              style={{ fontSize: 11, fontWeight: 700, color: saveSuccess ? "#34d399" : "#fff", background: saveSuccess ? "rgba(52,211,153,0.15)" : saving ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg,#6366f1,#a855f7)", border: "none", borderRadius: 6, padding: "3px 12px", cursor: saving || !isDirty ? "not-allowed" : "pointer", opacity: !isDirty && !saveSuccess ? 0.5 : 1 }}
            >
              {saveSuccess ? "✓ Saved" : saving ? "Saving…" : "💾 Save"}
            </button>
          </div>
        )}
      </div>

      {/* ── Title generator panel ── */}
      {showTitles && (
        <div style={{ borderRadius: 12, background: "rgba(244,114,182,0.04)", border: "1px solid rgba(244,114,182,0.18)", padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#f472b6", letterSpacing: 0.6, textTransform: "uppercase", margin: 0 }}>✨ Title Variations</p>
            <button onClick={() => setShowTitles(false)} style={{ fontSize: 13, color: C.textDim, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>
          {generatingTitles && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ height: 38, borderRadius: 8, background: "rgba(244,114,182,0.06)", border: "1px solid rgba(244,114,182,0.10)", opacity: 0.5 + i * 0.1 }} />
              ))}
            </div>
          )}
          {!generatingTitles && titles && titles.length === 0 && (
            <div>
              <p style={{ fontSize: 13, color: "#f87171", margin: "0 0 6px" }}>Could not generate titles.</p>
              {titleError && <p style={{ fontSize: 11, color: C.textDim, margin: 0, fontFamily: "monospace" }}>{titleError}</p>}
            </div>
          )}
          {!generatingTitles && titles && titles.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {titles.map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: C.cardBg, border: `1px solid ${C.border}` }}>
                  <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.textBright, margin: 0, lineHeight: 1.4 }}>{t}</p>
                  <button
                    onClick={() => copyTitle(t, i)}
                    style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: copiedTitle === i ? "#34d399" : C.accent, background: copiedTitle === i ? "rgba(52,211,153,0.10)" : "rgba(99,102,241,0.10)", border: copiedTitle === i ? "1px solid rgba(52,211,153,0.20)" : "1px solid rgba(99,102,241,0.20)", borderRadius: 6, padding: "3px 10px", cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {copiedTitle === i ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              ))}
              <button
                onClick={handleGenerateTitles}
                style={{ marginTop: 4, fontSize: 11, color: "#f472b6", background: "none", border: "1px solid rgba(244,114,182,0.18)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontWeight: 600, alignSelf: "flex-start" }}
              >
                ↻ Regenerate
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Version history panel ── */}
      {showHistory && versions.length > 0 && (
        <div style={{ borderRadius: 12, background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.14)", padding: "14px 16px", marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 12 }}>Version History</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...versions].reverse().map((v, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: C.cardBg, border: `1px solid ${C.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textBright }}>{v.label}</span>
                  <span style={{ fontSize: 11, color: C.textDim, marginLeft: 8 }}>{timeAgo(v.savedAt)}</span>
                  <span style={{ fontSize: 11, color: C.textDim, marginLeft: 8 }}>{v.wordCount.toLocaleString()} words</span>
                </div>
                <button
                  onClick={() => handleRestore(v)}
                  style={{ fontSize: 11, fontWeight: 600, color: C.accent, background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.20)", borderRadius: 6, padding: "3px 10px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: C.textDim, margin: "10px 0 0" }}>Restoring loads the version into the editor — hit Save to make it current.</p>
        </div>
      )}

      {saveError && (
        <p style={{ fontSize: 12, color: "#f87171", marginBottom: 12 }}>{saveError}</p>
      )}

      {/* ── Content area ── */}
      {isEditing ? (
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          style={{
            width: "100%",
            minHeight: 480,
            fontSize: 15,
            color: C.textBright,
            lineHeight: 1.9,
            background: "#0f0f20",
            border: "1px solid rgba(99,102,241,0.25)",
            borderRadius: 12,
            padding: "16px 18px",
            resize: "vertical",
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
      ) : (
        <p style={{ fontSize: 15, color: C.textBright, lineHeight: 1.9, whiteSpace: "pre-wrap", margin: 0 }}>
          {content}
        </p>
      )}

      {isEditing && (
        <p style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>
          {wordCount.toLocaleString()} words — editing. Previous version saved to history on save.
        </p>
      )}
    </div>
  );
}
