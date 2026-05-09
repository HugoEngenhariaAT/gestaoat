-- Update orders status check constraint to include new statuses
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('PENDING', 'APPROVED', 'AWAITING_PICKUP', 'PICKED_UP', 'AWAITING_DELIVERY', 'DELIVERED', 'RECEIVED', 'CANCELLED'));

-- Add delivered_to_name column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_to_name TEXT;
