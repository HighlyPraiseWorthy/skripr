"use client";
import Link from "next/link";

// ─── Decoy Viral Magnet words (NOT the real word bank) ────────────────────────
const DECOY_WORDS = [
  { word: "Untold",    grade: "S", lift: "+420%", color: "#4db8ff" },
  { word: "Silently",  grade: "S", lift: "+390%", color: "#4db8ff" },
  { word: "Exposed",   grade: "S", lift: "+355%", color: "#4db8ff" },
  { word: "Brutal",    grade: "A", lift: "+215%", color: "#7c6fff" },
  { word: "Actually",  grade: "A", lift: "+188%", color: "#7c6fff" },
  { word: "Stopped",   grade: "A", lift: "+172%", color: "#7c6fff" },
  { word: "Quietly",   grade: "B", lift: "+95%",  color: "#00d4a0" },
  { word: "Finally",   grade: "B", lift: "+82%",  color: "#00d4a0" },
  { word: "Shocking",  grade: "S", lift: "+340%", color: "#4db8ff" },
  { word: "Broken",    grade: "A", lift: "+160%", color: "#7c6fff" },
  { word: "Banned",    grade: "S", lift: "+310%", color: "#4db8ff" },
  { word: "Real",      grade: "B", lift: "+78%",  color: "#00d4a0" },
];

const HOOKS = [
  { score: "94%", text: '"What if the advice you\'ve been following about money is actually keeping you broke?"' },
  { score: "91%", text: '"I wasted $40k before I figured this out. Here\'s the thing nobody tells you."' },
  { score: "88%", text: '"In the next 8 minutes, you\'re going to see your bank account differently."' },
  { score: "84%", text: '"Most savings advice is wrong. Here\'s the data that proves it."' },
];

// ─── Option C: real verifiable product facts ──────────────────────────────────
const PRODUCT_FACTS = [
  "Generates 10 ranked hooks per script",
  "30 SEO tags generated per video",
  "Compliance scored before you record",
  "Transcript extracted in under 5 seconds",
  "Scripts adapted to your niche and voice",
  "Viral Magnet words graded S · A · B",
  "Metadata suite: title, description, tags",
  "Niche Bend produces 10 fresh angles",
  "A/B title variants generated per script",
  "Viral Remixer rebuilds any video concept",
  "Hook retention scores on every output",
  "7 AI tools in one dashboard",
];
const FACTS_LOOP = [...PRODUCT_FACTS, ...PRODUCT_FACTS];

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:     "#080c12",
  bg2:    "#060a0f",
  bg3:    "#0a0f18",
  border: "#0e1623",
  text:   "#e8edf5",
  muted:  "#2e4058",
  dim:    "#1e2d42",
  accent: "#4db8ff",
  purple: "#7c6fff",
  green:  "#00d4a0",
};

// ─── Micro-components ─────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: T.dim, marginBottom: 14 }}>
      {children}
    </div>
  );
}

function FeatTag({ children, color = T.accent }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      display: "inline-block", marginTop: 14,
      fontSize: 9, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" as const,
      padding: "3px 8px", border: `1px solid ${color}33`, color,
    }}>{children}</span>
  );
}

function TermLine({ type, children }: { type: "comment" | "cmd" | "out" | "check"; children: React.ReactNode }) {
  const colors = { comment: T.dim, cmd: T.accent, out: T.muted, check: T.green };
  return (
    <div style={{ fontFamily: "monospace", fontSize: 11, lineHeight: 1.8, color: colors[type] }}>
      {children}
    </div>
  );
}

function Check({ color = T.green }: { color?: string }) {
  return <span style={{ color, fontSize: 11, flexShrink: 0 }}>✓</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", minHeight: "100vh", overflowX: "hidden" }}>

      <style>{`
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueUltraLight.otf') format('opentype'); font-weight: 100; font-style: normal; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueUltraLightItalic.otf') format('opentype'); font-weight: 100; font-style: italic; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueThin.otf') format('opentype'); font-weight: 200; font-style: normal; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueThinItalic.otf') format('opentype'); font-weight: 200; font-style: italic; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueLight.otf') format('opentype'); font-weight: 300; font-style: normal; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueLightItalic.otf') format('opentype'); font-weight: 300; font-style: italic; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueRoman.otf') format('opentype'); font-weight: 400; font-style: normal; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueItalic.ttf') format('truetype'); font-weight: 400; font-style: italic; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueMedium.otf') format('opentype'); font-weight: 500; font-style: normal; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueMediumItalic.otf') format('opentype'); font-weight: 500; font-style: italic; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueBold.otf') format('opentype'); font-weight: 700; font-style: normal; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueBoldItalic.otf') format('opentype'); font-weight: 700; font-style: italic; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueHeavy.otf') format('opentype'); font-weight: 800; font-style: normal; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueHeavyItalic.otf') format('opentype'); font-weight: 800; font-style: italic; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueBlack.otf') format('opentype'); font-weight: 900; font-style: normal; }
        @font-face { font-family: 'Helvetica Neue'; src: url('/fonts/HelveticaNeueBlackItalic.otf') format('opentype'); font-weight: 900; font-style: italic; }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { -webkit-font-smoothing: antialiased; }

        @keyframes marquee-facts { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
        @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0 } }
        @keyframes pulse-dot { 0%,100% { opacity:0.4; transform:scale(1) } 50% { opacity:1; transform:scale(1.15) } }
        @keyframes fadein { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }

        .hn-nav-link { font-size:12px; font-weight:400; letter-spacing:0.08em; color:${T.dim}; text-decoration:none; transition:color .15s; }
        .hn-nav-link:hover { color:${T.accent}; }
        .hn-ghost:hover { color:${T.accent} !important; border-color:${T.accent}44 !important; }
        .hn-feat-row { display:grid; grid-template-columns:80px 1fr 1fr; border-bottom:1px solid ${T.border}; }
        .hn-feat-row:last-child { border-bottom:none; }
        .hn-feat-artifact { background:${T.bg2}; border-left:1px solid ${T.border}; padding:28px 24px; }
        .hn-hook-item { display:flex; align-items:flex-start; gap:10px; padding:10px 14px; border-bottom:1px solid ${T.border}; }
        .hn-hook-item:last-child { border-bottom:none; }
        .hn-comp-row { display:flex; justify-content:space-between; padding:8px 16px; border-bottom:1px solid ${T.border}; font-size:11px; }
        .hn-comp-row:last-child { border-bottom:none; }
        .hn-price-card { background:${T.bg}; padding:28px 24px; transition:background .2s; }
        .hn-price-card:hover { background:${T.bg3}; }
        .hn-price-btn { transition:opacity .15s; }
        .hn-price-btn:hover { opacity:.85; }
        .hn-foot-link { font-size:11px; color:${T.dim}; text-decoration:none; letter-spacing:.04em; transition:color .15s; }
        .hn-foot-link:hover { color:${T.accent}; }
        .hn-word { padding:5px 11px; font-size:11px; font-weight:500; border:1px solid; letter-spacing:.02em; }
        .hn-price-featured { background:${T.bg2} !important; outline:1px solid ${T.accent}44; }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", borderBottom: `1px solid ${T.border}`,
        background: "rgba(8,12,18,0.96)", backdropFilter: "blur(12px)",
      }}>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: T.text }}>
          SKRIP<span style={{ fontWeight: 200, color: T.accent }}>R</span>
        </div>
        <div style={{ display: "flex", gap: 32 }}>
          {[["#features","Features"],["#viral-magnet","Viral Magnet"],["#pricing","Pricing"]].map(([href, label]) => (
            <a key={href} href={href} className="hn-nav-link">{label}</a>
          ))}
          <Link href="/sign-in" className="hn-nav-link">Sign in</Link>
        </div>
        <Link href="/sign-up" style={{
          background: T.accent, color: T.bg,
          fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const,
          padding: "8px 18px", textDecoration: "none",
        }}>Get started</Link>
      </nav>

      {/* ── HERO ── */}
      <div style={{ paddingTop: 56 }}>
        <div style={{ padding: "80px 48px 0", maxWidth: 760, animation: "fadein .6s ease both" }}>
          <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.0, letterSpacing: "-1.5px", color: T.text, marginBottom: 20 }}>
            Script any video.<br />
            <span style={{ fontWeight: 200, color: T.accent }}>Algorithmically.</span>
          </div>
          <p style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.65, color: T.muted, maxWidth: 560, marginBottom: 36 }}>
            Paste a YouTube URL. Skripr reverse-engineers the transcript, rebuilds the structure as a ready-to-record script, generates ranked hooks, injects Viral Magnet words, and delivers complete metadata — in under 60 seconds.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <Link href="/sign-up" style={{
              background: T.accent, color: T.bg,
              fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const,
              padding: "12px 24px", textDecoration: "none",
            }}>Start free — 2 scripts →</Link>
            <a href="#features" className="hn-ghost" style={{
              background: "transparent", color: T.muted,
              fontSize: 12, fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase" as const,
              padding: "12px 20px", border: `1px solid ${T.border}`, textDecoration: "none",
              transition: "color .15s, border-color .15s",
            }}>How it works ↓</a>
          </div>
          <div style={{ display: "flex", gap: 24, paddingBottom: 56 }}>
            {["No credit card required", "Results in 60s", "Built for YouTubers"].map(t => (
              <span key={t} style={{ fontSize: 11, color: T.dim, letterSpacing: "0.04em" }}>{t}</span>
            ))}
          </div>
        </div>

        {/* ── DEMO WINDOW ── */}
        <div style={{ margin: "0 48px", border: `1px solid ${T.border}`, background: T.bg2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", borderBottom: `1px solid ${T.border}`, background: T.bg }}>
            {["#2a3040","#2a3040","#2a3040"].map((c, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
            ))}
            <span style={{ fontSize: 10, color: T.dim, letterSpacing: "0.05em", fontFamily: "monospace", marginLeft: 6 }}>
              skripr.vercel.app/dashboard/scripts/new
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", minHeight: 200 }}>
            <div style={{ borderRight: `1px solid ${T.border}`, padding: 16, display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {[
                ["YouTube URL", "youtube.com/watch?v=dQw4w9...", true],
                ["Niche", "Personal Finance", false],
                ["Length", "8 minutes", false],
              ].map(([lbl, val, isUrl]) => (
                <div key={lbl as string}>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: T.dim, marginBottom: 3 }}>{lbl}</div>
                  <div style={{ fontSize: isUrl ? 10 : 11, color: isUrl ? T.accent : T.muted, padding: "7px 8px", border: `1px solid ${T.border}`, background: T.bg, lineHeight: 1.3, wordBreak: "break-all" as const }}>{val}</div>
                </div>
              ))}
              <button style={{ background: T.accent, color: T.bg, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, padding: 9, border: "none", cursor: "pointer", marginTop: 2 }}>
                ⚡ Generate
              </button>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${T.accent}0c`, border: `1px solid ${T.accent}22`, fontSize: 9, fontWeight: 600, color: T.accent, padding: "3px 7px", letterSpacing: ".04em", marginTop: 4 }}>
                Viral Magnet: "Untold" · S · +420%
              </div>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.2px", color: T.text, marginBottom: 7, lineHeight: 1.3 }}>
                The Untold Money Mistake That's Silently Draining Your Savings
              </div>
              <div style={{ fontSize: 11, color: T.accent, fontStyle: "italic", marginBottom: 9 }}>
                "What if everything you know about saving is designed to fail?"
              </div>
              <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.7, fontWeight: 300 }}>
                Let me show you something that took me 3 years to figure out — hiding in plain sight in your bank account right now.
                <span style={{ display: "inline-block", width: 1.5, height: 11, background: T.accent, marginLeft: 2, verticalAlign: "middle", animation: "blink 1s infinite" }} />
                <br /><br />
                The problem isn't discipline. It's the invisible architecture of how your money is structured — and the system benefits when you don't see it.
              </div>
            </div>
          </div>
        </div>

        {/* ── NICHE STRIP ── */}
        <div style={{ display: "flex", alignItems: "center", padding: "24px 48px", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 400, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: T.dim, paddingRight: 28, borderRight: `1px solid ${T.border}`, marginRight: 28, flexShrink: 0, whiteSpace: "nowrap" as const }}>
            Works for creators in
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" as const }}>
            {["Finance","Tech","Fitness","Business","Lifestyle","Gaming","Education","Travel"].map((n, i, arr) => (
              <span key={n} style={{ fontSize: 11, color: T.dim, letterSpacing: "0.04em" }}>
                {n}{i < arr.length - 1 && <span style={{ marginLeft: 20, color: T.border }}>·</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── OPTION C: Product facts ticker ── */}
      <div style={{ overflow: "hidden", borderBottom: `1px solid ${T.border}`, padding: "18px 0", background: T.bg2 }}>
        <div style={{ display: "flex", animation: "marquee-facts 44s linear infinite", width: "max-content" }}>
          {FACTS_LOOP.map((fact, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 400, color: T.muted, letterSpacing: "0.04em", whiteSpace: "nowrap" as const, padding: "0 28px" }}>
                {fact}
              </span>
              <span style={{ color: T.border, fontSize: 16, flexShrink: 0 }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── OPTION B: Honest early access bar (no "beta") ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 48px", borderBottom: `1px solid ${T.border}`,
        background: T.bg, flexWrap: "wrap" as const, gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ position: "relative" as const, display: "inline-flex", width: 8, height: 8, flexShrink: 0 }}>
            <span style={{ position: "absolute" as const, inset: 0, borderRadius: "50%", background: T.accent, animation: "pulse-dot 2s ease infinite" }} />
            <span style={{ borderRadius: "50%", width: 8, height: 8, background: T.accent, display: "block", position: "relative" as const, zIndex: 1 }} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 400, color: T.muted, letterSpacing: "0.02em" }}>
            Skripr is live. Join early —{" "}
            <span style={{ color: T.text, fontWeight: 500 }}>be among the first creators to use it.</span>
          </span>
        </div>
        <Link href="/sign-up" style={{
          fontSize: 11, fontWeight: 500, color: T.accent,
          letterSpacing: "0.06em", textDecoration: "none",
          borderBottom: `1px solid ${T.accent}44`, paddingBottom: 1,
        }}>
          2 scripts free, no card required →
        </Link>
      </div>

      {/* ── STATS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: T.border, borderBottom: `1px solid ${T.border}` }}>
        {[
          { n: "60", sup: "s", label: "Script generation" },
          { n: "8",  sup: "",  label: "AI tools, one dashboard" },
          { n: "10", sup: "×", label: "Faster than manual research" },
          { n: "2",  sup: "",  label: "Free scripts on signup" },
        ].map(({ n, sup, label }) => (
          <div key={label} style={{ background: T.bg, padding: "28px 24px" }}>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-1.5px", color: T.accent, lineHeight: 1 }}>
              {n}<sup style={{ fontSize: 18, fontWeight: 200, verticalAlign: "top", marginTop: 4, display: "inline-block" }}>{sup}</sup>
            </div>
            <div style={{ fontSize: 10, fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: T.dim, marginTop: 5 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── NUMBERED FEATURES ── */}
      <div id="features" style={{ borderBottom: `1px solid ${T.border}` }}>

        {/* 01 — Script Generator */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>01</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Script Generator</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Any URL.<br />Full script.</div>
            <div style={{ fontSize: 12, fontWeight: 300, color: T.muted, lineHeight: 1.65 }}>
              Paste a YouTube URL. Skripr pulls the transcript, analyzes the narrative structure, and rebuilds it as a fully formatted, ready-to-record script adapted to your niche and target length.
            </div>
            <FeatTag color={T.green}>All plans</FeatTag>
          </div>
          <div className="hn-feat-artifact">
            <TermLine type="comment"># Extracting transcript</TermLine>
            <TermLine type="out">→ youtube.com/watch?v=dQw4w9WgXcQ</TermLine>
            <TermLine type="check">✓ 2,335 words extracted</TermLine>
            <TermLine type="check">✓ Structure analyzed</TermLine>
            <TermLine type="check">✓ Niche matched: Finance</TermLine>
            <br />
            <TermLine type="comment"># Generating script</TermLine>
            <TermLine type="check">✓ Script: 1,847 words</TermLine>
            <TermLine type="check">✓ Estimated duration: 8m 12s</TermLine>
            <TermLine type="cmd">→ Ready to record</TermLine>
          </div>
        </div>

        {/* 02 — Viral Magnet */}
        <div id="viral-magnet" className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>02</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Viral Magnet</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Stop guessing<br />titles.</div>
            <div style={{ fontSize: 12, fontWeight: 300, color: T.muted, lineHeight: 1.65 }}>
              Power words graded by click psychology and YouTube search behavior. Each word shows a predicted CTR lift. Pick one — it auto-injects into your title and script hook.
            </div>
            <FeatTag>Starter+</FeatTag>
          </div>
          {/* Decoy words blurred + paywall gate */}
          <div className="hn-feat-artifact" style={{ position: "relative", overflow: "hidden", padding: 0 }}>
            <div style={{ padding: "20px 24px" }}>
              <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: T.dim, marginBottom: 12 }}>
                Finance niche · power words
              </div>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, filter: "blur(3.5px)", userSelect: "none" as const, pointerEvents: "none" as const }}>
                {DECOY_WORDS.map(({ word, grade, lift, color }) => (
                  <span key={word} className="hn-word" style={{ background: `${color}0a`, borderColor: `${color}33`, color }}>
                    {word} <span style={{ fontSize: 8, fontWeight: 600, opacity: 0.6, marginLeft: 2 }}>{grade} {lift}</span>
                  </span>
                ))}
              </div>
            </div>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center",
              gap: 8, background: "rgba(6,10,15,0.88)", textAlign: "center" as const, padding: 24,
            }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>🔒</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, letterSpacing: "-0.1px" }}>Starter+ feature</div>
              <div style={{ fontSize: 11, fontWeight: 300, color: T.muted, maxWidth: 200, lineHeight: 1.55 }}>
                Upgrade to unlock Viral Magnet words and CTR predictions
              </div>
              <Link href="/pricing" style={{
                marginTop: 6, background: T.accent, color: T.bg,
                fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const,
                padding: "9px 20px", textDecoration: "none",
              }}>Upgrade to Starter →</Link>
            </div>
          </div>
        </div>

        {/* 03 — Viral Remixer */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>03</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Viral Remixer</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Any viral video.<br />Your version.</div>
            <div style={{ fontSize: 12, fontWeight: 300, color: T.muted, lineHeight: 1.65 }}>
              Takes any high-performing video concept and rebuilds it from scratch in your voice, your niche, your style. Same structural DNA — entirely original output.
            </div>
            <FeatTag>Starter+</FeatTag>
          </div>
          <div className="hn-feat-artifact">
            <TermLine type="comment"># Source video → remixing</TermLine>
            <TermLine type="out">→ "Why Rich People Don't Talk About Money"</TermLine>
            <TermLine type="out">   4.2M views · Finance · 12 min</TermLine>
            <br />
            <TermLine type="comment"># Your version</TermLine>
            <TermLine type="cmd">→ "Why Successful Founders Go Silent About Revenue"</TermLine>
            <TermLine type="check">✓ Voice: your niche (Tech / Startup)</TermLine>
            <TermLine type="check">✓ Structure preserved, content original</TermLine>
            <TermLine type="check">✓ Viral Magnet injected on title</TermLine>
          </div>
        </div>

        {/* 04 — Hook Engine */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>04</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Hook Engine</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>10 hooks.<br />Ranked.</div>
            <div style={{ fontSize: 12, fontWeight: 300, color: T.muted, lineHeight: 1.65 }}>
              Every script gets 10 opening hooks across different psychological patterns — curiosity loops, controversy openers, pattern interrupts, stat shocks. Each scored for predicted audience retention.
            </div>
            <FeatTag color={T.green}>All plans</FeatTag>
          </div>
          <div className="hn-feat-artifact" style={{ padding: 0 }}>
            <div style={{ height: "100%" }}>
              {HOOKS.map(({ score, text }) => (
                <div key={score} className="hn-hook-item">
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, flexShrink: 0, paddingTop: 1, minWidth: 28 }}>{score}</div>
                  <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, fontWeight: 300 }}>{text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 05 — A/B Titles */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>05</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>A/B Titles</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Test before<br />you publish.</div>
            <div style={{ fontSize: 12, fontWeight: 300, color: T.muted, lineHeight: 1.65 }}>
              Generate multiple title variants for every script — each one testing a different angle, emotion, or Viral Magnet word. Know which one to lead with before you upload.
            </div>
            <FeatTag color={T.green}>All plans</FeatTag>
          </div>
          <div className="hn-feat-artifact">
            <TermLine type="comment"># A/B title variants</TermLine>
            <TermLine type="cmd">A → "The Untold Mistake Draining Your Savings"</TermLine>
            <TermLine type="cmd">B → "Stop Doing This With Your Money (Brutal Truth)"</TermLine>
            <TermLine type="cmd">C → "Why You're Still Broke — The Silent Reason"</TermLine>
            <TermLine type="cmd">D → "Hidden Reason You're Still Broke in 2026"</TermLine>
            <br />
            <TermLine type="comment"># Scoring</TermLine>
            <TermLine type="check">✓ Curiosity score: A 94 · B 88 · C 85 · D 82</TermLine>
            <TermLine type="check">✓ Viral Magnet grade on each variant</TermLine>
          </div>
        </div>

        {/* 06 — Metadata Suite */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>06</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Metadata Suite</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Titles, tags,<br />descriptions.</div>
            <div style={{ fontSize: 12, fontWeight: 300, color: T.muted, lineHeight: 1.65 }}>
              SEO-optimized titles, YouTube descriptions, and a full 30-tag set — generated from your script content. Never leave search discovery value on the table before you publish.
            </div>
            <FeatTag color={T.green}>All plans</FeatTag>
          </div>
          <div className="hn-feat-artifact">
            <TermLine type="comment"># Generated metadata</TermLine>
            <TermLine type="cmd">→ "The Untold Mistake Draining Your Savings"</TermLine>
            <TermLine type="cmd">→ "Stop Doing This With Your Money (Brutal Truth)"</TermLine>
            <br />
            <TermLine type="comment"># Tags (30 generated)</TermLine>
            <TermLine type="out">personal finance, money mistakes, how to save money, financial literacy, saving tips, budget 2026...</TermLine>
            <br />
            <TermLine type="check">✓ Description: 480 chars, keyword-optimized</TermLine>
            <TermLine type="check">✓ Thumbnail text suggestions included</TermLine>
          </div>
        </div>

        {/* 07 — Compliance Checker */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>07</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Compliance Checker</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Score before<br />you record.</div>
            <div style={{ fontSize: 12, fontWeight: 300, color: T.muted, lineHeight: 1.65 }}>
              Run your script through YouTube's advertiser-friendliness guidelines before you hit record. Get a score, a category breakdown, and rewrite suggestions — not after demonetization.
            </div>
            <FeatTag color={T.green}>All plans</FeatTag>
          </div>
          <div className="hn-feat-artifact" style={{ padding: 0 }}>
            <div style={{ height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: T.green, letterSpacing: "-1px", lineHeight: 1 }}>87</div>
                  <div style={{ fontSize: 9, fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: T.dim, marginTop: 2 }}>Advertiser score</div>
                </div>
                <div style={{ fontSize: 10, color: T.green, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" as const }}>Ad-friendly</div>
              </div>
              {[
                { item: "Language & tone",      status: "PASS",   pass: true },
                { item: "Controversial topics", status: "PASS",   pass: true },
                { item: "Financial claims",      status: "REVIEW", pass: false },
                { item: "Thumbnail alignment",  status: "PASS",   pass: true },
              ].map(({ item, status, pass }) => (
                <div key={item} className="hn-comp-row">
                  <span style={{ color: T.muted, fontWeight: 300 }}>{item}</span>
                  <span style={{ color: pass ? T.green : "#ffaa00", fontSize: 10, fontWeight: 600, letterSpacing: ".05em" }}>{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 08 — Niche Bend */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>08</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Niche Bend</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Any video.<br />10 new angles.</div>
            <div style={{ fontSize: 12, fontWeight: 300, color: T.muted, lineHeight: 1.65 }}>
              Take any viral video and cross-pollinate it into niches your competitors haven't touched. Viral Magnet injection built in — every angle pre-optimized for CTR.
            </div>
            <FeatTag>Starter+</FeatTag>
          </div>
          <div className="hn-feat-artifact">
            <TermLine type="comment"># Finance video → bending to 5 niches</TermLine>
            <TermLine type="out">→ Fitness: "The Untold Reason Your Progress Stalled"</TermLine>
            <TermLine type="out">→ Tech: "Silently Draining Your Startup Budget"</TermLine>
            <TermLine type="out">→ Business: "The Brutal Truth About Why Agencies Fail"</TermLine>
            <TermLine type="out">→ Parenting: "Money Mistakes Parents Make Without Knowing"</TermLine>
            <TermLine type="out">→ Gaming: "Shocking Economy Tricks Top Players Never Share"</TermLine>
            <br />
            <TermLine type="check">✓ Viral Magnet injected on all 10</TermLine>
          </div>
        </div>

      </div>

      {/* ── PRICING ── */}
      <div id="pricing" style={{ padding: "72px 48px" }}>
        <SectionLabel>Pricing</SectionLabel>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-1px", color: T.text, lineHeight: 1.05, marginBottom: 10 }}>
          Simple. No surprises.
        </div>
        <div style={{ fontSize: 14, fontWeight: 300, color: T.muted, maxWidth: 420, lineHeight: 1.6, marginBottom: 48 }}>
          Start with 2 free scripts. No card required.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: T.border, border: `1px solid ${T.border}` }}>

          {/* Starter */}
          <div className="hn-price-card">
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: T.dim, marginBottom: 16 }}>Starter</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 }}>
              <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-2px", color: T.text, lineHeight: 1 }}>$19</span>
              <span style={{ fontSize: 12, color: T.dim, fontWeight: 300 }}>/mo</span>
            </div>
            <div style={{ fontSize: 11, color: T.dim, marginBottom: 20 }}>20 scripts / month</div>
            <div style={{ height: 1, background: T.border, margin: "16px 0" }} />
            {["20 scripts / month","Niche Bend Engine","Viral Remixer","Viral Magnet Titles","Metadata & A/B Testing"].map(f => (
              <div key={f} style={{ fontSize: 12, color: T.muted, padding: "4px 0", display: "flex", alignItems: "center", gap: 8, fontWeight: 300 }}>
                <Check /> {f}
              </div>
            ))}
            <Link href="/pricing" className="hn-price-btn" style={{
              display: "block", width: "100%", marginTop: 24, padding: 10,
              fontSize: 11, fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase" as const,
              textDecoration: "none", textAlign: "center" as const,
              background: "transparent", color: T.muted, border: `1px solid ${T.border}`,
            }}>Get Starter</Link>
          </div>

          {/* Pro — featured */}
          <div className="hn-price-card hn-price-featured">
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: T.bg, background: T.accent, padding: "3px 8px", display: "inline-block", marginBottom: 12 }}>
              Most Popular
            </div>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: T.dim, marginBottom: 16 }}>Pro</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 }}>
              <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-2px", color: T.text, lineHeight: 1 }}>$39</span>
              <span style={{ fontSize: 12, color: T.dim, fontWeight: 300 }}>/mo</span>
            </div>
            <div style={{ fontSize: 11, color: T.dim, marginBottom: 20 }}>50 scripts / month</div>
            <div style={{ height: 1, background: T.border, margin: "16px 0" }} />
            {[
              "50 scripts / month",
              "Niche Bend Engine",
              "Viral Remixer",
              "Viral Magnet Titles",
              "Metadata & A/B Testing",
              "Compliance Checker (20/mo)",
              "Priority generation",
            ].map(f => (
              <div key={f} style={{ fontSize: 12, color: T.muted, padding: "4px 0", display: "flex", alignItems: "center", gap: 8, fontWeight: 300 }}>
                <Check /> {f}
              </div>
            ))}
            <Link href="/pricing" className="hn-price-btn" style={{
              display: "block", width: "100%", marginTop: 24, padding: 10,
              fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const,
              textDecoration: "none", textAlign: "center" as const,
              background: T.accent, color: T.bg, border: "none",
            }}>Get Pro →</Link>
          </div>

          {/* Agency */}
          <div className="hn-price-card">
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: T.dim, marginBottom: 16 }}>Agency</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 }}>
              <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-2px", color: T.text, lineHeight: 1 }}>$99</span>
              <span style={{ fontSize: 12, color: T.dim, fontWeight: 300 }}>/mo</span>
            </div>
            <div style={{ fontSize: 11, color: T.dim, marginBottom: 20 }}>200 scripts / month</div>
            <div style={{ height: 1, background: T.border, margin: "16px 0" }} />
            {[
              "200 scripts / month",
              "Niche Bend Engine",
              "Viral Remixer",
              "Viral Magnet Titles",
              "Metadata & A/B Testing",
              "Compliance Checker (100/mo)",
              "Priority generation",
              "5 team seats",
            ].map(f => (
              <div key={f} style={{ fontSize: 12, color: T.muted, padding: "4px 0", display: "flex", alignItems: "center", gap: 8, fontWeight: 300 }}>
                <Check /> {f}
              </div>
            ))}
            <Link href="/pricing" className="hn-price-btn" style={{
              display: "block", width: "100%", marginTop: 24, padding: 10,
              fontSize: 11, fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase" as const,
              textDecoration: "none", textAlign: "center" as const,
              background: "transparent", color: T.muted, border: `1px solid ${T.border}`,
            }}>Get Agency</Link>
          </div>

        </div>

        <div style={{ marginTop: 20, fontSize: 11, color: T.dim, textAlign: "center" as const }}>
          Questions?{" "}
          <a href="mailto:hello@skripr.com" style={{ color: T.accent, textDecoration: "none" }}>hello@skripr.com</a>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: T.dim }}>
          SKRIP<span style={{ fontWeight: 200 }}>R</span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {[
            ["/dashboard/scripts/new","Scripts"],
            ["/dashboard/hooks","Hooks"],
            ["/dashboard/educate","Learn"],
            ["/pricing","Pricing"],
            ["/terms","Terms"],
            ["/privacy","Privacy"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="hn-foot-link">{label}</Link>
          ))}
        </div>
        <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.04em" }}>© 2026 Skripr. Built for creators.</div>
      </footer>

    </div>
  );
}
