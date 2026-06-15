-- Angle feedback loop: record which suggested angle a creator actually picked
-- and generated a script from. Future "Suggest Angles" calls inject recently /
-- frequently picked angles for the niche, so suggestions lean toward what
-- creators actually choose. Run once in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS angle_picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  niche TEXT,
  topic TEXT,
  angle_text TEXT NOT NULL,
  hook_type TEXT,
  audience_emotion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS angle_picks_niche_idx
  ON angle_picks (niche, created_at DESC);

-- Same moat posture as viral_frameworks / hook_picks: service role bypasses RLS,
-- and with RLS on and no policies the public anon key cannot read it.
ALTER TABLE angle_picks ENABLE ROW LEVEL SECURITY;
