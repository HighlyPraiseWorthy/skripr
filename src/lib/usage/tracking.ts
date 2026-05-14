import { supabase, supabaseAdmin } from "@/lib/db/supabase";

// Free tier limits
export const FREE_TIER_LIMITS = {
  scripts_generated: 2,
  scripts_saved: 1,
  hooks_generated: 10,
  metadata_generated: 5,
  niche_bend_ideas: 5,
  compliance_checks: 10,
} as const;

export type UsageKey = keyof typeof FREE_TIER_LIMITS;

export interface UsageTracking {
  id: string;
  user_id: string;
  month: string;
  scripts_generated: number;
  scripts_saved: number;
  hooks_generated: number;
  metadata_generated: number;
  niche_bend_ideas: number;
  compliance_checks: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get the user's Clerk ID from the profiles table via their auth ID
 */
export async function getProfileId(authUserId: string): Promise<string | null> {
  const { data } = await supabaseAdmin!
    .from("profiles")
    .select("id")
    .eq("user_id", authUserId)
    .single();
  return data?.id ?? null;
}

/**
 * Get or create usage record for the current month
 */
export async function getUsage(userId: string): Promise<UsageTracking | null> {
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .rpc("get_or_create_usage", { p_user_id: userId });

  if (error) {
    console.error("getUsage error:", error);
    return null;
  }

  return data as UsageTracking;
}

/**
 * Increment a usage counter
 */
export async function incrementUsage(
  userId: string,
  field: UsageKey
): Promise<boolean> {
  if (!supabaseAdmin) return false;

  const { error } = await supabaseAdmin.rpc("increment_usage", {
    p_user_id: userId,
    p_field: field,
  });

  if (error) {
    // Fallback: manual increment if RPC doesn't exist
    const { data: usage } = await supabaseAdmin
      .from("usage_tracking")
      .select("*")
      .eq("user_id", userId)
      .eq("month", new Date().toISOString().slice(0, 7))
      .single();

    if (usage) {
      await supabaseAdmin
        .from("usage_tracking")
        .update({ [field]: (usage[field] || 0) + 1 })
        .eq("id", usage.id);
    }
  }

  return true;
}

/**
 * Check if user has exceeded their limit for a given action.
 * Returns { allowed: boolean, current: number, limit: number }
 */
export async function checkLimit(
  userId: string,
  action: UsageKey,
  isPaid: boolean = false
): Promise<{ allowed: boolean; current: number; limit: number }> {
  // Paid users have no limits
  if (isPaid) {
    return { allowed: true, current: 0, limit: Infinity };
  }

  const limit = FREE_TIER_LIMITS[action];
  const usage = await getUsage(userId);

  const current = usage?.[action] ?? 0;

  return {
    allowed: current < limit,
    current,
    limit,
  };
}
