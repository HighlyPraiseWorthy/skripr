import { NextResponse } from "next/server";
import { STRIPE_PRICES, PLAN_LIMITS } from "@/lib/stripe/config";

/** @swagger
 * GET /api/debug/stripe-prices
 * Shows which price IDs are active — helps catch swapped/missing env vars on Vercel
 * Response: { env: { pro: "...", agency: "..." }, limits, notes }
 */

export async function GET() {
  const mask = (s?: string) => {
    if (!s) return "not set";
    return s.length > 12 ? `${s.slice(0, 8)}...${s.slice(-4)}` : s;
  };

  return NextResponse.json({
    env: {
      starter: mask(process.env.STRIPE_PRICE_STARTER),
      pro: mask(process.env.STRIPE_PRICE_PRO),
      agency: mask(process.env.STRIPE_PRICE_AGENCY),
    },
    startLogCheck:
      "Check Vercel Function logs → 'stripe-config' startup line — confirms env var values at cold-start",
    limits: PLAN_LIMITS,
    notes: [
      "If pro and agency look identical: one Vercel env var is wrong.",
      "Fix in Vercel → Settings → Environment Variables.",
      "Search for 'STRIPE_PRICE' — keep only 'starter', 'pro', 'agency' (no NEXT_PUBLIC_ variant).",
      "Redeploy after every env change.",
    ],
    actionSteps: [
      "1. Verify STRIPE_PRICE_PRO in Vercel dashboard → should be the $39 Pro price ID from Stripe",
      "2. Verify STRIPE_PRICE_AGENCY in Vercel dashboard → should be the $99 Agency price ID from Stripe",
      "3. Redeploy (`vercel --prod` or push a commit)",
      "4. Click Pro on settings page → should land on the Pro Stripe checkout",
      "5. Click Agency → should land on the Agency Stripe checkout",
    ],
  });
}
