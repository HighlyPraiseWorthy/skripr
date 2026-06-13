import { supabaseAdmin } from "@/lib/db/supabase";

// Voice Match: up to MAX_PROFILES named voice profiles per user, extracted
// from the creator's scripts or a YouTube channel's transcripts. One profile
// is active at a time and gets injected into every script generation.

export const MAX_PROFILES = 5;

export interface VoiceProfileRow {
  id: string;
  name: string;
  source: string;
  style_guide: string;
  is_active: boolean;
  updated_at: string;
}

// The active profile's style guide — what generation injects
export async function getVoiceProfile(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data } = await supabaseAdmin
      .from("voice_profiles")
      .select("style_guide")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    return data?.style_guide || null;
  } catch {
    return null;
  }
}

export async function listVoiceProfiles(userId: string): Promise<VoiceProfileRow[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from("voice_profiles")
    .select("id, name, source, style_guide, is_active, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data ?? []) as VoiceProfileRow[];
}

export async function createVoiceProfile(
  userId: string,
  name: string,
  source: string,
  styleGuide: string,
  sampleExcerpt: string
): Promise<VoiceProfileRow> {
  if (!supabaseAdmin) throw new Error("Database not configured");
  const existing = await listVoiceProfiles(userId);
  if (existing.length >= MAX_PROFILES) {
    throw new Error(`You can save up to ${MAX_PROFILES} voices — delete one to add another`);
  }
  const { data, error } = await supabaseAdmin
    .from("voice_profiles")
    .insert({
      user_id: userId,
      name: name.slice(0, 60),
      source,
      style_guide: styleGuide,
      sample_excerpt: sampleExcerpt,
      is_active: existing.length === 0, // first voice becomes active automatically
    })
    .select("id, name, source, style_guide, is_active, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data as VoiceProfileRow;
}

export async function setActiveVoiceProfile(userId: string, profileId: string | null): Promise<void> {
  if (!supabaseAdmin) throw new Error("Database not configured");
  await supabaseAdmin.from("voice_profiles").update({ is_active: false }).eq("user_id", userId);
  if (profileId) {
    const { error } = await supabaseAdmin
      .from("voice_profiles")
      .update({ is_active: true })
      .eq("user_id", userId)
      .eq("id", profileId);
    if (error) throw new Error(error.message);
  }
}

export async function deleteVoiceProfileById(userId: string, profileId: string): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("voice_profiles").delete().eq("user_id", userId).eq("id", profileId);
}

// Per-script voice override: fetch a specific profile's guide (ownership-checked)
export async function getVoiceProfileById(userId: string, profileId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data } = await supabaseAdmin
      .from("voice_profiles")
      .select("style_guide")
      .eq("user_id", userId)
      .eq("id", profileId)
      .maybeSingle();
    return data?.style_guide || null;
  } catch {
    return null;
  }
}

// Variants that also return the voice name, so generation can record which
// voice produced each script (shown in My Scripts).
export async function getActiveVoiceMeta(userId: string): Promise<{ styleGuide: string; name: string } | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data } = await supabaseAdmin
      .from("voice_profiles")
      .select("style_guide, name")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    return data ? { styleGuide: data.style_guide, name: data.name } : null;
  } catch {
    return null;
  }
}

export async function getVoiceMetaById(userId: string, profileId: string): Promise<{ styleGuide: string; name: string } | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data } = await supabaseAdmin
      .from("voice_profiles")
      .select("style_guide, name")
      .eq("user_id", userId)
      .eq("id", profileId)
      .maybeSingle();
    return data ? { styleGuide: data.style_guide, name: data.name } : null;
  } catch {
    return null;
  }
}
