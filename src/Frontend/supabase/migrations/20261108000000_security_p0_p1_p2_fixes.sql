-- ==============================================================================
-- MIGRATION: 20261108000000_security_p0_p1_p2_fixes.sql
-- Projeto: App_ArregASA (FECAP)
-- Autor: Engenharia de Software / Arquitetura de Dados
-- Objetivo:
-- 1. View public.queue_board (anônima, sem exposição de nome/RA dos alunos)
-- 2. RPC expire_outdated_tickets()
-- 3. RPC link_student_after_verification()
-- 4. RPC cancel_requirement(p_requirement_id text, p_reason text)
-- 5. RPC rate_requirement(p_id uuid, p_rating integer, p_comment text)
-- 6. Adição de 'Cancelado' ao status de student_requirements (se enum existir)
-- 7. Bucket privado student-attachments e RLS policies por pasta
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. VIEW public.queue_board (Visualização da fila pelo estudante sem expor outros alunos)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.queue_board AS
SELECT
    id,
    ticket_number,
    service_type,
    counter,
    status,
    called_at,
    created_at,
    updated_at
FROM public.service_queue
WHERE status IN ('waiting', 'called', 'in_service');

-- Permissões na view
GRANT SELECT ON public.queue_board TO anon, authenticated;


-- ------------------------------------------------------------------------------
-- 2. RPC public.expire_outdated_tickets()
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_outdated_tickets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now_sp timestamp with time zone;
    v_dow integer;
    v_time time;
    v_today date;
BEGIN
    v_now_sp := NOW() AT TIME ZONE 'America/Sao_Paulo';
    v_dow := EXTRACT(DOW FROM v_now_sp); -- 0 = Domingo, 1-5 = Seg-Sex, 6 = Sábado
    v_time := v_now_sp::time;
    v_today := v_now_sp::date;

    -- Expira senhas ativas que:
    -- a) Foram criadas em data anterior (redefinição diária de senhas)
    -- b) Domingo (sem expediente presencial)
    -- c) Sábado após 12h30
    -- d) Segunda a Sexta após 21h00
    UPDATE public.service_queue
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('waiting', 'called', 'in_service')
      AND (
          (created_at AT TIME ZONE 'America/Sao_Paulo')::date < v_today
          OR v_dow = 0
          OR (v_dow = 6 AND v_time >= '12:30:00'::time)
          OR (v_dow BETWEEN 1 AND 5 AND v_time >= '21:00:00'::time)
      );
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_outdated_tickets() TO anon, authenticated;


-- ------------------------------------------------------------------------------
-- 3. RPC public.link_student_after_verification()
-- Vincula com segurança o profile_id na tabela students após confirmação de OTP
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_student_after_verification()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_ra text;
    v_student_id uuid;
    v_student_name text;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sessão não autenticada');
    END IF;

    -- Obtém o RA registrado no profile do usuário autenticado
    SELECT ra INTO v_ra FROM public.profiles WHERE id = v_uid;
    IF v_ra IS NULL OR length(trim(v_ra)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'RA não encontrado no perfil');
    END IF;

    -- Atualiza profile_id na tabela students
    UPDATE public.students
    SET profile_id = v_uid, updated_at = NOW()
    WHERE lower(trim(ra)) = lower(trim(v_ra))
    RETURNING id, name INTO v_student_id, v_student_name;

    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Aluno com este RA não encontrado na base institucional');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'student_id', v_student_id,
        'student_name', v_student_name,
        'ra', v_ra,
        'profile_id', v_uid
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_student_after_verification() TO authenticated;


-- ------------------------------------------------------------------------------
-- 4. AJUSTE DE STATUS EM student_requirements (Adicionar 'Cancelado' se for enum)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- Se o tipo existir como enum no PostgreSQL, adiciona 'Cancelado'
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'requirement_status') THEN
        BEGIN
            ALTER TYPE public.requirement_status ADD VALUE IF NOT EXISTS 'Cancelado';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 5. RPC public.cancel_requirement(p_requirement_id uuid, p_reason text)
-- Cancelamento atômico e autorizado de requerimento (tipo uuid estrito)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_requirement(
    p_requirement_id uuid,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text;
    v_student_id uuid;
    v_caller_student_id uuid;
    v_current_status text;
    v_now timestamptz := NOW();
    v_step_order integer;
    v_caller_name text;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
    END IF;

    -- Obtém o perfil e papel do solicitante
    SELECT role, name INTO v_role, v_caller_name FROM public.profiles WHERE id = v_uid;

    -- Localiza o id do estudante vinculado a este usuário
    SELECT id INTO v_caller_student_id FROM public.students WHERE profile_id = v_uid LIMIT 1;

    -- Seleciona dados do requerimento
    SELECT student_id, status::text INTO v_student_id, v_current_status
    FROM public.student_requirements
    WHERE id = p_requirement_id;

    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Requerimento não encontrado');
    END IF;

    -- Validação de permissão: ou é o aluno titular ou é Staff
    IF v_role <> 'Funcionário' AND (v_caller_student_id IS NULL OR v_student_id <> v_caller_student_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permissão negada: você só pode cancelar seus próprios requerimentos');
    END IF;

    -- Impede cancelamento de processo já finalizado (Item 9)
    IF lower(v_current_status) IN ('aprovado', 'rejeitado', 'cancelado', 'concluído', 'concluido', 'indeferido') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Requerimento já encerrado ou finalizado, não pode ser cancelado');
    END IF;

    -- Atualiza status e justificativa (com fallback seguro caso 'Cancelado' não conste no enum)
    BEGIN
        UPDATE public.student_requirements
        SET
            status = 'Cancelado',
            current_stage = 'Cancelado pelo Aluno',
            cancellation_reason = p_reason,
            updated_at = v_now
        WHERE id = p_requirement_id;
    EXCEPTION WHEN OTHERS THEN
        UPDATE public.student_requirements
        SET
            status = 'Rejeitado',
            current_stage = 'Cancelado pelo Aluno',
            cancellation_reason = p_reason,
            updated_at = v_now
        WHERE id = p_requirement_id;
    END;

    -- Atualiza etapas anteriores para inativas
    UPDATE public.requirement_steps
    SET active = false
    WHERE requirement_id = p_requirement_id;

    -- Determina próximo order_index
    SELECT COALESCE(MAX(order_index), 1) + 1 INTO v_step_order
    FROM public.requirement_steps
    WHERE requirement_id = p_requirement_id;

    -- Insere a etapa de cancelamento na linha do tempo
    INSERT INTO public.requirement_steps (
        id,
        requirement_id,
        order_index,
        title,
        description,
        completed,
        active,
        step_date
    ) VALUES (
        gen_random_uuid(),
        p_requirement_id,
        v_step_order,
        'Cancelado pelo Aluno',
        COALESCE(p_reason, 'Cancelamento solicitado pelo estudante.'),
        true,
        false,
        v_now
    );

    RETURN jsonb_build_object('success', true, 'requirement_id', p_requirement_id, 'status', 'Cancelado');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_requirement(uuid, text) TO authenticated;


-- ------------------------------------------------------------------------------
-- 6. RPC public.rate_requirement(p_id uuid, p_rating integer, p_comment text)
-- Avaliação CSAT/NPS do requerimento pelo aluno
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rate_requirement(
    p_id uuid,
    p_rating integer,
    p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_student_id uuid;
    v_caller_student_id uuid;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
    END IF;

    IF p_rating < 1 OR p_rating > 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nota deve estar entre 1 e 5');
    END IF;

    -- Localiza o id do estudante autenticado
    SELECT id INTO v_caller_student_id FROM public.students WHERE profile_id = v_uid LIMIT 1;

    -- Seleciona o estudante do requerimento
    SELECT student_id INTO v_student_id FROM public.student_requirements WHERE id = p_id;

    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Requerimento não encontrado');
    END IF;

    IF v_caller_student_id IS NULL OR v_student_id <> v_caller_student_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o aluno titular pode avaliar o requerimento');
    END IF;

    -- Adiciona colunas se não existirem dinamicamente
    BEGIN
        ALTER TABLE public.student_requirements ADD COLUMN IF NOT EXISTS rating integer;
        ALTER TABLE public.student_requirements ADD COLUMN IF NOT EXISTS rating_comment text;
        ALTER TABLE public.student_requirements ADD COLUMN IF NOT EXISTS rated_at timestamptz;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    UPDATE public.student_requirements
    SET
        rating = p_rating,
        rating_comment = p_comment,
        rated_at = NOW(),
        updated_at = NOW()
    WHERE id = p_id;

    RETURN jsonb_build_object('success', true, 'requirement_id', p_id, 'rating', p_rating);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rate_requirement(uuid, integer, text) TO authenticated;


-- ------------------------------------------------------------------------------
-- 7. BUCKET PRIVADO student-attachments E POLICIES POR PASTA
-- ------------------------------------------------------------------------------

-- Garante existência do bucket privado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-attachments',
    'student-attachments',
    false,
    10485760, -- 10 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas para evitar duplicidade
DROP POLICY IF EXISTS "Aluno upload own student-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Staff upload student-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Aluno read own student-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Staff read all student-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Aluno delete own student-attachments" ON storage.objects;

-- Regra de Upload do Aluno: Apenas na pasta com seu próprio profileId
-- Caminho do aluno: `${profileId}/${protocolo}/${ts}_${nome}`
CREATE POLICY "Aluno upload own student-attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'student-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Regra de Upload do Staff: Na subpasta 'staff' do profile do aluno
-- Caminho do staff: `${profile_id_do_aluno}/staff/${ts}_${nome}`
CREATE POLICY "Staff upload student-attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'student-attachments'
    AND (storage.foldername(name))[2] = 'staff'
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Funcionário'
    )
);

-- Regra de Leitura do Aluno: Pode ler qualquer arquivo na raiz do seu profileId (inclusive anexos colocados pelo staff em /staff/)
CREATE POLICY "Aluno read own student-attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'student-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Regra de Leitura do Staff: Funcionários podem ler todos os arquivos em student-attachments
CREATE POLICY "Staff read all student-attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'student-attachments'
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Funcionário'
    )
);

-- Regra de Deleção: Aluno só deleta seus próprios arquivos (não da pasta /staff/)
CREATE POLICY "Aluno delete own student-attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'student-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (storage.foldername(name))[2] <> 'staff'
);

-- Regra de Deleção Staff: Funcionário pode deletar
CREATE POLICY "Staff delete student-attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'student-attachments'
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Funcionário'
    )
);
