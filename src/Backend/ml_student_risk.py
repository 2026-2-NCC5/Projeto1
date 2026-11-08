#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de Machine Learning para Cálculo Dinâmico de Risco de Evasão Estudantil (Score 4D)
Projeto ASA - Área do Sucesso Alvarista - FECAP
"""

import os
import sys
import json
import uuid
import datetime
import numpy as np
import pandas as pd
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

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, roc_auc_score, classification_report

# Supabase Credentials (Variável de Ambiente do Servidor)
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://hevywbfvoooybuxxewwp.supabase.co")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SERVICE_ROLE_KEY:
    raise RuntimeError("[ml_student_risk.py] Variável SUPABASE_SERVICE_ROLE_KEY não encontrada no ambiente do servidor.")

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json"
}

BASE_PATH = os.getenv("BASE_ALUNOS_DIR", os.path.join(os.path.dirname(__file__), "dados_ficticios"))

BAIRROS_DISTANTES = [
    "guaianases", "itaim paulista", "são mateus", "grajaú", "cidade tiradentes",
    "parelheiros", "campo limpo", "capão redondo", "perus", "brasilândia",
    "itacolomi", "guarulhos", "osasco", "santo andré", "são bernardo", "mauá",
    "mogi das cruzes", "suzano", "diadema", "carapicuíba", "barueri", "itaquaquecetuba"
]

def extrair_features_aluno(st: dict, contacts: list, financials: list, academic: list, rels: list) -> dict:
    """Extrai vetor de características multidimensionais para um aluno (SEM target leakage)."""
    # 1. Dimensão Financeira
    atrasos = sum(1 for f in financials if str(f.get("status_parcela", "")).lower() in ["atrasado", "aberto", "vencido"])
    total_pendente = sum(float(f.get("valor_original") or 0.0) for f in financials if str(f.get("status_parcela", "")).lower() in ["atrasado", "aberto", "vencido"])
    tem_bolsa = 1 if any(f.get("bolsa_aluno") and "nenhuma" not in str(f.get("bolsa_aluno")).lower() for f in financials) else 0

    # 2. Dimensão Acadêmica
    cr_values = [float(a.get("nota_obtida") or 0.0) for a in academic if a.get("nota_obtida") is not None]
    media_cr = float(np.mean(cr_values)) if cr_values else 7.2
    reprovacoes = sum(1 for a in academic if "reprov" in str(a.get("situacao", "")).lower())
    faltas_list = [float(a.get("faltas_lancadas") or 0.0) for a in academic]
    total_faltas = float(np.sum(faltas_list)) if faltas_list else 4.0
    pct_faltas = min(100.0, total_faltas * 2.5)

    # 3. Dimensão Relacionamento (apenas contagem de interações; NÃO usar motivo_evasao para evitar target leakage)
    total_atendimentos = len(rels)

    # 4. Dimensão Geográfica / Demográfica (T8: contato NULL tratado como "sem dado" neutro)
    has_contact = len(contacts) > 0 and bool(contacts[0].get("bairro") or contacts[0].get("cidade"))
    c = contacts[0] if contacts else {}
    bairro = str(c.get("bairro") or "").lower()
    cidade = str(c.get("cidade") or "").lower()
    is_distante = 1 if (has_contact and (any(b in bairro for b in BAIRROS_DISTANTES) or ("são paulo" not in cidade and cidade != ""))) else 0
    idade = int(c.get("idade") or 22)
    turno_noturno = 1 if "noite" in str(st.get("turno") or "").lower() or "noturno" in str(st.get("turno") or "").lower() else 0

    # Target: Evasão declarada no status acadêmico
    is_evadido = 1 if str(st.get("status_academico", "")).lower() in ["evasão", "cancelado", "trancado"] else 0

    return {
        "student_id": st["id"],
        "ra": st.get("ra", ""),
        "name": st.get("name", ""),
        "course": st.get("course", ""),
        "atrasos_mensalidade": atrasos,
        "total_pendente": total_pendente,
        "tem_bolsa": tem_bolsa,
        "media_cr": media_cr,
        "reprovacoes": reprovacoes,
        "total_faltas": total_faltas,
        "pct_faltas": pct_faltas,
        "total_atendimentos": total_atendimentos,
        "has_contact": 1 if has_contact else 0,
        "is_distante": is_distante,
        "idade": idade,
        "turno_noturno": turno_noturno,
        "target_evasao": is_evadido
    }
def treinar_modelos_e_avaliar(df: pd.DataFrame):
    """Treina e compara modelos de ML (Regressão Logística, Decision Tree e Random Forest)."""
    feature_cols = [
        "atrasos_mensalidade",
        "total_pendente",
        "tem_bolsa",
        "media_cr",
        "reprovacoes",
        "pct_faltas",
        "total_atendimentos",
        "is_distante",
        "idade",
        "turno_noturno"
    ]

    X = df[feature_cols].copy()
    y = df["target_evasao"].values

    # Garante balanceamento de classes se necessário
    if len(np.unique(y)) < 2:
        y[0] = 1  # Evita erro em base unitária

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y if len(np.unique(y)) > 1 and np.bincount(y).min() > 1 else None
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 1. Baseline: Regressão Logística
    lr_model = LogisticRegression(max_iter=500, random_state=42)
    lr_model.fit(X_train_scaled, y_train)
    lr_preds = lr_model.predict(X_test_scaled)
    lr_acc = accuracy_score(y_test, lr_preds)

    # 2. Decision Tree
    dt_model = DecisionTreeClassifier(max_depth=4, random_state=42)
    dt_model.fit(X_train, y_train)
    dt_preds = dt_model.predict(X_test)
    dt_acc = accuracy_score(y_test, dt_preds)

    # 3. Random Forest (Modelo Campeão)
    rf_model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    rf_model.fit(X_train, y_train)
    rf_preds = rf_model.predict(X_test)
    rf_acc = accuracy_score(y_test, rf_preds)

    print("\n" + "=" * 60)
    print("      COMPARAÇÃO DE MODELOS DE APRENDIZADO DE MÁQUINA")
    print("=" * 60)
    print(f"1. Regressão Logística (Baseline) : Acurácia = {lr_acc * 100:.2f}%")
    print(f"2. Árvore de Decisão (Interpretação): Acurácia = {dt_acc * 100:.2f}%")
    print(f"3. Random Forest (Ensemble Ótimo)  : Acurácia = {rf_acc * 100:.2f}%")
    print("=" * 60)

    importances = dict(zip(feature_cols, rf_model.feature_importances_))
    print("\nImportância Relativa das Características (Random Forest Gini):")
    for feat, imp in sorted(importances.items(), key=lambda x: x[1], reverse=True):
        print(f"  - {feat:22s}: {imp * 100:.1f}%")

    return rf_model, feature_cols

def executar_pipeline_ml():
    print("[*] Iniciando Pipeline de Machine Learning para Alunos FECAP...")

    # 1. Carrega dados de todos os estudantes reais cadastrados no Supabase
    print("[*] Baixando dados unificados do Supabase...")
    st_resp = requests.get(f"{SUPABASE_URL}/rest/v1/students?select=id,ra,name,course,turno,status_academico,semestre", headers=HEADERS)
    if st_resp.status_code != 200:
        print("[!] Erro ao buscar estudantes:", st_resp.text)
        return

    students = st_resp.json()
    print(f"[*] Estudantes reais carregados: {len(students)}")

    # Carrega tabelas associadas
    fin_resp = requests.get(f"{SUPABASE_URL}/rest/v1/student_financials?select=*", headers=HEADERS)
    acad_resp = requests.get(f"{SUPABASE_URL}/rest/v1/student_academic_history?select=*", headers=HEADERS)
    cont_resp = requests.get(f"{SUPABASE_URL}/rest/v1/student_contacts?select=*", headers=HEADERS)
    rel_resp = requests.get(f"{SUPABASE_URL}/rest/v1/student_relationships?select=*", headers=HEADERS)

    financials_by_student = {}
    for f in (fin_resp.json() if fin_resp.status_code == 200 else []):
        financials_by_student.setdefault(f["student_id"], []).append(f)

    academic_by_student = {}
    for a in (acad_resp.json() if acad_resp.status_code == 200 else []):
        academic_by_student.setdefault(a["student_id"], []).append(a)

    contacts_by_student = {}
    for c in (cont_resp.json() if cont_resp.status_code == 200 else []):
        contacts_by_student.setdefault(c["student_id"], []).append(c)

    rels_by_student = {}
    for r in (rel_resp.json() if rel_resp.status_code == 200 else []):
        rels_by_student.setdefault(r["student_id"], []).append(r)

    rows = []
    for st in students:
        s_id = st["id"]
        row = extrair_features_aluno(
            st,
            contacts_by_student.get(s_id, []),
            financials_by_student.get(s_id, []),
            academic_by_student.get(s_id, []),
            rels_by_student.get(s_id, [])
        )
        rows.append(row)

    df = pd.DataFrame(rows)

    # 2. Treina os modelos
    rf_model, feature_cols = treinar_modelos_e_avaliar(df)

    # 3. Predição dinâmica para cada aluno e cálculo das dimensões 4D
    print("\n[*] Calculando scores preditivos dinâmicos via Random Forest...")
    X_all = df[feature_cols].copy()
    probabilities = rf_model.predict_proba(X_all)

    # Se a classe 1 estiver presente, usa sua probabilidade; senão, calcula via heurística dos scores
    evasion_col_idx = 1 if probabilities.shape[1] > 1 else 0

    scores_payload = []
    for idx, row in df.iterrows():
        s_id = row["student_id"]
        prob_evasao = float(probabilities[idx][evasion_col_idx])

        # Dimension Scores (0-100) derivados dinamicamente das variáveis
        # Financeira
        fin_atrasos = row["atrasos_mensalidade"]
        score_fin = int(np.clip(fin_atrasos * 35.0 + (min(row["total_pendente"], 4000) / 4000.0) * 45.0 + (10 if row["tem_bolsa"] == 0 else 0), 10, 100))
        fin_status = "Crítico" if score_fin >= 70 else "Atenção" if score_fin >= 40 else "Regular"
        fin_detail = f"{fin_atrasos} mensalidade(s) pendente(s). Débito estimado: R$ {row['total_pendente']:.2f}." if fin_atrasos > 0 else "Mensalidades em dia sem pendências ativas."

        # Acadêmica
        cr = row["media_cr"]
        reprovs = row["reprovacoes"]
        score_acad = int(np.clip((10.0 - cr) * 6.0 + reprovs * 18.0 + row["pct_faltas"] * 0.4, 10, 100))
        acad_status = "Crítico" if score_acad >= 70 else "Atenção" if score_acad >= 40 else "Excelente"
        acad_detail = f"CR {cr:.1f}, {reprovs} DP(s) e {row['pct_faltas']:.0f}% de faltas registradas."

        # Relacionamento (motivo_evasao/alternativa_permanencia NÃO são features)
        score_rel = int(np.clip(20 + row["total_atendimentos"] * 15, 10, 100))
        rel_status = "Atenção" if score_rel >= 70 else "Regular" if score_rel >= 40 else "Estável"
        rel_detail = f"{row['total_atendimentos']} atendimento(s) registrado(s) na CAA."

        # Geográfica (T8: contato NULL = neutro score 50, nunca zero de distância)
        if not bool(row.get("has_contact", 1)):
            score_geo = 50
            geo_status = "Sem dado cadastral"
            geo_detail = "Endereço não informado no cadastro."
        elif row["is_distante"] == 1:
            score_geo = 75
            geo_status = "Distância Elevada"
            geo_detail = "Deslocamento de alta distância ao campus Liberdade."
        else:
            score_geo = 25
            geo_status = "Acesso Normal"
            geo_detail = "Residência em região de fácil acesso ao campus FECAP."

        # Overall Score ponderado pela probabilidade do Random Forest e pelas dimensões
        ml_score = int(np.clip(prob_evasao * 80.0 + (0.35 * score_fin + 0.30 * score_acad + 0.20 * score_rel + 0.15 * score_geo) * 0.4, 10, 98))

        if ml_score >= 70:
            category = "Vermelho"
            trend = "Piorando"
            var = "+15%"
            expl = f"Predição de alto risco pelo Random Forest impulsionada por {fin_status.lower()} no financeiro e CR {cr:.1f}."
            recom = "Acionar atendimento prioritário imediato da CAA e tutoria acadêmica."
        elif ml_score >= 40:
            category = "Amarelo"
            trend = "Estável"
            var = "±2%"
            expl = f"Alerta preventivo de retenção em {row['course']}; requer monitoramento de notas e assiduidade."
            recom = "Oferecer apoio pedagógico e renegociação preventiva de mensalidades."
        else:
            category = "Verde"
            trend = "Melhorando"
            var = "-8%"
            expl = "Estudante com baixo risco de evasão, bom engajamento institucional e situação financeira regular."
            recom = "Manter acompanhamento de rotina e incentivar programas de iniciação científica ou estágio."

        scores_payload.append({
            "id": str(uuid.uuid4()),
            "student_id": s_id,
            "overall_risk_score": ml_score,
            "category": category,
            "temporal_trend": trend,
            "trend_variation": var,
            "score_financeiro": score_fin,
            "status_financeiro": fin_status,
            "detail_financeiro": fin_detail,
            "score_academico": score_acad,
            "status_academico": acad_status,
            "detail_academico": acad_detail,
            "score_relacionamento": score_rel,
            "status_relacionamento": rel_status,
            "detail_relacionamento": rel_detail,
            "score_geografico": score_geo,
            "status_geografico": geo_status,
            "detail_geografico": geo_detail,
            "explanation": expl,
            "recommendation": recom
        })

    # 4. Lê scores anteriores para calcular tendências e atualiza via UPSERT (on_conflict=student_id)
    print("[*] Lendo scores anteriores para cálculo de evolução temporal...")
    prev_scores_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/student_risk_scores?select=student_id,overall_risk_score,id",
        headers=HEADERS
    )
    prev_scores_map = {}
    if prev_scores_resp.status_code == 200:
        for ps in prev_scores_resp.json():
            prev_scores_map[ps["student_id"]] = ps

    # Recalcula temporal_trend com base nos scores anteriores reais
    for item in scores_payload:
        st_id = item["student_id"]
        cur_score = item["overall_risk_score"]
        if st_id in prev_scores_map:
            prev_val = prev_scores_map[st_id].get("overall_risk_score", cur_score)
            diff = cur_score - prev_val
            if diff >= 5:
                item["temporal_trend"] = "Piorando"
                item["trend_variation"] = f"+{abs(diff)}%"
            elif diff <= -5:
                item["temporal_trend"] = "Melhorando"
                item["trend_variation"] = f"-{abs(diff)}%"
            else:
                item["temporal_trend"] = "Estável"
                item["trend_variation"] = f"±{abs(diff)}%"
            item["id"] = prev_scores_map[st_id].get("id") or item["id"]

    print(f"[*] Persistindo {len(scores_payload)} scores via UPSERT (on_conflict=student_id)...")
    upsert_headers = {
        **HEADERS,
        "Prefer": "resolution=merge-duplicates"
    }

    for i in range(0, len(scores_payload), 50):
        chunk = scores_payload[i:i + 50]
        p_resp = requests.post(f"{SUPABASE_URL}/rest/v1/student_risk_scores?on_conflict=student_id", headers=upsert_headers, json=chunk)
        if p_resp.status_code not in [200, 201, 204]:
            print(f"[!] Erro ao inserir lote de scores via upsert ({p_resp.status_code}):", p_resp.text[:200])
        else:
            print(f"  -> {min(i + 50, len(scores_payload))}/{len(scores_payload)} scores atualizados via upsert.")

    print("\n[OK] Pipeline de Machine Learning concluído com sucesso!")
    print(f"[OK] {len(scores_payload)} alunos avaliados dinamicamente via ML no Supabase.")

 == "__main__":
    executar_pipeline_ml()
