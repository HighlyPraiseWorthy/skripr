import Link from "next/link";

const C = {
  bg: "#0b0b17",
  cardBg: "#12122a",
  border: "rgba(99,102,241,0.12)",
  accent: "#818cf8",
  text: "#e2e8f0",
  textDim: "#64748b",
  textBright: "#f1f5f9",
  badgeText: "#a5b4fc",
  green: "#34d399",
};
const grad = "linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)";

const glowRingStyle = `
  @keyframes spin-glow {
    0%   { transform: translateX(-50%) rotate(0deg); }
    100% { transform: translateX(-50%) rotate(360deg); }
  }
  @keyframes pulse-glow {
    0%, 100% { opacity: 0.6; }
    50%       { opacity: 1; }
  }
`;

const plans = [
  {
    name: "Starter", price: "$19", period: "/month",
    description: "For creators just getting started with scripting.",
    highlight: false, badge: null,
    cta: "Get Starter",
    features: [
      { text: "30 scripts / month", ok: true },
      { text: "5 Niche Bends / month", ok: true },
      { text: "Script library & history", ok: true },
      { text: "YouTube transcript extraction", ok: true },
      { text: "Compliance checker", ok: false },
      { text: "Priority generation", ok: false },
      { text: "Team seats", ok: false },
    ],
  },
  {
    name: "Pro", price: "$39", period: "/month",
    description: "For serious creators publishing consistently.",
    highlight: true, badge: "Most Popular",
    cta: "Get Pro",
    features: [
      { text: "Unlimited scripts / month", ok: true },
      { text: "Unlimited Niche Bends", ok: true },
      { text: "Script library & history", ok: true },
      { text: "YouTube transcript extraction", ok: true },
      { text: "20 compliance checks / month", ok: true },
      { text: "Priority generation", ok: true },
      { text: "Team seats", ok: false },
    ],
  },
  {
    name: "Agency", price: "$99", period: "/month",
    description: "For teams and agencies running multiple channels.",
    highlight: false, badge: null,
    cta: "Get Agency",
    features: [
      { text: "Unlimited scripts / month", ok: true },
      { text: "Unlimited Niche Bends", ok: true },
      { text: "Script library & history", ok: true },
      { text: "YouTube transcript extraction", ok: true },
      { text: "100 compliance checks / month", ok: true },
      { text: "Priority generation", ok: true },
      { text: "5 team seats", ok: true },
    ],
  },
];

export default function PricingPage() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{glowRingStyle}</style>
      <div aria-hidden style={{ position: "fixed", top: -200, left: "50%", transform: "translateX(-50%)", width: 700, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.10) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <nav style={{ position: "relative", zIndex: 1, padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}` }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff", boxShadow: "0 0 16px rgba(99,102,241,0.35)" }}>S</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.textBright, letterSpacing: -0.5 }}>Skripr</span>
        </Link>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/sign-in" style={{ padding: "8px 18px", borderRadius: 9, border: `1px solid ${C.border}`, color: C.text, textDecoration: "none", fontSize: 14, fontWeight: 500 }}>Sign in</Link>
          <Link href="/sign-up" style={{ padding: "8px 18px", borderRadius: 9, background: grad, color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600, boxShadow: "0 0 18px rgba(99,102,241,0.30)" }}>Start free trial</Link>
        </div>
      </nav>

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "72px 24px 56px" }}>
        <div style={{ display: "inline-block", padding: "3px 14px", borderRadius: 20, background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.22)", color: C.badgeText, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" as const, marginBottom: 22 }}>Pricing</div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, color: C.textBright, letterSpacing: -1.5, lineHeight: 1.1, margin: "0 0 18px" }}>Simple, transparent pricing</h1>
        <p style={{ fontSize: 17, color: C.textDim, maxWidth: 440, margin: "0 auto 10px", lineHeight: 1.65 }}>Generate viral scripts in seconds. No fluff, no hidden fees.</p>
        <p style={{ fontSize: 13, color: C.textDim }}>✦ Start with a 2-script free trial — no credit card required</p>
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1020, margin: "0 auto", padding: "0 24px 90px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 18, alignItems: "start" }}>
        {plans.map((plan) => (
          <div key={plan.name} style={{ background: plan.highlight ? "#161630" : C.cardBg, border: `1px solid ${plan.highlight ? "rgba(129,140,248,0.45)" : C.border}`, borderRadius: 18, padding: "28px 24px", position: "relative", boxShadow: plan.highlight ? "0 0 48px rgba(99,102,241,0.18)" : "none" }}>
            {plan.highlight && (
              <>
                {/* Spinning glow ring */}
                <div aria-hidden style={{
                  position: "absolute", inset: -2, borderRadius: 20,
                  background: "conic-gradient(from 0deg, transparent 0deg, rgba(99,102,241,0.8) 60deg, rgba(168,85,247,0.9) 120deg, transparent 180deg, transparent 360deg)",
                  animation: "spin-glow 3s linear infinite",
                  zIndex: -1,
                  filter: "blur(4px)",
                }} />
                <div aria-hidden style={{
                  position: "absolute", inset: -1, borderRadius: 19,
                  background: "conic-gradient(from 180deg, transparent 0deg, rgba(99,102,241,0.5) 60deg, rgba(168,85,247,0.6) 120deg, transparent 180deg, transparent 360deg)",
                  animation: "spin-glow 3s linear infinite reverse",
                  zIndex: -1,
                  filter: "blur(2px)",
                }} />
              </>
            )}
            {plan.badge && (
              <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: grad, color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, padding: "3px 14px", borderRadius: 20, whiteSpace: "nowrap" as const, boxShadow: "0 0 14px rgba(99,102,241,0.40)" }}>{plan.badge}</div>
            )}
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.textBright, margin: "0 0 6px", letterSpacing: -0.3 }}>{plan.name}</h2>
              <p style={{ fontSize: 13, color: C.textDim, margin: "0 0 18px", lineHeight: 1.5 }}>{plan.description}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ fontSize: 42, fontWeight: 800, color: C.textBright, letterSpacing: -2, lineHeight: 1 }}>{plan.price}</span>
                <span style={{ fontSize: 13, color: C.textDim }}>{plan.period}</span>
              </div>
            </div>
            <Link href="/sign-up" style={{ display: "block", textAlign: "center", padding: "11px", borderRadius: 10, textDecoration: "none", fontSize: 14, fontWeight: 600, marginBottom: 24, background: plan.highlight ? grad : "transparent", border: plan.highlight ? "none" : "1px solid rgba(99,102,241,0.22)", color: plan.highlight ? "#fff" : C.accent, boxShadow: plan.highlight ? "0 0 20px rgba(99,102,241,0.28)" : "none" }}>{plan.cta}</Link>
            <div style={{ height: 1, background: C.border, marginBottom: 20 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {plan.features.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: f.ok ? C.green : C.textDim, flexShrink: 0, width: 16, textAlign: "center" as const }}>{f.ok ? "✓" : "✗"}</span>
                  <span style={{ fontSize: 13, color: f.ok ? C.text : C.textDim, lineHeight: 1.4 }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${C.border}`, padding: "40px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: C.textDim, maxWidth: 500, margin: "0 auto 8px", lineHeight: 1.7 }}>You can change or cancel your plan at any time. All plans include a 2-script free trial on signup — no card required.</p>
        <p style={{ fontSize: 13, color: C.textDim }}>Questions? <a href="mailto:hello@skripr.com" style={{ color: C.accent, textDecoration: "none" }}>hello@skripr.com</a></p>
      </div>

      <div style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${C.border}`, padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontSize: 12, color: C.textDim }}>© 2026 Skripr. All rights reserved.</span>
        <div style={{ display: "flex", gap: 20 }}>
          <Link href="/terms" style={{ fontSize: 12, color: C.textDim, textDecoration: "none" }}>Terms</Link>
          <Link href="/privacy" style={{ fontSize: 12, color: C.textDim, textDecoration: "none" }}>Privacy</Link>
        </div>
      </div>
    </div>
  );
}
