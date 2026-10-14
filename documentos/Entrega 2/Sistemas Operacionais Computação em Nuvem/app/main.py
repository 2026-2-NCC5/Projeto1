"""
SISA – API de Previsão de Evasão (FastAPI)
==========================================
POST /predict  →  recebe dados do aluno, devolve previsão + probabilidade
GET  /health   →  health-check
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configurações
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "modelo_churn.pkl")

# ---------------------------------------------------------------------------
# Carregamento do modelo (uma única vez, ao iniciar)
# ---------------------------------------------------------------------------
model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(f"Modelo não encontrado em {MODEL_PATH}")
    model = joblib.load(MODEL_PATH)
    print(f"[INFO] Modelo carregado de: {MODEL_PATH}")
    yield


app = FastAPI(
    title="SISA – API de Previsão de Evasão",
    version="1.0.0",
    description="Endpoint de inferência do agente de monitoramento de estudantes.",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
FEATURE_ORDER = [
    "frequencia",
    "nota_media",
    "atraso_mensalidade",
    "distancia_km",
    "participacao_atividades",
    "semestre",
    "idade",
    "bolsa",
]


class StudentInput(BaseModel):
    """Dados de entrada de um estudante para previsão."""
    frequencia: float = Field(..., ge=0, le=1, description="Taxa de frequência (0-1)")
    nota_media: float = Field(..., ge=0, le=10, description="Nota média (0-10)")
    atraso_mensalidade: int = Field(..., ge=0, description="Meses em atraso")
    distancia_km: float = Field(..., ge=0, description="Distância até a FECAP (km)")
    participacao_atividades: float = Field(..., ge=0, le=1, description="Taxa de participação (0-1)")
    semestre: int = Field(..., ge=1, le=10, description="Semestre atual")
    idade: int = Field(..., ge=16, le=70, description="Idade do estudante")
    bolsa: int = Field(..., ge=0, le=1, description="Possui bolsa (0=não, 1=sim)")


class PredictionOutput(BaseModel):
    """Resultado da previsão do agente."""
    previsao: str = Field(..., description="'evasao' ou 'permanencia'")
    probabilidade_evasao: float = Field(..., description="Probabilidade de evasão (0-1)")
    classificacao: str = Field(..., description="Verde / Amarelo / Vermelho")
    fatores_relevantes: dict = Field(..., description="Importância de cada feature")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
def health_check():
    return {"status": "ok", "modelo_carregado": model is not None}


@app.post("/predict", response_model=PredictionOutput)
def predict(aluno: StudentInput):
    """Recebe os dados de um estudante e devolve a previsão de evasão."""
    if model is None:
        raise HTTPException(status_code=503, detail="Modelo ainda não carregado.")

    # Montar DataFrame na ordem correta das features
    data = pd.DataFrame([aluno.model_dump()])[FEATURE_ORDER]

    # Previsão
    pred = model.predict(data)[0]
    proba = model.predict_proba(data)[0]

    prob_evasao = float(proba[1]) if len(proba) > 1 else float(proba[0])

    # Classificação semáforo
    if prob_evasao >= 0.70:
        classificacao = "Vermelho"
    elif prob_evasao >= 0.40:
        classificacao = "Amarelo"
    else:
        classificacao = "Verde"

    # Feature importances do modelo
    importances = dict(zip(FEATURE_ORDER, [round(float(v), 4) for v in model.feature_importances_]))

    return PredictionOutput(
        previsao="evasao" if pred == 1 else "permanencia",
        probabilidade_evasao=round(prob_evasao, 4),
        classificacao=classificacao,
        fatores_relevantes=importances,
    )
