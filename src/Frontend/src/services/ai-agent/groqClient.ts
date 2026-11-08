import { Platform } from 'react-native';
import { fetchWithAuth } from '../api/apiClient';
/**
 * ============================================================================
 * INTEGRAÃ‡ÃƒO OFICIAL GROQ API â€” SISA FECAP (MARKDOWN-FIRST & CONTEXT-AWARE)
 * ============================================================================
 */

import requerimentosRaw from './data/requerimentos.json';
import horariosRaw from './data/horarios.json';
import horariosDpSabadoRaw from './data/horarios_dp_sabado.json';
import {
  localSemanticSearch,
  searchAllKnowledgeChunksAsync,
  isExamOrCalendarQuery,
  formatChunksForPrompt,
  expandAcademicQuery,
  RAGSearchResult,
} from './ragClient';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const DEFAULT_FALLBACK_GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

export const getGroqApiKey = (): string =>
  process.env.EXPO_PUBLIC_GROQ_API_KEY ||
  process.env.GROQ_API_KEY ||
  DEFAULT_FALLBACK_GROQ_KEY;

export const getGroqModel = (): string =>
  process.env.EXPO_PUBLIC_GROQ_MODEL ||
  process.env.GROQ_MODEL ||
  'qwen/qwen3.8-27b';

export const isGroqConfigured = Boolean(
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  (getGroqApiKey() && getGroqApiKey().trim().length > 10)
);

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function isGreetingMessage(texto: string): boolean {
  if (!texto) return false;
  const clean = normalizarTexto(texto);
  const greetingWords = new Set([
    'oi', 'ola', 'opa', 'eae', 'e ai', 'salve', 'hello', 'hi', 'hey',
    'bom dia', 'boa tarde', 'boa noite', 'fala', 'fala ai',
    'tudo bem', 'tudo bom', 'tudo certo', 'como vai', 'blz', 'beleza'
  ]);
  if (greetingWords.has(clean)) return true;
  return /^(oi|ola|opa|e ai|eae|salve|bom dia|boa tarde|boa noite)(\s+(tudo bem|tudo bom|blz|beleza|ia|sisa|asa|fecap|amigo|amiga))?$/i.test(clean);
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
  ccomp: ['ccomp', 'ccpt', 'comp', 'computacao', 'ciencia da computacao'],
  ads: ['ads', 'analise e desenvolvimento de sistemas', 'analise de sistemas', 'desenvolvimento de sistemas'],
  adm: ['adm', 'administracao'],
  cont: ['contabeis', 'contabilidade', 'ciencias contabeis', 'cc', 'ccg', 'contabeis para graduados'],
  econ: ['econo', 'econ', 'economia', 'economicas', 'ciencias economicas', 'ce'],
  ri: ['ri', 'relacoes internacionais'],
  pp: ['pp', 'publicidade', 'publicidade e propaganda', 'comunicacao social'],
  rp: ['rp', 'relacoes publicas'],
  sec: ['sec', 'secretariado', 'secretariado executivo'],
};

const COURSE_LABELS: Record<string, string> = {
  ccomp: 'CiÃªncia da ComputaÃ§Ã£o',
  ads: 'AnÃ¡lise e Desenvolvimento de Sistemas (ADS)',
  adm: 'AdministraÃ§Ã£o',
  cont: 'CiÃªncias ContÃ¡beis',
  econ: 'CiÃªncias EconÃ´micas',
  ri: 'RelaÃ§Ãµes Internacionais',
  pp: 'Publicidade e Propaganda',
  rp: 'RelaÃ§Ãµes PÃºblicas',
  sec: 'Secretariado Executivo',
};

const STOP_WORDS = new Set([
  'qual', 'quais', 'onde', 'quem', 'como', 'quando', 'aulas', 'aula',
  'horario', 'horarios', 'grade', 'materia', 'materias', 'disciplina',
  'disciplinas', 'para', 'pra', 'pro', 'com', 'por', 'que', 'tem', 'tenho',
  'dada', 'pelo', 'pela', 'sobre', 'quero', 'gostaria', 'saber', 'favor',
  'dia', 'dias', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'um', 'uma',
  'o', 'a', 'os', 'as', 'prova', 'provas', 'po', 'data', 'sala', 'curso', 'turma',
]);

const PROCEDURAL_REQ_TRIGGERS = [
  'requerimento', 'protocolo', 'protocolar', 'solicitar', 'solicitacao',
  'como peco', 'como pedir', 'como abrir', 'abrir chamado', 'segunda via',
  'atestado de matricula', 'declaracao de matricula', 'historico escolar',
  'passe escolar', 'bilhete unico', 'sptrans', 'emtu', 'trancamento', 'trancar',
  'cancelamento', 'cancelar matricula', 'transferencia', 'reembolso', 'restituicao',
  'abatimento', 'assinar contrato', 'termo de compromisso', 'tce', 'dispensa de disciplina',
  'aproveitamento', 'equivalencia', 'abono de falta', 'atestado medico', 'regime domiciliar',
  'revisao de nota', 'segunda chamada', 'colacao de grau', 'diploma', 'fies', 'prouni',
];

export interface StudentAcademicProfile {
  ra?: string;
  name?: string;
  course?: string;
  semester?: string;
  turma?: string;
  status?: string;
}

export interface ConversationContextState {
  cursoCanonico: string | null;
  cursoLabel: string | null;
  codigoTurma: string | null;
  semestre: number | null;
  intencao: 'data_prova' | 'horario_aula' | 'pedp' | 'estagio' | 'criterio_nota' | 'bolsa_financeiro' | 'calendario' | 'requerimento' | null;
  ehDpSabado: boolean;
  ultimaPergunta: string;
  queryContextualizada: string;
  humor: string;
  instrucaoTom: string;
  ambiguidadeAlerta: string;
  veioDoPerfil: boolean;
}

export function detectarHumorEstudanteTS(query: string): { humor: string; instrucaoTom: string } {
  const norm = normalizarTexto(query);
  if (/\b(socorro|desesperad|medo|ferrad|lascad|bombei|rodei|reprovei|perdi a prova|perdi o prazo|urgente|me ajuda|perdido|ansios|desempreg|sem grana)\b/.test(norm)) {
    return {
      humor: 'ansioso_ou_preocupado',
      instrucaoTom: 'O estudante demonstra ansiedade ou preocupaÃ§Ã£o. Acolha com empatia e tranquilidade logo na primeira frase e apresente o caminho/datas oficiais de forma clara e segura.',
    };
  }
  if (/\b(absurdo|ridiculo|ninguem responde|nao funciona|travou|injusto|sacanagem|pessimo|horrivel|irritad)\b/.test(norm)) {
    return {
      humor: 'frustrado_ou_irritado',
      instrucaoTom: 'O estudante demonstra frustraÃ§Ã£o. Mantenha postura serena, respeitosa e 100% resolutiva, indo direto Ã  soluÃ§Ã£o verificada.',
    };
  }
  if (/\b(nao entendi|como assim|confus|qual a diferenca|me explica|explica melhor|boiei|duvida)\b/.test(norm)) {
    return {
      humor: 'confuso_ou_em_duvida',
      instrucaoTom: 'O estudante estÃ¡ confuso ou com dÃºvida conceitual. Seja didÃ¡tico e organize em tÃ³picos curtos e claros.',
    };
  }
  if (/\b(mano|cara|salve|opa|eae|blz|vlw|vc|pq|oq|qnd|pfvr|tbm|trampo|grana|econo|ccomp)\b/.test(norm)) {
    return {
      humor: 'casual_coloquial',
      instrucaoTom: 'O estudante usa linguagem universitÃ¡ria informal/gÃ­rias. Responda em tom amigÃ¡vel, prÃ³ximo e fluido, mantendo total exatidÃ£o nos dados.',
    };
  }
  return {
    humor: 'objetivo_padrao',
    instrucaoTom: 'Responda com simpatia, clareza e objetividade.',
  };
}

export function assimilarContextoConversaTS(
  mensagens: GroqChatMessage[],
  studentProfile?: StudentAcademicProfile
): ConversationContextState {
  const userMsgs = mensagens.filter((m) => m.role === 'user').map((m) => m.content || '');
  const ultimaPergunta = userMsgs[userMsgs.length - 1] || '';

  let cursoCanonico: string | null = null;
  let cursoLabel: string | null = null;
  let codigoTurma: string | null = null;
  let semestre: number | null = null;
  let intencao: ConversationContextState['intencao'] = null;
  let ehDpSabado = false;
  let veioDoPerfil = false;

  // 1. Inicializa com o perfil acadÃªmico do aluno logado, se disponÃ­vel
  if (studentProfile) {
    const normProfile = normalizarTexto(
      `${studentProfile.course || ''} ${studentProfile.semester || ''} ${studentProfile.turma || ''}`
    );
    if (normProfile) {
      for (const [key, syns] of Object.entries(COURSE_SYNONYMS)) {
        if (syns.some((s) => new RegExp(`\\b${s}\\b`).test(normProfile))) {
          cursoCanonico = key;
          cursoLabel = COURSE_LABELS[key] || key;
          veioDoPerfil = true;
          break;
        }
      }
      const turmaProfM = normProfile.match(/\b([1-8]\s*(?:n[abcd]|m[ab]|naccg|nacc))\b/);
      if (turmaProfM) {
        codigoTurma = turmaProfM[1].replace(/\s+/g, '');
        semestre = parseInt(codigoTurma[0], 10);
        veioDoPerfil = true;
      } else {
        const semProfM = normProfile.match(/\b([1-8])\s*(?:o|Âº|Âª)?\s*(?:sem|semestre|periodo)?\b/);
        if (semProfM) {
          semestre = parseInt(semProfM[1], 10);
          veioDoPerfil = true;
        }
      }
      if (!codigoTurma && semestre && cursoCanonico) {
        codigoTurma = `${semestre}na`;
      }
    }
  }

  // 2. Percorre os turnos da conversa (sobrescrevendo o perfil padrÃ£o caso o estudante pergunte sobre outra turma/curso)
  for (const rawMsg of userMsgs) {
    const norm = normalizarTexto(rawMsg);

    for (const [key, syns] of Object.entries(COURSE_SYNONYMS)) {
      if (syns.some((s) => new RegExp(`\\b${s}\\b`).test(norm))) {
        if (veioDoPerfil && key !== cursoCanonico) {
          codigoTurma = null;
          semestre = null;
        }
        cursoCanonico = key;
        cursoLabel = COURSE_LABELS[key] || key;
        veioDoPerfil = false;
        break;
      }
    }

    const turmaM = norm.match(/\b([1-8]\s*(?:n[abcd]|m[ab]|naccg|nacc))\b/);
    if (turmaM) {
      codigoTurma = turmaM[1].replace(/\s+/g, '');
      semestre = parseInt(codigoTurma[0], 10);
      veioDoPerfil = false;
    } else {
      const semM = norm.match(/\b([1-8])\s*(?:o|Âº|Âª)?\s*(?:sem|semestre|periodo)\b/);
      if (semM) {
        semestre = parseInt(semM[1], 10);
        veioDoPerfil = false;
      }
    }

    if (/\b(dp|dps|dependencia|adapt|adaptacao|sabado|sabados)\b/.test(norm)) {
      ehDpSabado = true;
    }

    if (/\b(prova|provas|po|exame|exames|substitutiva|segunda chamada|vista de prova)\b/.test(norm)) {
      intencao = 'data_prova';
    } else if (/\b(sala|salas|laboratorio|lab|grade|aula|aulas|professor|professora|docente)\b/.test(norm)) {
      intencao = 'horario_aula';
    } else if (/\b(pedp|bonus do livro|simulado)\b/.test(norm)) {
      intencao = 'pedp';
    } else if (/\b(estagio|tce|termo de compromisso|trampo)\b/.test(norm)) {
      intencao = 'estagio';
    } else if (/\b(criterio|media|peso|pesos|ni|nota intermediaria)\b/.test(norm)) {
      intencao = 'criterio_nota';
    } else if (/\b(bolsa|bolsas|pafe|restituivel|prouni|fies|mensalidade|desconto|rematricula)\b/.test(norm)) {
      intencao = 'bolsa_financeiro';
    }
  }

  const normUltima = normalizarTexto(ultimaPergunta);
  const ehSaudacao = isGreetingMessage(ultimaPergunta);
  const partesBusca = [ultimaPergunta];
  if (!ehSaudacao) {
    if (cursoLabel && cursoCanonico && !normUltima.includes(cursoCanonico)) {
      partesBusca.push(cursoLabel);
    }
    if (codigoTurma && !normUltima.includes(codigoTurma)) {
      partesBusca.push(codigoTurma);
    }
    if (intencao === 'data_prova' && !normUltima.includes('prova')) {
      partesBusca.push('data da prova oficial PO');
    } else if (intencao === 'horario_aula' && !/\b(aula|sala|horario|grade)\b/.test(normUltima)) {
      partesBusca.push('grade de horario e sala de aula');
    }
  }

  const { humor, instrucaoTom } = detectarHumorEstudanteTS(ultimaPergunta);

  let ambiguidadeAlerta = '';
  if ((intencao === 'data_prova' || intencao === 'horario_aula') && !ehDpSabado && !cursoCanonico && !codigoTurma) {
    ambiguidadeAlerta =
      'O estudante perguntou sobre prova/aula sem informar curso nem turma. PeÃ§a gentilmente que informe seu curso e turma/semestre (ex.: 1NA Economia, 3NA ADM, 2NA CCOMP, 1NA ADS ou DP aos sÃ¡bados).';
  } else if (cursoCanonico === 'econ' && semestre && semestre >= 4 && /\b(calculo|calc)\b/.test(normUltima)) {
    ambiguidadeAlerta =
      `O estudante estÃ¡ no contexto da turma ${codigoTurma?.toUpperCase() || `${semestre}Âº semestre`} de CiÃªncias EconÃ´micas, cuja grade regular nÃ£o possui CÃ¡lculo (CÃ¡lculo I Ã© do 1Âº semestre e CÃ¡lculo II Ã© do 2Âº semestre no Eixo Comum, alÃ©m de DP aos SÃ¡bados). Explique isso com clareza, informe jÃ¡ as datas de CÃ¡lculo I (1NA/1NB Eixo Comum), CÃ¡lculo II (2NA-2ND Eixo Comum) e CÃ¡lculo de DP aos SÃ¡bados (28/11/2026) e pergunte qual deles ele estÃ¡ cursando.`;
  }

  return {
    cursoCanonico,
    cursoLabel,
    codigoTurma,
    semestre,
    intencao,
    ehDpSabado,
    ultimaPergunta,
    queryContextualizada: partesBusca.join(' ').trim(),
    humor,
    instrucaoTom,
    ambiguidadeAlerta,
    veioDoPerfil,
  };
}

export function gerarQuickRepliesContextuais(
  userMessage: string,
  replyText: string,
  ctxState: ConversationContextState,
  studentProfile?: StudentAcademicProfile
): string[] {
  const normUser = normalizarTexto(userMessage);
  const normReply = normalizarTexto(replyText);

  // 1. Esclarecimento especÃ­fico de CÃ¡lculo (CÃ¡lculo I vs CÃ¡lculo II vs DP SÃ¡bado)
  if (
    /\b(calculo|calc)\b/.test(normUser) &&
    (normReply.includes('calculo i') || normReply.includes('calculo ii') || normReply.includes('qual deles'))
  ) {
    return [
      'Prova de CÃ¡lculo I (1NA Eixo Comum)',
      'Prova de CÃ¡lculo II (2NA Eixo Comum)',
      'Prova de CÃ¡lculo DP SÃ¡bado',
    ];
  }

  // 2. Pergunta esclarecedora quando falta curso/turma
  if (
    ctxState.ambiguidadeAlerta ||
    normReply.includes('qual o seu curso') ||
    normReply.includes('poderia especificar') ||
    normReply.includes('qual turma')
  ) {
    const chips: string[] = [];
    if (studentProfile?.course) {
      const semNum = studentProfile.semester?.match(/\d+/)?.[0] || '5';
      chips.push(`Minha turma: ${semNum}NA ${studentProfile.course}`);
    }
    chips.push('5NA Economia', '2NA CiÃªncia da ComputaÃ§Ã£o', '1NA AdministraÃ§Ã£o', 'DP aos SÃ¡bados');
    return chips.slice(0, 4);
  }

  // 3. Continuidade apÃ³s consulta de Prova Oficial (PO) de uma turma especÃ­fica
  if (ctxState.intencao === 'data_prova' && ctxState.codigoTurma) {
    const tCode = ctxState.codigoTurma.toUpperCase();
    if (ctxState.cursoCanonico === 'econ' && tCode === '5NA') {
      return [
        'E a de Econometria?',
        'E a de CÃ¡lculo?',
        `HorÃ¡rios de aula do ${tCode} Econo`,
      ];
    }
    return [
      `Todas as provas da turma ${tCode}`,
      `Grade de aulas da turma ${tCode}`,
      'Como funciona o cÃ¡lculo de mÃ©dia e Exame?',
    ];
  }

  // 4. Continuidade apÃ³s consulta de HorÃ¡rios / Salas de aula
  if (ctxState.intencao === 'horario_aula' && ctxState.codigoTurma) {
    const tCode = ctxState.codigoTurma.toUpperCase();
    return [
      `Datas das Provas Oficiais do ${tCode}`,
      'Quando Ã© a prova de DP aos sÃ¡bados?',
      'Como funciona o PEDP?',
    ];
  }

  // 5. Continuidade apÃ³s CritÃ©rio de AvaliaÃ§Ã£o / Nota / Exame / PEDP
  if (ctxState.intencao === 'criterio_nota' || ctxState.intencao === 'pedp') {
    return [
      'Qual a nota mÃ­nima no Exame Final?',
      'O que Ã© o PEDP e BÃ´nus do Livro?',
      'CalendÃ¡rio de Provas e Exames 2026-2',
    ];
  }

  // 6. Continuidade apÃ³s Bolsas / Financeiro / RematrÃ­cula
  if (ctxState.intencao === 'bolsa_financeiro') {
    return [
      'Como solicitar o auxÃ­lio PAFE?',
      'Como funciona a Bolsa RestituÃ­vel?',
      'Prazos de RematrÃ­cula 2026-2',
    ];
  }

  // 7. Continuidade apÃ³s EstÃ¡gio
  if (ctxState.intencao === 'estagio') {
    return [
      'Qual o prazo para assinatura do TCE?',
      'Limite de horas diÃ¡rias de estÃ¡gio',
      'Como enviar RelatÃ³rio de EstÃ¡gio?',
    ];
  }

  // Chips contextuais padrÃ£o baseados no perfil do aluno
  if (ctxState.codigoTurma && ctxState.cursoLabel) {
    const tCode = ctxState.codigoTurma.toUpperCase();
    return [
      `Provas Oficiais da turma ${tCode}`,
      `HorÃ¡rios de aula do ${tCode}`,
      'Como funciona a mÃ©dia (NI, PO e PEDP)?',
    ];
  }

  return [
    'Datas das Provas Oficiais (PO)',
    'Como funciona a mÃ©dia (NI, PO e PEDP)?',
    'Bolsas e AuxÃ­lio Financeiro PAFE',
  ];
}

export function buscarHorariosRelevantes(query: string, topK: number = 3): any[] {
  if (!query || !query.trim()) return [];

  const normQ = normalizarTexto(expandAcademicQuery(query));
  const qWords = normQ.split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  const qTokens = new Set(qWords);

  const semMatch = normQ.match(/\b([1-8])\s*(o|Âº|Âª)?\s*(sem|semestre)?\b/);
  let targetSem: number | null = semMatch ? parseInt(semMatch[1], 10) : null;
  const turmaSemMatch = normQ.match(/\b([1-8])\s*n[abcd]\b/);
  if (turmaSemMatch) {
    targetSem = parseInt(turmaSemMatch[1], 10);
  }

  const targetCourses: string[] = [];
  for (const [key, syns] of Object.entries(COURSE_SYNONYMS)) {
    if (syns.some((s) => new RegExp(`\\b${s}\\b`).test(normQ))) {
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

    for (const a of apelidosNorm) {
      if (new RegExp(`\\b${a}\\b`).test(normQ)) {
        score += 240 + a.length * 4;
      }
    }
    if (normQ.includes(normCod)) {
      score += 220;
    } else if (normQ.includes(normTid)) {
      score += 200;
    }

    let matchedCourse = false;
    if (targetCourses.includes('ccomp') && (normCurso.includes('computacao') || normTid.includes('ccomp'))) {
      score += 180;
      matchedCourse = true;
    }
    if (targetCourses.includes('ads') && normCurso.includes('ads')) {
      score += 180;
      matchedCourse = true;
    }
    if (targetCourses.includes('adm') && (normCurso.includes('administracao') || normTid.includes('adm') || normTid.includes('eixo_comum'))) {
      score += 180;
      matchedCourse = true;
    }
    if (targetCourses.includes('cont') && (normCurso.includes('contabeis') || normTid.includes('_cc') || normTid.includes('ccg') || normTid.includes('eixo_comum'))) {
      score += 180;
      matchedCourse = true;
    }
    if (targetCourses.includes('econ') && (normCurso.includes('economicas') || normTid.includes('_ce') || normTid.includes('eixo_comum'))) {
      score += 180;
      matchedCourse = true;
    }
    if (targetCourses.includes('ri') && normTid.includes('_ri')) {
      score += 180;
      matchedCourse = true;
    }

    if (targetSem !== null && sem === targetSem) {
      score += matchedCourse ? 140 : 40;
    }

    for (const g of h.grade || []) {
      const normDisc = normalizarTexto(g.disciplina || '');
      const normProf = normalizarTexto(g.professor || '');
      const normSala = normalizarTexto(g.sala_lab || '');

      if (normDisc && normQ.includes(normDisc)) {
        score += 190;
      } else {
        const discWords = normDisc.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
        const hits = discWords.filter((w) => qTokens.has(w)).length;
        if (hits > 0) score += hits * 50;
      }

      if (normProf && normQ.includes(normProf)) {
        score += 160;
      }
      if (normSala && normQ.includes(normSala)) {
        score += 140;
      }
    }

    if (score >= 70) {
      scored.push({ score, item: h });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.item);
}

/**
 * Busca de alta precisÃ£o no catÃ¡logo oficial de requerimentos:
 * Evita falsos positivos em perguntas puramente informativas de datas de provas, horÃ¡rios ou salas.
 */
export function buscarRequerimentosRelevantes(
  query: string,
  topK: number = 2,
  highPrecisionOnly: boolean = true
): any[] {
  if (!query || !query.trim()) return [];

  const rawNorm = normalizarTexto(query);
  const normQ = normalizarTexto(expandAcademicQuery(query));

  const isPureInfoQuery =
    /\b(qual a data|quando e a prova|qual o dia da prova|qual a sala|qual o horario|quem da aula|quem e o professor|e a de )\b/.test(rawNorm) &&
    !PROCEDURAL_REQ_TRIGGERS.some((trig) => normQ.includes(trig)) &&
    !/\b(perdi|faltei|conflito|atestado|revisao|segunda chamada|substitutiva|solicitar|requerimento|abrir)\b/.test(rawNorm);

  if (highPrecisionOnly && isPureInfoQuery) {
    return [];
  }

  const hasProceduralTrigger = PROCEDURAL_REQ_TRIGGERS.some((trig) => normQ.includes(trig));
  const qWords = normQ.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const qTokens = new Set(qWords);
  if (qTokens.size === 0 && !hasProceduralTrigger) return [];

  const genericTags = new Set(['academicos', 'servicos', 'financeiros', 'solicitar', 'aluno', 'curso', 'disciplinas', 'provas', 'horarios', 'notas']);
  const scored: { score: number; item: any }[] = [];

  for (const r of requerimentosRaw as any[]) {
    let score = 0;
    const normTit = normalizarTexto(r.titulo || '');
    const tags = (r.tags || []).map((t: string) => normalizarTexto(t));

    if (normTit && normQ.includes(normTit)) {
      score += 240;
    } else {
      const titWords = normTit.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
      const hits = titWords.filter((w) => qTokens.has(w) && !genericTags.has(w)).length;
      if (hits >= 2) score += hits * 65;
      else if (hits === 1) score += 40;
    }

    for (const t of tags) {
      if (qTokens.has(t) && !genericTags.has(t)) score += 30;
    }

    if (normQ.includes('sptrans') && normTit.includes('sptrans')) score += 220;
    else if (normQ.includes('emtu') && normTit.includes('emtu')) score += 220;
    else if (normQ.includes('tranc') && normTit.includes('trancamento')) score += 200;
    else if ((normQ.includes('assistencia') || normQ.includes('desemprego')) && normTit.includes('assistencia financeira')) score += 200;
    else if ((normQ.includes('dispensa') || normQ.includes('equivalencia')) && normTit.includes('dispensa')) score += 220;

    const minThreshold = hasProceduralTrigger ? 65 : 95;
    if (score >= minThreshold) {
      scored.push({ score, item: r });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.item);
}

export function buscarDpSabadoRelevantes(query: string, topK: number = 2): any[] {
  if (!query || !query.trim()) return [];
  const normQ = normalizarTexto(expandAcademicQuery(query));
  const qWords = normQ.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  if (qWords.length === 0) return [];

  const scored: { score: number; item: any }[] = [];
  for (const d of horariosDpSabadoRaw as any[]) {
    let score = 0;
    const normDisc = normalizarTexto(d.disciplina || '');
    const normProf = normalizarTexto(d.professor || '');

    if (normDisc && normQ.includes(normDisc)) {
      score += 180;
    } else {
      const discTokens = normDisc.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
      const hits = discTokens.filter((w) => qWords.some((qw) => w === qw)).length;
      if (hits > 0) score += hits * 45;
    }

    if (normProf && normQ.includes(normProf)) {
      score += 60;
    }

    if (score > 0) {
      scored.push({ score, item: d });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.item);
}

function montarBlocoContexto(
  ctxState: ConversationContextState,
  ragChunks: RAGSearchResult[],
  horariosFiltrados: any[],
  reqsFiltrados: any[],
  dpSabadoFiltrados: any[] = [],
  studentProfile?: StudentAcademicProfile
): string {
  const contextoRAG = formatChunksForPrompt(ragChunks);

  const estadoLines: string[] = [];
  if (studentProfile?.course || studentProfile?.semester) {
    estadoLines.push(
      `â€¢ Perfil AcadÃªmico do Estudante Logado: ${studentProfile.name || 'Estudante'} (RA: ${studentProfile.ra || 'â€”'}) â€” ${studentProfile.course || ''}${studentProfile.semester ? ` (${studentProfile.semester})` : ''}`
    );
  }
  if (ctxState.cursoLabel) estadoLines.push(`â€¢ Curso Ativo na Conversa: ${ctxState.cursoLabel} (${ctxState.cursoCanonico})`);
  if (ctxState.codigoTurma) estadoLines.push(`â€¢ Turma Ativa na Conversa: ${ctxState.codigoTurma.toUpperCase()}`);
  if (ctxState.semestre) estadoLines.push(`â€¢ Semestre Ativo: ${ctxState.semestre}Âº semestre`);
  if (ctxState.intencao) estadoLines.push(`â€¢ IntenÃ§Ã£o Ativa: ${ctxState.intencao}`);

  const blocoEstado = estadoLines.length > 0
    ? estadoLines.join('\n')
    : 'â€¢ Primeiro turno ou curso/turma ainda nÃ£o informados.';

  const blocoAmbiguidade = ctxState.ambiguidadeAlerta
    ? `\nALERTA DE ESCLARECIMENTO / CONTEXTO:\n${ctxState.ambiguidadeAlerta}\n`
    : '';

  const blocoDpSabado = dpSabadoFiltrados.length > 0
    ? `\nDISCIPLINAS DE DP E ADAPTAÃ‡ÃƒO AOS SÃBADOS:\n${JSON.stringify(dpSabadoFiltrados, null, 2)}\n`
    : '';

  const blocoHorarios = horariosFiltrados.length > 0
    ? `\nGRADE ESTRUTURADA DE HORÃRIOS SEMANAIS DE AULA:\n${JSON.stringify(horariosFiltrados, null, 2)}\n`
    : '';

  const blocoReqs = reqsFiltrados.length > 0
    ? `\nCATÃLOGO DE REQUERIMENTOS PERTINENTES:\n${JSON.stringify(reqsFiltrados, null, 2)}\n`
    : '';

  return `
=== ESTADO ACUMULADO DA CONVERSA (MULTI-TURNO) ===
${blocoEstado}
â€¢ Humor / Estilo Detectado: ${ctxState.humor}
â€¢ Diretriz de AdaptaÃ§Ã£o de Tom: ${ctxState.instrucaoTom}
${blocoAmbiguidade}
=== DOCUMENTOS OFICIAIS EM MARKDOWN (KNOWLEDGE GRAPH) ===
${contextoRAG}
${blocoHorarios}${blocoDpSabado}${blocoReqs}`;
}

function filtrarContextoRelevante(
  mensagens: GroqChatMessage[],
  studentProfile?: StudentAcademicProfile
): string {
  const ctxState = assimilarContextoConversaTS(mensagens, studentProfile);
  const queryParaBusca = ctxState.queryContextualizada || ctxState.ultimaPergunta;
  const ehProvaOuCalendario = ctxState.intencao === 'data_prova' || isExamOrCalendarQuery(queryParaBusca);

  const dpSabadoFiltrados = ctxState.ehDpSabado ? buscarDpSabadoRelevantes(queryParaBusca, 2) : [];
  const horariosFiltrados = (ehProvaOuCalendario || ctxState.ehDpSabado) ? [] : buscarHorariosRelevantes(queryParaBusca, 2);
  const reqsFiltrados = buscarRequerimentosRelevantes(ctxState.ultimaPergunta, 2, true);

  const excluirHorariosRAG = horariosFiltrados.length > 0 && !ehProvaOuCalendario;
  const ragChunks = localSemanticSearch(queryParaBusca, 3, excluirHorariosRAG);
  return montarBlocoContexto(ctxState, ragChunks, horariosFiltrados, reqsFiltrados, dpSabadoFiltrados, studentProfile);
}

async function filtrarContextoRelevanteAsync(
  mensagens: GroqChatMessage[],
  studentProfile?: StudentAcademicProfile
): Promise<string> {
  const ctxState = assimilarContextoConversaTS(mensagens, studentProfile);
  const queryParaBusca = ctxState.queryContextualizada || ctxState.ultimaPergunta;
  const ehProvaOuCalendario = ctxState.intencao === 'data_prova' || isExamOrCalendarQuery(queryParaBusca);

  const dpSabadoFiltrados = ctxState.ehDpSabado ? buscarDpSabadoRelevantes(queryParaBusca, 2) : [];
  const horariosFiltrados = (ehProvaOuCalendario || ctxState.ehDpSabado) ? [] : buscarHorariosRelevantes(queryParaBusca, 2);
  const reqsFiltrados = buscarRequerimentosRelevantes(ctxState.ultimaPergunta, 2, true);

  const excluirHorariosRAG = horariosFiltrados.length > 0 && !ehProvaOuCalendario;
  const ragChunks = await searchAllKnowledgeChunksAsync(queryParaBusca, 3, excluirHorariosRAG);
  return montarBlocoContexto(ctxState, ragChunks, horariosFiltrados, reqsFiltrados, dpSabadoFiltrados, studentProfile);
}

function renderSystemPromptFromContext(contexto: string): string {
  return `
VocÃª Ã© o **SISA (Sistema Inteligente do Sucesso Alvarista)**, o agente acadÃªmico autÃ´nomo oficial do aplicativo ASA da **FECAP**.
Sua missÃ£o Ã© compreender profundamente a necessidade do estudante, manter o contexto entre mensagens seguidas e responder com autonomia, empatia e exatidÃ£o, fundamentado na Base de Conhecimento em Markdown abaixo.

${contexto}

DIRETRIZES FUNDAMENTAIS DE RACIOCÃNIO E AUTONOMIA:
1. **ASSIMILAÃ‡ÃƒO DE CONTEXTO MULTI-TURNO**:
   - Quando o estudante fizer perguntas curtas de continuaÃ§Ã£o (ex.: *"e a de cÃ¡lculo?"*, *"e na quinta?"*, *"qual o professor dela?"*), utilize o **Curso**, a **Turma** e a **IntenÃ§Ã£o** preservados em "ESTADO ACUMULADO DA CONVERSA".
   - Caso a disciplina perguntada no turno seguinte nÃ£o pertenÃ§a Ã quela turma (ex.: o aluno estÃ¡ no contexto de 5NA Economia e pergunta *"e a de cÃ¡lculo?"*), explique com naturalidade quais matÃ©rias compÃµem o 5NA - CE e apresente imediatamente as datas de **CÃ¡lculo I** (1Âº semestre Eixo Comum), **CÃ¡lculo II** (2Âº semestre Eixo Comum) e **CÃ¡lculo em DP aos SÃ¡bados (28/11/2026)**, perguntando qual delas ele cursa.
2. **COMPREENSÃƒO DE GÃRIAS, ABREVIAÃ‡Ã•ES E ADAPTAÃ‡ÃƒO DE HUMOR**:
   - Compreenda siglas e gÃ­rias (econo/ce = CiÃªncias EconÃ´micas, ccomp/ccpt = CiÃªncia da ComputaÃ§Ã£o, ads = AnÃ¡lise e Desenvolvimento de Sistemas, adm = AdministraÃ§Ã£o, cont/cc = CiÃªncias ContÃ¡beis, ri = RelaÃ§Ãµes Internacionais, pp = Publicidade e Propaganda, rp = RelaÃ§Ãµes PÃºblicas, po = Prova Oficial, ni = Nota IntermediÃ¡ria, pedp = Programa de EducaÃ§Ã£o DinÃ¢mica e Progressiva).
   - Siga a **Diretriz de AdaptaÃ§Ã£o de Tom** acima para acolher alunos ansiosos, frustrados, confusos ou coloquiais.
3. **PROVAS OFICIAIS (PO), EXAMES E AULAS REGULARES**:
   - Para Provas Oficiais (PO), informe sempre: **Disciplina**, **Docente**, **Data exata**, **HorÃ¡rio** (com divisÃ£o Par/Ãmpar/Todos) e **Sala/LaboratÃ³rio**, lembrando que conflitos de horÃ¡rio de PO devem ser reportados via chamado no Portal atÃ© **09/11/2026**.
   - Para Provas de DP/AdaptaÃ§Ã£o aos SÃ¡bados, a PO ocorre em **28/11/2026** no horÃ¡rio e sala exatos de cada disciplina (Vista em **05/12/2026** e Exame em **12/12/2026**).
4. **PEDP (PROGRAMA DE EDUCAÃ‡ÃƒO DINÃ‚MICA E PROGRESSIVA) E CRITÃ‰RIO DE AVALIAÃ‡ÃƒO**:
   - O **PEDP** significa **Programa de EducaÃ§Ã£o DinÃ¢mica e Progressiva** (composto por PEDP BÃ´nus do Livro e atividades/simulados/ENADE conforme o regulamento de cada curso, correspondendo a 20% da nota semestral no CritÃ©rio 2).
   - Para ser aprovado sem Exame, o aluno precisa de frequÃªncia >= 75% e MÃ©dia Semestral >= 6,0. No Exame (para mÃ©dias entre 2,0 e 5,9), exige-se nota >= 6,0 se a mÃ©dia semestral foi >= 4,0, ou nota >= 7,0 se a mÃ©dia semestral foi entre 2,0 e 3,9.
5. **RECOMENDAÃ‡ÃƒO PRECISA DE REQUERIMENTOS (ZERO FALSOS POSITIVOS)**:
   - **NUNCA** sugira nem force a abertura de requerimentos quando o estudante estiver apenas fazendo uma pergunta informativa sobre data de prova, sala de aula, professor ou regras acadÃªmicas.
6. **GUARDRAIL DE ESCOPO INSTITUCIONAL**:
   - Mantenha foco em orientaÃ§Ãµes acadÃªmicas, horÃ¡rios, provas, bolsas e serviÃ§os da FECAP (nÃ£o resolva listas de exercÃ­cios escolares nem escreva cÃ³digo de programaÃ§Ã£o de tarefas).
`.trim();
}

export function buildSystemPrompt(
  mensagens: GroqChatMessage[],
  studentProfile?: StudentAcademicProfile
): string {
  return renderSystemPromptFromContext(filtrarContextoRelevante(mensagens, studentProfile));
}

export async function buildSystemPromptAsync(
  mensagens: GroqChatMessage[],
  studentProfile?: StudentAcademicProfile
): Promise<string> {
  const contexto = await filtrarContextoRelevanteAsync(mensagens, studentProfile);
  return renderSystemPromptFromContext(contexto);
}

export const groqClient = {
  /**
   * Envia a conversa preferencialmente para o backend FastAPI (/api/chat) com autenticaÃ§Ã£o JWT (fetchWithAuth)
   * e injeÃ§Ã£o do perfil acadÃªmico do aluno logado. Caso o backend esteja indisponÃ­vel e uma chave da Groq
   * esteja configurada, realiza fallback resiliente diretamente para a API Groq com a base Markdown-First.
   */
  async chatCompletion(
    messages: GroqChatMessage[],
    studentProfile?: StudentAcademicProfile
  ): Promise<string> {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    const isMobile = Platform.OS === 'android' || Platform.OS === 'ios';
    const isLocalhostBackend = backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1');

    if (backendUrl && (!isMobile || !isLocalhostBackend)) {
      try {
        const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
        const history = messages
          .filter((m) => m.role !== 'system')
          .slice(0, -1)
          .map((m) => ({ role: m.role, content: m.content }));

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 2500) : null;

        const response = await fetchWithAuth(`${backendUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller ? controller.signal : undefined,
          body: JSON.stringify({
            message: lastUserMessage,
            history,
            role: 'Aluno',
            student_profile: studentProfile,
          }),
        });
        if (timeoutId) clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data && data.response) {
            return data.response;
          }
        }
      } catch (backendErr) {
        console.warn('[GroqClient] Falha ao comunicar com backend FastAPI, verificando fallback direto Groq...', backendErr);
      }
    }

    const apiKey = getGroqApiKey();
    if (!apiKey || apiKey.trim().length < 10) {
      throw new Error('ServiÃ§o de IA indisponÃ­vel. Verifique a conexÃ£o com o backend ou configure EXPO_PUBLIC_GROQ_API_KEY.');
    }

    const systemPrompt = await buildSystemPromptAsync(messages, studentProfile);
    const initialModel = getGroqModel();

    const candidateModels = [
      initialModel,
      'qwen/qwen3.8-27b',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    const sendRequest = async (modelToUse: string) => {
      const payload = {
        model: modelToUse,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.2,
        max_tokens: 800,
      };

      return fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
      });
    };

    let lastErrorMsg = '';

    for (const model of candidateModels) {
      try {
        const response = await sendRequest(model);

        if (response.ok) {
          const data = await response.json();
          const rawContent: string | undefined = data?.choices?.[0]?.message?.content;
          if (rawContent) {
            const cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            return cleaned || rawContent;
          }
        }

        const errorData = await response.json().catch(() => ({}));
        lastErrorMsg = errorData?.error?.message || response.statusText;

        if (response.status === 429 || response.status === 404 || errorData?.error?.code === 'model_not_found') {
          console.warn(`[GroqClient] Modelo ${model} atingiu status ${response.status}. Acionando modelo alternativo...`);
          continue;
        }

        throw new Error(`Erro Groq API (${response.status}): ${lastErrorMsg}`);
      } catch (err: any) {
        lastErrorMsg = err?.message || 'Erro de conexÃ£o';
        if (err?.message?.includes('429')) {
          continue;
        }
      }
    }

    throw new Error(`Erro Groq API (429): Limite de tokens excedido. Detalhes: ${lastErrorMsg}`);
  },

  getRequerimentos() {
    return requerimentosRaw;
  },

  getHorarios() {
    return horariosRaw;
  },

  getSugestoes(): string[] {
    return [
      'Qual a data da prova de Macroeconomia do 5NA Econo?',
      'Quais sÃ£o os horÃ¡rios da turma 1NA de AdministraÃ§Ã£o?',
      'Quando Ã© a prova oficial de DP aos sÃ¡bados?',
      'Como funciona o cÃ¡lculo de mÃ©dia (NI, PO e PEDP)?',
      'Como solicitar o Passe Escolar / SPTrans?',
      'Quais as bolsas de estudo disponÃ­veis na FECAP?',
    ];
  },
};
