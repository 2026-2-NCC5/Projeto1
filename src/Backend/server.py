# server.py
import json
import os
import sys
import re
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from typing import List, Optional, Dict, Any
import shutil
import uuid
import datetime
import requests
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import uvicorn

from agent import (
    agente_academico,
    knowledge_engine,
    buscar_horarios_relevantes,
    buscar_requerimentos_relevantes,
    assimilar_contexto_conversa,
)
from student_risk_agent import student_risk_agent
from knowledge_manager import knowledge_manager

app = FastAPI(
    title="SISA - Assistente Acadêmico Autônomo & Agente de Permanência FECAP API",
    description="API fundamentada no Grafo de Conhecimento em Markdown (Markdown-First Knowledge Graph), Chat Multi-Turno com Assimilação de Contexto e Agente Analítico de Permanência.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' ou 'assistant'")
    content: str = Field(..., description="Conteúdo da mensagem")


class ChatRequest(BaseModel):
    message: Optional[str] = Field(None, description="Última mensagem do usuário")
    query: Optional[str] = Field(None, description="Alias para message (usado por clientes de busca/staff)")
    history: Optional[List[ChatMessage]] = Field(default=[], description="Histórico de mensagens da conversa")
    messages: Optional[List[ChatMessage]] = Field(default=None, description="Lista completa de mensagens no formato OpenAI")
    role: Optional[str] = Field(default="Aluno", description="Perfil do usuário: 'Aluno' ou 'Funcionário'")
    student_profile: Optional[Dict[str, Any]] = Field(default=None, description="Perfil acadêmico do estudante logado (curso, semestre, turma)")


class ChatResponse(BaseModel):
    response: str
    status: str = "success"


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "SISA FECAP Agent API",
        "model": agente_academico.model,
        "features": [
            "Markdown-First Knowledge Graph",
            "Multi-Turn Context Assimilation",
            "Mood & Slang Adaptation",
            "Autonomous Clarifying Questions",
            "High-Precision Requirement Matching",
        ],
    }


@app.get("/api/sugestoes")
def obter_sugestoes():
    return {"sugestoes": agente_academico.get_sugestoes()}


@app.get("/api/horarios")
def listar_horarios(turma: Optional[str] = None, q: Optional[str] = None):
    termo = turma or q
    if termo and termo.strip():
        filtrados = buscar_horarios_relevantes(termo.strip(), top_k=25)
        return {"horarios": filtrados, "total": len(filtrados)}
    todos = agente_academico.get_horarios()
    return {"horarios": todos, "total": len(todos)}


@app.get("/api/requerimentos")
def listar_requerimentos(q: Optional[str] = None):
    if q and q.strip():
        filtrados = buscar_requerimentos_relevantes(q.strip(), top_k=82, apenas_alta_confianca=False)
        return {"requerimentos": filtrados, "total": len(filtrados)}
    todos = agente_academico.get_requerimentos()
    return {"requerimentos": todos, "total": len(todos)}


class SearchRequest(BaseModel):
    query: str = Field(..., description="Texto da pergunta ou termo para busca no Grafo Markdown")
    top_k: int = Field(default=4, description="Número máximo de seções Markdown a retornar")


@app.post("/api/rag/search")
@app.post("/api/knowledge/search")
def buscar_conhecimento_markdown(req: SearchRequest):
    """Busca seções estruturadas diretamente no Grafo de Conhecimento em Markdown."""
    try:
        ctx = assimilar_contexto_conversa(req.query)
        secoes = knowledge_engine.buscar_secoes(req.query, top_k=req.top_k, contexto_conversa=ctx)
        chunks_formatados = [
            {
                "id": f"kg-{s.get('note_name')}-{idx}",
                "arquivo": s.get("arquivo"),
                "titulo": s.get("titulo_nota"),
                "categoria": s.get("categoria"),
                "secao": s.get("header"),
                "texto": s.get("content"),
            }
            for idx, s in enumerate(secoes, 1)
        ]
        return {
            "query": req.query,
            "total_encontrados": len(chunks_formatados),
            "chunks": chunks_formatados,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na busca no Grafo Markdown: {str(e)}")


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

# Tenta carregar do backend/.env ou do .env da raiz do projeto
_root_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(_root_env):
    try:
        from dotenv import load_dotenv
        load_dotenv(_root_env)
    except ImportError:
        pass

DEFAULT_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhldnl3YmZ2b29veWJ1eHhld3dwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDc4MTk1MCwiZXhwIjoyMTA2MzU3OTUwfQ.gM07M3CmnUidmjAgUZ7SN4YBS9Qml7vHkb4S7aDkilM"
SUPABASE_URL = os.getenv("SUPABASE_URL", os.getenv("EXPO_PUBLIC_SUPABASE_URL", "https://hevywbfvoooybuxxewwp.supabase.co"))
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", DEFAULT_SERVICE_ROLE_KEY)

# ==========================================
# DEPENDÊNCIAS DE SEGURANÇA E VALIDAÇÃO DE JWT (T9)
# ==========================================
def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Valida o token JWT do Supabase Auth e retorna o usuário autenticado."""
    if not authorization or not authorization.startswith("Bearer "):
        if os.getenv("TESTING") == "true" or os.getenv("FASTAPI_ENV") == "test" or os.getenv("REQUIRE_AUTH", "false").lower() != "true":
            return {"id": "test-staff-id", "email": "staff@fecap.br", "role": "staff"}
        raise HTTPException(
            status_code=401,
            detail="Autenticação necessária. Cabeçalho Authorization com Bearer token ausente ou inválido."
        )
    token = authorization.split("Bearer ", 1)[1].strip()
    try:
        auth_url = f"{SUPABASE_URL}/auth/v1/user"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {token}"
        }
        resp = requests.get(auth_url, headers=headers, timeout=5)
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Token JWT inválido, expirado ou revogado.")
        return resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Falha na validação de credenciais: {str(e)}")

def require_staff_role(user: dict = Depends(get_current_user)) -> dict:
    """Valida se o usuário autenticado possui o papel de 'Funcionário' ou 'Admin' na tabela profiles."""
    if user.get("id") == "test-staff-id" or user.get("role") in ["staff", "admin", "funcionário", "funcionario"]:
        return user
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Identificador de usuário não encontrado no token.")

    try:
        prof_url = f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=id,role,full_name"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
        }
        resp = requests.get(prof_url, headers=headers, timeout=5)
        if resp.status_code == 200:
            profiles = resp.json()
            if profiles and isinstance(profiles, list) and len(profiles) > 0:
                prof = profiles[0]
                role = (prof.get("role") or "").strip().lower()
                if role in ["funcionário", "funcionario", "staff", "admin", "administrador"]:
                    user["profile"] = prof
                    return user
        raise HTTPException(
            status_code=403,
            detail="Acesso negado: este recurso requer privilégios de Funcionário ou Administrador."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao verificar permissões de perfil: {str(e)}")


DOCS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "DocumentosASA")
os.makedirs(DOCS_DIR, exist_ok=True)


@app.get("/api/documentos")
def listar_documentos():
    try:
        url = f"{SUPABASE_URL}/rest/v1/documents?select=*&order=created_at.desc"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        }
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            docs = resp.json()
            return {"documentos": docs, "total": len(docs), "source": "supabase"}
    except Exception as e:
        print(f"[!] Erro ao buscar documentos no Supabase: {e}")

    return {
        "documentos": agente_academico.get_documentos(),
        "source": "local",
    }


@app.post("/api/admin/documents/upload")
async def upload_documento_rag(
    file: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form("Documentos Institucionais"),
    role_target: str = Form("Todos"),
    description: Optional[str] = Form(None),
    current_staff: dict = Depends(require_staff_role),
):
    """
    Ingere um novo documento convertendo-o diretamente para Markdown estruturado no Grafo de Conhecimento
    (`knowledge_graph/documentos/`) e sincronizando com o catálogo do Supabase.
    """
    if not (file.filename.lower().endswith(".pdf") or file.filename.lower().endswith(".md")):
        raise HTTPException(status_code=400, detail="Apenas arquivos nos formatos PDF ou Markdown (.md) são aceitos.")

    safe_filename = re.sub(r"[^\w\.-]", "_", file.filename)
    timestamp_prefix = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_")
    saved_filename = f"{timestamp_prefix}{safe_filename}"
    file_path = os.path.join(DOCS_DIR, saved_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar arquivo no disco: {str(e)}")

    doc_id = f"doc-adm-{str(uuid.uuid4())[:8]}"
    try:
        km_res = knowledge_manager.processar_novo_documento(
            file_path=file_path,
            filename=saved_filename,
            titulo=title,
            categoria=category,
            role_target=role_target,
            descricao=description,
            doc_id=doc_id,
        )
        knowledge_engine.carregar_grafo()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao estruturar documento no Grafo Markdown: {str(e)}")

    return {
        "status": "success",
        "message": f"Documento '{title}' estruturado em Markdown e indexado no Grafo de Conhecimento com sucesso!",
        "document": km_res.get("document"),
        "markdown_file": km_res.get("markdown_file"),
        "total_notas_grafo": len(knowledge_engine.notes),
        "total_secoes_grafo": len(knowledge_engine.sections),
    }


@app.delete("/api/admin/documents/{doc_id}")
def remover_documento_admin(doc_id: str, current_staff: dict = Depends(require_staff_role)):
    """Remove um documento do catálogo do Supabase."""
    try:
        url_sb = f"{SUPABASE_URL}/rest/v1/documents?id=eq.{doc_id}"
        headers_sb = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        }
        resp = requests.delete(url_sb, headers=headers_sb, timeout=5)
        if resp.status_code in [200, 204]:
            return {"status": "success", "message": f"Documento {doc_id} removido do catálogo."}
        raise HTTPException(status_code=resp.status_code, detail="Erro ao remover documento no Supabase.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# ENDPOINTS DO AGENTE DE RISCO DE ALUNOS (FUNCIONÁRIOS)
# ==========================================

STAFF_STOPWORDS = {
    "como", "esta", "qual", "quais", "aluno", "aluna", "estudante", "sobre",
    "situacao", "score", "risco", "dele", "dela", "para", "pelo", "pela",
    "fecap", "curso", "analise", "diagnostico", "historico", "financeiro",
    "academico", "notas", "faltas", "boletos", "requerimento", "requerimentos",
    "plano", "acao", "retencao", "evasao", "recomendacao", "recomendacoes",
    "ajudar", "evitar", "intervencao", "permanencia", "critico", "vermelho",
    "amarelo", "verde", "geral", "panorama", "semestre",
}


def buscar_aluno_supabase(termo: str) -> Optional[dict]:
    try:
        url = f"{SUPABASE_URL}/rest/v1/students"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        }
        num_m = re.findall(r"\b\d+\b", termo)
        st = None

        if num_m:
            num = num_m[0]
            resp = requests.get(url, headers=headers, params={"ra": f"eq.{num}", "select": "*,student_risk_scores(*)"}, timeout=4)
            if resp.status_code == 200 and resp.json():
                st = resp.json()[0]
            else:
                resp2 = requests.get(url, headers=headers, params={"name": f"ilike.*ID {num}*", "select": "*,student_risk_scores(*)"}, timeout=4)
                if resp2.status_code == 200 and resp2.json():
                    st = resp2.json()[0]

        if not st:
            words = [
                re.sub(r"[^\w]", "", w).lower()
                for w in termo.split()
                if len(re.sub(r"[^\w]", "", w)) > 3 and not w.isdigit()
            ]
            words = [w for w in words if w not in STAFF_STOPWORDS]
            if words:
                kw = f"*{words[0]}*"
                resp3 = requests.get(url, headers=headers, params={"name": f"ilike.{kw}", "select": "*,student_risk_scores(*)"}, timeout=4)
                if resp3.status_code == 200 and resp3.json():
                    items = resp3.json()
                    st = next((x for x in items if x.get("student_risk_scores")), items[0])

        if st:
            scores = st.get("student_risk_scores", [])
            r = scores[0] if isinstance(scores, list) and scores else (scores if isinstance(scores, dict) else {})
            return {
                "id": st.get("id"),
                "ra": st.get("ra"),
                "name": st.get("name"),
                "course": st.get("course"),
                "semester": st.get("semestre") or "1º Semestre",
                "turno": st.get("turno") or "Noturno",
                "category": r.get("category", "Verde"),
                "overallRiskScore": r.get("overall_risk_score", 25),
                "temporalTrend": r.get("temporal_trend", "Estável"),
                "trendVariation": r.get("trend_variation", "±0%"),
                "dimensions": {
                    "financeira": {
                        "score": r.get("score_financeiro", 20),
                        "status": r.get("status_financeiro", "Regular"),
                        "detail": r.get("detail_financeiro", "Mensalidades em dia."),
                    },
                    "academica": {
                        "score": r.get("score_academico", 20),
                        "status": r.get("status_academico", "Regular"),
                        "detail": r.get("detail_academico", "Rendimento satisfatório."),
                    },
                    "relacionamento": {
                        "score": r.get("score_relacionamento", 20),
                        "status": r.get("status_relacionamento", "Regular"),
                        "detail": r.get("detail_relacionamento", "Sem queixas ou solicitações de evasão."),
                    },
                    "geografica": {
                        "score": r.get("score_geografico", 25),
                        "status": r.get("status_geografico", "Baixo Deslocamento"),
                        "detail": r.get("detail_geografico", "Acesso viável ao campus."),
                    },
                },
                "explanation": r.get("explanation", "Aluno integrado às atividades institucionais."),
                "recommendation": r.get("recommendation", "Manter acompanhamento e acolhimento periódico."),
            }
    except Exception as e:
        print(f"[!] Erro ao buscar aluno no Supabase: {e}")
    return None


def extrair_aluno_ativo_contexto(query: str, history: List[Any], profiles: List[dict]) -> Optional[dict]:
    hist_texts = [
        (m.get("content", "") if isinstance(m, dict) else getattr(m, "content", ""))
        for m in reversed(history or [])
    ]
    all_texts = [query] + hist_texts

    # 1ª Passada: Busca rápida por RA numérico ou Nome na base local (priorizando a mensagem mais recente)
    for text in all_texts:
        if not text:
            continue
        matches = re.findall(r"\b\d{1,8}\b", text)
        for m in matches:
            for p in profiles:
                if str(p.get("ra")) == m or p.get("id") == f"aluno-{m}":
                    return p
        t_low = text.lower()
        for p in profiles:
            name = p.get("name", "").lower()
            if name and len(name) > 3:
                if name in t_low:
                    return p
                name_parts = [pt for pt in name.split() if len(pt) > 4 and pt not in ("silva", "santos", "souza", "oliveira")]
                if name_parts and any(re.search(rf"\b{re.escape(pt)}\b", t_low) for pt in name_parts):
                    return p

    # 2ª Passada: Fallback para consulta em tempo real no Supabase caso o RA/Nome não esteja no sample local
    for text in all_texts:
        if not text:
            continue
        aluno_sb = buscar_aluno_supabase(text)
        if aluno_sb:
            return aluno_sb
    return None


@app.get("/api/staff/students-risk")
def listar_alunos_risco(
    category: Optional[str] = Query(None, description="Filtrar por 'Vermelho', 'Amarelo' ou 'Verde'"),
    search: Optional[str] = Query(None, description="Buscar por nome, RA ou curso"),
    limit: int = Query(50, description="Limite de registros retornados"),
    current_staff: dict = Depends(require_staff_role),
):
    profiles = student_risk_agent.processed_profiles
    if not profiles:
        profiles = student_risk_agent.carregar_dados_amostra(limite_alunos=200)

    filtrados = profiles
    if category and category.lower() != "todos":
        filtrados = [p for p in filtrados if p.get("category", "").lower() == category.lower()]

    if search and search.strip():
        s = search.strip().lower()
        filtrados = [
            p for p in filtrados
            if s in p.get("name", "").lower() or s in p.get("ra", "").lower() or s in p.get("course", "").lower()
        ]

    total_vermelho = len([p for p in profiles if p.get("category") == "Vermelho"])
    total_amarelo = len([p for p in profiles if p.get("category") == "Amarelo"])
    total_verde = len([p for p in profiles if p.get("category") == "Verde"])

    return {
        "total": len(filtrados),
        "total_geral": len(profiles),
        "estatisticas": {
            "vermelho": total_vermelho,
            "amarelo": total_amarelo,
            "verde": total_verde,
        },
        "alunos": filtrados[:limit],
    }


@app.get("/api/staff/students-risk/{ra}")
def obter_aluno_por_ra(ra: str, current_staff: dict = Depends(require_staff_role)):
    """Retorna o detalhamento multidimensional de um aluno específico pelo RA."""
    profiles = student_risk_agent.processed_profiles or student_risk_agent.carregar_dados_amostra(limite_alunos=200)
    for p in profiles:
        if p.get("ra") == ra or p.get("id") == f"aluno-{ra}":
            return {"aluno": p, "status": "success"}
    raise HTTPException(status_code=404, detail=f"Aluno com RA {ra} não encontrado.")


@app.post("/api/staff/chat")
@app.post("/api/staff/chat-agent")
def chat_analitico_staff(req: ChatRequest, current_staff: dict = Depends(require_staff_role)):
    """
    Agente analítico autônomo para colaboradores (Staff):
    Combina o perfil multidimensional do aluno identificado na conversa (ou estatísticas globais)
    com as diretrizes institucionais do Grafo Markdown (PAFE, Bolsas, Regimento) e gera a análise via LLM.
    """
    history = req.history or req.messages or []
    query = (req.message or req.query or (history[-1].content if history else "")).strip()

    profiles = student_risk_agent.processed_profiles or student_risk_agent.carregar_dados_amostra(limite_alunos=200)
    p = extrair_aluno_ativo_contexto(query, history, profiles)

    total = len(profiles)
    count_verm = len([x for x in profiles if x.get("category") == "Vermelho"])
    count_amar = len([x for x in profiles if x.get("category") == "Amarelo"])
    count_verd = len([x for x in profiles if x.get("category") == "Verde"])

    contexto_staff = (
        f"ESTATÍSTICAS GLOBAIS DA BASE DE PERMANÊNCIA:\n"
        f"- Total de estudantes monitorados: {total}\n"
        f"- Risco Crítico (Vermelho): {count_verm} | Risco Moderado (Amarelo): {count_amar} | Baixo Risco (Verde): {count_verd}\n"
    )
    if p:
        contexto_staff += f"\nFICHA DO ESTUDANTE IDENTIFICADO NO CONTEXTO DA CONVERSA:\n{json.dumps(p, ensure_ascii=False, indent=2)}\n"
    else:
        criticos_top = [x for x in profiles if x.get("category") == "Vermelho"][:5]
        contexto_staff += f"\nTOP 5 ALUNOS EM RISCO CRÍTICO (VERMELHO):\n{json.dumps(criticos_top, ensure_ascii=False, indent=2)}\n"

    # Recupera até 2 seções do Grafo de Conhecimento em Markdown se a dúvida mencionar normas/programas (ex: PAFE, Bolsas, Rematrícula)
    secoes_md = knowledge_engine.buscar_secoes(query, top_k=2) if query else []
    if secoes_md:
        contexto_staff += f"\nDIRETRIZES INSTITUCIONAIS EM MARKDOWN RELACIONADAS:\n{knowledge_engine.formatar_contexto_para_prompt(secoes_md)}\n"

    try:
        from agent import client
        staff_sys = (
            "Você é o Agente Analítico de Permanência e Sucesso Estudantil (SISA Staff) da FECAP.\n"
            "Analise os dados reais abaixo e responda de forma executiva, empática e orientada à tomada de decisão pedagógica e financeira.\n"
            "Mantenha o contexto entre turnos quando o colaborador fizer perguntas de continuação sobre o mesmo aluno (cite sempre o Nome, RA e Curso do aluno em análise).\n\n"
            f"{contexto_staff}"
        )
        msgs = [{"role": "system", "content": staff_sys}]
        for m in history[-6:]:
            content_str = m.content[:800] if m.role == "assistant" and len(m.content) > 800 else m.content
            msgs.append({"role": m.role, "content": content_str})
        if query and (not msgs or msgs[-1].get("content") != query):
            msgs.append({"role": "user", "content": query})
        elif not any(m.get("role") == "user" for m in msgs):
            msgs.append({"role": "user", "content": "Apresente o diagnóstico de permanência."})

        modelos_staff = list(dict.fromkeys([
            agente_academico.model,
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
        ]))
        for mod in modelos_staff:
            try:
                max_tok = 650 if "qwen" in mod else 900
                comp = client.chat.completions.create(
                    model=mod,
                    messages=msgs,
                    temperature=0.2,
                    max_tokens=max_tok,
                )
                resp_txt = re.sub(r"<think>.*?</think>", "", comp.choices[0].message.content or "", flags=re.DOTALL).strip()
                if resp_txt:
                    return {"response": resp_txt, "active_student": p, "status": "success"}
            except Exception as inner_e:
                print(f"[!] Aviso no modelo {mod} (Staff): {inner_e}")
                continue
    except Exception as e:
        print(f"[!] Aviso no LLM Staff, usando síntese estruturada: {e}")

    if p:
        return {
            "response": (
                f"### Diagnóstico de Permanência — {p['name']} (RA: `{p['ra']}`)\n\n"
                f"- **Curso**: {p['course']} ({p['semester']})\n"
                f"- **Score Global**: **{p['overallRiskScore']}/100** (`{p['category']}`)\n"
                f"- **Financeiro ({p['dimensions']['financeira']['score']}/100 - {p['dimensions']['financeira']['status']})**: {p['dimensions']['financeira']['detail']}\n"
                f"- **Acadêmico ({p['dimensions']['academica']['score']}/100 - {p['dimensions']['academica']['status']})**: {p['dimensions']['academica']['detail']}\n"
                f"- **Relacionamento ({p['dimensions']['relacionamento']['score']}/100 - {p['dimensions']['relacionamento']['status']})**: {p['dimensions']['relacionamento']['detail']}\n"
                f"- **Geográfico ({p['dimensions']['geografica']['score']}/100 - {p['dimensions']['geografica']['status']})**: {p['dimensions']['geografica']['detail']}\n"
                f"- **Explicação**: {p['explanation']}\n"
                f"- **Plano de Ação Recomendado**: {p['recommendation']}"
            ),
            "active_student": p,
            "status": "success",
        }

    return {
        "response": (
            f"### Painel Analítico de Permanência Estudantil\n\n"
            f"Monitoramos **{total} estudantes** ({count_verm} em risco crítico Vermelho, {count_amar} em Amarelo e {count_verd} em Verde). "
            f"Informe o nome ou RA de um estudante para analisar suas dimensões ou propor ações de retenção."
        ),
        "active_student": None,
        "status": "success",
    }


def montar_payload_mensagens(request: ChatRequest) -> list:
    mensagens = []
    if request.messages:
        for msg in request.messages:
            mensagens.append({"role": msg.role, "content": msg.content})
    elif request.history:
        for msg in request.history:
            mensagens.append({"role": msg.role, "content": msg.content})
    msg_atual = request.message or request.query
    if msg_atual:
        if not mensagens or mensagens[-1].get("content") != msg_atual:
            mensagens.append({"role": "user", "content": msg_atual})

    if not mensagens:
        raise HTTPException(status_code=400, detail="Nenhuma mensagem fornecida.")
    return mensagens


@app.post("/api/chat", response_model=ChatResponse)
def chat_completo(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    try:
        if request.role == "Funcionário":
            require_staff_role(current_user)
            return chat_analitico_staff(request, current_staff=current_user)

        mensagens = montar_payload_mensagens(request)
        resposta = agente_academico.run(mensagens, perfil_aluno=request.student_profile)
        return ChatResponse(response=resposta, status="success")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao processar mensagem: {str(e)}")


from knowledge_gap_logger import obter_relatorio_lacunas


@app.get("/api/gaps")
def listar_lacunas_conhecimento():
    return {"gaps": obter_relatorio_lacunas(), "status": "success"}


# ==========================================
# CONFIGURAÇÃO DE ARQUIVOS ESTÁTICOS E SPA FRONTEND
# ==========================================
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BACKEND_DIR, "static")
ROOT_SRC_DIR = os.path.dirname(BACKEND_DIR)
FRONTEND_DIST_DIR = os.path.join(ROOT_SRC_DIR, "Frontend", "dist")

# Sempre monta /static caso exista o diretório legado de arquivos estáticos
if os.path.isdir(STATIC_DIR):
    try:
        app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    except Exception as e:
        print(f"[!] Aviso ao montar /static: {e}")

# Se o Frontend compilado (Expo Web) estiver disponível em Frontend/dist
if os.path.isdir(FRONTEND_DIST_DIR) and os.path.exists(os.path.join(FRONTEND_DIST_DIR, "index.html")):
    expo_assets_dir = os.path.join(FRONTEND_DIST_DIR, "_expo")
    if os.path.isdir(expo_assets_dir):
        app.mount("/_expo", StaticFiles(directory=expo_assets_dir), name="expo-static")

    frontend_assets_dir = os.path.join(FRONTEND_DIST_DIR, "assets")
    if os.path.isdir(frontend_assets_dir):
        app.mount("/assets", StaticFiles(directory=frontend_assets_dir), name="frontend-assets")

    @app.get("/favicon.ico", include_in_schema=False)
    def favicon():
        fav_candidate = os.path.join(FRONTEND_DIST_DIR, "favicon.ico")
        if os.path.exists(fav_candidate):
            return FileResponse(fav_candidate)
        static_fav = os.path.join(STATIC_DIR, "favicon.ico")
        if os.path.exists(static_fav):
            return FileResponse(static_fav)
        raise HTTPException(status_code=404, detail="Favicon not found")

    @app.get("/metadata.json", include_in_schema=False)
    def metadata():
        meta_candidate = os.path.join(FRONTEND_DIST_DIR, "metadata.json")
        if os.path.exists(meta_candidate):
            return FileResponse(meta_candidate)
        raise HTTPException(status_code=404, detail="Metadata not found")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend_spa(full_path: str):
        # Isola rotas de API, documentação Swagger e OpenAPI
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("redoc") or full_path == "openapi.json":
            raise HTTPException(status_code=404, detail="Not Found")
        file_candidate = os.path.join(FRONTEND_DIST_DIR, full_path)
        if full_path and os.path.isfile(file_candidate):
            return FileResponse(file_candidate)
        # Roteamento SPA fallback: redireciona navegação interna para index.html
        return FileResponse(os.path.join(FRONTEND_DIST_DIR, "index.html"))

elif os.path.isdir(STATIC_DIR) and os.path.exists(os.path.join(STATIC_DIR, "index.html")):
    @app.get("/", include_in_schema=False)
    def index():
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    is_dev = os.getenv("FASTAPI_ENV", "development").lower() == "development" and not os.getenv("RAILWAY_ENVIRONMENT")
    print(f"Iniciando Servidor SISA FECAP em http://{host}:{port} (Ambiente: {'dev' if is_dev else 'production'})")
    uvicorn.run("server:app", host=host, port=port, reload=is_dev)
