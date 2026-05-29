import Link from "next/link";

const C = {
  bg: "#070711",
  cardBg: "#12122a",
  border: "rgba(99,102,241,0.12)",
  accent: "#818cf8",
  text: "#e2e8f0",
  textDim: "#64748b",
  textBright: "#f1f5f9",
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <nav style={{ borderBottom: `1px solid ${C.border}`, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: 11 }}>SK</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.textBright, letterSpacing: -0.4 }}>Skripr</span>
        </Link>
        <Link href="/" style={{ fontSize: 13, color: C.textDim, textDecoration: "none" }}>← Back</Link>
      </nav>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "60px 24px 100px" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: C.textBright, letterSpacing: -0.5, marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ fontSize: 13, color: C.textDim, marginBottom: 48 }}>Last updated: May 29, 2026</p>

        {[
          {
            title: "1. Information We Collect",
            body: "We collect information you provide directly: your email address and name when you create an account (via Clerk authentication), scripts and content you generate using our Service, and payment information processed securely by Stripe (we never store card details). We also collect usage data such as features used, scripts generated, and session activity.",
          },
          {
            title: "2. How We Use Your Information",
            body: "We use your information to provide and improve the Service, process payments, send transactional emails (account confirmation, billing receipts), and monitor for abuse. We use aggregated, anonymized usage data to improve our AI models and product features. We do not sell your personal information to third parties.",
          },
          {
            title: "3. Data Storage",
            body: "Your account data and scripts are stored in Supabase (PostgreSQL database hosted on AWS). Authentication is handled by Clerk. Payment processing is handled by Stripe. All data is stored in the United States. We implement industry-standard security measures to protect your data.",
          },
          {
            title: "4. AI Processing",
            body: "Script content you submit is sent to Anthropic's Claude API for processing. By using our Service, you consent to this processing. Anthropic's data handling is governed by their own privacy policy. We do not use your content to train our own models.",
          },
          {
            title: "5. Analytics",
            body: "We use PostHog to collect anonymized analytics about how users interact with the Service. This helps us understand which features are used and how to improve the product. PostHog data does not include your script content.",
          },
          {
            title: "6. Cookies",
            body: "We use cookies for authentication (session management via Clerk) and analytics (PostHog). We do not use advertising cookies. You can disable cookies in your browser, but this may affect the functionality of the Service.",
          },
          {
            title: "7. Data Retention",
            body: "We retain your account data and scripts for as long as your account is active. If you delete your account, your personal data and scripts will be deleted within 30 days. Anonymized usage data may be retained indefinitely for product improvement purposes.",
          },
          {
            title: "8. Your Rights",
            body: "You have the right to access, correct, or delete your personal data at any time. You can export your scripts from the dashboard. To request account deletion or a data export, email hello@skripr.com. We will respond within 30 days.",
          },
          {
            title: "9. Third-Party Services",
            body: "Our Service integrates with: Clerk (authentication), Stripe (payments), Supabase (database), Anthropic (AI processing), and PostHog (analytics). Each of these services has its own privacy policy governing their data handling.",
          },
          {
            title: "10. Children",
            body: "The Service is not directed at children under 18. We do not knowingly collect personal information from anyone under 18. If we become aware that we have collected such information, we will delete it promptly.",
          },
          {
            title: "11. Changes to This Policy",
            body: "We may update this Privacy Policy from time to time. We will notify you of significant changes by email or via a notice in the Service. Continued use of the Service after changes constitutes acceptance of the updated policy.",
          },
          {
            title: "12. Contact",
            body: "For privacy-related questions or requests, contact us at hello@skripr.com.",
          },
        ].map((section, i) => (
          <div key={i} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.textBright, marginBottom: 10 }}>{section.title}</h2>
            <p style={{ fontSize: 15, color: C.text, lineHeight: 1.8, margin: 0 }}>{section.body}</p>
          </div>
        ))}
      </div>

      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "24px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>
          <Link href="/terms" style={{ color: C.accent, textDecoration: "none", marginRight: 20 }}>Terms of Service</Link>
          <Link href="/" style={{ color: C.textDim, textDecoration: "none" }}>skripr.com</Link>
        </p>
      </footer>
    </div>
  );
}
