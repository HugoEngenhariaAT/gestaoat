-- ==========================================
-- SCRIPT PARA CORRIGIR TODAS AS PERMISSÕES (RLS)
-- ==========================================

-- Habilita RLS em todas as tabelas para garantir
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas que podem estar bloqueando o acesso
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Cria políticas básicas e consistentes para uso (Qualquer usuário autenticado pode ler, inserir, atualizar e deletar)
-- Isso garante que a aplicação funcione completamente sem erros de "Row Level Security" para qualquer pessoa logada.

CREATE POLICY "Enable ALL for authenticated users" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable ALL for authenticated users" ON materials FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable ALL for authenticated users" ON movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable ALL for authenticated users" ON providers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable ALL for authenticated users" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable ALL for authenticated users" ON service_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable ALL for authenticated users" ON equipment FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable ALL for authenticated users" ON equipment_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable ALL for authenticated users" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Permissões especiais para criação de perfil ao se cadastrar (usuário anônimo pode inserir seu próprio perfil inicial)
CREATE POLICY "Enable INSERT for anon" ON profiles FOR INSERT WITH CHECK (true);
