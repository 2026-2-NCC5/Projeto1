"""
Exporta o Grafo de Conhecimento em Markdown (backend/knowledge_graph/**/*.md)
para nós estruturados TypeScript consumidos diretamente pelo cliente mobile
(src/services/ai-agent/data/knowledgeGraphChunks.ts), garantindo funcionamento
100% fundamentado na base de conhecimento em Markdown sem depender de embeddings de PDF.
"""

import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).resolve().parent
KG_DIR = BASE_DIR / "knowledge_graph"
_candidates = [
    BASE_DIR.parent / "Frontend" / "src" / "services" / "ai-agent" / "data" / "knowledgeGraphChunks.ts",
    BASE_DIR.parent / "src" / "services" / "ai-agent" / "data" / "knowledgeGraphChunks.ts",
]
OUT_TS = next((c for c in _candidates if c.parent.is_dir()), _candidates[0])


def parse_frontmatter(md_text: str):
    meta = {}
    body = md_text
    if md_text.startswith("---"):
        parts = md_text.split("---", 2)
        if len(parts) >= 3:
            fm = parts[1]
            body = parts[2].strip()
            current_list_key = None
            for line in fm.splitlines():
                stripped = line.strip()
                if not stripped:
                    continue
                if stripped.startswith("- ") and current_list_key:
                    meta.setdefault(current_list_key, []).append(stripped[2:].strip())
                    continue
                if ":" in stripped:
                    k, v = stripped.split(":", 1)
                    k = k.strip()
                    v = v.strip()
                    if not v:
                        current_list_key = k
                        meta[k] = []
                    elif v.startswith("[") and v.endswith("]"):
                        current_list_key = None
                        try:
                            meta[k] = json.loads(v)
                        except Exception:
                            meta[k] = [x.strip().strip('"').strip("'") for x in v[1:-1].split(",") if x.strip()]
                    else:
                        current_list_key = None
                        meta[k] = v.strip('"').strip("'")
    return meta, body


def split_markdown_sections(doc_id: str, titulo: str, arquivo: str, categoria: str, tags: list, body: str):
    raw_sections = re.split(r"\n(?=##\s+)", body)
    chunks = []

    general_rule_snippet = ""
    for sec in raw_sections:
        if "Regra Geral" in sec or "Conflito de Provas" in sec or "Regra Oficial para Conflito" in sec:
            general_rule_snippet = sec.strip()
            break

    tags_str = ", ".join(tags) if tags else ""
    sec_idx = 0

    for sec in raw_sections:
        cleaned = sec.strip()
        if not cleaned or len(cleaned) < 40:
            continue

        sub_blocks = [cleaned]
        if len(cleaned) > 3600 and "\n### " in cleaned:
            parts = re.split(r"\n(?=###\s+)", cleaned)
            header_prefix = parts[0].splitlines()[0] if parts else ""
            sub_blocks = []
            for idx_p, p in enumerate(parts):
                p_clean = p.strip()
                if not p_clean:
                    continue
                if idx_p > 0 and header_prefix.startswith("## "):
                    p_clean = f"{header_prefix}\n\n{p_clean}"
                sub_blocks.append(p_clean)

        for block in sub_blocks:
            sec_idx += 1
            enriched_text = f"[{titulo}]\n"
            if tags_str:
                enriched_text += f"Tags: {tags_str}\n"
            enriched_text += block

            if (
                general_rule_snippet
                and block != general_rule_snippet
                and ("Turma " in block or "Semestre" in block)
                and "09/11/2026" not in block
            ):
                enriched_text += (
                    "\n\nNota Oficial de Conflito de Provas (PO): Em caso de conflito de data/horário "
                    "entre duas ou mais Provas Oficiais, o estudante deve abrir chamado no Portal do Aluno "
                    "impreterivelmente até 09/11/2026 informando disciplinas, datas e horários."
                )

            chunks.append(
                {
                    "id": f"kg-{doc_id}-s{sec_idx}",
                    "arquivo": arquivo,
                    "titulo": titulo,
                    "categoria": categoria,
                    "pagina": sec_idx,
                    "texto": enriched_text,
                }
            )

    return chunks


def main():
    all_chunks = []

    md_files = []
    for sub in ["documentos", "entidades"]:
        folder = KG_DIR / sub
        if folder.exists():
            md_files.extend(sorted(folder.glob("*.md")))

    for md_path in md_files:
        raw = md_path.read_text(encoding="utf-8")
        meta, body = parse_frontmatter(raw)

        doc_id = meta.get("id") or md_path.stem.lower()
        titulo = meta.get("title") or meta.get("titulo") or meta.get("entidade") or md_path.stem.replace("_", " ")
        arquivo = meta.get("arquivo") or md_path.name
        categoria = meta.get("categoria") or "Grafo de Conhecimento Institucional"
        tags = meta.get("tags") if isinstance(meta.get("tags"), list) else []

        doc_chunks = split_markdown_sections(doc_id, titulo, arquivo, categoria, tags, body)
        all_chunks.extend(doc_chunks)

    header = (
        "// Arquivo gerado automaticamente por backend/export_mobile_knowledge_graph.py\n"
        "// Contém os nós estruturados do Grafo de Conhecimento em Markdown (Markdown-First Knowledge Graph)\n"
        "export interface KnowledgeNodeMeta {\n"
        "  id: string;\n"
        "  arquivo: string;\n"
        "  titulo: string;\n"
        "  categoria: string;\n"
        "  pagina: number;\n"
        "  texto: string;\n"
        "}\n\n"
        "export type ChunkMeta = KnowledgeNodeMeta;\n\n"
        f"export const KNOWLEDGE_GRAPH_CHUNKS: KnowledgeNodeMeta[] = {json.dumps(all_chunks, ensure_ascii=False, indent=2)};\n"
    )

    OUT_TS.write_text(header, encoding="utf-8")
    print(f"Exportados {len(all_chunks)} nós Markdown de {len(md_files)} documentos para {OUT_TS}")


export_knowledge_graph = main


if __name__ == "__main__":
    main()
