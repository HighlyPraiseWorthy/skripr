-- ScriptFactory Week 3 Migration
-- Run this in Supabase SQL Editor: https://yinkfjmmcpzphlqmvoge.supabase.com/project/sql/new

-- =============================================
-- SCRIPTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Script',
    niche TEXT NOT NULL DEFAULT '',
    topic TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    word_count INTEGER NOT NULL DEFAULT 0,
    estimated_duration INTEGER NOT NULL DEFAULT 0, -- in seconds
    source_video_id TEXT NOT NULL DEFAULT '',
    structure_pattern TEXT NOT NULL DEFAULT 'problem-solution',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user-scoped queries
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON public.scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_created_at ON public.scripts(created_at DESC);

-- Enable RLS
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own scripts
CREATE POLICY "Users can view own scripts"
    ON public.scripts FOR SELECT
    USING (user_id = auth.uid());

-- Users can only insert their own scripts
CREATE POLICY "Users can insert own scripts"
    ON public.scripts FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can only update their own scripts
CREATE POLICY "Users can update own scripts"
    ON public.scripts FOR UPDATE
    USING (user_id = auth.uid());

-- Users can only delete their own scripts
CREATE POLICY "Users can delete own scripts"
    ON public.scripts FOR DELETE
    USING (user_id = auth.uid());

-- =============================================
-- USAGE TRACKING TABLE (for free tier paywall)
-- =============================================
CREATE TABLE IF NOT EXISTS public.usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    month TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM'), -- e.g. '2025-06'
    scripts_generated INTEGER NOT NULL DEFAULT 0,
    scripts_saved INTEGER NOT NULL DEFAULT 0,
    hooks_generated INTEGER NOT NULL DEFAULT 0,
    metadata_generated INTEGER NOT NULL DEFAULT 0,
    niche_bend_ideas INTEGER NOT NULL DEFAULT 0,
    compliance_checks INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, month)
);

-- Index for fast user+month lookups
CREATE INDEX IF NOT EXISTS idx_usage_user_month ON public.usage_tracking(user_id, month);

-- Enable RLS
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
    ON public.usage_tracking FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own usage"
    ON public.usage_tracking FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own usage"
    ON public.usage_tracking FOR UPDATE
    USING (user_id = auth.uid());

-- =============================================
-- HELPER: updated_at auto-update trigger
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_scripts_updated_at
    BEFORE UPDATE ON public.scripts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_usage_updated_at
    BEFORE UPDATE ON public.usage_tracking
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- HELPER: get or create usage record for current month
-- =============================================
CREATE OR REPLACE FUNCTION public.get_or_create_usage(p_user_id UUID)
RETURNS public.usage_tracking AS $$
DECLARE
    result public.usage_tracking;
BEGIN
    INSERT INTO public.usage_tracking (user_id, month)
    VALUES (p_user_id, to_char(NOW(), 'YYYY-MM'))
    ON CONFLICT (user_id, month) DO UPDATE SET updated_at = NOW()
    RETURNING * INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
