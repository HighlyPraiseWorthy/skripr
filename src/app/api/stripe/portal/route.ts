import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe/config";
import { supabaseAdmin } from "@/lib/db/supabase";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Get customer from Supabase
    const { data } = await supabaseAdmin!.from("profiles").select("stripe_customer_id").eq("user_id", userId).single();
    
    if (!data?.stripe_customer_id) {
      return NextResponse.json({ error: "No subscription found" }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to open portal" }, { status: 500 });
  }
}