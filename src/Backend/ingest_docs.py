#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Sincronização da Base de Conhecimento em Markdown (Markdown-First Knowledge Graph)
Varre todas as notas estruturadas em backend/knowledge_graph/documentos/ e entidades/,
atualiza o catálogo documentosASA.json e sincroniza os módulos TypeScript do cliente
(documentosResumo.ts e knowledgeGraphChunks.ts), sem utilizar embeddings ou OCR bruto de PDF.
"""

import os
import re
import json
import datetime
from export_mobile_knowledge_graph import main as export_mobile_chunks, parse_frontmatter


def run_ingestion():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    kg_docs_dir = os.path.join(base_dir, "knowledge_graph", "documentos")

    if not os.path.isdir(kg_docs_dir):
        print(f"[-] Diretório {kg_docs_dir} não encontrado!")
        return

    md_files = sorted([f for f in os.listdir(kg_docs_dir) if f.endswith(".md")])
    print(f"[+] Sincronizando {len(md_files)} documentos estruturados em Markdown...")

    parsed_docs = []
    for idx, fname in enumerate(md_files, 1):
        fpath = os.path.join(kg_docs_dir, fname)
        with open(fpath, "r", encoding="utf-8") as f:
            raw = f.read()

        meta, body = parse_frontmatter(raw)
        doc_id = meta.get("id") or f"kg-doc-{idx:02d}"
        title = meta.get("title") or meta.get("titulo") or fname[:-3].replace("_", " ")
        category = meta.get("categoria") or "Documento Institucional"
        tags = meta.get("tags") if isinstance(meta.get("tags"), list) else []

        resumo_linhas = [ln.strip() for ln in body.splitlines() if ln.strip() and not ln.startswith("#")][:8]
        resumo = "\n".join(resumo_linhas)[:600]

        parsed_docs.append({
            "id": doc_id,
            "arquivo": fname,
            "titulo": title,
            "categoria": category,
            "paginas": max(1, len(body) // 1800),
            "tamanho_bytes": len(raw.encode("utf-8")),
            "data_indexacao": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "palavras_chave": tags,
            "resumo": resumo,
            "conteudo_completo": body,
        })

    knowledge_base = {
        "versao": "3.0-markdown",
        "data_geracao": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "total_documentos": len(parsed_docs),
        "documentos": parsed_docs,
    }

    backend_output = os.path.join(base_dir, "documentosASA.json")
    with open(backend_output, "w", encoding="utf-8") as out:
        json.dump(knowledge_base, out, ensure_ascii=False, indent=2)
    print(f"[+] Base Markdown salva no backend: {backend_output}")

    app_dir = os.path.dirname(base_dir)
    frontend_candidates = [
        os.path.join(app_dir, "Frontend", "src", "services", "ai-agent", "data"),
        os.path.join(app_dir, "src", "services", "ai-agent", "data"),
    ]
    frontend_output_dir = next((c for c in frontend_candidates if os.path.isdir(c)), frontend_candidates[0])
    os.makedirs(frontend_output_dir, exist_ok=True)

    summary_docs = [
        {
            "id": d["id"],
            "arquivo": d["arquivo"],
            "titulo": d["titulo"],
            "categoria": d["categoria"],
            "paginas": d["paginas"],
            "palavras_chave": d["palavras_chave"],
            "resumo": d["resumo"],
            "trechos_chave": d["conteudo_completo"][:2500],
        }
        for d in parsed_docs
    ]

    summary_json_output = os.path.join(frontend_output_dir, "documentosResumo.json")
    with open(summary_json_output, "w", encoding="utf-8") as out:
        json.dump(
            {
                "versao": "3.0-markdown",
                "data_geracao": knowledge_base["data_geracao"],
                "total_documentos": len(summary_docs),
                "documentos": summary_docs,
            },
            out,
            ensure_ascii=False,
            indent=2,
        )

    ts_code = f"""// Base gerada automaticamente por ingest_docs.py a partir do Grafo de Conhecimento em Markdown
export interface DocumentoOficial {{
  id: string;
  arquivo: string;
  titulo: string;
  categoria: string;
  paginas: number;
  palavras_chave: string[];
  resumo: string;
  trechos_chave: string;
}}

export const documentosOficiais: DocumentoOficial[] = {json.dumps(summary_docs, ensure_ascii=False, indent=2)};
"""
    summary_ts_output = os.path.join(frontend_output_dir, "documentosResumo.ts")
    with open(summary_ts_output, "w", encoding="utf-8") as out:
        out.write(ts_code)
    print(f"[+] Catálogo documentosResumo.ts atualizado ({len(summary_docs)} documentos).")

    export_mobile_chunks()


if __name__ == "__main__":
    run_ingestion()
