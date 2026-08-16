-- Per-topic FACT LIBRARY: the user's own accumulating research for a topic.
--
-- Facts used to be a byproduct of a run, so the same topic returned different evidence
-- every time (four sections, then two, then three; the $50 figure vanishing and coming
-- back). This table makes the fact set an artifact the user OWNS: every run adds to it,
-- nothing is silently dropped, and angle generation reads from it instead of re-rolling
-- retrieval. The user can hide facts (reversible) and paste their own.
--
-- OPTIONAL — the code degrades gracefully (falls back to per-run retrieval) when this
-- table is absent, exactly like case_fact_cache. Run once in the Supabase SQL editor.
-- Access is server-side only via the service-role key (RLS on, no public policies).

CREATE TABLE IF NOT EXISTS topic_fact_library (
  user_id     TEXT NOT NULL,              -- Clerk user id: this library is theirs
  topic_key   TEXT NOT NULL,              -- normalized topic (see topicKey())
  topic_label TEXT,                       -- human-readable topic as first seen
  facts       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ id, fact, source, addedAt, manual }]
  dismissed   JSONB NOT NULL DEFAULT '[]'::jsonb,  -- fact ids the user hid (reversible)
  fact_count  INT  NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, topic_key)
);

-- Listing a user's researched topics, newest first.
CREATE INDEX IF NOT EXISTS topic_fact_library_user_recent
  ON topic_fact_library (user_id, updated_at DESC);

ALTER TABLE topic_fact_library ENABLE ROW LEVEL SECURITY;
