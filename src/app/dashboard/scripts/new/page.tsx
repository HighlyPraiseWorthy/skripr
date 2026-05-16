"use client";

import React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/db/supabase";

const C = {
  bg: "#0b0b17",
  cardBg: "#12122a",
  border: "rgba(99,102,241,0.12)",
  accent: "#818cf8",
  text: "#e2e8f0",
  textDim: "#64748b",
  textBright: "#f1f5f9",
  danger: "#f87171",
  success: "#34d399",
  badgeBg: "rgba(99,102,241,0.12)",
  badgeText: "#a5b4fc",
};

type Step = "url" | "transcript" | "generating" | "result";

interface TranscriptData {
  youtubeUrl: string;
  videoId: string;
  transcript: string;
  wordCount: number;
  estimatedDuration: number;
  segmentCount: number;
}

interface GeneratedScript {
  title: string;
  content: string;
  hook: string;
  fullScript?: string;
  sections?: unknown[];
  structurePattern?: string;
  niche?: string;
  wordCount: number;
  estimatedDuration: number;
}

function sectionLine(key: string): string {
  const map: Record<string, string> = {
    violet: "linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)",
    pink: "linear-gradient(135deg,#ec4899,#f97316)",
    blue: "linear-gradient(135deg,#3b82f6,#06b6d4)",
    green: "linear-gradient(135deg,#10b981,#84cc16)",
  };
  return map[key] || map.violet;
}

export default function NewScriptPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("url");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [niche, setNiche] = useState("");
  const [topic, setTopic] = useState("");
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null);
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function extractTranscript() {
    setError(null);
    setStep("transcript");
    try {
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to extract transcript");
      setTranscriptData({
        youtubeUrl,
        videoId: data.videoId,
        transcript: data.transcript,
        wordCount: data.wordCount,
        estimatedDuration: data.estimatedDuration,
        segmentCount: data.segmentCount,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to extract transcript");
      setStep("url");
    }
  }

  async function generateScript() {
    if (!transcriptData) return;
    setError(null);
    setStep("generating");
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptData.transcript,
          niche: niche || undefined,
          topic: topic || undefined,
          sourceVideoId: transcriptData.videoId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate script");
      setGeneratedScript({
        title: data.title,
        content: data.fullScript || data.content,
        hook: data.hook,
        structurePattern: data.sections?.length ? `${data.sections.length}-section` : undefined,
        niche: data.niche || niche,
        wordCount: data.wordCount,
        estimatedDuration: data.estimatedDuration,
      });
      setStep("result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate script");
      setStep("transcript");
    }
  }

  async function saveScript() {
    if (!generatedScript || !transcriptData) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/scripts/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: generatedScript.title,
          content: generatedScript.content,
          niche: generatedScript.niche,
          topic: topic || null,
          wordCount: generatedScript.wordCount,
          estimatedDuration: generatedScript.estimatedDuration,
          sourceVideoId: transcriptData.videoId,
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

  /* ══ RENDER ══ */
  return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
      <div aria-hidden style={{ position: "fixed", top: -160, right: -100, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.14) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden style={{ position: "fixed", bottom: -180, left: -120, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.09) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <Link
          href="/dashboard/scripts"
          style={{ color: C.accent, fontSize: 13, fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}
        >
          <span style={{ fontSize: 14 }}>←</span> Back to Scripts
        </Link>

        <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, marginBottom: 4 }}>New Script</h1>
        <p style={{ color: C.textDim, fontSize: 14, marginBottom: 28 }}>Paste a YouTube URL to extract a transcript and generate a script</p>

        {/* Error banner */}
        {error && (
          <div style={{ borderRadius: 14, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", padding: "14px 18px", marginBottom: 20 }}>
            <p style={{ color: C.danger, fontSize: 14 }}>{error}</p>
          </div>
        )}

        {/* ─── STEP 1: URL ─── */}
        {step === "url" && (
          <div>
            <div
              style={{
                borderRadius: 18,
                background: C.cardBg,
                border: `1px solid ${C.border}`,
                padding: "22px 26px",
              }}
            >
              <InputGroup label="YouTube Video URL" hint="Paste any public YouTube video link" required>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 12,
                    background: "#1a1a3a", color: C.text, fontSize: 14, fontWeight: 500,
                    border: `1px solid ${C.border}`, outline: "none",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"}
                  onBlur={e => e.currentTarget.style.borderColor = C.border}
                />
              </InputGroup>

            <InputGroup label="Niche (optional)" hint="e.g. fitness, tech, cooking" style={{ marginTop: 16 }}>
              <input
                type="text"
                value={niche}
                onChange={e => setNiche(e.target.value)}
                placeholder="e.g., fitness, tech, cooking"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 12,
                  background: "#1a1a3a", color: C.text, fontSize: 14, fontWeight: 500,
                  border: `1px solid ${C.border}`, outline: "none",
                }}
                onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"}
                onBlur={e => e.currentTarget.style.borderColor = C.border}
              />
            </InputGroup>

            <InputGroup label="Topic (optional)" hint="e.g. morning routine, product review" style={{ marginTop: 16 }}>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g., morning routine, product review"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 12,
                  background: "#1a1a3a", color: C.text, fontSize: 14, fontWeight: 500,
                  border: `1px solid ${C.border}`, outline: "none",
                }}
                onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"}
                onBlur={e => e.currentTarget.style.borderColor = C.border}
              />
            </InputGroup>

              <button
                onClick={extractTranscript}
                disabled={!youtubeUrl.trim()}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 24px", borderRadius: 14,
                  background: sectionLine("violet"), color: "#fff",
                  fontSize: 14, fontWeight: 600, border: "none",
                  cursor: !youtubeUrl.trim() ? "not-allowed" : "pointer",
                  opacity: !youtubeUrl.trim() ? 0.45 : 1,
                  boxShadow: "0 0 22px rgba(99,102,241,0.30)",
                  marginTop: 20, width: "100%", justifyContent: "center",
                }}
              >
                Extract Transcript
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Transcript Review ─── */}
        {step === "transcript" && transcriptData && (
          <div>
            <div
              style={{
                borderRadius: 18, background: C.cardBg,
                border: `1px solid ${C.border}`, padding: "22px 26px",
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 12 }}>TRANSCRIPT PREVIEW</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 13, color: C.textDim, marginBottom: 16 }}>
                <span>Words: <strong style={{ color: C.textBright }}>{transcriptData.wordCount.toLocaleString()}</strong></span>
                <span>Duration: <strong style={{ color: C.textBright }}>~{transcriptData.estimatedDuration} min</strong></span>
                <span>Segments: <strong style={{ color: C.textBright }}>{transcriptData.segmentCount}</strong></span>
              </div>
              <div
                style={{
                  maxHeight: 320, overflowY: "auto", padding: 16,
                  borderRadius: 12, background: "#0d0d1f",
                  border: `1px solid ${C.border}`,
                }}
              >
                <p style={{ fontSize: 13, color: C.textBright, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {transcriptData.transcript.slice(0, 3000)}
                  {transcriptData.transcript.length > 3000 && "..."}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button
                onClick={() => setStep("url")}
                style={{
                  flex: 1, padding: "12px 20px", borderRadius: 14,
                  backgroundColor: "rgba(99,102,241,0.08)", color: C.accent,
                  fontSize: 14, fontWeight: 500,
                  border: "1px solid rgba(99,102,241,0.18)", cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                onClick={generateScript}
                style={{
                  flex: 2, padding: "12px 20px", borderRadius: 14,
                  background: sectionLine("violet"), color: "#fff",
                  fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
                  boxShadow: "0 0 22px rgba(99,102,241,0.30)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>✦</span>
                Generate Script
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Generating ─── */}
        {step === "generating" && (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div
              style={{
                fontSize: 52, marginBottom: 18,
                filter: "drop-shadow(0 0 20px rgba(99,102,241,0.45)) drop-shadow(0 0 40px rgba(99,102,241,0.20))",
              }}
            >
              ✦
            </div>
            <p style={{ color: C.textBright, fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Generating your script…</p>
            <p style={{ color: C.textDim, fontSize: 14, lineHeight: 1.6 }}>Analyzing transcript structure and crafting viral content</p>
            {/* Progress bar */}
            <div style={{ maxWidth: 320, margin: "28px auto 0", height: 3, borderRadius: 2, background: C.border, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "60%", borderRadius: 2, background: sectionLine("violet"), animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          </div>
        )}

        {/* ─── STEP 4: Result ─── */}
        {step === "result" && generatedScript && (
          <div>
            <div
              style={{
                borderRadius: 18, background: C.cardBg,
                border: `1px solid ${C.border}`, padding: "22px 26px",
              }}
            >
              {/* Meta row */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {generatedScript.niche && (
                  <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: C.badgeBg, color: C.badgeText, letterSpacing: 0.3, textTransform: "uppercase" }}>
                    {generatedScript.niche}
                  </span>
                )}
                {generatedScript.structurePattern && (
                  <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.10)", color: "#a5b4fc" }}>
                    {generatedScript.structurePattern}
                  </span>
                )}
                <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.08)", color: C.textDim }}>
                  {(generatedScript.wordCount || 0).toLocaleString()} words
                </span>
                <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.08)", color: C.textDim }}>
                  ~{generatedScript.estimatedDuration || 5} min
                </span>
              </div>

              {/* Title */}
              <h2 style={{ fontSize: 21, fontWeight: 700, color: C.textBright, letterSpacing: -0.3, marginBottom: 16 }}>
                {generatedScript.title}
              </h2>

              {/* Hook */}
              {generatedScript.hook && (
                <div
                  style={{
                    borderRadius: 14, padding: "14px 16px", marginBottom: 16,
                    background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.16)",
                  }}
                >
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: 0.5, marginBottom: 5 }}>HOOK</p>
                  <p style={{ fontSize: 14, color: C.textBright, lineHeight: 1.6 }}>{generatedScript.hook}</p>
                </div>
              )}

              {/* Full script */}
              <div
                style={{
                  maxHeight: 440, overflowY: "auto", borderRadius: 14,
                  border: `1px solid ${C.border}`,
                }}
              >
                <div style={{ padding: 20 }}>
                  <p style={{ fontSize: 14, color: C.textBright, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>
                    {generatedScript.content}
                  </p>
                </div>
              </div>
            </div>

            {/* Action bar */}
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button
                onClick={() => setStep("transcript")}
                style={{
                  flex: 1, padding: "12px 20px", borderRadius: 14,
                  background: "rgba(99,102,241,0.08)", color: C.accent,
                  fontSize: 14, fontWeight: 500,
                  border: "1px solid rgba(99,102,241,0.18)", cursor: "pointer",
                }}
              >
                ← Regenerate
              </button>
              <button
                onClick={saveScript}
                disabled={saving}
                style={{
                  flex: 2, padding: "12px 20px", borderRadius: 14,
                  background: sectionLine("violet"), color: "#fff",
                  fontSize: 14, fontWeight: 600, border: "none",
                  cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1,
                  boxShadow: "0 0 22px rgba(99,102,241,0.30)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {saving ? "Saving…" : "✦ Save Script"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InputGroup(props: { label: string; hint?: string; required?: boolean; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...Object.assign({}, { marginBottom: 0 } as any), ...props.style } as any}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>
        {props.label}
        {props.required && <span style={{ color: C.danger, marginLeft: 4 }}>*</span>}
      </label>
      {props.hint && <p style={{ color: C.textDim, fontSize: 12, marginBottom: 6, marginTop: -4 }}>{props.hint}</p>}
      {props.children}
    </div>
  );
}
