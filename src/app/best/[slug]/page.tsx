import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { roundups, getRoundup } from "../roundups";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff", green: "#00d4a0",
};

export function generateStaticParams() {
  return roundups.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = getRoundup(slug);
  if (!r) return {};
  const url = `https://skripr.app/best/${r.slug}`;
  return {
    title: r.metaTitle,
    description: r.metaDescription,
    openGraph: { title: r.metaTitle, description: r.ogDescription, type: "article", url },
    twitter: { card: "summary_large_image", title: r.metaTitle, description: r.ogDescription },
    alternates: { canonical: url },
  };
}

export default async function RoundupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = getRoundup(slug);
  if (!r) notFound();

  const url = `https://skripr.app/best/${r.slug}`;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: r.metaTitle,
    itemListElement: r.itemList.map((name, i) => ({ "@type": "ListItem", position: i + 1, name })),
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: r.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Skripr",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://skripr.app",
    description: "Skripr is a YouTube script generation tool that reverse-engineers a winning video you give it and writes ready-to-record scripts in your voice.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://skripr.app" },
      { "@type": "ListItem", position: 2, name: "Best Tools", item: "https://skripr.app/best" },
      { "@type": "ListItem", position: 3, name: r.eyebrow, item: url },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
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
            <Link href="/best" style={{ color: T.dim, textDecoration: "none" }}>Best Tools</Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <span style={{ color: T.muted }}>{r.eyebrow}</span>
          </nav>
        </div>

        {/* Hero */}
        <section style={{ maxWidth: 820, margin: "0 auto", padding: "44px 24px 40px", textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>{r.eyebrow}</div>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1.2px", lineHeight: 1.08, marginBottom: 20 }}>{r.h1}</h1>
          <p style={{ fontSize: 18, color: T.muted, lineHeight: 1.6, maxWidth: 660, margin: "0 auto 28px" }}>{r.subhead}</p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "13px 30px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        {/* Core pick */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "16px 24px 48px" }}>
          <div style={{ border: `1px solid rgba(77,184,255,0.30)`, borderRadius: 16, padding: "32px 30px", background: "rgba(77,184,255,0.05)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>Best overall</span>
              <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>{r.corePick.name}</span>
            </div>
            <div style={{ fontSize: 14, color: T.green, fontWeight: 600, marginBottom: 14 }}>{r.corePick.bestFor}</div>
            <p style={{ fontSize: 15.5, color: T.muted, lineHeight: 1.75, margin: 0 }}>{r.corePick.body}</p>
            <Link href="/sign-up" style={{ display: "inline-block", marginTop: 20, fontSize: 14, fontWeight: 700, padding: "11px 24px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Try Skripr free</Link>
          </div>
        </section>

        {/* Proof data */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", marginBottom: 10, textAlign: "center" }}>{r.dataBlock.heading}</h2>
          <p style={{ fontSize: 15.5, color: T.muted, lineHeight: 1.7, maxWidth: 680, margin: "0 auto 28px", textAlign: "center" }}>{r.dataBlock.intro}</p>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.6fr 0.6fr 2.1fr 0.6fr", background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
              {r.dataBlock.columns.map((h, i) => (
                <div key={i} style={{ padding: "13px 14px", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: T.dim, textAlign: i === 1 || i === 4 ? "right" : "left" }}>{h}</div>
              ))}
            </div>
            {r.dataBlock.rows.map((row, ri) => (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.6fr 0.6fr 2.1fr 0.6fr", borderBottom: ri === r.dataBlock.rows.length - 1 ? "none" : `1px solid ${T.border}`, alignItems: "center" }}>
                <div style={{ padding: "14px 14px", fontSize: 14, color: T.text, fontWeight: 600 }}>{row[0]}</div>
                <div style={{ padding: "14px 14px", fontSize: 14, color: T.dim, textAlign: "right" }}>{row[1]}</div>
                <div style={{ padding: "14px 14px", fontSize: 13, color: T.dim }}>{row[2]}</div>
                <div style={{ padding: "14px 14px", fontSize: 14, color: T.muted, lineHeight: 1.4 }}>{row[3]}</div>
                <div style={{ padding: "14px 14px", fontSize: 14, color: T.green, fontWeight: 700, textAlign: "right" }}>{row[4]}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: T.dim, marginTop: 12, textAlign: "center", fontStyle: "italic" }}>{r.dataBlock.caption}</p>
        </section>

        {/* The stack */}
        <section style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.6px", marginBottom: 8, textAlign: "center" }}>The honest breakdown</h2>
          <p style={{ fontSize: 15, color: T.dim, lineHeight: 1.7, maxWidth: 600, margin: "0 auto 28px", textAlign: "center" }}>
            No single tool does everything well. Here is what we would actually use, including where Skripr is not the answer.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
            {r.stack.map((s) => (
              <div key={s.stage} style={{ background: T.bg, padding: "22px 26px", display: "grid", gridTemplateColumns: "190px 1fr", gap: 20 }}>
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
            {r.faqs.map((f) => (
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
            <Link href="/best" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>All guides</Link>
            {r.related.map((rel) => (
              <Link key={rel.href} href={rel.href} style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>{rel.label}</Link>
            ))}
          </div>
          <div style={{ fontSize: 10, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
