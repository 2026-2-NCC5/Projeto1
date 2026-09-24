#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Indexação Vetorial Completa para DocumentosASA.
Executa o chunking dos PDFs, gera embeddings vetoriais com FastEmbed
e salva a base vetorial (Vector Store) em JSON tanto no backend quanto no frontend.
"""

import os
import json
import datetime

# Suprime avisos de symlink no Windows
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from chunker import extrair_chunks_documentos
from embeddings import embed_texts, DEFAULT_MODEL

def gerar_vector_store():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Encontra a pasta DocumentosASA
    candidatos = [
        os.path.join(base_dir, "DocumentosASA"),
        os.path.join(os.path.dirname(base_dir), "DocumentosASA"),
    ]
    docs_dir = next((c for c in candidatos if os.path.isdir(c)), None)
    
    if not docs_dir:
        print("[-] Diretório DocumentosASA não encontrado.")
        return False

    print(f"[+] 1/3 - Iniciando extração e chunking semântico em: {docs_dir}")
    chunks = extrair_chunks_documentos(docs_dir)
    total_chunks = len(chunks)
    print(f"[+] Extraídos {total_chunks} chunks de texto com metadados.")

    print(f"[+] 2/3 - Gerando embeddings vetoriais com modelo: {DEFAULT_MODEL}")
    textos = [c["texto"] for c in chunks]
    
    # Gera os vetores em lotes
    embeddings = embed_texts(textos, batch_size=32)
    
    # Anexa o embedding a cada chunk
    for chunk, emb in zip(chunks, embeddings):
        chunk["embedding"] = emb

    vector_store_data = {
        "versao": "2.0-rag-embeddings",
        "modelo": DEFAULT_MODEL,
        "dimensoes": len(embeddings[0]) if embeddings else 384,
        "total_chunks": total_chunks,
        "data_indexacao": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "chunks": chunks
    }

    # Salva no Backend
    backend_path = os.path.join(base_dir, "vector_store.json")
    with open(backend_path, "w", encoding="utf-8") as f:
        json.dump(vector_store_data, f, ensure_ascii=False, indent=2)
    print(f"[+] 3/3 - Vector Store salvo no backend: {backend_path} ({os.path.getsize(backend_path) / 1024:.1f} KB)")

    # Salva no Frontend Mobile
    app_dir = os.path.dirname(base_dir)
    candidatos_frontend = [
        os.path.join(app_dir, "Frontend", "src", "services", "ai-agent", "data"),
        os.path.join(app_dir, "frontend", "src", "services", "ai-agent", "data"),
        os.path.join(app_dir, "src", "services", "ai-agent", "data"),
    ]
    frontend_dir = next((c for c in candidatos_frontend if os.path.exists(os.path.dirname(os.path.dirname(c)))), candidatos_frontend[0])
    os.makedirs(frontend_dir, exist_ok=True)
    
    frontend_json = os.path.join(frontend_dir, "vector_store.json")
    with open(frontend_json, "w", encoding="utf-8") as f:
        json.dump(vector_store_data, f, ensure_ascii=False, indent=2)
    print(f"[+] Vector Store salvo no mobile app: {frontend_json}")

    # Também gera um arquivo TypeScript com metadados para acesso rápido sem overhead
    chunks_meta = [
        {
            "id": c["id"],
            "arquivo": c["arquivo"],
            "titulo": c["titulo"],
            "categoria": c["categoria"],
            "pagina": c["pagina"],
            "texto": c["texto"]
        }
        for c in chunks
    ]
    
    frontend_ts = os.path.join(frontend_dir, "vectorChunks.ts")
    ts_code = f"""// Arquivo gerado automaticamente por generate_embeddings.py
export interface ChunkMeta {{
  id: string;
  arquivo: string;
  titulo: string;
  categoria: string;
  pagina: number;
  texto: string;
}}

export const VECTOR_CHUNKS_META: ChunkMeta[] = {json.dumps(chunks_meta, ensure_ascii=False, indent=2)};
"""
    with open(frontend_ts, "w", encoding="utf-8") as f:
        f.write(ts_code)
    print(f"[+] Metadados TypeScript salvos no mobile: {frontend_ts}")

    print("[OK] Base de embeddings e Vector Store gerados com sucesso total!")
    return True

if __name__ == "__main__":
    gerar_vector_store()
