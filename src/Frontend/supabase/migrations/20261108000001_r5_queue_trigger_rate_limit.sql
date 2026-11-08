-- ==============================================================================
-- MIGRATION: 20261108000001_r5_queue_trigger_rate_limit.sql
-- Rodada 5 — Item 3 (signup_rate_limits) + Item 4 (assign_ticket_number trigger)
-- Projeto: App_ArregASA (FECAP)
-- RODAR MANUALMENTE no painel SQL do Supabase.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Item 3: Tabela de rate limit para Edge Function validate-and-register-student
-- Substitui o in-memory Map (que reseta em cada cold start da Edge Function)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.signup_rate_limits (
  key           text        PRIMARY KEY,
  attempts      integer     NOT NULL DEFAULT 1,
  window_start  timestamptz NOT NULL DEFAULT now()
);

-- Apenas a service_role pode escrever (Edge Function usa SUPABASE_SERVICE_ROLE_KEY)
-- Nenhum usuário autenticado pode ler/alterar
ALTER TABLE public.signup_rate_limits ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy = tabela fechada para authenticated/anon (somente service_role acessa)
-- Sem necessidade de policy explícita: service_role bypassa RLS por padrão

-- Índice opcional para TTL cleanup futuro
CREATE INDEX IF NOT EXISTS idx_signup_rate_limits_window
  ON public.signup_rate_limits (window_start);

-- Limpeza automática de registros expirados (manter tabela pequena)
-- Crie um pg_cron job ou chame manualmente:
-- DELETE FROM public.signup_rate_limits WHERE window_start < now() - interval '1 hour';


-- ------------------------------------------------------------------------------
-- Item 4: Coluna ticket_prefix + trigger assign_ticket_number em service_queue
-- O cliente envia apenas ticket_prefix ('A' ou 'P').
-- O trigger preenche ticket_number = prefix + número sequencial do dia (3 dígitos).
-- ------------------------------------------------------------------------------

-- 4a. Adiciona coluna ticket_prefix (se não existir)
ALTER TABLE public.service_queue
  ADD COLUMN IF NOT EXISTS ticket_prefix text NOT NULL DEFAULT 'A'
    CHECK (ticket_prefix IN ('A', 'P', 'F', 'G'));
  -- 'A' = Atendimento Geral, 'P' = Presencial/Prioritário, 'F' = Financeiro, 'G' = Graduação

-- 4b. Função do trigger
CREATE OR REPLACE FUNCTION public.assign_ticket_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix  text;
  v_seq     integer;
BEGIN
  -- Usa o prefixo enviado pelo cliente (ou 'A' como fallback)
  v_prefix := COALESCE(NULLIF(TRIM(NEW.ticket_prefix), ''), 'A');

  -- Número sequencial dentro do dia corrente para este prefixo
  SELECT COALESCE(MAX(
    CAST(
      -- Extrai apenas os dígitos após o prefixo. Ex: 'A007' → 7
      SUBSTRING(ticket_number FROM LENGTH(v_prefix) + 1)
    AS integer)
  ), 0) + 1
  INTO v_seq
  FROM public.service_queue
  WHERE
    DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
    AND ticket_number LIKE v_prefix || '%'
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  NEW.ticket_number := v_prefix || LPAD(v_seq::text, 3, '0');
  RETURN NEW;
END;
$$;

-- 4c. Cria o trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trg_assign_ticket_number ON public.service_queue;
CREATE TRIGGER trg_assign_ticket_number
  BEFORE INSERT ON public.service_queue
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL OR TRIM(NEW.ticket_number) = '')
  EXECUTE FUNCTION public.assign_ticket_number();

-- 4d. Permissões
GRANT EXECUTE ON FUNCTION public.assign_ticket_number() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- Item 4 extra: RLS em service_queue (aluno lê somente a própria senha)
-- (Certifique-se de que RLS está habilitada na tabela service_queue)
-- ------------------------------------------------------------------------------
ALTER TABLE public.service_queue ENABLE ROW LEVEL SECURITY;

-- Aluno autenticado vê apenas senhas com student_ra = seu RA no perfil
DROP POLICY IF EXISTS "student_read_own_ticket" ON public.service_queue;
CREATE POLICY "student_read_own_ticket"
  ON public.service_queue
  FOR SELECT
  TO authenticated
  USING (
    student_ra = (
      SELECT ra FROM public.profiles WHERE id = auth.uid() LIMIT 1
    )
    OR
    -- Staff e admin veem tudo
    (
      SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1
    ) IN ('Funcionário', 'Funcionario', 'Admin', 'Administrador')
  );

-- Staff pode UPDATE (chamar senha, etc.)
DROP POLICY IF EXISTS "staff_update_ticket" ON public.service_queue;
CREATE POLICY "staff_update_ticket"
  ON public.service_queue
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    IN ('Funcionário', 'Funcionario', 'Admin', 'Administrador')
  );

-- Qualquer autenticado pode inserir própria senha
DROP POLICY IF EXISTS "authenticated_insert_ticket" ON public.service_queue;
CREATE POLICY "authenticated_insert_ticket"
  ON public.service_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- Verificação de sanidade após a migration
-- Execute para confirmar:
-- SELECT trigger_name, event_manipulation, event_object_table
--   FROM information_schema.triggers
--   WHERE trigger_name = 'trg_assign_ticket_number';
--
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'service_queue' AND column_name = 'ticket_prefix';
--
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE tablename = 'signup_rate_limits';
-- ------------------------------------------------------------------------------


-- ------------------------------------------------------------------------------
-- Item 10 (OPÇÃO A): Sincronização automática profiles -> student_contacts
-- Se você optar pelo Design A (Trigger no banco), execute este bloco:
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_to_student_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
BEGIN
  -- Localiza o student correspondente ao profile
  SELECT id INTO v_student_id FROM public.students WHERE profile_id = NEW.id LIMIT 1;

  IF v_student_id IS NOT NULL AND (NEW.neighborhood IS NOT NULL OR NEW.city IS NOT NULL) THEN
    -- Upsert na tabela student_contacts
    INSERT INTO public.student_contacts (
      id,
      student_id,
      bairro,
      cidade,
      estado,
      cep,
      telefone,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_student_id,
      NEW.neighborhood,
      NEW.city,
      NEW.state,
      NEW.cep,
      NEW.phone,
      now()
    )
    ON CONFLICT (student_id) DO UPDATE SET
      bairro = EXCLUDED.bairro,
      cidade = EXCLUDED.cidade,
      estado = EXCLUDED.estado,
      cep = EXCLUDED.cep,
      telefone = COALESCE(EXCLUDED.telefone, student_contacts.telefone),
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_student_contacts ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_student_contacts
  AFTER INSERT OR UPDATE OF neighborhood, city, state, cep, phone ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_student_contacts();
