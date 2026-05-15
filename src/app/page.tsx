import Link from "next/link";

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff", overflowX: "hidden", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Gradient background effects */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: 0, left: "25%", width: 384, height: 384, background: "rgba(139,92,246,0.2)", borderRadius: "50%", filter: "blur(128px)" }} />
        <div style={{ position: "absolute", top: "33%", right: "25%", width: 384, height: 384, background: "rgba(217,70,239,0.15)", borderRadius: "50%", filter: "blur(128px)" }} />
        <div style={{ position: "absolute", bottom: "25%", left: "50%", width: 384, height: 384, background: "rgba(99,102,241,0.1)", borderRadius: "50%", filter: "blur(128px)" }} />
      </div>

      {/* Nav */}
      <nav style={{ position: "relative", zIndex: 10, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg, #8b5cf6, #d946ef)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>SK</span>
            </div>
            <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Skripr</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/sign-in" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 14 }}>Sign in</Link>
            <Link href="/sign-up" style={{ padding: "8px 16px", borderRadius: 8, background: "linear-gradient(90deg, #7c3aed, #c026d3)", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 500, boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>Get Started Free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: "relative", zIndex: 10, maxWidth: 1280, margin: "0 auto", padding: "80px 24px 128px", textAlign: "center" }}>
        <div style={{ maxWidth: 896, margin: "0 auto" }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 999, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: #a78bfa, fontSize: 14, marginBottom: 32 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
            Now in public beta — Free tier available
          </div>

          <h1 style={{ fontSize: "clamp(48px, 8vw, 96px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: 32 }}>
            <span style={{ background: "linear-gradient(90deg, #fff, #d1d5db)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Reverse-engineer</span>
            <br />
            <span style={{ background: "linear-gradient(90deg, #a78bfa, #e879f9, #f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>any viral video</span>
          </h1>

          <p style={{ fontSize: 20, color: "#9ca3af", marginBottom: 48, maxWidth: 672, margin: "0 auto 48px", lineHeight: 1.7 }}>
            Paste any YouTube URL. Our AI extracts the exact structural patterns that made it go viral — hook type, retention beats, pacing, CTA placement — and generates a new optimized script using that proven formula.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center", marginBottom: 24 }}>
            <Link href="/sign-up" style={{ padding: "16px 32px", borderRadius: 12, background: "linear-gradient(90deg, #7c3aed, #c026d3)", color: "#fff", textDecoration: "none", fontSize: 16, fontWeight: 600, boxShadow: "0 8px 24px rgba(139,92,246,0.3)" }}>
              Start Free — 3 Scripts Included
            </Link>
          </div>
          <p style={{ fontSize: 14, color: "#6b7280" }}>No credit card required • Cancel anytime</p>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, maxWidth: 480, margin: "80px auto 0", paddingTop: 40, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, background: "linear-gradient(90deg, #a78bfa, #e879f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>10K+</div>
              <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Scripts Generated</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, background: "linear-gradient(90deg, #a78bfa, #e879f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>500+</div>
              <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Active Creators</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, background: "linear-gradient(90deg, #a78bfa, #e879f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>98%</div>
              <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Satisfaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ position: "relative", zIndex: 10, borderTop: "1px solid rgba(255,255,255,0.05)", padding: "96px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Everything You Need to <span style={{ background: "linear-gradient(90deg, #a78bfa, #e879f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Grow</span>
            </h2>
            <p style={{ color: "#9ca3af", fontSize: 18, maxWidth: 672, margin: "0 auto" }}>Not just a script writer. A complete growth intelligence platform built for YouTube creators.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
            {[
              { title: "Viral Script Generator", desc: "Paste any YouTube URL and get a complete script using the exact structural patterns that made it go viral", color: "linear-gradient(135deg, #8b5cf6, #7c3aed)" },
              { title: "Niche Bend Engine", desc: "Find crossover opportunities between niches. Break out of your algorithmic bubble with data-driven content ideas", color: "linear-gradient(135deg, #d946ef, #ec4899)" },
              { title: "Compliance Checker", desc: "Pre-publish audit that checks for reused content risk, AI voice detection, and metadata compliance", color: "linear-gradient(135deg, #10b981, #14b8a6)" },
              { title: "A/B Title Generator", desc: "Generate 10 title variations ranked by predicted CTR. Pick the one that maximizes your click-through rate", color: "linear-gradient(135deg, #f59e0b, #f97316)" },
              { title: "Metadata Bundle", desc: "Titles, descriptions, tags, thumbnail text — all optimized for YouTube search and maximum CTR", color: "linear-gradient(135deg, #06b6d4, #3b82f6)" },
              { title: "Content Remixer", desc: "Paste any viral video URL — we break down the hook, structure, and retention triggers so you can adapt them", color: "linear-gradient(135deg, #f43f5e, #ef4444)" },
            ].map((f, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 32, transition: "all 0.3s" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: f.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                  <span style={{ color: "#fff", fontSize: 18 }}>✦</span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "#fff", marginBottom: 8 }}>{f.title}</h3>
                <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section style={{ position: "relative", zIndex: 10, borderTop: "1px solid rgba(255,255,255,0.05)", padding: "96px 24px" }}>
        <div style={{ maxWidth: 896, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Three Steps to Your <span style={{ background: "linear-gradient(90deg, #a78bfa, #e879f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Next Viral Script</span>
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {[
              { step: "01", title: "Paste a Viral Video", desc: "Drop any YouTube URL. We extract the full transcript and analyze its viral structure — hook type, retention beat placement, pacing, and CTA strategy." },
              { step: "02", title: "Describe Your Topic", desc: "Tell us what your video is about. Our AI maps the viral structure from the source onto your topic, generating a script that follows the exact same winning formula." },
              { step: "03", title: "Get Your Script", desc: "Receive a complete, TTS-optimized script with hook options, section breakdown, metadata bundle, and a compliance check to avoid demonetization." },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(217,70,239,0.2))", border: "1px solid rgba(139,92,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 18, fontWeight: 700, background: "linear-gradient(90deg, #a78bfa, #e879f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{item.step}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>{item.title}</h3>
                  <p style={{ color: "#9ca3af", lineHeight: 1.7 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: "relative", zIndex: 10, borderTop: "1px solid rgba(255,255,255,0.05)", padding: "96px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 24 }}>
          Ready to Create <span style={{ background: "linear-gradient(90deg, #a78bfa, #e879f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Viral Content?</span>
        </h2>
        <p style={{ color: "#9ca3af", fontSize: 18, marginBottom: 40 }}>Join thousands of creators using Skripr to reverse-engineer what works and build channels that grow.</p>
        <Link href="/sign-up" style={{ display: "inline-block", padding: "20px 40px", borderRadius: 12, background: "linear-gradient(90deg, #7c3aed, #c026d3)", color: "#fff", textDecoration: "none", fontSize: 18, fontWeight: 600, boxShadow: "0 8px 24px rgba(139,92,246,0.3)" }}>
          Start Free Today
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ position: "relative", zIndex: 10, borderTop: "1px solid rgba(255,255,255,0.05)", padding: "48px 24px", textAlign: "center" }}>
        <p style={{ color: "#6b7280", fontSize: 14 }}>Skripr — Built for YouTube creators.</p>
      </footer>
    </div>
  );
}
