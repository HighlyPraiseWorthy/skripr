-- Persist the storytelling craft layer that produced a script.
--
-- The user already picks a narrative mode and techniques in the generation flow
-- (see src/lib/storytelling.ts), but nothing was stored, so opening a saved
-- script gave no way to see what made it work. These two columns let the script
-- detail page show the techniques that were actually built into the script.
--
-- Run in the Supabase SQL editor. Safe to re-run.

ALTER TABLE scripts ADD COLUMN IF NOT EXISTS storytelling_mode TEXT;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS storytelling_techniques JSONB;

COMMENT ON COLUMN scripts.storytelling_mode IS 'Narrative mode id from src/lib/storytelling.ts MODES';
COMMENT ON COLUMN scripts.storytelling_techniques IS 'Array of resolved technique ids from src/lib/storytelling.ts TECHNIQUES';
