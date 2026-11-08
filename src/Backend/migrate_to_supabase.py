#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Migração e Carga de Dados no Supabase - Projeto ASA FECAP
Ingere e sincroniza com segurança dados cadastrais de alunos (ativos, formados e evadidos),
histórico acadêmico, financeiro, relacionamentos e scores 4D calculados.
Também popula o Mural de Avisos e a Fila de Atendimento presencial no Supabase.
"""

import os
import sys
import uuid
import datetime
import openpyxl
import requests

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
except ImportError:
    pass

_env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(_env_file):
    with open(_env_file, "r", encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                _k = _k.strip()
                _v = _v.strip().strip("'\"")
                if _k and _k not in os.environ:
                    os.environ[_k] = _v

# Supabase Credentials (Variável de Ambiente do Servidor)
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://hevywbfvoooybuxxewwp.supabase.co")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SERVICE_ROLE_KEY:
    raise RuntimeError("[migrate_to_supabase.py] Variável SUPABASE_SERVICE_ROLE_KEY não encontrada no ambiente do servidor.")

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

BASE_PATH = os.getenv("BASE_ALUNOS_DIR", os.path.join(os.path.dirname(__file__), "dados_ficticios"))

def normalizar_score(valor: float) -> int:
    return int(round(max(0.0, min(100.0, valor))))

def post_batches(table: str, records: list, batch_size: int = 50, on_conflict: str = None):
    """Envia registros em lotes utilizando upsert."""
    if not records:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = dict(HEADERS)
    if on_conflict:
        headers["Prefer"] = f"resolution=merge-duplicates,on_conflict={on_conflict}"

    total = len(records)
    for i in range(0, total, batch_size):
        chunk = records[i:i + batch_size]
        resp = requests.post(url, headers=headers, json=chunk)
        if resp.status_code not in [200, 201, 204]:
            print(f"[!] Erro ao inserir lote em {table} ({resp.status_code}): {resp.text[:200]}")
        else:
            print(f"  -> {table}: {min(i + batch_size, total)}/{total} inseridos com sucesso...")

def carregar_dados():
    print("[*] 1/5 - Carregando e mapeando dados das planilhas...")

    matriculas_path = os.path.join(BASE_PATH, "Matriculas.xlsx")
    contato_path = os.path.join(BASE_PATH, "Contato.xlsx")
    financeiro_path = os.path.join(BASE_PATH, "Financeiro.xlsx")
    historico_path = os.path.join(BASE_PATH, "Historico.xlsx")
    relacionamentos_path = os.path.join(BASE_PATH, "Relacionamentos.xlsx")

    alunos_dict = {}

    # Alunos fixos de teste / referência
    alunos_dict["24018932"] = {
        "ra": "24018932",
        "name": "Gabriel Martins Ribeiro",
        "course": "Ciência da Computação",
        "grau_academico": "Graduação",
        "turno": "Noturno",
        "periodo_ingresso": "2024-1",
        "periodo_letivo_atual": "2026-2",
        "semestre": "3º Semestre",
        "status_academico": "Matriculado",
        "contato": {"idade": 21, "bairro": "Guaianases", "cidade": "São Paulo", "estado": "SP", "estado_civil": "Solteiro", "sexo": "Masculino"},
        "financeiro": {"atrasos": 2, "total_pendente": 3598.66, "bolsa": "Nenhuma", "parcelas": [
            {"parcela": 1, "servico": "MENSALIDADE", "valor": 1799.33, "status": "Atrasado", "vencimento": "2026-08-10"},
            {"parcela": 2, "servico": "MENSALIDADE", "valor": 1799.33, "status": "Atrasado", "vencimento": "2026-09-10"}
        ]},
        "historico": {"media_cr": 4.2, "pct_faltas": 32.0, "reprovacoes": 3, "disciplinas": [
            {"disciplina": "Cálculo Diferencial e Integral II", "situacao": "Reprovado", "nota": 4.0, "faltas": 18},
            {"disciplina": "Estruturas de Dados Avançadas", "situacao": "Reprovado", "nota": 4.5, "faltas": 14},
            {"disciplina": "Arquitetura de Computadores", "situacao": "Reprovado por Falta", "nota": 3.8, "faltas": 28}
        ]},
        "relacionamentos": [{"tema": "Cancelamento de Matrícula", "motivo": "Dificuldades financeiras e conciliação de trabalho", "data": "2026-08-15"}]
    }

    alunos_dict["24026851"] = {
        "ra": "24026851",
        "name": "Lucas Alvarista",
        "course": "Ciência da Computação",
        "grau_academico": "Graduação",
        "turno": "Noturno",
        "periodo_ingresso": "2023-1",
        "periodo_letivo_atual": "2026-2",
        "semestre": "5º Semestre",
        "status_academico": "Matriculado",
        "contato": {"idade": 22, "bairro": "Liberdade", "cidade": "São Paulo", "estado": "SP", "estado_civil": "Solteiro", "sexo": "Masculino"},
        "financeiro": {"atrasos": 0, "total_pendente": 0.0, "bolsa": "Bolsa Mérito 30%", "parcelas": [
            {"parcela": 1, "servico": "MENSALIDADE", "valor": 1259.50, "status": "Baixado", "vencimento": "2026-08-10", "baixa": "2026-08-05"},
            {"parcela": 2, "servico": "MENSALIDADE", "valor": 1259.50, "status": "Baixado", "vencimento": "2026-09-10", "baixa": "2026-09-08"}
        ]},
        "historico": {"media_cr": 8.7, "pct_faltas": 4.0, "reprovacoes": 0, "disciplinas": [
            {"disciplina": "Engenharia de Software", "situacao": "Aprovado", "nota": 9.2, "faltas": 2},
            {"disciplina": "Banco de Dados II", "situacao": "Aprovado", "nota": 8.5, "faltas": 4},
            {"disciplina": "Sistemas Operacionais", "situacao": "Aprovado", "nota": 8.4, "faltas": 2}
        ]},
        "relacionamentos": [{"tema": "Declaração de Matrícula", "motivo": "Solicitação de passe escolar e estágio", "data": "2026-08-10"}]
    }

    # Carrega amostra balanceada de Matriculas (Ativos, Formados, Evasão)
    if os.path.exists(matriculas_path):
        wb = openpyxl.load_workbook(matriculas_path, read_only=True)
        ws = wb.active
        
        nomes_gerados = [
            'Carolina Mendes de Oliveira', 'Matheus Henrique Silveira', 'Beatriz Vasconcelos',
            'Rafael Albuquerque Costa', 'Juliana Ferreira Santos', 'Lucas Fernando Lima',
            'Larissa Cristina Prado', 'Thiago Vinicius Ramos', 'Amanda Rocha Barbosa',
            'Leonardo Pinheiro Castro', 'Mariana Duarte Souza', 'Guilherme Torres Nogueira',
            'Camila Antunes Silva', 'Felipe Augusto Morais', 'Isabela Neves Borges',
            'Rodrigo Santoro Peixoto', 'Fernanda Lima Duarte', 'Gustavo Paes Leme'
        ]

        ativos_count = 0
        formados_count = 0
        evadidos_count = 0
        
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i == 0 or not row[0]: continue
            ra_aluno = str(row[0]).strip()
            if ra_aluno in alunos_dict: continue

            raw_status = str(row[10] or 'Matriculado').strip()
            
            # Balanceamento da base geral
            if 'formado' in raw_status.lower() and formados_count >= 20: continue
            if ('evas' in raw_status.lower() or 'cancel' in raw_status.lower() or 'tranc' in raw_status.lower()) and evadidos_count >= 20: continue
            if 'matriculado' in raw_status.lower() and ativos_count >= 50: continue

            if 'formado' in raw_status.lower():
                status_final = 'Formado'
                formados_count += 1
            elif any(k in raw_status.lower() for k in ['evas', 'cancel', 'tranc']):
                status_final = 'Evasão'
                evadidos_count += 1
            else:
                status_final = 'Matriculado'
                ativos_count += 1

            idx_nome = (sum(ord(c) for c in ra_aluno) + i) % len(nomes_gerados)
            nome_aluno = f"{nomes_gerados[idx_nome]} (ID {ra_aluno[-4:]})"

            alunos_dict[ra_aluno] = {
                "ra": ra_aluno,
                "name": nome_aluno,
                "course": str(row[3] or 'Administração FECAP'),
                "grau_academico": str(row[4] or 'Graduação'),
                "turno": str(row[5] or 'Noite'),
                "periodo_ingresso": str(row[6] or '2023-1'),
                "periodo_letivo_atual": str(row[1] or '2026-2'),
                "semestre": f"{str(row[8] or '4')}º Semestre",
                "status_academico": status_final,
                "contato": {"idade": 23, "bairro": "Centro", "cidade": "São Paulo", "estado": "SP", "estado_civil": "Solteiro", "sexo": "Feminino" if idx_nome % 2 == 0 else "Masculino"},
                "financeiro": {"atrasos": 0, "total_pendente": 0.0, "bolsa": "Nenhuma", "parcelas": []},
                "historico": {"media_cr": 7.6, "pct_faltas": 6.0, "reprovacoes": 0, "disciplinas": []},
                "relacionamentos": []
            }

            if ativos_count >= 50 and formados_count >= 20 and evadidos_count >= 20:
                break

        wb.close()
        print(f"[+] Total de alunos mapeados: {len(alunos_dict)} (Ativos: {ativos_count}, Formados: {formados_count}, Evadidos: {evadidos_count})")

    # Mapeia Contato
    if os.path.exists(contato_path):
        wb = openpyxl.load_workbook(contato_path, read_only=True)
        ws = wb.active
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i == 0 or not row[0]: continue
            ra = str(row[0]).strip()
            if ra in alunos_dict and ra not in ["24018932", "24026851"]:
                idade = int(row[1]) if row[1] and str(row[1]).isdigit() else 22
                alunos_dict[ra]["contato"] = {
                    "idade": idade,
                    "bairro": str(row[2] or "Centro"),
                    "cidade": str(row[3] or "São Paulo"),
                    "estado": str(row[4] or "SP")[:2],
                    "estado_civil": str(row[5] or "Solteiro"),
                    "sexo": str(row[6] or "Outro")
                }
        wb.close()

    # Mapeia Financeiro
    if os.path.exists(financeiro_path):
        wb = openpyxl.load_workbook(financeiro_path, read_only=True)
        ws = wb.active
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i == 0 or not row[0]: continue
            ra = str(row[0]).strip()
            if ra in alunos_dict and ra not in ["24018932", "24026851"]:
                st_lanc = str(row[8] or "").strip().lower()
                valor = float(row[7]) if row[7] and isinstance(row[7], (int, float)) else 850.0
                bolsa = str(row[6] or "").strip()
                if bolsa and bolsa != "None":
                    alunos_dict[ra]["financeiro"]["bolsa"] = bolsa
                
                status_format = "Baixado"
                if any(k in st_lanc for k in ["aberto", "pendente"]):
                    status_format = "Aberto"
                elif any(k in st_lanc for k in ["atras", "vencid"]):
                    status_format = "Atrasado"
                    alunos_dict[ra]["financeiro"]["atrasos"] += 1
                    alunos_dict[ra]["financeiro"]["total_pendente"] += valor

                data_venc = str(row[9])[:10] if (len(row) > 9 and row[9]) else "2026-08-10"
                data_bx = str(row[10])[:10] if (len(row) > 10 and row[10]) else None
                parc = {
                    "parcela": int(row[4]) if row[4] and str(row[4]).isdigit() else 1,
                    "servico": str(row[5] or "MENSALIDADE")[:32],
                    "valor": valor,
                    "status": status_format,
                    "vencimento": data_venc,
                    "data_baixa": data_bx
                }
                alunos_dict[ra]["financeiro"]["parcelas"].append(parc)
            if i > 50000: break
        wb.close()

    # Mapeia Histórico
    if os.path.exists(historico_path):
        wb = openpyxl.load_workbook(historico_path, read_only=True)
        ws = wb.active
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i == 0 or not row[0]: continue
            ra = str(row[0]).strip()
            if ra in alunos_dict and ra not in ["24018932", "24026851"]:
                nota = float(row[10]) if row[10] and isinstance(row[10], (int, float)) else 7.5
                faltas = int(row[11]) if row[11] and isinstance(row[11], (int, float)) else 4
                sit_raw = str(row[9] or "Aprovado").strip()
                if "reprovado por falta" in sit_raw.lower():
                    sit = "Reprovado por Falta"
                    alunos_dict[ra]["historico"]["reprovacoes"] += 1
                elif "reprovado" in sit_raw.lower():
                    sit = "Reprovado"
                    alunos_dict[ra]["historico"]["reprovacoes"] += 1
                else:
                    sit = "Aprovado"

                disc = {
                    "disciplina": str(row[8] or "Gestão Empresarial"),
                    "situacao": sit,
                    "nota": nota,
                    "faltas": faltas
                }
                alunos_dict[ra]["historico"]["disciplinas"].append(disc)
            if i > 50000: break
        wb.close()

    # Mapeia Relacionamentos
    if os.path.exists(relacionamentos_path):
        wb = openpyxl.load_workbook(relacionamentos_path, read_only=True)
        ws = wb.active
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i == 0 or not row[0]: continue
            ra = str(row[0]).strip()
            if ra in alunos_dict and ra not in ["24018932", "24026851"]:
                tema = str(row[2] or "Atendimento Geral")
                motivo = str(row[3] or "Solicitação acadêmica regular")
                motivo_evasao = str(row[4]) if (len(row) > 4 and row[4]) else None
                alternativa_perm = str(row[5]) if (len(row) > 5 and row[5]) else None
                data_criacao = str(row[6])[:19] if (len(row) > 6 and row[6]) else "2026-08-20"
                alunos_dict[ra]["relacionamentos"].append({
                    "tema": tema,
                    "motivo": motivo,
                    "motivo_evasao": motivo_evasao,
                    "alternativa_permanencia": alternativa_perm,
                    "data": data_criacao
                })
            if i > 30000: break
        wb.close()

    return alunos_dict

def calcular_scores_e_migrar(alunos_dict):
    print("[*] 2/5 - Buscando IDs de alunos existentes no Supabase...")
    url_get = f"{SUPABASE_URL}/rest/v1/students?select=id,ra"
    resp = requests.get(url_get, headers=HEADERS)
    existing_students = {s["ra"]: s["id"] for s in resp.json()} if resp.status_code == 200 else {}
    print(f"[+] Alunos já cadastrados no Supabase: {len(existing_students)}")

    students_payload = []
    contacts_payload = []
    financials_payload = []
    history_payload = []
    relationships_payload = []
    risk_scores_payload = []

    financials_keys_seen = set()
    history_keys_seen = set()
    bairros_distantes = ['guaianases', 'itaquera', 'são miguel', 'osasco', 'guarulhos', 'santo andré', 'são bernardo', 'grajaú', 'capão redondo', 'mogi']

    for ra, data in alunos_dict.items():
        st_id = existing_students.get(ra, str(uuid.uuid4()))
        existing_students[ra] = st_id

        # 1. Aluno
        students_payload.append({
            "id": st_id,
            "ra": ra,
            "name": data["name"],
            "course": data["course"][:255],
            "grau_academico": data["grau_academico"],
            "turno": data["turno"],
            "periodo_ingresso": data["periodo_ingresso"][:32],
            "periodo_letivo_atual": data["periodo_letivo_atual"][:32],
            "semestre": data["semestre"][:32],
            "status_academico": data["status_academico"]
        })

        # 2. Contato
        c = data["contato"]
        contacts_payload.append({
            "student_id": st_id,
            "idade": c["idade"],
            "bairro": c["bairro"][:128],
            "cidade": c["cidade"][:128],
            "estado": c["estado"][:2],
            "estado_civil": c["estado_civil"][:32],
            "sexo": c["sexo"][:32]
        })

        # 3. Financeiro (deduplicado pela chave única)
        fin = data["financeiro"]
        for p in fin.get("parcelas", [])[:4]:
            servico = p["servico"][:64]
            key_fin = (st_id, "2026.2", p["parcela"], servico)
            if key_fin in financials_keys_seen:
                continue
            financials_keys_seen.add(key_fin)

            financials_payload.append({
                "student_id": st_id,
                "periodo_letivo": "2026.2",
                "parcela": p["parcela"],
                "servico_parcela": servico,
                "bolsa_aluno": fin["bolsa"][:128],
                "valor_original": round(p["valor"], 2),
                "status_parcela": p["status"],
                "data_vencimento": p.get("vencimento"),
                "data_baixa": p.get("data_baixa")
            })

        # 4. Histórico (colunas pct são calculadas automaticamente pelo banco)
        hist = data["historico"]
        for d in hist.get("disciplinas", [])[:4]:
            disc_name = d["disciplina"][:255]
            key_hist = (st_id, "2026-2", disc_name)
            if key_hist in history_keys_seen:
                continue
            history_keys_seen.add(key_hist)

            history_payload.append({
                "student_id": st_id,
                "ano_semestre_letivo": "2026-2",
                "periodo_academico_oferta": "2026-2",
                "disciplina": disc_name,
                "situacao": d["situacao"],
                "nota_obtida": round(d["nota"], 2),
                "nota_distribuida": 10.0,
                "faltas_lancadas": d["faltas"],
                "aulas_ministradas": 80,
                "arquivo_origem": "Base de Alunos ASA FECAP"
            })

        # 5. Relacionamento
        rel = data.get("relacionamentos", [])
        for r in rel:
            relationships_payload.append({
                "student_id": st_id,
                "codigo_atendimento": 1000 + len(relationships_payload),
                "tema_relacionamento": r["tema"][:128],
                "motivo_contato": r.get("motivo"),
                "motivo_evasao": r.get("motivo_evasao"),
                "alternativa_permanencia": r.get("alternativa_permanencia"),
                "data_atendimento": r.get("data")
            })

        # 6. Score Multidimensional (4 Dimensões Ponderadas)
        # Financeiro (35%)
        atrasos = fin["atrasos"]
        if atrasos >= 2:
            score_fin = min(100.0, 70.0 + atrasos * 10.0)
            fin_status = "Crítico"
            fin_detail = f"{atrasos} mensalidades em atraso. Pendência total R$ {fin['total_pendente']:.2f}."
        elif atrasos == 1:
            score_fin = 55.0
            fin_status = "Atenção"
            fin_detail = "1 mensalidade em atraso com prazo de negociação aberto."
        else:
            score_fin = 12.0
            fin_status = "Controlado"
            fin_detail = f"Mensalidades em dia. Bolsa: {fin['bolsa']}."

        # Acadêmico (30%)
        cr = hist["media_cr"]
        reprovs = hist["reprovacoes"]
        faltas = hist["pct_faltas"]
        if cr < 5.0 or reprovs >= 2 or faltas > 25.0:
            score_acad = min(100.0, 50.0 + (10.0 - cr) * 6.0 + reprovs * 12.0)
            acad_status = "Crítico"
            acad_detail = f"CR {cr:.2f} abaixo do esperado (6.0), {reprovs} DP(s) e {faltas}% faltas."
        elif cr < 7.0 or reprovs == 1:
            score_acad = 52.0
            acad_status = "Atenção"
            acad_detail = f"CR {cr:.2f} e 1 DP registrada em acompanhamento pedagógico."
        else:
            score_acad = 15.0
            acad_status = "Excelente"
            acad_detail = f"CR {cr:.2f}, assiduidade alta e rendimento satisfatório."

        # Relacionamento (20%)
        has_evasao = any("cancel" in str(r.get("motivo", "")).lower() or "evas" in str(r.get("motivo", "")).lower() for r in rel)
        if has_evasao or data["status_academico"] == "Evasão":
            score_rel = 88.0
            rel_status = "Alto Risco"
            rel_detail = "Interação de risco com sinalização de trancamento/evasão."
        elif len(rel) >= 3:
            score_rel = 60.0
            rel_status = "Atenção"
            rel_detail = f"{len(rel)} atendimentos no CAA com demandas recorrentes."
        else:
            score_rel = 20.0
            rel_status = "Estável"
            rel_detail = "Atendimento regular sem atritos de permanência."

        # Geográfico (15%)
        bairro = c["bairro"].lower()
        cidade = c["cidade"].lower()
        is_dist = any(b in bairro for b in bairros_distantes) or ("são paulo" not in cidade and cidade != "")
        if is_dist:
            score_geo = 75.0
            geo_status = "Distância Elevada"
            geo_detail = f"Residência em {c['bairro']} ({c['cidade']}), deslocamento diário longo."
        else:
            score_geo = 25.0
            geo_status = "Baixo Deslocamento"
            geo_detail = f"Fácil acesso ao campus FECAP ({c['bairro']})."

        overall_score = normalizar_score(
            0.35 * score_fin + 0.30 * score_acad + 0.20 * score_rel + 0.15 * score_geo
        )

        if overall_score >= 70:
            category = "Vermelho"
            trend = "Piorando"
            var = "+20%"
            expl = f"Risco elevado impulsionado por pendências financeiras e rendimento em {data['course']}."
            recom = "Acionar atendimento prioritário do Núcleo de Permanência Estudantil."
        elif overall_score >= 40:
            category = "Amarelo"
            trend = "Estável"
            var = "±3%"
            expl = f"Estudante em alerta de transição curricular e atenção em {data['course']}."
            recom = "Ofertar tutoria acadêmica em disciplinas com risco de DP."
        else:
            category = "Verde"
            trend = "Melhorando"
            var = "-10%"
            expl = "Desempenho acadêmico regular, adimplente e integrado às atividades."
            recom = "Convidar para programas de Iniciação Científica e Monitoria."

        risk_scores_payload.append({
            "student_id": st_id,
            "overall_risk_score": overall_score,
            "category": category,
            "temporal_trend": trend,
            "trend_variation": var,
            "score_financeiro": normalizar_score(score_fin),
            "status_financeiro": fin_status,
            "detail_financeiro": fin_detail,
            "score_academico": normalizar_score(score_acad),
            "status_academico": acad_status,
            "detail_academico": acad_detail,
            "score_relacionamento": normalizar_score(score_rel),
            "status_relacionamento": rel_status,
            "detail_relacionamento": rel_detail,
            "score_geografico": normalizar_score(score_geo),
            "status_geografico": geo_status,
            "detail_geografico": geo_detail,
            "explanation": expl,
            "recommendation": recom
        })

    print(f"[*] 3/5 - Gravando {len(students_payload)} alunos e dados associados no Supabase...")
    post_batches("students", students_payload, on_conflict="ra")
    post_batches("student_contacts", contacts_payload)
    # Trava de segurança para operações de limpeza/DELETE
    has_confirm = "--confirm" in sys.argv
    env_allowed = os.getenv("ALLOW_DESTRUCTIVE_ACTIONS", "").lower() in ["true", "1", "yes"]
    if has_confirm and env_allowed:
        print("[*] Executando limpeza prévia de tabelas filhas (--confirm + ALLOW_DESTRUCTIVE_ACTIONS)...")
        requests.delete(f"{SUPABASE_URL}/rest/v1/student_financials?parcela=gte.0", headers=HEADERS)
        requests.delete(f"{SUPABASE_URL}/rest/v1/student_academic_history?id=not.is.null", headers=HEADERS)
        requests.delete(f"{SUPABASE_URL}/rest/v1/student_relationships?codigo_atendimento=gte.0", headers=HEADERS)
        requests.delete(f"{SUPABASE_URL}/rest/v1/student_risk_scores?overall_risk_score=gte.0", headers=HEADERS)
    else:
        print("[!] [TRAVA DE SEGURANÇA] Pulando DELETE de tabelas filhas. Os novos dados serão inseridos/atualizados via upsert.")

    if financials_payload:
        post_batches("student_financials", financials_payload)
    if history_payload:
        post_batches("student_academic_history", history_payload)
    if relationships_payload:
        post_batches("student_relationships", relationships_payload)
    if risk_scores_payload:
        post_batches("student_risk_scores", risk_scores_payload)

def popular_notices_e_fila():
    print("[*] 4/5 - Populando Mural de Avisos (notices)...")
    has_confirm = "--confirm" in sys.argv
    env_allowed = os.getenv("ALLOW_DESTRUCTIVE_ACTIONS", "").lower() in ["true", "1", "yes"]
    if has_confirm and env_allowed:
        requests.delete(f"{SUPABASE_URL}/rest/v1/notices?id=not.is.null", headers=HEADERS)
    else:
        print("[!] [TRAVA DE SEGURANÇA] Pulando DELETE em notices. Execute com --confirm e ALLOW_DESTRUCTIVE_ACTIONS=true para limpar.")
    notices = [
        {
            "title": "Programa de Mentoria Alvarista 2026",
            "category": "Carreira",
            "badge": "Inscrições Abertas",
            "author": "Coordenação de Carreiras FECAP",
            "summary": "Conecte-se com executivos de mercado formados pela FECAP. Vagas limitadas para graduandos a partir do 3º semestre.",
            "content": "O Programa de Mentoria Alvarista é uma oportunidade única para você receber orientação direta de profissionais sêniores do mercado financeiro, contábil, tecnologia e gestão. Inscrições até 30 de outubro pelo portal do aluno.",
            "target_audience": "Aluno",
            "is_active": True
        },
        {
            "title": "Lista de Oferta DPs e Adaptação 2026-2",
            "category": "Acadêmico",
            "badge": "Importante",
            "author": "Secretaria Geral ASA",
            "summary": "Possui disciplinas em regime de Dependência? Confira os horários das turmas aos sábados e dias úteis.",
            "content": "Estão disponíveis para consulta no aplicativo os horários e salas das turmas de DP para o segundo semestre de 2026. Lembre-se: o limite máximo regulamentar é de 2 DPs simultâneas.",
            "target_audience": "Aluno",
            "is_active": True
        },
        {
            "title": "Solicitação do Passe Escolar SPTrans & EMTU",
            "category": "Benefícios",
            "badge": "Passo a Passo",
            "author": "Central de Atendimento ASA",
            "summary": "Orientações sobre validação cadastral automática com a SPTrans e emissão da declaração de matrícula ativa.",
            "content": "Para validar o benefício de meia-tarifa ou gratuidade, emita a Declaração de Matrícula na aba Arquivo. Os dados são enviados ao sistema da SPTrans em até 24 horas úteis.",
            "target_audience": "Todos",
            "is_active": True
        },
        {
            "title": "Campanha de Rematrícula 2026-2: Condições Especiais",
            "category": "Financeiro",
            "badge": "Urgente",
            "author": "Núcleo Financeiro ASA",
            "summary": "Alunos com pendências financeiras podem solicitar parcelamento emergencial sem juros no guichê do ASA.",
            "content": "Visando garantir a permanência de todos os estudantes, o ASA está oferecendo condições especiais de renegociação para alunos adimplentes e com dificuldades pontuais. Agende um atendimento presencial.",
            "target_audience": "Aluno",
            "is_active": True
        }
    ]
    post_batches("notices", notices)

    print("[*] 5/5 - Populando Fila de Atendimento do Painel Presencial (service_queue)...")
    if has_confirm and env_allowed:
        requests.delete(f"{SUPABASE_URL}/rest/v1/service_queue?id=not.is.null", headers=HEADERS)
    else:
        print("[!] [TRAVA DE SEGURANÇA] Pulando DELETE em service_queue.")
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    queue_items = [
        {
            "ticket_number": "A042",
            "service_type": "Geral",
            "counter": "Guichê 03",
            "status": "called",
            "student_id": None,
            "called_at": now_iso
        },
        {
            "ticket_number": "P015",
            "service_type": "Prioritário",
            "counter": "Guichê 01",
            "status": "in_service",
            "student_id": None,
            "called_at": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=4)).isoformat()
        },
        {
            "ticket_number": "F028",
            "service_type": "Financeiro",
            "counter": "Guichê 04",
            "status": "called",
            "student_id": None,
            "called_at": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=1)).isoformat()
        },
        {
            "ticket_number": "A043",
            "service_type": "Geral",
            "counter": "Guichê 02",
            "status": "waiting",
            "student_id": None,
            "called_at": None
        },
        {
            "ticket_number": "A044",
            "service_type": "Geral",
            "counter": "Guichê 03",
            "status": "waiting",
            "student_id": None,
            "called_at": None
        }
    ]
    post_batches("service_queue", queue_items)

if __name__ == "__main__":
    print("=== INICIANDO MIGRAÇÃO ASA FECAP -> SUPABASE ===")
    dados = carregar_dados()
    calcular_scores_e_migrar(dados)
    popular_notices_e_fila()
    print("=== MIGRAÇÃO CONCLUÍDA COM SUCESSO! ===")
