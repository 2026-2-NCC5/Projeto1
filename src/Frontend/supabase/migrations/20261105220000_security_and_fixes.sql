-- ==============================================================================
-- MIGRATION: 20261105220000_security_and_fixes.sql
-- Projeto: App_ArregASA (FECAP)
-- Aplicação das correções de segurança, RPCs, ajustes de schema e policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RPC email_by_ra(p_ra text) - SECURITY DEFINER com busca segura de e-mail por RA
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_by_ra(p_ra text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email text;
    v_clean_ra text;
BEGIN
    v_clean_ra := trim(p_ra);
    IF v_clean_ra IS NULL OR length(v_clean_ra) = 0 THEN
        RETURN NULL;
    END IF;

    -- Busca estritamente o e-mail cadastrado em profiles para aquele RA
    SELECT email INTO v_email
    FROM public.profiles
    WHERE lower(ra) = lower(v_clean_ra)
    LIMIT 1;

    RETURN v_email;
END;
$$;

-- Restringe permissões: remove de PUBLIC e concede apenas a anon e authenticated
REVOKE ALL ON FUNCTION public.email_by_ra(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_by_ra(text) TO anon, authenticated;


-- ------------------------------------------------------------------------------
-- 2. Ajustes na tabela service_queue (Relaxar counter e adicionar colunas de aluno)
-- ------------------------------------------------------------------------------
ALTER TABLE public.service_queue ALTER COLUMN counter DROP NOT NULL;
ALTER TABLE public.service_queue ALTER COLUMN counter SET DEFAULT NULL;

ALTER TABLE public.service_queue ADD COLUMN IF NOT EXISTS student_name text;
ALTER TABLE public.service_queue ADD COLUMN IF NOT EXISTS student_ra varchar(32);
ALTER TABLE public.service_queue ADD COLUMN IF NOT EXISTS student_course varchar(255);


-- ------------------------------------------------------------------------------
-- 3. Ajustes na tabela chat_sessions e chat_messages (Avaliação e ações sugeridas)
-- ------------------------------------------------------------------------------
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS rating integer CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS feedback_comment text;
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS feedback_tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS feedback_at timestamptz;

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS suggested_action jsonb;


-- ------------------------------------------------------------------------------
-- 4. Ajustes na tabela student_requirements (Anexos estruturados de alunos e staff)
-- ------------------------------------------------------------------------------
ALTER TABLE public.student_requirements ADD COLUMN IF NOT EXISTS student_attachments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.student_requirements ADD COLUMN IF NOT EXISTS staff_attachments jsonb DEFAULT '[]'::jsonb;


-- ------------------------------------------------------------------------------
-- 5. Restrição de Unicidade em student_risk_scores (Permitir UPSERT on_conflict=student_id)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_student_risk_scores_student_id'
    ) THEN
        ALTER TABLE public.student_risk_scores
        ADD CONSTRAINT uq_student_risk_scores_student_id UNIQUE (student_id);
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 6. Configuração e Políticas de Armazenamento (Supabase Storage)
-- ------------------------------------------------------------------------------

-- Criação do bucket privado para anexos de requerimento se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-attachments', 'student-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Garante que avatars e notices-images existam como buckets públicos
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('notices-images', 'notices-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Habilita RLS em storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 6.1 Anexos de Requerimento (Privado)
-- Upload permitido apenas para usuário autenticado em sua respectiva subpasta {auth.uid()}/...
DROP POLICY IF EXISTS "Authenticated users can upload own attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload own attachments"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'student-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Leitura permitida para o próprio usuário ou para qualquer funcionário
DROP POLICY IF EXISTS "Users can read own attachments or staff read all" ON storage.objects;
CREATE POLICY "Users can read own attachments or staff read all"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'student-attachments' AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid() AND profiles.role = 'Funcionário'
            )
        )
    );

-- 6.2 Avatares (Público para leitura, escrita autenticada)
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Public can view avatars"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'avatars');

-- 6.3 Banners de Avisos (Leitura pública, upload restrito a staff)
DROP POLICY IF EXISTS "Staff can upload notices images" ON storage.objects;
CREATE POLICY "Staff can upload notices images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'notices-images' AND
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'Funcionário'
        )
    );

DROP POLICY IF EXISTS "Public can view notices images" ON storage.objects;
CREATE POLICY "Public can view notices images"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'notices-images');
