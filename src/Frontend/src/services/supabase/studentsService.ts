import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  studentRiskService,
  enrichStudentWithRequirements,
  StudentRiskProfile,
  RiskCategory,
} from '../ai-agent/studentRiskService';
import safeStorage from '../../utils/safeStorage';

const dbClient = supabase;

export interface StudentBase {
  id: string;
  ra: string;
  name: string;
  course: string;
  grau_academico?: string;
  turno?: string;
  periodo_ingresso?: string;
  periodo_letivo_atual?: string;
  semestre?: string;
  status_academico: 'Matriculado' | 'Formado' | 'Evasão' | string;
  avatarUrl?: string;
  created_at?: string;
}

export interface StudentWithRisk extends StudentBase {
  risk?: {
    overall_risk_score: number;
    category: RiskCategory;
    temporal_trend: 'Piorando' | 'Estável' | 'Melhorando' | 'Estavel';
    trend_variation: string;
    score_financeiro: number;
    status_financeiro: string;
    detail_financeiro: string;
    score_academico: number;
    status_academico: string;
    detail_academico: string;
    score_relacionamento: number;
    status_relacionamento: string;
    detail_relacionamento: string;
    score_geografico: number;
    status_geografico: string;
    detail_geografico: string;
    explanation: string;
    recommendation: string;
  };
}

export interface StudentFullProfile extends StudentWithRisk {
  contacts?: {
    idade: number;
    bairro: string;
    cidade: string;
    estado: string;
    estado_civil: string;
    sexo: string;
    logradouro?: string;
    cep?: string;
    distancia_km?: number;
    distancia_texto?: string;
  };
  financials?: {
    periodo_letivo: string;
    parcela: number;
    servico_parcela: string;
    bolsa_aluno: string;
    valor_original: number;
    status_parcela: string;
    data_vencimento: string;
  }[];
  academic_history?: {
    ano_semestre_letivo: string;
    disciplina: string;
    situacao: string;
    nota_obtida: number;
    nota_distribuida: number;
    faltas_lancadas: number;
    pct_assiduidade?: number;
  }[];
  relationships?: {
    tema_relacionamento: string;
    motivo_contato: string;
    created_at?: string;
  }[];
}

export const studentsService = {
  /**
   * Consulta paginada da Base Geral de Alunos (Ativos, Formados e Evadidos)
   */
  async searchGeneralBase(params: {
    query?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: StudentBase[]; total: number }> {
    const { query = '', status = 'Todos', page = 1, pageSize = 20 } = params;
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    try {
      if (isSupabaseConfigured) {
        let req = dbClient
          .from('students')
          .select('*, profiles(avatar_url)', { count: 'exact' });

        if (status && status !== 'Todos') {
          req = req.eq('status_academico', status);
        }

        if (query.trim()) {
          // T11: Higienização contra injeção de delimitadores no filtro PostgREST .or()
          const cleanQ = query.trim().replace(/[^a-zA-Z0-9À-ÿ\s]/g, '');
          const q = `%${cleanQ}%`;
          req = req.or(`name.ilike.${q},ra.ilike.${q},course.ilike.${q}`);
        }

        req = req.order('name', { ascending: true }).range(fromIndex, toIndex);

        const { data, count, error } = await req;
        if (!error && data) {
          const mapped: StudentBase[] = await Promise.all(
            data.map(async (st: any) => {
              let av = st.profiles?.avatar_url;
              if (!av && st.ra) {
                av = (await safeStorage.getItem(`@asa_avatar_${st.ra}`)) || undefined;
              }
              return {
                id: st.id,
                ra: st.ra,
                name: st.name,
                course: st.course,
                grau_academico: st.grau_academico,
                turno: st.turno,
                periodo_ingresso: st.periodo_ingresso,
                periodo_letivo_atual: st.periodo_letivo_atual,
                semestre: st.semestre,
                status_academico: st.status_academico,
                avatarUrl: av,
                created_at: st.created_at,
              };
            })
          );
          return {
            data: mapped,
            total: count || mapped.length,
          };
        }
      }

      return { data: [], total: 0 };
    } catch (e) {
      console.warn('Erro ao consultar Base Geral de Alunos:', e);
      return { data: [], total: 0 };
    }
  },

  /**
   * Retorna métricas globais da base para a Central CAA
   */
  async getBaseMetrics(): Promise<{
    total: number;
    matriculados: number;
    formados: number;
    evasao: number;
  }> {
    try {
      if (isSupabaseConfigured) {
        const [totalRes, matRes, formRes, evasRes] = await Promise.all([
          dbClient.from('students').select('*', { count: 'exact', head: true }),
          dbClient.from('students').select('*', { count: 'exact', head: true }).eq('status_academico', 'Matriculado'),
          dbClient.from('students').select('*', { count: 'exact', head: true }).eq('status_academico', 'Formado'),
          dbClient.from('students').select('*', { count: 'exact', head: true }).eq('status_academico', 'Evasão'),
        ]);

        return {
          total: totalRes.count || 392,
          matriculados: matRes.count || 352,
          formados: formRes.count || 20,
          evasao: evasRes.count || 20,
        };
      }
    } catch (e) {
      console.warn('Erro ao obter métricas de alunos:', e);
    }

    return { total: 392, matriculados: 352, formados: 20, evasao: 20 };
  },

  /**
   * Obtém alunos com seus scores calculados para a Tela de Fragilidade (Score 4D)
   */
  async getStudentsWithRiskScores(category?: 'Todos' | RiskCategory): Promise<StudentRiskProfile[]> {
    let rawList: StudentRiskProfile[] = [];

    try {
      if (isSupabaseConfigured) {
        let req = dbClient
          .from('students')
          .select(`
            id,
            ra,
            name,
            course,
            semestre,
            turno,
            status_academico,
            profiles(avatar_url),
            student_risk_scores!inner(
              overall_risk_score,
              category,
              temporal_trend,
              trend_variation,
              score_financeiro,
              status_financeiro,
              detail_financeiro,
              score_academico,
              status_academico,
              detail_academico,
              score_relacionamento,
              status_relacionamento,
              detail_relacionamento,
              score_geografico,
              status_geografico,
              detail_geografico,
              explanation,
              recommendation
            )
          `);

        if (category && category !== 'Todos') {
          req = req.eq('student_risk_scores.category', category);
        }

        req = req.order('name', { ascending: true });

        const { data, error } = await req;
        if (!error && data && data.length > 0) {
          rawList = await Promise.all(
            data.map(async (item: any) => {
              const r = Array.isArray(item.student_risk_scores) ? item.student_risk_scores[0] : item.student_risk_scores;
              let av = item.profiles?.avatar_url;
              if (!av && item.ra) {
                av = (await safeStorage.getItem(`@asa_avatar_${item.ra}`)) || undefined;
              }
              return {
                id: item.id,
                ra: item.ra,
                name: item.name,
                course: item.course,
                semester: item.semestre || '4º Semestre',
                turno: item.turno || 'Noturno',
                status_academico: item.status_academico || 'Matriculado',
                avatarUrl: av,
                category: (r?.category || 'Verde') as RiskCategory,
                overallRiskScore: r?.overall_risk_score || 25,
                temporalTrend: (r?.temporal_trend || 'Estável') as any,
                trendVariation: r?.trend_variation || '±0%',
                historyScores: [
                  { month: 'Jun', score: Math.max(10, (r?.overall_risk_score || 25) - 4) },
                  { month: 'Jul', score: Math.max(10, (r?.overall_risk_score || 25) - 2) },
                  { month: 'Ago', score: r?.overall_risk_score || 25 },
                ],
                dimensions: {
                  financeira: {
                    score: r?.score_financeiro || 20,
                    status: r?.status_financeiro || 'Regular',
                    detail: r?.detail_financeiro || 'Mensalidades em dia.',
                  },
                  academica: {
                    score: r?.score_academico || 20,
                    status: r?.status_academico || 'Regular',
                    detail: r?.detail_academico || 'Rendimento acadêmico satisfatório.',
                  },
                  relacionamento: {
                    score: r?.score_relacionamento || 20,
                    status: r?.status_relacionamento || 'Regular',
                    detail: r?.detail_relacionamento || 'Sem atritos ou solicitações de trancamento.',
                  },
                  geografica: {
                    score: r?.score_geografico || 25,
                    status: r?.status_geografico || 'Acesso Normal',
                    detail: r?.detail_geografico || 'Deslocamento viável ao campus FECAP.',
                  },
                },
                explanation: r?.explanation || 'Acompanhamento regular de permanência.',
                recommendation: r?.recommendation || 'Manter apoio pedagógico contínuo.',
              };
            })
          );
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar scores do Supabase:', e);
    }

    // Se o banco estiver vazio ou offline, carrega da base local institucional
    if (!rawList || rawList.length === 0) {
      const allLocal = await studentRiskService.getAllStudents();
      rawList = category && category !== 'Todos'
        ? allLocal.filter((s) => s.category === category)
        : [...allLocal];
    }

    // Sincroniza em tempo real com atualizações do perfil do estudante (ex: Lucas -> Dexter, novo endereço)
    // e recalcula o score com os requerimentos reais cadastrados na CAA
    const enrichedList = await Promise.all(
      rawList.map(async (st) => {
        let currentSt = { ...st };
        try {
          let override: any = null;
          const rawStored = await safeStorage.getItem(`@asa_student_profile_${st.ra}`);
          if (rawStored) override = JSON.parse(rawStored);
          if (!override) {
            const userStored = await safeStorage.getItem('@asa_user_profile');
            if (userStored) {
              const u = JSON.parse(userStored);
              if (
                u.ra === st.ra ||
                (st.ra === '24026851' &&
                  (u.name?.toLowerCase().includes('dexter') || u.name?.toLowerCase().includes('lucas')))
              ) {
                override = u;
              }
            }
          }

          if (override) {
            if (override.name) currentSt.name = override.name;
            if (override.course) currentSt.course = override.course;
            if (override.distanceKm != null) {
              const km = Number(override.distanceKm);
              const geoScore = km > 30 ? 75 : km >= 12 ? 45 : 20;
              const geoStatus =
                km > 30 ? 'Distância Elevada' : km >= 12 ? 'Deslocamento Médio' : 'Acesso Normal';
              currentSt.dimensions = {
                ...currentSt.dimensions,
                geografica: {
                  score: geoScore,
                  status: geoStatus,
                  detail: override.distanceText || `${km.toFixed(1)} km até o Campus Liberdade.`,
                },
              };
            }
          }
        } catch {
          // ignore
        }
        return await enrichStudentWithRequirements(currentSt);
      })
    );

    if (category && category !== 'Todos') {
      return enrichedList.filter((s) => s.category === category);
    }

    return enrichedList;
  },

  /**
   * Busca um estudante dinamicamente pelo nome ou RA na base Supabase ou local
   */
  async findStudentByNameOrRA(searchTerm: string): Promise<StudentRiskProfile | null> {
    if (!searchTerm || !searchTerm.trim()) return null;
    const clean = searchTerm.trim().toLowerCase();

    // 1. Verifica se corresponde a perfil modificado localmente (ex: Dexter / Lucas RA 24026851)
    let override: any = null;
    try {
      const rawStored = await safeStorage.getItem('@asa_student_profile_24026851');
      if (rawStored) override = JSON.parse(rawStored);
      if (!override) {
        const userStored = await safeStorage.getItem('@asa_user_profile');
        if (userStored) override = JSON.parse(userStored);
      }
    } catch {
      // ignore
    }

    if (
      override &&
      override.name &&
      (clean.includes(override.name.toLowerCase()) ||
        clean.includes('dexter') ||
        clean.includes('lucas') ||
        clean.includes('24026851'))
    ) {
      const local = await studentRiskService.getStudentByRA('24026851');
      if (local) {
        const cloned = { ...local, name: override.name };
        if (override.distanceKm != null) {
          const km = Number(override.distanceKm);
          cloned.dimensions = {
            ...cloned.dimensions,
            geografica: {
              score: km > 30 ? 75 : km >= 12 ? 45 : 20,
              status: km > 30 ? 'Distância Elevada' : km >= 12 ? 'Deslocamento Médio' : 'Acesso Normal',
              detail: override.distanceText || `${km.toFixed(1)} km até a FECAP`,
            },
          };
        }
        return await enrichStudentWithRequirements(cloned);
      }
    }

    try {
      if (isSupabaseConfigured) {
        // Extrai números de RA ou IDs
        const numMatch = clean.match(/\b\d+\b/);

        let req = dbClient
          .from('students')
          .select(`
            id,
            ra,
            name,
            course,
            semestre,
            turno,
            status_academico,
            profiles(avatar_url),
            student_risk_scores(*)
          `);

        if (numMatch) {
          // T11: Sanitização numérica estrita
          const cleanDigits = numMatch[0].replace(/\D/g, '');
          req = req.or(`ra.eq.${cleanDigits},name.ilike.%ID ${cleanDigits}%`);
        } else {
          // Busca pelas palavras-chave do nome
          const words = clean.split(' ').filter((w) => w.length > 2);
          const firstWord = words[0] || clean;
          req = req.ilike('name', `%${firstWord}%`);
        }

        const { data, error } = await req.limit(5);
        if (!error && data && data.length > 0) {
          // Seleciona o melhor match
          const best =
            data.find((st: any) => {
              const stName = st.name.toLowerCase();
              return (
                (numMatch && (st.ra === numMatch[0] || stName.includes(`id ${numMatch[0]}`))) ||
                clean.split(' ').every((w) => w.length <= 2 || stName.includes(w))
              );
            }) || data[0];

          const r = Array.isArray(best.student_risk_scores)
            ? best.student_risk_scores[0]
            : best.student_risk_scores;
          let av = Array.isArray(best.profiles)
            ? best.profiles[0]?.avatar_url
            : (best.profiles as any)?.avatar_url;
          if (!av && best.ra) {
            av = (await safeStorage.getItem(`@asa_avatar_${best.ra}`)) || undefined;
          }

          let studentObj: StudentRiskProfile = {
            id: best.id,
            ra: best.ra,
            name: best.name,
            course: best.course,
            semester: best.semestre || '1º Semestre',
            turno: best.turno || 'Noturno',
            status_academico: best.status_academico || 'Matriculado',
            avatarUrl: av,
            category: (r?.category || 'Verde') as RiskCategory,
            overallRiskScore: r?.overall_risk_score || 25,
            temporalTrend: (r?.temporal_trend || 'Estável') as any,
            trendVariation: r?.trend_variation || '±0%',
            historyScores: [
              { month: 'Jun', score: Math.max(10, (r?.overall_risk_score || 25) - 4) },
              { month: 'Jul', score: Math.max(10, (r?.overall_risk_score || 25) - 2) },
              { month: 'Ago', score: r?.overall_risk_score || 25 },
            ],
            dimensions: {
              financeira: {
                score: r?.score_financeiro || 20,
                status: r?.status_financeiro || 'Regular',
                detail: r?.detail_financeiro || 'Situação financeira regularizada.',
              },
              academica: {
                score: r?.score_academico || 20,
                status: r?.status_academico || 'Regular',
                detail: r?.detail_academico || 'Rendimento acadêmico satisfatório.',
              },
              relacionamento: {
                score: r?.score_relacionamento || 20,
                status: r?.status_relacionamento || 'Regular',
                detail: r?.detail_relacionamento || 'Sem atritos de permanência.',
              },
              geografica: {
                score: r?.score_geografico || 25,
                status: r?.status_geografico || 'Acesso Normal',
                detail: r?.detail_geografico || 'Deslocamento viável ao campus FECAP.',
              },
            },
            explanation:
              r?.explanation ||
              'Desempenho acadêmico regular e integrado às atividades institucionais.',
            recommendation:
              r?.recommendation || 'Manter acompanhamento pedagógico contínuo e acolhimento.',
          };

          return await enrichStudentWithRequirements(studentObj);
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar aluno por nome ou RA no Supabase:', e);
    }

    // Fallback de pesquisa no banco local
    const localMatch = await studentRiskService.getStudentByRA(clean);
    if (localMatch) {
      return await enrichStudentWithRequirements(localMatch);
    }

    return null;
  },

  /**
   * Obtém histórico acadêmico real de um aluno por RA ou ID
   */
  async getStudentAcademicHistory(raOrId: string) {
    try {
      if (isSupabaseConfigured) {
        let req = dbClient
          .from('students')
          .select('id, ra, name, course, semestre, status_academico, student_academic_history(*)');

        if (raOrId.includes('-')) {
          req = req.eq('id', raOrId);
        } else {
          req = req.eq('ra', raOrId);
        }

        const { data, error } = await req.maybeSingle();
        if (!error && data) {
          return {
            student: {
              id: data.id,
              ra: data.ra,
              name: data.name,
              course: data.course,
              semester: data.semestre || '1º Semestre',
              status_academico: data.status_academico || 'Matriculado',
            },
            history: data.student_academic_history || [],
          };
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar histórico acadêmico:', e);
    }
    return null;
  },

  /**
   * Obtém dossiê completo de um aluno (360 graus)
   */
  async getStudentFullProfile(raOrId: string): Promise<StudentFullProfile | null> {
    const cleanId = (raOrId || '').trim();

    // Carrega overrides salvos pelo aluno em seu perfil (nome atualizado, novo endereço, distância calculada)
    let override: any = null;
    try {
      const rawStored = await safeStorage.getItem(`@asa_student_profile_${cleanId}`);
      if (rawStored) override = JSON.parse(rawStored);
      if (!override) {
        const userStored = await safeStorage.getItem('@asa_user_profile');
        if (userStored) {
          const u = JSON.parse(userStored);
          if (
            u.ra === cleanId ||
            (cleanId === '24026851' &&
              (u.name?.toLowerCase().includes('dexter') || u.name?.toLowerCase().includes('lucas')))
          ) {
            override = u;
          }
        }
      }
    } catch {
      // ignore
    }

    try {
      if (isSupabaseConfigured) {
        let req = dbClient
          .from('students')
          .select(`
            *,
            profiles(avatar_url),
            student_contacts(*),
            student_risk_scores(*),
            student_financials(*),
            student_academic_history(*),
            student_relationships(*)
          `);

        if (cleanId.includes('-')) {
          req = req.eq('id', cleanId);
        } else {
          req = req.eq('ra', cleanId);
        }

        const { data, error } = await req.maybeSingle();
        if (!error && data) {
          const r = Array.isArray(data.student_risk_scores)
            ? data.student_risk_scores[0]
            : data.student_risk_scores;
          const c = Array.isArray(data.student_contacts)
            ? data.student_contacts[0]
            : data.student_contacts;

          let avatarUrl = data.profiles?.avatar_url;
          if (!avatarUrl && data.ra) {
            avatarUrl = (await safeStorage.getItem(`@asa_avatar_${data.ra}`)) || undefined;
          }

          const mergedContacts = {
            idade: c?.idade || 21,
            bairro: override?.neighborhood || c?.bairro || 'Liberdade / Bela Vista',
            cidade: override?.city || c?.cidade || 'São Paulo',
            estado: override?.state || c?.estado || 'SP',
            estado_civil: c?.estado_civil || 'Solteiro(a)',
            sexo: c?.sexo || 'Não informado',
            logradouro: override?.street
              ? `${override.street}${override.number ? `, ${override.number}` : ''}${override.complement ? ` - ${override.complement}` : ''}`
              : undefined,
            cep: override?.cep || c?.cep,
            distancia_km:
              override?.distanceKm != null ? Number(override.distanceKm) : undefined,
            distancia_texto: override?.distanceText || undefined,
          };

          const finalName = override?.name || data.name;

          // Enriquece a pontuação com os requerimentos reais
          const studentForRisk: StudentRiskProfile = {
            id: data.id,
            ra: data.ra,
            name: finalName,
            course: override?.course || data.course,
            semester: data.semestre || '4º Semestre',
            turno: data.turno || 'Noturno',
            avatarUrl,
            category: (r?.category || 'Verde') as RiskCategory,
            overallRiskScore: r?.overall_risk_score || 25,
            temporalTrend: (r?.temporal_trend || 'Estável') as any,
            trendVariation: r?.trend_variation || '±0%',
            historyScores: [],
            dimensions: {
              financeira: {
                score: r?.score_financeiro || 20,
                status: r?.status_financeiro || 'Regular',
                detail: r?.detail_financeiro || 'Mensalidades em dia.',
              },
              academica: {
                score: r?.score_academico || 20,
                status: r?.status_academico || 'Regular',
                detail: r?.detail_academico || 'Rendimento acadêmico satisfatório.',
              },
              relacionamento: {
                score: r?.score_relacionamento || 20,
                status: r?.status_relacionamento || 'Regular',
                detail: r?.detail_relacionamento || 'Sem atritos ou solicitações de trancamento.',
              },
              geografica: {
                score:
                  override?.distanceKm != null
                    ? Number(override.distanceKm) > 30
                      ? 75
                      : Number(override.distanceKm) >= 12
                      ? 45
                      : 20
                    : r?.score_geografico || 25,
                status:
                  override?.distanceKm != null
                    ? Number(override.distanceKm) > 30
                      ? 'Distância Elevada'
                      : Number(override.distanceKm) >= 12
                      ? 'Deslocamento Médio'
                      : 'Acesso Normal'
                    : r?.status_geografico || 'Acesso Normal',
                detail:
                  override?.distanceText ||
                  r?.detail_geografico ||
                  'Deslocamento viável ao campus FECAP.',
              },
            },
            explanation: r?.explanation || '',
            recommendation: r?.recommendation || '',
          };

          const enriched = await enrichStudentWithRequirements(studentForRisk);

          const updatedRisk = {
            overall_risk_score: enriched.overallRiskScore,
            category: enriched.category,
            temporal_trend: enriched.temporalTrend,
            trend_variation: enriched.trendVariation,
            score_financeiro: enriched.dimensions.financeira.score,
            status_financeiro: enriched.dimensions.financeira.status,
            detail_financeiro: enriched.dimensions.financeira.detail,
            score_academico: enriched.dimensions.academica.score,
            status_academico: enriched.dimensions.academica.status,
            detail_academico: enriched.dimensions.academica.detail,
            score_relacionamento: enriched.dimensions.relacionamento.score,
            status_relacionamento: enriched.dimensions.relacionamento.status,
            detail_relacionamento: enriched.dimensions.relacionamento.detail,
            score_geografico: enriched.dimensions.geografica.score,
            status_geografico: enriched.dimensions.geografica.status,
            detail_geografico: enriched.dimensions.geografica.detail,
            explanation: enriched.explanation,
            recommendation: enriched.recommendation,
          };

          return {
            id: data.id,
            ra: data.ra,
            name: finalName,
            course: override?.course || data.course,
            grau_academico: data.grau_academico,
            turno: data.turno,
            periodo_ingresso: data.periodo_ingresso,
            periodo_letivo_atual: data.periodo_letivo_atual,
            semestre: data.semestre,
            status_academico: data.status_academico,
            avatarUrl,
            risk: updatedRisk,
            contacts: mergedContacts,
            financials: data.student_financials || [],
            academic_history: data.student_academic_history || [],
            relationships: data.student_relationships || [],
          };
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar perfil completo no Supabase:', e);
    }

    // Fallback completo a partir do repositório local
    const local = await studentRiskService.getStudentByRA(cleanId);
    if (local || cleanId === '24026851') {
      const baseSt = local || {
        id: 'aluno-24026851',
        ra: '24026851',
        name: 'Lucas Alvarista',
        course: 'Ciência da Computação',
        semester: '5º Semestre',
        turno: 'Noturno',
        category: 'Verde' as RiskCategory,
        overallRiskScore: 17,
        temporalTrend: 'Melhorando' as any,
        trendVariation: '0%',
        historyScores: [],
        dimensions: {
          financeira: { score: 20, status: 'Regular', detail: 'Mensalidades em dia.' },
          academica: { score: 20, status: 'Regular', detail: 'Rendimento satisfatório.' },
          relacionamento: { score: 20, status: 'Regular', detail: 'Atendimento normal.' },
          geografica: { score: 20, status: 'Perto', detail: 'Fácil acesso.' },
        },
        explanation: '',
        recommendation: '',
      };

      const finalName = override?.name || baseSt.name;

      const mergedContacts = {
        idade: 21,
        bairro: override?.neighborhood || 'Liberdade / Bela Vista',
        cidade: override?.city || 'São Paulo',
        estado: override?.state || 'SP',
        estado_civil: 'Solteiro(a)',
        sexo: 'Não informado',
        logradouro: override?.street
          ? `${override.street}${override.number ? `, ${override.number}` : ''}${override.complement ? ` - ${override.complement}` : ''}`
          : undefined,
        cep: override?.cep,
        distancia_km:
          override?.distanceKm != null ? Number(override.distanceKm) : undefined,
        distancia_texto: override?.distanceText || undefined,
      };

      const studentForRisk: StudentRiskProfile = {
        ...baseSt,
        name: finalName,
        course: override?.course || baseSt.course,
      };

      if (override?.distanceKm != null) {
        const km = Number(override.distanceKm);
        studentForRisk.dimensions.geografica = {
          score: km > 30 ? 75 : km >= 12 ? 45 : 20,
          status: km > 30 ? 'Distância Elevada' : km >= 12 ? 'Deslocamento Médio' : 'Acesso Normal',
          detail: override.distanceText || `${km.toFixed(1)} km até a FECAP`,
        };
      }

      const enriched = await enrichStudentWithRequirements(studentForRisk);

      const updatedRisk = {
        overall_risk_score: enriched.overallRiskScore,
        category: enriched.category,
        temporal_trend: enriched.temporalTrend,
        trend_variation: enriched.trendVariation,
        score_financeiro: enriched.dimensions.financeira.score,
        status_financeiro: enriched.dimensions.financeira.status,
        detail_financeiro: enriched.dimensions.financeira.detail,
        score_academico: enriched.dimensions.academica.score,
        status_academico: enriched.dimensions.academica.status,
        detail_academico: enriched.dimensions.academica.detail,
        score_relacionamento: enriched.dimensions.relacionamento.score,
        status_relacionamento: enriched.dimensions.relacionamento.status,
        detail_relacionamento: enriched.dimensions.relacionamento.detail,
        score_geografico: enriched.dimensions.geografica.score,
        status_geografico: enriched.dimensions.geografica.status,
        detail_geografico: enriched.dimensions.geografica.detail,
        explanation: enriched.explanation,
        recommendation: enriched.recommendation,
      };

      let avatarUrl = (await safeStorage.getItem(`@asa_avatar_${baseSt.ra}`)) || undefined;

      return {
        id: baseSt.id,
        ra: baseSt.ra,
        name: finalName,
        course: override?.course || baseSt.course,
        grau_academico: 'Bacharelado',
        turno: baseSt.turno || 'Noturno',
        periodo_ingresso: '2024-1',
        periodo_letivo_atual: '2026-1',
        semestre: baseSt.semester || '5º Semestre',
        status_academico: (baseSt as any).status_academico || 'Matriculado',
        avatarUrl,
        risk: updatedRisk,
        contacts: mergedContacts,
        financials: [],
        academic_history: [],
        relationships: [],
      };
    }

    return null;
  },
};
