import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe/config";
import { getPlanFromPriceId } from "@/lib/stripe/config";
import { supabaseAdmin } from "@/lib/db/supabase";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature")!;

  try {
    const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = session.client_reference_id;
        const subscriptionId = session.subscription;
        
        if (userId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0].price.id;
          const plan = getPlanFromPriceId(priceId);

          await supabaseAdmin!.from("profiles").upsert({
            user_id: userId,
            stripe_customer_id: session.customer,
            stripe_subscription_id: subscriptionId,
            plan: plan || "free",
            subscription_status: subscription.status,
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const plan = getPlanFromPriceId(subscription.items.data[0].price.id);
        
        await supabaseAdmin!.from("profiles").update({
          plan: subscription.status === "active" ? (plan || "free") : "free",
          subscription_status: subscription.status,
        }).eq("stripe_subscription_id", subscription.id);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}