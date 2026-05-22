import { NextResponse } from "next/server";
import { stripe, STRIPE_PRICES } from "@/lib/stripe/config";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  try {
    const { priceId } = await req.json();
    if (!priceId) return NextResponse.json({ error: "Price ID required" }, { status: 400 });

    // Try to tie the checkout to the signed-in user
    let userId: string | undefined;
    try {
      const { userId: uid } = await auth();
      userId = uid || undefined;
    } catch {
      // Not signed in — unauthenticated checkout; webhook will match by email
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: undefined,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/scripts?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?canceled=true`,
      subscription_data: { metadata: userId ? { userId } : {} },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create checkout" }, { status: 500 });
  }
}
