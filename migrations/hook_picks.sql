-- Hook Engine feedback loop: record which hooks creators actually keep/copy.
-- This is a positive-signal pool — generation injects recently-kept hooks for a
-- niche as proven-by-taste examples, so the Hook Engine learns what people
-- actually use, not just what got views. Run once in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS hook_picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  niche TEXT,
  topic TEXT,
  hook_text TEXT NOT NULL,
  hook_type TEXT,
  predicted_retention INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hook_picks_niche_idx
  ON hook_picks (niche, created_at DESC);

-- Same moat posture as viral_frameworks: service role bypasses RLS, and with
-- RLS on and no policies the public anon key cannot read it from the browser.
ALTER TABLE hook_picks ENABLE ROW LEVEL SECURITY;
