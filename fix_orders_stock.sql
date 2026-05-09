-- 1. Fix status constraint to include all used statuses
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('PENDING', 'APPROVED', 'AWAITING_PICKUP', 'PICKED_UP', 'AWAITING_DELIVERY', 'DELIVERED', 'RECEIVED', 'CANCELLED'));

-- 2. Add column to track if stock has been updated for this order
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_updated BOOLEAN DEFAULT FALSE;

-- 3. Update the trigger to handle stock update ONLY on RECEIVED status
CREATE OR REPLACE FUNCTION handle_order_stock_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is RECEIVED and stock hasn't been updated yet
  IF (NEW.status = 'RECEIVED' AND NEW.stock_updated = FALSE) THEN
    -- Insert movement (this will trigger update_stock_on_movement)
    INSERT INTO movements (material_id, quantity, type, responsible, area, project, service_description)
    VALUES (
      NEW.material_id, 
      NEW.quantity, 
      'IN', 
      'Sistema (Pedido ' || NEW.status || ')', 
      'Estoque', 
      NEW.project,
      'Entrada automática via Pedido #' || NEW.id
    );
    
    -- Mark as updated
    NEW.stock_updated := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-create the trigger as BEFORE UPDATE
DROP TRIGGER IF EXISTS trg_handle_order_received ON orders;
DROP TRIGGER IF EXISTS trg_handle_order_stock_update ON orders;
CREATE TRIGGER trg_handle_order_stock_update
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION handle_order_stock_update();
