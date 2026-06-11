-- Viral Remixer Level 2: collective learning layer
-- Run once in the Supabase SQL editor (Dashboard -> SQL Editor -> paste -> Run)

CREATE TABLE IF NOT EXISTS viral_frameworks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT UNIQUE,
  video_title TEXT,
  niche TEXT,
  hook_type TEXT,
  hook_text TEXT,
  why_it_works TEXT,
  structure JSONB,
  retention_triggers JSONB,
  title_formula JSONB,
  remix_framework TEXT,
  source_views BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS viral_frameworks_niche_idx
  ON viral_frameworks (niche, created_at DESC);

-- This table is the moat: service role bypasses RLS, and with RLS on and no
-- policies the public anon key cannot read it from the browser.
ALTER TABLE viral_frameworks ENABLE ROW LEVEL SECURITY;
