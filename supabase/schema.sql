/* ═══════════════════════════════════════════════════════════════
   Skripr Supabase Schema — Clerk-compatible
   ═══════════════════════════════════════════════════════════════
   Auth layer          : Clerk (userId = text, not UUID)
   DB identity mapping : profiles.user_id = Clerk user ID (text)
                         profiles.id       = random UUID   (PK)
   All feature tables use profile.id (UUID) as their user key.
   RLS: set to permissive (TRUE); access is gated by Clerk in-app.
   ═══════════════════════════════════════════════════════════════ */

-- ─── Profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,               -- Clerk user ID
  email TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','starter','pro','agency')),
  subscription_status TEXT DEFAULT 'inactive',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  scripts_used_this_month  INTEGER DEFAULT 0,
  billing_cycle_start DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id       ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_cust  ON profiles(stripe_customer_id);

-- ─── Scripts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID                     NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Script',
  niche TEXT,
  topic TEXT,
  content TEXT NOT NULL DEFAULT '',
  word_count INTEGER,
  estimated_duration INTEGER,       -- seconds
  source_video_id TEXT,
  structure_pattern JSONB,
  hook_type TEXT,
  metadata JSONB,
  compliance_score NUMERIC,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','completed','archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scripts_user_id  ON scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_created   ON scripts(created_at DESC);

-- ─── Niche Bends ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS niche_bends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  niche_a TEXT NOT NULL,
  niche_b TEXT NOT NULL,
  bend_potential NUMERIC,
  ideas JSONB DEFAULT '[]',
  selected_idea JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_niche_bends_user_id ON niche_bends(user_id);

-- ─── Compliance Reports ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  script_id UUID REFERENCES scripts(id) ON DELETE SET NULL,
  overall_score NUMERIC NOT NULL,
  risk_level TEXT NOT NULL,
  checks JSONB NOT NULL DEFAULT '[]',
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compliance_user_id ON compliance_reports(user_id);

-- ─── Hook Analyses ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hook_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  niche TEXT,
  hooks JSONB NOT NULL DEFAULT '[]',
  selected_hook TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hooks_user_id ON hook_analyses(user_id);

-- ─── Metadata Packages ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS metadata_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  script_id UUID REFERENCES scripts(id) ON DELETE SET NULL,
  titles TEXT[],
  description TEXT,
  tags TEXT[],
  thumbnail_text TEXT[],
  hashtags TEXT[],
  selected_title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_metadata_user_id ON metadata_packages(user_id);

-- ─── Usage Tracking ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM'),
  scripts_generated INTEGER NOT NULL DEFAULT 0,
  scripts_saved        INTEGER NOT NULL DEFAULT 0,
  hooks_generated      INTEGER NOT NULL DEFAULT 0,
  metadata_generated   INTEGER NOT NULL DEFAULT 0,
  niche_bend_ideas     INTEGER NOT NULL DEFAULT 0,
  compliance_checks    INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month)
);
CREATE INDEX IF NOT EXISTS idx_usage_user_month ON usage_tracking(user_id, month);

-- ─── Channel Analyses ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id TEXT,
  channel_name TEXT,
  niche_id TEXT,
  subscriber_count INTEGER,
  avg_views INTEGER,
  avg_retention NUMERIC,
  top_formats JSONB DEFAULT '[]',
  content_gaps JSONB DEFAULT '[]',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_channel_user_id ON channel_analyses(user_id);

-- ─── Niches (reference data) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS niches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_id TEXT REFERENCES niches(id),
  avg_rpm NUMERIC DEFAULT 0,
  competition_level TEXT DEFAULT 'medium',
  adjacent_niche_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── User Feedback ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON user_feedback(user_id);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE niche_bends       ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE hook_analyses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_analyses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback     ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking    ENABLE ROW LEVEL SECURITY;
ALTER TABLE niches            ENABLE ROW LEVEL SECURITY;

-- Permissive policies: all reads/writes allowed.
-- Security is enforced at the app layer by Clerk authentication.
CREATE POLICY "allow_all" ON profiles           FOR ALL USING (true);
CREATE POLICY "allow_all" ON scripts            FOR ALL USING (true);
CREATE POLICY "allow_all" ON niche_bends        FOR ALL USING (true);
CREATE POLICY "allow_all" ON compliance_reports FOR ALL USING (true);
CREATE POLICY "allow_all" ON hook_analyses       FOR ALL USING (true);
CREATE POLICY "allow_all" ON metadata_packages   FOR ALL USING (true);
CREATE POLICY "allow_all" ON channel_analyses    FOR ALL USING (true);
CREATE POLICY "allow_all" ON user_feedback       FOR ALL USING (true);
CREATE POLICY "allow_all" ON usage_tracking      FOR ALL USING (true);
CREATE POLICY "allow_all" ON niches              FOR ALL USING (true);

-- ─── updated_at triggers ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_scripts_updated   ON scripts;
DROP TRIGGER IF EXISTS t_niche_bends_upd   ON niche_bends;
DROP TRIGGER IF EXISTS t_compliance_upd    ON compliance_reports;
DROP TRIGGER IF EXISTS t_hooks_upd         ON hook_analyses;
DROP TRIGGER IF EXISTS t_metadata_upd      ON metadata_packages;
DROP TRIGGER IF EXISTS t_profiles_upd      ON profiles;
DROP TRIGGER IF EXISTS t_usage_upd         ON usage_tracking;

CREATE TRIGGER t_scripts_updated   BEFORE UPDATE ON scripts           FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER t_niche_bends_upd   BEFORE UPDATE ON niche_bends        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER t_compliance_upd    BEFORE UPDATE ON compliance_reports  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER t_hooks_upd         BEFORE UPDATE ON hook_analyses       FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER t_metadata_upd      BEFORE UPDATE ON metadata_packages   FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER t_profiles_upd      BEFORE UPDATE ON profiles           FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER t_usage_upd         BEFORE UPDATE ON usage_tracking      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── RPC: get-or-create usage ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_or_create_usage(p_user_id UUID)
RETURNS usage_tracking AS $$
DECLARE result usage_tracking;
BEGIN
  INSERT INTO usage_tracking (user_id, month)
  VALUES (p_user_id, to_char(NOW(),'YYYY-MM'))
  ON CONFLICT DO UPDATE SET updated_at = NOW()
  RETURNING * INTO RESULT;
  RETURN RESULT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
