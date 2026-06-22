import { Metadata } from "next";
import Link from "next/link";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8",
  accent: "#4db8ff", green: "#00d4a0",
};

export const metadata: Metadata = {
  title: "TubeAI Alternative: Skripr vs TubeAI (2026)",
  description:
    "Looking for a TubeAI alternative? TubeAI bundles editing, thumbnails, and an agent. Skripr does one thing deeply: the script that gets the click and holds the view. See the comparison.",
  openGraph: {
    title: "TubeAI Alternative: Skripr vs TubeAI (2026)",
    description:
      "TubeAI does a hundred things. Skripr nails the one that decides whether your video gets watched: the script.",
    type: "website",
    url: "https://skripr.app/tubeai-alternative",
  },
  twitter: {
    card: "summary_large_image",
    title: "TubeAI Alternative: Skripr vs TubeAI (2026)",
    description: "TubeAI does a hundred things. Skripr nails the script.",
  },
  alternates: { canonical: "https://skripr.app/tubeai-alternative" },
};

const faqs = [
  {
    q: "Is Skripr a good alternative to TubeAI?",
    a: "Yes, if the script is what makes or breaks your videos. TubeAI is a broad suite with editing, thumbnails, and an agent. Skripr puts all of its attention on the script itself: the hook, retention structure, voice, research, and title. If you want the writing nailed rather than a hundred features, Skripr is built for that.",
  },
  {
    q: "Does Skripr do video editing and thumbnails like TubeAI?",
    a: "No, and that is on purpose. Skripr is focused on the script and everything around it, like metadata, A/B titles, and a demonetization check. If you want one tool for the whole production pipeline, TubeAI does more. If you want the script to be excellent, Skripr goes deeper on that single job.",
  },
  {
    q: "Can I try Skripr free?",
    a: "Yes. Your first 2 scripts are free with no card required, and paid plans are flat monthly with cancel anytime.",
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
  ["Focus", "The script, done deeply", "Everything (editor, thumbnails, agent)"],
  ["What you get", "Whole scripts, flat monthly", "Credit-based across many tools"],
  ["Free to try", "Yes, 2 scripts, no card", "Free tier available"],
  ["Write in any creator's voice", "Yes (Voice Match)", "Yes"],
  ["Cross-niche idea engine", "Yes (Niche Bend)", "Viral ideas finder"],
  ["Research with citations", "Yes", "Yes"],
  ["Demonetization check", "Yes (Compliance)", "Not a focus"],
  ["Best for", "Creators who live by the script", "Creators who want one tool for everything"],
];

const beliefs = [
  {
    t: "A great script beats a hundred features.",
    d: "Editing and thumbnails matter, but the script is what decides whether a viewer clicks and stays. Skripr pours everything into that one job: ranked hooks, retention beats, your voice, and real research. You nail the part that actually moves watch time.",
  },
  {
    t: "Pay for the script, not the bloat.",
    d: "An all-in-one suite charges you for tools you may never open. Skripr is a flat $19 a month for whole scripts, free to try first. You spend on the thing that grows the channel, not a pile of features sitting unused.",
  },
  {
    t: "Sound like a real creator, in any voice.",
    d: "Generic narration gets sensed in a sentence and viewers click off. Point Skripr at any channel, your own or one you admire, and it writes every script in that exact voice, so your audience hears a person, not a tool.",
  },
];

export default function TubeAIAlternative() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 48px", borderBottom: `1px solid ${T.border}` }}>
          <Link href="/" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>
            SKRIP<span style={{ fontWeight: 200 }}>R</span>
          </Link>
          <Link href="/sign-up" style={{ fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: 8, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free</Link>
        </nav>

        <section style={{ maxWidth: 780, margin: "0 auto", padding: "72px 24px 48px", textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>Skripr vs TubeAI</div>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1.2px", lineHeight: 1.08, marginBottom: 20 }}>
            The TubeAI alternative for creators who just want the script to land.
          </h1>
          <p style={{ fontSize: 18, color: T.muted, lineHeight: 1.6, maxWidth: 620, margin: "0 auto 28px" }}>
            TubeAI bundles editing, thumbnails, stock footage, and an agent. If all you really need is a script that gets the click and holds the view, Skripr does that one job, and it does it deeper.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "13px 30px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        <section style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 64px" }}>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
              {["", "Skripr", "TubeAI"].map((h, i) => (
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
            Comparison based on publicly available information as of 2026. Check tubeai.app for their current details.
          </p>
        </section>

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

        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 64px", textAlign: "center" }}>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7 }}>
            TubeAI is genuinely broad. If you want one subscription for editing, thumbnails, and an agent, it does more. If the script is what makes or breaks your videos and you want that nailed, Skripr is built for exactly that.
          </p>
        </section>

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

        <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 88px", textAlign: "center" }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 14 }}>
            Nail the script. Free to start.
          </h2>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, marginBottom: 26 }}>
            Two full scripts free, no card. Spend on the part that actually grows the channel.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "14px 34px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <div style={{ display: "flex", gap: 24 }}>
            <Link href="/subscribr-alternative" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>vs Subscribr</Link>
            <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Guides</Link>
            <Link href="/pricing" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Pricing</Link>
          </div>
          <div style={{ fontSize: 10, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
