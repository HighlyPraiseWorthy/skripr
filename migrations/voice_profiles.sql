-- Voice Matching: per-creator style profile injected into script generation
-- Run once in the Supabase SQL editor (Dashboard -> SQL Editor -> paste -> Run)

CREATE TABLE IF NOT EXISTS voice_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  style_guide TEXT NOT NULL,
  sample_excerpt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;
