import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe/config";
import { getPlanFromPriceId } from "@/lib/stripe/config";
import { supabaseAdmin } from "@/lib/db/supabase";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature")!;

  try {
    const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const subscriptionId = session.subscription;
        const email = session.customer_details?.email || session.customer_email || "";
        let userId = session.client_reference_id as string | undefined;

        if (!userId && email && supabaseAdmin) {
          // No auth at checkout — look up or create user by email
          const { data: existing } = await supabaseAdmin
            .from("user_profiles")
            .select("user_id")
            .eq("email", email)
            .single();

          if (existing?.user_id) {
            userId = existing.user_id;
          } else {
            // First purchase by this email — create a fresh profile
            userId = `stripe_${randomUUID()}`;
            await supabaseAdmin.from("user_profiles").insert({
              user_id: userId,
              email,
              plan: "free",
              subscription_status: "incomplete",
            });
          }
        }

        if (userId && subscriptionId && supabaseAdmin) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0].price.id;
          const plan = getPlanFromPriceId(priceId);

          await supabaseAdmin.from("user_profiles").upsert(
            {
              user_id: userId,
              email: email || undefined,
              stripe_customer_id: session.customer,
              stripe_subscription_id: subscriptionId,
              plan: plan || "free",
              subscription_status: subscription.status,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        if (!supabaseAdmin) break;
        const plan = getPlanFromPriceId(subscription.items.data[0].price.id);

        await supabaseAdmin
          .from("user_profiles")
          .update({
            plan: subscription.status === "active" ? (plan || "free") : "free",
            subscription_status: subscription.status,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Stripe webhook error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
