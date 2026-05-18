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
    features: ["12 scripts/month", "6 saved scripts", "5 Niche Bends/month", "10 Compliance Checks/month"],
    highlight: false,
  },
  {
    name: "Pro",
    price: "$39",
    priceEnv: "NEXT_PUBLIC_STRIPE_PRICE_PRO",
    features: ["25 scripts/month", "15 saved scripts", "15 Niche Bends/month", "Unlimited Compliance Checks"],
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Agency",
    price: "$99",
    priceEnv: "NEXT_PUBLIC_STRIPE_PRICE_AGENCY",
    features: ["Unlimited scripts", "Unlimited saved scripts", "Unlimited Niche Bends", "Unlimited Compliance Checks", "5 team seats"],
    highlight: false,
  },
];

export function PricingPlans({ priceIds }: {
  priceIds: { starter: string; pro: string; agency: string };
}) {
  const [loading, setLoading] = useState<string | null>(null);

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
            background: plan.highlight ? "rgba(99,102,241,0.08)" : C.bg,
            border: `1px solid ${plan.highlight ? "rgba(99,102,241,0.35)" : C.border}`,
            padding: "24px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            position: "relative",
          }}
        >
          {plan.badge && (
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
            onClick={() => handleSubscribe(plan.name)}
            disabled={loading === plan.name}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 12,
              background: plan.highlight
                ? "linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)"
                : "rgba(99,102,241,0.10)",
              color: plan.highlight ? "#fff" : C.accent,
              border: plan.highlight ? "none" : `1px solid rgba(99,102,241,0.20)`,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              opacity: loading && loading !== plan.name ? 0.5 : 1,
            }}
          >
            {loading === plan.name ? "Redirecting…" : `Get ${plan.name}`}
          </button>
        </div>
      ))}
    </div>
  );
}
