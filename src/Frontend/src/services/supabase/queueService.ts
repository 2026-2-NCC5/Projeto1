import { supabase, isSupabaseConfigured } from './supabaseClient';
import safeStorage from '../../utils/safeStorage';
import { pushNotificationService } from '../notifications/pushNotificationService';

export interface QueueTicket {
  id: string;
  ticket_number: string;
  service_type: string;
  counter: string;
  status: 'waiting' | 'called' | 'in_service' | 'completed' | 'cancelled' | 'expired';
  student_id?: string | null;
  student_name?: string | null;
  student_ra?: string | null;
  student_course?: string | null;
  called_at?: string | null;
  completed_at?: string | null;
  completion_data?: any;
  created_at: string;
  updated_at?: string;
}

export interface CaaScheduleStatus {
  isOpen: boolean;
  isPastClosingToday: boolean;
  dayOfWeek: number;
  minutesNow: number;
  todayDateKey: string;
  startOfTodayIso: string;
  hoursSummary: string;
  statusBadgeLabel: string;
  closedMessage: string;
}

const LOCAL_QUEUE_KEY = '@asa_local_service_queue';
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // America/Sao_Paulo (UTC-03:00 fixo)

function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
}

/**
 * Converte um Date para componentes determinísticos no fuso de Brasília (UTC-03:00)
 */
function toBrtParts(date: Date = new Date()) {
  const brt = new Date(date.getTime() - BRT_OFFSET_MS);
  const year = brt.getUTCFullYear();
  const month = String(brt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(brt.getUTCDate()).padStart(2, '0');
  const dayOfWeek = brt.getUTCDay(); // 0 = Dom, 1..5 = Seg..Sex, 6 = Sáb
  const hours = brt.getUTCHours();
  const minutes = brt.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  const dateKey = `${year}-${month}-${day}`;
  const startOfDayIso = `${dateKey}T00:00:00.000-03:00`;

  return {
    year,
    month,
    day,
    dayOfWeek,
    hours,
    minutes,
    totalMinutes,
    dateKey,
    startOfDayIso,
  };
}

/**
 * Calcula o status atual do expediente presencial da Central CAA:
 * - Segunda a Sexta: 09h00 às 21h00
 * - Sábado: 09h00 às 12h30
 * - Domingo: Fechado
 */
export function getCaaScheduleStatus(now: Date = new Date()): CaaScheduleStatus {
  const parts = toBrtParts(now);
  const hoursSummary = 'Seg a Sex das 09h às 21h • Sáb das 09h às 12h30';

  if (parts.dayOfWeek === 0) {
    return {
      isOpen: false,
      isPastClosingToday: true,
      dayOfWeek: parts.dayOfWeek,
      minutesNow: parts.totalMinutes,
      todayDateKey: parts.dateKey,
      startOfTodayIso: parts.startOfDayIso,
      hoursSummary,
      statusBadgeLabel: 'FECHADO (DOMINGO)',
      closedMessage:
        'A emissão de senhas presenciais do CAA não funciona aos domingos. O expediente ocorre de segunda a sexta das 09h às 21h e aos sábados das 09h às 12h30.',
    };
  }

  const openMinutes = 9 * 60; // 09:00
  const closeMinutes = parts.dayOfWeek === 6 ? 12 * 60 + 30 : 21 * 60; // Sáb 12:30 | Seg-Sex 21:00
  const closeLabel = parts.dayOfWeek === 6 ? '12h30' : '21h00';

  const isBeforeOpen = parts.totalMinutes < openMinutes;
  const isPastClosingToday = parts.totalMinutes >= closeMinutes;
  const isOpen = !isBeforeOpen && !isPastClosingToday;

  let closedMessage = '';
  let statusBadgeLabel = `ABERTO ATÉ ${closeLabel}`;

  if (isBeforeOpen) {
    statusBadgeLabel = 'ABRE ÀS 09H00';
    closedMessage = `O atendimento presencial do CAA ainda não iniciou hoje. A retirada de senhas funciona de segunda a sexta das 09h às 21h e aos sábados das 09h às 12h30.`;
  } else if (isPastClosingToday) {
    statusBadgeLabel = `ENCERRADO (${closeLabel})`;
    closedMessage = `O expediente presencial do CAA de hoje encerrou às ${closeLabel}. Novas senhas podem ser retiradas de segunda a sexta das 09h às 21h e aos sábados das 09h às 12h30.`;
  }

  return {
    isOpen,
    isPastClosingToday,
    dayOfWeek: parts.dayOfWeek,
    minutesNow: parts.totalMinutes,
    todayDateKey: parts.dateKey,
    startOfTodayIso: parts.startOfDayIso,
    hoursSummary,
    statusBadgeLabel,
    closedMessage,
  };
}

/**
 * Verifica se uma senha ativa deve expirar por ter ultrapassado o dia de emissão
 * ou o horário limite do expediente do CAA.
 */
export function isQueueTicketExpired(ticket: Pick<QueueTicket, 'status' | 'created_at'>, now: Date = new Date()): boolean {
  if (ticket.status !== 'waiting' && ticket.status !== 'called' && ticket.status !== 'in_service') {
    return false;
  }

  if (!ticket.created_at) return false;
  const createdDate = new Date(ticket.created_at);
  if (Number.isNaN(createdDate.getTime())) return false;

  const nowSchedule = getCaaScheduleStatus(now);
  const ticketParts = toBrtParts(createdDate);

  // 1. Senha emitida em dia anterior expira obrigatoriamente (reinício diário)
  if (ticketParts.dateKey !== nowSchedule.todayDateKey) {
    return true;
  }

  // 2. Domingo não possui expediente ativo
  if (nowSchedule.dayOfWeek === 0 || ticketParts.dayOfWeek === 0) {
    return true;
  }

  // 3. Se o horário atual já passou do encerramento do expediente de hoje, a senha expira
  if (nowSchedule.isPastClosingToday) {
    return true;
  }

  // 4. Se a senha tiver sido gravada após o fim do expediente daquele dia, também expira
  const ticketDayClose = ticketParts.dayOfWeek === 6 ? 12 * 60 + 30 : 21 * 60;
  if (ticketParts.totalMinutes >= ticketDayClose) {
    return true;
  }

  return false;
}

/**
 * Extrai o número sequencial inteiro de uma senha (ex: 'A001' -> 1, 'P014' -> 14)
 */
export function parseTicketSequence(ticketNumber?: string | null): number {
  if (!ticketNumber) return 0;
  const match = ticketNumber.match(/(\d+)$/);
  if (!match) return 0;
  const parsed = parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getServicePrefix(serviceType: string = 'Geral'): string {
  const norm = serviceType.toLowerCase();
  if (norm.includes('priorit')) return 'P';
  if (norm.includes('financ')) return 'F';
  return 'A';
}

function formatSequentialTicket(prefix: string, seq: number): string {
  const safeSeq = Math.max(1, Math.floor(seq));
  return `${prefix}${String(safeSeq).padStart(3, '0')}`;
}

export const queueService = {
  /**
   * Retorna informações em tempo real sobre o horário de funcionamento do CAA
   */
  getOperatingHoursStatus(now: Date = new Date()): CaaScheduleStatus {
    return getCaaScheduleStatus(now);
  },

  /**
   * Expira automaticamente no Supabase e no cache local todas as senhas ativas
   * que sejam de dias anteriores ou que tenham ultrapassado o fim do expediente.
   */
  /**
   * Expira automaticamente no Supabase via RPC atômica (expire_outdated_tickets)
   */
  async expireOutdatedTickets(): Promise<number> {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.rpc('expire_outdated_tickets');
        if (!error && typeof data === 'number') {
          return data;
        }
      }
    } catch (e) {
      console.warn('Aviso ao expirar senhas via RPC expire_outdated_tickets:', e);
    }
    return 0;
  },

  /**
   * T5: Consulta a view pública anonimizada queue_board para telas de alunos
   * Sem expor nomes ou RAs de terceiros.
   */
  async getQueueBoard(): Promise<QueueTicket[]> {
    try {
      await this.expireOutdatedTickets();
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('queue_board')
          .select('*')
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data as QueueTicket[];
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar view queue_board:', e);
    }
    return [];
  },

  /**
   * Obtém a lista completa da fila de atendimento ativa de hoje ordenada em ordem crescente
   */
  async getQueue(): Promise<QueueTicket[]> {
    try {
      await this.expireOutdatedTickets();
      const now = new Date();

      let remoteQueue: QueueTicket[] = [];
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('service_queue')
          .select('*')
          .in('status', ['waiting', 'called', 'in_service'])
          .order('created_at', { ascending: true });

        if (!error && data) {
          remoteQueue = (data as QueueTicket[]).filter((t) => !isQueueTicketExpired(t, now));
        }
      }

      const raw = await safeStorage.getItem(LOCAL_QUEUE_KEY);
      const localQueue: QueueTicket[] = raw ? JSON.parse(raw) : [];

      const mergedMap = new Map<string, QueueTicket>();
      for (const t of remoteQueue) {
        mergedMap.set(t.id, t);
      }
      for (const t of localQueue) {
        if (
          !mergedMap.has(t.id) &&
          (t.status === 'waiting' || t.status === 'called' || t.status === 'in_service') &&
          !isQueueTicketExpired(t, now)
        ) {
          mergedMap.set(t.id, t);
        }
      }

      // Ordena: chamadas/em atendimento primeiro (mais recente chamada no visor), seguidas pelas aguardando em ordem crescente estrita
      return Array.from(mergedMap.values()).sort((a, b) => {
        const aCalled = a.status === 'called' || a.status === 'in_service' ? 0 : 1;
        const bCalled = b.status === 'called' || b.status === 'in_service' ? 0 : 1;
        if (aCalled !== bCalled) return aCalled - bCalled;

        if (aCalled === 0 && a.called_at && b.called_at) {
          return new Date(b.called_at).getTime() - new Date(a.called_at).getTime();
        }

        const seqA = parseTicketSequence(a.ticket_number);
        const seqB = parseTicketSequence(b.ticket_number);
        if (seqA !== seqB && seqA > 0 && seqB > 0) {
          return seqA - seqB;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    } catch (e) {
      console.warn('Erro ao carregar fila:', e);
      return [];
    }
  },

  /**
   * Retorna a senha ativa de um determinado estudante (em espera, chamada ou em atendimento)
   * garantindo expiração automática fora do expediente ou em mudança de dia.
   */
  async getStudentActiveTicket(studentRaOrId: string): Promise<QueueTicket | null> {
    if (!studentRaOrId) return null;
    const clean = studentRaOrId.trim().toLowerCase();

    try {
      await this.expireOutdatedTickets();
      const now = new Date();

      if (isSupabaseConfigured) {
        let query = supabase
          .from('service_queue')
          .select('*')
          .in('status', ['waiting', 'called', 'in_service']);

        if (isValidUuid(studentRaOrId)) {
          query = query.or(`student_ra.eq.${studentRaOrId},student_id.eq.${studentRaOrId}`);
        } else {
          query = query.eq('student_ra', studentRaOrId);
        }

        const { data, error } = await query
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error) {
          if (data && !isQueueTicketExpired(data as QueueTicket, now)) {
            await safeStorage.setItem(`@asa_active_ticket_${clean}`, JSON.stringify(data));
            return data as QueueTicket;
          } else {
            if (data && isQueueTicketExpired(data as QueueTicket, now)) {
              await supabase
                .from('service_queue')
                .update({ status: 'expired', updated_at: now.toISOString() })
                .eq('id', data.id);
            }
            await safeStorage.removeItem(`@asa_active_ticket_${clean}`);
            return null;
          }
        }
      }

      const storedActive = await safeStorage.getItem(`@asa_active_ticket_${clean}`);
      if (storedActive) {
        const parsed: QueueTicket = JSON.parse(storedActive);
        if (isQueueTicketExpired(parsed, now)) {
          await safeStorage.removeItem(`@asa_active_ticket_${clean}`);
          return null;
        }
        if (parsed.status === 'waiting' || parsed.status === 'called' || parsed.status === 'in_service') {
          return parsed;
        }
      }

      return null;
    } catch {
      return null;
    }
  },

  /**
   * Retorna a senha chamada atualmente (ou em atendimento) no painel
   */
  async getCurrentTicket(): Promise<QueueTicket | null> {
    const queue = await this.getQueue();
    const called = queue.find((t) => t.status === 'called' || t.status === 'in_service');
    return called || queue[0] || null;
  },

  /**
   * Retorna a quantidade de senhas aguardando atendimento
   */
  async getWaitingTicketsCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.filter((t) => t.status === 'waiting').length;
  },

  /**
   * Calcula o próximo número sequencial estritamente crescente do dia atual (reiniciando em 1 todos os dias)
   */
  async getNextDailySequenceNumber(now: Date = new Date()): Promise<number> {
    const schedule = getCaaScheduleStatus(now);
    let maxSeqToday = 0;

    if (isSupabaseConfigured) {
      try {
        const { data: todayRows, error } = await supabase
          .from('service_queue')
          .select('ticket_number, created_at')
          .gte('created_at', schedule.startOfTodayIso)
          .order('created_at', { ascending: true });

        if (!error && todayRows) {
          for (const row of todayRows) {
            const rowDateKey = toBrtParts(new Date(row.created_at)).dateKey;
            if (rowDateKey === schedule.todayDateKey) {
              const seq = parseTicketSequence(row.ticket_number);
              if (seq > maxSeqToday) {
                maxSeqToday = seq;
              }
            }
          }
        }
      } catch (e) {
        console.warn('Erro ao consultar sequência diária no Supabase:', e);
      }
    }

    try {
      const raw = await safeStorage.getItem(LOCAL_QUEUE_KEY);
      if (raw) {
        const localQueue: QueueTicket[] = JSON.parse(raw);
        for (const t of localQueue) {
          if (t.created_at && toBrtParts(new Date(t.created_at)).dateKey === schedule.todayDateKey) {
            const seq = parseTicketSequence(t.ticket_number);
            if (seq > maxSeqToday) {
              maxSeqToday = seq;
            }
          }
        }
      }
    } catch {}

    return maxSeqToday + 1;
  },

  /**
   * Emite uma senha rápida presencial (para uso direto no balcão ou totens)
   */
  async generateTicket(serviceType: string = 'Geral'): Promise<QueueTicket> {
    return this.generateTicketForStudent({
      studentId: '',
      studentName: 'Atendimento Balcão CAA',
      studentRa: 'Presencial',
      serviceType,
    });
  },

  /**
   * Aluno ou balcão retira uma senha nominal em ordem estritamente crescente (001, 002, 003...),
   * validando o horário oficial de expediente do CAA.
   */
  async generateTicketForStudent(params: {
    studentId: string;
    studentName: string;
    studentRa: string;
    studentCourse?: string;
    serviceType?: string;
  }): Promise<QueueTicket> {
    const { studentId, studentName, studentRa, studentCourse, serviceType = 'Geral' } = params;
    const cleanRa = (studentRa || '').trim().toLowerCase();
    const now = new Date();

    // 0. Expira senhas vencidas antes de validar e calcular a sequência do dia
    await this.expireOutdatedTickets();

    // 1. Valida rigorosamente o horário de expediente presencial do CAA
    const schedule = getCaaScheduleStatus(now);
    if (!schedule.isOpen) {
      throw new Error(schedule.closedMessage);
    }

    // 2. Se for um estudante nominal (RA real) e já possuir senha ativa hoje, retorna a própria senha ativa
    if (studentRa && cleanRa !== 'presencial') {
      const existing = await this.getStudentActiveTicket(studentRa);
      if (existing) {
        return existing;
      }
    }

    // 3. Resolve o ID do estudante na tabela 'students' (foreign key aponta para students.id)
    let resolvedStudentDbId: string | null = null;
    if (isSupabaseConfigured) {
      if (studentRa && studentRa.trim().length > 0 && cleanRa !== 'presencial') {
        try {
          const { data: stRow } = await supabase
            .from('students')
            .select('id')
            .eq('ra', studentRa.trim())
            .maybeSingle();
          if (stRow?.id && isValidUuid(stRow.id)) {
            resolvedStudentDbId = stRow.id;
          }
        } catch {}
      }

      if (!resolvedStudentDbId && studentId && isValidUuid(studentId)) {
        try {
          const { data: stRow } = await supabase
            .from('students')
            .select('id')
            .or(`id.eq.${studentId},profile_id.eq.${studentId}`)
            .maybeSingle();
          if (stRow?.id && isValidUuid(stRow.id)) {
            resolvedStudentDbId = stRow.id;
          }
        } catch {}
      }
    }

    // 4. O trigger assign_ticket_number no banco atribui o número sequencial.
    // O cliente envia apenas o prefixo e recebe o ticket_number atribuído pelo banco.
    const prefix = getServicePrefix(serviceType);
    const nowIso = now.toISOString();

    // 5. Inserção no Supabase com fallback seguro de foreign key
    if (isSupabaseConfigured) {
      try {
        let insertRes = await supabase
          .from('service_queue')
          .insert({
            ticket_prefix: prefix,
            // ticket_number será atribuído pelo trigger assign_ticket_number
            service_type: serviceType,
            counter: null,
            status: 'waiting',
            student_id: resolvedStudentDbId,
            student_name: studentName,
            student_ra: studentRa || cleanRa || 'Presencial',
            student_course: studentCourse || 'Graduação FECAP',
          })
          .select()
          .single();

        if (insertRes.error && (insertRes.error.code === '23503' || insertRes.error.message?.includes('foreign key'))) {
          insertRes = await supabase
            .from('service_queue')
            .insert({
              ticket_prefix: prefix,
              service_type: serviceType,
              counter: null,
              status: 'waiting',
              student_id: null,
              student_name: studentName,
              student_ra: studentRa,
              student_course: studentCourse || 'Graduação FECAP',
            })
            .select()
            .single();
        }

        if (!insertRes.error && insertRes.data) {
          const created = insertRes.data as QueueTicket;
          if (cleanRa && cleanRa !== 'presencial') {
            await safeStorage.setItem(`@asa_active_ticket_${cleanRa}`, JSON.stringify(created));
          }
          return created;
        } else if (insertRes.error) {
          console.warn('Erro ao inserir senha no Supabase:', insertRes.error.message);
        }
      } catch (err) {
        console.warn('Exceção ao inserir senha no Supabase:', err);
      }
    }

    // 6. Persistência local de contingência caso esteja offline (ticket_number provisório)
    const newTicket: QueueTicket = {
      id: `ticket-${Date.now()}`,
      ticket_number: `${prefix}???`,
      service_type: serviceType,
      counter: '',
      status: 'waiting',
      student_id: resolvedStudentDbId,
      student_name: studentName,
      student_ra: studentRa || cleanRa || 'Presencial',
      student_course: studentCourse || 'Graduação FECAP',
      called_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (cleanRa && cleanRa !== 'presencial') {
      await safeStorage.setItem(`@asa_active_ticket_${cleanRa}`, JSON.stringify(newTicket));
    }
    const queue = await this.getQueue();
    const updated = [...queue.filter((t) => t.id !== newTicket.id), newTicket];
    await safeStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(updated));

    return newTicket;
  },

  /**
   * Aluno desiste da senha de atendimento (cancela a senha)
   */
  async cancelTicket(ticketId: string, studentRa?: string): Promise<boolean> {
    try {
      if (studentRa) {
        await safeStorage.removeItem(`@asa_active_ticket_${studentRa.trim().toLowerCase()}`);
      }
      if (isSupabaseConfigured) {
        let query = supabase
          .from('service_queue')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', ticketId);

        // T5: Aluno só pode cancelar a própria senha
        if (studentRa) {
          query = query.eq('student_ra', studentRa.trim());
        }

        const { error } = await query;
        if (error) {
          console.warn('Erro ao cancelar senha no Supabase:', error);
          return false;
        }
      }

      const raw = await safeStorage.getItem(LOCAL_QUEUE_KEY);
      if (raw) {
        const localQueue: QueueTicket[] = JSON.parse(raw);
        const updated = localQueue.filter((t) => t.id !== ticketId);
        await safeStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(updated));
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Conclui o atendimento de uma senha e salva no histórico persistente
   */
  async completeTicket(
    ticketId: string,
    studentRa?: string,
    completionData?: {
      outcome?: string;
      topics?: string[];
      summary?: string;
      staffName?: string;
    }
  ): Promise<boolean> {
    try {
      const nowIso = new Date().toISOString();
      let targetTicket: QueueTicket | null = null;

      // 1. Localiza o ticket na fila local ou no Supabase
      const raw = await safeStorage.getItem(LOCAL_QUEUE_KEY);
      let localQueue: QueueTicket[] = raw ? JSON.parse(raw) : [];
      const foundIdx = localQueue.findIndex((t) => t.id === ticketId);
      if (foundIdx !== -1) {
        targetTicket = localQueue[foundIdx];
      }

      const effectiveRa = studentRa || targetTicket?.student_ra || undefined;
      const cleanRa = effectiveRa ? effectiveRa.trim().toLowerCase() : undefined;

      if (cleanRa) {
        await safeStorage.removeItem(`@asa_active_ticket_${cleanRa}`);
      }

      if (isSupabaseConfigured) {
        try {
          const updatePayload: Record<string, any> = {
            status: 'completed',
            updated_at: nowIso,
          };
          await supabase
            .from('service_queue')
            .update(updatePayload)
            .eq('id', ticketId);
        } catch (dbErr) {
          console.warn('Erro ao atualizar status no Supabase:', dbErr);
        }
      }

      // Monta objeto completo do ticket concluído
      const completedTicket: QueueTicket = {
        id: ticketId,
        ticket_number: targetTicket?.ticket_number || 'A001',
        service_type: targetTicket?.service_type || 'Geral',
        counter: targetTicket?.counter || 'Guichê 01',
        status: 'completed',
        student_id: targetTicket?.student_id,
        student_name: targetTicket?.student_name,
        student_ra: effectiveRa || targetTicket?.student_ra,
        student_course: targetTicket?.student_course,
        called_at: targetTicket?.called_at,
        completed_at: nowIso,
        completion_data: completionData,
        created_at: targetTicket?.created_at || nowIso,
        updated_at: nowIso,
      };

      // Atualiza LOCAL_QUEUE_KEY mantendo o registro concluído
      if (foundIdx !== -1) {
        localQueue[foundIdx] = completedTicket;
      } else {
        localQueue.unshift(completedTicket);
      }
      await safeStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(localQueue.slice(0, 100)));

      // Salva no histórico individual persistente do estudante
      if (cleanRa) {
        const studentHistKey = `@asa_student_ticket_history_${cleanRa}`;
        const studentHistRaw = await safeStorage.getItem(studentHistKey);
        const studentHist: QueueTicket[] = studentHistRaw ? JSON.parse(studentHistRaw) : [];
        const filteredHist = studentHist.filter((t) => t.id !== ticketId);
        filteredHist.unshift(completedTicket);
        await safeStorage.setItem(studentHistKey, JSON.stringify(filteredHist.slice(0, 50)));
      }

      // Registra no histórico detalhado global de atendimentos presenciais concluídos
      const historyKey = '@asa_completed_tickets_history_v1';
      const histRaw = await safeStorage.getItem(historyKey);
      const histList = histRaw ? JSON.parse(histRaw) : [];
      histList.unshift({
        ticketId,
        ticket: completedTicket,
        studentRa: effectiveRa,
        completionData,
        completedAt: nowIso,
      });
      await safeStorage.setItem(historyKey, JSON.stringify(histList.slice(0, 100)));

      return true;
    } catch {
      return false;
    }
  },

  /**
   * Obtém o histórico persistente de senhas concluídas de um estudante
   */
  async getStudentTicketHistory(studentRa?: string): Promise<QueueTicket[]> {
    if (!studentRa) return [];
    const cleanRa = studentRa.trim().toLowerCase();

    // 1. Busca no histórico local do aluno
    const studentHistKey = `@asa_student_ticket_history_${cleanRa}`;
    const localHistRaw = await safeStorage.getItem(studentHistKey);
    let localList: QueueTicket[] = localHistRaw ? JSON.parse(localHistRaw) : [];

    // 2. Busca também do Supabase se configurado
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('service_queue')
          .select('*')
          .eq('status', 'completed')
          .order('updated_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const matchingSupabase = data.filter(
            (row: any) => (row.student_ra || '').trim().toLowerCase() === cleanRa
          );
          if (matchingSupabase.length > 0) {
            const mapped: QueueTicket[] = matchingSupabase.map((row: any) => ({
              id: row.id,
              ticket_number: row.ticket_number,
              service_type: row.service_type || 'Geral',
              counter: row.counter || 'Guichê 01',
              status: row.status,
              created_at: row.created_at,
              updated_at: row.updated_at,
              called_at: row.called_at,
              completed_at: row.updated_at,
              student_id: row.student_id,
              student_name: row.student_name,
              student_ra: row.student_ra,
              student_course: row.student_course,
            }));

            const idSet = new Set(mapped.map((m) => m.id));
            const merged = [...mapped, ...localList.filter((l) => !idSet.has(l.id))];
            await safeStorage.setItem(studentHistKey, JSON.stringify(merged.slice(0, 50)));
            return merged;
          }
        }
      } catch (e) {
        console.warn('Erro ao consultar histórico de senhas no Supabase:', e);
      }
    }

    return localList;
  },

  /**
   * Obtém a lista de todas as senhas concluídas para a Central CAA (visão do funcionário)
   */
  async getCompletedTicketsHistory(): Promise<QueueTicket[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('service_queue')
          .select('*')
          .eq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(50);

        if (!error && data && data.length > 0) {
          return data.map((row: any) => ({
            id: row.id,
            ticket_number: row.ticket_number,
            service_type: row.service_type || 'Geral',
            counter: row.counter || 'Guichê 01',
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
            called_at: row.called_at,
            completed_at: row.updated_at,
            student_id: row.student_id,
            student_name: row.student_name,
            student_ra: row.student_ra,
            student_course: row.student_course,
          }));
        }
      } catch (e) {
        console.warn('Erro ao carregar senhas concluídas do Supabase:', e);
      }
    }

    // Fallback: monta com base no LOCAL_QUEUE_KEY
    const raw = await safeStorage.getItem(LOCAL_QUEUE_KEY);
    if (raw) {
      const all: QueueTicket[] = JSON.parse(raw);
      return all.filter((t) => t.status === 'completed');
    }

    return [];
  },

  /**
   * Funcionário chama a próxima senha da fila presencial (respeitando prioridade legal e ordem crescente)
   */
  async callNextTicket(counter = 'Guichê 01'): Promise<QueueTicket | null> {
    try {
      await this.expireOutdatedTickets();

      if (isSupabaseConfigured) {
        const { data: waiting, error: findError } = await supabase
          .from('service_queue')
          .select('*')
          .eq('status', 'waiting')
          .order('created_at', { ascending: true });

        if (!findError && waiting && waiting.length > 0) {
          const validWaiting = (waiting as QueueTicket[]).filter((t) => !isQueueTicketExpired(t));
          if (validWaiting.length > 0) {
            validWaiting.sort((a, b) => {
              const aPrio = /priorit/i.test(a.service_type) || /^P/i.test(a.ticket_number) ? 0 : 1;
              const bPrio = /priorit/i.test(b.service_type) || /^P/i.test(b.ticket_number) ? 0 : 1;
              if (aPrio !== bPrio) return aPrio - bPrio;
              const seqA = parseTicketSequence(a.ticket_number);
              const seqB = parseTicketSequence(b.ticket_number);
              if (seqA !== seqB && seqA > 0 && seqB > 0) return seqA - seqB;
              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });

            const nextTicket = validWaiting[0];
            const { data: updated, error: updateError } = await supabase
              .from('service_queue')
              .update({
                status: 'called',
                counter,
                called_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', nextTicket.id)
              .select()
              .single();

            if (!updateError && updated) {
              const calledTicket = updated as QueueTicket;
              // T10: Notificação push agora é disparada exclusivamente pelo Webhook do banco de dados na Edge Function
              return calledTicket;
            }
          }
        }
      }

      const queue = await this.getQueue();
      const nextLocal = queue.find((t) => t.status === 'waiting');
      if (nextLocal) {
        nextLocal.status = 'called';
        nextLocal.counter = counter;
        nextLocal.called_at = new Date().toISOString();
        await safeStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(queue));
        return nextLocal;
      }
      return null;
    } catch (e) {
      console.warn('Erro ao chamar próxima senha:', e);
      return null;
    }
  },

  /**
   * Assina atualizações em tempo real da fila via Supabase Realtime
   */
  subscribeToQueue(onUpdate: (queue: QueueTicket[]) => void) {
    if (!isSupabaseConfigured) {
      return () => {};
    }

    const channelId = `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_queue' },
        async () => {
          const fresh = await queueService.getQueue();
          onUpdate(fresh);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
