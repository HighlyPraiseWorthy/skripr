"use client";

import { useState } from "react";

const C = {
  bg: "#12122a",
  border: "rgba(99,102,241,0.12)",
  borderHover: "rgba(99,102,241,0.35)",
  accent: "#818cf8",
  textBright: "#f1f5f9",
  textDim: "#64748b",
};

const PLANS = [
  {
    name: "Starter",
    price: "$19",
    priceEnv: "NEXT_PUBLIC_STRIPE_PRICE_STARTER",
    features: ["20 scripts / month", "Niche Bend Engine", "Viral Remixer", "Viral Magnet Titles", "Metadata & A/B Testing"],
    highlight: false,
  },
  {
    name: "Pro",
    price: "$39",
    priceEnv: "NEXT_PUBLIC_STRIPE_PRICE_PRO",
    features: ["50 scripts / month", "Niche Bend Engine", "Viral Remixer", "Viral Magnet Titles", "Metadata & A/B Testing", "Compliance Checker (20/mo)", "Priority generation"],
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Agency",
    price: "$99",
    priceEnv: "NEXT_PUBLIC_STRIPE_PRICE_AGENCY",
    features: ["200 scripts / month", "Niche Bend Engine", "Viral Remixer", "Viral Magnet Titles", "Metadata & A/B Testing", "Compliance Checker (100/mo)", "Priority generation", "5 team seats"],
    highlight: false,
  },
];

export function PricingPlans({ priceIds, currentPlan }: {
  priceIds: { starter: string; pro: string; agency: string };
  currentPlan?: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const planKeyMap: Record<string, string> = { Starter: "starter", Pro: "pro", Agency: "agency" };

  const priceMap: Record<string, string> = {
    Starter: priceIds.starter,
    Pro: priceIds.pro,
    Agency: priceIds.agency,
  };

  async function handleSubscribe(planName: string) {
    const priceId = priceMap[planName];
    if (!priceId) return;
    setLoading(planName);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setLoading(null);
    } catch {
      setLoading(null);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
      {PLANS.map((plan) => (
        <div
          key={plan.name}
          style={{
            borderRadius: 18,
            background: currentPlan && planKeyMap[plan.name] === currentPlan ? "rgba(52,211,153,0.06)" : plan.highlight ? "rgba(99,102,241,0.08)" : C.bg,
            border: `1px solid ${currentPlan && planKeyMap[plan.name] === currentPlan ? "rgba(52,211,153,0.35)" : plan.highlight ? "rgba(99,102,241,0.35)" : C.border}`,
            padding: "24px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            position: "relative",
            opacity: currentPlan && planKeyMap[plan.name] === currentPlan ? 0.45 : 1,
            transition: "opacity 200ms",
          }}
        >
          {currentPlan && planKeyMap[plan.name] === currentPlan && (
            <div style={{
              position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
              background: "linear-gradient(135deg,#059669,#34d399)",
              borderRadius: 20, padding: "3px 12px",
              fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap",
            }}>
              ✓ Current Plan
            </div>
          )}
          {(!currentPlan || planKeyMap[plan.name] !== currentPlan) && plan.badge && (
            <div style={{
              position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
              background: "linear-gradient(135deg,#6366f1,#a855f7)",
              borderRadius: 20, padding: "3px 12px",
              fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap",
            }}>
              {plan.badge}
            </div>
          )}

          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.accent, marginBottom: 4 }}>{plan.name}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: C.textBright, letterSpacing: -0.5 }}>
              {plan.price}<span style={{ fontSize: 14, fontWeight: 400, color: C.textDim }}>/mo</span>
            </p>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            {plan.features.map((f) => (
              <li key={f} style={{ fontSize: 13, color: C.textDim, display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ color: "#34d399", marginTop: 1, flexShrink: 0 }}>✓</span>
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={() => currentPlan && planKeyMap[plan.name] === currentPlan ? undefined : handleSubscribe(plan.name)}
            disabled={loading === plan.name || (!!currentPlan && planKeyMap[plan.name] === currentPlan)}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 12,
              background: currentPlan && planKeyMap[plan.name] === currentPlan
                ? "rgba(52,211,153,0.12)"
                : plan.highlight
                ? "linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)"
                : "rgba(99,102,241,0.10)",
              color: currentPlan && planKeyMap[plan.name] === currentPlan ? "#34d399" : plan.highlight ? "#fff" : C.accent,
              border: currentPlan && planKeyMap[plan.name] === currentPlan ? "1px solid rgba(52,211,153,0.25)" : plan.highlight ? "none" : `1px solid rgba(99,102,241,0.20)`,
              fontSize: 13,
              fontWeight: 600,
              cursor: currentPlan && planKeyMap[plan.name] === currentPlan ? "default" : loading ? "wait" : "pointer",
              opacity: loading && loading !== plan.name ? 0.5 : 1,
            }}
          >
            {loading === plan.name ? "Redirecting…" : currentPlan && planKeyMap[plan.name] === currentPlan ? "✓ Current Plan" : `Get ${plan.name}`}
          </button>
        </div>
      ))}
    </div>
  );
}
