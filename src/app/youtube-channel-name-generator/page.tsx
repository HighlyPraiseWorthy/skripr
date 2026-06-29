import { Metadata } from "next";
import Link from "next/link";
import { NAME_NICHES } from "@/lib/data/channel-name-niches";
import ChannelNameGenerator from "@/components/ChannelNameGenerator";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff", green: "#00d4a0",
};

const url = "https://skripr.app/youtube-channel-name-generator";

export const metadata: Metadata = {
  title: "Free YouTube Channel Name Generator (2026) | Skripr",
  description: "Generate catchy, brandable YouTube channel name ideas in seconds. Free, no signup. Pick your niche, get name ideas, then write your first script in your voice.",
  openGraph: {
    title: "Free YouTube Channel Name Generator (2026)",
    description: "Catchy, brandable YouTube channel name ideas in seconds. Free, no signup.",
    type: "website", url,
  },
  twitter: { card: "summary_large_image", title: "Free YouTube Channel Name Generator (2026)", description: "Catchy, brandable YouTube channel name ideas in seconds. Free, no signup." },
  alternates: { canonical: url },
};

const FAQS = [
  { q: "Is the YouTube channel name generator free?", a: "Yes. It is completely free and needs no signup. Generate as many name ideas as you want, pick one, and you are ready to start." },
  { q: "How do I choose a good YouTube channel name?", a: "Keep it short, easy to say, and easy to spell. Make it broad enough to grow into, hint at your vibe, and check that the name and handle are not already taken." },
  { q: "Can I change my YouTube channel name later?", a: "Yes. YouTube lets you change your channel name and handle, but switching after you build an audience costs you recognition. It is worth getting close on the first try." },
  { q: "Should my channel name match my niche?", a: "A niche hint helps people understand you fast, but a slightly broader name lets you expand later. Aim for a name that fits your niche today and still works if you grow beyond it." },
];

export default function ChannelNameGeneratorHub() {
  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "YouTube Channel Name Generator",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: "Free tool that generates catchy, brandable YouTube channel name ideas by niche.",
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
      { "@type": "ListItem", position: 2, name: "YouTube Channel Name Generator", item: url },
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
            <span style={{ color: T.muted }}>Channel Name Generator</span>
          </nav>
        </div>

        {/* Hero + tool */}
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>Free tool, no signup</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-1.4px", lineHeight: 1.08, marginBottom: 18 }}>YouTube Channel Name Generator</h1>
          <p style={{ fontSize: 19, color: T.muted, lineHeight: 1.6, maxWidth: 580, margin: "0 auto 28px" }}>
            Pick your niche and get catchy, brandable channel name ideas in seconds. Free, no account needed.
          </p>
        </section>
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 48px" }}>
          <ChannelNameGenerator />
        </section>

        {/* How to pick */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "8px 24px 48px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 14 }}>How to pick a YouTube channel name</h2>
          <p style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, marginBottom: 16 }}>
            A good channel name does three things. It is easy to remember, easy to spell into a search bar, and broad enough that you will not outgrow it in a year. Most new creators get stuck here for days, when the real goal is just to get close enough to start.
          </p>
          <p style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, marginBottom: 16 }}>
            Avoid numbers, odd spellings, and anything tied to a single game, country, or trend. Those age fast and limit who clicks. Lean toward a name that hints at your vibe without boxing you in, then check that the name and the handle are both free before you commit.
          </p>
          <p style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, margin: 0 }}>
            And remember, the name is not what makes the channel grow. The videos do. Pick something you like, then put your energy into the first one.
          </p>
        </section>

        {/* Niche spokes */}
        <section style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", marginBottom: 8, textAlign: "center" }}>Name ideas by niche</h2>
          <p style={{ fontSize: 15, color: T.dim, lineHeight: 1.7, maxWidth: 560, margin: "0 auto 24px", textAlign: "center" }}>
            Jump to ideas tuned for your type of channel.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {NAME_NICHES.map((n) => (
              <Link key={n.id} href={`/youtube-channel-name-generator/${n.id}`} style={{ display: "block", padding: "14px 18px", borderRadius: 12, background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.10)", textDecoration: "none" }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: T.muted }}>{n.name} names</span>
              </Link>
            ))}
          </div>
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
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 14 }}>You have the name. Now make the first video.</h2>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, marginBottom: 26 }}>
            Two full scripts free, no card. Bring a proven video and Skripr writes the script in your voice.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "14px 34px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Guides</Link>
            <Link href="/youtube-video-ideas" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Video Ideas</Link>
            <Link href="/pricing" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Pricing</Link>
          </div>
          <div style={{ fontSize: 12, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
