import { supabaseAdmin } from "@/lib/db/supabase";
import { PLAN_LIMITS, PlanId } from "@/lib/stripe/config";

export async function getUserPlan(userId: string): Promise<PlanId> {
  if (!supabaseAdmin) return "free";
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("plan, subscription_status")
    .eq("user_id", userId)
    .single();
  if (!data || data.subscription_status !== "active") return "free";
  return (data.plan as PlanId) || "free";
}

export async function getScriptsThisMonth(userId: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  const start = new Date();
  start.setDate(1); start.setHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin
    .from("scripts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());
  return count || 0;
}

export async function checkScriptLimit(userId: string): Promise<{ allowed: boolean; plan: PlanId; used: number; limit: number }> {
  const plan = await getUserPlan(userId);
  const limit = PLAN_LIMITS[plan].scriptsPerMonth;
  if (limit === Infinity) return { allowed: true, plan, used: 0, limit };
  const used = await getScriptsThisMonth(userId);
  return { allowed: used < limit, plan, used, limit };
}
