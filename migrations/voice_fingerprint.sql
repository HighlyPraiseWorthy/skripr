-- Measurable voice. A prose style guide cannot be enforced during generation — it
-- competes against facts, structure, techniques and director's notes, and loses. This
-- column stores a NUMERIC fingerprint (average sentence length and variance, second
-- person rate, contraction rate, question rate, fragment rate, paragraph length)
-- measured from the creator's FULL transcripts at profile-build time, when we still
-- have them. The voice rewrite pass aims at those numbers, and the compliance panel
-- checks against them.
--
-- OPTIONAL — the code falls back to the prose style guide when the column is absent.
-- Run once in the Supabase SQL editor.

ALTER TABLE voice_profiles
  ADD COLUMN IF NOT EXISTS voice_fingerprint JSONB;
