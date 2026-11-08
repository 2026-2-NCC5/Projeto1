import studentsRiskData from './data/studentsRiskData.json';
// Resolução lazy para evitar ciclo circular no Metro (studentRiskService <-> studentsService)
const getStudentsService = () => {
  try {
    return require('../supabase/studentsService').studentsService;
  } catch {
    return null;
  }
};
import { requirementsService } from '../supabase/requirementsService';

export type RiskCategory = 'Vermelho' | 'Amarelo' | 'Verde';

export interface DimensionDetail {
  score: number;
  status: string;
  detail: string;
}

export interface StudentRiskProfile {
  id: string;
  name: string;
  ra: string;
  course: string;
  semester: string;
  turno?: string;
  status_academico?: 'Matriculado' | 'Formado' | 'Evasão' | string;
  avatarUrl?: string;
  category: RiskCategory;
  overallRiskScore: number;
  temporalTrend: 'Piorando' | 'Estavel' | 'Melhorando';
  trendVariation: string;
  historyScores: { month: string; score: number }[];
  dimensions: {
    financeira: DimensionDetail;
    academica: DimensionDetail;
    relacionamento: DimensionDetail;
    geografica: DimensionDetail;
  };
  explanation: string;
  recommendation: string;
}

const LOCAL_PROFILES: StudentRiskProfile[] = (studentsRiskData as any[]) || [];

/**
 * Sincroniza em tempo real alterações feitas no perfil do aluno (nome, endereço, distância)
 * com o repositório em memória de perfis de risco.
 */
export function syncStudentProfile(
  ra: string,
  updates: {
    name?: string;
    distanceKm?: number;
    distanceText?: string;
    city?: string;
    neighborhood?: string;
    course?: string;
  }
): void {
  const cleanRa = (ra || '').trim().toLowerCase();
  for (const p of LOCAL_PROFILES) {
    if (
      p.ra.toLowerCase() === cleanRa ||
      (cleanRa === '24026851' &&
        (p.name.toLowerCase().includes('lucas') || p.name.toLowerCase().includes('dexter')))
    ) {
      if (updates.name) p.name = updates.name;
      if (updates.course) p.course = updates.course;
      if (updates.distanceKm != null) {
        const km = Number(updates.distanceKm);
        const geoScore = km > 30 ? 75 : km >= 12 ? 45 : 20;
        const geoStatus =
          km > 30 ? 'Distância Elevada' : km >= 12 ? 'Deslocamento Médio' : 'Acesso Normal';
        p.dimensions.geografica = {
          score: geoScore,
          status: geoStatus,
          detail: updates.distanceText || `${km.toFixed(1)} km até o Campus Liberdade.`,
        };
      }
    }
  }
}

/**
 * Procura um RA ou nome de aluno em uma string ou em uma lista de mensagens (síncrono local)
 */
function findStudentInText(text: string): StudentRiskProfile | undefined {
  if (!text) return undefined;

  const lowerText = text.toLowerCase();

  // 1. Procura primeiro por correspondência de RA numérico associado ao nome se ambos estiverem no texto
  const raMatches = text.match(/\b\d{1,8}\b/g);
  if (raMatches) {
    for (const match of raMatches) {
      const candidates = LOCAL_PROFILES.filter((s) => s.ra === match);
      if (candidates.length > 0) {
        // Se houver mais de um com o mesmo RA ou se o nome bater com o texto, prioriza
        const nameMatch = candidates.find((c) => lowerText.includes(c.name.toLowerCase().split(' ')[0]));
        return nameMatch || candidates[0];
      }
    }
  }

  // 2. Procura por nome de aluno presente na base
  for (const s of LOCAL_PROFILES) {
    if (s.name && s.name.length > 2 && lowerText.includes(s.name.toLowerCase())) {
      return s;
    }
    const parts = s.name.split(' ');
    if (parts.length >= 2) {
      const shortName = `${parts[0]} ${parts[parts.length - 1]}`.toLowerCase();
      if (lowerText.includes(shortName)) {
        return s;
      }
    }
  }

  // 2.1 Suporte explícito para 'Dexter' / 'Lucas Alvarista' (RA 24026851)
  if (lowerText.includes('dexter') || lowerText.includes('lucas')) {
    const dex = LOCAL_PROFILES.find(
      (s) =>
        s.ra === '24026851' ||
        s.name.toLowerCase().includes('dexter') ||
        s.name.toLowerCase().includes('lucas')
    );
    if (dex) return dex;
  }

  return undefined;
}

/**
 * Enriquece o perfil do aluno capturando em tempo real os requerimentos abertos por ele,
 * ajustando a dimensão de Relacionamento e recalculando com precisão o Score Global 4D.
 */
export async function enrichStudentWithRequirements(
  student: StudentRiskProfile
): Promise<StudentRiskProfile> {
  try {
    const reqs = await requirementsService.getRequirementsByStudent({
      ra: student.ra,
      studentId: student.id,
      name: student.name,
      course: student.course,
    });

    if (reqs && reqs.length > 0) {
      // Analisa tipologia dos requerimentos
      const criticos = reqs.filter((r) => {
        const t = (r.title + ' ' + (r.description || '')).toLowerCase();
        return (
          t.includes('tranc') ||
          t.includes('cancel') ||
          t.includes('desist') ||
          t.includes('transfer')
        );
      });

      const financeiros = reqs.filter((r) => {
        const t = (r.title + ' ' + (r.description || '') + ' ' + (r.type || '')).toLowerCase();
        return (
          t.includes('financ') ||
          t.includes('bolsa') ||
          t.includes('acordo') ||
          t.includes('parcel') ||
          t.includes('negocia')
        );
      });

      const academicos = reqs.filter((r) => {
        const t = (r.title + ' ' + (r.description || '')).toLowerCase();
        return (
          t.includes('revis') ||
          t.includes('prova') ||
          t.includes('dp') ||
          t.includes('dispensa') ||
          t.includes('grade') ||
          t.includes('troca')
        );
      });

      let relScore = student.dimensions.relacionamento.score;
      let relStatus = student.dimensions.relacionamento.status;
      let relDetail = '';

      // Escala institucional calibrada de risco de relacionamento por fricção e volume de chamados
      if (criticos.length > 0) {
        relScore = Math.max(relScore, 90);
        relStatus = 'Crítico / Alerta de Retenção';
        relDetail = `ALERTA DE RETENÇÃO: Aluno protocolou requerimento de "${criticos[0].title}" [${criticos[0].currentStage}]. Total de ${reqs.length} requerimento(s) na CAA (${reqs.map((r) => `${r.title} [${r.currentStage}]`).join(', ')}).`;
      } else if (financeiros.length > 0) {
        relScore = Math.max(relScore, 75);
        relStatus = 'Atenção / Risco Financeiro';
        relDetail = `Possui solicitação de bolsa/renegociação protocolada: "${financeiros[0].title}". Total de ${reqs.length} requerimento(s) registrados na CAA.`;
      } else if (reqs.length >= 8) {
        relScore = Math.max(relScore, 88);
        relStatus = 'Crítico / Sobrecarga de Demandas';
        relDetail = `SOBRECARGA DE DEMANDAS: Aluno acumula ${reqs.length} requerimentos protocolados na CAA (${reqs.map((r) => `${r.title} [${r.currentStage}]`).join(', ')}). Alto volume indicando atrito ou dependência institucional contínua.`;
      } else if (reqs.length >= 6) {
        relScore = Math.max(relScore, 78);
        relStatus = 'Atenção Alta / Múltiplas Demandas';
        relDetail = `Volume elevado de solicitações: ${reqs.length} requerimentos na CAA (${reqs.map((r) => `${r.title} [${r.currentStage}]`).join(', ')}).`;
      } else if (reqs.length >= 4) {
        relScore = Math.max(relScore, 60);
        relStatus = 'Atenção Moderada / Múltiplas Demandas';
        relDetail = `Demandas acadêmicas/administrativas em tramitação: ${reqs.length} requerimentos na CAA (${reqs.map((r) => `${r.title} [${r.currentStage}]`).join(', ')}).`;
      } else if (reqs.length >= 2 || academicos.length > 0) {
        relScore = Math.max(relScore, 40);
        relStatus = 'Atenção / Demandas Acadêmicas';
        relDetail = `${reqs.length} requerimento(s) em tramitação na CAA (${reqs.map((r) => `${r.title} [${r.currentStage}]`).join(', ')}).`;
      } else {
        relScore = Math.max(relScore, 25);
        relStatus = 'Regular';
        relDetail = `${reqs.length} requerimento(s) de rotina protocolado(s): ${reqs.map((r) => `${r.title} [${r.currentStage}]`).join(', ')}.`;
      }

      // Recalcula o score global 4D combinando as 4 dimensões oficiais
      // Pesos: Financeira (35%), Acadêmica (30%), Relacionamento (25%), Geográfica (10%)
      const sFin = student.dimensions.financeira.score;
      const sAcad = student.dimensions.academica.score;
      const sGeo = student.dimensions.geografica.score;
      const weightedOverall = Math.round(
        0.35 * sFin + 0.30 * sAcad + 0.25 * relScore + 0.10 * sGeo
      );

      // Elevador de Dimensão Crítica:
      // Se a dimensão de relacionamento for crítica (>= 80), o risco geral reflete a urgência (mínimo de 65 a 75 pontos)
      let recalculatedOverall = weightedOverall;
      if (relScore >= 85) {
        recalculatedOverall = Math.max(
          weightedOverall,
          Math.round(relScore * 0.72 + Math.max(sFin, sAcad, sGeo) * 0.28)
        );
      } else if (relScore >= 70) {
        recalculatedOverall = Math.max(
          weightedOverall,
          Math.round(relScore * 0.6 + Math.max(sFin, sAcad, sGeo) * 0.4)
        );
      }

      let newCategory: RiskCategory = 'Verde';
      let trend: 'Piorando' | 'Estavel' | 'Melhorando' = student.temporalTrend;
      if (recalculatedOverall >= 70) {
        newCategory = 'Vermelho';
        trend = 'Piorando';
      } else if (recalculatedOverall >= 40) {
        newCategory = 'Amarelo';
        trend = 'Estavel';
      } else {
        newCategory = 'Verde';
        trend = 'Melhorando';
      }

      return {
        ...student,
        overallRiskScore: recalculatedOverall,
        category: newCategory,
        temporalTrend: trend,
        dimensions: {
          ...student.dimensions,
          relacionamento: {
            score: relScore,
            status: relStatus,
            detail: relDetail,
          },
        },
      };
    }
  } catch (err) {
    console.warn('Erro ao enriquecer aluno com requerimentos:', err);
  }

  return student;
}

/**
 * Procura o aluno de forma assíncrona, priorizando o banco Supabase oficial
 * e enriquecendo com os requerimentos reais cadastrados.
 */
export async function findStudentInTextAsync(text: string): Promise<StudentRiskProfile | undefined> {
  try {
    const svc = getStudentsService();
    const fromSupabase = svc ? await svc.findStudentByNameOrRA(text) : null;
    if (fromSupabase) {
      return await enrichStudentWithRequirements(fromSupabase);
    }
  } catch (e) {
    console.warn('Erro ao consultar aluno no Supabase via agente:', e);
  }

  const local = findStudentInText(text);
  if (local) {
    return await enrichStudentWithRequirements(local);
  }

  return undefined;
}

/**
 * Encontra o aluno ativo na conversa a partir da mensagem atual ou do histórico recente (síncrono)
 */
export function extractActiveStudentFromContext(
  currentQuery: string,
  conversationHistory: { sender?: string; role?: string; text?: string; content?: string }[] = []
): StudentRiskProfile | undefined {
  const inCurrent = findStudentInText(currentQuery);
  if (inCurrent) return inCurrent;

  const reversedHistory = [...conversationHistory].reverse();
  for (const msg of reversedHistory) {
    const text = msg.text || msg.content || '';
    const found = findStudentInText(text);
    if (found) {
      return found;
    }
  }

  return undefined;
}

/**
 * Encontra o aluno ativo na conversa suportando pesquisa no banco Supabase em tempo real
 */
export async function extractActiveStudentFromContextAsync(
  currentQuery: string,
  conversationHistory: { sender?: string; role?: string; text?: string; content?: string }[] = []
): Promise<StudentRiskProfile | undefined> {
  // 1. Verifica na mensagem atual (priorizando base local + enriquecimento de requerimentos)
  const localCurrent = findStudentInText(currentQuery);
  if (localCurrent) {
    return await enrichStudentWithRequirements(localCurrent);
  }

  // 2. Se a pergunta atual contém RA numérico ou nome próprio, tenta consultar Supabase
  if (/\b\d{3,10}\b/.test(currentQuery)) {
    const sbCurrent = await findStudentInTextAsync(currentQuery);
    if (sbCurrent) return sbCurrent;
  }

  // 3. Verifica no histórico recente da conversa (para perguntas de continuação como "E o financeiro dele?")
  const reversedHistory = [...conversationHistory].reverse();
  for (const msg of reversedHistory) {
    const text = msg.text || msg.content || '';
    const localHist = findStudentInText(text);
    if (localHist) {
      return await enrichStudentWithRequirements(localHist);
    }
  }

  // 4. Fallback assíncrono no Supabase para o texto atual ou histórico
  const sbFallback = await findStudentInTextAsync(currentQuery);
  if (sbFallback) return sbFallback;

  for (const msg of reversedHistory) {
    const text = msg.text || msg.content || '';
    const found = await findStudentInTextAsync(text);
    if (found) {
      return found;
    }
  }

  return undefined;
}

export const studentRiskService = {
  syncStudentProfile(ra: string, updates: any) {
    syncStudentProfile(ra, updates);
  },

  /**
   * Obtém todos os alunos com score de risco calculado
   */
  async getAllStudents(): Promise<StudentRiskProfile[]> {
    return LOCAL_PROFILES;
  },

  /**
   * Busca aluno por RA ou nome
   */
  async getStudentByRA(ra: string): Promise<StudentRiskProfile | undefined> {
    const cleanRA = ra.trim().toLowerCase();
    return LOCAL_PROFILES.find(
      (s) => s.ra.toLowerCase() === cleanRA || s.name.toLowerCase().includes(cleanRA)
    );
  },

  /**
   * Filtra alunos por categoria semafórica
   */
  async getStudentsByCategory(category: 'Todos' | RiskCategory): Promise<StudentRiskProfile[]> {
    if (category === 'Todos') return LOCAL_PROFILES;
    return LOCAL_PROFILES.filter((s) => s.category === category);
  },

  /**
   * Retorna métricas agregadas da instituição para o dashboard de permanência
   */
  async getAggregatedMetrics() {
    const total = LOCAL_PROFILES.length;
    const countVermelho = LOCAL_PROFILES.filter((s) => s.category === 'Vermelho').length;
    const countAmarelo = LOCAL_PROFILES.filter((s) => s.category === 'Amarelo').length;
    const countVerde = LOCAL_PROFILES.filter((s) => s.category === 'Verde').length;
    const avgScore = total > 0 ? Math.round(LOCAL_PROFILES.reduce((acc, s) => acc + s.overallRiskScore, 0) / total) : 0;

    return {
      total,
      countVermelho,
      countAmarelo,
      countVerde,
      avgScore,
      pctEvasaoEstimada: total > 0 ? Math.round((countVermelho / total) * 100) : 0,
    };
  },

  /**
   * Agente de IA para responder dúvidas analíticas do funcionário com retenção total de contexto multi-turn
   */
  async queryRiskAgent(query: string, conversationHistory: any[] = [], overrideStudent?: StudentRiskProfile): Promise<string> {
    const normalized = query.toLowerCase().trim();

    // 1. Identifica se há um aluno em foco (seja por parâmetro direto, na pergunta atual ou no histórico de diálogo)
    const activeStudent = overrideStudent || await extractActiveStudentFromContextAsync(query, conversationHistory);

    if (activeStudent) {
      const stStatus = activeStudent.status_academico || 'Matriculado';
      const isEvadido = stStatus === 'Evasão' || stStatus === 'Cancelado';
      const isFormado = stStatus === 'Formado';
      const isTrancado = stStatus === 'Trancado';

      const statusBadgeText = isEvadido
        ? '🔴 Evasão / Matrícula Cancelada'
        : isFormado
        ? '🔵 Formado / Concluído'
        : isTrancado
        ? '🟡 Matrícula Trancada'
        : '🟢 Matriculado / Regular';

      const statusBanner = isEvadido
        ? `> ⚠️ **SITUAÇÃO DO DISCENTE**: Consta no prontuário acadêmico como **EVADIDO / MATRÍCULA CANCELADA**.\n\n`
        : isFormado
        ? `> 🎓 **SITUAÇÃO DO DISCENTE**: O estudante concluiu todas as disciplinas da grade (**FORMADO**).\n\n`
        : isTrancado
        ? `> ⏸️ **SITUAÇÃO DO DISCENTE**: Matrícula atualmente **TRANCADA**.\n\n`
        : '';

      // 1.1 Pergunta focada na Dimensão Financeira
      if (
        normalized.includes('financ') ||
        normalized.includes('mensal') ||
        normalized.includes('pagament') ||
        normalized.includes('atras') ||
        normalized.includes('bolsa') ||
        normalized.includes('divida') ||
        normalized.includes('inadimpl') ||
        normalized.includes('dinheiro') ||
        normalized.includes('parcela')
      ) {
        return (
          `### 💰 **Situação Financeira — ${activeStudent.name}** (RA: \`${activeStudent.ra}\`)\n\n` +
          statusBanner +
          `• **Situação da Matrícula**: **${statusBadgeText}**\n` +
          `• **Score de Risco Financeiro**: **${activeStudent.dimensions.financeira.score}/100** [Status: **${activeStudent.dimensions.financeira.status}**]\n` +
          `• **Detalhamento**: ${activeStudent.dimensions.financeira.detail}\n` +
          `• **Impacto no Risco Global**: Esta dimensão possui peso de 35% no score geral (${activeStudent.overallRiskScore}/100).\n\n` +
          `💡 **Ação recomendada para a área financeira/CAA**:\n` +
          `> Orientar sobre o Programa de Assistência Financeira Educacional (PAFE) ou parcelamento sem juros das mensalidades pendentes.`
        );
      }

      // 1.2 Pergunta focada na Dimensão Acadêmica / Notas / Faltas / DPs
      if (
        normalized.includes('acad') ||
        normalized.includes('nota') ||
        normalized.includes('cr') ||
        normalized.includes('falta') ||
        normalized.includes('presen') ||
        normalized.includes('reprov') ||
        normalized.includes('dp') ||
        normalized.includes('materia') ||
        normalized.includes('disciplina')
      ) {
        return (
          `### 📚 **Desempenho Acadêmico — ${activeStudent.name}** (RA: \`${activeStudent.ra}\`)\n\n` +
          statusBanner +
          `• **Situação da Matrícula**: **${statusBadgeText}**\n` +
          `• **Curso**: ${activeStudent.course} (${activeStudent.semester})\n` +
          `• **Score de Risco Acadêmico**: **${activeStudent.dimensions.academica.score}/100** [Status: **${activeStudent.dimensions.academica.status}**]\n` +
          `• **Diagnóstico de Rendimento**: ${activeStudent.dimensions.academica.detail}\n\n` +
          `💡 **Ação recomendada para a coordenação pedagógica**:\n` +
          `> Encaminhar o estudante para monitoria/tutoria acadêmica e estruturar plano de recuperação de notas para evitar novas reprovações por falta ou média.`
        );
      }

      // 1.3 Pergunta focada em Relacionamento / Requerimentos / Atendimentos / Queixas
      if (
        normalized.includes('relacion') ||
        normalized.includes('requer') ||
        normalized.includes('solicit') ||
        normalized.includes('atend') ||
        normalized.includes('contat') ||
        normalized.includes('portal') ||
        normalized.includes('ava') ||
        normalized.includes('tutoria') ||
        normalized.includes('mentoria') ||
        normalized.includes('queixa')
      ) {
        return (
          `### 🤝 **Relacionamento & Requerimentos — ${activeStudent.name}** (RA: \`${activeStudent.ra}\`)\n\n` +
          statusBanner +
          `• **Situação da Matrícula**: **${statusBadgeText}**\n` +
          `• **Score de Relacionamento**: **${activeStudent.dimensions.relacionamento.score}/100** [Status: **${activeStudent.dimensions.relacionamento.status}**]\n` +
          `• **Histórico de Requerimentos & Interações**: ${activeStudent.dimensions.relacionamento.detail}\n\n` +
          `• **Impacto no Risco Global**: Esta dimensão possui peso de 20% no cálculo multidimensional (Score Atual: **${activeStudent.overallRiskScore}/100** - Categoria **${activeStudent.category}**).\n\n` +
          `💡 **Ação recomendada para a Central CAA / Permanência**:\n` +
          `> Realizar acolhimento proativo para esclarecer as solicitações protocoladas e oferecer suporte personalizado.`
        );
      }

      // 1.4 Pergunta focada em Localização / Transporte / Geografia
      if (
        normalized.includes('geogr') ||
        normalized.includes('distanc') ||
        normalized.includes('bairro') ||
        normalized.includes('cidade') ||
        normalized.includes('morad') ||
        normalized.includes('transporte') ||
        normalized.includes('longe') ||
        normalized.includes('desloc')
      ) {
        return (
          `### 📍 **Fator Geográfico e Deslocamento — ${activeStudent.name}** (RA: \`${activeStudent.ra}\`)\n\n` +
          statusBanner +
          `• **Situação da Matrícula**: **${statusBadgeText}**\n` +
          `• **Score de Risco Geográfico**: **${activeStudent.dimensions.geografica.score}/100** [Status: **${activeStudent.dimensions.geografica.status}**]\n` +
          `• **Localização e Acesso**: ${activeStudent.dimensions.geografica.detail}\n` +
          `• **Turno de Matrícula**: ${activeStudent.turno || 'Noturno'}\n\n` +
          `💡 **Orientação**:\n` +
          `> Avaliar a viabilidade de flexibilização de horários de chegada ou suporte com passe escolar para atenuar o impacto do deslocamento diário.`
        );
      }

      // 1.5 Pergunta focada em Recomendações / O que fazer / Plano de Ação
      if (
        normalized.includes('recomenda') ||
        normalized.includes('plano') ||
        normalized.includes('acao') ||
        normalized.includes('fazer') ||
        normalized.includes('ajudar') ||
        normalized.includes('orienta') ||
        normalized.includes('interven')
      ) {
        return (
          `### 💡 **Plano de Ação de Permanência — ${activeStudent.name}** (RA: \`${activeStudent.ra}\`)\n\n` +
          statusBanner +
          `• **Situação da Matrícula**: **${statusBadgeText}**\n` +
          `Com base na análise preditiva (Score Global: **${activeStudent.overallRiskScore}/100** - Categoria **${activeStudent.category}**):\n\n` +
          `• **Diagnóstico Central**: ${activeStudent.explanation}\n\n` +
          `• **Ações Imediatas Recomendadas**:\n` +
          `  1. ${activeStudent.recommendation}\n` +
          `  2. Agendar entrevista de acolhimento presencial ou online com a equipe de Permanência Estudantil.\n` +
          `  3. Acompanhar a evolução do score nas próximas 4 semanas.`
        );
      }

      // Se a pergunta menciona o aluno diretamente ou se é a primeira consulta sobre ele
      return (
        `### 🔍 **Diagnóstico Completo — ${activeStudent.name}** (RA: \`${activeStudent.ra}\`)\n\n` +
        statusBanner +
        `• **Situação da Matrícula**: **${statusBadgeText}**\n` +
        `• **Curso**: ${activeStudent.course} (${activeStudent.semester})\n` +
        `• **Score de Risco Global**: **${activeStudent.overallRiskScore}/100** [Categoria: **${activeStudent.category.toUpperCase()}**]\n` +
        `• **Tendência Temporal**: ${activeStudent.temporalTrend} (${activeStudent.trendVariation})\n\n` +
        `#### 📊 **Detalhamento Multidimensional**:\n` +
        `1. **Financeiro (${activeStudent.dimensions.financeira.score}/100 - ${activeStudent.dimensions.financeira.status})**: ${activeStudent.dimensions.financeira.detail}\n` +
        `2. **Acadêmico (${activeStudent.dimensions.academica.score}/100 - ${activeStudent.dimensions.academica.status})**: ${activeStudent.dimensions.academica.detail}\n` +
        `3. **Relacionamento (${activeStudent.dimensions.relacionamento.score}/100 - ${activeStudent.dimensions.relacionamento.status})**: ${activeStudent.dimensions.relacionamento.detail}\n` +
        `4. **Geográfico (${activeStudent.dimensions.geografica.score}/100 - ${activeStudent.dimensions.geografica.status})**: ${activeStudent.dimensions.geografica.detail}\n\n` +
        `#### 💡 **Recomendação de Apoio à Permanência**:\n` +
        `> ${activeStudent.recommendation}\n\n` +
        `📌 **Fonte**: Base Institucional de Alunos FECAP | Processamento em Tempo Real`
      );
    }

    // 2. Consultas gerais sobre categorias de risco
    if (normalized.includes('crítico') || normalized.includes('vermelho') || normalized.includes('alto risco')) {
      const criticos = LOCAL_PROFILES.filter((s) => s.category === 'Vermelho').slice(0, 5);
      let res = `### 🚨 **Alunos com Risco Crítico de Evasão (Categoria Vermelha)**\n\nIdentifiquei ${LOCAL_PROFILES.filter(s => s.category === 'Vermelho').length} alunos na faixa de alerta máximo. Abaixo os casos prioritários para acolhimento imediato:\n\n`;
      criticos.forEach((c, i) => {
        res += `${i + 1}. **${c.name}** (RA: \`${c.ra}\`) — Score **${c.overallRiskScore}/100**\n   • ${c.course} | *${c.dimensions.financeira.detail}*\n`;
      });
      res += `\n📌 **Dica**: Você pode me perguntar detalhes de qualquer um deles informando o RA (ex: *"Explique a situação do RA ${criticos[0]?.ra || '24018932'}"*).`;
      return res;
    }

    if (normalized.includes('amarelo') || normalized.includes('atenção') || normalized.includes('moderado')) {
      const amarelos = LOCAL_PROFILES.filter((s) => s.category === 'Amarelo').slice(0, 5);
      let res = `### 🟡 **Alunos em Atenção / Monitoramento (Categoria Amarela)**\n\nTotal de ${LOCAL_PROFILES.filter(s => s.category === 'Amarelo').length} alunos em monitoramento preventivo:\n\n`;
      amarelos.forEach((c, i) => {
        res += `${i + 1}. **${c.name}** (RA: \`${c.ra}\`) — Score **${c.overallRiskScore}/100**\n   • ${c.course} | *${c.dimensions.academica.detail}*\n`;
      });
      return res;
    }

    const metrics = await this.getAggregatedMetrics();
    return (
      `### 📈 **Panorama Geral de Retenção e Permanência Estudantil (2026/2)**\n\n` +
      `• **Total de Alunos Monitorados**: ${metrics.total}\n` +
      `• 🔴 **Crítico (Vermelho)**: ${metrics.countVermelho} alunos (${metrics.pctEvasaoEstimada}% do total)\n` +
      `• 🟡 **Atenção (Amarelo)**: ${metrics.countAmarelo} alunos\n` +
      `• 🟢 **Estável (Verde)**: ${metrics.countVerde} alunos\n` +
      `• **Score Médio de Risco Institucional**: ${metrics.avgScore}/100\n\n` +
      `Você pode consultar o diagnóstico individual de qualquer estudante informando o RA ou Nome (ex: *"Qual o diagnóstico do RA 24018932?"*), e continuar a conversa perguntando *"Como está o financeiro dele?"* ou *"Qual a recomendação para esse aluno?"*.`
    );
  },
};
