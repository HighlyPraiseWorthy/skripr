-- Profiles (extends Clerk users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  email TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'agency')),
  subscription_status TEXT DEFAULT 'inactive',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  scripts_used_this_month INTEGER DEFAULT 0,
  billing_cycle_start DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Niches reference table
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

-- Channel analyses
CREATE TABLE IF NOT EXISTS channel_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  channel_id TEXT,
  channel_name TEXT,
  niche_id TEXT REFERENCES niches(id),
  subscriber_count INTEGER,
  avg_views INTEGER,
  avg_retention NUMERIC,
  top_formats JSONB DEFAULT '[]',
  content_gaps JSONB DEFAULT '[]',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scripts
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  niche TEXT,
  topic TEXT,
  content TEXT NOT NULL,
  word_count INTEGER,
  estimated_duration INTEGER,
  source_video_id TEXT,
  structure_pattern JSONB,
  hook_type TEXT,
  metadata JSONB,
  compliance_score NUMERIC,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Niche bends
CREATE TABLE IF NOT EXISTS niche_bends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  niche_a TEXT NOT NULL,
  niche_b TEXT NOT NULL,
  bend_potential NUMERIC,
  ideas JSONB DEFAULT '[]',
  selected_idea JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance reports
CREATE TABLE IF NOT EXISTS compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  script_id UUID REFERENCES scripts(id),
  overall_score NUMERIC NOT NULL,
  risk_level TEXT NOT NULL,
  checks JSONB NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hook analyses
CREATE TABLE IF NOT EXISTS hook_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  niche TEXT,
  hooks JSONB NOT NULL,
  selected_hook TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metadata packages
CREATE TABLE IF NOT EXISTS metadata_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  script_id UUID REFERENCES scripts(id),
  titles TEXT[],
  description TEXT,
  tags TEXT[],
  thumbnail_text TEXT[],
  hashtags TEXT[],
  selected_title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User feedback
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  feature TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_status ON scripts(status);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_user_id ON compliance_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id);

-- RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE niche_bends ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE hook_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see their own
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (user_id = auth.jwt() ->> 'sub');

-- Scripts: users can only see their own
CREATE POLICY "Users can view own scripts" ON scripts FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can insert own scripts" ON scripts FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can update own scripts" ON scripts FOR UPDATE USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can delete own scripts" ON scripts FOR DELETE USING (user_id = auth.jwt() ->> 'sub');

-- Similar policies for other tables
CREATE POLICY "Users can view own niche_bends" ON niche_bends FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can insert own niche_bends" ON niche_bends FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can view own compliance_reports" ON compliance_reports FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can insert own compliance_reports" ON compliance_reports FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can view own hook_analyses" ON hook_analyses FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can insert own hook_analyses" ON hook_analyses FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can view own metadata_packages" ON metadata_packages FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can insert own metadata_packages" ON metadata_packages FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can view own channel_analyses" ON channel_analyses FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can insert own channel_analyses" ON channel_analyses FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can view own user_feedback" ON user_feedback FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "Users can insert own user_feedback" ON user_feedback FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');\n