import { supabase } from '../supabase/supabaseClient';

/**
 * Obtém o token JWT ativo da sessão autenticada do Supabase
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
    };
  } catch {
    return {};
  }
}

/**
 * Executa fetch com injeção automática de Authorization: Bearer <access_token>
 * e tratamento transparente de 401 com renovação de sessão via refreshSession()
 */
export async function fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const mergedHeaders = {
    ...authHeaders,
    ...((init.headers as Record<string, string>) || {}),
  };

  let response = await fetch(url, { ...init, headers: mergedHeaders });

  if (response.status === 401) {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data?.session?.access_token) {
        const retryHeaders = {
          ...((init.headers as Record<string, string>) || {}),
          Authorization: `Bearer ${data.session.access_token}`,
        };
        response = await fetch(url, { ...init, headers: retryHeaders });
      }
    } catch {
      // Falha na renovação da sessão
    }
  }

  return response;
}
