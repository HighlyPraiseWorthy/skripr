import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_placeholder", {
      apiVersion: "2026-04-22.dahlia" as any,
    });
  }
  return _stripe;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  }
});

export const STRIPE_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER || "",
  pro: process.env.STRIPE_PRICE_PRO || "",
  agency: process.env.STRIPE_PRICE_AGENCY || "",
} as const;

// ---- startup: log which price IDs are active (dev + live audit) -----
console.log("[stripe-config] STRIPE_PRICES:", JSON.stringify(STRIPE_PRICES));

export type PlanId = "free" | "starter" | "pro" | "agency";

export const PLAN_LIMITS: Record<PlanId, { scriptsPerMonth: number; nicheBends: number; complianceChecks: number; teamSeats: number }> = {
  free: { scriptsPerMonth: 2, nicheBends: 0, complianceChecks: 0, teamSeats: 1 },
  starter: { scriptsPerMonth: 12, nicheBends: 5, complianceChecks: 0, teamSeats: 1 },
  pro: { scriptsPerMonth: 25, nicheBends: Infinity, complianceChecks: 20, teamSeats: 1 },
  agency: { scriptsPerMonth: Infinity, nicheBends: Infinity, complianceChecks: 100, teamSeats: 5 },
};

export function getPlanFromPriceId(priceId: string): PlanId | null {
  if (priceId === STRIPE_PRICES.starter) return "starter";
  if (priceId === STRIPE_PRICES.pro) return "pro";
  if (priceId === STRIPE_PRICES.agency) return "agency";
  return null;
}
