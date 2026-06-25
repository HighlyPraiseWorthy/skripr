import { Metadata } from "next";
import Link from "next/link";
import { comparisons } from "./comparisons";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff", green: "#00d4a0",
};

export const metadata: Metadata = {
  title: "Skripr vs Other YouTube Tools (2026) | Honest Comparisons",
  description:
    "Honest, side-by-side comparisons of Skripr against VidIQ, TubeBuddy, ChatGPT, Jasper, and other YouTube and AI tools. See where each one wins and where Skripr fits.",
  openGraph: {
    title: "Skripr vs Other YouTube Tools (2026)",
    description:
      "Honest comparisons of Skripr against VidIQ, TubeBuddy, ChatGPT, Jasper, and more. See where each tool wins.",
    type: "website",
    url: "https://skripr.app/compare",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skripr vs Other YouTube Tools (2026)",
    description: "Honest comparisons of Skripr against the tools creators actually use.",
  },
  alternates: { canonical: "https://skripr.app/compare" },
};

// Standalone comparison pages that live outside /compare but belong in the hub.
const externalComparisons = [
  { href: "/skripr-vs-claude", title: "Skripr vs Claude", category: "General AI assistant" },
  { href: "/subscribr-alternative", title: "Skripr vs Subscribr", category: "YouTube script tool" },
  { href: "/tubeai-alternative", title: "Skripr vs TubeAI", category: "YouTube AI tool" },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Skripr Comparisons",
  description: "Honest comparisons of Skripr against other YouTube and AI content tools.",
  url: "https://skripr.app/compare",
  publisher: { "@type": "Organization", name: "Skripr", url: "https://skripr.app" },
};

export default function CompareHub() {
  const cards = [
    ...comparisons.map((c) => ({ href: `/compare/${c.slug}`, title: c.eyebrow, category: c.category })),
    ...externalComparisons,
  ];

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
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>Comparisons</div>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1.2px", lineHeight: 1.08, marginBottom: 20 }}>
            How Skripr compares to the tools creators already use.
          </h1>
          <p style={{ fontSize: 18, color: T.muted, lineHeight: 1.6, maxWidth: 640, margin: "0 auto" }}>
            No spin. Each comparison says plainly where the other tool wins and where Skripr fits. Most of them research or optimize. Skripr finds the proven idea and writes the script.
          </p>
        </section>

        <section style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 88px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {cards.map((card) => (
              <Link key={card.href} href={card.href} style={{ display: "block", padding: "24px 26px", borderRadius: 14, background: T.bg2, border: `1px solid ${T.border}`, textDecoration: "none" }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.accent, marginBottom: 10 }}>{card.category}</div>
                <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.4px", color: T.text, marginBottom: 6 }}>{card.title}</div>
                <div style={{ fontSize: 13, color: T.dim }}>Read the comparison →</div>
              </Link>
            ))}
          </div>
        </section>

        <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <div style={{ display: "flex", gap: 24 }}>
            <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Guides</Link>
            <Link href="/pricing" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Pricing</Link>
          </div>
          <div style={{ fontSize: 10, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
