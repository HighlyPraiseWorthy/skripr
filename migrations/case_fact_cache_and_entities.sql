-- Research persistence layer for the grounding pipeline. Two tables:
--
--   case_fact_cache      — a case's BEST (richest) deepened fact set, reused across
--                          runs so the same case is deterministic and the "Name it"
--                          pin stops re-deriving a worse set.
--   script_case_entities — the proper nouns from each deepened case, per user, so a
--                          later generation of a DIFFERENT case can diff against them
--                          and drop cross-case contamination (Dobyns bleeding into a
--                          Queen script, etc.).
--
-- Both are OPTIONAL — the code degrades gracefully (uncached, no watchlist) when the
-- tables are absent, exactly like bend_proof_cache. Run once in the Supabase SQL editor.
-- Access is server-side only via the service-role key (RLS on, no public policies).

CREATE TABLE IF NOT EXISTS case_fact_cache (
  case_key    TEXT PRIMARY KEY,        -- normalized canonical case name (see caseKey())
  case_name   TEXT,                    -- display name as returned to the UI
  when_range  TEXT,                    -- "1998-2000" or empty when unknown
  facts       JSONB NOT NULL,          -- [{ fact, source }]
  conflicts   JSONB DEFAULT '[]'::jsonb,
  fact_count  INT  NOT NULL DEFAULT 0, -- richness, used to keep only the best set
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE case_fact_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS script_case_entities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,            -- Clerk user id
  case_key   TEXT NOT NULL,            -- same normalized key as case_fact_cache
  case_name  TEXT,
  entities   JSONB NOT NULL,           -- ["Billy St. John", "San Fernando Valley", ...]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup of a user's most recent cases for the contamination watchlist.
CREATE INDEX IF NOT EXISTS script_case_entities_user_recent
  ON script_case_entities (user_id, created_at DESC);

ALTER TABLE script_case_entities ENABLE ROW LEVEL SECURITY;
