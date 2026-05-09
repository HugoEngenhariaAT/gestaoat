-- SCRIPT DE CORREÇÃO: Permissão para confirmar recebimento de equipamentos
-- Esse script adiciona a permissão que faltava (UPDATE) para que os usuários 
-- consigam confirmar que receberam o equipamento e finalizar a transferência.

-- Garante que a tabela tem segurança a nível de linha ativada
ALTER TABLE equipment_movements ENABLE ROW LEVEL SECURITY;

-- Remove política caso já exista com esse nome específico
DROP POLICY IF EXISTS "All users can update equipment movements" ON equipment_movements;

-- Cria a política permitindo que usuários autenticados possam atualizar a movimentação (confirmar recebimento)
CREATE POLICY "All users can update equipment movements" 
ON equipment_movements 
FOR UPDATE 
TO authenticated 
USING (true);

-- Recarrega o esquema do Supabase
NOTIFY pgrst, 'reload schema';
