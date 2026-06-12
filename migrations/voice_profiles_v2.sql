-- Voice Match v2: multiple named voice profiles per user, one active at a time
-- Run once in the Supabase SQL editor (you already ran voice_profiles.sql — this upgrades it)

ALTER TABLE voice_profiles DROP CONSTRAINT IF EXISTS voice_profiles_user_id_key;
ALTER TABLE voice_profiles ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'My Voice';
ALTER TABLE voice_profiles ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'scripts';
ALTER TABLE voice_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS voice_profiles_user_idx ON voice_profiles (user_id);
