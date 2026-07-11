import { Metadata } from "next";
import Link from "next/link";
import FlopDiagnostic from "@/components/FlopDiagnostic";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff", green: "#00d4a0",
};

const url = "https://skripr.app/why-did-my-video-flop";

export const metadata: Metadata = {
  title: "Why Is My YouTube Video Not Getting Views? Free Diagnostic | Skripr",
  description: "Type in four numbers from YouTube Studio and find the exact leak: reach, click, open, or structure. Free, instant, no signup. Then fix the right thing.",
  openGraph: {
    title: "Why Did My Video Flop? Free YouTube Diagnostic",
    description: "Four numbers from Studio in, the exact leak out. Free, instant, no signup.",
    type: "website", url,
  },
  twitter: { card: "summary_large_image", title: "Why Did My Video Flop? Free YouTube Diagnostic", description: "Four numbers from Studio in, the exact leak out. Free, instant, no signup." },
  alternates: { canonical: url },
};

const FAQS = [
  { q: "Why is my YouTube video not getting views?", a: "It is almost always one of four leaks. Low impressions means a reach leak, the topic or packaging never earned a bigger test. Low CTR means a click leak in the title and thumbnail. A drop in the first 30 seconds means the opening did not deliver what the packaging promised. Mid-video drops mean a structure leak in the script. The diagnostic above tells you which one you have." },
  { q: "Is my channel shadowbanned?", a: "Almost certainly not. What feels like a shadowban is usually the algorithm testing a video on a small group, getting weak early clicks, and quietly not expanding it. The algorithm matches videos to audiences, it does not grade quality or punish channels in secret." },
  { q: "How long should I wait before judging a video?", a: "Give it 3 to 7 days. YouTube tests in waves, and small channels often see the real test start days after upload. Judging a video on day one tells you very little." },
  { q: "Is this diagnostic free?", a: "Yes. It is free and needs no signup and no login. Paste your channel to pick the video, or just type the numbers in. Either way it reads four numbers you can see in your own YouTube Studio and names the leak." },
];

export default function FlopDiagnosticPage() {
  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "YouTube Video Diagnostic: Why Did My Video Flop?",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: "Free diagnostic that finds why a YouTube video is not getting views: reach, click, open, or structure leak.",
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://skripr.app" },
      { "@type": "ListItem", position: 2, name: "Why Did My Video Flop?", item: url },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 48px", borderBottom: `1px solid ${T.border}` }}>
          <Link href="/" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>
            SKRIP<span style={{ fontWeight: 200 }}>R</span>
          </Link>
          <Link href="/sign-up" style={{ fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: 8, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free</Link>
        </nav>

        <div style={{ maxWidth: 820, margin: "0 auto", padding: "20px 24px 0" }}>
          <nav style={{ fontSize: 13, color: T.dim }}>
            <Link href="/" style={{ color: T.dim, textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <span style={{ color: T.muted }}>Why Did My Video Flop?</span>
          </nav>
        </div>

        {/* Hero + tool */}
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>Free diagnostic, no signup</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-1.4px", lineHeight: 1.08, marginBottom: 18 }}>Why Did My Video Flop?</h1>
          <p style={{ fontSize: 19, color: T.muted, lineHeight: 1.6, maxWidth: 600, margin: "0 auto 28px" }}>
            Pick the video from your channel, add four numbers from YouTube Studio, and find the exact leak. Reach, click, open, or structure. Free, no login, nothing to connect.
          </p>
        </section>
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 44px" }}>
          <FlopDiagnostic />
        </section>

        {/* Body */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "8px 24px 40px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 14 }}>A video only fails in four places</h2>
          <p style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, marginBottom: 16 }}>
            When a video flops, most advice is vibes: post more, be consistent, improve quality. The numbers say something more useful. Impressions measure reach. CTR measures the click. Retention measures the hold. Each one points at a different leak, and fixing the wrong one wastes weeks.
          </p>
          <p style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, marginBottom: 16 }}>
            Low impressions is a reach leak. The algorithm tested the video on a small group and the early response did not earn a bigger test. Low CTR is a click leak, the title and thumbnail did not earn the click. A drop in the first 30 seconds is an open leak, the video did not deliver what the packaging promised. And mid-video drops are a structure leak, which lives in the script.
          </p>
          <p style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, margin: 0 }}>
            One thing worth internalizing: the algorithm is not judging you. It matches videos to audiences. Every leak above is something you control, and three of the four are fixed before you ever hit record.
          </p>
        </section>

        {/* FAQ */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.6px", marginBottom: 28, textAlign: "center" }}>Common questions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
            {FAQS.map((f) => (
              <div key={f.q} style={{ background: T.bg, padding: "22px 24px" }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.q}</div>
                <div style={{ fontSize: 14.5, color: T.muted, lineHeight: 1.7 }}>{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Other tools */}
        <section style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 16, textAlign: "center" }}>Fix the leak with a free tool</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { href: "/youtube-title-generator", label: "Title Generator", desc: "Click leak: a title that earns the click." },
              { href: "/youtube-hook-generator", label: "Hook Generator", desc: "Open leak: a first line that pays off the promise." },
              { href: "/youtube-video-ideas-generator", label: "Video Ideas Generator", desc: "Reach leak: a topic with a bigger pool." },
              { href: "/youtube-seo-tools", label: "All SEO Tools", desc: "Tags, titles, hooks, and descriptions." },
            ].map((o) => (
              <Link key={o.href} href={o.href} style={{ display: "block", padding: "16px 18px", borderRadius: 12, background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.10)", textDecoration: "none" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{o.label}</span>
                <div style={{ fontSize: 13, color: T.dim, marginTop: 4 }}>{o.desc}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 88px", textAlign: "center" }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 14 }}>The structure leak gets fixed in the script.</h2>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, marginBottom: 26 }}>
            Two full scripts free, no card. Bring a video already proven to work and Skripr writes your next script from it, in your voice, with the hook and re-hooks built in.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "14px 34px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link href="/youtube-seo-tools" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Free tools</Link>
            <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Guides</Link>
            <Link href="/youtube-video-ideas" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Research & Ideas</Link>
          </div>
          <div style={{ fontSize: 12, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
