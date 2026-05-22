import { NextResponse } from "next/server";
import { stripe, STRIPE_PRICES } from "@/lib/stripe/config";

export async function POST(req: Request) {
  try {
    const { priceId } = await req.json();
    if (!priceId) return NextResponse.json({ error: "Price ID required" }, { status: 400 });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: undefined,
      client_reference_id: undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/scripts?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?canceled=true`,
      subscription_data: { metadata: {} },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create checkout" }, { status: 500 });
  }
}
