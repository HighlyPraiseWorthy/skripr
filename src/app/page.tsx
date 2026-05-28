"use client";
import Link from "next/link";
import { useState } from "react";

const SAMPLE_SCRIPT = {
  title: "Why 90% of People Who Try to Build Wealth Fail in Year One",
  niche: "Finance",
  words: 218,
  content: `Ninety percent of people who try to build wealth in their twenties fail within the first year. Not because they don't work hard. Not because they lack information. Because they're solving the wrong problem entirely.

Here's what nobody tells you: the financial system wasn't designed to help you build wealth. It was designed to help banks build theirs.

But there's a window. A specific gap in how compound interest actually works that most financial advisors actively avoid discussing — because understanding it would make you stop needing them.

I found this gap three years ago. It took me from $800 in savings to a paid-off car and a six-month emergency fund in under 18 months. Not by earning more. By stopping one specific financial habit that 76% of millennials repeat every single week without realizing it.

I'm going to show you exactly what that habit is. And the three-step system I used to replace it with something that actually compounds.

Stay with me — because what I'm about to tell you changes how you think about every financial decision you make from this point forward.

The habit is called lifestyle creep. And the reason it's so dangerous isn't what you think.`,
};

const FEATURES = [
  {
    emoji: "⚡",
    title: "AI Script Generator",
    desc: "Type a topic, get a full retention-optimized YouTube script with proven hook patterns, open loops, and strategic re-hooks — in under 30 seconds.",
    grad: "linear-gradient(135deg,#6366f1,#818cf8)",
    glow: "rgba(99,102,241,0.25)",
    badge: "Core · All plans",
  },
  {
    emoji: "🔀",
    title: "Niche Bend Engine",
    desc: "Discover crossover opportunities between adjacent niches. Tap into recommendation graphs your competitors haven't found yet.",
    grad: "linear-gradient(135deg,#a855f7,#d946ef)",
    glow: "rgba(168,85,247,0.25)",
    badge: "Starter+",
  },
  {
    emoji: "🎬",
    title: "Competitor Video Analysis",
    desc: "Paste any viral YouTube URL. Skripr extracts the hook, framework, and pacing — then transplants the exact formula into your niche.",
    grad: "linear-gradient(135deg,#3b82f6,#06b6d4)",
    glow: "rgba(59,130,246,0.25)",
    badge: "Starter+",
  },
  {
    emoji: "🧲",
    title: "Viral Magnet Words",
    desc: "S, A, B, C-tier power words ranked by CTR lift. Woven into every generated title so your thumbnails stop getting scrolled past.",
    grad: "linear-gradient(135deg,#f59e0b,#f97316)",
    glow: "rgba(245,158,11,0.25)",
    badge: "Starter+",
  },
  {
    emoji: "🕐",
    title: "Version History",
    desc: "Edit your scripts without fear. Every save snapshots the previous version — one click to restore any draft. No work ever lost.",
    grad: "linear-gradient(135deg,#10b981,#14b8a6)",
    glow: "rgba(16,185,129,0.25)",
    badge: "All plans",
  },
  {
    emoji: "📚",
    title: "Creator Education",
    desc: "7 in-depth lessons on hook psychology, script structure, niche bending, retention mechanics, and the full Skripr workflow.",
    grad: "linear-gradient(135deg,#ec4899,#f43f5e)",
    glow: "rgba(236,72,153,0.25)",
    badge: "All plans",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Pick a topic or paste a competitor URL",
    desc: "Type any topic — or paste a viral YouTube URL to have Skripr extract and adapt the exact structural framework that made it perform.",
  },
  {
    n: "02",
    title: "Skripr writes the full script",
    desc: "Our AI generates a retention-optimized script — hook, open loops, re-hooks, body, and CTA — built to beat the 30-second drop-off and keep viewers to the end.",
  },
  {
    n: "03",
    title: "Copy, export, and record",
    desc: "Export as TXT or PDF, copy to clipboard, or paste directly into ElevenLabs, Murf, or read it yourself. Ready to record in seconds.",
  },
];

const FAQS = [
  {
    q: "Is this just ChatGPT with a wrapper?",
    a: "No. Skripr is built specifically for YouTube — it understands the 8 hook types, retention beat placement, open loop psychology, and the structural patterns that signal quality to the algorithm. ChatGPT doesn't know what a re-hook is or why the 30-second mark is critical. Skripr does.",
  },
  {
    q: "Will the scripts sound robotic or AI-generated?",
    a: "Skripr generates conversational, first-person scripts designed to be spoken, not read. The tone is natural, the pacing is tight, and the hook patterns are modelled on high-retention creators. Most users find they need minimal editing before recording.",
  },
  {
    q: "What niches are supported?",
    a: "Finance, health and fitness, tech, lifestyle, productivity, business, gaming, education, cooking, travel, and more. The Niche Bend Engine lets you bridge between niches — the real alpha is combining audiences that haven't been combined before.",
  },
  {
    q: "What is the Niche Bend Engine, exactly?",
    a: "Niche Bend finds crossover opportunities between adjacent recommendation graphs. When you bridge Finance → Fitness, your video surfaces to Fitness viewers who haven't seen Finance content — untapped CPM territory with low competition. It's audience arbitrage, not just topic research.",
  },
  {
    q: "What does the free plan include?",
    a: "2 scripts per month, full access to the Learn section, version history, and copy/TXT/PDF export. No credit card required. You get the full core experience before committing to a paid plan.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Monthly billing, cancel anytime from your settings page. No locked contracts, no cancellation fees. If you cancel, you keep access until the end of the billing period.",
  },
];

export default function LandingPage() {
  const [sampleOpen, setSampleOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ minHeight: "100vh", background: "#070711", color: "#f1f5f9", overflowX: "hidden", fontFamily: "system-ui,-apple-system,sans-serif" }}>

      {/* ── Global ambient glow ── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -280, left: "5%", width: 700, height: 700, background: "rgba(99,102,241,0.11)", borderRadius: "50%", filter: "blur(140px)" }} />
        <div style={{ position: "absolute", top: "25%", right: "-5%", width: 600, height: 600, background: "rgba(168,85,247,0.09)", borderRadius: "50%", filter: "blur(140px)" }} />
        <div style={{ position: "absolute", bottom: "5%", left: "35%", width: 700, height: 500, background: "rgba(99,102,241,0.06)", borderRadius: "50%", filter: "blur(140px)" }} />
      </div>

      {/* ── Nav ── */}
      <nav style={{ position: "relative", zIndex: 10, borderBottom: "1px solid rgba(255,255,255,0.055)" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 12 }}>SK</span>
            </div>
            <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.4 }}>Skripr</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Link href="/pricing" style={{ color: "#64748b", fontSize: 14, textDecoration: "none", padding: "8px 14px", borderRadius: 8 }}>Pricing</Link>
            <Link href="/sign-in" style={{ color: "#64748b", fontSize: 14, textDecoration: "none", padding: "8px 14px", borderRadius: 8 }}>Sign in</Link>
            <Link href="/sign-up" style={{ padding: "9px 20px", fontSize: 14, fontWeight: 600, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", textDecoration: "none", boxShadow: "0 4px 18px rgba(99,102,241,0.32)" }}>Get Started Free</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ position: "relative", zIndex: 10, maxWidth: 1160, margin: "0 auto", padding: "100px 24px 80px", textAlign: "center" }}>
        {/* Badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 18px", borderRadius: 999, background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.24)", color: "#a5b4fc", fontSize: 13, fontWeight: 600, marginBottom: 36, letterSpacing: 0.2 }}>
          <span style={{ fontSize: 10 }}>✦</span>
          Built for YouTube creators — not generic AI writing
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: "clamp(44px,8vw,96px)", fontWeight: 800, lineHeight: 1.06, letterSpacing: "-.035em", marginBottom: 26 }}>
          <span style={{ background: "linear-gradient(90deg,#f1f5f9 0%,#cbd5e1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Full YouTube scripts.</span>
          <br />
          <span style={{ background: "linear-gradient(90deg,#818cf8,#c084fc,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Built for the algorithm.</span>
        </h1>

        {/* Sub */}
        <p style={{ fontSize: "clamp(16px,2vw,20px)", color: "#94a3b8", maxWidth: 560, margin: "0 auto 48px", lineHeight: 1.75 }}>
          Retention-optimized scripts with proven hook patterns, open loops, and niche crossover intelligence — generated in under 30 seconds.
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 18 }}>
          <Link href="/sign-up" style={{ padding: "15px 36px", fontSize: 16, fontWeight: 700, borderRadius: 14, background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", textDecoration: "none", boxShadow: "0 8px 32px rgba(99,102,241,0.38)", letterSpacing: -.2 }}>
            Generate Your First Script →
          </Link>
          <Link href="/pricing" style={{ padding: "15px 28px", fontSize: 16, fontWeight: 600, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "#f1f5f9", textDecoration: "none" }}>
            View pricing
          </Link>
        </div>

        {/* Pricing pill */}
        <p style={{ fontSize: 13, color: "#475569", marginBottom: 64 }}>
          Free · Starter $19/mo · Pro $39/mo · Agency $99/mo — No credit card required
        </p>

        {/* ── Live sample output ── */}
        <div style={{ maxWidth: 740, margin: "0 auto", borderRadius: 20, background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.20)", overflow: "hidden", textAlign: "left" }}>
          {/* Header row */}
          <div
            onClick={() => setSampleOpen(v => !v)}
            style={{ padding: "16px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: sampleOpen ? "1px solid rgba(99,102,241,0.14)" : "none" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: "rgba(52,211,153,0.12)", color: "#34d399", letterSpacing: 0.5 }}>EXAMPLE OUTPUT</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>Finance · {SAMPLE_SCRIPT.words} words · ~2 min</span>
            </div>
            <button style={{ fontSize: 12, color: "#818cf8", background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.20)", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>
              {sampleOpen ? "Hide ↑" : "Read script ↓"}
            </button>
          </div>

          {/* Preview (collapsed) */}
          {!sampleOpen && (
            <div style={{ padding: "14px 22px" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", margin: "0 0 4px" }}>{SAMPLE_SCRIPT.title}</p>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.6 }}>Ninety percent of people who try to build wealth in their twenties fail within the first year. Not because they don't work hard...</p>
            </div>
          )}

          {/* Full script (expanded) */}
          {sampleOpen && (
            <div style={{ padding: "20px 24px" }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 16, lineHeight: 1.4 }}>{SAMPLE_SCRIPT.title}</p>
              <p style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 2.0, whiteSpace: "pre-wrap", margin: "0 0 18px" }}>{SAMPLE_SCRIPT.content}</p>
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.16)" }}>
                <p style={{ fontSize: 12, color: "#a5b4fc", margin: 0, lineHeight: 1.75 }}>
                  💡 <strong>Notice:</strong> Stat hook in sentence 1. Villain reveal in sentence 3. Open loop planted at "a specific gap." Re-hook at "I found this gap three years ago." Two open loops stacked before the first payoff. This structure is built into every Skripr script automatically.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ position: "relative", zIndex: 10, borderTop: "1px solid rgba(255,255,255,0.05)", padding: "96px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 14 }}>What you get</p>
            <h2 style={{ fontSize: "clamp(28px,4vw,50px)", fontWeight: 800, letterSpacing: "-.03em", marginBottom: 14, lineHeight: 1.1 }}>
              Not a generic AI writer.{" "}
              <span style={{ background: "linear-gradient(90deg,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>A YouTube growth tool.</span>
            </h2>
            <p style={{ color: "#94a3b8", fontSize: 17, maxWidth: 480, margin: "0 auto" }}>Every feature is designed for one outcome: videos that retain viewers, rank faster, and convert.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 18 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ borderRadius: 18, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", padding: "26px 24px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, background: f.glow, borderRadius: "50%", filter: "blur(50px)", opacity: 0.5 }} />
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14, position: "relative" }}>
                  <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, background: f.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.25)" }}>
                    {f.emoji}
                  </div>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", margin: "0 0 4px", letterSpacing: -.2 }}>{f.title}</p>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 4, background: "rgba(99,102,241,0.12)", color: "#a5b4fc", letterSpacing: 0.4 }}>{f.badge}</span>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.75, margin: 0, position: "relative" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ position: "relative", zIndex: 10, borderTop: "1px solid rgba(255,255,255,0.05)", padding: "96px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 14 }}>How it works</p>
            <h2 style={{ fontSize: "clamp(28px,4vw,50px)", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.1 }}>
              Topic to{" "}
              <span style={{ background: "linear-gradient(90deg,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>record-ready script</span>
              {" "}in 3 steps
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start", padding: "24px 26px", borderRadius: 18, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ flexShrink: 0, width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,rgba(99,102,241,0.14),rgba(168,85,247,0.14))", border: "1px solid rgba(99,102,241,0.20)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 15, fontWeight: 800, background: "linear-gradient(90deg,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.n}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 8, letterSpacing: -.2 }}>{s.title}</h3>
                  <p style={{ color: "#94a3b8", lineHeight: 1.75, margin: 0, fontSize: 15 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ position: "relative", zIndex: 10, borderTop: "1px solid rgba(255,255,255,0.05)", padding: "96px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 14 }}>FAQ</p>
            <h2 style={{ fontSize: "clamp(28px,4vw,50px)", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.1 }}>
              Every question{" "}
              <span style={{ background: "linear-gradient(90deg,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>answered</span>
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ borderRadius: 14, background: "rgba(255,255,255,0.025)", border: `1px solid ${openFaq === i ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.07)"}`, overflow: "hidden" }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: "100%", textAlign: "left", padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, cursor: "pointer", background: "none", border: "none" }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.4 }}>{faq.q}</span>
                  <span style={{ flexShrink: 0, fontSize: 20, color: "#818cf8", transform: openFaq === i ? "rotate(45deg)" : "none", transition: "transform 0.2s", lineHeight: 1, display: "block" }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 22px 20px" }}>
                    <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.85, margin: 0 }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ position: "relative", zIndex: 10, borderTop: "1px solid rgba(255,255,255,0.05)", padding: "100px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ fontSize: 52, marginBottom: 24, filter: "drop-shadow(0 0 28px rgba(99,102,241,0.55))" }}>✦</div>
          <h2 style={{ fontSize: "clamp(28px,4vw,54px)", fontWeight: 800, letterSpacing: "-.03em", marginBottom: 20, lineHeight: 1.1 }}>
            Your next script is{" "}
            <span style={{ background: "linear-gradient(90deg,#818cf8,#c084fc,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>30 seconds away</span>
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 18, marginBottom: 44, lineHeight: 1.7 }}>
            Start free. No credit card. No commitment.<br />Generate 2 full scripts before you spend a dollar.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", padding: "18px 48px", fontSize: 17, fontWeight: 700, borderRadius: 16, background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", textDecoration: "none", boxShadow: "0 8px 40px rgba(99,102,241,0.42)", letterSpacing: -.2 }}>
            Generate Your First Script Free
          </Link>
          <p style={{ fontSize: 13, color: "#475569", marginTop: 16 }}>Free plan · No credit card · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ position: "relative", zIndex: 10, borderTop: "1px solid rgba(255,255,255,0.05)", padding: "36px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 10 }}>SK</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>Skripr</span>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <Link href="/pricing" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Pricing</Link>
            <Link href="/dashboard/educate" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Learn</Link>
            <Link href="/sign-up" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Get Started</Link>
          </div>
          <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>Built for YouTube creators.</p>
        </div>
      </footer>

    </div>
  );
}
