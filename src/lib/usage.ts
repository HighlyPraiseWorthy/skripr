import { supabaseAdmin } from "@/lib/db/supabase";
import { PLAN_LIMITS, PlanId } from "@/lib/stripe/config";

export async function getUserPlan(userId: string): Promise<PlanId> {
  // Admin bypass
  const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);
  if (adminIds.includes(userId)) return "agency";

  if (!supabaseAdmin) return "free";
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("plan, subscription_status")
    .eq("user_id", userId)
    .single();
  if (!data) return "free";
  // Honor active Stripe subscriptions
  if (data.subscription_status === "active") return (data.plan as PlanId) || "free";
  return "free";
}

export async function getScriptsThisMonth(userId: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  const start = new Date();
  start.setDate(1); start.setHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin
    .from("generation_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());
  return count || 0;
}

// Pass the eventId from incrementGenerationCount so concurrent generations
// can't refund each other's usage event; falls back to latest-event if absent.
export async function refundGenerationCount(userId: string, eventId?: string | null): Promise<void> {
  if (!supabaseAdmin) return;
  if (eventId) {
    await supabaseAdmin.from("generation_events").delete().eq("id", eventId).eq("user_id", userId);
    return;
  }
  const { data } = await supabaseAdmin
    .from("generation_events")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (data) await supabaseAdmin.from("generation_events").delete().eq("id", data.id);
}

export async function incrementGenerationCount(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("generation_events")
    .insert({ user_id: userId })
    .select("id")
    .single();
  return data?.id ?? null;
}

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);

export async function checkScriptLimit(userId: string): Promise<{ allowed: boolean; plan: PlanId; used: number; limit: number }> {
  // Admin bypass — unlimited scripts for admin accounts
  if (ADMIN_USER_IDS.includes(userId)) {
    return { allowed: true, plan: "agency" as PlanId, used: 0, limit: Infinity };
  }

  const plan = await getUserPlan(userId);
  const limit = PLAN_LIMITS[plan].scriptsPerMonth;
  if (limit === Infinity) return { allowed: true, plan, used: 0, limit };
  const used = await getScriptsThisMonth(userId);
  return { allowed: used < limit, plan, used, limit };
}
