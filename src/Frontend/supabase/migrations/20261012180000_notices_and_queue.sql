-- ==============================================================================
-- MIGRAÇÃO ASA FECAP: MURAL DE AVISOS, FILA DE ATENDIMENTO E POLÍTICAS RLS
-- ==============================================================================

-- 1. TABELA DE MURAL DE AVISOS E COMUNICADOS (Para Alunos e Comunidade)
CREATE TABLE IF NOT EXISTS public.notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'Geral', -- 'Geral', 'Acadêmico', 'Financeiro', 'Carreira', 'Eventos'
    summary TEXT NOT NULL,
    content TEXT,
    badge VARCHAR(64) DEFAULT 'Novo',
    image_url TEXT,
    author VARCHAR(128) DEFAULT 'Secretaria ASA FECAP',
    target_audience VARCHAR(32) NOT NULL DEFAULT 'Todos', -- 'Todos', 'Aluno', 'Funcionário'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para Notices
CREATE INDEX IF NOT EXISTS idx_notices_is_active ON public.notices(is_active);
CREATE INDEX IF NOT EXISTS idx_notices_target_audience ON public.notices(target_audience);
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON public.notices(created_at DESC);

-- 2. TABELA DE FILA E SENHAS DE ATENDIMENTO PRESENCIAL (Painel Físico ASA)
CREATE TABLE IF NOT EXISTS public.service_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(32) NOT NULL, -- Ex: 'A042', 'P015', 'F028'
    service_type VARCHAR(64) NOT NULL DEFAULT 'Geral', -- 'Geral', 'Prioritário', 'Financeiro', 'Secretaria'
    counter VARCHAR(32) NOT NULL DEFAULT 'Guichê 01',
    status VARCHAR(32) NOT NULL DEFAULT 'waiting', -- 'waiting', 'called', 'in_service', 'completed', 'cancelled'
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    called_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para Fila
CREATE INDEX IF NOT EXISTS idx_service_queue_status ON public.service_queue(status);
CREATE INDEX IF NOT EXISTS idx_service_queue_created_at ON public.service_queue(created_at DESC);

-- 3. HABILITAÇÃO DE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS RLS PERMISSIVAS PARA VISUALIZAÇÃO
-- Avisos: Leitura pública para todos os perfis
DROP POLICY IF EXISTS "Allow public read notices" ON public.notices;
CREATE POLICY "Allow public read notices"
    ON public.notices FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Allow staff manage notices" ON public.notices;
CREATE POLICY "Allow staff manage notices"
    ON public.notices FOR ALL
    USING (true);

-- Fila Presencial: Leitura pública do painel de senhas
DROP POLICY IF EXISTS "Allow public read service_queue" ON public.service_queue;
CREATE POLICY "Allow public read service_queue"
    ON public.service_queue FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow manage service_queue" ON public.service_queue;
CREATE POLICY "Allow manage service_queue"
    ON public.service_queue FOR ALL
    USING (true);

-- Documentos: Leitura para todos os usuários
DROP POLICY IF EXISTS "Allow public read documents" ON public.documents;
CREATE POLICY "Allow public read documents"
    ON public.documents FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow manage documents" ON public.documents;
CREATE POLICY "Allow manage documents"
    ON public.documents FOR ALL
    USING (true);

-- Alunos: Leitura para usuários autenticados e anon (para o app listar com anon key)
DROP POLICY IF EXISTS "Allow read students" ON public.students;
CREATE POLICY "Allow read students"
    ON public.students FOR SELECT
    USING (true);

-- Requerimentos: Leitura pública/autenticada
DROP POLICY IF EXISTS "Allow read requirements" ON public.student_requirements;
CREATE POLICY "Allow read requirements"
    ON public.student_requirements FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow read requirement steps" ON public.requirement_steps;
CREATE POLICY "Allow read requirement steps"
    ON public.requirement_steps FOR SELECT
    USING (true);

-- 5. REALTIME (Ativação para reatividade instantânea no App e Painel)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'service_queue'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.service_queue;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notices'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
    END IF;
END $$;
