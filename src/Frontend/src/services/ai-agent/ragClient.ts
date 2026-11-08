import { fetchWithAuth } from '../api/apiClient';
/**
 * ============================================================================
 * CLIENTE DE BUSCA NO GRAFO DE CONHECIMENTO EM MARKDOWN (MARKDOWN-FIRST)
 * ============================================================================
 * Recupera seções estruturadas do Grafo de Conhecimento em Markdown
 * (KNOWLEDGE_GRAPH_CHUNKS) e documentos sincronizados no Supabase (public.documents),
 * eliminando completamente os embeddings e chunks quebrados de PDF.
 * ============================================================================
 */

import { KNOWLEDGE_GRAPH_CHUNKS, ChunkMeta } from './data/knowledgeGraphChunks';
import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient';

const BACKEND_RAG_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
export const RAG_EXTRACTED_DELIMITER = '---CONTEUDO_EXTRAIDO_RAG---';

export interface RAGSearchResult {
  id: string;
  arquivo: string;
  titulo: string;
  categoria: string;
  pagina: number;
  texto: string;
  score: number;
}

let cachedDynamicChunks: ChunkMeta[] = [];
let lastDynamicFetchMs = 0;
const DYNAMIC_CACHE_TTL_MS = 15_000;

export function invalidateDynamicDocsCache(): void {
  lastDynamicFetchMs = 0;
}

export function isGreetingMessage(texto: string): boolean {
  if (!texto) return false;
  const clean = normalizeText(texto)
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const greetingWords = new Set([
    'oi', 'ola', 'opa', 'eae', 'e ai', 'salve', 'hello', 'hi', 'hey',
    'bom dia', 'boa tarde', 'boa noite', 'fala', 'fala ai',
    'tudo bem', 'tudo bom', 'tudo certo', 'como vai', 'blz', 'beleza'
  ]);
  if (greetingWords.has(clean)) return true;
  return /^(oi|ola|opa|e ai|eae|salve|bom dia|boa tarde|boa noite)(\s+(tudo bem|tudo bom|blz|beleza|ia|sisa|asa|fecap|amigo|amiga))?$/i.test(clean);
}

export function normalizeText(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bofical\b/g, 'oficial')
    .replace(/\boficais\b/g, 'oficiais');
}

const SLANG_AND_ABBR_MAP: Record<string, string> = {
  vc: 'voce',
  vcs: 'voces',
  pq: 'porque',
  oq: 'o que',
  qnd: 'quando',
  qdo: 'quando',
  pfvr: 'por favor',
  pfv: 'por favor',
  tbm: 'tambem',
  tb: 'tambem',
  prof: 'professor',
  profa: 'professora',
  lab: 'laboratorio',
  trampo: 'estagio trabalho',
  grana: 'financeiro bolsa mensalidade',
  bombei: 'reprovei dependencia dp',
  rodei: 'reprovei dependencia dp',
  econo: 'ciencias economicas economia ce',
  econ: 'ciencias economicas economia ce',
  ce: 'ciencias economicas economia',
  ccomp: 'ciencia da computacao computacao ccpt',
  comp: 'ciencia da computacao computacao',
  ccpt: 'ciencia da computacao computacao',
  ads: 'analise e desenvolvimento de sistemas',
  adm: 'administracao',
  cont: 'ciencias contabeis contabilidade cc',
  cc: 'ciencias contabeis contabilidade',
  ccg: 'ciencias contabeis para graduados',
  ri: 'relacoes internacionais',
  pp: 'publicidade e propaganda comunicacao social',
  rp: 'relacoes publicas',
  sec: 'secretariado executivo',
  calc: 'calculo',
  macro: 'macroeconomia',
  micro: 'microeconomia',
  po: 'prova oficial provas oficiais',
  ni: 'nota intermediaria',
  dp: 'dependencia',
  adapt: 'adaptacao',
};

export function expandAcademicQuery(query: string): string {
  const norm = normalizeText(query);
  const words = norm.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  const expanded = [...words];
  for (const w of words) {
    if (SLANG_AND_ABBR_MAP[w]) {
      expanded.push(SLANG_AND_ABBR_MAP[w]);
    }
  }
  return expanded.join(' ');
}

export function isExamOrCalendarQuery(query: string): boolean {
  const q = normalizeText(expandAcademicQuery(query));
  return (
    /\b(prova|provas|po|pos|exame|exames|substitutiva|calendario|feriado|feriados|recesso|letivo|bimestre)\b/.test(q) ||
    q.includes('vista de prova') ||
    q.includes('vista das provas') ||
    q.includes('conflito de prova') ||
    q.includes('data da prova') ||
    q.includes('horario da prova') ||
    q.includes('horarios das provas')
  );
}

function splitUploadedDocIntoChunks(docRow: any): ChunkMeta[] {
  const docId = String(docRow.id || 'dyn');
  const titulo = String(docRow.title || 'Documento Institucional FECAP').trim();
  const categoria = String(docRow.category || 'Documentos Oficiais').trim();
  const fileUrl = String(docRow.file_url || '');
  const rawName = fileUrl ? decodeURIComponent(fileUrl.split('/').pop() || '') : titulo;
  const arquivo = rawName.replace(/^\d+_/, '') || `${titulo}.md`;

  const rawDesc = String(docRow.description || '').trim();
  if (!rawDesc) return [];

  let summaryPart = rawDesc;
  let bodyPart = '';
  if (rawDesc.includes(RAG_EXTRACTED_DELIMITER)) {
    const parts = rawDesc.split(RAG_EXTRACTED_DELIMITER);
    summaryPart = (parts[0] || '').trim();
    bodyPart = parts.slice(1).join('\n').trim();
  }

  const fullText = bodyPart ? `${summaryPart}\n\n${bodyPart}`.trim() : summaryPart;
  if (!fullText) return [];

  const rawSections = fullText.split(/\n(?=##\s+|\[Página\s+\d+\])/i).map((s) => s.trim()).filter(Boolean);

  const finalBlocks: string[] = [];
  for (const sec of rawSections) {
    if (sec.length <= 3200) {
      finalBlocks.push(sec);
    } else {
      const lines = sec.split('\n');
      let buf = '';
      for (const line of lines) {
        if ((buf + '\n' + line).length > 2800 && buf.length > 200) {
          finalBlocks.push(buf.trim());
          buf = line;
        } else {
          buf = buf ? `${buf}\n${line}` : line;
        }
      }
      if (buf.trim()) finalBlocks.push(buf.trim());
    }
  }

  return finalBlocks.map((block, idx) => ({
    id: `supadoc-${docId}-p${idx + 1}`,
    arquivo,
    titulo,
    categoria,
    pagina: idx + 1,
    texto: block.startsWith(`[${titulo}]`) ? block : `[${titulo}]\n${block}`,
  }));
}

export async function fetchDynamicDocumentChunks(): Promise<ChunkMeta[]> {
  if (!isSupabaseConfigured) return cachedDynamicChunks;
  const now = Date.now();
  if (now - lastDynamicFetchMs < DYNAMIC_CACHE_TTL_MS && cachedDynamicChunks.length > 0) {
    return cachedDynamicChunks;
  }

  try {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, category, description, file_url, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && Array.isArray(data)) {
      const parsed: ChunkMeta[] = [];
      for (const row of data) {
        parsed.push(...splitUploadedDocIntoChunks(row));
      }
      cachedDynamicChunks = parsed;
      lastDynamicFetchMs = now;
    }
  } catch {
    // Mantém cache em caso de oscilação de rede
  }

  return cachedDynamicChunks;
}

function buildMergedChunkPool(dynamicChunks: ChunkMeta[]): ChunkMeta[] {
  // Prioriza o Grafo de Conhecimento em Markdown estruturado (KNOWLEDGE_GRAPH_CHUNKS)
  // e complementa com novos documentos enviados ao Supabase que ainda não estejam no grafo estático
  const kgTitles = new Set(KNOWLEDGE_GRAPH_CHUNKS.map((c) => normalizeText(c.titulo)));
  const extraDynamic = dynamicChunks.filter((c) => !kgTitles.has(normalizeText(c.titulo)));
  return [...KNOWLEDGE_GRAPH_CHUNKS, ...extraDynamic];
}

function scoreChunksPool(
  query: string,
  pool: ChunkMeta[],
  topK: number = 4,
  excluirHorarios: boolean = false
): RAGSearchResult[] {
  if (!query || !query.trim() || isGreetingMessage(query)) {
    return [];
  }
  if (!query || !query.trim()) {
    return [];
  }

  const normQuery = normalizeText(query);
  const expandedQuery = expandAcademicQuery(query);
  const examOrCalendar = isExamOrCalendarQuery(query);
  const effectiveExcludeHorarios = examOrCalendar ? false : excluirHorarios;

  const STOPWORDS = new Set([
    'que', 'qual', 'quais', 'quando', 'onde', 'como', 'para', 'por', 'com',
    'uma', 'uns', 'umas', 'dos', 'das', 'nos', 'nas', 'vai', 'ser', 'sao',
    'sobre', 'quero', 'preciso', 'saber', 'tem', 'ter', 'foi', 'esta', 'estao',
  ]);

  const tokens = Array.from(
    new Set(
      expandedQuery
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => {
          if (STOPWORDS.has(t)) return false;
          if (/^\d+[a-z]{1,5}$/.test(t)) return true; // ex: 5na, 4naccg, 2na
          if (['po', 'dp', 'ia', 'ri', 'ce', 'cc', 'pp', 'rp', 'ni'].includes(t)) return true;
          return t.length > 2;
        })
    )
  );

  if (tokens.length === 0) {
    return [];
  }

  const turmaMatches = normQuery.match(/\b([1-8](?:[nmv][a-d]|naccg|nacc))\b/g) || [];
  const results: RAGSearchResult[] = [];

  for (const chunk of pool) {
    const normTitle = normalizeText(chunk.titulo);
    const normCat = normalizeText(chunk.categoria);
    const normFile = normalizeText(chunk.arquivo);
    const normText = normalizeText(chunk.texto);

    const isSaturdayDpDoc =
      (normTitle.includes('dp') || normTitle.includes('adapt') || normFile.includes('dp')) &&
      (normTitle.includes('sabado') || normFile.includes('sabado') || normText.includes('sabado'));

    const isWeeklyClassGradeDoc =
      (normCat.includes('horarios') || normTitle.includes('grade oficial de horarios') || normFile.includes('grade_oficial')) &&
      !normTitle.includes('provas oficiais') &&
      !normFile.includes('provas_oficiais') &&
      !normCat.includes('provas') &&
      !isSaturdayDpDoc;

    if (effectiveExcludeHorarios && isWeeklyClassGradeDoc) {
      continue;
    }

    let score = 0;

    if (chunk.id.startsWith('kg-')) {
      score += 0.18;
    }

    if (normText.includes(normQuery)) {
      score += 0.55;
    }

    for (const token of tokens) {
      if (normTitle.includes(token)) {
        score += 0.25;
      }
      if (normCat.includes(token)) {
        score += 0.14;
      }
      if (normText.includes(token)) {
        const matches = normText.split(token).length - 1;
        score += Math.min(matches * 0.09, 0.40);
      }
    }

    for (const turma of turmaMatches) {
      if (new RegExp(`\\b${turma}\\b`).test(normText)) {
        score += 0.95;
      } else if (normTitle.includes('provas oficiais') && /\b[1-8]na\b/.test(normText) && !normText.includes('eixo comum') && !normText.includes('orientacoes especificas')) {
        score -= 0.30;
      }
    }

    const isPoDoc =
      normTitle.includes('provas oficiais') ||
      normFile.includes('provas_oficiais') ||
      normText.includes('data da prova (po)');
    const isCalendarDoc =
      normTitle.includes('calendario academico') || normFile.includes('calendario');

    const ehConsultaDpOuSabado =
      normQuery.includes('dp') || normQuery.includes('dependencia') || normQuery.includes('adapt') || normQuery.includes('sabado');

    if (ehConsultaDpOuSabado && isSaturdayDpDoc) {
      score += 1.40;
    }

    if (examOrCalendar) {
      if (isPoDoc) {
        score += 0.90;
      } else if (isCalendarDoc) {
        score += 0.45;
      } else if (isWeeklyClassGradeDoc) {
        score -= 0.45;
      }
    }

    if (score > 0.22) {
      results.push({
        id: chunk.id,
        arquivo: chunk.arquivo,
        titulo: chunk.titulo,
        categoria: chunk.categoria,
        pagina: chunk.pagina,
        texto: chunk.texto,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);

  const deduped: RAGSearchResult[] = [];
  const seenSignatures = new Set<string>();
  for (const r of results) {
    const sig = `${normalizeText(r.titulo)}::${normalizeText(r.texto).slice(0, 140)}`;
    if (seenSignatures.has(sig)) continue;
    seenSignatures.add(sig);
    deduped.push({
      ...r,
      score: Math.min(Math.round(r.score * 100) / 100, 1.0),
    });
    if (deduped.length >= topK) break;
  }

  return deduped;
}

export function localSemanticSearch(
  query: string,
  topK: number = 4,
  excluirHorarios: boolean = false
): RAGSearchResult[] {
  const pool = buildMergedChunkPool(cachedDynamicChunks);
  return scoreChunksPool(query, pool, topK, excluirHorarios);
}

export async function searchAllKnowledgeChunksAsync(
  query: string,
  topK: number = 5,
  excluirHorarios: boolean = false
): Promise<RAGSearchResult[]> {
  const dynamicChunks = await fetchDynamicDocumentChunks();
  const pool = buildMergedChunkPool(dynamicChunks);
  return scoreChunksPool(query, pool, topK, excluirHorarios);
}

export async function searchRelevantChunks(
  query: string,
  topK: number = 5,
  excluirHorarios: boolean = false
): Promise<RAGSearchResult[]> {
  const localAndSupabase = await searchAllKnowledgeChunksAsync(query, topK, excluirHorarios);

  if (BACKEND_RAG_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const response = await fetchWithAuth(`${BACKEND_RAG_URL}/api/knowledge/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, top_k: topK }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.chunks && data.chunks.length > 0) {
          const backendMapped: RAGSearchResult[] = data.chunks.map((c: any, idx: number) => ({
            id: c.id || `kg-back-${idx}`,
            arquivo: c.arquivo || 'knowledge_graph',
            titulo: c.titulo || 'Documento Oficial',
            categoria: c.categoria || 'Grafo Markdown',
            pagina: c.pagina || idx + 1,
            texto: c.texto,
            score: 0.95,
          }));
          const combined = [...backendMapped, ...localAndSupabase];
          return combined.slice(0, topK);
        }
      }
    } catch {
      // Opera via Grafo Markdown local + Supabase
    }
  }

  return localAndSupabase;
}

export function formatChunksForPrompt(chunks: RAGSearchResult[]): string {
  if (!chunks || chunks.length === 0) {
    return 'Nenhuma seção específica recuperada para os termos exatos.';
  }

  return chunks
    .map(
      (c, idx) =>
        `### [FONTE MARKDOWN #${idx + 1}] ${c.titulo}\n` +
        `• Arquivo: ${c.arquivo}\n` +
        `• Categoria: ${c.categoria}\n` +
        `• Conteúdo Oficial:\n${c.texto.trim().slice(0, 3200)}`
    )
    .join('\n\n');
}
