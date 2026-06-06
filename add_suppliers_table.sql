-- Criar tabela de fornecedores
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    salesperson TEXT,
    contact TEXT,
    supplier_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
-- Todos os usuários autenticados podem ver os fornecedores
CREATE POLICY "Fornecedores são visíveis para todos os usuários"
    ON public.suppliers FOR SELECT
    USING (auth.role() = 'authenticated');

-- Apenas ADMIN e DEV podem inserir
CREATE POLICY "Apenas ADMIN e DEV podem inserir fornecedores"
    ON public.suppliers FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('ADMIN', 'DEV')
        )
    );

-- Apenas ADMIN e DEV podem atualizar
CREATE POLICY "Apenas ADMIN e DEV podem atualizar fornecedores"
    ON public.suppliers FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('ADMIN', 'DEV')
        )
    );

-- Apenas ADMIN e DEV podem deletar
CREATE POLICY "Apenas ADMIN e DEV podem deletar fornecedores"
    ON public.suppliers FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('ADMIN', 'DEV')
        )
    );
