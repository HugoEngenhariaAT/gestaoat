-- Script para adicionar Fio de Cobre à lista de materiais
INSERT INTO materials (name, category, unit, stock_quantity, min_stock)
VALUES ('FIO DE COBRE', 'ELÉTRICA', 'UN', 1, 0);

-- Recarrega o esquema do Supabase (opcional, mas boa prática se houver mudanças estruturais, o que não é o caso aqui)
NOTIFY pgrst, 'reload schema';
