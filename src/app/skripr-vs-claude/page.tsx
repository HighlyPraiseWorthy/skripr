import { Metadata } from "next";
import Link from "next/link";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff", green: "#00d4a0",
};

export const metadata: Metadata = {
  title: "Skripr vs Claude for YouTube Scripts (2026)",
  description:
    "Claude and ChatGPT can write a script. They cannot write the one that gets watched. See why a purpose-built tool beats general AI for YouTube scripts.",
  openGraph: {
    title: "Skripr vs Claude for YouTube Scripts (2026)",
    description: "Claude can write a script. It cannot write the one that gets watched. Here is the difference.",
    type: "website",
    url: "https://skripr.app/skripr-vs-claude",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skripr vs Claude for YouTube Scripts (2026)",
    description: "Claude can write a script. It cannot write the one that gets watched.",
  },
  alternates: { canonical: "https://skripr.app/skripr-vs-claude" },
};

const faqs = [
  {
    q: "Can I just use Claude or ChatGPT to write YouTube scripts?",
    a: "You can, and they write fluent prose. The gap is that a general AI does not know what is working on YouTube right now, does not write in your voice by default, and does not build retention structure in. You get a blank-canvas draft you still have to research, restructure, and clean up. Skripr is built specifically for the YouTube script, so that work is already done.",
  },
  {
    q: "What does Skripr do that Claude does not?",
    a: "Skripr starts from videos already proven to work in your niche, writes in your voice or any creator's voice you choose, builds in hooks and retention beats, grounds claims in real cited research, and adds titles, metadata, and a demonetization check. It is a purpose-built YouTube pipeline rather than a general chat tool.",
  },
  {
    q: "Is Skripr better than Claude?",
    a: "For general writing, coding, and reasoning, Claude is excellent and Skripr does not try to compete with it. For the specific job of writing a YouTube script that gets clicked and watched, Skripr is purpose-built and goes deeper.",
  },
  {
    q: "Is Skripr free to try?",
    a: "Yes. Your first 2 scripts are free with no card required, and paid plans are flat monthly with cancel anytime.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

const rows: [string, string, string][] = [
  ["Knows what is working on YouTube now", "Yes, built on live data", "No"],
  ["Writes in your voice or any creator's", "Yes (Voice Match)", "Generic by default"],
  ["Retention structure built in", "Yes, hooks and re-hooks", "Only if you prompt it"],
  ["Reverse-engineers a proven video", "Yes (Niche Bend, Remixer)", "No"],
  ["Real cited research", "Yes", "Not reliably"],
  ["Title, metadata, compliance check", "Yes, in one flow", "No"],
  ["Output", "Ready to record", "A draft you clean up"],
];

const beliefs = [
  {
    t: "A general AI writes into the dark.",
    d: "Claude is brilliant, but it does not know which hooks, titles, and angles are pulling views on YouTube this week. Skripr does, because it is built on what is already working in your niche. You start from proven, not from a guess.",
  },
  {
    t: "Generic scripts get sensed in a sentence.",
    d: "Paste a prompt into any chatbot and the output sounds like every other chatbot. Skripr learns your voice, or any creator's voice you choose, and writes every script in it, so viewers hear a real person and stay.",
  },
  {
    t: "The script is a pipeline, not a paragraph.",
    d: "A finished YouTube video needs a hook, retention beats, research, a title, metadata, and a compliance check. Skripr does all of it in one flow. A general chat tool gives you raw text and leaves the rest to you.",
  },
];

export default function SkriprVsClaude() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 48px", borderBottom: `1px solid ${T.border}` }}>
          <Link href="/" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>
            SKRIP<span style={{ fontWeight: 200 }}>R</span>
          </Link>
          <Link href="/sign-up" style={{ fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: 8, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free</Link>
        </nav>

        <section style={{ maxWidth: 800, margin: "0 auto", padding: "72px 24px 48px", textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>Skripr vs Claude</div>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1.2px", lineHeight: 1.08, marginBottom: 20 }}>
            Claude can write a script. It can't write the one that gets watched.
          </h1>
          <p style={{ fontSize: 18, color: T.muted, lineHeight: 1.6, maxWidth: 640, margin: "0 auto 28px" }}>
            General AI gives you fluent text with no idea what is working on YouTube, no voice match, and no retention structure, so you still have to research it, rebuild it, and clean it up. Skripr is built for the one job that decides whether a video gets watched: the script.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "13px 30px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        <section style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 64px" }}>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
              {["", "Skripr", "Claude / ChatGPT"].map((h, i) => (
                <div key={i} style={{ padding: "16px 18px", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textAlign: i === 0 ? "left" : "center", color: i === 1 ? T.accent : T.muted, background: i === 1 ? "rgba(77,184,255,0.08)" : "transparent" }}>{h}</div>
              ))}
            </div>
            {rows.map((r, ri) => (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", borderBottom: ri === rows.length - 1 ? "none" : `1px solid ${T.border}` }}>
                <div style={{ padding: "15px 18px", fontSize: 14.5, color: T.text, fontWeight: 500 }}>{r[0]}</div>
                <div style={{ padding: "15px 18px", fontSize: 14, textAlign: "center", color: T.green, fontWeight: 600, background: "rgba(77,184,255,0.05)" }}>{r[1]}</div>
                <div style={{ padding: "15px 18px", fontSize: 14, textAlign: "center", color: T.dim }}>{r[2]}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 64px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
            {beliefs.map((b) => (
              <div key={b.t} style={{ background: T.bg, padding: "30px 26px" }}>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 12, lineHeight: 1.25 }}>{b.t}</div>
                <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.75 }}>{b.d}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 64px", textAlign: "center" }}>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7 }}>
            Claude is a phenomenal general tool, and we use it too. For brainstorming, research, and a hundred other jobs, reach for it. But when the deliverable is a YouTube script that has to get the click and hold the view, a purpose-built tool wins. That is the one job Skripr is built for.
          </p>
        </section>

        <section style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 72px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.6px", marginBottom: 28, textAlign: "center" }}>Common questions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
            {faqs.map((f) => (
              <div key={f.q} style={{ background: T.bg, padding: "22px 24px" }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.q}</div>
                <div style={{ fontSize: 14.5, color: T.muted, lineHeight: 1.7 }}>{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 88px", textAlign: "center" }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 14 }}>Stop cleaning up generic drafts.</h2>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, marginBottom: 26 }}>
            Two full scripts free, no card. See the difference a purpose-built tool makes.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "14px 34px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <div style={{ display: "flex", gap: 24 }}>
            <Link href="/subscribr-alternative" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>vs Subscribr</Link>
            <Link href="/tubeai-alternative" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>vs TubeAI</Link>
            <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Guides</Link>
          </div>
          <div style={{ fontSize: 10, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
