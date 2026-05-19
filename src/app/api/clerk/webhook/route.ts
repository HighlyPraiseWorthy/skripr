import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { supabaseAdmin } from "@/lib/db/supabase";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();

  const svixId = headersList.get("svix-id");
  const svixTimestamp = headersList.get("svix-timestamp");
  const svixSignature = headersList.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  let event: any;

  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created") {
    const { id, email_addresses } = event.data;
    const email = email_addresses?.[0]?.email_address || null;

    const { error } = await supabaseAdmin!.from("user_profiles").upsert({
      user_id: id,
      email,
      plan: "free",
      subscription_status: "inactive",
    }, { onConflict: "user_id" });

    if (error) {
      console.error("Clerk webhook error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
