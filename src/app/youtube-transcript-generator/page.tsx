import { Metadata } from "next";
import Link from "next/link";
import TranscriptTool from "@/components/TranscriptTool";

const T = {
  bg: "#080c12", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff", green: "#00d4a0",
};

const url = "https://skripr.app/youtube-transcript-generator";

export const metadata: Metadata = {
  title: "Free YouTube Transcript Generator (2026) | Skripr",
  description:
    "Get the full transcript of any YouTube video in seconds. Free, no signup. Paste a link, copy the text, then turn what worked into your own script.",
  openGraph: { title: "Free YouTube Transcript Generator (2026)", description: "Full transcript of any YouTube video in seconds. Free, no signup.", type: "website", url },
  twitter: { card: "summary_large_image", title: "Free YouTube Transcript Generator (2026)", description: "Full transcript of any YouTube video in seconds. Free, no signup." },
  alternates: { canonical: url },
};

const FAQS = [
  { q: "Is this YouTube transcript generator free?", a: "Yes, it is free and needs no signup. Paste a video link, get the full text, copy it." },
  { q: "How do I get the transcript of a YouTube video?", a: "Paste the video URL above and press Get transcript. It pulls the captions and returns the full text, with a word count and rough reading time." },
  { q: "Why does it say no captions found?", a: "Some creators turn captions off, and a few very new uploads have not been processed by YouTube yet. If captions are disabled on the video, no tool can pull the text." },
  { q: "Can I get a transcript of any video?", a: "Any public YouTube video with captions, including Shorts. Private and unlisted videos are not accessible." },
  { q: "What should I do with the transcript?", a: "The useful part is studying what made a video work: how it opens, where it raises stakes, how it keeps you watching. If you want that turned into a script on your own topic, that is what Skripr does. Your first 2 scripts are free." },
];

export default function TranscriptGeneratorPage() {
  const softwareJsonLd = {
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "YouTube Transcript Generator", applicationCategory: "BusinessApplication", operatingSystem: "Web",
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
      { "@type": "ListItem", position: 2, name: "YouTube SEO Tools", item: "https://skripr.app/youtube-seo-tools" },
      { "@type": "ListItem", position: 3, name: "Transcript Generator", item: url },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px clamp(20px, 5vw, 48px)", borderBottom: `1px solid ${T.border}` }}>
          <Link href="/" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <Link href="/sign-up" style={{ fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: 8, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free</Link>
        </nav>

        <div style={{ maxWidth: 820, margin: "0 auto", padding: "20px 24px 0" }}>
          <nav style={{ fontSize: 13, color: T.dim }}>
            <Link href="/" style={{ color: T.dim, textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <Link href="/youtube-seo-tools" style={{ color: T.dim, textDecoration: "none" }}>SEO Tools</Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <span style={{ color: T.muted }}>Transcript Generator</span>
          </nav>
        </div>

        <section style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>Free tool, no signup</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-1.4px", lineHeight: 1.08, marginBottom: 18 }}>YouTube Transcript Generator</h1>
          <p style={{ fontSize: 19, color: T.muted, lineHeight: 1.6, maxWidth: 600, margin: "0 auto 28px" }}>
            Paste any YouTube link and get the full transcript in seconds. Free, no account needed. Works with Shorts too.
          </p>
        </section>
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 40px" }}>
          <TranscriptTool />
        </section>

        <section style={{ maxWidth: 760, margin: "0 auto", padding: "8px 24px 40px" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 14 }}>The transcript is where the lesson is</h2>
          <p style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, marginBottom: 16 }}>
            Most people grab a transcript to quote something or skim a long video. Creators use it for something better. When a video in your niche pulls far more views than the channel should get, the transcript shows you exactly how it did that: the first line that stopped the scroll, the question it left open, where it raised the stakes, how it paid the promise off.
          </p>
          <p style={{ fontSize: 16.5, color: T.muted, lineHeight: 1.8, margin: 0 }}>
            Read three winners in your niche and the pattern stops being a mystery. That is the difference between guessing what to make next and building on something that already worked.
          </p>
          <div style={{ marginTop: 18, padding: "18px 20px", borderRadius: 12, background: "rgba(0,212,160,0.06)", border: "1px solid rgba(0,212,160,0.22)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.green, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Tip</div>
            <p style={{ fontSize: 15.5, color: T.muted, lineHeight: 1.7, margin: 0 }}>Read the first 30 seconds on its own. That is the part doing the heavy lifting, and it is the easiest thing to learn from.</p>
          </div>
        </section>

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

        <section style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 16, textAlign: "center" }}>More free YouTube tools</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {[
              ["/youtube-video-ideas-generator", "YouTube Video Ideas Generator", "Click-worthy ideas for your niche."],
              ["/youtube-seo-tools", "YouTube SEO Tools", "Tags, titles, hooks, descriptions."],
              ["/youtube-channel-name-generator", "YouTube Channel Name Generator", "Name ideas by niche."],
            ].map(([href, name, desc]) => (
              <Link key={href} href={href} style={{ display: "block", padding: "16px 18px", borderRadius: 12, background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.10)", textDecoration: "none" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{name}</span>
                <div style={{ fontSize: 13, color: T.dim, marginTop: 4 }}>{desc}</div>
              </Link>
            ))}
          </div>
        </section>

        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 88px", textAlign: "center" }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 14 }}>Reading what worked is step one.</h2>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, marginBottom: 26 }}>
            Step two is writing yours. Bring a video that already performed and Skripr reverse-engineers why it worked, then writes your script in your voice. Two full scripts free, no card.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "14px 34px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        <footer style={{ padding: "24px clamp(20px, 5vw, 48px)", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
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
