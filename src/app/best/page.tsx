import { Metadata } from "next";
import Link from "next/link";
import { roundups } from "./roundups";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff", green: "#00d4a0",
};

export const metadata: Metadata = {
  title: "Best AI Tools for YouTube Creators (2026) | Skripr",
  description:
    "Honest guides to the best AI tools for YouTube: script writers, faceless channels, automation, beginners, and ChatGPT alternatives. What each one is actually best at.",
  openGraph: {
    title: "Best AI Tools for YouTube Creators (2026)",
    description: "Honest guides to the best AI tools for YouTube scripts, faceless channels, automation, and more.",
    type: "website",
    url: "https://skripr.app/best",
  },
  twitter: {
    card: "summary_large_image",
    title: "Best AI Tools for YouTube Creators (2026)",
    description: "Honest guides to the best AI tools for YouTube creators.",
  },
  alternates: { canonical: "https://skripr.app/best" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Best AI Tools for YouTube Creators",
  description: "Honest guides to the best AI tools for YouTube creators.",
  url: "https://skripr.app/best",
  publisher: { "@type": "Organization", name: "Skripr", url: "https://skripr.app" },
};

export default function BestHub() {
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

        <section style={{ maxWidth: 820, margin: "0 auto", padding: "72px 24px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>Best Tools</div>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1.2px", lineHeight: 1.08, marginBottom: 20 }}>
            The best AI tools for YouTube, picked honestly.
          </h1>
          <p style={{ fontSize: 18, color: T.muted, lineHeight: 1.6, maxWidth: 640, margin: "0 auto" }}>
            Each guide names the best tool for the job, maps the rest of the stack, and says plainly where Skripr is not the answer. Backed by real channel data.
          </p>
        </section>

        <section style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 88px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {roundups.map((r) => (
              <Link key={r.slug} href={`/best/${r.slug}`} style={{ display: "block", padding: "24px 26px", borderRadius: 14, background: T.bg2, border: `1px solid ${T.border}`, textDecoration: "none" }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.accent, marginBottom: 10 }}>{r.category}</div>
                <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.4px", color: T.text, marginBottom: 6 }}>{r.metaTitle.replace(" (2026)", "")}</div>
                <div style={{ fontSize: 13, color: T.dim }}>Read the guide →</div>
              </Link>
            ))}
          </div>
        </section>

        <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <div style={{ display: "flex", gap: 24 }}>
            <Link href="/compare" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Comparisons</Link>
            <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Guides</Link>
          </div>
          <div style={{ fontSize: 10, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
