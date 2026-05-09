-- SCRIPT DE CORREÇÃO: Sincronização do Histórico (Movements) com o Estoque (Materials)

-- Esta função pega qualquer nova entrada ou saída no histórico e atualiza a quantidade do material no estoque.
CREATE OR REPLACE FUNCTION update_stock_on_movement()
RETURNS TRIGGER AS $$
DECLARE
  current_stock DECIMAL(10,2);
BEGIN
  -- Tenta pegar o estoque atual, assumindo 0 se for Nulo
  SELECT COALESCE(stock_quantity, 0) INTO current_stock FROM materials WHERE id = NEW.material_id;

  IF (NEW.type = 'IN') THEN
    UPDATE materials 
    SET stock_quantity = current_stock + COALESCE(NEW.quantity, 0)
    WHERE id = NEW.material_id;
    
  ELSIF (NEW.type = 'OUT') THEN
    -- Não impede que a quantidade fique negativa se for um erro de contagem, 
    -- apenas atualiza o saldo real físico relatado pela saída.
    UPDATE materials 
    SET stock_quantity = current_stock - COALESCE(NEW.quantity, 0)
    WHERE id = NEW.material_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove qualquer gatilho defeituoso anterior
DROP TRIGGER IF EXISTS trg_update_stock_on_movement ON movements;

-- Recria o gatilho para ele rodar sempre APÓS o histórico gravar um registro de movimentação
CREATE TRIGGER trg_update_stock_on_movement
AFTER INSERT ON movements
FOR EACH ROW
EXECUTE FUNCTION update_stock_on_movement();

-- Recarrega a memória de cachê do Supabase para ter certeza de que o novo gatilho entra em uso
NOTIFY pgrst, 'reload schema';

-------------------------------------------------------------------------
-- ATENÇÃO, COMANDO OPCIONAL (Remova os -- da query abaixo se quiser forçar o recálculo)
-- Essa query recalcula todo o saldo atual dos materiais baseado puramente em TODOS
-- os históricos da tabela movements (soma de Entradas - soma de Saídas)
-- 
-- WITH calculated_stock AS (
--   SELECT 
--     material_id,
--     SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END) - 
--     SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END) as real_stock
--   FROM movements
--   GROUP BY material_id
-- )
-- UPDATE materials m
-- SET stock_quantity = c.real_stock
-- FROM calculated_stock c
-- WHERE m.id = c.material_id;
-------------------------------------------------------------------------
