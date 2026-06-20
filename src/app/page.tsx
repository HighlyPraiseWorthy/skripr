"use client";
import Link from "next/link";

// ─── Decoy Viral Magnet words (NOT the real word bank) ────────────────────────
const DECOY_WORDS = [
  // S-grade
  { word: "Untold",    grade: "S", lift: "+420%", color: "#4db8ff" },
  { word: "Silently",  grade: "S", lift: "+390%", color: "#4db8ff" },
  { word: "Exposed",   grade: "S", lift: "+355%", color: "#4db8ff" },
  { word: "Shocking",  grade: "S", lift: "+340%", color: "#4db8ff" },
  { word: "Hidden",    grade: "S", lift: "+325%", color: "#4db8ff" },
  { word: "Banned",    grade: "S", lift: "+310%", color: "#4db8ff" },
  { word: "Secretly",  grade: "S", lift: "+298%", color: "#4db8ff" },
  // A-grade
  { word: "Brutal",    grade: "A", lift: "+215%", color: "#7c6fff" },
  { word: "Wrong",     grade: "A", lift: "+205%", color: "#7c6fff" },
  { word: "Actually",  grade: "A", lift: "+188%", color: "#7c6fff" },
  { word: "Nobody",    grade: "A", lift: "+182%", color: "#7c6fff" },
  { word: "Stopped",   grade: "A", lift: "+172%", color: "#7c6fff" },
  { word: "Costly",    grade: "A", lift: "+167%", color: "#7c6fff" },
  { word: "Broken",    grade: "A", lift: "+160%", color: "#7c6fff" },
  { word: "Overrated", grade: "A", lift: "+150%", color: "#7c6fff" },
  // B-grade
  { word: "Quietly",   grade: "B", lift: "+95%",  color: "#00d4a0" },
  { word: "Proven",    grade: "B", lift: "+88%",  color: "#00d4a0" },
  { word: "Finally",   grade: "B", lift: "+82%",  color: "#00d4a0" },
  { word: "Real",      grade: "B", lift: "+78%",  color: "#00d4a0" },
  { word: "Ignored",   grade: "B", lift: "+74%",  color: "#00d4a0" },
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
  "10 AI tools in one dashboard",
];
const FACTS_LOOP = [...PRODUCT_FACTS, ...PRODUCT_FACTS];

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:     "#080c12",
  bg2:    "#060a0f",
  bg3:    "#0a0f18",
  border: "#1a2840",
  text:   "#e8edf5",
  muted:  "#d2e2f2",
  dim:    "#bcd2e8",
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
  const colors = { comment: "#a9c3de", cmd: "#7cc9ff", out: "#dbe8f5", check: "#3ce6b0" };
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
  const handleCheckout = async (priceKey: "starter" | "pro" | "agency") => {
    const priceIds: Record<string, string> = {
      starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER || "",
      pro:     process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO     || "",
      agency:  process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY  || "",
    };
    const priceId = priceIds[priceKey];
    if (!priceId) { window.location.href = "/sign-up"; return; }
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else window.location.href = "/sign-up";
    } catch {
      window.location.href = "/sign-up";
    }
  };

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
        @keyframes hero-glow-pulse { 0%,100% { opacity:0.5; transform:translateX(-50%) scale(1) } 50% { opacity:1; transform:translateX(-50%) scale(1.05) } }
        .hero-glow { animation: hero-glow-pulse 9s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .hero-glow { animation: none; opacity: 0.8; } }
        @keyframes star-pulse-1 { 0%,100%{opacity:0.15;transform:scale(1)} 50%{opacity:0.55;transform:scale(1.3)} }
        @keyframes star-pulse-2 { 0%,100%{opacity:0.08;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.4)} }
        @keyframes star-pulse-3 { 0%,100%{opacity:0.2;transform:scale(1)} 60%{opacity:0.6;transform:scale(1.2)} }
        .hn-star {
          position:fixed; border-radius:50%; pointer-events:none; z-index:0;
          background: radial-gradient(circle, #9ce4ff 0%, #4db8ff 40%, transparent 70%);
        }
        .hn-star-s1 { width:2px; height:2px; animation: star-pulse-1 4.2s ease-in-out infinite; }
        .hn-star-s2 { width:3px; height:3px; animation: star-pulse-2 5.8s ease-in-out infinite; }
        .hn-star-s3 { width:2px; height:2px; animation: star-pulse-3 3.6s ease-in-out infinite; }
        .hn-star-m  { width:4px; height:4px; animation: star-pulse-1 7.1s ease-in-out infinite; background: radial-gradient(circle, #ffffff 0%, #9ce4ff 30%, #4db8ff 60%, transparent 80%); }
        @keyframes spin-border { 0% { transform: translate(-50%,-50%) rotate(0deg); } 100% { transform: translate(-50%,-50%) rotate(360deg); } }

        .hn-nav-link { font-size:12px; font-weight:400; letter-spacing:0.08em; color:${T.dim}; text-decoration:none; transition:color .15s; }
        .hn-nav-link:hover { color:${T.accent}; }
        .hn-ghost:hover { color:${T.accent} !important; border-color:${T.accent}44 !important; }
        .hn-feat-row { display:grid; grid-template-columns:80px 1fr 1fr; border-bottom:1px solid ${T.border}; align-items:stretch; }
        .hn-feat-row:last-child { border-bottom:none; }
        .hn-feat-artifact { background:${T.bg2}; border-left:1px solid ${T.border}; padding:28px 24px; display:flex; flex-direction:column; justify-content:flex-start; }
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

      {/* ── STARS ── */}
      {[
        { cls:"hn-star hn-star-s1", top:"8%",   left:"7%",   delay:"0s"    },
        { cls:"hn-star hn-star-s2", top:"12%",  left:"23%",  delay:"1.2s"  },
        { cls:"hn-star hn-star-s3", top:"6%",   left:"41%",  delay:"0.7s"  },
        { cls:"hn-star hn-star-m",  top:"15%",  left:"58%",  delay:"2.1s"  },
        { cls:"hn-star hn-star-s1", top:"9%",   left:"74%",  delay:"0.4s"  },
        { cls:"hn-star hn-star-s3", top:"7%",   left:"88%",  delay:"1.8s"  },
        { cls:"hn-star hn-star-s2", top:"22%",  left:"4%",   delay:"3.0s"  },
        { cls:"hn-star hn-star-s1", top:"31%",  left:"15%",  delay:"0.9s"  },
        { cls:"hn-star hn-star-m",  top:"28%",  left:"33%",  delay:"2.5s"  },
        { cls:"hn-star hn-star-s3", top:"35%",  left:"51%",  delay:"1.5s"  },
        { cls:"hn-star hn-star-s2", top:"26%",  left:"67%",  delay:"0.3s"  },
        { cls:"hn-star hn-star-s1", top:"33%",  left:"82%",  delay:"3.4s"  },
        { cls:"hn-star hn-star-s3", top:"38%",  left:"93%",  delay:"1.1s"  },
        { cls:"hn-star hn-star-m",  top:"48%",  left:"9%",   delay:"2.8s"  },
        { cls:"hn-star hn-star-s1", top:"52%",  left:"28%",  delay:"0.6s"  },
        { cls:"hn-star hn-star-s2", top:"45%",  left:"46%",  delay:"1.9s"  },
        { cls:"hn-star hn-star-s3", top:"55%",  left:"63%",  delay:"0.2s"  },
        { cls:"hn-star hn-star-s1", top:"49%",  left:"79%",  delay:"3.7s"  },
        { cls:"hn-star hn-star-m",  top:"44%",  left:"91%",  delay:"1.4s"  },
        { cls:"hn-star hn-star-s2", top:"62%",  left:"3%",   delay:"2.2s"  },
        { cls:"hn-star hn-star-s3", top:"68%",  left:"19%",  delay:"0.8s"  },
        { cls:"hn-star hn-star-s1", top:"65%",  left:"37%",  delay:"3.1s"  },
        { cls:"hn-star hn-star-m",  top:"72%",  left:"54%",  delay:"1.6s"  },
        { cls:"hn-star hn-star-s2", top:"60%",  left:"70%",  delay:"0.5s"  },
        { cls:"hn-star hn-star-s3", top:"75%",  left:"85%",  delay:"2.9s"  },
        { cls:"hn-star hn-star-s1", top:"80%",  left:"11%",  delay:"1.3s"  },
        { cls:"hn-star hn-star-m",  top:"85%",  left:"30%",  delay:"3.5s"  },
        { cls:"hn-star hn-star-s2", top:"82%",  left:"48%",  delay:"0.1s"  },
        { cls:"hn-star hn-star-s3", top:"88%",  left:"66%",  delay:"2.4s"  },
        { cls:"hn-star hn-star-s1", top:"91%",  left:"83%",  delay:"1.0s"  },
        { cls:"hn-star hn-star-m",  top:"95%",  left:"96%",  delay:"3.2s"  },
        { cls:"hn-star hn-star-s2", top:"94%",  left:"42%",  delay:"0.7s"  },
        { cls:"hn-star hn-star-s3", top:"17%",  left:"97%",  delay:"2.0s"  },
        { cls:"hn-star hn-star-s1", top:"57%",  left:"55%",  delay:"1.7s"  },
        { cls:"hn-star hn-star-m",  top:"3%",   left:"52%",  delay:"3.9s"  },
      ].map(({ cls, top, left, delay }, i) => (
        <div key={i} className={cls} style={{ top, left, animationDelay: delay }} />
      ))}

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
      <div style={{ paddingTop: 56, position: "relative" as const }}>
        <div className="hero-glow" aria-hidden style={{ position: "absolute" as const, top: 70, left: "50%", transform: "translateX(-50%)", width: 920, height: 540, maxWidth: "100%", borderRadius: "50%", background: "radial-gradient(circle, rgba(77,184,255,0.22) 0%, rgba(124,111,255,0.10) 42%, transparent 70%)", pointerEvents: "none" as const, zIndex: 0 }} />
        <div style={{ padding: "80px 48px 0", width: "100%", display: "flex", flexDirection: "column" as const, alignItems: "center" as const, animation: "fadein .6s ease both", position: "relative" as const, zIndex: 1 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 0.95, letterSpacing: "-2.5px", color: T.text, marginBottom: 20, textAlign: "center" as const }}>
            Your next video starts with<br />
            <span style={{ fontWeight: 200, color: T.accent }}>what already works.</span>
          </div>
          <p style={{ fontSize: 18, fontWeight: 300, lineHeight: 1.6, color: T.muted, maxWidth: 640, marginBottom: 40, textAlign: "center" as const }}>
            Idea to upload-ready script in 60 seconds. Paste a topic or any proven video, and Skripr writes it in your voice — hooks, retention structure, title, and metadata, all done.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" as const, gap: 14, marginBottom: 36, flexWrap: "wrap" as const }}>
            <span style={{ fontSize: 13, fontWeight: 400, color: T.muted, padding: "8px 16px", border: `1px solid ${T.border}`, borderRadius: 40 }}>
              The old way: 4–5 hours a video · still hit-or-miss
            </span>
            <span style={{ color: T.accent, fontSize: 16, fontWeight: 600 }}>→</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: T.text, padding: "8px 16px", border: `1px solid ${T.accent}`, borderRadius: 40, background: "rgba(77,184,255,0.06)" }}>
              With Skripr: idea to upload-ready in one sitting
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" as const, gap: 14, marginBottom: 20 }}>
            <Link href="/sign-up" style={{
              background: T.accent, color: T.bg,
              fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const,
              padding: "12px 24px", textDecoration: "none",
            }}>Start free — 2 scripts →</Link>
            <a href="#how" className="hn-ghost" style={{
              background: "transparent", color: T.muted,
              fontSize: 12, fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase" as const,
              padding: "12px 20px", border: `1px solid ${T.border}`, textDecoration: "none",
              transition: "color .15s, border-color .15s",
            }}>How it works ↓</a>
          </div>
          <div style={{ display: "flex", gap: 24, paddingBottom: 56, justifyContent: "center" as const }}>
            {["No credit card required", "Results in 60s", "Built for YouTubers"].map(t => (
              <span key={t} style={{ fontSize: 13, color: T.muted, letterSpacing: "0.03em" }}>{t}</span>
            ))}
          </div>
        </div>

              {/* ── LIVE TICKER ── */}
      <div style={{ overflow: "hidden", padding: "48px 0", background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <style>{`
          @keyframes scroll-left  { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
          @keyframes scroll-right { 0% { transform: translateX(-50%) } 100% { transform: translateX(0) } }
          .ticker-left  { animation: scroll-left  40s linear infinite; display: flex; gap: 14px; width: max-content; }
          .ticker-right { animation: scroll-right 50s linear infinite; display: flex; gap: 14px; width: max-content; }
          .ticker-left:hover, .ticker-right:hover { animation-play-state: paused; }
        `}</style>

        {/* Row 1 — Script output cards, scroll left */}
        <div style={{ overflow: "hidden", marginBottom: 14 }}>
          <div className="ticker-left">
            {[
              { niche: "True Crime", title: "The $47M Fraud the Media Refused to Cover", hook: "In 2019, a company stole from 200,000 people and only 3 journalists noticed.", grade: "S", word: "Uncovered" },
              { niche: "Finance", title: "The Savings Rate That's Quietly Shrinking You", hook: "The number on your statement isn't your real balance. Here's the math they skip.", grade: "A", word: "Overlooked" },
              { niche: "Psychology", title: "The Habit Loop That Rewired My Brain in 11 Days", hook: "I didn't quit social media. I replaced the reward. That's the piece nobody teaches.", grade: "S", word: "Reframed" },
              { niche: "History", title: "The Decision That Built Modern America", hook: "One overlooked vote in 1947 changed how 330 million people live today.", grade: "A", word: "Shelved" },
              { niche: "Self Improvement", title: "Stop Optimizing. Start Deciding.", hook: "Productivity culture wrecked me. Then I found the one shift that worked.", grade: "B", word: "Neglected" },
              { niche: "Gaming", title: "The Pattern Behind Every Viral Game Launch", hook: "Steam's recommendation engine isn't random. I mapped it out.", grade: "S", word: "Decoded" },
              { niche: "Motivation", title: "You're Not Tired. You're Running the Wrong System.", hook: "Most motivation advice targets effort. That's not the real bottleneck.", grade: "A", word: "Misjudged" },
              { niche: "Health", title: "The Sleep Study That Rewrote 40 Years of Research", hook: "A 2021 paper in a medical journal flipped everything we thought we understood.", grade: "S", word: "Rewritten" },
            ].concat([
              { niche: "True Crime", title: "The $47M Fraud the Media Refused to Cover", hook: "In 2019, a company stole from 200,000 people and only 3 journalists noticed.", grade: "S", word: "Uncovered" },
              { niche: "Finance", title: "The Savings Rate That's Quietly Shrinking You", hook: "The number on your statement isn't your real balance. Here's the math they skip.", grade: "A", word: "Overlooked" },
              { niche: "Psychology", title: "The Habit Loop That Rewired My Brain in 11 Days", hook: "I didn't quit social media. I replaced the reward. That's the piece nobody teaches.", grade: "S", word: "Reframed" },
              { niche: "History", title: "The Decision That Built Modern America", hook: "One overlooked vote in 1947 changed how 330 million people live today.", grade: "A", word: "Shelved" },
              { niche: "Self Improvement", title: "Stop Optimizing. Start Deciding.", hook: "Productivity culture wrecked me. Then I found the one shift that worked.", grade: "B", word: "Neglected" },
              { niche: "Gaming", title: "The Pattern Behind Every Viral Game Launch", hook: "Steam's recommendation engine isn't random. I mapped it out.", grade: "S", word: "Decoded" },
              { niche: "Motivation", title: "You're Not Tired. You're Running the Wrong System.", hook: "Most motivation advice targets effort. That's not the real bottleneck.", grade: "A", word: "Misjudged" },
              { niche: "Health", title: "The Sleep Study That Rewrote 40 Years of Research", hook: "A 2021 paper in a medical journal flipped everything we thought we understood.", grade: "S", word: "Rewritten" },
            ]).map((card, i) => {
              const gc: Record<string,string> = { S:"#f59e0b", A:"#4db8ff", B:"#34d399" };
              return (
                <div key={i} style={{ flexShrink: 0, width: 300, borderRadius: 14, background: T.bg2, border: `1px solid ${T.border}`, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.bg, background: T.accent, padding: "2px 7px", borderRadius: 4 }}>{card.niche}</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: gc[card.grade], background: `${gc[card.grade]}18`, padding: "2px 7px", borderRadius: 4 }}>🧲 {card.word} · {card.grade}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1.35, marginBottom: 8 }}>{card.title}</div>
                  <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6, fontStyle: "italic" }}>"{card.hook}"</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 2 — Viral Magnet word pills + CTR stats, scroll right */}
        <div style={{ overflow: "hidden" }}>
          <div className="ticker-right">
            {[
              { word: "Uncovered",   grade: "S", lift: "+418%", cat: "Revelation" },
              { word: "Reframed",    grade: "S", lift: "+382%", cat: "Contrast" },
              { word: "Decoded",     grade: "S", lift: "+401%", cat: "Discovery" },
              { word: "Overlooked",  grade: "A", lift: "+212%", cat: "Exclusivity" },
              { word: "Neglected",   grade: "A", lift: "+185%", cat: "Problem" },
              { word: "Rewritten",   grade: "S", lift: "+366%", cat: "Stakes" },
              { word: "Misjudged",   grade: "A", lift: "+193%", cat: "Contrast" },
              { word: "Shelved",      grade: "A", lift: "+220%", cat: "Intrigue" },
              { word: "Suppressed",  grade: "A", lift: "+205%", cat: "Controversy" },
              { word: "Underused",   grade: "B", lift: "+91%",  cat: "Opportunity" },
              { word: "Overdue",     grade: "B", lift: "+79%",  cat: "Relief" },
              { word: "Rediscovered",grade: "A", lift: "+238%", cat: "Emotion" },
              { word: "Sidelined",   grade: "B", lift: "+108%", cat: "Stakes" },
              { word: "Dismissed",   grade: "A", lift: "+198%", cat: "Intensity" },
              { word: "Unpublished", grade: "A", lift: "+168%", cat: "Exclusivity" },
              { word: "Derailed",    grade: "A", lift: "+177%", cat: "Stakes" },
              { word: "Unverified",  grade: "A", lift: "+158%", cat: "Intrigue" },
              { word: "Restricted",  grade: "A", lift: "+207%", cat: "Risk" },
              { word: "Reassessed",  grade: "B", lift: "+76%",  cat: "Authenticity" },
              { word: "Concealed",   grade: "B", lift: "+86%",  cat: "Intrigue" },
            ].concat([
              { word: "Uncovered",   grade: "S", lift: "+418%", cat: "Revelation" },
              { word: "Reframed",    grade: "S", lift: "+382%", cat: "Contrast" },
              { word: "Decoded",     grade: "S", lift: "+401%", cat: "Discovery" },
              { word: "Overlooked",  grade: "A", lift: "+212%", cat: "Exclusivity" },
              { word: "Neglected",   grade: "A", lift: "+185%", cat: "Problem" },
              { word: "Rewritten",   grade: "S", lift: "+366%", cat: "Stakes" },
              { word: "Misjudged",   grade: "A", lift: "+193%", cat: "Contrast" },
              { word: "Shelved",      grade: "A", lift: "+220%", cat: "Intrigue" },
              { word: "Suppressed",  grade: "A", lift: "+205%", cat: "Controversy" },
              { word: "Underused",   grade: "B", lift: "+91%",  cat: "Opportunity" },
              { word: "Overdue",     grade: "B", lift: "+79%",  cat: "Relief" },
              { word: "Rediscovered",grade: "A", lift: "+238%", cat: "Emotion" },
              { word: "Sidelined",   grade: "B", lift: "+108%", cat: "Stakes" },
              { word: "Dismissed",   grade: "A", lift: "+198%", cat: "Intensity" },
              { word: "Unpublished", grade: "A", lift: "+168%", cat: "Exclusivity" },
              { word: "Derailed",    grade: "A", lift: "+177%", cat: "Stakes" },
              { word: "Unverified",  grade: "A", lift: "+158%", cat: "Intrigue" },
              { word: "Restricted",  grade: "A", lift: "+207%", cat: "Risk" },
              { word: "Reassessed",  grade: "B", lift: "+76%",  cat: "Authenticity" },
              { word: "Concealed",   grade: "B", lift: "+86%",  cat: "Intrigue" },
            ]).map((w, i) => {
              const gc: Record<string,string> = { S:"#f59e0b", A:"#4db8ff", B:"#34d399" };
              const c = gc[w.grade] || T.accent;
              return (
                <div key={i} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 40, background: T.bg2, border: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: c }}>{w.word}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.bg, background: c, padding: "1px 5px", borderRadius: 3 }}>{w.grade}</span>
                  <span style={{ fontSize: 11, color: T.muted }}>{w.cat}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── DEMO WINDOW ── */}
        <div style={{ margin: "0 auto", maxWidth: 860, border: `1px solid ${T.accent}55`, background: T.bg2, borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 90px rgba(0,0,0,0.55), 0 0 70px rgba(77,184,255,0.28), 0 0 140px rgba(77,184,255,0.16)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", borderBottom: `1px solid ${T.border}`, background: T.bg }}>
            {["#ff5f57","#febc2e","#28c840"].map((c, i) => (
              <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
            ))}
            <span style={{ fontSize: 12, color: T.muted, letterSpacing: "0.05em", fontFamily: "monospace", marginLeft: 6 }}>
              skripr.app/dashboard/scripts/new
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: 240 }}>
            <div style={{ borderRight: `1px solid ${T.border}`, padding: 16, display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {[
                ["YouTube URL", "youtube.com/watch?v=ZpAFB3uRnME", true],
                ["Niche", "Personal Finance", false],
                ["Length", "8 minutes", false],
              ].map(([lbl, val, isUrl]) => (
                <div key={lbl as string}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: T.muted, marginBottom: 4 }}>{lbl}</div>
                  <div style={{ fontSize: isUrl ? 10 : 11, color: isUrl ? T.accent : T.text, padding: "7px 8px", border: `1px solid ${T.border}`, background: T.bg, lineHeight: 1.3, wordBreak: "break-all" as const }}>{val}</div>
                </div>
              ))}
              <button style={{ background: "linear-gradient(135deg,#0e6499,#1a8fd1,#4db8ff)", color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: 11, border: "none", cursor: "pointer", marginTop: 4, borderRadius: 8, boxShadow: "0 4px 18px rgba(77,184,255,0.35)" }}>
                ⚡ Generate
              </button>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${T.accent}0c`, border: `1px solid ${T.accent}22`, fontSize: 11, fontWeight: 600, color: T.accent, padding: "5px 9px", letterSpacing: ".04em", marginTop: 6 }}>
                Viral Magnet: "Changed" · A-tier
              </div>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: T.green, background: `${T.green}14`, border: `1px solid ${T.green}33`, padding: "3px 8px", borderRadius: 6 }}>✓ GENERATED</span>
                <span style={{ fontSize: 11.5, color: T.dim }}>~8 min · ready to record</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.3px", color: T.text, marginBottom: 9, lineHeight: 1.3 }}>
                How I Manage My Money — The 6-Account System That Changed Everything
              </div>
              <div style={{ fontSize: 13, color: T.accent, fontStyle: "italic", marginBottom: 11 }}>
                "Most people manage their money wrong — and I'll show you the exact system I use instead."
              </div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7, fontWeight: 400 }}>
                I used to be terrible with money. Then I stumbled on a system so simple it felt almost too obvious — and it completely changed how I handle every dollar I make.
                <span style={{ display: "inline-block", width: 1.5, height: 11, background: T.accent, marginLeft: 2, verticalAlign: "middle", animation: "blink 1s infinite" }} />
                <br /><br />
                It's not about earning more. It's about where the money goes the moment it hits your account. Here's the exact 6-account setup I use...
              </div>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                {["10 ranked hooks", "SEO title", "30 tags", "Compliance ✓"].map(c => (
                  <span key={c} style={{ fontSize: 10.5, fontWeight: 500, color: T.muted, background: T.bg, border: `1px solid ${T.border}`, padding: "3px 9px", borderRadius: 20 }}>{c}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── NICHE STRIP ── */}
        <div style={{ display: "flex", alignItems: "center", padding: "24px 48px", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 400, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: T.muted, paddingRight: 28, borderRight: `1px solid ${T.border}`, marginRight: 28, flexShrink: 0, whiteSpace: "nowrap" as const }}>
            Works for creators in
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" as const }}>
            {["True Crime","Psychology","Storytelling","History","Lifestyle","Gaming","Finance","Self Improvement","Motivation","Health"].map((n, i, arr) => (
              <span key={n} style={{ fontSize: 13, color: T.muted, letterSpacing: "0.03em" }}>
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
            Founding members get in first —{" "}
            <span style={{ color: T.text, fontWeight: 500 }}>and lock in early-access pricing as Skripr grows.</span>
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
          { n: "10", sup: "",  label: "AI tools, one dashboard" },
          { n: "10", sup: "×", label: "Faster than manual research" },
          { n: "2",  sup: "",  label: "Free scripts on signup" },
        ].map(({ n, sup, label }) => (
          <div key={label} style={{ background: T.bg, padding: "28px 24px", textAlign: "center" as const }}>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-1.5px", color: T.accent, lineHeight: 1 }}>
              {n}<sup style={{ fontSize: 18, fontWeight: 200, verticalAlign: "top", marginTop: 4, display: "inline-block" }}>{sup}</sup>
            </div>
            <div style={{ fontSize: 10, fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: T.muted, marginTop: 5 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── POSITIONING BAND ── */}
      <div style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, background: T.bg2 }}>
        <div style={{ padding: "72px 48px", maxWidth: 760, margin: "0 auto", textAlign: "center" as const }}>
          <SectionLabel>The top 10%</SectionLabel>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-1px", color: T.text, lineHeight: 1.08, marginBottom: 22 }}>
            Your competition is weaker<br />than you think.
          </div>
          <p style={{ fontSize: 17, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7, marginBottom: 16 }}>
            90% of YouTube is noise — creators winging it, recycling 2019 playbooks, posting and hoping something sticks. That's who you're actually up against.
          </p>
          <p style={{ fontSize: 17, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7, marginBottom: 16 }}>
            The top 10% don't win on luck. They win on sharp angles, real storytelling, and relentless testing. Simple — not easy. It just takes the work most people never do.
          </p>
          <p style={{ fontSize: 17, fontWeight: 500, color: T.text, lineHeight: 1.7 }}>
            Skripr does that work <span style={{ fontStyle: "italic" }}>with</span> you: proven angles, a storytelling engine built for retention, and titles you can test before you post. <span style={{ color: T.accent }}>The top 10% is closer than it looks.</span>
          </p>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div id="how" style={{ padding: "72px 48px", maxWidth: 1060, margin: "0 auto" }}>
        <div style={{ textAlign: "center" as const }}><SectionLabel>How it works</SectionLabel></div>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-1px", color: T.text, lineHeight: 1.05, marginBottom: 44, textAlign: "center" as const }}>
          Idea to upload-ready in three steps.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
          {[
            { n: "01", t: "Start from what works", d: "Paste a viral video or drop in a topic. Skripr finds the proven structure, hook, and pacing behind it — no blank page." },
            { n: "02", t: "Skripr writes the script", d: "A full, voiceover-ready script in your niche and your voice — ranked hooks, retention beats, and high-CTR title words built in." },
            { n: "03", t: "Publish-ready, not a draft", d: "Get titles, description, tags, and a demonetization check in the same flow. Paste it into your voiceover tool and upload." },
          ].map(s => (
            <div key={s.n} style={{ background: T.bg, padding: "32px 26px" }}>
              <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.accent, marginBottom: 14 }}>{s.n}</div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.4px", color: T.text, marginBottom: 10, lineHeight: 1.15 }}>{s.t}</div>
              <div style={{ fontSize: 14, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── NUMBERED FEATURES ── */}
      <div id="features" style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>

        {/* 01 — Script Generator */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>01</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Script Generator</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Any URL.<br />Full script.</div>
            <div style={{ fontSize: 14, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7 }}>
              Paste a YouTube URL. Skripr pulls the transcript, analyzes the narrative structure, and rebuilds it as a fully formatted, ready-to-record script adapted to your niche and target length.
            </div>
            <FeatTag color={T.green}>All plans</FeatTag>
          </div>
          <div className="hn-feat-artifact">
            <TermLine type="comment"># Extracting transcript</TermLine>
            <TermLine type="out">→ youtube.com/watch?v=ZpAFB3uRnME</TermLine>
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
            <div style={{ fontSize: 14, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7 }}>
              Power words graded by click psychology and YouTube search behavior. Each word shows a predicted CTR lift. Pick one — it auto-injects into your title and script hook.
            </div>
            <FeatTag>Starter+</FeatTag>
          </div>
          {/* Decoy words blurred + paywall gate */}
          <div className="hn-feat-artifact" style={{ position: "relative", overflow: "hidden", padding: 0 }}>
            <div style={{ padding: "20px 24px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: T.muted, marginBottom: 12 }}>
                Finance niche · power words
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, filter: "none", userSelect: "none" as const }}>
                {DECOY_WORDS.map(({ word, grade, color }) => (
                  <span key={word} className="hn-word" style={{ background: `${color}0a`, borderColor: `${color}33`, color, display: "flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" as const, overflow: "hidden" }}>
                    {word} <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.85 }}>{grade}</span>
                  </span>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* 03 — Viral Remixer */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>03</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Viral Remixer</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Any viral video.<br />Your version.</div>
            <div style={{ fontSize: 14, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7 }}>
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

        {/* 04 — Niche Bend */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>04</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Niche Bend</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Any video.<br />10 new angles.</div>
            <div style={{ fontSize: 14, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7 }}>
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
        {/* 05 — Hook Engine */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>05</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Hook Engine</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>10 hooks.<br />Ranked.</div>
            <div style={{ fontSize: 14, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7 }}>
              Every script gets 10 opening hooks across different psychological patterns — curiosity loops, controversy openers, pattern interrupts, stat shocks. Each scored for predicted audience retention.
            </div>
            <FeatTag color={T.green}>All plans</FeatTag>
          </div>
          <div className="hn-feat-artifact" style={{ padding: 0, justifyContent: "center" }}>
            <div style={{ width: "100%" }}>
              {HOOKS.map(({ score, text }) => (
                <div key={score} className="hn-hook-item">
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, flexShrink: 0, paddingTop: 1, minWidth: 28 }}>{score}</div>
                  <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, fontWeight: 400 }}>{text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 06 — A/B Titles */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>06</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>A/B Titles</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Test before<br />you publish.</div>
            <div style={{ fontSize: 14, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7 }}>
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

        {/* 07 — Metadata Suite */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>07</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Metadata Suite</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Titles, tags,<br />descriptions.</div>
            <div style={{ fontSize: 14, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7 }}>
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

        {/* 08 — Outlier Finder */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>08</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Outlier Finder</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Find what's<br />breaking out.</div>
            <div style={{ fontSize: 14, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7 }}>
              Drop in any channel and Skripr surfaces its outlier videos — the ones massively outperforming its own average. See which formats are catching fire, then build your version before everyone else copies them.
            </div>
            <FeatTag>Starter+</FeatTag>
          </div>
          <div className="hn-feat-artifact">
            <TermLine type="comment"># Scanning channel</TermLine>
            <TermLine type="out">→ youtube.com/@financechannel</TermLine>
            <TermLine type="check">✓ 48 videos analyzed</TermLine>
            <br />
            <TermLine type="comment"># Outliers found</TermLine>
            <TermLine type="out">→ "The $0 Budget That Went Viral" — 14× channel avg</TermLine>
            <TermLine type="out">→ "Why I Quit Index Funds" — 9× channel avg</TermLine>
            <TermLine type="out">→ "The Bank Trick They Hate" — 6× channel avg</TermLine>
            <TermLine type="check">✓ Ranked by outlier multiple</TermLine>
          </div>
        </div>

        {/* 09 — Voice Match */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", color: T.dim, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>09</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Voice Match</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Sound like<br />you. Always.</div>
            <div style={{ fontSize: 14, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7 }}>
              Save up to 5 voices from your own scripts or any YouTube channel. Pick one per script and Skripr writes in that exact style — so a calm explainer topic can read with the punch of a direct, no-fluff creator, or just like you.
            </div>
            <FeatTag>Starter+</FeatTag>
          </div>
          <div className="hn-feat-artifact">
            <TermLine type="comment"># Saved voices</TermLine>
            <TermLine type="out">→ Your channel · 12 scripts learned</TermLine>
            <TermLine type="out">→ Voice B · punchy, direct</TermLine>
            <TermLine type="out">→ Voice C · calm, explanatory</TermLine>
            <br />
            <TermLine type="comment"># Applying voice → this script</TermLine>
            <TermLine type="check">✓ Tone, pacing & sentence length matched</TermLine>
            <TermLine type="cmd">→ Reads like them, not generic AI</TermLine>
          </div>
        </div>

        {/* 10 — Compliance Checker */}
        <div className="hn-feat-row">
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.1em", color: T.muted, padding: "32px 24px", borderRight: `1px solid ${T.border}` }}>10</div>
          <div style={{ padding: "32px 24px" }}>
            <SectionLabel>Compliance Checker</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text, marginBottom: 10, lineHeight: 1.1 }}>Score before<br />you record.</div>
            <div style={{ fontSize: 14, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7 }}>
              Run your script through YouTube's advertiser-friendliness guidelines before you hit record. Get a score, a category breakdown, and rewrite suggestions — not after demonetization.
            </div>
            <FeatTag color={T.green}>All plans</FeatTag>
          </div>
          <div className="hn-feat-artifact" style={{ padding: 0 }}>
            <div style={{ height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: T.green, letterSpacing: "-1px", lineHeight: 1 }}>87</div>
                  <div style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: T.muted, marginTop: 3 }}>Advertiser score</div>
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

      {/* ── NICHE BEND / RPM DIFFERENTIATOR ── */}
      <div id="niche-edge" style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, background: T.bg2 }}>
        <div style={{ padding: "72px 48px", maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 56, alignItems: "center" }}>
          <div>
            <SectionLabel>Niche Bend — only on Skripr</SectionLabel>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-1px", color: T.text, lineHeight: 1.08, marginBottom: 18 }}>
              Don't just chase more views.<br />
              <span style={{ fontWeight: 200, color: T.purple }}>Reach an audience that pays more.</span>
            </div>
            <p style={{ fontSize: 17, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7, marginBottom: 20 }}>
              Niche Bend takes a format that's already winning and blends it into a different, higher-value community — so the same idea reaches two recommendation pools at once, and earns more per view.
            </p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
              {[
                "Bridges your topic into completely different niches — the kind of crossover that's still wide open",
                "Shows whether each blend is already proven on YouTube or a blue ocean nobody's claimed",
                "Surfaces the payout gap, so you can pivot toward niches that earn multiples more per 1,000 views",
              ].map(t => (
                <div key={t} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5, color: T.text, fontWeight: 400, lineHeight: 1.6 }}>
                  <Check color={T.purple} /> {t}
                </div>
              ))}
            </div>
          </div>
          {/* RPM arbitrage visual */}
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 16, background: T.bg, padding: "26px 28px" }}>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: T.dim, marginBottom: 18 }}>Same views. Different payout.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.muted, marginBottom: 4 }}>Psychology</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: T.text }}>~$8 <span style={{ fontSize: 13, fontWeight: 400, color: T.muted }}>RPM</span></div>
              </div>
              <span style={{ color: T.purple, fontSize: 20, fontWeight: 600 }}>→</span>
              <div style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.purple}`, background: "rgba(124,111,255,0.07)" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.muted, marginBottom: 4 }}>Personal Finance</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: T.text }}>~$15 <span style={{ fontSize: 13, fontWeight: 400, color: T.muted }}>RPM</span></div>
              </div>
            </div>
            <div style={{ fontSize: 15, color: T.text, fontWeight: 400, lineHeight: 1.65 }}>
              A Psychology niche creator who bends toward finance-minded viewers can earn <span style={{ color: T.purple, fontWeight: 700 }}>≈1.9x more</span> on the same 100K views — without leaving what they're good at.
            </div>
          </div>
        </div>
      </div>

      {/* ── COMPARISON: WHY NOT CHATGPT ── */}
      <div id="compare" style={{ padding: "72px 48px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center" as const }}><SectionLabel>ChatGPT vs Claude vs Skripr</SectionLabel></div>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-1px", color: T.text, lineHeight: 1.05, marginBottom: 12, textAlign: "center" as const }}>
          "Can't I just use ChatGPT?"
        </div>
        <p style={{ fontSize: 16, fontWeight: 400, color: "#d4e4f3", maxWidth: 580, lineHeight: 1.65, margin: "0 auto 40px", textAlign: "center" as const }}>
          You can write <em>a</em> script in ChatGPT or Claude. But a general AI doesn't know what's working on YouTube right now, doesn't write in your voice, and hands you a draft you still have to clean, de-risk, and optimize.
        </p>
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          {/* header */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.8fr 0.8fr 0.9fr", background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
            {["", "ChatGPT", "Claude", "Skripr"].map((h, i) => (
              <div key={i} style={{ padding: "15px 16px", fontSize: 13.5, fontWeight: 700, letterSpacing: "0.04em", color: i === 3 ? T.accent : T.muted, textAlign: i === 0 ? "left" : "center", background: i === 3 ? "rgba(77,184,255,0.08)" : "transparent" }}>{h}</div>
            ))}
          </div>
          {([
            ["Write a script from a prompt", "y", "y", "y"],
            ["Knows what's working on YouTube right now", "n", "n", "y"],
            ["Finds a channel's breakout (outlier) videos", "n", "n", "y"],
            ["Reverse-engineers a viral video's framework", "m", "m", "y"],
            ["Writes in your voice — or any creator's", "n", "n", "y"],
            ["Retention mechanics built into every script", "p", "p", "y"],
            ["Voiceover-ready (no markers to clean up)", "n", "n", "y"],
            ["Copyright-safe (original lines, sponsors stripped)", "n", "n", "y"],
            ["Niche title science (high-CTR word pairing)", "n", "n", "y"],
            ["Demonetization / compliance check", "n", "n", "y"],
            ["Metadata: titles, description, tags, thumbnails", "m", "m", "y"],
            ["Idea → publish in one workflow", "n", "n", "y"],
          ] as const).map((row, ri) => (
            <div key={ri} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.8fr 0.8fr 0.9fr", borderBottom: ri === 11 ? "none" : `1px solid ${T.border}` }}>
              <div style={{ padding: "14px 16px", fontSize: 14.5, color: T.text, fontWeight: 400 }}>{row[0]}</div>
              {[row[1], row[2], row[3]].map((v, ci) => (
                <div key={ci} style={{ padding: "14px 16px", textAlign: "center" as const, fontSize: 13.5, background: ci === 2 ? "rgba(77,184,255,0.08)" : "transparent",
                  color: v === "y" ? T.green : v === "n" ? T.muted : "#cdd9e6", fontWeight: v === "y" ? 700 : 500 }}>
                  {v === "y" ? "✓" : v === "n" ? "✗" : v === "m" ? "Manual" : "If you prompt it"}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 15, fontWeight: 400, color: T.muted, lineHeight: 1.6, margin: "22px auto 0", maxWidth: 640, textAlign: "center" as const }}>
          ChatGPT gives you a blank-canvas draft. Skripr gives you a performance-informed, voice-matched, publish-safe script — and the workflow to get it live.
        </p>
      </div>

      <div id="pricing" style={{ padding: "72px 48px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center" }}><SectionLabel>Pricing</SectionLabel></div>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-1px", color: T.text, lineHeight: 1.05, marginBottom: 10, textAlign: "center" as const }}>
          Simple. No surprises.
        </div>
        <div style={{ fontSize: 14, fontWeight: 300, color: T.muted, maxWidth: 420, lineHeight: 1.6, marginBottom: 48, textAlign: "center", margin: "0 auto 48px" }}>
          Start with 2 free scripts. No card required. Cancel anytime.
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
            <button onClick={() => handleCheckout("starter")} className="hn-price-btn" style={{
              display: "block", width: "100%", marginTop: 24, padding: 10,
              fontSize: 11, fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase",
              textAlign: "center", cursor: "pointer",
              background: "transparent", color: T.muted, border: `1px solid ${T.border}`,
            }}>Get Starter</button>
          </div>

          {/* Pro — featured */}
          <div style={{ position: "relative", padding: "2px", background: T.bg2, overflow: "hidden" }}>
            {/* Spinning beam — oversized rotating div behind card */}
            <div style={{
              position: "absolute",
              top: "50%", left: "50%",
              width: "350%", height: "350%",
              transform: "translate(-50%, -50%)",
              background: `conic-gradient(from 0deg, transparent 0deg, transparent 158deg, #1a6aaa 163deg, #4db8ff 168deg, #9ce4ff 172deg, #4db8ff 176deg, #1a6aaa 181deg, transparent 186deg, transparent 360deg)`,
              animation: "spin-border 2.5s linear infinite",
              zIndex: 0,
            }} />
            {/* Card content sits on top */}
            <div className="hn-price-card" style={{ position: "relative", zIndex: 1, background: T.bg2 }}>
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
              <button onClick={() => handleCheckout("pro")} className="hn-price-btn" style={{
                display: "block", width: "100%", marginTop: 24, padding: 10,
                fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
                textAlign: "center", cursor: "pointer",
                background: T.accent, color: T.bg, border: "none",
              }}>Get Pro →</button>
            </div>
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
            <button onClick={() => handleCheckout("agency")} className="hn-price-btn" style={{
              display: "block", width: "100%", marginTop: 24, padding: 10,
              fontSize: 11, fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase",
              textAlign: "center", cursor: "pointer",
              background: "transparent", color: T.muted, border: `1px solid ${T.border}`,
            }}>Get Agency</button>
          </div>

        </div>

        <div style={{ marginTop: 20, fontSize: 11, color: T.dim, textAlign: "center" as const }}>
          Questions?{" "}
          <a href="mailto:skripr.app@gmail.com" style={{ color: T.accent, textDecoration: "none" }}>skripr.app@gmail.com</a>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div id="faq" style={{ padding: "72px 48px", maxWidth: 760, margin: "0 auto", borderTop: `1px solid ${T.border}` }}>
        <div style={{ textAlign: "center" as const }}><SectionLabel>FAQ</SectionLabel></div>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-1px", color: T.text, lineHeight: 1.05, marginBottom: 40, textAlign: "center" as const }}>
          Questions, answered.
        </div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
          {[
            { q: "Do I need a big channel for this to work?", a: "No. Skripr is built for brand-new and faceless channels. You start from videos that already work in your niche — so you're not guessing what to make, even with zero subscribers." },
            { q: "Is it really free to try?", a: "Yes — your first 2 scripts are free, no credit card required. You only upgrade once you've seen the output for yourself." },
            { q: "Will my scripts be original and safe to post?", a: "Yes. When you remix a video, Skripr mirrors its structure and pacing — never its wording. It writes its own metaphors and lines, strips out any sponsor reads, and outputs clean voiceover-ready text, so you're not copying anyone." },
            { q: "Can it sound like me?", a: "Yes. Voice Match learns your writing style from your past scripts (or any channel you choose) and applies it to every script — so it reads like you, not a generic AI narrator." },
            { q: "Why not just use ChatGPT?", a: "ChatGPT can write a draft, but it doesn't know what's performing on YouTube right now, can't find a channel's breakout videos, won't write in your voice, and gives you something you still have to clean and de-risk. Skripr does all of that in one workflow." },
            { q: "What kind of videos is this for?", a: "Long-form, faceless, and on-camera channels across any niche — finance, history, psychology, true crime, science, fitness, and more. If it's a YouTube video with a script, Skripr can build it." },
          ].map((f, i) => (
            <div key={i} style={{ background: T.bg, padding: "22px 24px" }}>
              <div style={{ fontSize: 16.5, fontWeight: 600, color: T.text, marginBottom: 8 }}>{f.q}</div>
              <div style={{ fontSize: 14, fontWeight: 400, color: "#d4e4f3", lineHeight: 1.7 }}>{f.a}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <div style={{ padding: "88px 48px", textAlign: "center" as const, borderTop: `1px solid ${T.border}`, background: T.bg2 }}>
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-1.5px", color: T.text, lineHeight: 1.05, marginBottom: 16, maxWidth: 680, margin: "0 auto 16px" }}>
          Your next video is one paste away.
        </div>
        <p style={{ fontSize: 18, fontWeight: 400, color: "#d4e4f3", maxWidth: 540, lineHeight: 1.6, margin: "0 auto 32px" }}>
          Start from what's already working, write it in your voice, and walk away with an upload-ready script — in one sitting.
        </p>
        <Link href="/sign-up" style={{
          display: "inline-block", background: T.accent, color: T.bg,
          fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const,
          padding: "14px 32px", textDecoration: "none",
        }}>Start free — 2 scripts →</Link>
        <div style={{ marginTop: 18, fontSize: 15, color: T.muted, letterSpacing: "0.03em" }}>No credit card required · results in 60 seconds</div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: T.muted }}>
          SKRIP<span style={{ fontWeight: 200 }}>R</span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {[
            ["/dashboard/scripts/new","Scripts"],
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
