#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motor de Recuperação Aumentada por Geração (RAG) com Busca Vetorial.
Carrega o Vector Store e executa busca semântica por similaridade de cosseno
para injetar no contexto da LLM apenas as informações mais relevantes.
"""

import os
import json
from typing import List, Dict, Any, Optional
import numpy as np

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from embeddings import embed_query, cosine_similarity

class RAGEngine:
    def __init__(self, vector_store_path: Optional[str] = None):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        self.vector_store_path = vector_store_path or os.path.join(base_dir, "vector_store.json")
        self.chunks: List[Dict[str, Any]] = []
        self.embeddings_matrix: Optional[np.ndarray] = None
        self.carregar_base()

    def carregar_base(self):
        """Carrega os chunks e embeddings pré-computados em memória."""
        if not os.path.isfile(self.vector_store_path):
            print(f"[!] Vector store não encontrado em {self.vector_store_path}. Execute generate_embeddings.py primeiro.")
            return

        with open(self.vector_store_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.chunks = data.get("chunks", [])
        if self.chunks:
            # Matriz NumPy (N x 384) para cálculo vetorizado ultrarrápido em C/BLAS
            embeddings_list = [c["embedding"] for c in self.chunks]
            self.embeddings_matrix = np.array(embeddings_list, dtype=np.float32)
            print(f"[+] RAG Engine carregado: {len(self.chunks)} chunks indexados ({self.embeddings_matrix.shape[1]} dimensões).")

    def buscar_chunks(
        self,
        query: str,
        top_k: int = 4,
        min_score: float = 0.25,
        excluir_horarios: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Calcula o embedding da consulta e retorna os Top-K chunks mais similares
        com similaridade de cosseno acima do limiar mínimo.
        Se excluir_horarios=True, ignora chunks de PDFs de horários (pois o JSON é a fonte oficial).
        """
        if not query or not query.strip() or self.embeddings_matrix is None or len(self.chunks) == 0:
            return []

        # 1. Gera o vetor da pergunta
        query_vec = np.array(embed_query(query.strip()), dtype=np.float32)

        # 2. Produto escalar com todos os chunks (similaridade de cosseno)
        scores = np.dot(self.embeddings_matrix, query_vec).copy()

        # 2.1 Re-ranking contextual por palavras-chave e intenção
        query_lower = query.lower()
        for idx, chunk in enumerate(self.chunks):
            arq = chunk.get("arquivo", "")
            cat = chunk.get("categoria", "")
            if "restitu" in query_lower and "Restitu" in arq:
                scores[idx] += 0.25
            elif any(t in query_lower for t in ["assistencia", "assistência", "desemprego", "perda de renda", "pafe"]) and "Assistencia" in arq:
                scores[idx] += 0.25
            elif any(t in query_lower for t in ["rematr", "renova", "tranc"]) and "Rematr" in arq:
                scores[idx] += 0.20
            elif not excluir_horarios and any(t in query_lower for t in ["horario", "horário", "sala", "lab"]) and ("Horarios" in arq or "Horários" in cat):
                scores[idx] += 0.20

        # 3. Ordena os índices por maior pontuação ajustada
        ranked_indices = np.argsort(scores)[::-1]

        resultados = []
        for idx in ranked_indices:
            if len(resultados) >= top_k:
                break

            score = float(scores[idx])
            if score < min_score:
                continue

            chunk = self.chunks[idx]
            arq = chunk.get("arquivo", "").lower()
            cat = chunk.get("categoria", "").lower()

            if excluir_horarios and ("horario" in arq or "horarios" in arq or "horários" in cat):
                continue

            resultados.append({
                "id": chunk["id"],
                "arquivo": chunk["arquivo"],
                "titulo": chunk["titulo"],
                "categoria": chunk["categoria"],
                "pagina": chunk["pagina"],
                "total_paginas": chunk.get("total_paginas", 1),
                "texto": chunk["texto"],
                "score_similaridade": round(score, 4)
            })

        return resultados

    def formatar_contexto_para_prompt(self, chunks: List[Dict[str, Any]]) -> str:
        """Formata os chunks recuperados em um bloco contextual limpo e estruturado para a LLM."""
        if not chunks:
            return "Nenhum trecho de documento oficial relevante encontrado para esta consulta."

        blocos = []
        for i, c in enumerate(chunks, 1):
            bloco = (
                f"### [DOCUMENTO #{i}] {c['titulo']}\n"
                f"- Arquivo Oficial: {c['arquivo']}\n"
                f"- Página: {c['pagina']} de {c['total_paginas']}\n"
                f"- Categoria: {c['categoria']}\n"
                f"- Confiança Semântica: {c['score_similaridade'] * 100:.1f}%\n"
                f"Trecho Oficial:\n\"{c['texto']}\""
            )
            blocos.append(bloco)

        return "\n\n".join(blocos)

# Instância singleton global para uso no backend
rag_engine = RAGEngine()

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    
    test_queries = [
        "Como funciona o programa de bolsas restituíveis da FECAP?",
        "Qual a data de rematrícula para quem trancou o curso?",
        "Em qual sala e laboratório tem aula de Banco de Dados de ADS?"
    ]
    
    for q in test_queries:
        print(f"\n==================================================")
        print(f"CONSULTA: '{q}'")
        print(f"==================================================")
        matches = rag_engine.buscar_chunks(q, top_k=2)
        print(rag_engine.formatar_contexto_para_prompt(matches))
