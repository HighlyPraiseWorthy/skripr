import { supabaseAdmin } from "@/lib/db/supabase";

// Voice Matching: a compact per-creator style guide, extracted once from the
// creator's own past scripts/transcripts and injected into every generation.

export async function getVoiceProfile(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data } = await supabaseAdmin
      .from("voice_profiles")
      .select("style_guide")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.style_guide || null;
  } catch {
    return null;
  }
}

export async function saveVoiceProfile(userId: string, styleGuide: string, sampleExcerpt: string): Promise<void> {
  if (!supabaseAdmin) throw new Error("Database not configured");
  const { error } = await supabaseAdmin
    .from("voice_profiles")
    .upsert(
      { user_id: userId, style_guide: styleGuide, sample_excerpt: sampleExcerpt, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) throw new Error(error.message);
}

export async function deleteVoiceProfile(userId: string): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("voice_profiles").delete().eq("user_id", userId);
}
