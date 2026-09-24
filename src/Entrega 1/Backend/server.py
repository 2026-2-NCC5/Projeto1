# server.py
import os
import json
import traceback
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import uvicorn

from agent import agente_academico, buscar_horarios_relevantes, buscar_requerimentos_relevantes
from rag_engine import rag_engine

app = FastAPI(
    title="SISA - Assistente Acadêmico FECAP API",
    description="API para o assistente de requerimentos acadêmicos com suporte a Chat e Streaming em tempo real.",
    version="2.0.0"
)

# Configuração de CORS para permitir integração fácil com qualquer frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite chamadas de qualquer frontend (React, Vue, Next.js, etc.)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Schemas de dados (Pydantic)
class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' ou 'assistant'")
    content: str = Field(..., description="Conteúdo da mensagem")

class ChatRequest(BaseModel):
    message: Optional[str] = Field(None, description="Última mensagem do usuário")
    history: Optional[List[ChatMessage]] = Field(default=[], description="Histórico de mensagens da conversa")

class ChatResponse(BaseModel):
    response: str
    status: str = "success"

@app.get("/api/health")
def health_check():
    """Verifica a integridade da API."""
    return {"status": "ok", "service": "SISA FECAP Agent API", "model": agente_academico.model}

@app.get("/api/sugestoes")
def obter_sugestoes():
    """Retorna sugestões de perguntas frequentes para botões/chips no frontend."""
    return {
        "sugestoes": agente_academico.get_sugestoes()
    }

@app.get("/api/horarios")
def listar_horarios(turma: Optional[str] = None, q: Optional[str] = None):
    """Retorna as grades de horários com busca inteligente por turma, disciplina, professor, sala ou curso."""
    termo = turma or q
    if termo and termo.strip():
        filtrados = buscar_horarios_relevantes(termo.strip(), top_k=25)
        return {"horarios": filtrados, "total": len(filtrados)}
    todos = agente_academico.get_horarios()
    return {"horarios": todos, "total": len(todos)}

@app.get("/api/requerimentos")
def listar_requerimentos(q: Optional[str] = None):
    """Retorna a lista de requerimentos cadastrados com busca inteligente opcional."""
    if q and q.strip():
        filtrados = buscar_requerimentos_relevantes(q.strip(), top_k=82)
        return {"requerimentos": filtrados, "total": len(filtrados)}
    todos = agente_academico.get_requerimentos()
    return {"requerimentos": todos, "total": len(todos)}

class SearchRequest(BaseModel):
    query: str = Field(..., description="Texto da pergunta ou termo para busca semântica")
    top_k: int = Field(default=4, description="Número máximo de trechos a retornar")
    min_score: float = Field(default=0.25, description="Limiar mínimo de similaridade de cosseno")

@app.post("/api/rag/search")
def buscar_rag(req: SearchRequest):
    """
    Busca trechos de documentos oficiais por similaridade vetorial de embeddings (RAG).
    Retorna os trechos mais relevantes com arquivo, página e pontuação de similaridade.
    """
    try:
        resultados = rag_engine.buscar_chunks(req.query, top_k=req.top_k, min_score=req.min_score)
        return {
            "query": req.query,
            "total_encontrados": len(resultados),
            "chunks": resultados
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na busca vetorial: {str(e)}")

@app.get("/api/documentos")
def listar_documentos():
    """Retorna a lista de documentos ingeridos da pasta DocumentosASA."""
    return {
        "documentos": agente_academico.get_documentos()
    }

def montar_payload_mensagens(request: ChatRequest) -> list:
    mensagens = []
    if request.history:
        for msg in request.history:
            mensagens.append({"role": msg.role, "content": msg.content})
    if request.message:
        # Se a última mensagem não estiver no final do histórico, adiciona
        if not mensagens or mensagens[-1].get("content") != request.message:
            mensagens.append({"role": "user", "content": request.message})
    
    if not mensagens:
        raise HTTPException(status_code=400, detail="Nenhuma mensagem fornecida.")
    return mensagens

@app.post("/api/chat", response_model=ChatResponse)
def chat_completo(request: ChatRequest):
    """
    Endpoint síncrono padrão.
    Recebe a mensagem e histórico e retorna a resposta completa em JSON.
    """
    try:
        mensagens = montar_payload_mensagens(request)
        resposta = agente_academico.run(mensagens)
        return ChatResponse(response=resposta, status="success")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao processar mensagem: {str(e)}")

@app.post("/api/chat/stream")
def chat_stream(request: ChatRequest):
    """
    Endpoint de Streaming em tempo real (Server-Sent Events / SSE).
    Ideal para frontends com efeito de digitação suave.
    """
    try:
        mensagens = montar_payload_mensagens(request)

        def event_generator():
            try:
                for chunk in agente_academico.run_stream(mensagens):
                    # Formato SSE padrão
                    payload = json.dumps({"chunk": chunk}, ensure_ascii=False)
                    yield f"data: {payload}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as ex:
                err_payload = json.dumps({"error": str(ex)}, ensure_ascii=False)
                yield f"data: {err_payload}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro no streaming: {str(e)}")

# Monta diretório estático para a interface de demonstração
try:
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    
    @app.get("/")
    def index():
        return FileResponse(os.path.join(static_dir, "index.html"))
except Exception:
    pass

if __name__ == "__main__":
    print("Iniciando Servidor SISA FECAP em http://localhost:8000")
    print("Documentacao Swagger disponivel em http://localhost:8000/docs")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
