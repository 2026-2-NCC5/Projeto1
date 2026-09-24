/**
 * ============================================================================
 * SISA FECAP - ArregASA
 * ============================================================================
 * O Frontend NÃO acessa a Groq diretamente.
 * Todas as chamadas de IA são roteadas pelo Backend (EXPO_PUBLIC_BACKEND_URL).
 */

import requerimentosRaw from './data/requerimentos.json';
import horariosRaw from './data/horarios.json';
import { localSemanticSearch, searchRelevantChunks, formatChunksForPrompt, RAGSearchResult } from './ragClient';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function normalizarTexto(texto: string): string {
  if (!texto) return '';
  return texto
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const COURSE_SYNONYMS: Record<string, string[]> = {
  ccomp: ['ccomp', 'computacao', 'ciencia da computacao'],
  ads: ['ads', 'analise e desenvolvimento de sistemas', 'analise de sistemas', 'desenvolvimento de sistemas'],
  adm: ['adm', 'administracao'],
  cont: ['contabeis', 'contabilidade', 'ciencias contabeis'],
  econ: ['economia', 'economicas', 'ciencias economicas'],
};

const HORARIO_INTENT_TERMS = [
  'horario', 'horarios', 'grade', 'aula', 'aulas', 'sala', 'salas',
  'lab', 'laboratorio', 'laboratorios', 'professor', 'professores',
  'professora', 'professoras', 'materia', 'materias', 'disciplina',
  'disciplinas', 'turma', 'turmas', 'segunda', 'terca', 'quarta',
  'quinta', 'sexta', 'sabado', 'noturno', 'matutino', 'semestre',
];

const STOP_WORDS = new Set([
  'qual', 'quais', 'onde', 'quem', 'como', 'quando', 'aulas', 'aula',
  'horario', 'horarios', 'grade', 'materia', 'materias', 'disciplina',
  'disciplinas', 'para', 'com', 'por', 'que', 'tem', 'tenho', 'dada',
  'pelo', 'pela', 'sobre', 'quero', 'gostaria', 'saber', 'favor', 'dia', 'dias',
]);

/**
 * Busca inteligente nas turmas e grades de horários por turma, disciplina, professor,
 * sala, laboratório, dia da semana, curso e semestre.
 */
export function buscarHorariosRelevantes(query: string, topK: number = 5): any[] {
  if (!query || !query.trim()) return [];

  const normQ = normalizarTexto(query);
  const qWords = normQ.split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  const qTokens = new Set(qWords);

  const temIntencao = HORARIO_INTENT_TERMS.some((t) => normQ.includes(t)) || qTokens.size > 0;
  if (!temIntencao) return [];

  // Detecta menção a semestre
  const semMatch = normQ.match(/\b([1-8])\s*(o|º|ª)?\s*(sem|semestre)?\b/);
  let targetSem: number | null = semMatch ? parseInt(semMatch[1], 10) : null;
  const turmaSemMatch = normQ.match(/\b([1-8])\s*n[ab]\b/);
  if (turmaSemMatch) {
    targetSem = parseInt(turmaSemMatch[1], 10);
  }

  // Detecta curso mencionado
  const targetCourses: string[] = [];
  for (const [key, syns] of Object.entries(COURSE_SYNONYMS)) {
    if (syns.some((s) => normQ.includes(s))) {
      targetCourses.push(key);
    }
  }

  const scored: { score: number; item: any }[] = [];

  for (const h of horariosRaw as any[]) {
    let score = 0;
    const normCod = normalizarTexto(h.codigo || '');
    const normCurso = normalizarTexto(h.curso || '');
    const normTid = normalizarTexto(h.turma_id || '');
    const apelidosNorm = (h.apelidos || []).map((a: string) => normalizarTexto(a));
    const sem = h.semestre;

    // 1. Correspondência direta de código ou apelidos da turma
    for (const a of apelidosNorm) {
      if (normQ.includes(a)) {
        score += 260 + a.length * 5;
      }
    }
    if (normQ.includes(normCod)) {
      score += 220 + normCod.length * 5;
    } else if (normQ.includes(normTid)) {
      score += 200;
    }

    // 2. Correspondência por curso
    let matchedCourse = false;
    if (targetCourses.includes('ccomp') && (normCurso.includes('computacao') || normTid.includes('ccomp'))) {
      score += 50;
      matchedCourse = true;
    }
    if (targetCourses.includes('ads') && normCurso.includes('ads')) {
      score += 50;
      matchedCourse = true;
    }
    if (targetCourses.includes('adm') && (normCurso.includes('administracao') || normTid.includes('adm'))) {
      score += 50;
      matchedCourse = true;
    }
    if (targetCourses.includes('cont') && (normCurso.includes('contabeis') || normTid.includes('_cc'))) {
      score += 50;
      matchedCourse = true;
    }
    if (targetCourses.includes('econ') && (normCurso.includes('economicas') || normTid.includes('_ce'))) {
      score += 50;
      matchedCourse = true;
    }

    // 3. Correspondência por semestre
    if (targetSem !== null && sem === targetSem) {
      score += matchedCourse ? 120 : 35;
    }

    // 4. Busca detalhada na grade (disciplina, professor, sala, dia)
    for (const g of h.grade || []) {
      const normDisc = normalizarTexto(g.disciplina || '');
      const normProf = normalizarTexto(g.professor || '');
      const normSala = normalizarTexto(g.sala_lab || '');
      const normDia = normalizarTexto(g.dia || '');

      if (normDisc && normQ.includes(normDisc)) {
        score += 190;
      } else {
        const discWords = normDisc.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
        const hits = discWords.filter((w) => qTokens.has(w)).length;
        if (hits > 0) score += hits * 55;
      }

      if (normProf && normQ.includes(normProf)) {
        score += 190;
      } else {
        const profWords = normProf.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
        const hits = profWords.filter((w) => qTokens.has(w)).length;
        if (hits > 0) score += hits * 55;
      }

      if (normSala && normQ.includes(normSala)) {
        score += 160;
      } else if (normQ.includes('lab')) {
        const salaWords = normSala.split(/\s+/).filter((w) => w.length > 2);
        if (salaWords.some((w) => qTokens.has(w))) {
          score += 110;
        }
      }

      if (normDia && normQ.includes(normDia) && (matchedCourse || score > 40)) {
        score += 30;
      }
    }

    if (score > 0) {
      scored.push({ score, item: h });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.item);
}

/**
 * Busca inteligente no catálogo oficial de requerimentos por título, tipo, grupo e descrição.
 */
export function buscarRequerimentosRelevantes(query: string, topK: number = 3): any[] {
  if (!query || !query.trim()) return [];

  const normQ = normalizarTexto(query);
  const qWords = normQ.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const qTokens = new Set(qWords);
  if (qTokens.size === 0) return [];

  const scored: { score: number; item: any }[] = [];

  for (const r of requerimentosRaw as any[]) {
    let score = 0;
    const normTit = normalizarTexto(r.titulo || '');
    const normTipo = normalizarTexto(r.tipo_de_requerimento || '');
    const normGrupo = normalizarTexto(r.grupo_de_atendimento || '');
    const normDesc = normalizarTexto(r.descricao || '');
    const normProc = normalizarTexto(r.procedimentos || '');
    const tags = (r.tags || []).map((t: string) => normalizarTexto(t));

    if (normTit && normQ.includes(normTit)) {
      score += 220;
    } else {
      const titWords = normTit.split(/\s+/).filter((w) => w.length > 2);
      const hits = titWords.filter((w) => qTokens.has(w)).length;
      if (hits > 0) score += hits * 45;
    }

    for (const t of tags) {
      if (qTokens.has(t)) score += 35;
    }

    for (const w of qTokens) {
      if (normDesc.includes(w)) score += 12;
      if (normProc.includes(w)) score += 12;
    }

    if (normQ.includes('sptrans') && normTit.includes('sptrans')) score += 160;
    else if (normQ.includes('emtu') && normTit.includes('emtu')) score += 160;
    else if (normQ.includes('tranc') && normTit.includes('trancamento')) score += 110;
    else if ((normQ.includes('assistencia') || normQ.includes('desemprego')) && normTit.includes('assistencia financeira')) score += 160;
    else if (normQ.includes('impress') && normTit.includes('impressao')) score += 160;
    else if (normQ.includes('bolsa') && normQ.includes('ex aluno') && normTit.includes('ex aluno')) score += 160;
    else if (normQ.includes('transferencia') && normTit.includes('transferencia')) score += 110;

    if (score > 0) {
      scored.push({ score, item: r });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.item);
}

/**
 * Filtra inteligentemente o contexto relevante de horários e requerimentos
 * para garantir máxima velocidade e respeitar a janela de tokens da API Groq.
 */
function filtrarContextoRelevante(mensagens: GroqChatMessage[]): string {
  const ultimaMsg = mensagens[mensagens.length - 1]?.content || '';

  const horariosFiltrados = buscarHorariosRelevantes(ultimaMsg, 3);
  const reqsFiltrados = buscarRequerimentosRelevantes(ultimaMsg, 3);

  // 3. Recuperação Aumentada por Geração (RAG Semântico/Vetorial) nos PDFs de DocumentosASA
  // Se encontramos turmas no JSON oficial de horários, excluímos PDFs fragmentados de horários do RAG
  const excluirHorariosRAG = horariosFiltrados.length > 0;
  const ragChunks = localSemanticSearch(ultimaMsg, 4, excluirHorariosRAG);
  const contextoRAG = formatChunksForPrompt(ragChunks);

  const blocoReqs = reqsFiltrados.length > 0 
    ? JSON.stringify(reqsFiltrados, null, 2) 
    : 'Nenhum requerimento específico para esta consulta.';

  const blocoHorarios = horariosFiltrados.length > 0
    ? JSON.stringify(horariosFiltrados, null, 2)
    : 'Nenhuma grade de horários específica necessária para esta consulta.';

  return `
CATÁLOGO OFICIAL DE REQUERIMENTOS RELEVANTES (JSON):
${blocoReqs}

GRADE OFICIAL DE HORÁRIOS E SALAS DE AULA RELEVANTES (JSON):
${blocoHorarios}

DOCUMENTOS E REGULAMENTOS OFICIAIS RECUPERADOS VIA RAG (PASTA DocumentosASA):
${contextoRAG}
`;
}

export function buildSystemPrompt(mensagens: GroqChatMessage[]): string {
  const contexto = filtrarContextoRelevante(mensagens);

  return `
Você é o SISA (Sistema Inteligente do Sucesso Alvarista) e Agente de IA do aplicativo ASA da FECAP.
Sua missão primordial é orientar estudantes, pais, professores e funcionários sobre serviços acadêmicos, procedimentos, horários de aulas, salas, laboratórios, professores, portal do aluno, documentos oficiais e regulamentos da instituição.

${contexto}

DIRETRIZES FUNDAMENTAIS DE ATENDIMENTO:
1. **REGRA SUPREMA PARA HORÁRIOS E SALAS DE AULA (ATENÇÃO MÁXIMA)**:
   - Para qualquer pergunta sobre horários de aula, turmas, matérias, professores, salas ou laboratórios, você DEVE consultar e utilizar EXCLUSIVAMENTE os dados da "GRADE OFICIAL DE HORÁRIOS E SALAS DE AULA RELEVANTES (JSON)" acima.
   - NUNCA utilize trechos de PDFs ou deduza horários faltantes.
   - É expressamente PROIBIDO responder que disciplinas de quinta ou sexta-feira não estão especificadas se a turma estiver presente no JSON. Todas as turmas cadastradas no JSON contam com grade completa de 5 dias letivos (segunda a sexta-feira).
   - Apresente OBRIGATORIAMENTE todas as disciplinas da grade da turma solicitada exatamente como cadastradas no JSON, detalhando: **Dia da Semana**, **Horário**, **Disciplina**, **Professor(a)** e **Sala / Laboratório**.
   - Indique sempre a Turma (ex: 5NA ADM, CCOMP 4, 1NA ADS), Curso, Semestre e Período (Noturno).
2. **Requerimentos Acadêmicos e Procedimentos**:
   - Quando o estudante perguntar sobre solicitações acadêmicas, utilize as informações do "CATÁLOGO OFICIAL DE REQUERIMENTOS RELEVANTES (JSON)".
   - Informe: Nome oficial do requerimento, Grupo/Setor responsável, Valor/Taxa, Caminho no Portal do Aluno (\`caminho_sistema\`), Documentos/Anexos obrigatórios e Procedimentos passo a passo.
3. **Base de Conhecimento Oficial & Citação de Fontes**:
   - Responda com precisão técnica baseando-se estritamente nas normas e regulamentos da FECAP.
   - Toda resposta sobre procedimentos institucionais deve citar expressamente a fonte e a data de atualização ou página:
     *(Exemplo: 📌 **Fonte**: Regulamento do Programa de Bolsas Restituíveis FECAP | DocumentosASA).*
4. **Programas Financeiros e Bolsas (ATENÇÃO RIGOROSA)**:
   - A FECAP **POSSUI SIM** o "Programa de Bolsas Restituíveis FECAP" (arquivo: Regulamento_do_Programa_de_Bolsas_Restituíveis_FECAP.pdf). Este programa permite o pagamento parcial das mensalidades da graduação durante o curso, devendo o estudante restituir/quitar o saldo restante após a conclusão da graduação.
   - A FECAP também possui separadamente o "Programa de Assistência Financeira Educacional" (PAFE), que é um benefício emergencial para continuidade de estudos em caso de desemprego, falecimento ou invalidez do responsável financeiro.
   - **NUNCA diga que a FECAP não possui programa de bolsas restituíveis!** Trata-se de um benefício oficial com regulamento próprio.
5. **Passo a Passo Prático**:
   - Organize procedimentos em etapas numeradas (Etapa 1, Etapa 2, Etapa 3).
   - Indique claramente o setor competente (ex: Central de Atendimento ao Aluno - CAA, Secretaria Geral, Financeiro, Coordenação de Curso).
   - Informe prazos em dias úteis e documentos comprobatórios necessários.
6. **Canais e Links Autorizados**:
   - Mencione os canais oficiais: Portal do Aluno (portal.fecap.br), CAA Presencial (Bloco A), WhatsApp Oficial da CAA (11 3272-2222) ou e-mail institucional.
7. **Transferência para Atendimento Humano**:
   - Caso a dúvida envolva casos excepcionais, quebra de pré-requisito, análise financeira sensível ou se o estudante solicitar falar com uma pessoa, ofereça a opção de transferência:
     *"Caso prefira atendimento personalizado, você pode acionar a transferência para um atendente humano da CAA pelo botão de atendimento no app ou pelo ramal 4004."*
8. **Formatação Mobile**:
   - Use Markdown limpo com negrito, tabelas e tópicos para excelente legibilidade na tela do smartphone.
`.trim();
}

export const groqClient = {
  /**
   * Envia a mensagem para o Backend, que executa o agente Groq server-side.
   * O Frontend nunca acessa api.groq.com diretamente.
   */
  async chatCompletion(messages: GroqChatMessage[]): Promise<string> {
    const lastUserMsg = messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '';
    const history = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: lastUserMsg, history }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro Backend (${response.status}): ${errorData?.detail || response.statusText}`);
    }

    const data = await response.json();
    const content = data?.response;
    if (!content) {
      throw new Error('Resposta inesperada do Backend: campo "response" ausente.');
    }
    return content;
  },

  getRequerimentos() {
    return requerimentosRaw;
  },

  getHorarios() {
    return horariosRaw;
  },

  getSugestoes(): string[] {
    return [
      'Quero os horários de CCOMP 4',
      'Quais são os horários da turma 1NA de Administração?',
      'Como solicitar o Passe Escolar / SPTrans?',
      'Qual a sala e professor de Cálculo na segunda-feira?',
      'Como pedir trancamento de curso e qual o prazo?',
      'Quais as matérias do 5NA Noturno?',
    ];
  },
};
