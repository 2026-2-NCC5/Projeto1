#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Knowledge Manager - Motor Unificado de Grafo de Conhecimento e Acervo Oficial ASA
Gerencia a ingestão contínua de documentos (PDF e Markdown .md), geração automática de notas Markdown
compatíveis com Obsidian (com [[Wikilinks]]), atualização do catálogo Supabase e
sincronização do Acervo Oficial tanto para a aplicação Mobile quanto Web.
"""

import os
import re
import json
import uuid
import datetime
from typing import Dict, Any, Optional

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

import requests
from knowledge_engine import KnowledgeEngine

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(BASE_DIR, "DocumentosASA")
GRAPH_DIR = os.path.join(BASE_DIR, "knowledge_graph")
DOCS_MD_DIR = os.path.join(GRAPH_DIR, "documentos")
ENTIDADES_MD_DIR = os.path.join(GRAPH_DIR, "entidades")

SUPABASE_URL = os.getenv("EXPO_PUBLIC_SUPABASE_URL", "https://hevywbfvoooybuxxewwp.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhldnl3YmZ2b29veWJ1eHhld3dwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDc4MTk1MCwiZXhwIjoyMTA2MzU3OTUwfQ.gM07M3CmnUidmjAgUZ7SN4YBS9Qml7vHkb4S7aDkilM"
)

knowledge_engine = KnowledgeEngine(BASE_DIR)


def slugify(text: str) -> str:
    """Normaliza texto para nome de arquivo seguro."""
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[-\s]+", "_", text).strip("_")


def extrair_texto_pdf(pdf_path: str) -> str:
    """Extrai texto bruto do PDF de forma segura."""
    if not os.path.exists(pdf_path):
        return ""
    if PdfReader is None:
        return ""
    try:
        reader = PdfReader(pdf_path)
        raw_text = []
        for p in reader.pages:
            t = p.extract_text()
            if t:
                raw_text.append(t)
        return "\n".join(raw_text)
    except Exception as e:
        print(f"[!] Erro ao extrair texto do PDF {pdf_path}: {e}")
        return ""


class KnowledgeManager:
    def __init__(self, engine: Optional[KnowledgeEngine] = None):
        self.engine = engine or knowledge_engine
        os.makedirs(DOCS_DIR, exist_ok=True)
        os.makedirs(DOCS_MD_DIR, exist_ok=True)
        os.makedirs(ENTIDADES_MD_DIR, exist_ok=True)

    def processar_novo_documento(
        self,
        file_path: str,
        filename: str,
        titulo: str,
        categoria: str,
        role_target: str = "Todos",
        descricao: Optional[str] = None,
        doc_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Ingere um novo documento (PDF ou Markdown .md) nativamente no sistema:
        1. Gera ou preserva o Markdown estruturado com metadados e conexões [[Wikilinks]] para o Grafo.
        2. Atualiza o catálogo local documentosASA.json e os módulos do frontend (documentosResumo.ts, knowledgeGraphChunks.ts).
        3. Cadastra no catálogo relacional do Supabase (para o Acervo Oficial no Mobile e Web).
        4. Recarrega o Grafo de Conhecimento em memória sem reiniciar o servidor.
        """
        if not doc_id:
            doc_id = f"doc-{str(uuid.uuid4())[:8]}"

        is_markdown = filename.lower().endswith((".md", ".markdown"))
        md_slug = slugify(titulo)
        md_filename = f"{md_slug}.md"
        md_filepath = os.path.join(DOCS_MD_DIR, md_filename)

        # 1. Extração de texto (suporta nativamente .md e .pdf)
        raw_text = ""
        if is_markdown and os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f_md:
                    raw_text = f_md.read().strip()
            except Exception as e:
                print(f"[!] Erro ao ler arquivo Markdown {file_path}: {e}")
        else:
            raw_text = extrair_texto_pdf(file_path)

        if not raw_text:
            raw_text = descricao or f"Documento oficial institucional: {titulo}"

        # 2. Gera Markdown estruturado para o Grafo
        if is_markdown and raw_text.startswith("---"):
            md_content = raw_text
        elif is_markdown:
            md_content = f"""---
id: {doc_id}
titulo: "{titulo}"
arquivo: "{filename}"
categoria: "{categoria}"
ano: 2026
tags:
  - {categoria.lower().replace(' ', '-')}
  - oficial
  - fecap
---

# [[{titulo}]]

- **Arquivo Original**: `{filename}`
- **Categoria**: {categoria}
- **Público-Alvo**: {role_target}
- **Identificador**: `{doc_id}`

---

{raw_text}
"""
        else:
            lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
            paragrafos = []
            buffer = []
            for line in lines:
                if line.startswith("#") or line.startswith("|") or line.startswith("•") or line.startswith("-") or ":" in line:
                    if buffer:
                        paragrafos.append(" ".join(buffer))
                        buffer = []
                    paragrafos.append(line)
                else:
                    buffer.append(line)
                    if len(buffer) >= 4:
                        paragrafos.append(" ".join(buffer))
                        buffer = []
            if buffer:
                paragrafos.append(" ".join(buffer))

            corpo_md = "\n\n".join(paragrafos)

            md_content = f"""---
id: {doc_id}
titulo: "{titulo}"
arquivo: "{filename}"
categoria: "{categoria}"
ano: 2026
tags:
  - {categoria.lower().replace(' ', '-')}
  - oficial
  - fecap
---

# [[{titulo}]]

Documento oficial cadastrado no **Acervo Oficial Documentos ASA** do Centro Universitário Álvares Penteado (FECAP).

- **Arquivo Original**: `{filename}`
- **Categoria**: {categoria}
- **Público-Alvo**: {role_target}
- **Identificador**: `{doc_id}`

---

## Conteúdo Oficial do Documento

{corpo_md}
"""

        with open(md_filepath, "w", encoding="utf-8") as f_out:
            f_out.write(md_content)
        print(f"[+] Nota em Markdown gerada no Grafo: {md_filepath}")

        # 3. Atualiza o índice do vault (index.md)
        self._atualizar_index_vault(titulo, md_slug)

        # 4. Atualiza a base documentosASA.json
        self._atualizar_documentos_asa_json(
            doc_id=doc_id,
            arquivo=filename,
            titulo=titulo,
            categoria=categoria,
            conteudo=raw_text
        )

        # 5. Exporta os nós Markdown atualizados para o bundle mobile (knowledgeGraphChunks.ts)
        try:
            from export_mobile_knowledge_graph import export_knowledge_graph
            export_knowledge_graph()
        except Exception as e:
            print(f"[!] Aviso ao exportar knowledgeGraphChunks.ts: {e}")

        # 6. Sincroniza com o Supabase (Acervo Oficial Mobile & Web)
        doc_payload = {
            "id": str(uuid.uuid4()),
            "title": titulo,
            "category": categoria,
            "validity": "Ano Letivo Vigente 2026",
            "description": descricao or f"Documento oficial institucional: {titulo}",
            "role_target": role_target if role_target in ["Aluno", "Funcionário", "Todos"] else "Todos",
            "file_url": f"/static/docs/{filename}",
            "auth_code_prefix": "FECAP-DOC"
        }

        try:
            url_sb = f"{SUPABASE_URL}/rest/v1/documents"
            headers_sb = {
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            }
            resp_sb = requests.post(url_sb, headers=headers_sb, json=doc_payload, timeout=5)
            if resp_sb.status_code in [200, 201]:
                doc_criado = resp_sb.json()[0] if resp_sb.json() else doc_payload
            else:
                doc_criado = doc_payload
        except Exception as e:
            print(f"[!] Aviso: erro ao registrar no Supabase: {e}")
            doc_criado = doc_payload

        # 7. Recarrega o Grafo de Conhecimento em memória
        self.engine.carregar_grafo()

        return {
            "status": "success",
            "message": f"Documento '{titulo}' processado no Grafo de Conhecimento e no Acervo Oficial com sucesso!",
            "document": doc_criado,
            "markdown_file": md_filename,
            "total_notas_grafo": len(self.engine.notes),
            "total_secoes_grafo": len(self.engine.sections),
            "chunks_indexed": len(self.engine.sections),
        }

    def _atualizar_index_vault(self, titulo: str, md_slug: str):
        index_path = os.path.join(GRAPH_DIR, "index.md")
        if not os.path.exists(index_path):
            return

        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()

        link_entry = f"- [[{md_slug}|{titulo}]]"
        if link_entry not in content and md_slug not in content:
            marker = "## 📚 Documentos Oficiais Institucionais\n"
            if marker in content:
                content = content.replace(marker, marker + f"\n{link_entry}")
                with open(index_path, "w", encoding="utf-8") as f_out:
                    f_out.write(content)

    def _atualizar_documentos_asa_json(
        self,
        doc_id: str,
        arquivo: str,
        titulo: str,
        categoria: str,
        conteudo: str
    ):
        json_path = os.path.join(BASE_DIR, "documentosASA.json")
        data = {"versao": "3.0-markdown", "documentos": []}
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                pass

        docs = data.get("documentos", [])
        docs = [d for d in docs if d.get("arquivo") != arquivo]

        novo_doc = {
            "id": doc_id,
            "arquivo": arquivo,
            "titulo": titulo,
            "categoria": categoria,
            "paginas": 1,
            "tamanho_bytes": len(conteudo.encode("utf-8")),
            "data_indexacao": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "palavras_chave": [w.lower() for w in re.findall(r"\w+", titulo) if len(w) > 3],
            "resumo": conteudo[:500],
            "conteudo_completo": conteudo
        }
        docs.append(novo_doc)
        data["documentos"] = docs
        data["total_documentos"] = len(docs)

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        try:
            candidates = [
                os.path.join(os.path.dirname(BASE_DIR), "Frontend", "src", "services", "ai-agent", "data"),
                os.path.join(os.path.dirname(BASE_DIR), "src", "services", "ai-agent", "data"),
            ]
            frontend_dir = next((c for c in candidates if os.path.isdir(c)), candidates[0])
            if os.path.isdir(frontend_dir):
                summary_docs = [
                    {
                        "id": d["id"],
                        "arquivo": d["arquivo"],
                        "titulo": d["titulo"],
                        "categoria": d["categoria"],
                        "paginas": d.get("paginas", 1),
                        "palavras_chave": d.get("palavras_chave", []),
                        "resumo": d.get("resumo", ""),
                        "trechos_chave": d.get("conteudo_completo", "")[:2000],
                    }
                    for d in docs
                ]
                ts_code = f"""// Base gerada automaticamente pelo KnowledgeManager
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
                with open(os.path.join(frontend_dir, "documentosResumo.ts"), "w", encoding="utf-8") as f_ts:
                    f_ts.write(ts_code)
                with open(os.path.join(frontend_dir, "documentosResumo.json"), "w", encoding="utf-8") as f_js:
                    json.dump({"documentos": summary_docs}, f_js, ensure_ascii=False, indent=2)
                print("[+] Catálogo do Acervo Oficial atualizado no frontend (documentosResumo.ts).")
        except Exception as e:
            print(f"[!] Erro ao atualizar frontend documentosResumo: {e}")


knowledge_manager = KnowledgeManager()
