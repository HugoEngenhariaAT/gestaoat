-- Script to add the missing 'for_stock' column to the 'orders' table
-- Also reloads the PostgREST schema cache to immediately fix the connection error

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS for_stock BOOLEAN DEFAULT false;

-- Force Supabase to reload the schema cache so the new column is recognized by the API
NOTIFY pgrst, 'reload schema';
