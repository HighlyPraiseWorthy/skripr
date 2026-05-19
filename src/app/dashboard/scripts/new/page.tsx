"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const C = {
  bg: "#0b0b17", cardBg: "#12122a", border: "rgba(99,102,241,0.12)",
  accent: "#818cf8", text: "#e2e8f0", textDim: "#64748b",
  textBright: "#f1f5f9", danger: "#f87171", badgeBg: "rgba(99,102,241,0.12)", badgeText: "#a5b4fc",
};
const grad = "linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)";

type Step = "input" | "generating" | "result";
type InputMode = "url" | "paste";

interface GeneratedScript {
  title: string; content: string; hook: string;
  fullScript?: string; sections?: unknown[]; structurePattern?: string;
  niche?: string; wordCount: number; estimatedDuration: number;
}

function InputGroup({ label, hint, required, children, style }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>
        {label}{required && <span style={{ color: C.danger, marginLeft: 4 }}>*</span>}
      </label>
      {hint && <p style={{ color: C.textDim, fontSize: 12, marginBottom: 6, marginTop: -4 }}>{hint}</p>}
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 12,
  background: "#1a1a3a", color: C.text, fontSize: 14, fontWeight: 500,
  border: `1px solid ${C.border}`, outline: "none",
} as React.CSSProperties;

export default function NewScriptPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [pastedTranscript, setPastedTranscript] = useState("");
  const [niche, setNiche] = useState("");
  const [topic, setTopic] = useState("");
  const [videoLength, setVideoLength] = useState<"short" | "medium" | "long" | "ultraLong">("long");
  const [transcriptText, setTranscriptText] = useState("");
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [nicheBendSource, setNicheBendSource] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("topic");
    const n = params.get("niche");
    const adj = params.get("adjacent");
    if (t) { setTopic(t); setNicheBendSource(t); }
    if (n && adj) setNiche(`${n} × ${adj}`);
    else if (n) setNiche(n);
    // Auto-fire generation if coming from Niche Bend
    if (t) {
      setStep("generating");
      const topicVal = t;
      const nicheVal = n || "";
      fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "", topic: topicVal, niche: nicheVal, videoLength: "medium" }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.error) { setError(data.error); setStep("input"); }
          else { setGeneratedScript(data); setStep("result"); }
        })
        .catch(e => { setError(e.message); setStep("input"); });
    }
  }, []);

  async function handleExtractOrProceed() {
    setError(null);
    if (inputMode === "paste") {
      if (!pastedTranscript.trim()) { setError("Please paste a transcript first."); return; }
      setTranscriptText(pastedTranscript.trim());
      await runGenerate(pastedTranscript.trim());
    } else {
      if (!youtubeUrl.trim()) {
        if (nicheBendSource) { await runGenerate(""); return; }
        setError("Please enter a YouTube URL."); return;
      }
      setExtracting(true);
      try {
        const res = await fetch("/api/transcript", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ youtubeUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to extract transcript");
        setTranscriptText(data.transcript);
        await runGenerate(data.transcript);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to extract transcript");
      } finally {
        setExtracting(false);
      }
    }
  }

  async function runGenerate(transcript: string) {
    setStep("generating");
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, niche: niche || undefined, topic: topic || undefined, videoLength,
          sourceVideoId: youtubeUrl ? youtubeUrl.match(/[?&]v=([^&]+)/)?.[1] : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate script");
      setGeneratedScript({
        title: data.title, content: data.fullScript || data.content, hook: data.hook,
        structurePattern: data.sections?.length ? `${data.sections.length}-section` : undefined,
        niche: data.niche || niche, wordCount: data.wordCount, estimatedDuration: data.estimatedDuration,
      });
      setStep("result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate script");
      setStep("input");
    }
  }

  async function saveScript() {
    if (!generatedScript) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/scripts/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: generatedScript.title, content: generatedScript.fullScript || generatedScript.content,
          niche: generatedScript.niche, topic: topic || null,
          wordCount: generatedScript.wordCount, estimatedDuration: generatedScript.estimatedDuration,
          sourceVideoId: youtubeUrl ? youtubeUrl.match(/[?&]v=([^&]+)/)?.[1] : null,
          structurePattern: generatedScript.structurePattern,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save script");
      router.push("/dashboard/scripts");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save script");
    } finally {
      setSaving(false);
    }
  }

  const canProceed = inputMode === "url" ? youtubeUrl.trim().length > 0 : pastedTranscript.trim().length > 50;

  return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
      <div aria-hidden style={{ position: "fixed", top: -160, right: -100, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.14) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto" }}>
        <Link href="/dashboard/scripts" style={{ color: C.accent, fontSize: 13, fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}>
          <span style={{ fontSize: 14 }}>←</span> Back to Scripts
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, marginBottom: 4 }}>New Script</h1>
        <p style={{ color: C.textDim, fontSize: 14, marginBottom: 28 }}>Generate a viral script from a YouTube video or paste your own transcript</p>

        {error && (
          <div style={{ borderRadius: 14, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", padding: "14px 18px", marginBottom: 20 }}>
            <p style={{ color: C.danger, fontSize: 14 }}>{error}</p>
          </div>
        )}

        {/* ─── INPUT STEP ─── */}
        {step === "input" && (
          <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px" }}>
            {/* Tab switcher */}
            <div style={{ display: "flex", gap: 4, marginBottom: 22, background: "rgba(99,102,241,0.06)", borderRadius: 12, padding: 4 }}>
              {(["url", "paste"] as InputMode[]).map(mode => (
                <button key={mode} onClick={() => setInputMode(mode)} style={{
                  flex: 1, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                  border: "none", cursor: "pointer", transition: "all 0.15s",
                  background: inputMode === mode ? grad : "transparent",
                  color: inputMode === mode ? "#fff" : C.textDim,
                }}>
                  {mode === "url" ? "🔗  YouTube URL" : "📋  Paste Transcript"}
                </button>
              ))}
            </div>

            {inputMode === "url" ? (
              <div>
                <InputGroup label="YouTube Video URL" hint="Paste any public YouTube video link" required>
                  <input type="text" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..." style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"}
                    onBlur={e => e.currentTarget.style.borderColor = C.border} />
                </InputGroup>
                {/* How to get transcript tip */}
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.10)" }}>
                  <p style={{ color: C.textDim, fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                    💡 <strong style={{ color: C.accent }}>Tip:</strong> If auto-extraction fails, switch to "Paste Transcript" — on YouTube, click <strong style={{ color: C.textBright }}>⋯ → Show transcript</strong> and paste it here.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <InputGroup label="Paste Transcript" hint='On YouTube: click "⋯" below the video → "Show transcript" → copy all text' required>
                  <textarea value={pastedTranscript} onChange={e => setPastedTranscript(e.target.value)}
                    placeholder="Paste the full transcript text here..."
                    rows={10}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, fontFamily: "inherit" }} />
                </InputGroup>
                {pastedTranscript.trim().length > 0 && (
                  <p style={{ color: C.textDim, fontSize: 12, marginTop: 6 }}>
                    ~{pastedTranscript.trim().split(/\s+/).length.toLocaleString()} words
                  </p>
                )}
              </div>
            )}

            <InputGroup label="Niche (optional)" hint="e.g. fitness, tech, science" style={{ marginTop: 16 }}>
              <input type="text" value={niche} onChange={e => setNiche(e.target.value)}
                placeholder="e.g., fitness, tech, cooking" style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"}
                onBlur={e => e.currentTarget.style.borderColor = C.border} />
            </InputGroup>

            <InputGroup label="Topic (optional)" hint="What should the script be about?" style={{ marginTop: 16 }}>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="e.g., morning routine, product review" style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"}
                onBlur={e => e.currentTarget.style.borderColor = C.border} />
            </InputGroup>

            <button onClick={handleExtractOrProceed} disabled={!canProceed || extracting}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 24px", borderRadius: 14, background: grad, color: "#fff",
                fontSize: 14, fontWeight: 600, border: "none", width: "100%", marginTop: 20,
                cursor: !canProceed || extracting ? "not-allowed" : "pointer",
                opacity: !canProceed || extracting ? 0.5 : 1,
                boxShadow: "0 0 22px rgba(99,102,241,0.30)",
              }}>
              {extracting ? "Extracting transcript…" : inputMode === "url" ? "Extract & Generate Script" : "✦ Generate Script"}
            </button>
          </div>
        )}

        {/* ─── GENERATING ─── */}
        {step === "generating" && (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: 52, marginBottom: 18, filter: "drop-shadow(0 0 20px rgba(99,102,241,0.45))" }}>✦</div>
            <p style={{ color: C.textBright, fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Generating your script…</p>
            <p style={{ color: C.textDim, fontSize: 14, lineHeight: 1.6 }}>Analyzing structure and crafting viral content</p>
            <div style={{ maxWidth: 320, margin: "28px auto 0", height: 3, borderRadius: 2, background: C.border, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "60%", borderRadius: 2, background: grad }} />
            </div>
          </div>
        )}

        {/* ─── RESULT ─── */}
        {step === "result" && generatedScript && (
          <div>
            <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {generatedScript.niche && <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: C.badgeBg, color: C.badgeText, textTransform: "uppercase" }}>{generatedScript.niche}</span>}
                {generatedScript.structurePattern && <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.10)", color: "#a5b4fc" }}>{generatedScript.structurePattern}</span>}
                <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.08)", color: C.textDim }}>{(generatedScript.wordCount || 0).toLocaleString()} words</span>
                <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.08)", color: C.textDim }}>~{generatedScript.estimatedDuration || 5} min</span>
              </div>
              <h2 style={{ fontSize: 21, fontWeight: 700, color: C.textBright, letterSpacing: -0.3, marginBottom: 16 }}>{generatedScript.title}</h2>
              {generatedScript.hook && (
                <div style={{ borderRadius: 14, padding: "14px 16px", marginBottom: 16, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.16)" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: 0.5, marginBottom: 5 }}>HOOK</p>
                  <p style={{ fontSize: 14, color: C.textBright, lineHeight: 1.6 }}>{generatedScript.hook}</p>
                </div>
              )}
              <div style={{ maxHeight: 440, overflowY: "auto", borderRadius: 14, border: `1px solid ${C.border}` }}>
                <div style={{ padding: 20 }}>
                  <p style={{ fontSize: 14, color: C.textBright, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{generatedScript.fullScript || generatedScript.content}</p>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button onClick={() => setStep("input")} style={{ flex: 1, padding: "12px 20px", borderRadius: 14, background: "rgba(99,102,241,0.08)", color: C.accent, fontSize: 14, fontWeight: 500, border: "1px solid rgba(99,102,241,0.18)", cursor: "pointer" }}>
                ← Regenerate
              </button>
              <button onClick={saveScript} disabled={saving} style={{ flex: 2, padding: "12px 20px", borderRadius: 14, background: grad, color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1, boxShadow: "0 0 22px rgba(99,102,241,0.30)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {saving ? "Saving…" : "✦ Save Script"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
