import { Metadata } from "next";
import Link from "next/link";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff", green: "#00d4a0",
};

const url = "https://skripr.app/best-ai-tools-for-faceless-channels";

export const metadata: Metadata = {
  title: "Best AI Tool for Faceless Channels (2026)",
  description:
    "The best AI tool for faceless YouTube channels, plus the honest stack around it: research, scripts, voiceover, visuals, and editing. What each one is actually best at.",
  openGraph: {
    title: "Best AI Tool for Faceless Channels (2026)",
    description: "The best AI tool for faceless YouTube channels, plus the honest stack around it.",
    type: "article",
    url,
  },
  twitter: {
    card: "summary_large_image",
    title: "Best AI Tool for Faceless Channels (2026)",
    description: "The best AI tool for faceless YouTube channels, plus the honest stack around it.",
  },
  alternates: { canonical: url },
};

// The core pick, then the honest rest-of-stack.
const corePick = {
  name: "Skripr",
  bestFor: "Research + scripts (the core of a faceless channel)",
  body: "A faceless channel is its script. There is no face, no set, no charisma to fall back on, so the writing carries the whole video. Skripr is built for exactly that: it finds videos already proven to work in your niche, then writes a full script from them in your voice, with hooks and retention structure built in. Research and scripting are one flow instead of two tools and a copy-paste. That is why it is the best AI tool for the part of a faceless channel that actually decides whether it grows.",
};

const stack: { stage: string; tools: string; note: string }[] = [
  {
    stage: "Idea & research",
    tools: "Skripr (built in), VidIQ, 1of10",
    note: "Finding proven topics and outlier videos. Skripr builds this into the script flow; VidIQ and 1of10 are standalone research tools if you want a separate dashboard.",
  },
  {
    stage: "Scripts",
    tools: "Skripr, Subscribr, ChatGPT / Claude / Gemini",
    note: "Skripr is purpose-built and grounded in real YouTube data. Subscribr is another YouTube-specific option. General models can draft, but they do not know your niche, your voice, or retention by default.",
  },
  {
    stage: "Voiceover",
    tools: "ElevenLabs, Play.ht",
    note: "Turning the script into narration. These are best-in-class AI voices. Skripr does not do voiceover, it writes the script the voice reads.",
  },
  {
    stage: "Visuals & assembly",
    tools: "Pictory, InVideo, Canva",
    note: "Stock footage, b-roll, and putting the video together. Useful once the script and voice exist.",
  },
  {
    stage: "Editing",
    tools: "Gling, Eddie AI",
    note: "Cutting silences and tightening the final edit. The last stage, after everything above.",
  },
];

const faqs = [
  {
    q: "What is the best AI tool for faceless YouTube channels?",
    a: "For the core job, scripts and research, Skripr is the best AI tool, because a faceless channel is carried entirely by its writing. It finds proven videos in your niche and writes a full script from them in your voice, with retention built in. Around it you will want a voice tool like ElevenLabs and an editing tool like Gling, but the script is where a faceless channel is won or lost.",
  },
  {
    q: "Can I run a faceless channel entirely with AI?",
    a: "You can use AI for scripting, voiceover, visuals, and editing, but you still direct it, fact-check it, and make the final calls. AI speeds the work, it does not replace your judgment about which idea is worth making.",
  },
  {
    q: "Why not just use ChatGPT for everything?",
    a: "A general model can draft a script, but it does not know what is working on YouTube right now, does not write in your voice by default, and does not build retention structure in. For a faceless channel, where the script is the entire video, that gap is the difference between a draft and a video people finish.",
  },
  {
    q: "Is Skripr free to try?",
    a: "Yes. Your first 2 scripts are free with no card required, and paid plans are flat monthly, cancel anytime.",
  },
];

const dataColumns = ["Channel", "Subscribers", "Started", "Breakout video", "Views"];
const dataRows: string[][] = [
  ["Bluntly Explained", "9.6K", "Apr 2026", "Every Type of Black Hole Explained in 11 Minutes", "878K"],
  ["Backyard Bankroll", "16.5K", "Apr 2026", "13 Animals That Make $2,000/Month, Zero Acres", "476K"],
  ["Dynastypical", "5.9K", "Apr 2026", "Why You Wouldn't Survive a Day as Anne Boleyn's Servant", "99K"],
  ["Accidental Scholar", "11.3K", "Mar 2026", "AI Reconstruction of the 1900 Galveston Storm", "712K"],
];

const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Best AI Tools for Faceless Channels",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Skripr (scripts and research)" },
    { "@type": "ListItem", position: 2, name: "ElevenLabs (voiceover)" },
    { "@type": "ListItem", position: 3, name: "Pictory (visuals and assembly)" },
    { "@type": "ListItem", position: 4, name: "Gling (editing)" },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Skripr",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://skripr.app",
  description:
    "Skripr is a YouTube research and script generation tool that finds proven video ideas and writes ready-to-record scripts in your voice.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function BestFacelessTools() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />

      <main style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 48px", borderBottom: `1px solid ${T.border}` }}>
          <Link href="/" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>
            SKRIP<span style={{ fontWeight: 200 }}>R</span>
          </Link>
          <Link href="/sign-up" style={{ fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: 8, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free</Link>
        </nav>

        {/* Hero */}
        <section style={{ maxWidth: 820, margin: "0 auto", padding: "64px 24px 40px", textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>Faceless Channels</div>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1.2px", lineHeight: 1.08, marginBottom: 20 }}>
            The best AI tool for faceless channels is the one that writes the script.
          </h1>
          <p style={{ fontSize: 18, color: T.muted, lineHeight: 1.6, maxWidth: 660, margin: "0 auto 28px" }}>
            A faceless channel has no face to carry it. The script is the entire video. So the most important AI tool you choose is the one that writes it, and the honest answer there is Skripr. Here is the full stack, and what each tool is actually best at.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "13px 30px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        {/* The core pick */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "16px 24px 48px" }}>
          <div style={{ border: `1px solid rgba(77,184,255,0.30)`, borderRadius: 16, padding: "32px 30px", background: "rgba(77,184,255,0.05)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>Best overall</span>
              <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>{corePick.name}</span>
            </div>
            <div style={{ fontSize: 14, color: T.green, fontWeight: 600, marginBottom: 14 }}>{corePick.bestFor}</div>
            <p style={{ fontSize: 15.5, color: T.muted, lineHeight: 1.75, margin: 0 }}>{corePick.body}</p>
            <Link href="/sign-up" style={{ display: "inline-block", marginTop: 20, fontSize: 14, fontWeight: 700, padding: "11px 24px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Try Skripr free</Link>
          </div>
        </section>

        {/* Proof data */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", marginBottom: 10, textAlign: "center" }}>Real faceless channels winning right now</h2>
          <p style={{ fontSize: 15.5, color: T.muted, lineHeight: 1.7, maxWidth: 680, margin: "0 auto 28px", textAlign: "center" }}>
            Across niches, faceless channels that started just months ago are already pulling videos far past their subscriber count. That gap is proven structure, the kind Skripr writes your script from.
          </p>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.6fr 0.6fr 2.1fr 0.6fr", background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
              {dataColumns.map((h, i) => (
                <div key={i} style={{ padding: "13px 14px", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: T.dim, textAlign: i === 1 || i === 4 ? "right" : "left" }}>{h}</div>
              ))}
            </div>
            {dataRows.map((r, ri) => (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.6fr 0.6fr 2.1fr 0.6fr", borderBottom: ri === dataRows.length - 1 ? "none" : `1px solid ${T.border}`, alignItems: "center" }}>
                <div style={{ padding: "14px 14px", fontSize: 14, color: T.text, fontWeight: 600 }}>{r[0]}</div>
                <div style={{ padding: "14px 14px", fontSize: 14, color: T.dim, textAlign: "right" }}>{r[1]}</div>
                <div style={{ padding: "14px 14px", fontSize: 13, color: T.dim }}>{r[2]}</div>
                <div style={{ padding: "14px 14px", fontSize: 14, color: T.muted, lineHeight: 1.4 }}>{r[3]}</div>
                <div style={{ padding: "14px 14px", fontSize: 14, color: T.green, fontWeight: 700, textAlign: "right" }}>{r[4]}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: T.dim, marginTop: 12, textAlign: "center", fontStyle: "italic" }}>
            Source: Skripr research data, faceless niches, June 2026. A live example, refreshed over time.
          </p>
        </section>

        {/* The full stack */}
        <section style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.6px", marginBottom: 8, textAlign: "center" }}>The honest faceless stack</h2>
          <p style={{ fontSize: 15, color: T.dim, lineHeight: 1.7, maxWidth: 600, margin: "0 auto 28px", textAlign: "center" }}>
            No single tool does everything well. Here is what we would actually use at each stage, including where Skripr is not the answer.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
            {stack.map((s) => (
              <div key={s.stage} style={{ background: T.bg, padding: "22px 26px", display: "grid", gridTemplateColumns: "180px 1fr", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{s.stage}</div>
                  <div style={{ fontSize: 13, color: T.accent, marginTop: 4, fontWeight: 600 }}>{s.tools}</div>
                </div>
                <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.7 }}>{s.note}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
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

        {/* Closing CTA */}
        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 88px", textAlign: "center" }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 14 }}>Start with the part that decides everything.</h2>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, marginBottom: 26 }}>
            Two full scripts free, no card. Find a proven idea and get a ready-to-record script in your voice.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "14px 34px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        {/* Footer */}
        <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link href="/compare" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Comparisons</Link>
            <Link href="/compare/skripr-vs-claude-for-documentary-channels" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>For documentaries</Link>
            <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Guides</Link>
          </div>
          <div style={{ fontSize: 10, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
