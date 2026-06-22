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
    "Looking for a Subscribr alternative? Skripr is flat monthly, gives you whole scripts instead of credits, and is free to try. See how Skripr compares to Subscribr.",
  openGraph: {
    title: "Subscribr Alternative: Skripr vs Subscribr (2026)",
    description:
      "Flat monthly, whole scripts instead of credits, free to try. See how Skripr compares to Subscribr.",
    type: "website",
    url: "https://skripr.app/subscribr-alternative",
  },
  twitter: {
    card: "summary_large_image",
    title: "Subscribr Alternative: Skripr vs Subscribr (2026)",
    description: "Flat monthly, whole scripts instead of credits, free to try.",
  },
  alternates: { canonical: "https://skripr.app/subscribr-alternative" },
};

const faqs = [
  {
    q: "Is Skripr a good alternative to Subscribr?",
    a: "Yes, especially if you want flexible monthly billing instead of a yearly commitment, whole scripts instead of a credit balance you have to ration, and a free way to try it before you pay. Skripr also includes Niche Bend, which cross-pollinates a proven video into new niches, and a demonetization check before you publish.",
  },
  {
    q: "Does Skripr use credits like Subscribr?",
    a: "No. Skripr gives you whole scripts, not credits. The Starter plan is 20 scripts a month for a flat $19. You never have to do credit math to figure out how many scripts you can actually make.",
  },
  {
    q: "Do I have to pay for a full year?",
    a: "No. Skripr is billed monthly and you can cancel anytime. There is no annual lock-in, and your first 2 scripts are free with no card required.",
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
  ["Billing", "Monthly, cancel anytime", "Annual only"],
  ["What you get", "Whole scripts (20/mo on Starter)", "Credits you spend per script"],
  ["Free to try", "Yes, 2 scripts, no card", "Paid trial only"],
  ["Starting price", "$19/mo, flat", "Premium, billed yearly"],
  ["Write in any creator's voice", "Yes (Voice Match)", "Yes"],
  ["Cross-niche idea engine", "Yes (Niche Bend)", "No"],
  ["Demonetization check", "Yes (Compliance)", "No"],
  ["Research with citations", "Yes", "Research assistant"],
];

const beliefs = [
  {
    t: "Whole scripts beat credits you have to ration.",
    d: "Credit systems make you stop and do math before every script, and the cheaper tiers run dry fast. Skripr gives you whole scripts on a flat monthly plan, so you write when you have the idea instead of checking a balance first.",
  },
  {
    t: "No yearly handcuffs.",
    d: "A year is a long time to commit to a tool you have not really used yet. Skripr is monthly, cancel anytime, with your first 2 scripts free and no card required. You earn the upgrade by seeing the output for yourself.",
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
            The Subscribr alternative that won't lock you into a year of credits.
          </h1>
          <p style={{ fontSize: 18, color: T.muted, lineHeight: 1.6, maxWidth: 620, margin: "0 auto 28px" }}>
            Subscribr bills annually and meters you with credits that run dry mid-script. Skripr is flat monthly, gives you whole scripts instead of credits, and lets you try it free. Same goal, none of the handcuffs.
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
            Comparison based on publicly available information as of 2026. Check subscribr.ai for their current details.
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
            Subscribr is a solid, broad tool with a big idea library and built-in thumbnails. If you want all of that bundled and you do not mind annual billing, it is worth a look. If you want whole scripts, monthly flexibility, and a free way to try it first, that is Skripr.
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
            Two full scripts free, no card, no yearly plan. See the output for yourself, then decide.
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
