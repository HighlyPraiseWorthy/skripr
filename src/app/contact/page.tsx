import { Metadata } from "next";
import Link from "next/link";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff",
};

export const metadata: Metadata = {
  title: "Contact Skripr",
  description: "Get in touch with the Skripr team. Questions about your account, billing, feedback, or feature requests, we read every email.",
  openGraph: {
    title: "Contact Skripr",
    description: "Get in touch with the Skripr team. We read every email.",
    type: "website",
    url: "https://skripr.app/contact",
  },
  alternates: { canonical: "https://skripr.app/contact" },
};

const reasons = [
  { t: "Account and billing", d: "Trouble signing in, changing your plan, or a question about a charge." },
  { t: "Feedback and feature requests", d: "Something you wish Skripr did, or a rough edge you hit. This shapes what we build next." },
  { t: "Bugs", d: "If something broke, tell us what you were doing and we will dig in fast." },
  { t: "Anything else", d: "Press, partnerships, or just saying hi. We read it all." },
];

export default function ContactPage() {
  return (
    <main style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 48px", borderBottom: `1px solid ${T.border}` }}>
        <Link href="/" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>
          SKRIP<span style={{ fontWeight: 200 }}>R</span>
        </Link>
        <Link href="/sign-up" style={{ fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: 8, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free</Link>
      </nav>

      <section style={{ maxWidth: 680, margin: "0 auto", padding: "72px 24px 40px", textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>Contact</div>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1.2px", lineHeight: 1.08, marginBottom: 18 }}>Get in touch.</h1>
        <p style={{ fontSize: 18, color: T.muted, lineHeight: 1.6, maxWidth: 540, margin: "0 auto 28px" }}>
          Skripr is built by a small team that reads every message. Whether it is a question, a bug, or an idea for what we should build next, we want to hear it.
        </p>
        <a href="mailto:skripr.app@gmail.com" style={{ display: "inline-block", fontSize: 16, fontWeight: 700, padding: "14px 32px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>
          Email skripr.app@gmail.com
        </a>
        <p style={{ fontSize: 13, color: T.dim, marginTop: 16 }}>We usually reply within one business day.</p>
      </section>

      <section style={{ maxWidth: 760, margin: "0 auto", padding: "20px 24px 72px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
          {reasons.map((r) => (
            <div key={r.t} style={{ background: T.bg, padding: "26px 24px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{r.t}</div>
              <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.7 }}>{r.d}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 14, color: T.dim, lineHeight: 1.7, textAlign: "center", marginTop: 28 }}>
          Already a member? Account and billing settings live in your{" "}
          <Link href="/dashboard/settings" style={{ color: T.accent, textDecoration: "underline" }}>dashboard</Link>.
        </p>
      </section>

      <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
        <div style={{ display: "flex", gap: 24 }}>
          <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Guides</Link>
          <Link href="/pricing" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Pricing</Link>
          <Link href="/terms" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Terms</Link>
          <Link href="/privacy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Privacy</Link>
        </div>
        <div style={{ fontSize: 10, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
      </footer>
    </main>
  );
}
