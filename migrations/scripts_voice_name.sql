-- Track which Voice Match voice produced each script, so My Scripts can show it.
-- Run once in the Supabase SQL editor.

ALTER TABLE scripts ADD COLUMN IF NOT EXISTS voice_name TEXT;
