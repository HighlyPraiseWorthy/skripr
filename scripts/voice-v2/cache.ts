// Shared transcript cache for the voice rules v2 test + rebuild (2026-10-11). Each voice's top-5 channel videos and
// their transcripts are fetched ONCE (Supadata is metered) and stored under .scratch/voice-cache/, which is
// git-ignored: this repo is public and the transcripts are other creators' content, so they must never be committed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { supabaseAdmin } from "../../src/lib/db/supabase";
import { fetchChannelLongform } from "../../src/lib/youtube-channel";
import { getTranscriptRobust } from "../../src/lib/youtube-transcript";

export const CACHE_DIR = ".scratch/voice-cache";
export const SAMPLE_VIDEOS = 5; // must match VOICE_SAMPLE_VIDEOS in src/app/api/voice-profile/route.ts
export interface CachedVoice { profileId: string; userId: string; name: string; sourceRef: string; fetchedAt: string; videos: { videoId: string; title: string; views: number; transcript: string }[]; v2Rules?: any; v2Fingerprint?: any }

export async function loadVoices() {
  const { data, error } = await supabaseAdmin!.from("voice_profiles").select("id, user_id, name, source_ref, style_guide, voice_fingerprint");
  if (error) throw error;
  return data || [];
}
export function cachePath(profileId: string) { return join(CACHE_DIR, `${profileId}.json`); }
export function readCache(profileId: string): CachedVoice | null { const p = cachePath(profileId); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; }
export function writeCache(c: CachedVoice) { mkdirSync(CACHE_DIR, { recursive: true }); writeFileSync(cachePath(c.profileId), JSON.stringify(c, null, 1)); }

// Fetch (or reuse) the top-5 transcripts for one voice. Same selection as the live analysis route.
export async function cachedVideos(p: { id: string; user_id: string; name: string; source_ref: string }): Promise<CachedVoice> {
  const hit = readCache(p.id);
  if (hit && hit.videos.length) return hit;
  const scan = await fetchChannelLongform(p.source_ref);
  const top = [...scan.videos].sort((a, b) => b.views - a.views).slice(0, SAMPLE_VIDEOS);
  const got = await Promise.all(top.map(async (v) => { try { const t = await getTranscriptRobust(v.videoId); return t?.trim() ? { videoId: v.videoId, title: v.title, views: v.views, transcript: t } : null; } catch { return null; } }));
  const c: CachedVoice = { profileId: p.id, userId: p.user_id, name: p.name, sourceRef: p.source_ref, fetchedAt: new Date().toISOString(), videos: got.filter(Boolean) as CachedVoice["videos"] };
  writeCache(c);
  return c;
}
// Same sample text the live route builds (each transcript capped at 9,000 chars, separated by ---).
export const samplesOf = (c: CachedVoice) => c.videos.map((v) => v.transcript.slice(0, 9000)).join("\n\n---\n\n");
