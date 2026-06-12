import { PricingPlans } from "@/components/PricingPlans";
import { AccountEditButton } from "@/components/AccountEditButton";
import { BillingPortalButton } from "@/components/BillingPortalButton";
import { VoiceMatchCard } from "@/components/VoiceMatchCard";
import { checkScriptLimit } from "@/lib/usage";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const C = {
  cardBg: "#0d1520",
  border: "rgba(77,184,255,0.11)",
  accent: "#4db8ff",
  textBright: "#e8edf5",
  text: "#e8edf5",
  textDim: "#7a9bb5",
  badgeBg: "rgba(77,184,255,0.11)",
  badgeText: "#7ed8ff",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const isAdmin = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean).includes(userId);
  const { plan: currentPlan } = await checkScriptLimit(userId!);

  return (
    <div style={{ padding: 28, minHeight: "100vh", background: "#080c12" }}>
      <div aria-hidden style={{ position: "fixed", top: -160, right: -100, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle,rgba(77,184,255,0.12) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden style={{ position: "fixed", bottom: -180, left: -120, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle,rgba(77,184,255,0.06) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#e8edf5", letterSpacing: -0.4, margin: 0 }}>Settings</h1>
            {isAdmin && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#34d399", background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.30)", padding: "3px 8px", borderRadius: 6, letterSpacing: 0.5 }}>⚡ ADMIN</span>
            )}
          </div>
          <p style={{ color: "#7a9bb5", fontSize: 16, lineHeight: 1.6 }}>Manage your account and subscription{isAdmin ? " · Unlimited access active" : ""}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Subscription */}
          <section style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 6 }}>SUBSCRIPTION</p>
            <p style={{ color: C.textDim, fontSize: 15, marginBottom: 20 }}>Choose the plan that fits your workflow</p>
            <PricingPlans priceIds={{
              starter: process.env.STRIPE_PRICE_STARTER || "",
              pro: process.env.STRIPE_PRICE_PRO || "",
              agency: process.env.STRIPE_PRICE_AGENCY || "",
            }} currentPlan={currentPlan} />
          </section>

          {/* Voice Match */}
          <section style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 8 }}>VOICE MATCH</p>
            <p style={{ color: C.textDim, fontSize: 15, marginBottom: 16 }}>Teach Skripr to write in your voice</p>
            <VoiceMatchCard />
          </section>

          {/* Billing */}
          <section style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 8 }}>BILLING</p>
            <p style={{ color: C.textDim, fontSize: 15, marginBottom: 16 }}>Manage your payment method and billing history</p>
            <BillingPortalButton />
          </section>

          {/* Account */}
          <section style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 8 }}>ACCOUNT</p>
            <p style={{ color: C.textDim, fontSize: 15, marginBottom: 20 }}>Your profile and connected accounts</p>

            {/* Profile row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.10)", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(77,184,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>👤</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.textBright }}>Profile</div>
                  <div style={{ fontSize: 14, color: C.textDim }}>Name, avatar, and display settings</div>
                </div>
              </div>
              <AccountEditButton />
            </div>

            {/* Email row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.10)", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(77,184,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>✉️</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.textBright }}>Email & Security</div>
                  <div style={{ fontSize: 14, color: C.textDim }}>Email addresses, password, and 2FA</div>
                </div>
              </div>
              <AccountEditButton />
            </div>

            {/* Connected accounts row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.10)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(77,184,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🔗</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.textBright }}>Connected Accounts</div>
                  <div style={{ fontSize: 14, color: C.textDim }}>Google and other linked services</div>
                </div>
              </div>
              <AccountEditButton />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
