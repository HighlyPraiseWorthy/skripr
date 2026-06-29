import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { comparisons, getComparison } from "../comparisons";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff", green: "#00d4a0",
};

export function generateStaticParams() {
  return comparisons.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = getComparison(slug);
  if (!c) return {};
  const url = `https://skripr.app/compare/${c.slug}`;
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    openGraph: {
      title: c.metaTitle,
      description: c.ogDescription,
      type: "website",
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: c.metaTitle,
      description: c.ogDescription,
    },
    alternates: { canonical: url },
  };
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getComparison(slug);
  if (!c) notFound();

  const url = `https://skripr.app/compare/${c.slug}`;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Skripr",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://skripr.app",
    description:
      "Skripr is a YouTube script generation tool that reverse-engineers a winning video you give it and writes ready-to-record scripts in your voice.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://skripr.app" },
      { "@type": "ListItem", position: 2, name: "Compare", item: "https://skripr.app/compare" },
      { "@type": "ListItem", position: 3, name: c.eyebrow, item: url },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 48px", borderBottom: `1px solid ${T.border}` }}>
          <Link href="/" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>
            SKRIP<span style={{ fontWeight: 200 }}>R</span>
          </Link>
          <Link href="/sign-up" style={{ fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: 8, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free</Link>
        </nav>

        {/* Breadcrumb */}
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px 0" }}>
          <nav style={{ fontSize: 13, color: T.dim }}>
            <Link href="/" style={{ color: T.dim, textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <Link href="/compare" style={{ color: T.dim, textDecoration: "none" }}>Compare</Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <span style={{ color: T.muted }}>{c.eyebrow}</span>
          </nav>
        </div>

        {/* Hero */}
        <section style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px 48px", textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>{c.eyebrow}</div>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1.2px", lineHeight: 1.08, marginBottom: 20 }}>{c.h1}</h1>
          <p style={{ fontSize: 18, color: T.muted, lineHeight: 1.6, maxWidth: 660, margin: "0 auto 28px" }}>{c.subhead}</p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "13px 30px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        {/* Comparison table */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 64px" }}>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
              {["", "Skripr", c.competitorColumn].map((h, i) => (
                <div key={i} style={{ padding: "16px 18px", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textAlign: i === 0 ? "left" : "center", color: i === 1 ? T.accent : T.muted, background: i === 1 ? "rgba(77,184,255,0.08)" : "transparent" }}>{h}</div>
              ))}
            </div>
            {c.rows.map((r, ri) => (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", borderBottom: ri === c.rows.length - 1 ? "none" : `1px solid ${T.border}` }}>
                <div style={{ padding: "15px 18px", fontSize: 14.5, color: T.text, fontWeight: 500 }}>{r[0]}</div>
                <div style={{ padding: "15px 18px", fontSize: 14, textAlign: "center", color: T.green, fontWeight: 600, background: "rgba(77,184,255,0.05)" }}>{r[1]}</div>
                <div style={{ padding: "15px 18px", fontSize: 14, textAlign: "center", color: T.dim }}>{r[2]}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Proof block: real Skripr/NexLev research data */}
        {c.dataBlock && (
          <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 64px" }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", marginBottom: 10, textAlign: "center" }}>{c.dataBlock.heading}</h2>
            <p style={{ fontSize: 15.5, color: T.muted, lineHeight: 1.7, maxWidth: 680, margin: "0 auto 28px", textAlign: "center" }}>{c.dataBlock.intro}</p>
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.6fr 0.6fr 2.1fr 0.6fr", background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
                {c.dataBlock.columns.map((h, i) => (
                  <div key={i} style={{ padding: "13px 14px", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: T.dim, textAlign: i === 1 || i === 4 ? "right" : "left" }}>{h}</div>
                ))}
              </div>
              {c.dataBlock.rows.map((r, ri) => (
                <div key={ri} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.6fr 0.6fr 2.1fr 0.6fr", borderBottom: ri === c.dataBlock!.rows.length - 1 ? "none" : `1px solid ${T.border}`, alignItems: "center" }}>
                  <div style={{ padding: "14px 14px", fontSize: 14, color: T.text, fontWeight: 600 }}>{r[0]}</div>
                  <div style={{ padding: "14px 14px", fontSize: 14, color: T.dim, textAlign: "right" }}>{r[1]}</div>
                  <div style={{ padding: "14px 14px", fontSize: 13, color: T.dim }}>{r[2]}</div>
                  <div style={{ padding: "14px 14px", fontSize: 14, color: T.muted, lineHeight: 1.4 }}>{r[3]}</div>
                  <div style={{ padding: "14px 14px", fontSize: 14, color: T.green, fontWeight: 700, textAlign: "right" }}>{r[4]}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: T.dim, marginTop: 12, textAlign: "center", fontStyle: "italic" }}>{c.dataBlock.caption}</p>
            <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, maxWidth: 680, margin: "24px auto 0", textAlign: "center", fontWeight: 500 }}>{c.dataBlock.kicker}</p>
          </section>
        )}

        {/* Beliefs */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 64px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
            {c.beliefs.map((b) => (
              <div key={b.t} style={{ background: T.bg, padding: "30px 26px" }}>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 12, lineHeight: 1.25 }}>{b.t}</div>
                <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.75 }}>{b.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Fair bridge */}
        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 64px", textAlign: "center" }}>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7 }}>{c.bridge}</p>
        </section>

        {/* FAQ */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 72px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.6px", marginBottom: 28, textAlign: "center" }}>Common questions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
            {c.faqs.map((f) => (
              <div key={f.q} style={{ background: T.bg, padding: "22px 24px" }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.q}</div>
                <div style={{ fontSize: 14.5, color: T.muted, lineHeight: 1.7 }}>{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 88px", textAlign: "center" }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 14 }}>{c.closingH1}</h2>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, marginBottom: 26 }}>
            Two full scripts free, no card. See the difference a purpose-built tool makes.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "14px 34px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        {/* Footer with related comparisons */}
        <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link href="/compare" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>All comparisons</Link>
            {c.related.map((r) => (
              <Link key={r.href} href={r.href} style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>{r.label}</Link>
            ))}
          </div>
          <div style={{ fontSize: 10, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
