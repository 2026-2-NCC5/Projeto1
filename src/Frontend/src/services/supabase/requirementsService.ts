import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Requirement, RequirementComment, RequirementAttachment, INITIAL_REQUIREMENTS } from '../../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REQUIREMENTS_STORAGE_KEY = '@asa_requirements';
const COMMENTS_STORAGE_KEY = '@asa_requirement_comments_v1';
const COMMENTS_DELIMITER = '\n\n---HISTÓRICO_ATUALIZAÇÕES---\n';

export interface EnrichedRequirement extends Requirement {
  studentId?: string;
  studentProfileId?: string;
  studentName?: string;
  studentRa?: string;
  studentCourse?: string;
  departmentDirection?: string; // Direcionamento cabível (Secretaria, Financeiro, Coordenação)
  attentionLevel?: 'Normal' | 'Atenção' | 'Urgente';
}


/**
 * Item 5: Remove a URL assinada temporária antes de persistir no banco,
 * salvando estritamente { id, name, path, mime, size, sizeBytes, uploadedAt, uploadedBy, authorName }.
 */
function sanitizeAttachmentForDb(att: RequirementAttachment): Record<string, any> {
  return {
    id: att.id,
    name: att.name,
    path: att.path || '',
    mime: att.mime || '',
    size: att.size || att.sizeBytes || 0,
    sizeBytes: att.sizeBytes || att.size || 0,
    uploadedAt: att.uploadedAt || new Date().toISOString(),
    uploadedBy: att.uploadedBy || 'Aluno',
    authorName: att.authorName,
  };
}

/**
 * Item 6: Gera signed URLs sob demanda para os anexos de UM requerimento específico.
 * Usar em batch (createSignedUrls) para eficiência.
 * NÃO chamar em getRequirements (que carrega todos).
 */
async function hydrateAttachmentsWithSignedUrls(
  attachments?: RequirementAttachment[]
): Promise<RequirementAttachment[]> {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  const paths = attachments.map((a) => a.path).filter(Boolean) as string[];
  if (paths.length === 0 || !isSupabaseConfigured) return attachments;

  try {
    const { data: signedList } = await supabase.storage
      .from('student-attachments')
      .createSignedUrls(paths, 7200);

    const urlMap: Record<string, string> = {};
    (signedList || []).forEach((item: { path: string | null; signedUrl: string | null; signedURL?: string | null }) => {
      const p = item.path;
      const u = item.signedUrl || item.signedURL;
      if (p && u) urlMap[p] = u;
    });

    return attachments.map((att) => ({
      ...att,
      url: att.path ? (urlMap[att.path] || att.url || '') : (att.url || ''),
    }));
  } catch (e) {
    console.warn('[requirementsService] Erro ao criar signed URLs em batch:', e);
    return attachments;
  }
}

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function mapStatusToDb(status?: string): 'Pendente' | 'Em Andamento' | 'Aprovado' | 'Rejeitado' {
  if (status === 'approved') return 'Aprovado';
  if (status === 'rejected') return 'Rejeitado';
  if (status === 'in_progress') return 'Em Andamento';
  return 'Pendente';
}

function mapStatus(rawStatus?: string): 'pending' | 'in_progress' | 'approved' | 'rejected' {
  const s = (rawStatus || '').toLowerCase();
  if (s === 'approved' || s.includes('concl') || s.includes('defer') || s.includes('aprov')) return 'approved';
  if (s === 'rejected' || s.includes('indefer') || s.includes('rejeit') || s.includes('cancel')) return 'rejected';
  if (s === 'in_progress' || s.includes('andamento') || s.includes('analise') || s.includes('análise') || s.includes('recebid')) return 'in_progress';
  return 'pending';
}

function getDirectionAndAttention(title: string, type: string) {
  const t = (title + ' ' + type).toLowerCase();
  if (t.includes('financ') || t.includes('bolsa') || t.includes('mensal') || t.includes('tranc')) {
    return { direction: 'Núcleo Financeiro / Permanência', attention: 'Urgente' as const };
  }
  if (t.includes('troca') || t.includes('transfer') || t.includes('dp') || t.includes('adapt') || t.includes('equival') || t.includes('revis')) {
    return { direction: 'Coordenação Pedagógica', attention: 'Atenção' as const };
  }
  return { direction: 'Secretaria Geral & Atendimento', attention: 'Normal' as const };
}

function parseDescriptionAndComments(rawDesc?: string): {
  cleanDescription: string;
  embeddedComments: RequirementComment[];
} {
  if (!rawDesc) {
    return { cleanDescription: '', embeddedComments: [] };
  }
  const parts = rawDesc.split(COMMENTS_DELIMITER);
  const cleanDescription = parts[0].trim();
  let embeddedComments: RequirementComment[] = [];
  if (parts.length > 1) {
    try {
      embeddedComments = JSON.parse(parts[1].trim());
    } catch {
      embeddedComments = [];
    }
  }
  return { cleanDescription, embeddedComments };
}

function serializeDescriptionAndComments(cleanDescription: string, comments: RequirementComment[]): string {
  if (!comments || comments.length === 0) return cleanDescription;
  return `${cleanDescription}${COMMENTS_DELIMITER}${JSON.stringify(comments)}`;
}

async function getLocalCommentsMap(): Promise<Record<string, RequirementComment[]>> {
  try {
    const raw = await AsyncStorage.getItem(COMMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveLocalComments(reqKey: string, comments: RequirementComment[]) {
  try {
    const map = await getLocalCommentsMap();
    map[reqKey] = comments;
    await AsyncStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function buildStepsForRequirement(
  status: 'pending' | 'in_progress' | 'approved' | 'rejected',
  currentStage: string,
  direction: string,
  createdAtFormatted: string,
  comments: RequirementComment[]
) {
  const isDone = status === 'approved' || status === 'rejected';
  const isInProgress = status === 'in_progress' || status === 'pending';

  const baseSteps = [
    {
      title: 'Abertura do Protocolo',
      description: 'Requerimento registrado via ASA App',
      completed: true,
      active: false,
      date: createdAtFormatted,
    },
    {
      title: currentStage || 'Triagem e Conferência',
      description: `Setor responsável: ${direction}`,
      completed: isDone,
      active: isInProgress,
      date: isDone ? 'Concluído' : 'Em andamento',
    },
  ];

  // Adiciona comentários como sub-etapas na linha do tempo também
  comments.forEach((c) => {
    baseSteps.push({
      title: `Atualização (${c.author})`,
      description: c.text,
      completed: true,
      active: false,
      date: c.createdAt,
    });
  });

  baseSteps.push({
    title:
      status === 'rejected'
        ? 'Parecer Final: Indeferido'
        : status === 'approved'
        ? 'Parecer Final: Deferido & Concluído'
        : 'Parecer Final & Conclusão',
    description:
      status === 'approved'
        ? 'Despacho favorável emitido pela Secretaria Acadêmica'
        : status === 'rejected'
        ? 'Solicitação encerrada com parecer técnico'
        : 'Aguardando conclusão da análise técnica',
    completed: isDone,
    active: false,
    date: isDone ? new Date().toLocaleDateString('pt-BR') : 'Pendente',
  });

  return baseSteps;
}

export const requirementsService = {
  /**
   * Carrega requerimentos com dados do aluno, comentários e etapas da linha do tempo.
   * O banco de dados Supabase é a fonte da verdade oficial.
   */
  async getRequirements(userId?: string): Promise<EnrichedRequirement[]> {
    try {
      const localCommentsMap = await getLocalCommentsMap();

      if (isSupabaseConfigured) {
        // T7: Client autenticado com RLS e filtragem rigorosa por perfil
        const { data: authData } = await supabase.auth.getUser();
        const currentUserId = authData?.user?.id;

        let query = supabase
          .from('student_requirements')
          .select('*, students(id, profile_id, ra, name, course)')
          .order('created_at', { ascending: false });

        if (userId) {
          query = query.eq('student_id', userId);
        } else if (currentUserId) {
          // Se for aluno autenticado, filtra os próprios requerimentos
          const { data: prof } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUserId)
            .maybeSingle();

          if (prof?.role === 'Aluno') {
            // Busca o students.id correspondente ao profile_id
            const { data: stRow } = await supabase
              .from('students')
              .select('id')
              .eq('profile_id', currentUserId)
              .maybeSingle();

            if (stRow?.id) {
              query = query.eq('student_id', stRow.id);
            } else {
              query = query.eq('student_id', currentUserId);
            }
          }
        }

        const { data, error } = await query;

        // Se a consulta no Supabase retornou com sucesso, respeita fielmente o banco
        // (inclusive se o usuário tiver apagado requerimentos no banco e a lista estiver vazia)
        if (!error && data !== null) {
          if (data.length === 0) {
            await AsyncStorage.setItem(REQUIREMENTS_STORAGE_KEY, JSON.stringify([]));
            return [];
          }

          // Carrega as etapas reais gravadas na tabela requirement_steps para linha do tempo precisa
          const reqIds = data.map((d: any) => d.id).filter(Boolean);
          let dbStepsByReq: Record<string, any[]> = {};
          if (reqIds.length > 0) {
            try {
              const { data: stepsData } = await supabase
                .from('requirement_steps')
                .select('*')
                .in('requirement_id', reqIds)
                .order('order_index', { ascending: true });

              if (stepsData) {
                stepsData.forEach((st: any) => {
                  const key = String(st.requirement_id);
                  if (!dbStepsByReq[key]) dbStepsByReq[key] = [];
                  const stepDateObj = st.step_date ? new Date(st.step_date) : null;
                  const formattedStepDate =
                    stepDateObj && !isNaN(stepDateObj.getTime())
                      ? `${stepDateObj.toLocaleDateString('pt-BR')} ${stepDateObj.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : st.date || undefined;

                  dbStepsByReq[key].push({
                    title: st.title,
                    description: st.description,
                    completed: Boolean(st.completed),
                    active: Boolean(st.active),
                    date: formattedStepDate,
                    authorName: st.author_name || undefined,
                    authorRole: st.author_role || undefined,
                    stage: st.stage || undefined,
                  });
                });
              }
            } catch (stepErr) {
              console.warn('Erro ao carregar requirement_steps:', stepErr);
            }
          }

          let commentsCacheDirty = false;

          const mapped: EnrichedRequirement[] = data.map((item: any) => {
            const st = item.students || {};
            const info = getDirectionAndAttention(item.title || '', item.type || '');
            const mappedStatus = mapStatus(item.status);
            const { cleanDescription, embeddedComments } = parseDescriptionAndComments(item.description);

            // Mescla comentários vindos do Supabase (fonte oficial da verdade) com eventuais comentários locais ainda não sincronizados
            const remoteComments: RequirementComment[] = Array.isArray(embeddedComments) ? embeddedComments : [];
            const localById: RequirementComment[] = localCommentsMap[item.id] || localCommentsMap[item.protocol] || [];
            const mergedComments: RequirementComment[] = [...remoteComments];
            const seenKeys = new Set(
              remoteComments.map((c) => `${c.id}::${(c.text || '').trim()}`)
            );
            const seenIds = new Set(remoteComments.map((c) => c.id));

            for (const lc of localById) {
              const composite = `${lc.id}::${(lc.text || '').trim()}`;
              if (!seenIds.has(lc.id) && !seenKeys.has(composite)) {
                mergedComments.push(lc);
                seenIds.add(lc.id);
                seenKeys.add(composite);
              }
            }

            if (mergedComments.length > 0 && mergedComments.length !== localById.length) {
              localCommentsMap[String(item.id)] = mergedComments;
              if (item.protocol) {
                localCommentsMap[String(item.protocol)] = mergedComments;
              }
              commentsCacheDirty = true;
            }

            const storedComments = mergedComments;

            const createdFormatted = item.created_at
              ? new Date(item.created_at).toLocaleDateString('pt-BR')
              : '10/08/2026';

            // Utiliza as etapas salvas no banco se existirem, ou monta linha do tempo dinâmica
            const reqStepsFromDb = dbStepsByReq[String(item.id)];
            const steps = reqStepsFromDb && reqStepsFromDb.length > 0
              ? reqStepsFromDb
              : buildStepsForRequirement(
                  mappedStatus,
                  item.current_stage || 'Em Análise',
                  info.direction,
                  createdFormatted,
                  storedComments
                );

            return {
              id: String(item.id),
              protocol: item.protocol || `REQ-2026-${item.id}`,
              title: item.title,
              type: item.type || 'Secretaria Acadêmica',
              currentStage: item.current_stage || 'Recebido',
              status: mappedStatus,
              createdAt: item.created_at ? item.created_at.split('T')[0] : '2026-08-20',
              updatedAt: item.updated_at ? item.updated_at.split('T')[0] : '2026-08-25',
              description: cleanDescription || `Requerimento de ${item.title} para análise institucional.`,
              comments: storedComments,
              studentAttachments: item.student_attachments || [],
              staffAttachments: item.staff_attachments || [],
              cancellationReason: item.cancellation_reason || undefined,
              steps,
              studentId: item.student_id ? String(item.student_id) : st.id ? String(st.id) : undefined,
              studentProfileId: st.profile_id ? String(st.profile_id) : undefined,
              studentName: st.name || 'Lucas Alvarista',
              studentRa: st.ra || '24026851',
              studentCourse: st.course || 'Ciência da Computação',
              departmentDirection: info.direction,
              attentionLevel: info.attention,
            };
          });

          if (commentsCacheDirty) {
            AsyncStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(localCommentsMap)).catch(() => {});
          }

          await AsyncStorage.setItem(REQUIREMENTS_STORAGE_KEY, JSON.stringify(mapped));
          return mapped;
        }
      }

      // Fallback para cache local seguro se offline
      const stored = await AsyncStorage.getItem(REQUIREMENTS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }

      return INITIAL_REQUIREMENTS;
    } catch (e) {
      console.warn('Erro ao carregar requerimentos:', e);
      return [];
    }
  },

  async getRequirementById(id: string): Promise<EnrichedRequirement | null> {
    const list = await this.getRequirements();
    return list.find((req) => req.id === id || req.protocol === id) || null;
  },

  /**
   * Item 6: Gera signed URL sob demanda (ao tocar) para um anexo individual.
   */
  async getAttachmentSignedUrl(storagePath: string): Promise<string | null> {
    if (!storagePath || !isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase.storage
        .from('student-attachments')
        .createSignedUrl(storagePath, 7200);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    } catch {
      return null;
    }
  },

  /**
   * Item 6: Gera signed URLs em lote (createSignedUrls) apenas para o requerimento aberto.
   */
  async getSignedUrlsForRequirement(req: EnrichedRequirement): Promise<EnrichedRequirement> {
    const [hydratedStudent, hydratedStaff] = await Promise.all([
      hydrateAttachmentsWithSignedUrls(req.studentAttachments),
      hydrateAttachmentsWithSignedUrls(req.staffAttachments),
    ]);
    return {
      ...req,
      studentAttachments: hydratedStudent,
      staffAttachments: hydratedStaff,
    };
  },

  /**
   * Busca todos os requerimentos de um aluno específico (por RA, ID ou Nome)
   */
  async getRequirementsByStudent(params: {
    ra?: string;
    studentId?: string;
    name?: string;
    course?: string;
  }): Promise<EnrichedRequirement[]> {
    const all = await this.getRequirements();
    const matched = all.filter((r) => {
      if (params.ra && r.studentRa && String(r.studentRa).trim() === String(params.ra).trim()) {
        return true;
      }
      if (params.studentId && r.studentId && String(r.studentId) === String(params.studentId)) {
        return true;
      }
      if (
        params.name &&
        r.studentName &&
        r.studentName.toLowerCase().trim() === params.name.toLowerCase().trim()
      ) {
        return true;
      }
      return false;
    });

    return matched;
  },

  /**
   * Atualiza o status, etapa atual, salva etapa na linha do tempo (steps) e adiciona comentário ao protocolo
   */
  async updateRequirementStatusAndComment(params: {
    requirementId: string;
    protocol: string;
    newStatus: 'pending' | 'in_progress' | 'approved' | 'rejected';
    newStage: string;
    commentText?: string;
    authorName?: string;
    authorRole?: 'Funcionário' | 'Aluno';
  }): Promise<EnrichedRequirement | null> {
    const {
      requirementId,
      protocol,
      newStatus,
      newStage,
      commentText,
      authorName = 'Equipe CAA FECAP',
      authorRole = 'Funcionário',
    } = params;

    const currentList = await this.getRequirements();
    const target = currentList.find((r) => r.id === requirementId || r.protocol === protocol);

    const existingComments: RequirementComment[] = target?.comments ? [...target.comments] : [];
    const nowFormatted =
      new Date().toLocaleDateString('pt-BR') +
      ' ' +
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowIso = new Date().toISOString();

    if (commentText && commentText.trim().length > 0) {
      existingComments.push({
        id: `comment-${Date.now()}`,
        author: authorName,
        role: authorRole,
        text: commentText.trim(),
        statusSnapshot: newStage,
        createdAt: nowFormatted,
      });
    }

    await saveLocalComments(requirementId, existingComments);
    if (protocol) {
      await saveLocalComments(protocol, existingComments);
    }

    const cleanDesc = target?.description || 'Requerimento institucional.';
    const serializedDescription = serializeDescriptionAndComments(cleanDesc, existingComments);
    const updatedDate = new Date().toISOString().split('T')[0];

    // Atualiza no Supabase
    if (isSupabaseConfigured) {
      try {
        const dbStatus = mapStatusToDb(newStatus);
        const updatePayload: Record<string, any> = {
          status: dbStatus,
          current_stage: newStage,
          description: serializedDescription,
          updated_at: nowIso,
        };

        const isNumericId = /^\d+$/.test(requirementId);
        if (isNumericId) {
          await supabase
            .from('student_requirements')
            .update(updatePayload)
            .eq('id', Number(requirementId));
        } else if (protocol) {
          await supabase
            .from('student_requirements')
            .update(updatePayload)
            .eq('protocol', protocol);
        } else {
          await supabase
            .from('student_requirements')
            .update(updatePayload)
            .eq('id', requirementId);
        }

        // Registra nova etapa na tabela requirement_steps (Linha do Tempo persistida)
        const targetDbId = target?.id && target.id.includes('-') ? target.id : generateUuid();
        const stepOrder = (target?.steps?.length || 2) + 1;

        // Marca etapas anteriores como concluídas para destacar apenas a etapa atual
        await supabase
          .from('requirement_steps')
          .update({ completed: true, active: false })
          .eq('requirement_id', targetDbId);

        await supabase.from('requirement_steps').insert({
          id: generateUuid(),
          requirement_id: targetDbId,
          title: newStage,
          description: commentText
            ? `${commentText} • Registrado por ${authorName} (${authorRole})`
            : `Fase do processo atualizada para "${newStage}" por ${authorName}.`,
          completed: newStatus === 'approved' || newStatus === 'rejected',
          active: newStatus === 'in_progress' || newStatus === 'pending',
          step_date: nowIso,
          order_index: stepOrder,
          author_name: authorName,
          author_role: authorRole,
          stage: newStage,
        });

        // Se concluído ou indeferido, insere o parecer final na linha do tempo
        if (newStatus === 'approved' || newStatus === 'rejected') {
          await supabase.from('requirement_steps').insert({
            id: generateUuid(),
            requirement_id: targetDbId,
            title: newStatus === 'approved' ? 'Parecer Final: Deferido & Concluído' : 'Parecer Final: Indeferido',
            description: commentText || (newStatus === 'approved' ? 'Despacho favorável e processo finalizado.' : 'Solicitação encerrada com indeferimento técnico.'),
            completed: true,
            active: false,
            step_date: nowIso,
            order_index: stepOrder + 1,
            author_name: authorName,
            author_role: authorRole,
            stage: 'Concluído',
          });
        }
      } catch (err) {
        console.warn('Erro ao atualizar requerimento e steps no Supabase:', err);
      }
    }

    if (isSupabaseConfigured) {
      const freshFromDb = await this.getRequirementById(protocol || requirementId);
      if (freshFromDb) {
        return freshFromDb;
      }
    }

    const direction = target?.departmentDirection || 'Secretaria Geral & Atendimento';
    const updatedSteps = buildStepsForRequirement(
      newStatus,
      newStage,
      direction,
      target?.createdAt || '10/08/2026',
      existingComments
    );

    const updatedItem: EnrichedRequirement = {
      ...(target || {
        id: requirementId,
        protocol,
        title: 'Requerimento Acadêmico',
        type: 'Secretaria Acadêmica',
        createdAt: updatedDate,
        description: cleanDesc,
      }),
      status: newStatus,
      currentStage: newStage,
      updatedAt: updatedDate,
      comments: existingComments,
      steps: updatedSteps,
    };

    const newList = currentList.map((item) =>
      item.id === requirementId || item.protocol === protocol ? updatedItem : item
    );
    await AsyncStorage.setItem(REQUIREMENTS_STORAGE_KEY, JSON.stringify(newList));

    return updatedItem;
  },

  async createRequirement(
    newReq: Omit<Requirement, 'id' | 'createdAt' | 'updatedAt' | 'protocol'> & {
      studentRa?: string;
      studentName?: string;
      studentCourse?: string;
    }
  ): Promise<EnrichedRequirement> {
    const protocolNumber = `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    const info = getDirectionAndAttention(newReq.title || '', newReq.type || '');

    const initialComment: RequirementComment = {
      id: `comment-init-${Date.now()}`,
      author: 'Sistema SISA / CAA',
      role: 'Sistema',
      text: `Protocolo ${protocolNumber} registrado e encaminhado para ${info.direction}.`,
      statusSnapshot: newReq.currentStage || 'Aguardando Triagem CAA',
      createdAt:
        new Date().toLocaleDateString('pt-BR') +
        ' ' +
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const comments = newReq.comments && newReq.comments.length > 0 ? newReq.comments : [initialComment];
    const newRequirementUuid = generateUuid();
    let insertedId = newRequirementUuid;

    if (isSupabaseConfigured) {
      try {
        let studentId: string | null = null;
        if (newReq.studentRa) {
          const { data: stData } = await supabase
            .from('students')
            .select('id')
            .eq('ra', String(newReq.studentRa).trim())
            .maybeSingle();
          if (stData?.id) studentId = String(stData.id);
        }

        if (!studentId) {
          const { data: anyStudent } = await supabase
            .from('students')
            .select('id')
            .limit(1)
            .maybeSingle();
          studentId = anyStudent?.id || newRequirementUuid;
        }

        const serializedDesc = serializeDescriptionAndComments(newReq.description, comments);
        const dbStatus = mapStatusToDb(newReq.status);

        const insertPayload: Record<string, any> = {
          id: newRequirementUuid,
          protocol: protocolNumber,
          student_id: studentId,
          title: newReq.title,
          type: newReq.type || 'Secretaria Acadêmica',
          current_stage: newReq.currentStage || 'Aguardando Triagem CAA',
          status: dbStatus,
          description: serializedDesc,
        };

        if (newReq.studentAttachments && newReq.studentAttachments.length > 0) {
          insertPayload.student_attachments = newReq.studentAttachments.map(sanitizeAttachmentForDb);
        }

        const { data: insData, error: insErr } = await supabase
          .from('student_requirements')
          .insert(insertPayload)
          .select('id')
          .maybeSingle();

        if (insErr) {
          console.warn('Erro ao inserir requerimento no Supabase:', insErr);
        } else if (insData?.id) {
          insertedId = String(insData.id);
        }

        // Insere a etapa inicial na linha do tempo requirement_steps
        await supabase.from('requirement_steps').insert({
          id: generateUuid(),
          requirement_id: insertedId,
          title: 'Abertura do Protocolo',
          description: 'Requerimento protocolado via ASA App.',
          completed: true,
          active: false,
          step_date: nowIso,
          order_index: 1,
          author_name: newReq.studentName || 'Aluno',
          author_role: 'Aluno',
          stage: 'Abertura',
        });
      } catch (err) {
        console.warn('Erro ao salvar requerimento no Supabase:', err);
      }
    }

    await saveLocalComments(insertedId, comments);
    await saveLocalComments(protocolNumber, comments);

    const initialSteps = [
      {
        title: 'Abertura do Protocolo',
        description: 'Requerimento protocolado via ASA App',
        completed: true,
        active: false,
        date: new Date().toLocaleDateString('pt-BR'),
      },
      {
        title: newReq.currentStage || 'Aguardando Triagem CAA',
        description: `Setor responsável: ${info.direction}`,
        completed: false,
        active: true,
        date: 'Em andamento',
      },
    ];

    const fullReq: EnrichedRequirement = {
      ...newReq,
      id: insertedId,
      protocol: protocolNumber,
      createdAt: today,
      updatedAt: today,
      comments,
      steps: initialSteps,
      studentAttachments: newReq.studentAttachments || [],
      staffAttachments: newReq.staffAttachments || [],
      studentName: newReq.studentName || 'Lucas Alvarista',
      studentRa: newReq.studentRa || '24026851',
      studentCourse: newReq.studentCourse || 'Ciência da Computação',
      departmentDirection: info.direction,
      attentionLevel: info.attention,
    };

    const currentList = await this.getRequirements();
    const updatedList = [fullReq, ...currentList.filter((r) => r.protocol !== protocolNumber)];
    await AsyncStorage.setItem(REQUIREMENTS_STORAGE_KEY, JSON.stringify(updatedList));

    return fullReq;
  },

  /**
   * Cancela um requerimento a pedido do aluno informando a justificativa
   */
  /**
   * T7: Cancela um requerimento via RPC segura cancel_requirement(p_requirement_id, p_reason)
   */
  async cancelRequirement(params: {
    requirementId: string;
    protocol?: string;
    reason: string;
    authorName?: string;
  }): Promise<EnrichedRequirement | null> {
    const { requirementId, protocol, reason, authorName = 'Aluno' } = params;

    const currentList = await this.getRequirements();
    const target = currentList.find((r) => r.id === requirementId || r.protocol === protocol);

    const justification = reason.trim() || 'Desistência solicitada pelo estudante.';

    if (isSupabaseConfigured) {
      try {
        const { error: rpcErr } = await supabase.rpc('cancel_requirement', {
          p_requirement_id: String(target?.id || requirementId),
          p_reason: justification,
        });

        if (rpcErr) {
          console.warn('Erro ao chamar RPC cancel_requirement:', rpcErr);
        }
      } catch (e) {
        console.warn('Exceção ao cancelar requerimento via RPC:', e);
      }
    }

    const updated = await this.updateRequirementStatusAndComment({
      requirementId,
      protocol: protocol || target?.protocol || requirementId,
      newStatus: 'rejected',
      newStage: 'Cancelado pelo Aluno',
      commentText: `Solicitação de cancelamento registrada pelo estudante. Motivo informado: "${justification}".`,
      authorName,
      authorRole: 'Aluno',
    });

    if (updated) {
      updated.cancellationReason = justification;
      const freshList = currentList.map((r) =>
        r.id === requirementId || r.protocol === protocol ? { ...updated, cancellationReason: justification } : r
      );
      await AsyncStorage.setItem(REQUIREMENTS_STORAGE_KEY, JSON.stringify(freshList));
    }

    return updated;
  },

  /**
   * T7: Avalia a resolução de um requerimento via RPC rate_requirement(p_id, p_rating, p_comment)
   */
  async rateRequirement(params: {
    requirementId: string;
    rating: number;
    comment?: string;
  }): Promise<boolean> {
    const { requirementId, rating, comment } = params;
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.rpc('rate_requirement', {
          p_id: String(requirementId),
          p_rating: Math.min(5, Math.max(1, Math.round(rating))),
          p_comment: comment?.trim() || null,
        });
        if (error) {
          console.warn('Erro ao avaliar requerimento via RPC:', error);
          return false;
        }
        return true;
      } catch (e) {
        console.warn('Exceção ao avaliar requerimento:', e);
        return false;
      }
    }
    return true;
  },

  /**
   * Exclui permanentemente um requerimento da base de dados Supabase e do cache local
   */
  /**
   * T7: Exclui permanentemente um requerimento (Apenas STAFF permitido)
   */
  async deleteRequirement(id: string, protocol?: string): Promise<boolean> {
    try {
      if (isSupabaseConfigured) {
        // T7: Validação de perfil - apenas Staff/Admin pode excluir
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (prof?.role === 'Aluno') {
            console.warn('Operação negada: Estudantes não possuem permissão para excluir requerimentos.');
            return false;
          }
        }

        const isNumeric = /^\d+$/.test(id);

        // Remove etapas associadas primeiro
        if (id) {
          try {
            await supabase.from('requirement_steps').delete().eq('requirement_id', id);
          } catch {
            // ignore
          }
        }

        // Remove o requerimento oficial
        if (isNumeric) {
          await supabase.from('student_requirements').delete().eq('id', Number(id));
        }
        if (protocol) {
          await supabase.from('student_requirements').delete().eq('protocol', protocol);
        }
        if (id && !isNumeric) {
          await supabase.from('student_requirements').delete().eq('id', id);
        }
      }

      // Atualiza o storage local removendo definitivamente
      const rawStored = await AsyncStorage.getItem(REQUIREMENTS_STORAGE_KEY);
      const list: EnrichedRequirement[] = rawStored ? JSON.parse(rawStored) : [];
      const filtered = list.filter(
        (r) => r.id !== id && r.protocol !== protocol && r.protocol !== id
      );
      await AsyncStorage.setItem(REQUIREMENTS_STORAGE_KEY, JSON.stringify(filtered));

      return true;
    } catch (e) {
      console.warn('Erro ao excluir requerimento:', e);
      return false;
    }
  },

  /**
   * Inscrição Realtime no Supabase para atualizações instantâneas de requerimentos
   */
  subscribeToRequirements(onUpdate: () => void) {
    if (!isSupabaseConfigured) return () => {};

    const channelId = `reqs_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_requirements',
        },
        () => {
          onUpdate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requirement_steps',
        },
        () => {
          onUpdate();
        }
      );

    try {
      channel.subscribe();
    } catch (e) {
      console.warn('Erro ao assinar canal de requerimentos:', e);
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
   * Adiciona um anexo (documento/imagem) enviado pelo aluno ou pela equipe FECAP
   */
  async addAttachmentToRequirement(params: {
    requirementId: string;
    protocol?: string;
    attachment: RequirementAttachment;
    role: 'student' | 'staff';
  }): Promise<EnrichedRequirement | null> {
    const { requirementId, protocol, attachment, role } = params;
    const currentList = await this.getRequirements();
    const target = currentList.find((r) => r.id === requirementId || r.protocol === protocol);

    if (!target) return null;

    const studentAttachments = target.studentAttachments ? [...target.studentAttachments] : [];
    const staffAttachments = target.staffAttachments ? [...target.staffAttachments] : [];

    if (role === 'student') {
      studentAttachments.push(attachment);
    } else {
      staffAttachments.push(attachment);
    }

    if (isSupabaseConfigured) {
      try {
        const payload: Record<string, any> = {};
        if (role === 'student') {
          payload.student_attachments = studentAttachments.map(sanitizeAttachmentForDb);
        } else {
          payload.staff_attachments = staffAttachments.map(sanitizeAttachmentForDb);
        }

        const isNumeric = /^\d+$/.test(requirementId);
        if (isNumeric) {
          await supabase.from('student_requirements').update(payload).eq('id', Number(requirementId));
        } else if (protocol) {
          await supabase.from('student_requirements').update(payload).eq('protocol', protocol);
        } else {
          await supabase.from('student_requirements').update(payload).eq('id', requirementId);
        }
      } catch (err) {
        console.warn('Erro ao atualizar anexos no Supabase:', err);
      }
    }

    const updated: EnrichedRequirement = {
      ...target,
      studentAttachments,
      staffAttachments,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    const updatedList = currentList.map((r) =>
      r.id === requirementId || r.protocol === protocol ? updated : r
    );
    await AsyncStorage.setItem(REQUIREMENTS_STORAGE_KEY, JSON.stringify(updatedList));

    return updated;
  },

  /**
   * Remove um anexo do requerimento (enviado pelo aluno ou funcionário) e sincroniza com o Supabase e storage
   */
  async removeAttachmentFromRequirement(params: {
    requirementId: string;
    protocol?: string;
    attachmentId: string;
    role?: 'student' | 'staff';
  }): Promise<EnrichedRequirement | null> {
    const { requirementId, protocol, attachmentId, role } = params;
    const currentList = await this.getRequirements();
    const target = currentList.find((r) => r.id === requirementId || r.protocol === protocol);

    if (!target) return null;

    let studentAttachments = target.studentAttachments ? [...target.studentAttachments] : [];
    let staffAttachments = target.staffAttachments ? [...target.staffAttachments] : [];

    const targetAttachment =
      studentAttachments.find((a) => a.id === attachmentId) ||
      staffAttachments.find((a) => a.id === attachmentId);

    if (role === 'student') {
      studentAttachments = studentAttachments.filter((a) => a.id !== attachmentId);
    } else if (role === 'staff') {
      staffAttachments = staffAttachments.filter((a) => a.id !== attachmentId);
    } else {
      studentAttachments = studentAttachments.filter((a) => a.id !== attachmentId);
      staffAttachments = staffAttachments.filter((a) => a.id !== attachmentId);
    }

    if (isSupabaseConfigured) {
      try {
        const payload: Record<string, any> = {
          student_attachments: studentAttachments,
          staff_attachments: staffAttachments,
        };

        const isNumeric = /^\d+$/.test(requirementId);
        if (isNumeric) {
          await supabase.from('student_requirements').update(payload).eq('id', Number(requirementId));
        } else if (protocol) {
          await supabase.from('student_requirements').update(payload).eq('protocol', protocol);
        } else {
          await supabase.from('student_requirements').update(payload).eq('id', requirementId);
        }

        if (targetAttachment?.url && targetAttachment.url.includes('/requerimentos-anexos/')) {
          try {
            const parts = targetAttachment.url.split('/requerimentos-anexos/');
            if (parts.length > 1) {
              const storagePath = decodeURIComponent(parts[1]);
              await supabase.storage.from('requerimentos-anexos').remove([storagePath]);
            }
          } catch (storageErr) {
            console.warn('Erro ao remover anexo do bucket de storage:', storageErr);
          }
        }
      } catch (err) {
        console.warn('Erro ao atualizar anexos removidos no Supabase:', err);
      }
    }

    const updated: EnrichedRequirement = {
      ...target,
      studentAttachments,
      staffAttachments,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    const updatedList = currentList.map((r) =>
      r.id === requirementId || r.protocol === protocol ? updated : r
    );
    await AsyncStorage.setItem(REQUIREMENTS_STORAGE_KEY, JSON.stringify(updatedList));

    return updated;
  },
};
