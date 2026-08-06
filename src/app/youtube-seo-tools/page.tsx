import { Metadata } from "next";
import Link from "next/link";
import { SEO_TOOLS } from "@/lib/data/seo-tools";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff", green: "#00d4a0",
};

const url = "https://skripr.app/youtube-seo-tools";

export const metadata: Metadata = {
  title: "Free YouTube SEO Tools: Tags, Titles, Hooks | Skripr",
  description: "Free YouTube SEO tools, no signup. Generate tags, click-worthy titles, scroll-stopping hooks, and SEO-friendly descriptions for any video in seconds, then write the script.",
  openGraph: { title: "Free YouTube SEO Tools (2026)", description: "Generate tags, titles, hooks, and descriptions for any video in seconds. Free, no signup.", type: "website", url },
  twitter: { card: "summary_large_image", title: "Free YouTube SEO Tools (2026)", description: "Generate tags, titles, hooks, and descriptions for any video in seconds. Free, no signup." },
  alternates: { canonical: url },
};

const FAQS = [
  { q: "Are these YouTube SEO tools free?", a: "Yes. The tag, title, hook, and description generators are all free and need no signup. Generate what you need and copy it." },
  { q: "Does YouTube SEO still matter in 2026?", a: "Tags and descriptions are minor signals that help YouTube understand your video, which matters most for small channels and search. Your title, thumbnail, and retention still decide far more." },
  { q: "What is the most important part of YouTube SEO?", a: "The title and thumbnail, because they earn the click, and the first 30 seconds, because they keep the viewer. Tags and descriptions support those, they do not replace them." },
];

export default function SeoToolsHub() {
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
      { "@type": "ListItem", position: 2, name: "YouTube SEO Tools", item: url },
    ],
  };

  return (
    <>
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
            <span style={{ color: T.muted }}>YouTube SEO Tools</span>
          </nav>
        </div>

        {/* Hero */}
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>Free tools, no signup</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-1.4px", lineHeight: 1.08, marginBottom: 18 }}>Free YouTube SEO Tools</h1>
          <p style={{ fontSize: 19, color: T.muted, lineHeight: 1.6, maxWidth: 600, margin: "0 auto" }}>
            Generate tags, titles, hooks, and descriptions for any video in seconds. No account needed. Then write the script that earns them.
          </p>
        </section>

        {/* Tool cards */}
        <section style={{ maxWidth: 820, margin: "0 auto", padding: "16px 24px 48px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
            {SEO_TOOLS.map((t) => (
              <Link key={t.id} href={`/${t.slug}`} style={{ display: "block", padding: "24px 24px", borderRadius: 16, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.22)", textDecoration: "none" }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 8, letterSpacing: "-0.3px" }}>{t.name}</div>
                <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.6 }}>{t.intro.split(".")[0]}.</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.accent, marginTop: 14 }}>Open tool →</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Body */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 48px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 14 }}>Where YouTube SEO actually moves the needle</h2>
          <p style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, marginBottom: 16 }}>
            It is easy to overrate metadata. Tags, titles, and descriptions help YouTube understand and surface your video, but they sit on top of the two things that actually decide whether it grows: the title and thumbnail that earn the click, and the first 30 seconds that keep the viewer.
          </p>
          <p style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, margin: 0 }}>
            So use these to clean up your metadata fast, then put your real energy into the script. That is the part most creators skip, and the part that decides the video. If you came here for one thing, the most used tool is the <Link href="/youtube-tag-generator" style={{ color: T.accent, textDecoration: "underline" }}>free YouTube tag generator</Link>. To study a video that already works, grab its text with the <Link href="/youtube-transcript-generator" style={{ color: T.accent, textDecoration: "underline" }}>free YouTube transcript generator</Link>.
          </p>
        </section>

        {/* FAQ */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 64px" }}>
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

        {/* CTA */}
        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 88px", textAlign: "center" }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 14 }}>The metadata is the easy part.</h2>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, marginBottom: 26 }}>
            The script is what gets the views. Two full scripts free, no card. Bring a proven video and Skripr writes the script in your voice.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "14px 34px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link href="/youtube-channel-name-generator" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Name Generator</Link>
            <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Guides</Link>
            <Link href="/pricing" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Pricing</Link>
          </div>
          <div style={{ fontSize: 12, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
