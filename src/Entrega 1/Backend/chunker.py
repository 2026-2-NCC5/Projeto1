#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Chunking Semântico para Documentos Oficiais ASA FECAP.
Extrai o texto dos PDFs página por página e realiza a divisão em blocos
otimizados para geração de embeddings vetoriais e busca semântica (RAG).
"""

import os
import re
from typing import List, Dict, Any
from pypdf import PdfReader

# Categorização de documentos com base no nome do arquivo
def categorizar_documento(filename: str) -> tuple[str, str]:
    """Retorna (titulo_amigavel, categoria) com base no nome do PDF."""
    lower = filename.lower()
    if "rematr" in lower:
        return ("Informativo Oficial de Rematrícula Graduação Presencial 2026-2", "Rematrícula e Matrícula")
    elif "calend" in lower:
        return ("Calendário Acadêmico Oficial da Graduação 2026", "Calendário Acadêmico")
    elif "assistencia_financeira" in lower:
        return ("Programa de Assistência Financeira Educacional", "Bolsas e Financiamento")
    elif "bolsas_restitu" in lower:
        return ("Regulamento do Programa de Bolsas Restituíveis FECAP", "Bolsas e Financiamento")
    elif "sabado" in lower or "dp" in lower:
        return ("Grade de Horários - DPs e Adaptação aos Sábados 2026-2", "Horários e Disciplinas")
    elif "ciencia da computacao" in lower or "computacao" in lower:
        return ("Grade Oficial de Horários - Ciência da Computação 2026-2", "Horários e Salas")
    elif "desenvolvimento de sistemas" in lower or "ads" in lower:
        return ("Grade Oficial de Horários - Análise e Desenvolvimento de Sistemas (ADS) 2026-2", "Horários e Salas")
    elif "administracao" in lower:
        return ("Grade Oficial de Horários - Administração 2026-2", "Horários e Salas")
    elif "ciencias contabeis" in lower:
        return ("Grade Oficial de Horários - Ciências Contábeis 2026-2", "Horários e Salas")
    elif "economicas" in lower:
        return ("Grade Oficial de Horários - Ciências Econômicas 2026-2", "Horários e Salas")
    elif "internacionais" in lower:
        return ("Grade Oficial de Horários - Relações Internacionais 2026-2", "Horários e Salas")
    else:
        clean_name = re.sub(r'^\d+_\d+_', '', filename).replace('_', ' ').replace('.pdf', '').strip()
        return (clean_name, "Documentos Institucionais")

def limpar_texto(text: str) -> str:
    """Normaliza espaçamentos e quebras de linha excessivas."""
    if not text:
        return ""
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def dividir_texto_em_chunks(
    texto: str,
    chunk_size: int = 500,
    chunk_overlap: int = 80
) -> List[str]:
    """
    Divide o texto em blocos semânticos com sobreposição, respeitando
    parágrafos, quebras de linha e pontuações de frases.
    """
    if not texto or len(texto) <= chunk_size:
        return [texto] if texto else []

    # Divide primeiro por quebras de parágrafo duplas
    paragrafos = texto.split('\n\n')
    chunks: List[str] = []
    chunk_atual = ""

    for p in paragrafos:
        p = p.strip()
        if not p:
            continue

        # Se o parágrafo atual cabe no chunk
        if len(chunk_atual) + len(p) + 2 <= chunk_size:
            chunk_atual = f"{chunk_atual}\n\n{p}" if chunk_atual else p
        else:
            # Se já temos texto acumulado, salva o chunk
            if chunk_atual:
                chunks.append(chunk_atual)
                # Mantém sobreposição pegando o final do chunk anterior
                overlap_text = chunk_atual[-chunk_overlap:] if len(chunk_atual) > chunk_overlap else chunk_atual
                chunk_atual = f"{overlap_text} {p}"
            else:
                # O parágrafo em si é maior que chunk_size, divide por frases ou linhas
                linhas = re.split(r'(?<=[.?!;])\s+|\n', p)
                sub_chunk = ""
                for linha in linhas:
                    linha = linha.strip()
                    if not linha:
                        continue
                    if len(sub_chunk) + len(linha) + 1 <= chunk_size:
                        sub_chunk = f"{sub_chunk} {linha}" if sub_chunk else linha
                    else:
                        if sub_chunk:
                            chunks.append(sub_chunk)
                            sub_chunk = f"{sub_chunk[-chunk_overlap:]} {linha}"
                        else:
                            # Linha gigante, divide por corte bruto de caracteres
                            for i in range(0, len(linha), chunk_size - chunk_overlap):
                                chunks.append(linha[i:i + chunk_size])
                            sub_chunk = ""
                if sub_chunk:
                    chunk_atual = sub_chunk

    if chunk_atual and chunk_atual not in chunks:
        chunks.append(chunk_atual)

    return [c.strip() for c in chunks if len(c.strip()) > 20]

def extrair_chunks_documentos(docs_dir: str) -> List[Dict[str, Any]]:
    """
    Processa todos os PDFs do diretório e retorna uma lista de dicionários
    com cada chunk e seus respectivos metadados estruturados.
    """
    if not os.path.isdir(docs_dir):
        raise FileNotFoundError(f"Diretório de documentos não encontrado: {docs_dir}")

    files = [f for f in sorted(os.listdir(docs_dir)) if f.lower().endswith(".pdf")]
    todos_chunks: List[Dict[str, Any]] = []

    for file_idx, filename in enumerate(files, 1):
        pdf_path = os.path.join(docs_dir, filename)
        titulo, categoria = categorizar_documento(filename)
        doc_id = f"doc-{file_idx:02d}"

        try:
            reader = PdfReader(pdf_path)
            num_paginas = len(reader.pages)

            for num_pag, page in enumerate(reader.pages, 1):
                raw_text = page.extract_text() or ""
                texto_limpo = limpar_texto(raw_text)

                if not texto_limpo:
                    continue

                chunks_pagina = dividir_texto_em_chunks(texto_limpo, chunk_size=550, chunk_overlap=90)

                for chunk_idx, chunk_texto in enumerate(chunks_pagina):
                    unique_id = f"{doc_id}-p{num_pag}-c{chunk_idx}"
                    todos_chunks.append({
                        "id": unique_id,
                        "doc_id": doc_id,
                        "arquivo": filename,
                        "titulo": titulo,
                        "categoria": categoria,
                        "pagina": num_pag,
                        "total_paginas": num_paginas,
                        "chunk_index": chunk_idx,
                        "texto": chunk_texto,
                        "tamanho_chars": len(chunk_texto)
                    })

        except Exception as e:
            print(f"[!] Erro ao processar {filename}: {e}")

    return todos_chunks

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    docs_dir = os.path.join(base_dir, "DocumentosASA")
    chunks = extrair_chunks_documentos(docs_dir)
    print(f"Extração concluída: {len(chunks)} chunks gerados a partir dos PDFs.")
