-- ==============================================================================
-- Migração Completa: Políticas RLS, Chat ao Vivo, Linha do Tempo e Tabelas Estudantis
-- Arquivo: supabase/migrations/20261028120000_realtime_chat_and_full_student_schema.sql
-- ==============================================================================

-- 1. EXTENSÃO DAS COLUNAS DE CHAT PARA ATENDIMENTO HUMANO AO VIVO
ALTER TABLE IF EXISTS public.chat_sessions 
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'ai_active',
    ADD COLUMN IF NOT EXISTS student_id TEXT,
    ADD COLUMN IF NOT EXISTS student_name TEXT,
    ADD COLUMN IF NOT EXISTS student_ra TEXT,
    ADD COLUMN IF NOT EXISTS assigned_staff_id TEXT,
    ADD COLUMN IF NOT EXISTS assigned_staff_name TEXT,
    ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Aluno';

ALTER TABLE IF EXISTS public.chat_messages 
    ADD COLUMN IF NOT EXISTS sender_name TEXT,
    ADD COLUMN IF NOT EXISTS sender_role TEXT,
    ADD COLUMN IF NOT EXISTS is_human BOOLEAN DEFAULT FALSE;

-- 2. EXTENSÃO DA LINHA DO TEMPO DE REQUERIMENTOS (STEPS)
ALTER TABLE IF EXISTS public.requirement_steps 
    ADD COLUMN IF NOT EXISTS author_name TEXT,
    ADD COLUMN IF NOT EXISTS author_role TEXT,
    ADD COLUMN IF NOT EXISTS stage TEXT,
    ADD COLUMN IF NOT EXISTS date TEXT;

ALTER TABLE IF EXISTS public.student_requirements
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS student_attachments JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS staff_attachments JSONB DEFAULT '[]'::jsonb;

-- 3. POLÍTICAS DE ROW LEVEL SECURITY (RLS) - PERMISSÕES COMPLETAS DE LEITURA, INSERÇÃO, ATUALIZAÇÃO E EXCLUSÃO
-- student_requirements
ALTER TABLE IF EXISTS public.student_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select requirements" ON public.student_requirements;
DROP POLICY IF EXISTS "Allow insert requirements" ON public.student_requirements;
DROP POLICY IF EXISTS "Allow update requirements" ON public.student_requirements;
DROP POLICY IF EXISTS "Allow delete requirements" ON public.student_requirements;

CREATE POLICY "Allow select requirements" ON public.student_requirements FOR SELECT USING (true);
CREATE POLICY "Allow insert requirements" ON public.student_requirements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update requirements" ON public.student_requirements FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete requirements" ON public.student_requirements FOR DELETE USING (true);

-- requirement_steps
ALTER TABLE IF EXISTS public.requirement_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select requirement steps" ON public.requirement_steps;
DROP POLICY IF EXISTS "Allow insert requirement steps" ON public.requirement_steps;
DROP POLICY IF EXISTS "Allow update requirement steps" ON public.requirement_steps;
DROP POLICY IF EXISTS "Allow delete requirement steps" ON public.requirement_steps;

CREATE POLICY "Allow select requirement steps" ON public.requirement_steps FOR SELECT USING (true);
CREATE POLICY "Allow insert requirement steps" ON public.requirement_steps FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update requirement steps" ON public.requirement_steps FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete requirement steps" ON public.requirement_steps FOR DELETE USING (true);

-- chat_sessions
ALTER TABLE IF EXISTS public.chat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow insert chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow update chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow delete chat_sessions" ON public.chat_sessions;

CREATE POLICY "Allow select chat_sessions" ON public.chat_sessions FOR SELECT USING (true);
CREATE POLICY "Allow insert chat_sessions" ON public.chat_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update chat_sessions" ON public.chat_sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete chat_sessions" ON public.chat_sessions FOR DELETE USING (true);

-- chat_messages
ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow insert chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow update chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow delete chat_messages" ON public.chat_messages;

CREATE POLICY "Allow select chat_messages" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Allow insert chat_messages" ON public.chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update chat_messages" ON public.chat_messages FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete chat_messages" ON public.chat_messages FOR DELETE USING (true);

-- profiles
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow delete profiles" ON public.profiles;

CREATE POLICY "Allow select profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update profiles" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete profiles" ON public.profiles FOR DELETE USING (true);

-- students
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select students" ON public.students;
DROP POLICY IF EXISTS "Allow insert students" ON public.students;
DROP POLICY IF EXISTS "Allow update students" ON public.students;
DROP POLICY IF EXISTS "Allow delete students" ON public.students;

CREATE POLICY "Allow select students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow insert students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update students" ON public.students FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete students" ON public.students FOR DELETE USING (true);

-- student_contacts
ALTER TABLE IF EXISTS public.student_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select student_contacts" ON public.student_contacts;
DROP POLICY IF EXISTS "Allow insert student_contacts" ON public.student_contacts;
DROP POLICY IF EXISTS "Allow update student_contacts" ON public.student_contacts;

CREATE POLICY "Allow select student_contacts" ON public.student_contacts FOR SELECT USING (true);
CREATE POLICY "Allow insert student_contacts" ON public.student_contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update student_contacts" ON public.student_contacts FOR UPDATE USING (true) WITH CHECK (true);

-- student_academic_history
ALTER TABLE IF EXISTS public.student_academic_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select student_academic_history" ON public.student_academic_history;
DROP POLICY IF EXISTS "Allow insert student_academic_history" ON public.student_academic_history;
DROP POLICY IF EXISTS "Allow update student_academic_history" ON public.student_academic_history;

CREATE POLICY "Allow select student_academic_history" ON public.student_academic_history FOR SELECT USING (true);
CREATE POLICY "Allow insert student_academic_history" ON public.student_academic_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update student_academic_history" ON public.student_academic_history FOR UPDATE USING (true) WITH CHECK (true);

-- student_relationships
ALTER TABLE IF EXISTS public.student_relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select student_relationships" ON public.student_relationships;
DROP POLICY IF EXISTS "Allow insert student_relationships" ON public.student_relationships;
DROP POLICY IF EXISTS "Allow update student_relationships" ON public.student_relationships;

CREATE POLICY "Allow select student_relationships" ON public.student_relationships FOR SELECT USING (true);
CREATE POLICY "Allow insert student_relationships" ON public.student_relationships FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update student_relationships" ON public.student_relationships FOR UPDATE USING (true) WITH CHECK (true);

-- student_financials
ALTER TABLE IF EXISTS public.student_financials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select student_financials" ON public.student_financials;
DROP POLICY IF EXISTS "Allow insert student_financials" ON public.student_financials;
DROP POLICY IF EXISTS "Allow update student_financials" ON public.student_financials;

CREATE POLICY "Allow select student_financials" ON public.student_financials FOR SELECT USING (true);
CREATE POLICY "Allow insert student_financials" ON public.student_financials FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update student_financials" ON public.student_financials FOR UPDATE USING (true) WITH CHECK (true);

-- 4. ATIVAÇÃO DE REALTIME NAS TABELAS ESSENCIAIS
DO $$
BEGIN
    -- Requerimentos e Timeline
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'student_requirements') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.student_requirements;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'requirement_steps') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.requirement_steps;
    END IF;

    -- Chat ao Vivo e Sessões
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_sessions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;

    -- Avisos e Fila CAA
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notices') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'service_queue') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.service_queue;
    END IF;
END $$;
