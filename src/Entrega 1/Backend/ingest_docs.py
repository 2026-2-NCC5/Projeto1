#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Ingestão de Documentos Oficiais ASA FECAP
Processa todos os PDFs da pasta DocumentosASA, extrai conteúdo, metadados
e gera a base de conhecimento estruturada para o agente de IA (Mobile e Backend).
"""

import os
import re
import json
import datetime
from pypdf import PdfReader

def clean_text(text: str) -> str:
    """Limpa e normaliza o texto extraído do PDF."""
    if not text:
        return ""
    # Corrige quebras de linha excessivas e espaços múltiplos
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def categorize_document(filename: str, text: str) -> tuple[str, str, list[str]]:
    """Determina o título amigável, categoria e palavras-chave com base no arquivo e conteúdo."""
    lower_name = filename.lower()
    lower_text = text.lower()

    if "rematr" in lower_name:
        return (
            "Informativo Oficial de Rematrícula Graduação Presencial 2026-2",
            "Rematrícula e Matrícula",
            ["rematrícula", "rematrícula 2026", "renovação", "matrícula", "prazos de rematrícula", "inclusão de disciplinas", "ajuste de grade", "adimplência", "portal do aluno"]
        )
    elif "calend" in lower_name:
        return (
            "Calendário Acadêmico Oficial da Graduação 2026 - Discentes Veteranos",
            "Calendário Acadêmico",
            ["calendário", "datas de provas", "p1", "p2", "substitutiva", "exame final", "feriados", "recesso", "início das aulas", "término do semestre", "trancamento de curso"]
        )
    elif "assistencia_financeira" in lower_name or "assistência financeira" in lower_name:
        return (
            "Programa de Assistência Financeira Educacional",
            "Bolsas e Financiamento",
            ["assistência financeira", "perda de renda", "desemprego", "continuidade de estudos", "seguro educacional", "ajuda financeira", "documentos", "benefício"]
        )
    elif "bolsas_restitu" in lower_name or "bolsas restituíveis" in lower_name:
        return (
            "Regulamento do Programa de Bolsas Restituíveis FECAP",
            "Bolsas e Financiamento",
            ["bolsa", "restituível", "bolsas restituíveis", "financiamento", "desconto", "carência", "restituição", "pagamento pós-formado", "processo seletivo", "requisitos"]
        )
    elif "calend" in lower_name:
        return (
            "Calendário Acadêmico Oficial da Graduação 2026 - Discentes Veteranos",
            "Calendário Acadêmico",
            ["calendário", "datas de provas", "p1", "p2", "substitutiva", "exame final", "feriados", "recesso", "início das aulas", "término do semestre", "trancamento de curso"]
        )
    elif "sabado" in lower_name or "dp" in lower_name:
        return (
            "Grade de Horários - DPs e Adaptação aos Sábados 2026-2",
            "Horários e Disciplinas",
            ["dp", "dps", "adaptação", "sábado", "horário de sábado", "tutoria presencial", "ead moodle", "salas sábado"]
        )
    elif "ciencia da computacao" in lower_name or "computacao" in lower_name:
        return (
            "Grade Oficial de Horários - Ciência da Computação 2026-2",
            "Horários e Salas",
            ["ciência da computação", "ccomp", "horários ccomp", "salas ccomp", "professores ccomp", "cálculo ii", "2na", "3na", "4na", "5na", "6na", "7na", "8na"]
        )
    elif "desenvolvimento de sistemas" in lower_name or "ads" in lower_name:
        return (
            "Grade Oficial de Horários - Análise e Desenvolvimento de Sistemas (ADS) 2026-2",
            "Horários e Salas",
            ["ads", "análise e desenvolvimento de sistemas", "redes de computadores", "banco de dados", "ux digital", "lab 307", "lab 106b", "lab 305", "1na", "2na", "3na", "4na"]
        )
    elif "administracao" in lower_name:
        return (
            "Grade Oficial de Horários - Administração 2026-2",
            "Horários e Salas",
            ["administração", "adm", "eixo comum", "horários adm", "salas adm", "1na", "1nb", "cálculo i", "microeconomia"]
        )
    elif "ciencias contabeis" in lower_name or "contabeis" in lower_name:
        return (
            "Grade Oficial de Horários - Ciências Contábeis 2026-2",
            "Horários e Salas",
            ["ciências contábeis", "contabilidade", "ciências contábeis graduados", "horários contábeis", "salas contábeis"]
        )
    elif "economicas" in lower_name:
        return (
            "Grade Oficial de Horários - Ciências Econômicas 2026-2",
            "Horários e Salas",
            ["ciências econômicas", "economia", "horários economia", "salas economia"]
        )
    elif "internacionais" in lower_name:
        return (
            "Grade Oficial de Horários - Relações Internacionais 2026-2",
            "Horários e Salas",
            ["relações internacionais", "ri", "horários ri", "salas ri", "pensamento contemporâneo"]
        )
    else:
        # Título padrão a partir do nome do arquivo
        friendly_title = re.sub(r'^\d+_\d+_', '', filename)
        friendly_title = friendly_title.replace('_', ' ').replace('.pdf', '').strip()
        return (friendly_title, "Documentos Institucionais", [friendly_title.lower()])

def run_ingestion():
    # Encontra os possíveis caminhos da pasta DocumentosASA
    base_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(base_dir, "DocumentosASA"),
        os.path.join(os.path.dirname(base_dir), "DocumentosASA"),
        os.path.join(os.getcwd(), "DocumentosASA"),
        os.path.join(os.getcwd(), "Backend", "DocumentosASA"),
        os.path.join(os.getcwd(), "backend", "DocumentosASA"),
    ]

    found_files = {}
    for cand in candidates:
        if os.path.isdir(cand):
            for f in os.listdir(cand):
                if f.lower().endswith(".pdf") and f not in found_files:
                    found_files[f] = os.path.join(cand, f)

    if not found_files:
        print("[-] Nenhum arquivo PDF encontrado nas pastas DocumentosASA!")
        return

    print(f"[+] Iniciando ingestão de {len(found_files)} arquivos PDF encontrados...")

    parsed_docs = []

    for idx, (f, pdf_path) in enumerate(found_files.items(), 1):
        try:
            reader = PdfReader(pdf_path)
            num_pages = len(reader.pages)
            raw_text = ""
            for p in reader.pages:
                t = p.extract_text()
                if t:
                    raw_text += t + "\n"

            cleaned = clean_text(raw_text)
            title, category, keywords = categorize_document(f, cleaned)

            # Cria um resumo conciso dos primeiros 800 caracteres para prompt rápido
            resumo_linhas = [l for l in cleaned.split("\n") if l.strip()][:10]
            resumo = "\n".join(resumo_linhas)[:600]

            doc_entry = {
                "id": f"doc-{idx:02d}",
                "arquivo": f,
                "titulo": title,
                "categoria": category,
                "paginas": num_pages,
                "tamanho_bytes": os.path.getsize(pdf_path),
                "data_indexacao": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "palavras_chave": keywords,
                "resumo": resumo,
                "conteudo_completo": cleaned,
            }

            parsed_docs.append(doc_entry)
            print(f"  [{idx}/{len(found_files)}] Processado: {title} ({num_pages} págs, {len(cleaned)} caracteres)")

        except Exception as err:
            print(f"  [!] Erro ao processar {f}: {err}")

    knowledge_base = {
        "versao": "2.0",
        "data_geracao": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "total_documentos": len(parsed_docs),
        "documentos": parsed_docs,
    }

    # Salva no backend
    backend_output = os.path.join(base_dir, "documentosASA.json")
    with open(backend_output, "w", encoding="utf-8") as out:
        json.dump(knowledge_base, out, ensure_ascii=False, indent=2)
    print(f"[+] Base salva no backend: {backend_output}")

    # Salva catálogo resumido leve JSON e TypeScript no mobile
    app_dir = os.path.dirname(base_dir)
    candidatos_frontend = [
        os.path.join(app_dir, "Frontend", "src", "services", "ai-agent", "data"),
        os.path.join(app_dir, "frontend", "src", "services", "ai-agent", "data"),
        os.path.join(app_dir, "src", "services", "ai-agent", "data"),
    ]
    frontend_output_dir = next((c for c in candidatos_frontend if os.path.exists(os.path.dirname(os.path.dirname(c)))), candidatos_frontend[0])
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
            "trechos_chave": d["conteudo_completo"][:2000],
        }
        for d in parsed_docs
    ]

    knowledge_summary = {
        "versao": "2.0",
        "data_geracao": knowledge_base["data_geracao"],
        "total_documentos": len(parsed_docs),
        "documentos": summary_docs,
    }

    summary_json_output = os.path.join(frontend_output_dir, "documentosResumo.json")
    with open(summary_json_output, "w", encoding="utf-8") as out:
        json.dump(knowledge_summary, out, ensure_ascii=False, indent=2)
    print(f"[+] Catálogo otimizado salvo no mobile: {summary_json_output}")

    ts_code = f"""// Base gerada automaticamente por ingest_docs.py
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
    print(f"[+] Módulo TypeScript tipado salvo no mobile: {summary_ts_output}")

    print("\n[+] 4/4 - Atualizando base vetorial de embeddings (Vector Store)...")
    try:
        from generate_embeddings import gerar_vector_store
        gerar_vector_store()
    except Exception as e:
        print(f"[!] Aviso: erro ao gerar embeddings automáticos: {e}")

    print("\n[OK] Ingestao e indexacao vetorial RAG concluidas com sucesso!")

if __name__ == "__main__":
    run_ingestion()
