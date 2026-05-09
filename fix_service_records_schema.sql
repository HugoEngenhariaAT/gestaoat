-- Add service_value to service_records if it doesn't exist
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS service_value DECIMAL(10,2) DEFAULT 0;

-- Ensure daily_rate exists in providers
ALTER TABLE providers ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10,2) DEFAULT 0;

-- Ensure active exists in providers
ALTER TABLE providers ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- Ensure descriptions exists in service_records (as text array)
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS descriptions TEXT[] DEFAULT '{}';

-- Ensure created_by_id exists in service_records
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES auth.users(id);

-- Refresh schema cache (this is handled by Supabase automatically usually, but good to have the columns)
