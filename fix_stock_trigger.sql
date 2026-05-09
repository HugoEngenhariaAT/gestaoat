-- SCRIPT DE CORREÇÃO: Atualização de Estoque Automática

-- 1. Certifique-se de que a coluna stock_updated existe na tabela orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_updated BOOLEAN DEFAULT FALSE;

-- 2. Corrija o Constraint de Status caso esteja restrito
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('PENDING', 'APPROVED', 'AWAITING_PICKUP', 'PICKED_UP', 'AWAITING_DELIVERY', 'DELIVERED', 'RECEIVED', 'CANCELLED'));

-- 3. Atualize ou crie a Função do Trigger que faz a entrada no estoque
CREATE OR REPLACE FUNCTION handle_order_stock_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status mudou para RECEIVED e o estoque ainda não foi atualizado
  IF (NEW.status = 'RECEIVED' AND NEW.stock_updated = FALSE) THEN
    -- Insere na tabela 'movements' (Isso vai disparar outro gatilho que atualiza o material)
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
    
    -- Marca o pedido como atualizado para não duplicar entrada
    NEW.stock_updated := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Recrie o Trigger para atirar *antes* de finalizar o Update do Pedido
DROP TRIGGER IF EXISTS trg_handle_order_received ON orders;
DROP TRIGGER IF EXISTS trg_handle_order_stock_update ON orders;

CREATE TRIGGER trg_handle_order_stock_update
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION handle_order_stock_update();

-- 5. Atualizar o cache do PostgREST
NOTIFY pgrst, 'reload schema';
