import { safeStorage } from '../../utils/safeStorage';
import { ChatMessage } from './aiChatService';
import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  lastMessagePreview: string;
  role: string;
  status?: 'ai_active' | 'waiting_staff' | 'in_human_support' | 'resolved';
  assignedStaffId?: string;
  assignedStaffName?: string;
  studentId?: string;
  studentName?: string;
  studentRa?: string;
  rating?: number;
  feedbackComment?: string;
  feedbackTags?: string[];
  feedbackAt?: string;
}

const getHistoryKey = (userId?: string, userRa?: string) => {
  const keyIdentifier = userRa || userId || 'global';
  return `@asa_chat_sessions_u_${keyIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
};

const getActiveKey = (userId?: string, userRa?: string) => {
  const keyIdentifier = userRa || userId || 'global';
  return `@asa_active_session_u_${keyIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
};

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

export function normalizeRole(role?: string): string {
  if (!role) return '';
  return role
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function rolesMatch(roleA?: string, roleB?: string): boolean {
  if (!roleA || !roleB) return true;
  const nA = normalizeRole(roleA);
  const nB = normalizeRole(roleB);
  if (nA === nB) return true;
  if (nA.startsWith('func') && nB.startsWith('func')) return true;
  if (nA.startsWith('alun') && nB.startsWith('alun')) return true;
  return false;
}

// Mapa em memória para associar IDs legados a UUIDs válidos para o Supabase
const sessionUuidMap: Record<string, string> = {};
const messageUuidMap: Record<string, string> = {};

async function ensureProfileId(userId?: string, role: string = 'Aluno', userRa?: string): Promise<string> {
  // 1. Se userId já for um UUID válido, utiliza diretamente
  if (userId && isUuid(userId)) return userId;

  // 2. Se for um RA, busca profile_id na tabela students (sem bloqueio de RLS)
  const lookupRa = userRa || (userId && !isUuid(userId) ? userId : undefined);
  if (lookupRa) {
    const cleanRa = lookupRa.replace(/[^a-zA-Z0-9]/g, '');
    try {
      const { data: st } = await supabase
        .from('students')
        .select('profile_id')
        .eq('ra', cleanRa)
        .maybeSingle();
      if (st?.profile_id && isUuid(st.profile_id)) {
        return st.profile_id;
      }
    } catch {}
  }

  // 3. Fallback seguro para o profile padrão oficial no Supabase
  return '8492f361-44d1-4035-8065-9659ae6a575e';
}

export const chatHistoryService = {
  /**
   * Obtém todas as sessões salvas ordenadas da mais recente para a mais antiga para o usuário logado
   */
  async getSessions(role: string = 'Aluno', userId?: string, userRa?: string): Promise<ChatSession[]> {
    try {
      const storageKey = getHistoryKey(userId, userRa);
      const raw = await safeStorage.getItem(storageKey);
      let localList: ChatSession[] = raw ? JSON.parse(raw) : [];

      // Sincroniza com o Supabase se configurado
      if (isSupabaseConfigured) {
        const cleanRa = (userRa || (userId && !isUuid(userId) ? userId : '24026851')).replace(/[^a-zA-Z0-9]/g, '');
        const profileId = await ensureProfileId(userId, role, cleanRa);

        let query = supabase
          .from('chat_sessions')
          .select(`
            id,
            title,
            created_at,
            updated_at,
            last_message_preview,
            role_context,
            status,
            assigned_staff_id,
            assigned_staff_name,
            student_id,
            student_name,
            student_ra,
            rating,
            feedback_comment,
            feedback_tags,
            feedback_at,
            chat_messages(id, sender, sender_name, sender_role, is_human, text, quick_replies, created_at)
          `)
          .order('updated_at', { ascending: false });

        // T11: Sanitização estrita de identificadores no filtro PostgREST .or()
        const safeRa = cleanRa ? cleanRa.replace(/[^a-zA-Z0-9]/g, '') : '';
        const safeProfileId = profileId && isUuid(profileId) ? profileId.trim() : null;

        if (safeRa && normalizeRole(role).startsWith('alun')) {
          if (safeProfileId) {
            query = query.or(`student_ra.eq.${safeRa},user_id.eq.${safeProfileId}`);
          } else {
            query = query.eq('student_ra', safeRa);
          }
        } else if (safeProfileId) {
          query = query.or(`user_id.eq.${safeProfileId},role_context.eq.Funcionário`);
        } else {
          query = query.eq('role_context', 'Funcionário');
        }

        const { data: remoteSessions } = await query;

        if (remoteSessions && remoteSessions.length > 0) {
          const mappedRemote: ChatSession[] = remoteSessions.map((rs: any) => {
            const msgs: any[] = (rs.chat_messages || [])
              .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .map((m: any) => ({
                id: m.id,
                sender: m.sender as 'user' | 'assistant',
                text: m.text,
                timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                senderName: m.sender_name || (m.sender === 'user' ? 'Aluno' : m.is_human ? 'Atendente CAA' : 'SISA IA'),
                senderRole: m.sender_role || (m.sender === 'user' ? 'Aluno' : m.is_human ? 'Funcionário' : 'IA'),
                isHuman: Boolean(m.is_human),
                quickReplies: m.quick_replies || undefined,
              }));

            const resolvedRole = rs.role_context && normalizeRole(rs.role_context).startsWith('func')
              ? 'Funcionário'
              : (rs.role_context || role);

            return {
              id: rs.id,
              title: rs.title || 'Conversa SISA',
              createdAt: rs.created_at,
              updatedAt: rs.updated_at,
              messages: msgs,
              lastMessagePreview: rs.last_message_preview || 'Conversa',
              role: resolvedRole,
              status: rs.status,
              assignedStaffId: rs.assigned_staff_id,
              assignedStaffName: rs.assigned_staff_name,
              studentId: rs.student_id,
              studentName: rs.student_name,
              studentRa: rs.student_ra,
              rating: rs.rating,
              feedbackComment: rs.feedback_comment,
              feedbackTags: rs.feedback_tags,
              feedbackAt: rs.feedback_at,
            };
          });

          // Une sessões locais e remotas
          const remoteIds = new Set(mappedRemote.map((r) => r.id));
          const merged = [...mappedRemote, ...localList.filter((l) => !remoteIds.has(l.id))];
          localList = merged;
          await safeStorage.setItem(storageKey, JSON.stringify(merged));
        }
      }

      return localList
        .filter((s) => !s.role || rolesMatch(s.role, role))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (e) {
      console.warn('Erro ao carregar histórico de conversas:', e);
      return [];
    }
  },

  /**
   * Obtém a sessão ativa mais recente que o usuário estava conversando
   */
  async getLatestActiveSession(role: string = 'Aluno', userId?: string, userRa?: string): Promise<ChatSession | null> {
    try {
      const activeId = await this.getActiveSessionId(userId, userRa);
      const sessions = await this.getSessions(role, userId, userRa);

      if (activeId) {
        const found = sessions.find((s) => s.id === activeId);
        if (found) return found;
      }

      if (sessions.length > 0) {
        // Retorna a mais recente que possui pelo menos uma mensagem
        return sessions[0];
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Cria uma nova sessão com título inicial ou mensagem padrão para o usuário logado
   */
  async createNewSession(
    role: string = 'Aluno',
    initialTitle: string = 'Nova Conversa',
    userId?: string,
    userRa?: string,
    studentName?: string
  ): Promise<ChatSession> {
    const sessionUuid = generateUuid();
    const welcomeMsgUuid = generateUuid();
    const cleanRa = (userRa || (userId && !isUuid(userId) ? userId : '24026851')).replace(/[^a-zA-Z0-9]/g, '');

    const isStaffRole = normalizeRole(role).startsWith('func');
    const welcomeMsg: ChatMessage = {
      id: welcomeMsgUuid,
      sender: 'assistant',
      text:
        isStaffRole
          ? 'Olá! Sou o **Agente Analítico de Permanência & Sucesso Estudantil FECAP**.\n\nEstou conectado à base oficial de alunos para calcular e diagnosticar métricas de risco, scores multidimensionais (financeiro, acadêmico, relacionamento e geográfico) e sugerir planos de ação preventivos.\n\nQual aluno ou turma você deseja consultar agora?'
          : 'Olá! Sou o **SISA (Sistema Inteligente do Sucesso Alvarista) da FECAP**.\n\nEstou conectado ao motor oficial do **Groq (Qwen 27B)** e posso te informar horários de aulas, salas, laboratórios, professores e orientações detalhadas sobre abertura de requerimentos acadêmicos.\n\nComo posso te ajudar hoje?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quickReplies:
        isStaffRole
          ? [
              'Alunos com risco crítico (Vermelho)',
              'Diagnóstico RA 24018932',
              'Panorama geral de permanência 2026/2',
            ]
          : [
              'Qual a data da prova de Macroeconomia do 5NA Econo?',
              'Como funciona o cálculo de média (NI, PO e PEDP)?',
              'Quando é a prova oficial de DP aos sábados?',
            ],
    };

    const newSession: ChatSession = {
      id: sessionUuid,
      title: initialTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [welcomeMsg],
      lastMessagePreview: 'Início da conversa',
      role: isStaffRole ? 'Funcionário' : 'Aluno',
      studentRa: !isStaffRole ? cleanRa : undefined,
      studentName: studentName || undefined,
    };

    const allSessions = await this.getAllRawSessions(userId, userRa);
    // Remove rascunhos vazios anteriores APENAS se não tiverem nenhuma mensagem do usuário
    const emptyDraftIds: string[] = [];
    const prunedSessions = allSessions.filter((s) => {
      const isUntouchedDraft =
        (!s.role || rolesMatch(s.role, role)) &&
        s.title === 'Nova Conversa' &&
        (!s.status || s.status === 'ai_active') &&
        (s.messages?.length || 0) <= 1 &&
        !(s.messages || []).some((m) => m.sender === 'user');
      if (isUntouchedDraft) {
        emptyDraftIds.push(s.id);
        return false;
      }
      return true;
    });

    prunedSessions.unshift(newSession);
    await this.saveRawSessions(prunedSessions, userId, userRa);
    await safeStorage.setItem(getActiveKey(userId, userRa), newSession.id);

    // Grava no Supabase se disponível
    if (isSupabaseConfigured) {
      try {
        const profileId = await ensureProfileId(userId, role, cleanRa);
        if (profileId) {
          await supabase.from('chat_sessions').insert({
            id: sessionUuid,
            user_id: profileId,
            title: initialTitle,
            role_context: isStaffRole ? 'Funcionário' : 'Aluno',
            last_message_preview: newSession.lastMessagePreview,
            student_ra: !isStaffRole ? cleanRa : null,
            student_name: studentName || null,
          });

          await supabase.from('chat_messages').insert({
            id: welcomeMsgUuid,
            session_id: sessionUuid,
            sender: 'assistant',
            text: welcomeMsg.text,
            quick_replies: welcomeMsg.quickReplies || null,
          });
        }
      } catch (e) {
        console.warn('Erro ao criar sessão no Supabase:', e);
      }
    }

    return newSession;
  },

  /**
   * Salva ou atualiza uma sessão existente do usuário tanto localmente quanto no Supabase
   */
  async saveSession(session: ChatSession, userId?: string, userRa?: string): Promise<void> {
    const all = await this.getAllRawSessions(userId, userRa);
    const index = all.findIndex((s) => s.id === session.id);

    const lastMsg = session.messages[session.messages.length - 1];
    let preview = session.lastMessagePreview;
    if (lastMsg) {
      preview = lastMsg.text.slice(0, 70).replace(/\n/g, ' ') + (lastMsg.text.length > 70 ? '...' : '');
    }

    // Gera um título inteligente a partir da primeira mensagem do usuário se ainda for padrão
    let title = session.title;
    if (session.title === 'Nova Conversa' || !session.title) {
      const firstUserMsg = session.messages.find((m) => m.sender === 'user');
      if (firstUserMsg) {
        title = firstUserMsg.text.slice(0, 32).trim() + (firstUserMsg.text.length > 32 ? '...' : '');
      }
    }

    const cleanRa = (userRa || session.studentRa || (userId && !isUuid(userId) ? userId : '24026851')).replace(/[^a-zA-Z0-9]/g, '');

    const isStaffSession = normalizeRole(session.role).startsWith('func');
    const updatedSession: ChatSession = {
      ...session,
      title,
      role: isStaffSession ? 'Funcionário' : 'Aluno',
      updatedAt: new Date().toISOString(),
      lastMessagePreview: preview,
      studentRa: session.studentRa || (!isStaffSession ? cleanRa : undefined),
    };

    if (index >= 0) {
      all[index] = updatedSession;
    } else {
      all.unshift(updatedSession);
    }

    await this.saveRawSessions(all, userId, userRa);
    await safeStorage.setItem(getActiveKey(userId, userRa), session.id);

    // Persiste no Supabase chat_sessions e chat_messages
    if (isSupabaseConfigured) {
      try {
        const profileId = await ensureProfileId(userId, session.role, cleanRa);

        if (profileId) {
          let sessionUuid = session.id;
          if (!isUuid(sessionUuid)) {
            if (!sessionUuidMap[session.id]) {
              sessionUuidMap[session.id] = generateUuid();
            }
            sessionUuid = sessionUuidMap[session.id];
          }

          // 1. Upsert da Sessão (preservando rating e feedback caso existam)
          const upsertSessionPayload: any = {
            id: sessionUuid,
            user_id: profileId,
            title,
            role_context: isStaffSession ? 'Funcionário' : 'Aluno',
            last_message_preview: preview,
            status: session.status || 'ai_active',
            assigned_staff_id: session.assignedStaffId || null,
            assigned_staff_name: session.assignedStaffName || null,
            student_id: session.studentId || profileId,
            student_name: session.studentName || null,
            student_ra: session.studentRa || (!isStaffSession ? cleanRa : null),
            updated_at: new Date().toISOString(),
          };

          if (session.rating !== undefined && session.rating !== null) {
            upsertSessionPayload.rating = session.rating;
            upsertSessionPayload.feedback_comment = session.feedbackComment || null;
            upsertSessionPayload.feedback_tags = session.feedbackTags || null;
            upsertSessionPayload.feedback_at = session.feedbackAt || null;
          }

          await supabase.from('chat_sessions').upsert(upsertSessionPayload);

          // 2. Upsert das Mensagens da Sessão
          const msgInserts = session.messages.map((m: any) => {
            let msgUuid = m.id;
            if (!isUuid(msgUuid)) {
              if (!messageUuidMap[m.id]) {
                messageUuidMap[m.id] = generateUuid();
              }
              msgUuid = messageUuidMap[m.id];
            }

            return {
              id: msgUuid,
              session_id: sessionUuid,
              sender: m.sender === 'user' ? 'user' : 'assistant',
              sender_name: m.senderName || (m.sender === 'user' ? 'Aluno' : m.isHuman ? 'Atendente CAA' : 'SISA IA'),
              sender_role: m.senderRole || (m.sender === 'user' ? 'Aluno' : m.isHuman ? 'Funcionário' : 'IA'),
              is_human: Boolean(m.isHuman),
              text: m.text,
              quick_replies: m.quickReplies || null,
            };
          });

          if (msgInserts.length > 0) {
            await supabase.from('chat_messages').upsert(msgInserts);
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar sessão de chat com Supabase:', err);
      }
    }
  },

  /**
   * Deleta uma sessão específica
   */
  async deleteSession(sessionId: string, userId?: string, userRa?: string): Promise<void> {
    const all = await this.getAllRawSessions(userId, userRa);
    const filtered = all.filter((s) => s.id !== sessionId);
    await this.saveRawSessions(filtered, userId, userRa);

    if (isSupabaseConfigured) {
      try {
        const validSessionId = isUuid(sessionId) ? sessionId : sessionUuidMap[sessionId];
        if (validSessionId) {
          await supabase.from('chat_messages').delete().eq('session_id', validSessionId);
          await supabase.from('chat_sessions').delete().eq('id', validSessionId);
        }
      } catch (e) {
        console.warn('Erro ao deletar sessão do Supabase:', e);
      }
    }
  },

  /**
   * Limpa todas as sessões do usuário
   */
  async clearAllSessions(userId?: string, userRa?: string): Promise<void> {
    await safeStorage.removeItem(getHistoryKey(userId, userRa));
    await safeStorage.removeItem(getActiveKey(userId, userRa));
  },

  async getActiveSessionId(userId?: string, userRa?: string): Promise<string | null> {
    return safeStorage.getItem(getActiveKey(userId, userRa));
  },

  async setActiveSessionId(id: string, userId?: string, userRa?: string): Promise<void> {
    await safeStorage.setItem(getActiveKey(userId, userRa), id);
  },

  // Utilitários internos
  async getAllRawSessions(userId?: string, userRa?: string): Promise<ChatSession[]> {
    try {
      const raw = await safeStorage.getItem(getHistoryKey(userId, userRa));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async saveRawSessions(sessions: ChatSession[], userId?: string, userRa?: string): Promise<void> {
    await safeStorage.setItem(getHistoryKey(userId, userRa), JSON.stringify(sessions));
  },
};
