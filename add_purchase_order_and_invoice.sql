-- SQL Migration: Vincular pedidos de materiais e serviços a Pedidos de Compra e NFs
-- Este script adiciona as colunas `purchase_order` (pedido) e `invoice_number` (NF) nas tabelas correspondentes.

-- 1. Tabela orders (Pedidos de Materiais)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS purchase_order TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- 2. Tabela service_records (Diárias e Serviços prestados) - Serviços não precisam de número de pedido, apenas Nota Fiscal
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS invoice_number TEXT;
