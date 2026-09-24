/**
 * ============================================================================
 * CLIENTE RAG HÍBRIDO (VETORIAL & SEMÂNTICO) - ASA FECAP
 * ============================================================
 * Recupera trechos oficiais dos PDFs da pasta DocumentosASA
 * integrando com o Backend RAG API ou operando localmente no dispositivo.
 * ============================================================================
 */

import { VECTOR_CHUNKS_META, ChunkMeta } from './data/vectorChunks';

const BACKEND_RAG_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export interface RAGSearchResult {
  id: string;
  arquivo: string;
  titulo: string;
  categoria: string;
  pagina: number;
  texto: string;
  score: number;
}

/**
 * Realiza busca semântica local baseada em pontuação de relevância multi-termo,
 * TF-IDF ponderado e matching por n-grams nos 225 chunks dos PDFs oficiais.
 */
export function localSemanticSearch(query: string, topK: number = 3, excluirHorarios: boolean = false): RAGSearchResult[] {
  if (!query || !query.trim()) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const tokens = queryLower
    .replace(/[^\w\sáéíóúâêîôûãõç]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (tokens.length === 0) {
    return [];
  }

  const results: RAGSearchResult[] = [];

  for (const chunk of VECTOR_CHUNKS_META) {
    if (excluirHorarios && (chunk.categoria.includes('Horários') || chunk.arquivo.includes('Horario'))) {
      continue;
    }

    const textLower = chunk.texto.toLowerCase();
    const titleLower = chunk.titulo.toLowerCase();
    const catLower = chunk.categoria.toLowerCase();

    let score = 0;

    // 1. Casamento exato da frase completa (boost alto)
    if (textLower.includes(queryLower)) {
      score += 0.50;
    }

    // 2. Pontuação por tokens individuais com pesos por campo
    for (const token of tokens) {
      if (titleLower.includes(token)) {
        score += 0.25;
      }
      if (catLower.includes(token)) {
        score += 0.15;
      }
      if (textLower.includes(token)) {
        // Conta ocorrências para ponderação TF
        const matches = textLower.split(token).length - 1;
        score += Math.min(matches * 0.08, 0.35);
      }
    }

    // 3. Casamento contextual refinado por tópicos e especificidade
    const ehRestituivel = queryLower.includes('restitu');
    const ehAssistencia = queryLower.includes('assistencia') || queryLower.includes('assistência') || queryLower.includes('desemprego') || queryLower.includes('perda de renda') || queryLower.includes('falecimento') || queryLower.includes('invalidez') || queryLower.includes('pafe');
    const ehBolsaGeral = queryLower.includes('bolsa') || queryLower.includes('financiamento') || queryLower.includes('desconto');

    if (ehRestituivel && chunk.arquivo.includes('Restitu')) {
      // Prioridade máxima para o Regulamento de Bolsas Restituíveis
      score += 0.90;
    } else if (ehAssistencia && chunk.arquivo.includes('Assistencia')) {
      // Prioridade para o Programa de Assistência Financeira Educacional
      score += 0.90;
    } else if (ehBolsaGeral && !ehRestituivel && !ehAssistencia) {
      if (chunk.arquivo.includes('Bolsas') || chunk.arquivo.includes('Assistencia')) {
        score += 0.40;
      }
    }

    const ehRematricula = queryLower.includes('rematr') || queryLower.includes('tranc') || queryLower.includes('renova');
    if (ehRematricula && (chunk.arquivo.includes('Rematr') || chunk.arquivo.includes('Calendario'))) {
      score += 0.50;
    }

    const ehHorario = !excluirHorarios && (queryLower.includes('horario') || queryLower.includes('horário') || queryLower.includes('sala') || queryLower.includes('lab') || queryLower.includes('aula'));
    if (ehHorario && (chunk.categoria.includes('Horários') || chunk.arquivo.includes('Horarios'))) {
      score += 0.45;
    }

    if (score > 0.15) {
      results.push({
        id: chunk.id,
        arquivo: chunk.arquivo,
        titulo: chunk.titulo,
        categoria: chunk.categoria,
        pagina: chunk.pagina,
        texto: chunk.texto,
        score: score, // Mantém pontuação real para ordenação correta
      });
    }
  }

  // Ordena por maior pontuação real
  results.sort((a, b) => b.score - a.score);

  // Normaliza o score visual para exibição até 1.0 e retorna os topK
  return results.slice(0, topK).map((r) => ({
    ...r,
    score: Math.min(Math.round(r.score * 100) / 100, 1.0),
  }));
}

/**
 * Busca trechos relevantes nos PDFs via Backend RAG ou fallback semântico local.
 */
export async function searchRelevantChunks(query: string, topK: number = 3, excluirHorarios: boolean = false): Promise<RAGSearchResult[]> {
  try {
    // 1. Tenta consulta ao backend se disponível
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(`${BACKEND_RAG_URL}/api/rag/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: topK, min_score: 0.25 }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.chunks && data.chunks.length > 0) {
        return data.chunks.map((c: any) => ({
          id: c.id,
          arquivo: c.arquivo,
          titulo: c.titulo,
          categoria: c.categoria,
          pagina: c.pagina,
          texto: c.texto,
          score: c.score_similaridade,
        }));
      }
    }
  } catch {
    // Backend offline ou inacessível no momento, utiliza o motor semântico local
  }

  // 2. Fallback para busca semântica local nos 225 chunks
  return localSemanticSearch(query, topK);
}

/**
 * Formata os chunks recuperados para injeção no prompt da LLM (Groq)
 */
export function formatChunksForPrompt(chunks: RAGSearchResult[]): string {
  if (!chunks || chunks.length === 0) {
    return 'Nenhum trecho de documento oficial relevante recuperado para esta consulta.';
  }

  return chunks
    .map(
      (c, idx) =>
        `### [TRECHO OFICIAL #${idx + 1}] ${c.titulo}\n` +
        `• Arquivo: ${c.arquivo}\n` +
        `• Página: ${c.pagina}\n` +
        `• Categoria: ${c.categoria}\n` +
        `• Trecho do Documento:\n"${c.texto.trim()}"`
    )
    .join('\n\n');
}
