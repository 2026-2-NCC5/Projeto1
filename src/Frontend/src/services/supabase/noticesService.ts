import { supabase, isSupabaseConfigured } from './supabaseClient';
import { NoticeItem, UserProfile } from '../../utils/constants';
import { DOCUMENTOS_ASA_STORAGE_MAP } from './storageService';
import { pushNotificationService } from '../notifications/pushNotificationService';
import { safeStorage } from '../../utils/safeStorage';

/**
 * Imagem padrão aplicada quando um aviso/comunicado é publicado sem imagem própria.
 * Para substituí-la manualmente, altere o arquivo: src/assets/banners/banner_mentoria.png
 */
export const DEFAULT_NOTICE_BANNER = require('../../assets/banners/banner_mentoria.png');

export interface FullNoticeItem extends NoticeItem {
  content?: string;
  badge?: string;
  author?: string;
  target_audience?: string;
  imageUrl?: string;
}

export const TARGET_AUDIENCE_OPTIONS = [
  { id: 'todos', label: 'Todos os Alunos & Cursos', value: 'Todos', category: 'Geral' },
  { id: 'cc', label: 'Ciência da Computação', value: 'Ciência da Computação', category: 'Cursos' },
  { id: 'adm', label: 'Administração', value: 'Administração', category: 'Cursos' },
  { id: 'contabeis', label: 'Ciências Contábeis', value: 'Ciências Contábeis', category: 'Cursos' },
  { id: 'eco', label: 'Ciências Econômicas', value: 'Ciências Econômicas', category: 'Cursos' },
  { id: 'pp', label: 'Publicidade e Propaganda', value: 'Publicidade e Propaganda', category: 'Cursos' },
  { id: 'ri', label: 'Relações Internacionais', value: 'Relações Internacionais', category: 'Cursos' },
  { id: 'ads', label: 'Análise e Desenv. de Sistemas (ADS)', value: 'Análise e Desenv. de Sistemas (ADS)', category: 'Cursos' },
  { id: 'bolsas', label: 'Bolsistas (PROUNI / PAFE)', value: 'Bolsistas', category: 'Condições Especiais' },
  { id: 'dp', label: 'Alunos com DP / Adaptação', value: 'Alunos com DP/Adaptação', category: 'Condições Especiais' },
  { id: 'formandos', label: 'Formandos (Último Ano)', value: 'Formandos', category: 'Condições Especiais' },
];

export const AUDIENCE_GROUPS = [
  {
    title: 'Geral',
    options: [
      { label: 'Todos os Alunos & Cursos', value: 'Todos' },
    ],
  },
  {
    title: 'Cursos Específicos',
    options: [
      { label: 'Ciência da Computação', value: 'Ciência da Computação' },
      { label: 'Administração', value: 'Administração' },
      { label: 'Ciências Contábeis', value: 'Ciências Contábeis' },
      { label: 'Ciências Econômicas', value: 'Ciências Econômicas' },
      { label: 'Publicidade e Propaganda', value: 'Publicidade e Propaganda' },
      { label: 'Relações Internacionais', value: 'Relações Internacionais' },
      { label: 'Análise e Desenv. de Sistemas (ADS)', value: 'Análise e Desenv. de Sistemas (ADS)' },
    ],
  },
  {
    title: 'Condições & Programas',
    options: [
      { label: 'Bolsistas (PROUNI / PAFE)', value: 'Bolsistas' },
      { label: 'Alunos com DP / Adaptação', value: 'Alunos com DP/Adaptação' },
      { label: 'Formandos (Último Ano)', value: 'Formandos' },
    ],
  },
];

/**
 * Determina se um aviso/comunicado é relevante para o perfil do estudante com base no público-alvo configurado.
 * Funcionários têm acesso irrestrito para visualizar todos os comunicados.
 */
export function isNoticeRelevantForStudent(
  notice: FullNoticeItem | (NoticeItem & { target_audience?: string }),
  user: UserProfile | null
): boolean {
  if (!user || user.role === 'Funcionário') {
    return true;
  }

  const target = ((notice as FullNoticeItem).target_audience || 'Todos').trim();

  // Se o público for Todos ou Aluno genérico, todos os estudantes visualizam
  if (
    !target ||
    target.toLowerCase() === 'todos' ||
    target.toLowerCase() === 'aluno' ||
    target.toLowerCase() === 'alunos' ||
    target.toLowerCase() === 'todos os alunos' ||
    target.toLowerCase() === 'todos os usuários'
  ) {
    return true;
  }

  const normTarget = target.toLowerCase();
  const userCourse = (user.course || '').toLowerCase();

  // 1. Filtro por Curso
  if (userCourse) {
    if (normTarget.includes('computação') && userCourse.includes('computação')) return true;
    if (normTarget.includes('administração') && userCourse.includes('administração')) return true;
    if (normTarget.includes('contábeis') && userCourse.includes('contábeis')) return true;
    if (normTarget.includes('econômicas') && userCourse.includes('econômicas')) return true;
    if (normTarget.includes('publicidade') && userCourse.includes('publicidade')) return true;
    if (normTarget.includes('relações') && userCourse.includes('relações')) return true;
    if (
      (normTarget.includes('sistemas') || normTarget.includes('ads')) &&
      (userCourse.includes('sistemas') || userCourse.includes('ads'))
    ) {
      return true;
    }
    if (normTarget === userCourse) return true;
  }

  // 2. Filtro por Condição Especial: Bolsistas (PROUNI / PAFE)
  if (normTarget.includes('bolsista') || normTarget.includes('prouni') || normTarget.includes('pafe')) {
    return !!user.isScholarshipStudent;
  }

  // 3. Filtro por Condição Especial: Alunos com Dependência ou Adaptação
  if (
    normTarget.includes('dp') ||
    normTarget.includes('adaptação') ||
    normTarget.includes('adaptacao') ||
    normTarget.includes('dependência')
  ) {
    return !!user.hasDp;
  }

  // 4. Filtro por Condição Especial: Formandos
  if (normTarget.includes('formando')) {
    if (user.isGraduating) return true;
    const sem = (user.semester || '').toLowerCase();
    if (sem.includes('7') || sem.includes('8')) return true;
    return false;
  }

  // 5. Se o público-alvo contiver exatamente o nome do curso do aluno
  if (user.course && normTarget.includes(user.course.toLowerCase())) {
    return true;
  }

  return false;
}

const LOCAL_NOTICES_STORAGE_KEY = '@asa_local_notices_v3';

const DEFAULT_NOTICES: FullNoticeItem[] = [];

const dbClient = supabase;

export const noticesService = {
  async getNotices(): Promise<FullNoticeItem[]> {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await dbClient
          .from('notices')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const mapped = data.map((item: any) => {
            const formattedDate = item.created_at
              ? new Date(item.created_at).toLocaleDateString('pt-BR')
              : '';

            const imgSource = item.image_url ? { uri: item.image_url } : DEFAULT_NOTICE_BANNER;

            return {
              id: item.id,
              title: item.title,
              category: item.category || 'Geral',
              date: formattedDate,
              badge: item.badge || 'Aviso',
              author: item.author || 'Secretaria ASA FECAP',
              target_audience: item.target_audience || 'Todos',
              summary: item.summary,
              content: item.content,
              imageSource: imgSource,
              imageUrl: item.image_url || undefined,
            };
          });

          await safeStorage.setItem(LOCAL_NOTICES_STORAGE_KEY, JSON.stringify(mapped)).catch(() => {});
          return mapped;
        }
      }

      // Fallback para cache local (somente avisos reais criados no app)
      const stored = await safeStorage.getItem(LOCAL_NOTICES_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Remove qualquer resquício de avisos mock de versões anteriores
            return parsed.filter(
              (n) =>
                n &&
                !String(n.id).startsWith('notice-inovacao') &&
                !String(n.id).startsWith('notice-cpa') &&
                !String(n.id).startsWith('notice-nap') &&
                !String(n.id).startsWith('notice-comp') &&
                !String(n.id).startsWith('notice-adm') &&
                !String(n.id).startsWith('notice-bolsas') &&
                !String(n.id).startsWith('notice-dp')
            );
          }
        } catch (_) {}
      }

      return [];
    } catch (e) {
      console.warn('Erro ao carregar avisos do Supabase:', e);
      return DEFAULT_NOTICES;
    }
  },

  async createNotice(notice: {
    title: string;
    category: string;
    summary: string;
    content: string;
    badge?: string;
    author?: string;
    target_audience?: string;
    image_url?: string;
  }): Promise<FullNoticeItem | null> {
    try {
      const targetAudience = notice.target_audience || 'Todos';

      if (isSupabaseConfigured) {
        const { data, error } = await dbClient
          .from('notices')
          .insert([
            {
              title: notice.title,
              category: notice.category,
              summary: notice.summary,
              content: notice.content,
              badge: notice.badge || 'Aviso',
              author: notice.author || 'Secretaria ASA FECAP',
              target_audience: targetAudience,
              image_url: notice.image_url || null,
              is_active: true,
            },
          ])
          .select()
          .single();

        if (!error && data) {
          // Dispara notificação push remota para os alunos afetados
          // T10: Notificação enviada automaticamente pelo webhook do Supabase para a Edge Function

          const createdItem: FullNoticeItem = {
            id: data.id,
            title: data.title,
            category: data.category,
            date: new Date(data.created_at).toLocaleDateString('pt-BR'),
            badge: data.badge,
            author: data.author,
            target_audience: data.target_audience || targetAudience,
            summary: data.summary,
            content: data.content,
            imageUrl: data.image_url || undefined,
            imageSource: data.image_url
              ? { uri: data.image_url }
              : DEFAULT_NOTICE_BANNER,
          };

          DEFAULT_NOTICES.unshift(createdItem);
          await safeStorage.setItem(LOCAL_NOTICES_STORAGE_KEY, JSON.stringify(DEFAULT_NOTICES));
          return createdItem;
        }
        if (error) {
          console.warn('Erro ao inserir aviso no Supabase:', error);
        }
      }

      // Fallback local
      const localItem: FullNoticeItem = {
        id: `notice-local-${Date.now()}`,
        title: notice.title,
        category: notice.category,
        date: new Date().toLocaleDateString('pt-BR'),
        badge: notice.badge || 'Novo',
        author: notice.author || 'Staff ASA FECAP',
        target_audience: targetAudience,
        summary: notice.summary,
        content: notice.content,
        imageUrl: notice.image_url,
        imageSource: notice.image_url
          ? { uri: notice.image_url }
          : DEFAULT_NOTICE_BANNER,
      };

      DEFAULT_NOTICES.unshift(localItem);
      await safeStorage.setItem(LOCAL_NOTICES_STORAGE_KEY, JSON.stringify(DEFAULT_NOTICES));
      return localItem;
    } catch (e) {
      console.warn('Erro ao criar aviso:', e);
      return null;
    }
  },

  async updateNotice(
    id: string,
    updates: {
      title?: string;
      category?: string;
      summary?: string;
      content?: string;
      badge?: string;
      author?: string;
      target_audience?: string;
      image_url?: string | null;
      is_active?: boolean;
    }
  ): Promise<boolean> {
    try {
      if (isSupabaseConfigured) {
        const { error } = await dbClient
          .from('notices')
          .update({
            ...updates,
          })
          .eq('id', id);

        if (!error) {
          // Atualiza também em memória e cache local
          const idx = DEFAULT_NOTICES.findIndex((n) => n.id === id);
          if (idx !== -1) {
            DEFAULT_NOTICES[idx] = {
              ...DEFAULT_NOTICES[idx],
              ...updates,
              imageUrl:
                updates.image_url !== undefined
                  ? updates.image_url || undefined
                  : DEFAULT_NOTICES[idx].imageUrl,
              imageSource:
                updates.image_url !== undefined
                  ? updates.image_url
                    ? { uri: updates.image_url }
                    : DEFAULT_NOTICE_BANNER
                  : DEFAULT_NOTICES[idx].imageSource,
            };
            await safeStorage.setItem(LOCAL_NOTICES_STORAGE_KEY, JSON.stringify(DEFAULT_NOTICES));
          }
          return true;
        }
        console.warn('Erro ao atualizar aviso no Supabase:', error);
      }

      // Fallback local
      const idx = DEFAULT_NOTICES.findIndex((n) => n.id === id);
      if (idx !== -1) {
        DEFAULT_NOTICES[idx] = {
          ...DEFAULT_NOTICES[idx],
          ...updates,
          imageUrl:
            updates.image_url !== undefined
              ? updates.image_url || undefined
              : DEFAULT_NOTICES[idx].imageUrl,
          imageSource:
            updates.image_url !== undefined
              ? updates.image_url
                ? { uri: updates.image_url }
                : DEFAULT_NOTICE_BANNER
              : DEFAULT_NOTICES[idx].imageSource,
        };
        await safeStorage.setItem(LOCAL_NOTICES_STORAGE_KEY, JSON.stringify(DEFAULT_NOTICES));
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Erro ao atualizar aviso:', e);
      return false;
    }
  },

  async deleteNotice(id: string): Promise<boolean> {
    try {
      if (isSupabaseConfigured) {
        const { error } = await dbClient
          .from('notices')
          .update({ is_active: false })
          .eq('id', id);

        if (!error) {
          const idx = DEFAULT_NOTICES.findIndex((n) => n.id === id);
          if (idx !== -1) {
            DEFAULT_NOTICES.splice(idx, 1);
            await safeStorage.setItem(LOCAL_NOTICES_STORAGE_KEY, JSON.stringify(DEFAULT_NOTICES));
          }
          return true;
        }
        console.warn('Erro ao desativar aviso no Supabase:', error);
      }

      const idx = DEFAULT_NOTICES.findIndex((n) => n.id === id);
      if (idx !== -1) {
        DEFAULT_NOTICES.splice(idx, 1);
        await safeStorage.setItem(LOCAL_NOTICES_STORAGE_KEY, JSON.stringify(DEFAULT_NOTICES));
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Erro ao excluir aviso:', e);
      return false;
    }
  },

  subscribeToNotices(onUpdate: (notices: FullNoticeItem[]) => void) {
    if (!isSupabaseConfigured) {
      return () => {};
    }

    const channelId = `notices_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notices' },
        async () => {
          const fresh = await noticesService.getNotices();
          onUpdate(fresh);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async getAllMaterials(): Promise<{ id: string; title: string; category: string; format: string; size: string; downloadUrl: string }[]> {
    return [
      { id: 'doc-01', title: 'Informativo Rematrícula Graduação Presencial 2026-2', category: 'Rematrícula e Matrícula', format: 'PDF Original', size: '365 KB', downloadUrl: DOCUMENTOS_ASA_STORAGE_MAP['doc-01'].url },
      { id: 'doc-02', title: 'Calendário Graduação 2026 - Discentes Veteranos', category: 'Calendário Acadêmico', format: 'PDF Original', size: '150 KB', downloadUrl: DOCUMENTOS_ASA_STORAGE_MAP['doc-02'].url },
      { id: 'doc-11', title: 'Programa de Assistência Financeira Educacional (PAFE)', category: 'Assistência Financeira', format: 'PDF Original', size: '575 KB', downloadUrl: DOCUMENTOS_ASA_STORAGE_MAP['doc-11'].url },
      { id: 'doc-12', title: 'Regulamento do Programa de Bolsas Restituíveis FECAP', category: 'Bolsas e Financiamento', format: 'PDF Original', size: '578 KB', downloadUrl: DOCUMENTOS_ASA_STORAGE_MAP['doc-12'].url },
      { id: 'doc-09', title: 'Horário da Graduação - DPs e Adaptação Sábado 2026-2', category: 'Horários e Salas', format: 'PDF Original', size: '344 KB', downloadUrl: DOCUMENTOS_ASA_STORAGE_MAP['doc-09'].url },
      { id: 'doc-04', title: 'Horário da Graduação - Ciência da Computação 2026-2', category: 'Horários e Salas', format: 'PDF Original', size: '186 KB', downloadUrl: DOCUMENTOS_ASA_STORAGE_MAP['doc-04'].url },
      { id: 'doc-05', title: 'Horário da Graduação - Análise e Desenv. de Sistemas 2026-2', category: 'Horários e Salas', format: 'PDF Original', size: '181 KB', downloadUrl: DOCUMENTOS_ASA_STORAGE_MAP['doc-05'].url },
      { id: 'doc-07', title: 'Horário da Graduação - Administração 2026-2', category: 'Horários e Salas', format: 'PDF Original', size: '218 KB', downloadUrl: DOCUMENTOS_ASA_STORAGE_MAP['doc-07'].url },
      { id: 'doc-06', title: 'Horário da Graduação - Ciências Contábeis 2026-2', category: 'Horários e Salas', format: 'PDF Original', size: '220 KB', downloadUrl: DOCUMENTOS_ASA_STORAGE_MAP['doc-06'].url },
      { id: 'doc-08', title: 'Horário da Graduação - Ciências Econômicas 2026-2', category: 'Horários e Salas', format: 'PDF Original', size: '220 KB', downloadUrl: DOCUMENTOS_ASA_STORAGE_MAP['doc-08'].url },
      { id: 'doc-03', title: 'Horário da Graduação - Relações Internacionais 2026-2', category: 'Horários e Salas', format: 'PDF Original', size: '197 KB', downloadUrl: DOCUMENTOS_ASA_STORAGE_MAP['doc-03'].url },
      { id: 'doc-10', title: 'Horário Noturno - Ciências Contábeis p/ Graduados 2026', category: 'Horários e Salas', format: 'PDF Original', size: '841 KB', downloadUrl: DOCUMENTOS_ASA_STORAGE_MAP['doc-10'].url },
    ];
  },
};
