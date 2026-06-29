import { Metadata } from "next";
import Link from "next/link";
import { articles, clusters } from "./articles";

export const metadata: Metadata = {
  title: "YouTube Strategy Guide (2026) | Skripr",
  description: "Free YouTube growth guides covering niche strategy, viral video analysis, title optimization, retention, and monetization. Built for beginner and intermediate creators.",
  openGraph: {
    title: "YouTube Strategy Guide (2026) | Skripr",
    description: "Free YouTube growth guides covering niche strategy, viral video analysis, title optimization, retention, and monetization.",
    type: "website",
    url: "https://skripr.app/youtube-strategy",
  },
  twitter: {
    card: "summary_large_image",
    title: "YouTube Strategy Guide (2026) | Skripr",
    description: "Free YouTube growth guides covering niche strategy, viral video analysis, title optimization, retention, and monetization.",
  },
  alternates: {
    canonical: "https://skripr.app/youtube-strategy",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "YouTube Strategy Guide",
  description: "Free YouTube growth guides for beginner and intermediate creators.",
  url: "https://skripr.app/youtube-strategy",
  publisher: {
    "@type": "Organization",
    name: "Skripr",
    url: "https://skripr.app",
  },
};

export default function YouTubeStrategyHub() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section style={{
        position: "relative",
        padding: "80px 24px 60px",
        textAlign: "center",
        overflow: "hidden",
      }}>
        {/* Ambient glow */}
        <div style={{
          position: "absolute",
          top: -200,
          left: "50%",
          transform: "translateX(-50%)",
          width: 800,
          height: 600,
          background: "radial-gradient(ellipse, rgba(77,184,255,0.10) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", maxWidth: 720, margin: "0 auto" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 18px",
            borderRadius: 999,
            background: "rgba(77,184,255,0.10)",
            border: "1px solid rgba(77,184,255,0.24)",
            color: "#7ed8ff",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 28,
          }}>
            Free YouTube Growth Guides
          </div>

          <h1 style={{
            fontSize: "clamp(36px,6vw,56px)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.035em",
            color: "#e8edf5",
            marginBottom: 20,
          }}>
            Everything you need to{" "}
            <span style={{
              background: "linear-gradient(90deg,#7ed8ff,#7ed8ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              grow on YouTube
            </span>
          </h1>

          <p style={{
            fontSize: 18,
            color: "#bcd2e8",
            lineHeight: 1.75,
            maxWidth: 560,
            margin: "0 auto 40px",
          }}>
            Actionable guides on niche strategy, viral video analysis, title optimization, retention, and monetization, built for creators who want data-driven growth.
          </p>

          <Link
            href="/sign-up"
            style={{
              display: "inline-block",
              padding: "14px 36px",
              fontSize: 16,
              fontWeight: 700,
              borderRadius: 14,
              background: "linear-gradient(135deg,#4db8ff,#4db8ff)",
              color: "#fff",
              textDecoration: "none",
              boxShadow: "0 8px 32px rgba(77,184,255,0.38)",
            }}
          >
            Start Creating with Skripr →
          </Link>
        </div>
      </section>

      {/* Pillar guides */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 64px" }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#e8edf5", letterSpacing: "-0.02em", marginBottom: 8 }}>
            Start here: the complete guides
          </h2>
          <p style={{ fontSize: 15, color: "#bcd2e8", margin: 0 }}>
            Three deep guides that tie everything together. Each one links out to the detailed articles below.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
          {[
            { href: "/youtube-scriptwriting", title: "YouTube Scriptwriting", desc: "Hooks, retention structure, open loops, and pacing, the script that gets watched." },
            { href: "/faceless-youtube", title: "Faceless YouTube Channels", desc: "How to start, script, and scale a faceless channel, from niche to automation." },
            { href: "/youtube-video-ideas", title: "Finding Winning Video Ideas", desc: "Outliers, reverse-engineering what works, and validating an idea before you film." },
          ].map((p) => (
            <Link
              key={p.href}
              href={p.href}
              style={{
                padding: "26px 26px",
                borderRadius: 16,
                background: "rgba(77,184,255,0.05)",
                border: "1px solid rgba(77,184,255,0.22)",
                textDecoration: "none",
                display: "block",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7ed8ff", marginBottom: 10 }}>
                Complete guide
              </div>
              <div style={{ fontSize: 19, fontWeight: 700, color: "#e8edf5", letterSpacing: "-0.3px", marginBottom: 8 }}>
                {p.title}
              </div>
              <div style={{ fontSize: 14, color: "#bcd2e8", lineHeight: 1.6 }}>
                {p.desc}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Cluster sections */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        {clusters.map((cluster, ci) => (
          <div key={ci} style={{ marginBottom: 64 }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{
                fontSize: 24,
                fontWeight: 800,
                color: "#e8edf5",
                letterSpacing: "-0.02em",
                marginBottom: 8,
              }}>
                {cluster.name}
              </h2>
              <p style={{ fontSize: 15, color: "#bcd2e8", margin: 0 }}>
                {cluster.description}
              </p>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 14,
            }}>
              {cluster.articles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/youtube-strategy/${article.slug}`}
                  style={{
                    padding: "22px 24px",
                    borderRadius: 14,
                    background: "rgba(77,184,255,0.025)",
                    border: "1px solid rgba(77,184,255,0.07)",
                    textDecoration: "none",
                    display: "block",
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                >
                  <p style={{
                    fontSize: 12,
                    color: "#7ed8ff",
                    fontWeight: 600,
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}>
                    {article.cluster}
                  </p>
                  <h3 style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#e8edf5",
                    lineHeight: 1.4,
                    marginBottom: 8,
                  }}>
                    {article.title}
                  </h3>
                  <p style={{
                    fontSize: 13,
                    color: "#bcd2e8",
                    lineHeight: 1.6,
                    margin: 0,
                  }}>
                    {article.metaDescription.slice(0, 120)}...
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Bottom CTA */}
      <section style={{
        borderTop: "1px solid rgba(77,184,255,0.05)",
        padding: "80px 24px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(24px,4vw,36px)",
            fontWeight: 800,
            color: "#e8edf5",
            letterSpacing: "-0.03em",
            marginBottom: 16,
          }}>
            Ready to create scripts that perform?
          </h2>
          <p style={{
            fontSize: 16,
            color: "#bcd2e8",
            lineHeight: 1.7,
            marginBottom: 32,
          }}>
            Skripr generates retention-optimized YouTube scripts with proven hook patterns, open loops, and niche crossover intelligence, in under 30 seconds.
          </p>
          <Link
            href="/sign-up"
            style={{
              display: "inline-block",
              padding: "16px 40px",
              fontSize: 16,
              fontWeight: 700,
              borderRadius: 14,
              background: "linear-gradient(135deg,#4db8ff,#4db8ff)",
              color: "#fff",
              textDecoration: "none",
              boxShadow: "0 8px 32px rgba(77,184,255,0.38)",
            }}
          >
            Try Skripr Free →
          </Link>
          <p style={{ fontSize: 13, color: "#5a6b7d", marginTop: 14 }}>
            Free plan · No credit card · 2 scripts/month
          </p>
        </div>
      </section>
    </>
  );
}
