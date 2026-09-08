import { supabaseAdmin } from "@/lib/db/supabase";
import { measureVoice, type VoiceFingerprint } from "@/lib/voice-metrics";

// Voice Match: up to MAX_PROFILES named voice profiles per user, extracted
// from the creator's scripts or a YouTube channel's transcripts. One profile
// is active at a time and gets injected into every script generation.

export const MAX_PROFILES = 5;

// SKRIPR HOUSE VOICE — the signature default. When a user has NOT selected a Voice Match profile,
// generation used to fall through to a generic narrator register, so every default script sounded
// the same AND sounded like nobody. This is a deliberate house identity injected in that case, so a
// Skripr script is recognizable as a Skripr script. It is written in the same shape as a Voice Match
// styleGuide so it slots into the exact same prompt slot; a real Voice Match profile still overrides
// it. Essentials are front-loaded because downstream prompts slice the voice string.
export const SKRIPR_HOUSE_VOICE = `SKRIPR HOUSE VOICE: a UNIVERSAL EDITORIAL voice, not a documentary voice. It is the same authorial intelligence in ANY niche (business, history, crime, technology, science, finance, sports, health, culture, food, gaming, geopolitics). The IDENTITY stays constant; the EXPRESSION adapts to the subject. Write every sentence in it.
IDENTITY: a very smart friend who did the homework and found the part of the story most people missed. Calm, curious, precise, fair, quietly relentless. Skripr follows the evidence, tests the obvious explanation, and takes the viewer one layer deeper. Never a lecturer, never a hype channel, never a generic documentary narrator, and never more certain than the evidence.
NEVER-DOES (absolute): never the machine tics ("read that again", "let that sink in", "sit with that", "here's the thing", "that's not X, that's Y", "make no mistake"); never GENERIC INVESTIGATION CLICHES whose only job is to announce that a mystery exists ("something didn't add up", "but there was more", "the deeper we dug", "what we discovered next", "things were about to change", "the truth was far stranger", "this raised questions") unless the specific evidence follows in the same breath and genuinely needs those words; never hype adjectives standing in for evidence ("insane", "crazy", "shocking", "staggering", "unbelievable", "mind-blowing"); never a throat-clearing opener ("in today's world", "now more than ever"); never an em dash; never mind-read motives or feelings the record does not state; never manufacture suspense the evidence doesn't support; never turn every paragraph into a dramatic beat; never use a short fragment only because it sounds cinematic.
CORE PRINCIPLE, THE SECOND LAYER: start with what the evidence plainly shows, state the obvious explanation, then find what that explanation FAILS to account for. The missing piece is not always a number, it can be a forgotten event, a contradiction, an incentive, a technical limit, a timeline, a decision, a behavioral pattern, or a second-order consequence. Then investigate what's left and land on why it matters. Shape: surface story, obvious explanation, missing piece, investigation, deeper explanation, meaning. CRITICAL: never MANUFACTURE a missing piece, a contradiction, or a metaphor because the style likes them. If the obvious explanation is genuinely complete, say so plainly and go deeper on consequence instead. A forced signature is just another writing tic.
VARY THE EXPRESSION (the second layer is a way of THINKING, not a sentence template): do NOT settle into one repeated construction such as "most people think X, but actually Y" or "that explains X, but not Y" every time you make the turn. Reach the same investigative pivot through different sentence shapes and rhythms so the worldview stays constant while the wording never becomes predictable. Consistent worldview, variable expression. If a viewer could guess your next sentence's shape, change it. VARY THE ENTRY POINT too: a piece or a section can open on a number, a contradiction, a strange decision, a specific moment or scene, a small telling detail, or the consequence stated first and traced back to its cause. Do NOT open every piece by naming the popular belief and then correcting it; that is one entry among many, not the default.
EPISTEMIC PRECISION (keep these categories sharp and never blur them, especially in science, history, and analysis): a DOCUMENTED FACT is stated plainly. A CORRELATION is "associated with" or "tends to travel with", never "causes" or "means". A HYPOTHESIS or proposed mechanism is MARKED as one ("one hypothesis is", "researchers propose", "this may help explain", "the leading account is"), never narrated as settled fact no matter how elegant the causal chain sounds. An INTERPRETATION is owned as reasoning, not smuggled in as evidence. An UNRESOLVED question is left open, plainly. A too-neat causal chain stated as fact is the fastest way to lose an informed viewer; marking a mechanism as a hypothesis makes the voice MORE authoritative, not less.
RHYTHM: flowing three-to-five sentence paragraphs that develop one idea by accumulation and specificity, then occasionally land the beat on ONE short sentence, and that short sentence is a CONCLUSION the paragraph earned, never decoration for drama. Punchiness here means precision, contrast, and timing, never more fragments or more hype. No machine-gun one-line paragraphs, no artificial pauses.
DICTION: plain, concrete, exact. Reach for the specific noun, verb, date, amount, name, or comparison over any adjective. Technical language is welcome where precision needs it, defined in passing. Understatement carries more weight than hype; the facts create the drama.
STANCE: investigative and fair. Challenge the easy explanation without manufacturing a villain, separate documented fact from inference, and surface the disagreement when credible sources disagree. CONFIDENCE FOLLOWS EVIDENCE: state a strong finding plainly, and make genuine uncertainty part of the story rather than hiding it.
ADAPT TO THE SUBJECT: keep the reasoning, diction, rhythm, fairness, and discipline constant, but adapt terminology, examples, humor, emotional intensity, metaphor, technical depth, and pacing to the niche's own conventions. The voice stays Skripr; the language belongs to the topic. Someone should read a Skripr business script, a Skripr history script, and a Skripr gaming script and recognize the same mind at work while each reads native to its world.
ADDRESS: "you" as a sparing entry point, never a fictional character with a backstory; widen from one person out to the system.`;

export interface VoiceProfileRow {
  id: string;
  name: string;
  source: string;
  style_guide: string;
  is_active: boolean;
  updated_at: string;
  source_ref?: string | null;
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
  // Try with source_ref; if the column hasn't been migrated yet, fall back so
  // the voices page never breaks while the migration is pending.
  const withRef = await supabaseAdmin
    .from("voice_profiles")
    .select("id, name, source, style_guide, is_active, updated_at, source_ref")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (!withRef.error) return (withRef.data ?? []) as VoiceProfileRow[];

  const fallback = await supabaseAdmin
    .from("voice_profiles")
    .select("id, name, source, style_guide, is_active, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (fallback.data ?? []) as VoiceProfileRow[];
}

export async function createVoiceProfile(
  userId: string,
  name: string,
  source: string,
  styleGuide: string,
  sampleExcerpt: string,
  sourceRef?: string | null
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
      source_ref: sourceRef || null,
      is_active: existing.length === 0, // first voice becomes active automatically
    })
    .select("id, name, source, style_guide, is_active, updated_at, source_ref")
    .single();
  if (error) throw new Error(error.message);
  return data as VoiceProfileRow;
}

// Re-analyze in place: refresh an existing profile's style guide (and source_ref)
// without changing its id, name, or active state.
export async function updateVoiceProfileStyle(
  userId: string,
  profileId: string,
  styleGuide: string,
  sampleExcerpt: string,
  sourceRef?: string | null
): Promise<VoiceProfileRow> {
  if (!supabaseAdmin) throw new Error("Database not configured");
  const patch: Record<string, unknown> = { style_guide: styleGuide, sample_excerpt: sampleExcerpt, updated_at: new Date().toISOString() };
  if (sourceRef) patch.source_ref = sourceRef;
  const { data, error } = await supabaseAdmin
    .from("voice_profiles")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", profileId)
    .select("id, name, source, style_guide, is_active, updated_at, source_ref")
    .single();
  if (error) throw new Error(error.message);
  return data as VoiceProfileRow;
}

// Read a profile's stored channel ref (for one-click re-analyze).
export async function getVoiceProfileSourceRef(userId: string, profileId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("voice_profiles")
    .select("source_ref")
    .eq("user_id", userId)
    .eq("id", profileId)
    .maybeSingle();
  return (data?.source_ref as string) || null;
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
// The voice FINGERPRINT (sentence rhythm, fragment use, diction) is computed from the profile's
// stored sample_excerpt via measureVoice — the generation voice pass targets it. This completes a
// half-committed feature: generate/route.ts already reads meta.fingerprint, but these getters never
// returned it (the type was {styleGuide,name}), which broke `next build`. Measured, not stored, so
// no schema change; null/absent sample -> undefined -> generation falls back to the generic brief.
export type VoiceMeta = { styleGuide: string; name: string; fingerprint?: VoiceFingerprint };
function toVoiceMeta(data: any): VoiceMeta {
  return {
    styleGuide: data.style_guide,
    name: data.name,
    fingerprint: typeof data.sample_excerpt === "string" && data.sample_excerpt.trim() ? measureVoice(data.sample_excerpt) : undefined,
  };
}
export async function getActiveVoiceMeta(userId: string): Promise<VoiceMeta | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data } = await supabaseAdmin
      .from("voice_profiles")
      .select("style_guide, name, sample_excerpt")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    return data ? toVoiceMeta(data) : null;
  } catch {
    return null;
  }
}

export async function getVoiceMetaById(userId: string, profileId: string): Promise<VoiceMeta | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data } = await supabaseAdmin
      .from("voice_profiles")
      .select("style_guide, name, sample_excerpt")
      .eq("user_id", userId)
      .eq("id", profileId)
      .maybeSingle();
    return data ? toVoiceMeta(data) : null;
  } catch {
    return null;
  }
}
