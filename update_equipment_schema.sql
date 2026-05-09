-- Add revision fields to equipment table
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS last_revision DATE;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS revisions JSONB DEFAULT '[]'::JSONB;
