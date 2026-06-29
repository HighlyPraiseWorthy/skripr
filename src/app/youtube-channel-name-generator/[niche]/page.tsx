import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NAME_NICHES, getNameNiche } from "@/lib/data/channel-name-niches";
import ChannelNameGenerator from "@/components/ChannelNameGenerator";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff", green: "#00d4a0",
};

export function generateStaticParams() {
  return NAME_NICHES.map((n) => ({ niche: n.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ niche: string }> }): Promise<Metadata> {
  const { niche } = await params;
  const n = getNameNiche(niche);
  if (!n) return {};
  const url = `https://skripr.app/youtube-channel-name-generator/${n.id}`;
  const title = `${n.name} YouTube Channel Name Ideas (2026) | Free Generator`;
  const description = `Free ${n.name.toLowerCase()} YouTube channel name ideas. Generate catchy, brandable names in seconds, no signup, then write your first script.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", url },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: url },
  };
}

export default async function NicheNamePage({ params }: { params: Promise<{ niche: string }> }) {
  const { niche } = await params;
  const n = getNameNiche(niche);
  if (!n) notFound();

  const url = `https://skripr.app/youtube-channel-name-generator/${n.id}`;
  const others = NAME_NICHES.filter((x) => x.id !== n.id).slice(0, 8);

  const faqs = [
    { q: `How do I name a ${n.name.toLowerCase()} YouTube channel?`, a: n.tip },
    { q: "Is this name generator free?", a: "Yes. It is free and needs no signup. Generate as many ideas as you want and pick the one that fits." },
    { q: "Can I change the name later?", a: "Yes, YouTube lets you change your channel name and handle, but it is easier to get close on the first try before you build an audience." },
  ];

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${n.name} YouTube Channel Name Generator`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: `Free tool that generates ${n.name.toLowerCase()} YouTube channel name ideas.`,
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://skripr.app" },
      { "@type": "ListItem", position: 2, name: "Channel Name Generator", item: "https://skripr.app/youtube-channel-name-generator" },
      { "@type": "ListItem", position: 3, name: n.name, item: url },
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
            <Link href="/youtube-channel-name-generator" style={{ color: T.dim, textDecoration: "none" }}>Channel Name Generator</Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <span style={{ color: T.muted }}>{n.name}</span>
          </nav>
        </div>

        {/* Hero + tool */}
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>Free tool, no signup</div>
          <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-1.2px", lineHeight: 1.1, marginBottom: 18 }}>{n.h1}</h1>
          <p style={{ fontSize: 18, color: T.muted, lineHeight: 1.6, maxWidth: 580, margin: "0 auto 28px" }}>{n.blurb}</p>
        </section>
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 44px" }}>
          <ChannelNameGenerator defaultNiche={n.name} />
        </section>

        {/* Examples + tip */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "8px 24px 44px" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", marginBottom: 16 }}>{n.name} channel name examples</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
            {n.examples.map((ex) => (
              <span key={ex} style={{ fontSize: 15, fontWeight: 600, color: T.muted, padding: "9px 15px", borderRadius: 10, background: "rgba(77,184,255,0.05)", border: "1px solid rgba(77,184,255,0.14)" }}>{ex}</span>
            ))}
          </div>
          <div style={{ padding: "18px 20px", borderRadius: 12, background: "rgba(0,212,160,0.06)", border: "1px solid rgba(0,212,160,0.22)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.green, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Naming tip</div>
            <p style={{ fontSize: 15.5, color: T.muted, lineHeight: 1.7, margin: 0 }}>{n.tip}</p>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 56px" }}>
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

        {/* Other niches */}
        <section style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 16, textAlign: "center" }}>Other channel types</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            {others.map((o) => (
              <Link key={o.id} href={`/youtube-channel-name-generator/${o.id}`} style={{ display: "block", padding: "13px 16px", borderRadius: 12, background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.10)", textDecoration: "none" }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: T.muted }}>{o.name} names</span>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 88px", textAlign: "center" }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 14 }}>You have the name. Now make the first video.</h2>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, marginBottom: 26 }}>
            Two full scripts free, no card. Bring a proven video and Skripr writes the script in your voice.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "14px 34px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link href="/youtube-channel-name-generator" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>All niches</Link>
            <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Guides</Link>
            <Link href="/pricing" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Pricing</Link>
          </div>
          <div style={{ fontSize: 12, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
