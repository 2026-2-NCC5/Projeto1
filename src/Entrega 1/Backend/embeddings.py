#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Geração e Gerenciamento de Embeddings Vetoriais.
Utiliza o FastEmbed (ONNX Runtime) com o modelo sentence-transformers/all-MiniLM-L6-v2.
Gera vetores densos de 384 dimensões normalizados (L2).
"""

import math
from typing import List, Union
import numpy as np
from fastembed import TextEmbedding

# Modelo padrão de embedding: leve (80MB), rápido (<10ms por inferência) e altamente preciso
DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

_embedding_instance = None

def get_embedding_model(model_name: str = DEFAULT_MODEL) -> TextEmbedding:
    """Retorna a instância singleton do modelo de embedding."""
    global _embedding_instance
    if _embedding_instance is None:
        _embedding_instance = TextEmbedding(model_name=model_name)
    return _embedding_instance

def normalize_l2(vector: Union[List[float], np.ndarray]) -> List[float]:
    """Normaliza o vetor para norma euclidiana unitária (||v|| = 1)."""
    v = np.array(vector, dtype=np.float32)
    norm = np.linalg.norm(v)
    if norm == 0:
        return v.tolist()
    return (v / norm).tolist()

def embed_texts(texts: List[str], batch_size: int = 32) -> List[List[float]]:
    """Gera embeddings para uma lista de textos."""
    model = get_embedding_model()
    embeddings = []
    
    for emb in model.embed(texts, batch_size=batch_size):
        # Converte para lista de floats nativos normalizados
        normalized = normalize_l2(emb)
        embeddings.append(normalized)
        
    return embeddings

def embed_query(query: str) -> List[float]:
    """Gera embedding normalizado para uma única consulta de usuário."""
    model = get_embedding_model()
    results = list(model.embed([query]))
    if not results:
        raise ValueError("Falha ao gerar embedding para a query.")
    return normalize_l2(results[0])

def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """
    Calcula a similaridade de cosseno entre dois vetores.
    Como os vetores estão pré-normalizados com norma L2 = 1,
    o cosseno é equivalente ao produto escalar simples (dot product).
    """
    return float(np.dot(vec_a, vec_b))

if __name__ == "__main__":
    v1 = embed_query("Como funciona a bolsa de estudos na FECAP?")
    v2 = embed_query("Quais os critérios para solicitar assistência financeira?")
    v3 = embed_query("Qual o cardápio da lanchonete hoje?")
    
    sim_1_2 = cosine_similarity(v1, v2)
    sim_1_3 = cosine_similarity(v1, v3)
    
    print(f"Dimensão do vetor: {len(v1)}")
    print(f"Similaridade (Bolsa vs Assistência Financeira): {sim_1_2:.4f}")
    print(f"Similaridade (Bolsa vs Cardápio Lanchonete): {sim_1_3:.4f}")
