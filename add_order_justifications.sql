ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS edit_justification TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_justification TEXT;
