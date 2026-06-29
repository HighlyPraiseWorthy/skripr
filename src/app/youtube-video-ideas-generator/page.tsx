import { Metadata } from "next";
import Link from "next/link";
import VideoIdeasGenerator from "@/components/VideoIdeasGenerator";

const T = {
  bg: "#080c12", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff", green: "#00d4a0",
};

const url = "https://skripr.app/youtube-video-ideas-generator";

export const metadata: Metadata = {
  title: "Free YouTube Video Ideas Generator (2026) | Skripr",
  description:
    "Generate YouTube video ideas for any niche in seconds. Free, no signup. Get click-worthy ideas with the angle behind each one, then turn one into a full script.",
  openGraph: { title: "Free YouTube Video Ideas Generator (2026)", description: "Click-worthy YouTube video ideas for any niche in seconds. Free, no signup.", type: "website", url },
  twitter: { card: "summary_large_image", title: "Free YouTube Video Ideas Generator (2026)", description: "Click-worthy YouTube video ideas for any niche in seconds. Free, no signup." },
  alternates: { canonical: url },
};

const OUTLIERS: [string, string, string, string, string][] = [
  ["how really?", "10.1K", "Dec 2025", "Why $2 Trillion Vanishes Every Year", "829K"],
  ["Cosmic Lens", "97.4K", "Oct 2025", "Why Saturn is the Scariest Planet", "6.1M"],
  ["Millionaire Problems", "17.4K", "Apr 2026", "The Economics of Owning a Casino", "451K"],
  ["Money Simplified", "24.5K", "Mar 2026", "The Psychology of People Who Quietly Escape the Rat Race", "538K"],
];

const FAQS = [
  { q: "Is this YouTube video ideas generator free?", a: "Yes, it is free and needs no signup. Enter your niche and get ideas you can copy. Turning an idea into a full script is where Skripr comes in, and your first 2 scripts are free." },
  { q: "Can it predict if a video will go viral?", a: "No, and be wary of any tool that claims it can. Nobody can score a video that does not exist yet. What works is the opposite: build on topics and structures that already overperformed. That is why we show real outlier videos below, not a made-up virality percentage." },
  { q: "How do I know if an idea is actually worth making?", a: "Check that the topic already has demand. If similar videos in your niche pull real views, the idea is validated. If nothing comparable performs, treat that as a warning, not a green field." },
  { q: "What do I do once I pick an idea?", a: "Click 'Turn this into a script' on any idea. It carries straight into Skripr's topic box, and Skripr writes the full script in your voice, built on structures proven to hold attention." },
];

export default function VideoIdeasGeneratorPage() {
  const softwareJsonLd = {
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "YouTube Video Ideas Generator", applicationCategory: "BusinessApplication", operatingSystem: "Web",
    url, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: metadata.description,
  };
  const faqJsonLd = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://skripr.app" },
      { "@type": "ListItem", position: 2, name: "YouTube Video Ideas", item: "https://skripr.app/youtube-video-ideas" },
      { "@type": "ListItem", position: 3, name: "Video Ideas Generator", item: url },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 48px", borderBottom: `1px solid ${T.border}` }}>
          <Link href="/" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <Link href="/sign-up" style={{ fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: 8, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free</Link>
        </nav>

        <div style={{ maxWidth: 820, margin: "0 auto", padding: "20px 24px 0" }}>
          <nav style={{ fontSize: 13, color: T.dim }}>
            <Link href="/" style={{ color: T.dim, textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <Link href="/youtube-video-ideas" style={{ color: T.dim, textDecoration: "none" }}>Video Ideas</Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <span style={{ color: T.muted }}>Generator</span>
          </nav>
        </div>

        <section style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>Free tool, no signup</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-1.4px", lineHeight: 1.08, marginBottom: 18 }}>YouTube Video Ideas Generator</h1>
          <p style={{ fontSize: 19, color: T.muted, lineHeight: 1.6, maxWidth: 600, margin: "0 auto 28px" }}>
            Enter your niche and get click-worthy video ideas in seconds, each with the angle that makes it work. No account needed. Then turn the one you like into a full script.
          </p>
        </section>
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 40px" }}>
          <VideoIdeasGenerator />
        </section>

        {/* Honest proof of demand, not a fake score */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "8px 24px 40px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 10 }}>No fake virality score. Real demand instead</h2>
          <p style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, marginBottom: 18 }}>
            Some tools slap a virality percentage on an idea that does not exist yet. Nobody can know that. What actually de-risks a video is proof the topic already pulls views. These recently started channels each had a video go far past their subscriber count. That gap, not a made-up score, is the signal worth chasing.
          </p>
          <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "rgba(77,184,255,0.06)" }}>
                  {["Channel", "Subscribers", "Started", "Breakout video", "Views"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "11px 14px", color: T.dim, fontWeight: 700, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {OUTLIERS.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j} style={{ padding: "11px 14px", color: j === 4 ? T.green : T.muted, fontWeight: j === 4 ? 700 : 400, borderBottom: i < OUTLIERS.length - 1 ? `1px solid ${T.border}` : "none" }}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 13, color: T.dim, marginTop: 10 }}>Source: public YouTube data, faceless niches, June 2026. The kind of proven video you bring to Skripr.</p>
        </section>

        {/* Body */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 40px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 14 }}>How to use the ideas you get</h2>
          <p style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, marginBottom: 16 }}>
            Treat each idea as a starting angle, not a finished plan. The title and the one-line reason show you why a viewer would click and stay. Pick the ones that fit your channel and that you can actually deliver on, then sanity-check demand against real videos in your niche.
          </p>
          <p style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, margin: 0 }}>
            The idea is the front half of the video. The script is the rest. When you find one worth making, click Turn this into a script and it carries straight into Skripr, which writes the full script on proven structures, in your voice.
          </p>
          <div style={{ marginTop: 18, padding: "18px 20px", borderRadius: 12, background: "rgba(0,212,160,0.06)", border: "1px solid rgba(0,212,160,0.22)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.green, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Tip</div>
            <p style={{ fontSize: 15.5, color: T.muted, lineHeight: 1.7, margin: 0 }}>Generate a batch, then keep only the ideas a stranger would click even if they had never heard of you. One strong idea beats ten safe ones.</p>
          </div>
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
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 16, textAlign: "center" }}>More free YouTube tools</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {[
              ["/youtube-video-ideas", "How to Find Video Ideas", "The full method, with real outlier examples."],
              ["/youtube-seo-tools", "YouTube SEO Tools", "Tags, titles, hooks, descriptions. Free."],
              ["/youtube-channel-name-generator", "Channel Name Generator", "Catchy channel name ideas by niche."],
            ].map(([href, name, desc]) => (
              <Link key={href} href={href} style={{ display: "block", padding: "16px 18px", borderRadius: 12, background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.10)", textDecoration: "none" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{name}</span>
                <div style={{ fontSize: 13, color: T.dim, marginTop: 4 }}>{desc}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 88px", textAlign: "center" }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 14 }}>The idea is the easy part.</h2>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, marginBottom: 26 }}>
            The script is what earns the views. Pick an idea, and Skripr writes it in your voice on structures proven to hold attention. Two full scripts free, no card.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "14px 34px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link href="/youtube-video-ideas" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Video Ideas</Link>
            <Link href="/youtube-seo-tools" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>SEO Tools</Link>
            <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Guides</Link>
          </div>
          <div style={{ fontSize: 12, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
