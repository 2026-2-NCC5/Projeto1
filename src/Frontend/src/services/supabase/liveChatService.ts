import { supabase, isSupabaseConfigured } from './supabaseClient';
import safeStorage from '../../utils/safeStorage';
import { pushNotificationService } from '../notifications/pushNotificationService';
import { ChatMessage } from '../ai-agent/aiChatService';

export interface LiveSupportSession {
  id: string;
  studentId: string;
  studentName: string;
  studentRa: string;
  studentCourse?: string;
  status: 'ai_active' | 'waiting_staff' | 'in_human_support' | 'resolved';
  assignedStaffId?: string;
  assignedStaffName?: string;
  title: string;
  lastMessagePreview?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LiveChatMessage extends ChatMessage {
  senderRole?: 'Aluno' | 'Funcionário' | 'IA' | 'Sistema';
  senderName?: string;
  isHuman?: boolean;
}

const LOCAL_LIVE_SESSIONS_KEY = '@asa_live_chat_sessions_v1';
const LOCAL_LIVE_MESSAGES_KEY_PREFIX = '@asa_live_chat_msgs_';

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

async function resolveStudentDbId(studentRa?: string, studentId?: string): Promise<string | undefined> {
  if (studentRa) {
    try {
      const { data: st } = await supabase
        .from('students')
        .select('id')
        .eq('ra', studentRa.trim())
        .maybeSingle();
      if (st?.id) return String(st.id);
    } catch {}
  }
  if (studentId && isUuid(studentId)) return studentId;
  return undefined;
}

export const liveChatService = {
  /**
   * Solicita a transferência da SISA para um atendente humano real da Central CAA
   */
  async requestHumanTransfer(params: {
    sessionId: string;
    studentId: string;
    studentName: string;
    studentRa: string;
    studentCourse?: string;
    priorMessages?: ChatMessage[];
  }): Promise<{ success: boolean; session?: LiveSupportSession }> {
    const { sessionId, studentId, studentName, studentRa, studentCourse, priorMessages = [] } = params;
    const nowIso = new Date().toISOString();
    const validSessionId = isUuid(sessionId) ? sessionId : generateUuid();
    const resolvedStudentId = await resolveStudentDbId(studentRa, studentId);

    // Obtém o auth.uid() do aluno conectado
    const { data: authData } = await supabase.auth.getUser();
    const authUserId = authData?.user?.id || studentId;

    const updatedSession: LiveSupportSession = {
      id: validSessionId,
      studentId: resolvedStudentId || authUserId,
      studentName,
      studentRa,
      studentCourse: studentCourse || 'Graduação FECAP',
      status: 'waiting_staff',
      title: `Atendimento CAA • ${studentName} (${studentRa})`,
      lastMessagePreview: 'Aguardando atendente humano na fila...',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (isSupabaseConfigured) {
      try {
        // T6: Padronização: student_id = students.id, student_ra = RA.
        // chat_sessions.role removido (schema utiliza role_context).
        const { error: sessionErr } = await supabase.from('chat_sessions').upsert({
          id: validSessionId,
          user_id: authUserId,
          role_context: 'Aluno',
          student_id: resolvedStudentId || null,
          student_name: studentName,
          student_ra: studentRa,
          title: updatedSession.title,
          status: 'waiting_staff',
          last_message_preview: updatedSession.lastMessagePreview,
          updated_at: nowIso,
        });

        if (sessionErr) {
          console.warn('Erro ao salvar chat_session no Supabase:', sessionErr);
        }

        // Insere histórico prévio com a SISA no banco para o atendente humano ver
        if (priorMessages.length > 0) {
          const baseTime = Date.now() - priorMessages.length * 1000;
          for (let i = 0; i < priorMessages.length; i++) {
            const msg = priorMessages[i];
            const msgUuid = isUuid(msg.id) ? msg.id : generateUuid();
            const priorIso = new Date(baseTime + i * 1000).toISOString();
            try {
              await supabase.from('chat_messages').upsert({
                id: msgUuid,
                session_id: validSessionId,
                sender: msg.sender === 'user' ? 'user' : 'assistant',
                sender_name: msg.sender === 'user' ? studentName : 'SISA IA',
                sender_role: msg.sender === 'user' ? 'Aluno' : 'IA',
                is_human: false,
                text: msg.text,
                created_at: priorIso,
              });
            } catch {
              // ignore
            }
          }
        }

        // T6: Mensagem de sistema avisando explicitamente ao aluno que o histórico foi compartilhado antes do transbordo
        await supabase.from('chat_messages').insert({
          id: generateUuid(),
          session_id: validSessionId,
          sender: 'assistant',
          sender_name: 'Central SISA / CAA',
          sender_role: 'Sistema',
          is_human: false,
          text: `🔔 **Atendimento transferido para a Central CAA.**\n⚠️ *Aviso de Privacidade*: O histórico da sua conversa com a IA SISA foi compartilhado com os atendentes humanos da Central CAA para agilizar seu atendimento.\nAguardando um funcionário disponível assumir esta conversa.`,
          created_at: nowIso,
        });
      } catch (err) {
        console.warn('Erro ao solicitar atendimento humano no Supabase:', err);
      }
    }

    // Persistência local segura
    try {
      const raw = await safeStorage.getItem(LOCAL_LIVE_SESSIONS_KEY);
      const list: LiveSupportSession[] = raw ? JSON.parse(raw) : [];
      const filtered = list.filter((s) => s.id !== validSessionId);
      filtered.unshift(updatedSession);
      await safeStorage.setItem(LOCAL_LIVE_SESSIONS_KEY, JSON.stringify(filtered));
    } catch {
      // ignore
    }

    // T10: Notificação remota aos funcionários agora é acionada pelo Webhook da Edge Function

    return { success: true, session: updatedSession };
  },

  /**
   * Limpa ou encerra explicitamente qualquer atendimento humano ativo pendente do aluno,
   * garantindo que novas conversas com a IA comecem 100% limpas sem reabrir chats antigos.
   */
  async clearStudentActiveLiveSession(studentRa?: string, studentId?: string): Promise<void> {
    const cleanRa = studentRa ? studentRa.replace(/[^a-zA-Z0-9]/g, '') : undefined;
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('chat_sessions')
          .update({
            status: 'resolved',
            updated_at: nowIso,
          })
          .in('status', ['waiting_staff', 'in_human_support']);

        if (cleanRa) {
          query = query.eq('student_ra', cleanRa);
        } else if (studentId && isUuid(studentId)) {
          query = query.eq('user_id', studentId);
        }
        await query;
      } catch (e) {
        console.warn('Erro ao limpar sessão ativa no Supabase:', e);
      }
    }

    try {
      const raw = await safeStorage.getItem(LOCAL_LIVE_SESSIONS_KEY);
      if (raw) {
        const list: LiveSupportSession[] = JSON.parse(raw);
        const cleaned = list.map((s) => {
          const sRaClean = s.studentRa ? s.studentRa.replace(/[^a-zA-Z0-9]/g, '') : '';
          if (
            (s.status === 'waiting_staff' || s.status === 'in_human_support') &&
            (!cleanRa || !sRaClean || sRaClean === cleanRa)
          ) {
            return { ...s, status: 'resolved' as const, updatedAt: nowIso };
          }
          return s;
        });
        await safeStorage.setItem(LOCAL_LIVE_SESSIONS_KEY, JSON.stringify(cleaned));
      }
    } catch {}
  },

  /**
   * Obtém a sessão de atendimento humano ativa do aluno (aguardando funcionário ou em atendimento)
   * com verificação de expiração temporal máxima (evita sessões zumbis que sequestram o chat).
   */
  async getStudentActiveLiveSession(studentId?: string, studentRa?: string): Promise<LiveSupportSession | null> {
    const MAX_LIVE_AGE_MS = 3 * 60 * 60 * 1000; // 3 horas de validade máxima para um chamado ativo
    const cleanRa = studentRa ? studentRa.replace(/[^a-zA-Z0-9]/g, '') : undefined;

    try {
      if (isSupabaseConfigured) {
        let query = supabase
          .from('chat_sessions')
          .select('*')
          .in('status', ['waiting_staff', 'in_human_support'])
          .order('updated_at', { ascending: false })
          .limit(1);

        if (cleanRa) {
          query = query.eq('student_ra', cleanRa);
        } else if (studentId && isUuid(studentId)) {
          query = query.eq('user_id', studentId);
        }

        const { data, error } = await query.maybeSingle();

        if (!error) {
          if (data) {
            const updatedAtMs = new Date(data.updated_at || data.created_at).getTime();
            const isExpired = Date.now() - updatedAtMs > MAX_LIVE_AGE_MS;

            if (isExpired) {
              // Expira chamado antigo silenciosamente no banco
              supabase
                .from('chat_sessions')
                .update({ status: 'resolved', updated_at: new Date().toISOString() })
                .eq('id', data.id)
                .then(() => {});
            } else {
              return {
                id: data.id,
                studentId: data.student_id || data.user_id || 'student-1',
                studentName: data.student_name || 'Estudante Alvarista',
                studentRa: data.student_ra || studentRa || '24026851',
                studentCourse: data.title?.split('•')[1]?.trim() || 'Graduação FECAP',
                status: (data.status || 'waiting_staff') as any,
                assignedStaffId: data.assigned_staff_id,
                assignedStaffName: data.assigned_staff_name,
                title: data.title || 'Atendimento CAA',
                lastMessagePreview: data.last_message_preview || '',
                createdAt: data.created_at || new Date().toISOString(),
                updatedAt: data.updated_at || new Date().toISOString(),
              };
            }
          }

          // Supabase confirmou que NÃO há chamado humano ativo válido: limpa sessões pendentes no cache local
          try {
            const staleRaw = await safeStorage.getItem(LOCAL_LIVE_SESSIONS_KEY);
            if (staleRaw) {
              const staleList: LiveSupportSession[] = JSON.parse(staleRaw);
              let changed = false;
              const cleaned = staleList.map((s) => {
                const sRaClean = s.studentRa ? s.studentRa.replace(/[^a-zA-Z0-9]/g, '') : '';
                if (
                  (s.status === 'waiting_staff' || s.status === 'in_human_support') &&
                  (!cleanRa || !sRaClean || sRaClean === cleanRa)
                ) {
                  changed = true;
                  return { ...s, status: 'resolved' as const };
                }
                return s;
              });
              if (changed) {
                await safeStorage.setItem(LOCAL_LIVE_SESSIONS_KEY, JSON.stringify(cleaned));
              }
            }
          } catch {}

          return null;
        }
      }

      // Fallback em local storage seguro
      const raw = await safeStorage.getItem(LOCAL_LIVE_SESSIONS_KEY);
      if (raw) {
        const list: LiveSupportSession[] = JSON.parse(raw);
        const match = list.find((s) => {
          if (s.status !== 'waiting_staff' && s.status !== 'in_human_support') return false;
          const sRaClean = s.studentRa ? s.studentRa.replace(/[^a-zA-Z0-9]/g, '') : '';
          const matchesRa = !cleanRa || !sRaClean || sRaClean === cleanRa;
          const isFresh = Date.now() - new Date(s.updatedAt || s.createdAt).getTime() <= MAX_LIVE_AGE_MS;
          return matchesRa && isFresh;
        });
        if (match) return match;
      }

      return null;
    } catch (e) {
      console.warn('Erro ao buscar atendimento ativo do aluno:', e);
      return null;
    }
  },

  /**
   * Obtém lista de sessões que necessitam de atendimento humano (Fila do Funcionário)
   */
  async getStaffQueue(): Promise<LiveSupportSession[]> {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('chat_sessions')
          .select('*')
          .in('status', ['waiting_staff', 'in_human_support'])
          .order('updated_at', { ascending: false });

        if (!error && data) {
          return data.map((d: any) => ({
            id: d.id,
            studentId: d.student_id || d.user_id || 'student-1',
            studentName: d.student_name || 'Estudante Alvarista',
            studentRa: d.student_ra || '24026851',
            studentCourse: d.title?.split('•')[1]?.trim() || 'Graduação FECAP',
            status: (d.status || 'waiting_staff') as any,
            assignedStaffId: d.assigned_staff_id,
            assignedStaffName: d.assigned_staff_name,
            title: d.title || 'Atendimento CAA',
            lastMessagePreview: d.last_message_preview || 'Nova solicitação de atendimento',
            createdAt: d.created_at || new Date().toISOString(),
            updatedAt: d.updated_at || new Date().toISOString(),
          }));
        }
      }

      // Local storage fallback
      const raw = await safeStorage.getItem(LOCAL_LIVE_SESSIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Erro ao obter fila de atendimentos:', e);
      return [];
    }
  },

  /**
   * Funcionário assume o atendimento do aluno
   */
  /**
   * Obtém o histórico de atendimentos finalizados/resolvidos pela equipe do CAA
   */
  async getResolvedStaffHistory(): Promise<LiveSupportSession[]> {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('status', 'resolved')
          .order('updated_at', { ascending: false })
          .limit(50);

        if (!error && data) {
          return data.map((d: any) => ({
            id: d.id,
            studentId: d.student_id || d.user_id || 'student-1',
            studentName: d.student_name || 'Estudante Alvarista',
            studentRa: d.student_ra || '24026851',
            studentCourse: d.title?.split('•')[1]?.trim() || 'Graduação FECAP',
            status: 'resolved',
            assignedStaffId: d.assigned_staff_id,
            assignedStaffName: d.assigned_staff_name,
            title: d.title || 'Atendimento CAA Concluído',
            lastMessagePreview: d.last_message_preview || 'Atendimento finalizado',
            createdAt: d.created_at || new Date().toISOString(),
            updatedAt: d.updated_at || new Date().toISOString(),
          }));
        }
      }

      // Local storage fallback
      const raw = await safeStorage.getItem(LOCAL_LIVE_SESSIONS_KEY);
      if (raw) {
        const list: LiveSupportSession[] = JSON.parse(raw);
        return list.filter((s) => s.status === 'resolved');
      }
      return [];
    } catch (e) {
      console.warn('Erro ao carregar histórico de atendimentos resolvidos:', e);
      return [];
    }
  },

  async assignStaffToSession(params: {
    sessionId: string;
    staffId: string;
    staffName: string;
  }): Promise<{ success: boolean; alreadyAssigned?: boolean; assignedStaffName?: string }> {
    const { sessionId, staffId, staffName } = params;
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured) {
      try {
        // T6: Atribuição 100% atômica: UPDATE ... WHERE id=? AND status='waiting_staff' RETURNING *
        // Se retornar 0 linhas, outro atendente já assumiu simultaneamente!
        const { data: updatedRows, error } = await supabase
          .from('chat_sessions')
          .update({
            status: 'in_human_support',
            assigned_staff_id: staffId,
            assigned_staff_name: staffName,
            updated_at: nowIso,
          })
          .eq('id', sessionId)
          .eq('status', 'waiting_staff')
          .select('*');

        if (error || !updatedRows || updatedRows.length === 0) {
          const { data: current } = await supabase
            .from('chat_sessions')
            .select('assigned_staff_name')
            .eq('id', sessionId)
            .maybeSingle();

          return {
            success: false,
            alreadyAssigned: true,
            assignedStaffName: current?.assigned_staff_name || 'Outro atendente',
          };
        }

        // Mensagem de boas-vindas do funcionário humano para o aluno
        await supabase.from('chat_messages').insert({
          id: generateUuid(),
          session_id: sessionId,
          sender: 'assistant',
          sender_name: staffName,
          sender_role: 'Funcionário',
          is_human: true,
          text: `Olá! Sou **${staffName}**, da equipe CAA. Recebi seu histórico com a SISA e estou à disposição para te ajudar.`,
          created_at: nowIso,
        });

        // T10: Push aluno -> staff e staff -> aluno é tratado pela Edge Function
      } catch (err) {
        console.warn('Erro ao atribuir atendente no Supabase:', err);
        return { success: false };
      }
    }

    // Atualiza localmente
    try {
      const raw = await safeStorage.getItem(LOCAL_LIVE_SESSIONS_KEY);
      if (raw) {
        const list: LiveSupportSession[] = JSON.parse(raw);
        const updated = list.map((s) =>
          s.id === sessionId
            ? { ...s, status: 'in_human_support' as const, assignedStaffId: staffId, assignedStaffName: staffName, updatedAt: nowIso }
            : s
        );
        await safeStorage.setItem(LOCAL_LIVE_SESSIONS_KEY, JSON.stringify(updated));
      }
    } catch {
      // ignore
    }

    return { success: true };
  },

  /**
   * Carrega todas as mensagens de uma sessão (com suporte a histórico prévio de IA + Funcionário)
   */
  async getSessionMessages(sessionId: string): Promise<LiveChatMessage[]> {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((m: any) => ({
            id: m.id,
            sender: m.sender === 'user' ? 'user' : 'assistant',
            text: m.text,
            timestamp: m.created_at
              ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '12:00',
            senderName: m.sender_name || (m.sender === 'user' ? 'Aluno' : m.is_human ? 'Atendente CAA' : 'SISA IA'),
            senderRole: m.sender_role || (m.is_human ? 'Funcionário' : m.sender === 'user' ? 'Aluno' : 'IA'),
            isHuman: Boolean(m.is_human),
            suggestedAction: m.suggested_action,
            quickReplies: m.quick_replies,
          }));
        }
      }

      // Local storage fallback
      const raw = await safeStorage.getItem(`${LOCAL_LIVE_MESSAGES_KEY_PREFIX}${sessionId}`);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Erro ao carregar mensagens da sessão:', e);
      return [];
    }
  },

  /**
   * Envia uma mensagem humana (seja do aluno ou do colaborador)
   */
  async sendMessage(params: {
    sessionId: string;
    text: string;
    sender: 'user' | 'assistant';
    senderName: string;
    senderRole: 'Aluno' | 'Funcionário';
    isHuman: boolean;
  }): Promise<LiveChatMessage> {
    const { sessionId, text, sender, senderName, senderRole, isHuman } = params;
    const msgId = generateUuid();
    const nowIso = new Date().toISOString();
    const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: LiveChatMessage = {
      id: msgId,
      sender,
      text: text.trim(),
      timestamp: timeFormatted,
      senderName,
      senderRole,
      isHuman,
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('chat_messages').insert({
          id: msgId,
          session_id: sessionId,
          sender: sender === 'user' ? 'user' : 'assistant',
          sender_name: senderName,
          sender_role: senderRole,
          is_human: isHuman,
          text: text.trim(),
          created_at: nowIso,
        });

        // Atualiza preview na sessão
        const { data: sessionInfo } = await supabase
          .from('chat_sessions')
          .update({
            last_message_preview: `${senderName}: ${text.trim().slice(0, 50)}`,
            updated_at: nowIso,
          })
          .eq('id', sessionId)
          .select('student_id, student_ra, student_name')
          .maybeSingle();

        // Envia notificação push remota para a outra ponta da conversa (estilo WhatsApp)
        if (senderRole === 'Funcionário' && (sessionInfo?.student_id || sessionInfo?.student_ra)) {
          // T10: Push enviado via Webhook Edge Function
        } else if (senderRole === 'Aluno') {
          // T10: Push enviado via Webhook Edge Function
        }
      } catch (err) {
        console.warn('Erro ao enviar mensagem no Supabase:', err);
      }
    }

    // Salva localmente
    try {
      const existing = await this.getSessionMessages(sessionId);
      const updated = [...existing, newMsg];
      await safeStorage.setItem(
        `${LOCAL_LIVE_MESSAGES_KEY_PREFIX}${sessionId}`,
        JSON.stringify(updated)
      );
    } catch {
      // ignore
    }

    return newMsg;
  },

  /**
   * Conclui o atendimento com o aluno
   */
  async resolveSession(sessionId: string, staffName?: string): Promise<boolean> {
    const nowIso = new Date().toISOString();
    let targetStudentId: string | null = null;
    let targetStudentRa: string | null = null;

    if (isSupabaseConfigured) {
      try {
        const { data: resolvedRow } = await supabase
          .from('chat_sessions')
          .update({
            status: 'resolved',
            assigned_staff_name: staffName || 'Central CAA',
            updated_at: nowIso,
          })
          .eq('id', sessionId)
          .select('student_id, student_ra')
          .maybeSingle();

        targetStudentId = resolvedRow?.student_id || null;
        targetStudentRa = resolvedRow?.student_ra || null;

        await supabase.from('chat_messages').insert({
          id: generateUuid(),
          session_id: sessionId,
          sender: 'assistant',
          sender_name: staffName || 'Central CAA',
          sender_role: 'Sistema',
          is_human: false,
          text: `✅ **Atendimento finalizado com sucesso por ${staffName || 'Central CAA'}.**\nCaso necessite de novas orientações, você pode iniciar um novo chamado a qualquer momento.`,
          created_at: nowIso,
        });
      } catch (err) {
        console.warn('Erro ao concluir sessão:', err);
      }
    }

    // Atualiza armazenamento local seguro
    try {
      const raw = await safeStorage.getItem(LOCAL_LIVE_SESSIONS_KEY);
      if (raw) {
        const list: LiveSupportSession[] = JSON.parse(raw);
        const idx = list.findIndex((s) => s.id === sessionId);
        if (idx >= 0) {
          list[idx].status = 'resolved';
          list[idx].assignedStaffName = staffName || list[idx].assignedStaffName;
          list[idx].updatedAt = nowIso;
          if (!targetStudentId) targetStudentId = list[idx].studentId;
          if (!targetStudentRa) targetStudentRa = list[idx].studentRa;
          await safeStorage.setItem(LOCAL_LIVE_SESSIONS_KEY, JSON.stringify(list));
        }
      }
    } catch {
      // ignore
    }

    // Dispara push remoto para o celular do aluno (e não local no aparelho do funcionário)
    if (targetStudentId || targetStudentRa) {
      // T10: Push enviado via Webhook Edge Function
    }

    return true;
  },

  /**
   * Inscrição em tempo real para novas mensagens da sessão
   */
  subscribeToSessionMessages(
    sessionId: string,
    onNewMessage: (msg: LiveChatMessage) => void
  ) {
    if (!isSupabaseConfigured) return () => {};

    const channelId = `chat_${sessionId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: any) => {
          const m = payload.new;
          if (m && (!m.session_id || m.session_id === sessionId)) {
            const parsedMsg: LiveChatMessage = {
              id: m.id,
              sender: m.sender === 'user' ? 'user' : 'assistant',
              text: m.text,
              timestamp: m.created_at
                ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Agora',
              senderName: m.sender_name || (m.sender === 'user' ? 'Aluno' : m.is_human ? 'Atendente CAA' : 'SISA IA'),
              senderRole: m.sender_role || (m.sender === 'user' ? 'Aluno' : m.is_human ? 'Funcionário' : 'IA'),
              isHuman: Boolean(m.is_human),
            };
            onNewMessage(parsedMsg);
          }
        }
      );

    try {
      channel.subscribe();
    } catch (e) {
      console.warn('Erro ao assinar mensagens:', e);
    }

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  },

  /**
   * Inscrição em tempo real para a fila de suporte humano dos funcionários
   */
  subscribeToStaffQueue(onQueueUpdate: () => void) {
    if (!isSupabaseConfigured) return () => {};

    const channelId = `live_queue_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
        },
        () => {
          onQueueUpdate();
        }
      );

    try {
      channel.subscribe();
    } catch (e) {
      console.warn('Erro ao assinar fila live:', e);
    }

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  },
};
