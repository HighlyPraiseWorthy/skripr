import { Metadata } from "next";
import Link from "next/link";

const T = {
  bg: "#080c12", bg2: "#060a0f", border: "#1a2840",
  text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8", accent: "#4db8ff",
};

export const metadata: Metadata = {
  title: "Will AI Replace YouTubers? The One Thing It Can't Do (2026)",
  description:
    "AI now writes, edits, and thumbnails for free, so production is no longer your edge. Here is the one thing AI cannot do on YouTube, and why it decides who wins in 2026.",
  openGraph: {
    title: "Will AI Replace YouTubers? The One Thing It Can't Do (2026)",
    description: "Production is solved. The idea and the script are the last moat. Here is why.",
    type: "article",
    url: "https://skripr.app/will-ai-replace-youtubers",
  },
  twitter: {
    card: "summary_large_image",
    title: "Will AI Replace YouTubers? The One Thing It Can't Do",
    description: "Production is solved. The idea and the script are the last moat.",
  },
  alternates: { canonical: "https://skripr.app/will-ai-replace-youtubers" },
};

const faqs = [
  {
    q: "Will AI replace YouTubers?",
    a: "AI replaces the parts of YouTube you used to compete on, like editing, thumbnails, draft scripts, and analytics, because those are now cheap and fast for everyone. It does not replace the part that actually wins: choosing the right idea and writing a script in a real voice that holds attention. Creators who fix that survive. Creators who only relied on production do not.",
  },
  {
    q: "Can AI write a good YouTube script?",
    a: "A general chatbot writes fluent text, but it does not know what is working on YouTube this week, it sounds generic, and it has no retention structure unless you force it. A purpose-built tool like Skripr starts from proven videos, builds in hooks and retention, and writes in your voice, so the output is ready to record instead of a draft you clean up.",
  },
  {
    q: "What can AI not do for YouTube?",
    a: "AI cannot reliably tell you which video is worth making. Idea selection, the angle, and the hook are still the human edge, and they decide whether a video blows up or dies.",
  },
  {
    q: "How do I stay ahead of AI as a creator?",
    a: "Use AI for everything downstream of the idea to save time, but fix the idea and the script first. Start from what is already working in your niche, write it in your own voice, and make videos people finish.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

const Section = ({ kicker, title, children }: { kicker?: string; title: string; children: React.ReactNode }) => (
  <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 44px" }}>
    {kicker && <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 12 }}>{kicker}</div>}
    <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.6px", lineHeight: 1.15, marginBottom: 14 }}>{title}</h2>
    <div style={{ fontSize: 17, color: T.muted, lineHeight: 1.75 }}>{children}</div>
  </section>
);

export default function WillAIReplaceYouTubers() {
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

        {/* Hero */}
        <section style={{ maxWidth: 780, margin: "0 auto", padding: "72px 24px 48px", textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 16 }}>The state of YouTube in 2026</div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-1.4px", lineHeight: 1.06, marginBottom: 20 }}>
            AI just made 90% of YouTubers replaceable. Here's the 10% that survives.
          </h1>
          <p style={{ fontSize: 18, color: T.muted, lineHeight: 1.6, maxWidth: 640, margin: "0 auto 28px" }}>
            AI now writes, edits, and thumbnails for almost nothing. Production stopped being your edge the moment every other creator got the same upgrade. The creators who win the next two years figured out the one thing AI still cannot do. This is that thing.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, padding: "13px 30px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
        </section>

        <Section kicker="What changed" title="AI already commoditized production">
          Be honest about what just happened. AI can write your script. It can edit your video. It can generate a thumbnail for less than the price of a coffee. It can pull your analytics and tell you what moved. Every part of making a video that used to take skill, time, or money is now cheap and fast.
          <br /><br />
          That sounds amazing until you realize every other creator got the same upgrade at the same time. When production is nearly free, production stops being your advantage. Polished is the new average, and average does not get recommended.
        </Section>

        <Section kicker="The real question" title="So what is actually left?">
          If AI can do all of that, what still decides whether a video explodes or dies with 87 views, three of them from your mom? It is not the editing. It is not the thumbnail. It is the idea, and the script behind it. The angle. The hook. The story that holds someone for ten minutes.
          <br /><br />
          That is the entire game now. Ideas are why channels with 2014 production blow up overnight, and why channels with cinema cameras die in obscurity. They always mattered. In 2026, with everything else flattened, they are all that is left.
        </Section>

        <Section kicker="The trap" title="Why a generic chatbot is the wrong tool for it">
          Here is what kills most creators who reach for AI. A general chatbot is the worst possible tool for the one job that matters. Ask it for video ideas and it hands you the same generic list nine thousand other creators are getting. Ask it for a script and it writes something that sounds like a robot, because it does not know what is working on YouTube this week, and it sounds nothing like you.
          <br /><br />
          You can automate your entire pipeline and still publish videos nobody watches, because automation without a strong idea is just a faster way to make forgettable content.
        </Section>

        <Section kicker="The part AI never solved" title="Start from what already works, in your voice">
          This is the gap Skripr was built to close. Skripr does not start from a blank prompt. It starts from videos already proven to work in your niche, then writes the full script around what is actually pulling views right now: the hook, the retention beats, the open loops, the payoff.
          <br /><br />
          And it writes in your voice, or any creator's voice you point it at, so the script sounds like a real person instead of AI sludge. It even flags demonetization risk before you record. It is not a chatbot you fight. It is the idea and the script, done right, which is the part of the pipeline AI never actually solved.
        </Section>

        <Section kicker="The bottom line" title="The only moat left is the idea">
          You are going to keep making videos either way. The only question is whether you keep guessing at ideas and cleaning up generic drafts, or you start from what is already working and write it in your voice. Production is solved. The idea and the script are the last moat standing.
          <br /><br />
          Fix that first. Everything else is downstream.
        </Section>

        {/* CTA */}
        <section style={{ maxWidth: 700, margin: "0 auto", padding: "8px 24px 80px", textAlign: "center" }}>
          <Link href="/sign-up" style={{ display: "inline-block", fontSize: 16, fontWeight: 700, padding: "15px 36px", borderRadius: 10, background: T.accent, color: T.bg, textDecoration: "none" }}>Start free, 2 scripts</Link>
          <p style={{ fontSize: 13, color: T.dim, marginTop: 14 }}>No card. See the difference a purpose-built script makes.</p>
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

        <footer style={{ padding: "24px 48px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: T.muted, textDecoration: "none" }}>SKRIP<span style={{ fontWeight: 200 }}>R</span></Link>
          <div style={{ display: "flex", gap: 24 }}>
            <Link href="/youtube-strategy/how-to-use-ai-for-youtube" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Using AI on YouTube</Link>
            <Link href="/youtube-strategy" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Guides</Link>
            <Link href="/pricing" style={{ fontSize: 13, color: T.dim, textDecoration: "none" }}>Pricing</Link>
          </div>
          <div style={{ fontSize: 10, color: T.dim }}>© 2026 Skripr. Built for creators.</div>
        </footer>
      </main>
    </>
  );
}
