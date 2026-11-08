import { createClient } from '@supabase/supabase-js';
import safeStorage from '../../utils/safeStorage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://hevywbfvoooybuxxewwp.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Hy45xYfvqA_xYrWCp9LnhQ_jVZn7RCn';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('mock') &&
  !SUPABASE_ANON_KEY.includes('mock_key')
);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Supabase não configurado. Verifique as variáveis no arquivo de ambiente.'
  );
}

/**
 * Cliente Supabase padrão utilizando exclusivamente a chave anônima pública
 * com persistência de sessão e renovação de token.
 * Toda operação com privilégios é executada via Edge Function ou RPC com SECURITY DEFINER.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
