-- Niche Bend proof layer: cache YouTube intersection lookups so each unique
-- blend is only searched once (controls YouTube API quota, speeds up repeats).
-- Optional — the feature degrades gracefully without it, just uncached.
-- Run once in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS bend_proof_cache (
  query_key TEXT PRIMARY KEY,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bend_proof_cache ENABLE ROW LEVEL SECURITY;
