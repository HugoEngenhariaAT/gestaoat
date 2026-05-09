-- SCRIPT DE CORREÇÃO FINAL: Gatilho de Estoque (Correção de Valor Nulo)

-- Muitas vezes os pedidos criados antes da coluna 'stock_updated' existir ficam com ela nula.
-- O SQL comum (stock_updated = FALSE) ignora os "nulos". Vamos corrigir usando "IS NOT TRUE"

CREATE OR REPLACE FUNCTION handle_order_stock_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Confere se o order mudou para RECEIVED e o estoque ainda não entrou
  -- "IS NOT TRUE" garante que aceite FALSE e também aceite NULL (pedidos velhos)
  IF (NEW.status = 'RECEIVED' AND NEW.stock_updated IS NOT TRUE) THEN
    -- Realiza a entrada manual no histórico (isso chama a atualização da quantidade do material)
    INSERT INTO movements (material_id, quantity, type, responsible, area, project, service_description)
    VALUES (
      NEW.material_id, 
      NEW.quantity, 
      'IN', 
      'Sistema (Entrada Aut. Pedido)', 
      COALESCE(NEW.for_stock::text, 'Estoque'), 
      COALESCE(NEW.project, 'Estoque Central'),
      'Movimentação criada pelo recebimento do pedido #' || NEW.id
    );
    
    -- Marca o pedido para não entrar de novo!
    NEW.stock_updated := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Opcional para forçar os pedidos antigos que estão 'RECEIVED' a atualizarem os estoques:
-- Se o status JÁ ESTÁ "RECEIVED", eles precisam ser repassados para que o Trigger pegue!
UPDATE orders 
SET status = 'RECEIVED' 
WHERE status = 'RECEIVED' AND stock_updated IS NOT TRUE;

-- Recarrega o cache para garantir
NOTIFY pgrst, 'reload schema';
