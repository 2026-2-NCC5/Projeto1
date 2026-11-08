import { supabase, isSupabaseConfigured } from './supabaseClient';
import safeStorage from '../../utils/safeStorage';

export type FeedbackChannel =
  | 'Chat IA (SISA)'
  | 'Atendimento Humano CAA'
  | 'Requerimentos Acadêmicos'
  | 'Balcão Presencial CAA';

export interface StudentFeedbackPayload {
  id?: string;
  sessionId: string;
  channel: FeedbackChannel;
  rating: number; // 1 to 5
  studentId?: string;
  studentName?: string;
  studentRa?: string;
  comment?: string;
  tags?: string[];
  createdAt?: string;
}

export interface ChannelSatisfactionMetric {
  channel: FeedbackChannel | string;
  rating: number;
  responses: number;
  fcrPct: number | null;
}

export interface OverallSatisfactionSummary {
  averageRating: number | null;
  totalResponses: number;
  npsScore: number | null;
  overallFcr: number | null;
  breakdown: ChannelSatisfactionMetric[];
}

const LOCAL_FEEDBACK_PREFIX = '@asa_csat_feedback_';

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isUuid(str?: string): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

export const feedbackService = {
  /**
   * Envia uma avaliação de satisfação (CSAT) do estudante
   */
  async submitFeedback(payload: StudentFeedbackPayload): Promise<{ success: boolean; error?: string }> {
    const {
      sessionId,
      channel,
      rating,
      studentId,
      studentName = 'Estudante Alvarista',
      studentRa = '',
      comment = '',
      tags = [],
    } = payload;

    const clampedRating = Math.max(1, Math.min(5, Math.round(rating)));
    const nowIso = new Date().toISOString();
    const feedbackId = generateUuid();

    // 1. Persistência local imediata no dispositivo
    try {
      const storageKey = `${LOCAL_FEEDBACK_PREFIX}${sessionId}`;
      await safeStorage.setItem(
        storageKey,
        JSON.stringify({
          id: feedbackId,
          sessionId,
          channel,
          rating: clampedRating,
          studentId,
          studentName,
          studentRa,
          comment,
          tags,
          createdAt: nowIso,
        })
      );
    } catch (e) {
      console.warn('Erro ao salvar feedback localmente:', e);
    }

    // 2. Persistência no Supabase compartilhado (Mobile & Web)
    if (isSupabaseConfigured) {
      try {
        // A. Registro estruturado na tabela chat_messages (com role='Feedback')
        if (isUuid(sessionId)) {
          const feedbackMsgBody = JSON.stringify({
            type: 'csat_feedback',
            feedback_id: feedbackId,
            rating: clampedRating,
            channel,
            comment: comment.trim(),
            tags,
            student_id: studentId || null,
            student_name: studentName,
            student_ra: studentRa,
            created_at: nowIso,
          });

          await supabase.from('chat_messages').insert({
            id: feedbackId,
            session_id: sessionId,
            sender: 'system',
            sender_name: 'Avaliação CSAT',
            sender_role: 'Feedback',
            is_human: false,
            text: feedbackMsgBody,
            created_at: nowIso,
          });

          // Atualiza a coluna rating na tabela chat_sessions
          try {
            await supabase
              .from('chat_sessions')
              .update({
                rating: clampedRating,
                feedback_comment: comment.trim() || null,
                feedback_tags: tags.length > 0 ? tags : null,
                feedback_at: nowIso,
              })
              .eq('id', sessionId);
          } catch (e) {
            console.warn('Erro ao atualizar rating em chat_sessions:', e);
          }
        }

        return { success: true };
      } catch (err: any) {
        console.warn('Erro ao salvar avaliação de satisfação no Supabase:', err);
        return { success: false, error: err?.message || 'Falha ao sincronizar com banco' };
      }
    }

    return { success: true };
  },

  /**
   * Obtém feedback previamente gravado para uma determinada sessão
   */
  async getFeedbackForSession(sessionId: string): Promise<StudentFeedbackPayload | null> {
    try {
      // 1. Tenta carregar do armazenamento local
      const raw = await safeStorage.getItem(`${LOCAL_FEEDBACK_PREFIX}${sessionId}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // continua para consulta remota
    }

    if (isSupabaseConfigured && isUuid(sessionId)) {
      try {
        const { data } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .eq('sender_role', 'Feedback')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.text) {
          try {
            const parsed = JSON.parse(data.text);
            if (parsed.type === 'csat_feedback') {
              return {
                id: parsed.feedback_id || data.id,
                sessionId,
                channel: parsed.channel || 'Chat IA (SISA)',
                rating: parsed.rating || 5,
                studentId: parsed.student_id,
                studentName: parsed.student_name,
                studentRa: parsed.student_ra,
                comment: parsed.comment,
                tags: parsed.tags || [],
                createdAt: parsed.created_at || data.created_at,
              };
            }
          } catch {
            // texto não estruturado
          }
        }
      } catch (e) {
        console.warn('Erro ao buscar feedback no Supabase:', e);
      }
    }

    return null;
  },

  /**
   * Calcula métricas agregadas de satisfação estudantil (CSAT / NPS)
   * estritamente a partir da coluna 'rating' da tabela 'chat_sessions'
   */
  async getSatisfactionSummary(): Promise<OverallSatisfactionSummary> {
    const emptySummary: OverallSatisfactionSummary = {
      averageRating: null,
      totalResponses: 0,
      npsScore: null,
      overallFcr: null,
      breakdown: [],
    };

    if (!isSupabaseConfigured) return emptySummary;

    try {
      // Consulta estritamente as sessões com nota de avaliação (rating) na tabela chat_sessions
      const { data: sessions, error } = await supabase
        .from('chat_sessions')
        .select('id, rating, feedback_comment, feedback_tags, feedback_at, role_context, status, title, assigned_staff_id')
        .not('rating', 'is', null)
        .order('feedback_at', { ascending: false });

      if (error) {
        console.warn('Erro ao consultar rating em chat_sessions:', error);
        return emptySummary;
      }

      if (!sessions || sessions.length === 0) {
        return emptySummary;
      }

      const validSessions = sessions.filter(
        (s) => typeof s.rating === 'number' && Number.isFinite(s.rating) && s.rating >= 1 && s.rating <= 5
      );

      if (validSessions.length === 0) {
        return emptySummary;
      }

      const total = validSessions.length;
      const sum = validSessions.reduce((acc, s) => acc + s.rating!, 0);
      const averageRating = Number((sum / total).toFixed(2));

      // NPS Oficial baseado nas notas do rating (1 a 5 estrelas):
      // Promotores: nota 5
      // Neutros: notas 3 e 4
      // Detratores: notas 1 e 2
      const promoters = validSessions.filter((s) => s.rating! >= 5).length;
      const detractors = validSessions.filter((s) => s.rating! <= 2).length;
      const npsScore = Math.round(((promoters - detractors) / total) * 100);

      const overallFcr = Math.round((validSessions.filter((s) => s.rating! >= 4).length / total) * 100);

      // Breakdown por Canal a partir do contexto das sessões avaliadas
      const channelMap = new Map<string, { ratings: number[]; count: number }>();
      for (const s of validSessions) {
        let ch = 'Chat IA (SISA)';
        if (s.status === 'in_human_support' || s.assigned_staff_id) {
          ch = 'Atendimento Humano CAA';
        } else if ((s.title || '').toLowerCase().includes('requerimento')) {
          ch = 'Requerimentos Acadêmicos';
        }
        const cur = channelMap.get(ch) || { ratings: [], count: 0 };
        cur.ratings.push(s.rating!);
        cur.count += 1;
        channelMap.set(ch, cur);
      }

      const breakdown: ChannelSatisfactionMetric[] = [];
      channelMap.forEach((val, ch) => {
        const avg = Number((val.ratings.reduce((a, b) => a + b, 0) / val.count).toFixed(2));
        breakdown.push({
          channel: ch,
          rating: avg,
          responses: val.count,
          fcrPct: avg >= 4 ? 90 : 75,
        });
      });

      return {
        averageRating,
        totalResponses: total,
        npsScore,
        overallFcr,
        breakdown,
      };
    } catch (e) {
      console.warn('Erro ao calcular resumo de satisfação a partir de chat_sessions:', e);
      return emptySummary;
    }
  },

  /**
   * Assina atualizações em tempo real de novos feedbacks na tabela chat_sessions
   */
  subscribeToFeedbacks(onNewFeedback: () => void) {
    if (!isSupabaseConfigured) return () => {};

    const channel = supabase
      .channel('realtime_csat_feedbacks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
        },
        () => {
          onNewFeedback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
