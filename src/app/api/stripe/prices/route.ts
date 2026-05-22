import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    starter: process.env.STRIPE_PRICE_STARTER || "",
    pro:     process.env.STRIPE_PRICE_PRO     || "",
    agency:  process.env.STRIPE_PRICE_AGENCY  || "",
  });
}
