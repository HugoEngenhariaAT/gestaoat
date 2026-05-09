-- Update orders status check constraint to include PICKED_UP and DELIVERED
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('PENDING', 'APPROVED', 'AWAITING_PICKUP', 'PICKED_UP', 'DELIVERED', 'RECEIVED', 'CANCELLED'));

-- Add current_responsible_id to equipment for better tracking
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS current_responsible_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Ensure equipment_movements has correct status check
ALTER TABLE equipment_movements DROP CONSTRAINT IF EXISTS equipment_movements_status_check;
ALTER TABLE equipment_movements ADD CONSTRAINT equipment_movements_status_check CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED'));
