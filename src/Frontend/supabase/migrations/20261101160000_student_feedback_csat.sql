-- ==============================================================================
-- Migração: Suporte a Avaliação de Satisfação Estudantil (CSAT / NPS)
-- Arquivo: supabase/migrations/20261101160000_student_feedback_csat.sql
-- ==============================================================================

-- 1. Extensão de colunas na tabela chat_sessions para persistência direta de CSAT
ALTER TABLE IF EXISTS public.chat_sessions 
    ADD COLUMN IF NOT EXISTS rating INT CHECK (rating >= 1 AND rating <= 5),
    ADD COLUMN IF NOT EXISTS feedback_comment TEXT,
    ADD COLUMN IF NOT EXISTS feedback_tags JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ;

-- 2. Extensão de colunas na tabela student_requirements para avaliação pós-atendimento
ALTER TABLE IF EXISTS public.student_requirements
    ADD COLUMN IF NOT EXISTS rating INT CHECK (rating >= 1 AND rating <= 5),
    ADD COLUMN IF NOT EXISTS feedback_comment TEXT,
    ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ;

-- 3. Índices para consultas analíticas de alta performance no Web e Mobile
CREATE INDEX IF NOT EXISTS idx_chat_sessions_rating ON public.chat_sessions(rating) WHERE rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_requirements_rating ON public.student_requirements(rating) WHERE rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_role ON public.chat_messages(sender_role);

-- 4. Notificação de realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;
END $$;
