import safeStorage from '../../utils/safeStorage';
import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient';

export const DEFAULT_STUDENT_SUGGESTIONS = [
  'Quero os horários de CCOMP 4',
  'Como solicitar o Passe Escolar / SPTrans?',
  'Como pedir trancamento de curso e qual o prazo?',
  'Como funciona a Bolsa Restituível?',
  'Qual o prazo de rematrícula para o início do semestre?',
];

export const DEFAULT_STAFF_SUGGESTIONS = [
  'Alunos com risco crítico de evasão',
  'Panorama geral de retenção 2026/2',
  'Diagnóstico detalhado RA 24018932',
  'Quais alunos possuem pendências financeiras?',
  'Requerimentos fora do prazo de SLA',
];

const STORAGE_KEY_ALUNO = '@asa_quick_suggestions_aluno_v2';
const STORAGE_KEY_STAFF = '@asa_quick_suggestions_staff_v2';

export const quickSuggestionsService = {
  async getSuggestions(role: string = 'Aluno'): Promise<string[]> {
    const isStaff = role === 'Funcionário';
    const key = isStaff ? STORAGE_KEY_STAFF : STORAGE_KEY_ALUNO;
    const defaults = isStaff ? DEFAULT_STAFF_SUGGESTIONS : DEFAULT_STUDENT_SUGGESTIONS;

    try {
      // 1. Tenta carregar do Supabase se configurado
      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase
            .from('documents')
            .select('content')
            .eq('title', `quick_suggestions_${isStaff ? 'staff' : 'student'}`)
            .maybeSingle();

          if (data?.content) {
            const parsed = JSON.parse(data.content);
            if (Array.isArray(parsed) && parsed.length > 0) {
              await safeStorage.setItem(key, JSON.stringify(parsed));
              return parsed;
            }
          }
        } catch {}
      }

      // 2. Fallback no cache seguro local
      const raw = await safeStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Aviso ao carregar sugestões rápidas:', e);
    }

    return defaults;
  },

  async saveSuggestions(role: string = 'Aluno', suggestions: string[]): Promise<boolean> {
    const isStaff = role === 'Funcionário';
    const key = isStaff ? STORAGE_KEY_STAFF : STORAGE_KEY_ALUNO;
    const cleanList = suggestions.map((s) => s.trim()).filter((s) => s.length > 0);

    try {
      await safeStorage.setItem(key, JSON.stringify(cleanList));

      if (isSupabaseConfigured) {
        try {
          const title = `quick_suggestions_${isStaff ? 'staff' : 'student'}`;
          await supabase.from('documents').upsert({
            title,
            category: 'configuracoes',
            content: JSON.stringify(cleanList),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'title' });
        } catch (dbErr) {
          console.warn('Erro ao sincronizar sugestões no Supabase:', dbErr);
        }
      }
      return true;
    } catch {
      return false;
    }
  },

  async resetDefaults(role: string = 'Aluno'): Promise<string[]> {
    const isStaff = role === 'Funcionário';
    const defaults = isStaff ? DEFAULT_STAFF_SUGGESTIONS : DEFAULT_STUDENT_SUGGESTIONS;
    await this.saveSuggestions(role, defaults);
    return defaults;
  },
};
