"use client";

import Link from "next/link";
import { useState } from "react";

const C = {
  bg: "#0b0b17",
  cardBg: "#12122a",
  border: "rgba(99,102,241,0.12)",
  accent: "#818cf8",
  textDim: "#64748b",
  textBright: "#f1f5f9",
  text: "#e2e8f0",
};

const SAMPLE_SCRIPT = {
  title: "Why 90% of People Who Try to Build Wealth Fail in Year One",
  niche: "Finance",
  words: 218,
  duration: "~2 min",
  content: `Ninety percent of people who try to build wealth in their twenties fail within the first year. Not because they don't work hard. Not because they lack information. Because they're solving the wrong problem entirely.

Here's what nobody tells you: the financial system wasn't designed to help you build wealth. It was designed to help banks build theirs.

But there's a window. A specific gap in how compound interest actually works that most financial advisors actively avoid discussing — because understanding it would make you stop needing them.

I found this gap three years ago. It took me from $800 in savings to a paid-off car and a six-month emergency fund in under 18 months. Not by earning more. By stopping one specific financial habit that 76% of millennials repeat every single week without realizing it.

I'm going to show you exactly what that habit is. And the three-step system I used to replace it with something that actually compounds.

Stay with me — because what I'm about to tell you changes how you think about every financial decision you make from this point forward.

The habit is called lifestyle creep. And the reason it's so dangerous isn't what you think.`,
};

const STEPS = [
  { emoji: "✍️", label: "Pick a topic", desc: "Type any topic or paste a YouTube URL to inspire from" },
  { emoji: "⚡", label: "Generate", desc: "Skripr writes a full retention-optimized script in ~20 seconds" },
  { emoji: "📋", label: "Copy & record", desc: "Paste into ElevenLabs, Murf, or read it yourself" },
];

const VALUE_PROPS = [
  { emoji: "🎣", text: "Hook patterns that beat the 30-second drop-off" },
  { emoji: "🔀", text: "Niche Bend tool to tap adjacent audiences" },
  { emoji: "📈", text: "Built-in retention mechanics on every script" },
];

export function EmptyStateGuide() {
  const [scriptOpen, setScriptOpen] = useState(false);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>

      {/* ── Welcome Hero ── */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 14, filter: "drop-shadow(0 0 20px rgba(99,102,241,0.5))" }}>✦</div>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, marginBottom: 10 }}>
          Welcome to Skripr
        </h2>
        <p style={{ fontSize: 15, color: C.textDim, lineHeight: 1.7, maxWidth: 480, margin: "0 auto 24px" }}>
          Generate full YouTube scripts optimised for retention, hooks, and the algorithm — in under 30 seconds.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          {VALUE_PROPS.map((v, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 20, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.16)", fontSize: 13, color: C.text }}>
              <span>{v.emoji}</span><span>{v.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sample Script ── */}
      <div style={{ borderRadius: 18, background: C.cardBg, border: "1px solid rgba(99,102,241,0.22)", marginBottom: 28, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: scriptOpen ? "1px solid rgba(99,102,241,0.12)" : "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: "rgba(52,211,153,0.12)", color: "#34d399", letterSpacing: 0.4 }}>EXAMPLE OUTPUT</span>
                <span style={{ fontSize: 10, color: C.textDim }}>{SAMPLE_SCRIPT.niche} · {SAMPLE_SCRIPT.words} words · {SAMPLE_SCRIPT.duration}</span>
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: C.textBright, margin: 0, lineHeight: 1.4 }}>{SAMPLE_SCRIPT.title}</h3>
            </div>
            <button
              onClick={() => setScriptOpen(v => !v)}
              style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 9, background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.20)", color: "#818cf8", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {scriptOpen ? "Hide ↑" : "Read sample ↓"}
            </button>
          </div>
        </div>

        {scriptOpen && (
          <div style={{ padding: "20px 22px" }}>
            <p style={{ fontSize: 14, color: C.text, lineHeight: 1.9, whiteSpace: "pre-wrap", margin: 0 }}>
              {SAMPLE_SCRIPT.content}
            </p>
            <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <p style={{ fontSize: 12, color: "#a5b4fc", margin: 0, lineHeight: 1.6 }}>
                💡 Notice: stat hook in the first sentence, re-hook after the tension reveal, two open loops planted before the payoff. This is the structure Skripr builds into every script automatically.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── 3-Step Guide ── */}
      <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 22px", marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 18 }}>How it works</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 10, background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.20)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                {s.emoji}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8" }}>STEP {i + 1}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.textBright }}>{s.label}</span>
                </div>
                <p style={{ fontSize: 13, color: C.textDim, margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ textAlign: "center" }}>
        <Link
          href="/dashboard/scripts/new"
          style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 32px", borderRadius: 14, background: "linear-gradient(135deg,#6366f1 0%,#7c3aed 50%,#a855f7 100%)", color: "#fff", fontSize: 15, fontWeight: 600, textDecoration: "none", boxShadow: "0 0 32px rgba(99,102,241,0.35)" }}
        >
          <span style={{ fontSize: 18 }}>✦</span> Generate Your First Script
        </Link>
        <p style={{ fontSize: 12, color: C.textDim, marginTop: 10 }}>Free plan includes 2 scripts — no credit card required</p>
      </div>

    </div>
  );
}
