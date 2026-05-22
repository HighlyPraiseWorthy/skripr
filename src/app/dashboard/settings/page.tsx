import { PricingPlans } from "@/components/PricingPlans";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserProfile } from "@clerk/nextjs";

const C = {
  cardBg: "#12122a",
  border: "rgba(99,102,241,0.12)",
  accent: "#818cf8",
  textBright: "#f1f5f9",
  text: "#e2e8f0",
  textDim: "#64748b",
  badgeBg: "rgba(99,102,241,0.12)",
  badgeText: "#a5b4fc",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div style={{ padding: 28, minHeight: "100vh", background: "#0b0b17" }}>
      <div aria-hidden style={{ position: "fixed", top: -160, right: -100, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.14) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden style={{ position: "fixed", bottom: -180, left: -120, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.09) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#f1f5f9", letterSpacing: -0.4, marginBottom: 6 }}>Settings</h1>
          <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6 }}>Manage your account and subscription</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Subscription */}
          <section style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 6 }}>SUBSCRIPTION</p>
            <p style={{ color: C.textDim, fontSize: 13, marginBottom: 20 }}>Choose the plan that fits your workflow</p>
            <PricingPlans priceIds={{
              starter: process.env.STRIPE_PRICE_STARTER || "",
              pro: process.env.STRIPE_PRICE_PRO || "",
              agency: process.env.STRIPE_PRICE_AGENCY || "",
            }} />
          </section>

          {/* Billing */}
          <section style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 8 }}>BILLING</p>
            <p style={{ color: C.textDim, fontSize: 13, marginBottom: 16 }}>Manage your payment method and billing history</p>
            <form action="/api/stripe/portal" method="POST">
              <button
                type="submit"
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  background: "rgba(99,102,241,0.10)",
                  color: C.accent,
                  fontSize: 13,
                  fontWeight: 500,
                  border: "1px solid rgba(99,102,241,0.18)",
                  cursor: "pointer",
                }}
              >
                Open Billing Portal
              </button>
            </form>
          </section>

          {/* Account (Clerk UserProfile) */}
          <section style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 26px" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.accent, letterSpacing: 0.4, marginBottom: 8 }}>ACCOUNT</p>
            <p style={{ color: C.textDim, fontSize: 13, marginBottom: 16 }}>Manage your account settings</p>
            {/* Clerk's UserProfile already handles its own theme via appearance prop */}
            <UserProfile
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "bg-transparent shadow-none p-0 border-0",
                  navbar: "hidden",
                  pageScrollBox: "p-0",
                  formButtonPrimary:
                    "bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg",
                  formButtonSecondary:
                    "bg-white/5 border border-white/10 text-white text-sm font-medium px-4 py-2 rounded-lg",
                  formFieldInput:
                    "w-full mt-1 px-3 py-2 bg-[#1a1a3a] border border-[rgba(99,102,241,0.12)] rounded-lg text-white text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none",
                  formFieldLabel: "text-sm font-medium text-gray-300",
                  formFieldWarning: "text-amber-400 text-xs mt-1",
                  formFieldError: "text-red-400 text-xs mt-1",
                  alertText: "text-gray-300 text-sm",
                  body: "text-gray-400 text-sm",
                  heading: "text-white text-lg font-semibold",
                  dividerLine: "bg-white/10",
                  identityPreviewText: "text-white text-sm",
                },
              }}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
