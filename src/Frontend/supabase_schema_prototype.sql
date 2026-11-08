-- ==============================================================================
-- PROTÓTIPO DE SCHEMA COMPLETO PARA O SUPABASE (PostgreSQL) - PROJETO ASA FECAP
-- ==============================================================================
-- Modelo Relacional com Chaves Primárias (PKs), Chaves Estrangeiras (FKs),
-- Índices, Triggers e Políticas de Segurança RLS (Row Level Security).
-- ==============================================================================

-- Habilita extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. TABELA DE PERFIS DE USUÁRIOS (Vinculada ao auth.users do Supabase)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    ra VARCHAR(32) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('Aluno', 'Funcionário')),
    course VARCHAR(255),
    semester VARCHAR(64),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. TABELAS DE CHAT E HISTÓRICO DE DIÁLOGOS COM O AGENTE SISA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Nova Conversa',
    role_context VARCHAR(32) NOT NULL CHECK (role_context IN ('Aluno', 'Funcionário')),
    last_message_preview TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    sender VARCHAR(16) NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
    text TEXT NOT NULL,
    quick_replies JSONB DEFAULT '[]'::jsonb,
    suggested_action JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. BASE OFICIAL DE ALUNOS (Alimentada pela pasta base_alunos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    course VARCHAR(255) NOT NULL,
    grau_academico VARCHAR(64),
    turno VARCHAR(32) DEFAULT 'Noturno',
    periodo_ingresso VARCHAR(32),
    periodo_letivo_atual VARCHAR(32),
    semestre VARCHAR(32),
    status_academico VARCHAR(64) DEFAULT 'Matriculado',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    idade INTEGER CHECK (idade >= 15 AND idade <= 100),
    bairro VARCHAR(128),
    cidade VARCHAR(128) DEFAULT 'São Paulo',
    estado VARCHAR(2) DEFAULT 'SP',
    estado_civil VARCHAR(32) DEFAULT 'Solteiro',
    sexo VARCHAR(32),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_academic_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    ano_semestre_letivo VARCHAR(16) NOT NULL,
    periodo_academico_oferta VARCHAR(32),
    disciplina VARCHAR(255) NOT NULL,
    situacao VARCHAR(64) NOT NULL, -- 'Aprovado', 'Reprovado', 'Reprovado por Falta', 'Cursando'
    nota_obtida NUMERIC(4,2),
    nota_distribuida NUMERIC(4,2) DEFAULT 10.0,
    pct_nota_obtida NUMERIC(5,2),
    pct_assiduidade NUMERIC(5,2) DEFAULT 100.0,
    pct_faltas NUMERIC(5,2) DEFAULT 0.0,
    faltas_lancadas INTEGER DEFAULT 0,
    aulas_ministradas INTEGER DEFAULT 80,
    arquivo_origem VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_financials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    periodo_letivo VARCHAR(16) NOT NULL,
    parcela INTEGER NOT NULL,
    servico_parcela VARCHAR(64), -- 'MENSALIDADE', 'REMATRICULA'
    bolsa_aluno VARCHAR(128) DEFAULT 'Nenhuma',
    valor_original NUMERIC(10,2) NOT NULL,
    status_lancamento VARCHAR(32) NOT NULL, -- 'Baixado', 'Aberto', 'Atrasado', 'Cancelado'
    data_vencimento DATE,
    data_baixa DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    codigo_atendimento BIGINT,
    tema_relacionamento VARCHAR(128),
    motivo_contato TEXT,
    motivo_evasao TEXT,
    alternativa_permanencia TEXT,
    data_atendimento TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. TABELA DE SCORES DE RISCO E MÉTRICAS (Processamento do Agente de Permanência)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    overall_risk_score INTEGER NOT NULL CHECK (overall_risk_score BETWEEN 0 AND 100),
    category VARCHAR(16) NOT NULL CHECK (category IN ('Vermelho', 'Amarelo', 'Verde')),
    temporal_trend VARCHAR(16) NOT NULL CHECK (temporal_trend IN ('Piorando', 'Estavel', 'Melhorando')),
    trend_variation VARCHAR(64),
    
    -- Scores Parciais por Dimensão (0 a 100)
    score_financeiro INTEGER NOT NULL CHECK (score_financeiro BETWEEN 0 AND 100),
    status_financeiro VARCHAR(32),
    detail_financeiro TEXT,
    
    score_academico INTEGER NOT NULL CHECK (score_academico BETWEEN 0 AND 100),
    status_academico_dim VARCHAR(32),
    detail_academico TEXT,
    
    score_relacionamento INTEGER NOT NULL CHECK (score_relacionamento BETWEEN 0 AND 100),
    status_relacionamento VARCHAR(32),
    detail_relacionamento TEXT,
    
    score_geografico INTEGER NOT NULL CHECK (score_geografico BETWEEN 0 AND 100),
    status_geografico VARCHAR(32),
    detail_geografico TEXT,
    
    explanation TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. TABELA DE DOCUMENTOS E REQUERIMENTOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    validity VARCHAR(64),
    description TEXT,
    role_target VARCHAR(32) NOT NULL CHECK (role_target IN ('Aluno', 'Funcionário', 'Todos')),
    file_url TEXT,
    auth_code_prefix VARCHAR(32) DEFAULT 'FECAP-DOC',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol VARCHAR(64) UNIQUE NOT NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(128) NOT NULL,
    current_stage VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('pending', 'in_progress', 'approved', 'rejected')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.requirement_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id UUID NOT NULL REFERENCES public.student_requirements(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT FALSE,
    step_date VARCHAR(64)
);

-- ------------------------------------------------------------------------------
-- 6. ÍNDICES DE ALTA PERFORMANCE
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_ra ON public.profiles(ra);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_students_ra ON public.students(ra);
CREATE INDEX IF NOT EXISTS idx_student_financials_student_id ON public.student_financials(student_id);
CREATE INDEX IF NOT EXISTS idx_student_academic_history_student_id ON public.student_academic_history(student_id);
CREATE INDEX IF NOT EXISTS idx_student_risk_scores_student_id ON public.student_risk_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_student_risk_scores_category ON public.student_risk_scores(category);

-- ------------------------------------------------------------------------------
-- 7. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_requirements ENABLE ROW LEVEL SECURITY;

-- Usuários só leem/alteram seus próprios perfis
CREATE POLICY "Users can manage own profile"
    ON public.profiles FOR ALL
    USING (auth.uid() = id);

-- Usuários só acessam suas próprias sessões de chat
CREATE POLICY "Users can manage own chat sessions"
    ON public.chat_sessions FOR ALL
    USING (auth.uid() = user_id);

-- Mensagens de chat acessíveis apenas se o usuário for dono da sessão
CREATE POLICY "Users can manage own chat messages"
    ON public.chat_messages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_sessions
            WHERE chat_sessions.id = chat_messages.session_id
            AND chat_sessions.user_id = auth.uid()
        )
    );

-- Funcionários têm acesso às métricas de risco de evasão
CREATE POLICY "Staff can view all student risk scores"
    ON public.student_risk_scores FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'Funcionário'
        )
    );
