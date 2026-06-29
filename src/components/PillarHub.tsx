import Link from "next/link";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff", green: "#00d4a0",
};

export interface PillarData {
  slug: string;
  eyebrow: string;
  h1: string;
  intro: string;
  // Substantial original guide content, the link-earning part.
  sections: { heading: string; body: string[] }[];
  dataBlock: {
    heading: string;
    intro: string;
    columns: string[];
    rows: string[][];
    caption: string;
  };
  // Links DOWN to money pages.
  moneyLinks: { href: string; label: string; desc: string }[];
  // Links to supporting /youtube-strategy articles.
  supportingArticles: { href: string; title: string }[];
  faqs: { q: string; a: string }[];
  related: { href: string; label: string }[];
}

export function PillarHub({ data }: { data: PillarData }) {
  const url = `https://skripr.app/${data.slug}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.h1,
    description: data.intro,
    author: { "@type": "Organization", name: "Skripr", url: "https://skripr.app" },
    publisher: { "@type": "Organization", name: "Skripr", url: "https://skripr.app", logo: { "@type": "ImageObject", url: "https://skripr.app/favicon.svg" } },
    mainEntityOfPage: url,
    datePublished: "2026-06-26",
    dateModified: "2026-06-26",
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: data.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://skripr.app" },
      { "@type": "ListItem", position: 2, name: data.eyebrow, item: url },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 48px", borderBottom: `1px solid ${T.border}` }}>
          <Link href="/" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>
            SKRIP<span style={{ fontWeight: 200 }}>R</span>
          </Link>
          <Link href="/sign-up" style={{ fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: 8, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free</Link>
        </nav>

        {/* Breadcrumb */}
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "20px 24px 0" }}>
          <nav style={{ fontSize: 13, color: T.dim }}>
            <Link href="/" style={{ color: T.dim, textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <span style={{ color: T.muted }}>{data.eyebrow}</span>
          </nav>
        </div>

        {/* Hero */}
        <section style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 24px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>{data.eyebrow}</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-1.4px", lineHeight: 1.08, marginBottom: 20 }}>{data.h1}</h1>
          <p style={{ fontSize: 19, color: T.muted, lineHeight: 1.6, marginBottom: 8 }}>{data.intro}</p>
        </section>

        {/* Guide body */}
        <article style={{ maxWidth: 760, margin: "0 auto", padding: "16px 24px 8px" }}>
          {data.sections.map((s) => (
            <div key={s.heading} style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", color: T.text, marginBottom: 14 }}>{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, marginBottom: 16 }}>{p}</p>
              ))}
            </div>
          ))}
        </article>

        {/* Data block */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "16px 24px 56px" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", marginBottom: 10, textAlign: "center" }}>{data.dataBlock.heading}</h2>
          <p style={{ fontSize: 15.5, color: T.muted, lineHeight: 1.7, maxWidth: 680, margin: "0 auto 28px", textAlign: "center" }}>{data.dataBlock.intro}</p>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.6fr 0.6fr 2.1fr 0.6fr", background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
              {data.dataBlock.columns.map((h, i) => (
                <div key={i} style={{ padding: "13px 14px", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: T.dim, textAlign: i === 1 || i === 4 ? "right" : "left" }}>{h}</div>
              ))}
            </div>
            {data.dataBlock.rows.map((row, ri) => (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.6fr 0.6fr 2.1fr 0.6fr", borderBottom: ri === data.dataBlock.rows.length - 1 ? "none" : `1px solid ${T.border}`, alignItems: "center" }}>
                <div style={{ padding: "14px 14px", fontSize: 14, color: T.text, fontWeight: 600 }}>{row[0]}</div>
                <div style={{ padding: "14px 14px", fontSize: 14, color: T.dim, textAlign: "right" }}>{row[1]}</div>
                <div style={{ padding: "14px 14px", fontSize: 13, color: T.dim }}>{row[2]}</div>
                <div style={{ padding: "14px 14px", fontSize: 14, color: T.muted, lineHeight: 1.4 }}>{row[3]}</div>
                <div style={{ padding: "14px 14px", fontSize: 14, color: T.green, fontWeight: 700, textAlign: "right" }}>{row[4]}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: T.dim, marginTop: 12, textAlign: "center", fontStyle: "italic" }}>{data.dataBlock.caption}</p>
        </section>

        {/* Money links: let AI do it */}
        <section style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", marginBottom: 20, textAlign: "center" }}>Skip the manual work</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {data.moneyLinks.map((m) => (
              <Link key={m.href} href={m.href} style={{ display: "block", padding: "22px 24px", borderRadius: 14, background: "rgba(77,184,255,0.05)", border: `1px solid rgba(77,184,255,0.22)`, textDecoration: "none" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.6 }}>{m.desc}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Supporting articles */}
        <section style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 16 }}>Go deeper</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {data.supportingArticles.map((a) => (
              <Link key={a.href} href={a.href} style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(77,184,255,0.03)", border: `1px solid rgba(77,184,255,0.07)`, textDecoration: "none", display: "block" }}>
                <p style={{ fontSize: 14, color: "#d2e2f2", fontWeight: 600, lineHeight: 1.4, margin: 0 }}>{a.title}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 64px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.6px", marginBottom: 28, textAlign: "center" }}>Common questions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
            {data.faqs.map((f) => (
              <div key={f.q} style={{ background: T.bg, padding: "22px 24px" }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.q}</div>
                <div style={{ fontSize: 14.5, color: T.muted, lineHeight: 1.7 }}>{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 88px", textAlign: "center" }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 14 }}>From idea to script in about a minute.</h2>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, marginBottom: 26 }}>
            Two full scripts free, no card. Bring a proven video and Skripr writes the script in your voice.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "14px 34px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        {/* Footer */}
        <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {data.related.map((rel) => (
              <Link key={rel.href} href={rel.href} style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>{rel.label}</Link>
            ))}
            <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>All guides</Link>
            <Link href="/youtube-channel-name-generator" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Name Generator</Link>
            <Link href="/youtube-seo-tools" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>SEO Tools</Link>
          </div>
          <div style={{ fontSize: 12, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
