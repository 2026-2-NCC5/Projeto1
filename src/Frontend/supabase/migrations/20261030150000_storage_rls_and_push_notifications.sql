-- ============================================================================
-- MIGRAÇÃO: Políticas RLS de Storage (Upload de Imagens/Anexos), Push Tokens,
-- Persistência de Notificações Lidas e Realtime Integral
-- Execute este script no SQL Editor do Supabase Dashboard.
-- ============================================================================

-- 1. Garantir que os buckets públicos existam sem restrição indevida de MIME/tamanho
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('notices-images', 'notices-images', true, 52428800, NULL),
  ('avatars', 'avatars', true, 52428800, NULL),
  ('requerimentos-anexos', 'requerimentos-anexos', true, 52428800, NULL),
  ('documentos-asa', 'documentos-asa', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = NULL;

-- 2. Políticas RLS em storage.objects para permitir leitura, upload, atualização e remoção
-- pelos perfis Aluno e Funcionário (roles anon e authenticated via TO public)
DROP POLICY IF EXISTS "ASA Public Storage Select" ON storage.objects;
CREATE POLICY "ASA Public Storage Select"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id IN ('notices-images', 'avatars', 'requerimentos-anexos', 'documentos-asa'));

DROP POLICY IF EXISTS "ASA Public Storage Insert" ON storage.objects;
CREATE POLICY "ASA Public Storage Insert"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id IN ('notices-images', 'avatars', 'requerimentos-anexos', 'documentos-asa'));

DROP POLICY IF EXISTS "ASA Public Storage Update" ON storage.objects;
CREATE POLICY "ASA Public Storage Update"
  ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id IN ('notices-images', 'avatars', 'requerimentos-anexos', 'documentos-asa'))
  WITH CHECK (bucket_id IN ('notices-images', 'avatars', 'requerimentos-anexos', 'documentos-asa'));

DROP POLICY IF EXISTS "ASA Public Storage Delete" ON storage.objects;
CREATE POLICY "ASA Public Storage Delete"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id IN ('notices-images', 'avatars', 'requerimentos-anexos', 'documentos-asa'));

-- 3. Colunas de Push Token e Notificações Lidas em public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT,
  ADD COLUMN IF NOT EXISTS read_notifications JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read profiles for app" ON public.profiles;
CREATE POLICY "Allow read profiles for app"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow update profiles for app" ON public.profiles;
CREATE POLICY "Allow update profiles for app"
  ON public.profiles
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert profiles for app" ON public.profiles;
CREATE POLICY "Allow insert profiles for app"
  ON public.profiles
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 4. Garantir políticas completas em student_requirements, requirement_steps e notices
ALTER TABLE public.student_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on student_requirements for app" ON public.student_requirements;
CREATE POLICY "Allow all on student_requirements for app"
  ON public.student_requirements
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.requirement_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on requirement_steps for app" ON public.requirement_steps;
CREATE POLICY "Allow all on requirement_steps for app"
  ON public.requirement_steps
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on notices for app" ON public.notices;
CREATE POLICY "Allow all on notices for app"
  ON public.notices
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 5. REPLICA IDENTITY FULL e Publicação Realtime em todas as tabelas sincronizadas
ALTER TABLE public.student_requirements REPLICA IDENTITY FULL;
ALTER TABLE public.requirement_steps REPLICA IDENTITY FULL;
ALTER TABLE public.notices REPLICA IDENTITY FULL;
ALTER TABLE public.service_queue REPLICA IDENTITY FULL;
ALTER TABLE public.chat_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'student_requirements',
    'requirement_steps',
    'notices',
    'service_queue',
    'chat_sessions',
    'chat_messages'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
