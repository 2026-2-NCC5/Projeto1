import { createClient } from '@supabase/supabase-js';
import safeStorage from '../../utils/safeStorage';

// Configuração padrão com suporte a variáveis de ambiente (.env / config)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://asa-fecap.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.mock_key';

export const isSupabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL && 
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
  !process.env.EXPO_PUBLIC_SUPABASE_URL.includes('mock') &&
  !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY.includes('mock_key')
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: isSupabaseConfigured,
    persistSession: isSupabaseConfigured,
    detectSessionInUrl: false,
  },
});
