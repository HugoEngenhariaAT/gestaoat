-- Adding all potential missing columns to the orders table based on frontend code

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS for_stock BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_quantity NUMERIC,
ADD COLUMN IF NOT EXISTS quantity_justification TEXT,
ADD COLUMN IF NOT EXISTS delivery_type TEXT,
ADD COLUMN IF NOT EXISTS pickup_info TEXT,
ADD COLUMN IF NOT EXISTS pickup_by_id UUID,
ADD COLUMN IF NOT EXISTS pickup_by_name TEXT,
ADD COLUMN IF NOT EXISTS supplier TEXT,
ADD COLUMN IF NOT EXISTS expected_delivery DATE,
ADD COLUMN IF NOT EXISTS received_by TEXT,
ADD COLUMN IF NOT EXISTS requested_by_id UUID,
ADD COLUMN IF NOT EXISTS use_date DATE,
ADD COLUMN IF NOT EXISTS service_description TEXT,
ADD COLUMN IF NOT EXISTS project TEXT,
ADD COLUMN IF NOT EXISTS apartment TEXT,
ADD COLUMN IF NOT EXISTS observation TEXT;

-- Reload the schema cache so PostgREST recognizes the new columns instantly
NOTIFY pgrst, 'reload schema';
