import Link from "next/link";
import { SEO_TOOLS, type SeoTool } from "@/lib/data/seo-tools";
import SeoToolWidget from "@/components/SeoToolWidget";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff", green: "#00d4a0",
};

export default function SeoToolPage({ tool }: { tool: SeoTool }) {
  const url = `https://skripr.app/${tool.slug}`;
  const others = SEO_TOOLS.filter((t) => t.id !== tool.id);

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.h1,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: tool.metaDescription,
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: tool.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://skripr.app" },
      { "@type": "ListItem", position: 2, name: "YouTube SEO Tools", item: "https://skripr.app/youtube-seo-tools" },
      { "@type": "ListItem", position: 3, name: tool.name, item: url },
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
            <Link href="/youtube-seo-tools" style={{ color: T.dim, textDecoration: "none" }}>SEO Tools</Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <span style={{ color: T.muted }}>{tool.name}</span>
          </nav>
        </div>

        {/* Hero + tool */}
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>Free tool, no signup</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-1.4px", lineHeight: 1.08, marginBottom: 18 }}>{tool.h1}</h1>
          <p style={{ fontSize: 19, color: T.muted, lineHeight: 1.6, maxWidth: 580, margin: "0 auto 28px" }}>{tool.intro}</p>
        </section>
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 44px" }}>
          <SeoToolWidget tool={tool.id} inputLabel={tool.inputLabel} placeholder={tool.placeholder} />
        </section>

        {(tool.id === "tags" || tool.id === "title" || tool.id === "description") && (
          <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 40px" }}>
            <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.18)", fontSize: 14.5, color: T.muted, lineHeight: 1.7 }}>
              This works from a topic. Inside Skripr, the same generator runs on your finished script, so it matches the actual video you made. <Link href="/sign-up" style={{ color: T.accent, fontWeight: 700, textDecoration: "none" }}>Start free</Link>.
            </div>
          </section>
        )}

        {/* Body */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "8px 24px 40px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 14 }}>{tool.bodyHeading}</h2>
          {tool.body.map((p, i) => (
            <p key={i} style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, marginBottom: 16 }}>{p}</p>
          ))}
          <div style={{ marginTop: 8, padding: "18px 20px", borderRadius: 12, background: "rgba(0,212,160,0.06)", border: "1px solid rgba(0,212,160,0.22)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.green, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Tip</div>
            <p style={{ fontSize: 15.5, color: T.muted, lineHeight: 1.7, margin: 0 }}>{tool.tip}</p>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.6px", marginBottom: 28, textAlign: "center" }}>Common questions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
            {tool.faqs.map((f) => (
              <div key={f.q} style={{ background: T.bg, padding: "22px 24px" }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.q}</div>
                <div style={{ fontSize: 14.5, color: T.muted, lineHeight: 1.7 }}>{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Other tools */}
        <section style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 16, textAlign: "center" }}>More free YouTube tools</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {others.map((o) => (
              <Link key={o.id} href={`/${o.slug}`} style={{ display: "block", padding: "16px 18px", borderRadius: 12, background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.10)", textDecoration: "none" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{o.name}</span>
                <div style={{ fontSize: 13, color: T.dim, marginTop: 4 }}>{o.intro.split(".")[0]}.</div>
              </Link>
            ))}
            <Link href="/youtube-channel-name-generator" style={{ display: "block", padding: "16px 18px", borderRadius: 12, background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.10)", textDecoration: "none" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Channel Name Generator</span>
              <div style={{ fontSize: 13, color: T.dim, marginTop: 4 }}>Catchy channel name ideas by niche.</div>
            </Link>
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
            <Link href="/youtube-seo-tools" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>All SEO tools</Link>
            <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Guides</Link>
            <Link href="/pricing" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Pricing</Link>
          </div>
          <div style={{ fontSize: 12, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
