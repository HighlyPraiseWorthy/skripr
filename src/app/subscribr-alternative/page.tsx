import { Metadata } from "next";
import Link from "next/link";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8",
  accent: "#4db8ff", green: "#00d4a0", red: "#7a93ad",
};

export const metadata: Metadata = {
  title: "Subscribr Alternative: Skripr vs Subscribr (2026)",
  description:
    "Looking for a Subscribr alternative? Skripr starts at $19 a month for 20 whole scripts, and your first 2 are free. See how Skripr compares to Subscribr.",
  openGraph: {
    title: "Subscribr Alternative: Skripr vs Subscribr (2026)",
    description:
      "$19 a month for 20 whole scripts, first 2 free. See how Skripr compares to Subscribr.",
    type: "website",
    url: "https://skripr.app/subscribr-alternative",
  },
  twitter: {
    card: "summary_large_image",
    title: "Subscribr Alternative: Skripr vs Subscribr (2026)",
    description: "$19 a month for 20 whole scripts, first 2 free.",
  },
  alternates: { canonical: "https://skripr.app/subscribr-alternative" },
};

const faqs = [
  {
    q: "Is Skripr a good alternative to Subscribr?",
    a: "Yes, if the script is what you need. Subscribr has grown into an all-in-one studio that also makes thumbnails and finished videos, starting at $99 a month. Skripr focuses on the script: $19 a month for 20 whole scripts, with Niche Bend to carry a proven video into a new niche and a demonetization check before you publish.",
  },
  {
    q: "Does Skripr use credits like Subscribr?",
    a: "No. Skripr gives you whole scripts, not credits. The Starter plan is 20 scripts a month for a flat $19. You never have to do credit math to figure out how many scripts you can actually make.",
  },
  {
    q: "Is there a free plan?",
    a: "Both have one. Skripr's free plan includes 2 full scripts with no card required. Subscribr's free plan covers ideas and niche research, but scripts start on its paid plans. Skripr is billed monthly and you can cancel anytime.",
  },
  {
    q: "Can Skripr write in my voice or another creator's?",
    a: "Yes. Voice Match learns the rhythm, phrasing, and openings of any channel, your own or a creator you admire, then writes every script in that voice.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const rows: [string, string, string][] = [
  ["Starting price", "$19/mo for 20 scripts", "$99/mo (Growth)"],
  ["Scripts on the entry plan", "20 whole scripts", "60 credits, about 12 ten-minute scripts"],
  ["Free plan", "Includes 2 full scripts", "Ideas and research, no scripts"],
  ["Billing", "Monthly, cancel anytime", "Monthly or annual"],
  ["Thumbnails and finished videos", "No, script focused", "Yes"],
  ["Write in any creator's voice", "Yes (Voice Match)", "Yes"],
  ["Cross-niche idea engine", "Yes (Niche Bend)", "Not listed"],
  ["Demonetization check", "Yes (Compliance)", "Not listed"],
  ["Research", "Yes, with cited sources", "Live niche research"],
];

const beliefs = [
  {
    t: "Whole scripts beat credits you have to ration.",
    d: "With credits, a longer script costs more and unused credits do not roll over, so you end up doing math before every video. Skripr counts whole scripts on a flat monthly plan, so you write when you have the idea instead of checking a balance first.",
  },
  {
    t: "Pay for the part you use.",
    d: "If you already edit your own videos and make your own thumbnails, an all-in-one studio means paying for work you do yourself. Skripr is just the script, at $19 a month. Your first 2 scripts are free with no card, so you see the output before you pay anything.",
  },
  {
    t: "Scripts that do not sound the same every time.",
    d: "Generic output is the fastest way to lose a viewer. Skripr blends Voice Match, real cited research, and a retention-built storytelling engine, so every script reads like a real creator wrote it, not a template.",
  },
];

export default function SubscribrAlternative() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
        {/* Nav */}
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 48px", borderBottom: `1px solid ${T.border}` }}>
          <Link href="/" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>
            SKRIP<span style={{ fontWeight: 200 }}>R</span>
          </Link>
          <Link href="/sign-up" style={{ fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: 8, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free</Link>
        </nav>

        {/* Hero */}
        <section style={{ maxWidth: 780, margin: "0 auto", padding: "72px 24px 48px", textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>Skripr vs Subscribr</div>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1.2px", lineHeight: 1.08, marginBottom: 20 }}>
            The Subscribr alternative that starts at $19, not $99.
          </h1>
          <p style={{ fontSize: 18, color: T.muted, lineHeight: 1.6, maxWidth: 620, margin: "0 auto 28px" }}>
            Subscribr has grown into an all-in-one studio: ideas, scripts, thumbnails, even finished videos, starting at $99 a month. If what you need is the script, Skripr does that one job for $19 a month, with whole scripts instead of credits and 2 free to start.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "13px 30px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        {/* Comparison table */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 64px" }}>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
              {["", "Skripr", "Subscribr"].map((h, i) => (
                <div key={i} style={{ padding: "16px 18px", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textAlign: i === 0 ? "left" : "center", color: i === 1 ? T.accent : T.muted, background: i === 1 ? "rgba(77,184,255,0.08)" : "transparent" }}>{h}</div>
              ))}
            </div>
            {rows.map((r, ri) => (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", borderBottom: ri === rows.length - 1 ? "none" : `1px solid ${T.border}` }}>
                <div style={{ padding: "15px 18px", fontSize: 14.5, color: T.text, fontWeight: 500 }}>{r[0]}</div>
                <div style={{ padding: "15px 18px", fontSize: 14, textAlign: "center", color: T.green, fontWeight: 600, background: "rgba(77,184,255,0.05)" }}>{r[1]}</div>
                <div style={{ padding: "15px 18px", fontSize: 14, textAlign: "center", color: T.dim }}>{r[2]}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: T.dim, marginTop: 14, textAlign: "center" }}>
            Based on subscribr.ai's public pricing and features as of October 2026. Script estimate uses Subscribr's own figure of about 5 credits per ten-minute script. Check subscribr.ai for current details.
          </p>
        </section>

        {/* Belief blocks */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 64px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
            {beliefs.map((b) => (
              <div key={b.t} style={{ background: T.bg, padding: "30px 26px" }}>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 12, lineHeight: 1.25 }}>{b.t}</div>
                <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.75 }}>{b.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Honest line */}
        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 64px", textAlign: "center" }}>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7 }}>
            Subscribr is a strong all-in-one tool. If you want ideas, scripts, thumbnails, and finished videos in one place, and the budget for it, it is worth a look. If you want the script done well, for a fifth of the price, with 2 free to try first, that is Skripr.
          </p>
        </section>

        {/* FAQ */}
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 72px" }}>
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

        {/* Final CTA */}
        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 88px", textAlign: "center" }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 14 }}>
            Try it before you commit to anything.
          </h2>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, marginBottom: 26 }}>
            Two full scripts free, no card. See the output for yourself, then decide.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "14px 34px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        {/* Footer */}
        <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <div style={{ display: "flex", gap: 24 }}>
            <Link href="/tubeai-alternative" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>vs TubeAI</Link>
            <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Guides</Link>
            <Link href="/pricing" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Pricing</Link>
          </div>
          <div style={{ fontSize: 10, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
