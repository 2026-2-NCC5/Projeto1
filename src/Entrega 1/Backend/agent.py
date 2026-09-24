# agent.py
import os
import json
from typing import List, Dict, Any, Generator, Union
import httpx
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

# Suprime avisos de symlink no Windows
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

# Importa o motor de RAG vetorial
from rag_engine import rag_engine

# Cria um cliente HTTP customizado com SSL flexível se necessário
http_client = httpx.Client(verify=False)

# Inicializa o cliente Groq
client = Groq(
    api_key=os.getenv("GROQ_API_KEY", ""),
    http_client=http_client
)

import re
import unicodedata

def normalizar_texto(texto: str) -> str:
    """Normaliza texto removendo acentuação, caracteres especiais e espaços extras."""
    if not texto:
        return ""
    texto = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode("ascii")
    texto = re.sub(r"[^\w\s]", " ", texto)
    return re.sub(r"\s+", " ", texto).strip().lower()

COURSE_SYNONYMS = {
    "ccomp": ["ccomp", "computacao", "ciencia da computacao"],
    "ads": ["ads", "analise e desenvolvimento de sistemas", "analise de sistemas", "desenvolvimento de sistemas"],
    "adm": ["adm", "administracao"],
    "cont": ["contabeis", "contabilidade", "ciencias contabeis"],
    "econ": ["economia", "economicas", "ciencias economicas"]
}

HORARIO_INTENT_TERMS = [
    "horario", "horarios", "grade", "aula", "aulas", "sala", "salas",
    "lab", "laboratorio", "laboratorios", "professor", "professores",
    "professora", "professoras", "materia", "materias", "disciplina",
    "disciplinas", "turma", "turmas", "segunda", "terca", "quarta",
    "quinta", "sexta", "sabado", "noturno", "matutino", "semestre"
]

STOP_WORDS = {
    "qual", "quais", "onde", "quem", "como", "quando", "aulas", "aula",
    "horario", "horarios", "grade", "materia", "materias", "disciplina",
    "disciplinas", "para", "com", "por", "que", "tem", "tenho", "dada",
    "pelo", "pela", "sobre", "quero", "gostaria", "saber", "favor", "dia", "dias"
}

def carregar_requerimentos_raw() -> List[Dict[str, Any]]:
    """Carrega a lista de requerimentos do arquivo JSON."""
    caminho = os.path.join(os.path.dirname(__file__), "requerimentos.json")
    try:
        with open(caminho, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception as e:
        print(f"Erro ao carregar requerimentos.json: {e}")
        return []

def carregar_horarios_raw() -> List[Dict[str, Any]]:
    """Carrega a grade de horários de aulas do arquivo JSON."""
    caminho = os.path.join(os.path.dirname(__file__), "horarios.json")
    try:
        with open(caminho, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception as e:
        print(f"Erro ao carregar horarios.json: {e}")
        return []

def buscar_horarios_relevantes(query: str = "", top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Busca semântica inteligente nas grades de horários por turma, disciplina, professor,
    sala, laboratório, dia da semana, curso e semestre.
    """
    if not query:
        return []

    norm_q = normalizar_texto(query)
    q_words = [w for w in norm_q.split() if len(w) > 1 and w not in STOP_WORDS]
    q_tokens = set(q_words)
    
    # Verifica se a pergunta tem qualquer relação com horários/cursos/turmas
    tem_intencao = any(t in norm_q for t in HORARIO_INTENT_TERMS) or bool(q_tokens)
    if not tem_intencao:
        return []

    horarios = carregar_horarios_raw()

    # Detecta menção a semestre (ex: "1º", "2 semestre", "5na")
    sem_match = re.search(r'\b([1-8])\s*(o|º|ª)?\s*(sem|semestre)?\b', norm_q)
    target_sem = int(sem_match.group(1)) if sem_match else None
    
    turma_sem_match = re.search(r'\b([1-8])\s*n[ab]\b', norm_q)
    if turma_sem_match:
        target_sem = int(turma_sem_match.group(1))

    # Detecta menção a curso
    target_courses = []
    for key, syns in COURSE_SYNONYMS.items():
        if any(s in norm_q for s in syns):
            target_courses.append(key)

    scored = []
    for h in horarios:
        score = 0
        norm_cod = normalizar_texto(h.get("codigo", ""))
        norm_curso = normalizar_texto(h.get("curso", ""))
        norm_tid = normalizar_texto(h.get("turma_id", ""))
        apelidos_norm = [normalizar_texto(a) for a in h.get("apelidos", [])]
        sem = h.get("semestre")

        # 1. Correspondência direta de código ou apelidos da turma
        for a in apelidos_norm:
            if a in norm_q:
                score += 260 + (len(a) * 5)
        if norm_cod in norm_q:
            score += 220 + (len(norm_cod) * 5)
        elif norm_tid in norm_q:
            score += 200

        # 2. Correspondência por curso
        matched_course = False
        if "ccomp" in target_courses and ("computacao" in norm_curso or "ccomp" in norm_tid):
            score += 50
            matched_course = True
        if "ads" in target_courses and "ads" in norm_curso:
            score += 50
            matched_course = True
        if "adm" in target_courses and ("administracao" in norm_curso or "adm" in norm_tid):
            score += 50
            matched_course = True
        if "cont" in target_courses and ("contabeis" in norm_curso or "_cc" in norm_tid):
            score += 50
            matched_course = True
        if "econ" in target_courses and ("economicas" in norm_curso or "_ce" in norm_tid):
            score += 50
            matched_course = True

        # 3. Correspondência por semestre
        if target_sem is not None and sem == target_sem:
            if matched_course:
                score += 120
            else:
                score += 35

        # 4. Busca detalhada na Grade (Disciplinas, Professores, Salas/Labs, Dias)
        for g in h.get("grade", []):
            norm_disc = normalizar_texto(g.get("disciplina", ""))
            norm_prof = normalizar_texto(g.get("professor", ""))
            norm_sala = normalizar_texto(g.get("sala_lab", ""))
            norm_dia = normalizar_texto(g.get("dia", ""))

            # Disciplina exata ou por palavra-chave
            if norm_disc and norm_disc in norm_q:
                score += 190
            else:
                disc_words = [w for w in norm_disc.split() if len(w) > 2 and w not in STOP_WORDS]
                common_disc = set(disc_words).intersection(q_tokens)
                if common_disc:
                    score += len(common_disc) * 55

            # Professor exato ou por palavra-chave
            if norm_prof and norm_prof in norm_q:
                score += 190
            else:
                prof_words = [w for w in norm_prof.split() if len(w) > 2 and w not in STOP_WORDS]
                common_prof = set(prof_words).intersection(q_tokens)
                if common_prof:
                    score += len(common_prof) * 55

            # Sala ou Laboratório
            if norm_sala and norm_sala in norm_q:
                score += 160
            elif "lab" in norm_q:
                sala_words = [w for w in norm_sala.split() if len(w) > 2]
                if any(w in q_tokens for w in sala_words):
                    score += 110

            # Dia da semana (com contexto de turma ou matéria)
            if norm_dia and norm_dia in norm_q and (matched_course or score > 40):
                score += 30

        if score > 0:
            scored.append((score, h))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored[:top_k]]

def buscar_requerimentos_relevantes(query: str = "", top_k: int = 3) -> List[Dict[str, Any]]:
    """
    Busca inteligente no catálogo completo de requerimentos acadêmicos por título,
    tipo, grupo de atendimento, descrição e palavras-chave.
    """
    if not query:
        return []

    norm_q = normalizar_texto(query)
    q_words = [w for w in norm_q.split() if len(w) > 2 and w not in STOP_WORDS]
    q_tokens = set(q_words)
    if not q_tokens:
        return []

    reqs = carregar_requerimentos_raw()
    scored = []

    for r in reqs:
        score = 0
        norm_tit = normalizar_texto(r.get("titulo", ""))
        norm_tipo = normalizar_texto(r.get("tipo_de_requerimento", ""))
        norm_grupo = normalizar_texto(r.get("grupo_de_atendimento", ""))
        norm_desc = normalizar_texto(r.get("descricao", ""))
        norm_proc = normalizar_texto(r.get("procedimentos", ""))
        tags = [normalizar_texto(t) for t in r.get("tags", [])]

        # Título exato ou por tokens
        if norm_tit and norm_tit in norm_q:
            score += 220
        else:
            tit_words = [w for w in norm_tit.split() if len(w) > 2]
            common_tit = set(tit_words).intersection(q_tokens)
            if common_tit:
                score += len(common_tit) * 45

        # Tags e palavras-chave
        for t in tags:
            if t in q_tokens:
                score += 35

        # Descrição e procedimentos
        for w in q_tokens:
            if w in norm_desc:
                score += 12
            if w in norm_proc:
                score += 12

        # Termos específicos com alta intenção
        if "sptrans" in norm_q and "sptrans" in norm_tit:
            score += 160
        elif "emtu" in norm_q and "emtu" in norm_tit:
            score += 160
        elif "tranc" in norm_q and "trancamento" in norm_tit:
            score += 110
        elif ("assistencia" in norm_q or "desemprego" in norm_q) and "assistencia financeira" in norm_tit:
            score += 160
        elif "impress" in norm_q and "impressao" in norm_tit:
            score += 160
        elif "bolsa" in norm_q and "ex aluno" in norm_q and "ex aluno" in norm_tit:
            score += 160
        elif "transferencia" in norm_q and "transferencia" in norm_tit:
            score += 110

        if score > 0:
            scored.append((score, r))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored[:top_k]]

def filtrar_contexto_relevante(query: str = "") -> str:
    """
    Filtra requerimentos, horários e documentos relevantes para respeitar
    a janela de contexto da Groq e garantir fundamentação precisa e sem alucinações.
    """
    reqs_filtrados = buscar_requerimentos_relevantes(query, top_k=3)
    horarios_filtrados = buscar_horarios_relevantes(query, top_k=3)

    # 3. Recuperação Vetorial Semântica nos PDFs (RAG com FastEmbed)
    # Se encontramos turmas no JSON oficial de horários, excluímos PDFs fragmentados de horários do RAG
    excluir_horarios_rag = len(horarios_filtrados) > 0
    chunks_rag = rag_engine.buscar_chunks(query, top_k=4, min_score=0.25, excluir_horarios=excluir_horarios_rag)
    contexto_rag = rag_engine.formatar_contexto_para_prompt(chunks_rag)

    bloco_reqs = json.dumps(reqs_filtrados, ensure_ascii=False, indent=2) if reqs_filtrados else "Nenhum requerimento específico para esta consulta."
    bloco_horarios = json.dumps(horarios_filtrados, ensure_ascii=False, indent=2) if horarios_filtrados else "Nenhuma grade de horários específica necessária para esta consulta."

    return f"""
CATÁLOGO OFICIAL DE REQUERIMENTOS RELEVANTES (JSON):
{bloco_reqs}

GRADE OFICIAL DE HORÁRIOS E SALAS DE AULA RELEVANTES (JSON):
{bloco_horarios}

DOCUMENTOS E REGULAMENTOS RECUPERADOS VIA RAG VETORIAL (PASTA DocumentosASA):
{contexto_rag}
"""

def gerar_system_prompt(query: str = "") -> str:
    contexto = filtrar_contexto_relevante(query)
    return f"""
Você é o SISA (Sistema Inteligente do Sucesso Alvarista), assistente virtual oficial da FECAP.
Sua missão primordial é orientar estudantes, pais, professores e funcionários sobre serviços acadêmicos, procedimentos, horários de aulas, salas, laboratórios, professores, portal do aluno e regulamentos oficiais.

{contexto}

DIRETRIZES DE ATENDIMENTO E FUNDAMENTAÇÃO:
1. **REGRA SUPREMA PARA HORÁRIOS E SALAS DE AULA (ATENÇÃO MÁXIMA)**:
   - Para qualquer pergunta sobre horários de aula, turmas, matérias, professores, salas ou laboratórios, você DEVE consultar e utilizar EXCLUSIVAMENTE os dados da "GRADE OFICIAL DE HORÁRIOS E SALAS DE AULA RELEVANTES (JSON)" acima.
   - NUNCA utilize trechos de PDFs ou deduza horários faltantes.
   - É expressamente PROIBIDO responder que disciplinas de quinta ou sexta-feira não estão especificadas se a turma estiver presente no JSON. Todas as turmas cadastradas no JSON contam com grade completa de 5 dias letivos (segunda a sexta-feira).
   - Apresente OBRIGATORIAMENTE todas as disciplinas da grade da turma solicitada exatamente como cadastradas no JSON, detalhando: **Dia da Semana**, **Horário**, **Disciplina**, **Professor(a)** e **Sala / Laboratório**.
   - Indique sempre a Turma (ex: 5NA ADM, CCOMP 4, 1NA ADS), Curso, Semestre e Período (Noturno).
2. **Requerimentos Acadêmicos e Procedimentos**:
   - Quando o estudante perguntar sobre solicitações, utilize as informações do "CATÁLOGO OFICIAL DE REQUERIMENTOS RELEVANTES (JSON)".
   - Informe: Nome oficial do requerimento, Grupo/Setor responsável, Valor/Taxa, Caminho no Portal do Aluno (`caminho_sistema`), Documentos/Anexos obrigatórios e Procedimentos passo a passo.
3. **Base de Conhecimento e Fidelidade aos Documentos**:
   - Fundamente suas respostas institucionais prioritariamente nos trechos de documentos oficiais recuperados acima via busca vetorial.
   - Cite expressamente a fonte e arquivo ao final:
     *(Exemplo: 📌 **Fonte**: Regulamento do Programa de Bolsas Restituíveis FECAP, Pág. 1 | DocumentosASA).*
4. **Programas Financeiros e Bolsas (ATENÇÃO RIGOROSA)**:
   - A FECAP **POSSUI SIM** o "Programa de Bolsas Restituíveis FECAP" (documento: Regulamento_do_Programa_de_Bolsas_Restituíveis_FECAP.pdf). Ele prevê o pagamento parcial das mensalidades durante o curso de graduação e a quitação/restituição do restante após o término do curso.
   - A FECAP também possui separadamente o "Programa de Assistência Financeira Educacional" (PAFE), voltado para casos emergenciais de desemprego, falecimento ou perda involuntária de renda do responsável financeiro.
   - **NUNCA diga ou deduza que a FECAP não possui programa de bolsas restituíveis!** Trata-se de um benefício oficial com regulamento próprio.
5. **Passo a Passo Prático**:
   - Organize procedimentos em etapas numeradas (Etapa 1, Etapa 2, Etapa 3).
   - Indique o setor competente (ex: Central de Atendimento ao Aluno - CAA, Secretaria Geral, Tesouraria).
6. **Linguagem e Formatação**:
   - Responda sempre em português, com tom educado, profissional e acolhedor.
   - Utilize formatação Markdown com negrito, tabelas e tópicos para excelente legibilidade.
7. **Limite de Conhecimento**:
   - Caso a dúvida do usuário não conste nas bases e regulamentos acima, informe com transparência e oriente a procurar a Central de Atendimento ao Aluno (CAA) ou coordenação.
"""

class AgenteAcademico:
    def __init__(self, model: str = None):
        self.model = model or os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")

    def _preparar_mensagens(self, entrada: Union[str, List[Dict[str, str]]]) -> List[Dict[str, str]]:
        """Prepara o array de mensagens com System Prompt enriquecido via RAG Vetorial adaptado à pergunta."""
        user_query = ""
        if isinstance(entrada, str):
            user_query = entrada
        elif isinstance(entrada, list):
            for msg in reversed(entrada):
                if isinstance(msg, dict) and msg.get("role") == "user":
                    user_query = msg.get("content", "")
                    break

        prompt = gerar_system_prompt(user_query)
        mensagens = [{"role": "system", "content": prompt}]
        
        if isinstance(entrada, str):
            mensagens.append({"role": "user", "content": entrada})
        elif isinstance(entrada, list):
            for msg in entrada:
                if isinstance(msg, dict) and "role" in msg and "content" in msg:
                    if msg["role"] != "system":
                        mensagens.append({"role": msg["role"], "content": msg["content"]})
        return mensagens

    def run(self, entrada: Union[str, List[Dict[str, str]]]) -> str:
        """Executa a resposta completa (síncrona) com fallback de modelos para evitar 429."""
        mensagens = self._preparar_mensagens(entrada)
        modelos = [self.model, "qwen/qwen3.8-27b", "qwen/qwen3.6-27b", "openai/gpt-oss-120b"]
        modelos_unicos = list(dict.fromkeys(modelos))
        ultimo_erro = None

        for mod in modelos_unicos:
            try:
                completion = client.chat.completions.create(
                    model=mod,
                    messages=mensagens,
                    temperature=0.2,
                    max_tokens=750
                )
                return completion.choices[0].message.content
            except Exception as e:
                ultimo_erro = e
                if "429" in str(e) or "model_not_found" in str(e):
                    continue
                raise e

        raise ultimo_erro or Exception("Não foi possível obter resposta dos modelos Groq.")

    def run_stream(self, entrada: Union[str, List[Dict[str, str]]]) -> Generator[str, None, None]:
        """Gera a resposta em streaming token por token."""
        mensagens = self._preparar_mensagens(entrada)
        modelos = [self.model, "qwen/qwen3.8-27b", "qwen/qwen3.6-27b", "openai/gpt-oss-120b"]
        modelos_unicos = list(dict.fromkeys(modelos))

        for mod in modelos_unicos:
            try:
                response_stream = client.chat.completions.create(
                    model=mod,
                    messages=mensagens,
                    temperature=0.2,
                    max_tokens=750,
                    stream=True
                )
                for chunk in response_stream:
                    if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
                return
            except Exception as e:
                if "429" in str(e) or "model_not_found" in str(e):
                    continue
                raise e

    def get_requerimentos(self) -> List[Dict[str, Any]]:
        """Retorna todos os requerimentos cadastrados."""
        return carregar_requerimentos_raw()

    def get_horarios(self) -> List[Dict[str, Any]]:
        """Retorna a grade completa de horários."""
        return carregar_horarios_raw()

    def get_documentos(self) -> List[Dict[str, Any]]:
        """Retorna a lista de documentos ingeridos."""
        caminho = os.path.join(os.path.dirname(__file__), "documentosASA.json")
        try:
            with open(caminho, "r", encoding="utf-8") as file:
                data = json.load(file)
                return data.get("documentos", [])
        except Exception:
            return []

    def get_sugestoes(self) -> List[str]:
        """Retorna sugestões de perguntas frequentes para o frontend."""
        return [
            "Como funciona o Programa de Bolsas Restituíveis?",
            "Quais os prazos de Rematrícula 2026/2?",
            "Qual o horário e laboratório de ADS?",
            "Como solicitar auxílio financeiro em caso de desemprego?",
            "Como funciona o passe escolar SPTrans/EMTU?"
        ]

# Instância exportada para uso no server.py
agente_academico = AgenteAcademico()