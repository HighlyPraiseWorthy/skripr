-- Voice Match re-analyze: store the channel handle/URL a voice was built from,
-- so a profile can be regenerated (with the latest analysis fields) in one click.
-- Null for paste-scripts profiles and for any profile created before this column.
ALTER TABLE voice_profiles ADD COLUMN IF NOT EXISTS source_ref TEXT;
