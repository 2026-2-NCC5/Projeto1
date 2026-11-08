# -*- coding: utf-8 -*-
"""
Agente Acadêmico Autônomo SISA FECAP (Markdown-First & Context-Aware Engine)
- Recuperação unificada fundamentada no Grafo de Conhecimento em Markdown (knowledge_graph/).
- Assimilação de contexto conversacional multi-turno (preserva curso, turma, semestre, turno e intenção ativa).
- Compreensão nativa de gírias, abreviações de internet e siglas acadêmicas.
- Detecção de humor/estado emocional do estudante (ansioso, frustrado, confuso, casual/gírias, objetivo) com adaptação empática de tom.
- Detecção de ambiguidade com formulação autônoma de perguntas esclarecedoras quando faltam dados essenciais.
- Recomendação estrita e de alta precisão de requerimentos (zero falsos positivos em perguntas informativas).
"""

import os
import json
import re
from typing import List, Dict, Any, Generator, Union, Optional
import httpx
from dotenv import load_dotenv
from groq import Groq

_backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_backend_dir, ".env"))
load_dotenv(os.path.join(os.path.dirname(_backend_dir), ".env"))

from knowledge_engine import (
    KnowledgeEngine,
    is_greeting_message,
    normalizar_texto,
    expandir_consulta_academica,
    extrair_entidades_consulta,
    COURSE_SYNONYMS,
)
from knowledge_gap_logger import registrar_lacuna

knowledge_engine = KnowledgeEngine()

http_client = httpx.Client(verify=False, timeout=15.0)

client = Groq(
    api_key=os.getenv("GROQ_API_KEY", ""),
    http_client=http_client,
    max_retries=0,
)

STOP_WORDS = {
    "qual", "quais", "onde", "quem", "como", "quando", "aulas", "aula",
    "horario", "horarios", "grade", "materia", "materias", "disciplina",
    "disciplinas", "para", "pra", "pro", "com", "por", "que", "tem", "tenho",
    "dada", "pelo", "pela", "sobre", "quero", "gostaria", "saber", "favor",
    "dia", "dias", "de", "do", "da", "dos", "das", "em", "no", "na", "nos",
    "nas", "um", "uma", "o", "a", "os", "as", "e", "eh", "prova", "provas",
    "po", "data", "sala", "curso", "turma", "semestre", "aluno", "estudante",
    "nota", "notas", "fecap", "sisa", "fazer", "abrir", "pedir",
}

# Gatilhos explícitos de intenção procedimental/administrativa para recomendação de requerimentos
PROCEDURAL_REQ_TRIGGERS = [
    "requerimento", "protocolo", "protocolar", "solicitar", "solicitacao",
    "como peco", "como pedir", "como abrir", "abrir chamado", "segunda via",
    "atestado de matricula", "declaracao de matricula", "historico escolar",
    "passe escolar", "bilhete unico", "sptrans", "emtu", "top",
    "trancamento", "trancar", "cancelamento", "cancelar matricula", "desistencia",
    "transferencia", "reembolso", "restituicao", "devolucao", "abatimento",
    "assinar contrato", "assinatura de estagio", "termo de compromisso", "tce", "aditivo de estagio", "rescisao de estagio",
    "dispensa de disciplina", "aproveitamento de estudos", "equivalencia",
    "abono de falta", "abono de faltas", "justificar falta", "atestado medico", "regime domiciliar",
    "revisao de nota", "revisao de falta", "segunda chamada", "prova substitutiva",
    "colacao de grau", "diploma", "certificado de conclusao", "fies", "prouni",
]


def carregar_requerimentos_raw() -> List[Dict[str, Any]]:
    caminho = os.path.join(os.path.dirname(__file__), "requerimentos.json")
    try:
        with open(caminho, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception as e:
        print(f"Erro ao carregar requerimentos.json: {e}")
        return []


def carregar_horarios_raw() -> List[Dict[str, Any]]:
    caminho = os.path.join(os.path.dirname(__file__), "horarios.json")
    try:
        with open(caminho, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception as e:
        print(f"Erro ao carregar horarios.json: {e}")
        return []


def carregar_dp_sabado_raw() -> List[Dict[str, Any]]:
    caminho = os.path.join(os.path.dirname(__file__), "horarios_dp_sabado.json")
    try:
        with open(caminho, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception as e:
        print(f"Erro ao carregar horarios_dp_sabado.json: {e}")
        return []


def detectar_humor_estudante(query: str) -> Dict[str, str]:
    """
    Analisa o estado emocional e o registro linguístico do estudante na mensagem atual
    para orientar o tom, o acolhimento e a postura do agente.
    """
    norm_q = normalizar_texto(query)

    # 1. Ansioso / Desesperado / Preocupado
    anxious_terms = [
        "socorro", "desesperado", "desesperada", "medo", "ferrado", "ferrada",
        "lascado", "lascada", "bombei", "rodei", "reprovei", "vou reprovar",
        "perdi a prova", "perdi o prazo", "esqueci", "urgente", "pelo amor de deus",
        "me ajuda", "to perdido", "estou perdido", "to com medo", "ansioso", "ansiosa",
        "desempregado", "desemprego", "sem grana", "nao consigo pagar",
    ]
    if any(k in norm_q for k in anxious_terms):
        return {
            "humor": "ansioso_ou_preocupado",
            "instrucao_tom": (
                "O estudante demonstra ansiedade, preocupação ou urgência. "
                "Inicie com uma frase breve de acolhimento tranquilizadora e empática, "
                "mostrando que há solução ou caminho claro nas normas da FECAP, e em seguida apresente as datas, regras ou passos exatos com muita clareza."
            ),
        }

    # 2. Frustrado / Irritado
    frustrated_terms = [
        "absurdo", "ridiculo", "ninguem responde", "nao funciona", "travou",
        "errado", "injusto", "sacanagem", "pessimo", "horrivel", "cansado disso",
        "nao acho nada", "sistema ruim", "irritado", "revoltado",
    ]
    if any(k in norm_q for k in frustrated_terms):
        return {
            "humor": "frustrado_ou_irritado",
            "instrucao_tom": (
                "O estudante demonstra frustração ou impaciência. "
                "Mantenha postura serena, respeitosa e 100% resolutiva: valide a dificuldade sem ficar na defensiva e vá direto à solução prática e verificada."
            ),
        }

    # 3. Confuso / Em dúvida
    confused_terms = [
        "nao entendi", "como assim", "confuso", "confusa", "qual a diferenca",
        "nao sei como", "me explica", "explica melhor", "boiei", "viajei", "duvida",
    ]
    if any(k in norm_q for k in confused_terms):
        return {
            "humor": "confuso_ou_em_duvida",
            "instrucao_tom": (
                "O estudante está com dúvida conceitual ou confuso. "
                "Seja altamente didático, organize a explicação em tópicos curtos ou exemplos práticos de fácil leitura."
            ),
        }

    # 4. Casual / Gírias / Coloquial
    casual_terms = [
        "mano", "cara", "salve", "opa", "eae", "blz", "vlw", "vc", "pq", "oq",
        "qnd", "pfvr", "tbm", "trampo", "grana", "prof", "econo", "ccomp", "b o",
    ]
    if any(re.search(rf"\b{re.escape(k)}\b", norm_q) for k in casual_terms):
        return {
            "humor": "casual_coloquial",
            "instrucao_tom": (
                "O estudante usa linguagem informal/universitária ou abreviações. "
                "Responda com tom amigável, próximo, natural e acessível (sem formalismo burocrático excessivo), mantendo total precisão nos dados."
            ),
        }

    return {
        "humor": "objetivo_padrao",
        "instrucao_tom": "O estudante fez uma consulta direta. Responda com simpatia, clareza e objetividade.",
    }


def assimilar_contexto_conversa(
    mensagens_input: Union[str, List[Dict[str, str]]],
    perfil_aluno: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Percorre todo o histórico da conversa (turnos do usuário e do assistente) para construir
    o estado conversacional acumulado:
    - Curso ativo (ex.: 'economia' / 'Ciências Econômicas')
    - Turma ativa (ex.: '5na')
    - Semestre ativo (ex.: 5)
    - Turno ativo ('noturno', 'matutino', 'sabado')
    - Intenção ativa ('data_prova', 'horario_aula', 'pedp', 'estagio', etc.)
    - Disciplina foco atual vs anterior
    - Consulta contextualizada expandida para busca no Grafo Markdown
    Se `perfil_aluno` for fornecido (curso, semestre, turma do aluno logado), inicializa o estado
    com esses dados padrões, permitindo que qualquer menção explícita na conversa os sobrescreva.
    """
    if isinstance(mensagens_input, str):
        user_turns = [mensagens_input]
        all_turns = [{"role": "user", "content": mensagens_input}]
    else:
        all_turns = [
            m for m in mensagens_input
            if isinstance(m, dict) and m.get("role") in ("user", "assistant") and m.get("content")
        ]
        user_turns = [m["content"] for m in all_turns if m["role"] == "user"]

    ultima_pergunta = user_turns[-1] if user_turns else ""

    estado: Dict[str, Any] = {
        "curso_canonico": None,
        "curso_label": None,
        "codigo_turma": None,
        "semestre": None,
        "turno": None,
        "intencao": None,
        "disciplina_detectada": None,
        "disciplina_anterior": None,
        "is_dp_sabado": False,
        "ultima_pergunta": ultima_pergunta,
        "eh_followup": len(user_turns) > 1,
        "veio_do_perfil": False,
    }

    # Inicializa com o perfil do estudante logado, se disponível
    if perfil_aluno and isinstance(perfil_aluno, dict):
        texto_perfil = " ".join(
            str(perfil_aluno.get(k) or "")
            for k in ("course", "curso", "semester", "semestre", "turma", "codigo_turma")
        ).strip()
        if texto_perfil:
            ent_perfil = extrair_entidades_consulta(texto_perfil)
            if ent_perfil["curso_canonico"]:
                estado["curso_canonico"] = ent_perfil["curso_canonico"]
                estado["curso_label"] = ent_perfil["curso_label"]
                estado["veio_do_perfil"] = True
            if ent_perfil["codigo_turma"]:
                estado["codigo_turma"] = ent_perfil["codigo_turma"]
                estado["veio_do_perfil"] = True
            if ent_perfil["semestre"] is not None:
                estado["semestre"] = ent_perfil["semestre"]
                estado["veio_do_perfil"] = True
            if not estado["codigo_turma"] and estado["semestre"] and estado["curso_canonico"]:
                estado["codigo_turma"] = f"{estado['semestre']}na"

    # Processa os turnos do usuário em ordem cronológica para herdar ou sobrescrever contexto
    for idx, txt in enumerate(user_turns):
        ent = extrair_entidades_consulta(txt)
        is_last = (idx == len(user_turns) - 1)

        if ent["curso_canonico"]:
            if estado.get("veio_do_perfil") and ent["curso_canonico"] != estado["curso_canonico"] and not ent["codigo_turma"]:
                estado["codigo_turma"] = None
                estado["semestre"] = None
            estado["curso_canonico"] = ent["curso_canonico"]
            estado["curso_label"] = ent["curso_label"]
            estado["veio_do_perfil"] = False
        if ent["codigo_turma"]:
            estado["codigo_turma"] = ent["codigo_turma"]
            estado["veio_do_perfil"] = False
        if ent["semestre"] is not None:
            estado["semestre"] = ent["semestre"]
        if ent["turno"]:
            estado["turno"] = ent["turno"]
        if ent["intencao"]:
            estado["intencao"] = ent["intencao"]
        if ent["is_dp_sabado"]:
            estado["is_dp_sabado"] = True

        if ent["disciplina_detectada"]:
            if not is_last:
                estado["disciplina_anterior"] = ent["disciplina_detectada"]
            else:
                estado["disciplina_detectada"] = ent["disciplina_detectada"]

    # Se na última mensagem o usuário mudou de disciplina (ex: "e a de cálculo?") mas não repetiu
    # a intenção ("data da prova") nem a turma ("5na econo"), o estado já preservou curso_canonico,
    # codigo_turma, semestre e intencao dos turnos anteriores!
    partes_busca = [ultima_pergunta]
    eh_saudacao = is_greeting_message(ultima_pergunta)
    if not eh_saudacao:
        if estado["curso_label"] and estado["curso_canonico"] not in normalizar_texto(ultima_pergunta):
            partes_busca.append(estado["curso_label"])
        if estado["codigo_turma"] and estado["codigo_turma"] not in normalizar_texto(ultima_pergunta):
            partes_busca.append(estado["codigo_turma"])
        if estado["intencao"] == "data_prova" and "prova" not in normalizar_texto(ultima_pergunta):
            partes_busca.append("data da prova oficial PO")
        elif estado["intencao"] == "horario_aula" and not any(k in normalizar_texto(ultima_pergunta) for k in ["aula", "sala", "horario", "grade"]):
            partes_busca.append("grade de horario e sala de aula")

    estado["query_contextualizada"] = " ".join(partes_busca).strip()
    return estado


def buscar_dp_sabado_relevantes(query: str = "", top_k: int = 2) -> List[Dict[str, Any]]:
    """Busca precisa no catálogo de DPs e Adaptações aos Sábados."""
    if not query:
        return []
    norm_q = normalizar_texto(expandir_consulta_academica(query))
    q_words = [w for w in norm_q.split() if len(w) > 2 and w not in STOP_WORDS]
    if not q_words:
        return []

    dps = carregar_dp_sabado_raw()
    scored = []

    for d in dps:
        score = 0
        norm_disc = normalizar_texto(d.get("disciplina", ""))
        norm_prof = normalizar_texto(d.get("professor", ""))

        if norm_disc and norm_disc in norm_q:
            score += 150
        else:
            disc_tokens = [w for w in norm_disc.split() if len(w) > 2 and w not in STOP_WORDS]
            inter = set(disc_tokens).intersection(q_words)
            if inter:
                score += len(inter) * 40

        if norm_prof and norm_prof in norm_q:
            score += 60

        if score > 0:
            scored.append((score, d))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored[:top_k]]


def buscar_horarios_relevantes(
    query: str = "",
    top_k: int = 2,
    contexto_conversa: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Busca nas grades de aulas regulares (horarios.json) levando em conta
    a pergunta atual expandida e o contexto herdado da conversa.
    """
    if not query:
        return []

    expanded_q = expandir_consulta_academica(query)
    norm_q = normalizar_texto(expanded_q)
    q_words = [w for w in norm_q.split() if len(w) > 1 and w not in STOP_WORDS]
    q_tokens = set(q_words)

    ctx = contexto_conversa or {}
    ent = extrair_entidades_consulta(query)
    target_curso = ent["curso_canonico"] or ctx.get("curso_canonico")
    target_turma = ent["codigo_turma"] or ctx.get("codigo_turma")
    target_sem = ent["semestre"] or ctx.get("semestre")
    target_disc = ent["disciplina_detectada"] or ctx.get("disciplina_detectada")

    horarios = carregar_horarios_raw()
    scored = []

    COURSE_TO_TID_KEYS = {
        "economia": ["_ce", "eixo_comum"],
        "administracao": ["_adm", "eixo_comum"],
        "contabeis": ["_cc", "eixo_comum"],
        "contabeis_graduados": ["ccg"],
        "computacao": ["ccomp"],
        "ads": ["ads"],
        "ri": ["_ri"],
        "pp": ["_pp"],
        "rp": ["_rp"],
    }

    for h in horarios:
        score = 0
        norm_cod = normalizar_texto(h.get("codigo", ""))
        norm_curso = normalizar_texto(h.get("curso", ""))
        norm_tid = normalizar_texto(h.get("turma_id", ""))
        apelidos_norm = [normalizar_texto(a) for a in h.get("apelidos", [])]
        sem = h.get("semestre")

        for a in apelidos_norm:
            if re.search(rf"\b{re.escape(a)}\b", norm_q):
                score += 220 + (len(a) * 4)

        if target_turma and re.search(rf"\b{re.escape(target_turma)}\b", f"{norm_cod} {norm_tid} {' '.join(apelidos_norm)}"):
            score += 240

        if target_curso:
            tid_keys = COURSE_TO_TID_KEYS.get(target_curso, [])
            if any(k in norm_tid for k in tid_keys):
                # Se for Eixo Comum, pontua máximo para 1º e 2º semestres ou se a disciplina for de 1º/2º semestre (ex: Cálculo)
                if "eixo_comum" in norm_tid and target_sem and target_sem >= 3 and not (target_disc and "calculo" in target_disc):
                    score += 40
                else:
                    score += 280
            else:
                score -= 220

        if target_sem is not None and sem == target_sem:
            score += 120

        for g in h.get("grade", []):
            norm_disc = normalizar_texto(g.get("disciplina", ""))
            norm_prof = normalizar_texto(g.get("professor", ""))
            norm_sala = normalizar_texto(g.get("sala_lab", ""))

            if target_disc and target_disc in norm_disc:
                score += 220
            elif norm_disc and norm_disc in norm_q:
                score += 180
            else:
                disc_words = [w for w in norm_disc.split() if len(w) > 2 and w not in STOP_WORDS]
                common_disc = set(disc_words).intersection(q_tokens)
                if common_disc:
                    score += len(common_disc) * 45

            if norm_prof and norm_prof in norm_q:
                score += 140
            if norm_sala and norm_sala in norm_q:
                score += 110

        if score >= 80:
            scored.append((score, h))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored[:top_k]]


def buscar_requerimentos_relevantes(
    query: str = "",
    top_k: int = 2,
    apenas_alta_confianca: bool = True,
) -> List[Dict[str, Any]]:
    """
    Busca de alta precisão no catálogo de requerimentos acadêmicos:
    - Evita recomendar requerimentos desconexos quando o aluno faz apenas uma pergunta informativa
      (ex: "qual a data da prova de macroeconomia?", "qual minha sala de aula?", "quem é o professor de cálculo?").
    - Só retorna requerimentos se houver intenção procedimental/administrativa clara ou correspondência forte multi-token com o título/serviço.
    """
    if not query:
        return []

    norm_q = normalizar_texto(expandir_consulta_academica(query))
    raw_norm_q = normalizar_texto(query)

    # Verifica se é uma dúvida puramente informativa de calendário de prova ou sala/horário sem pedido de serviço
    is_pure_info_query = (
        any(k in raw_norm_q for k in ["qual a data", "quando e a prova", "qual o dia da prova", "qual a sala", "qual o horario", "quem da aula", "quem e o professor", "e a de "])
        and not any(trig in norm_q for trig in PROCEDURAL_REQ_TRIGGERS)
        and not any(k in raw_norm_q for k in ["perdi", "faltei", "conflito", "atestado", "revisao", "segunda chamada", "substitutiva", "solicitar", "requerimento", "abrir"])
    )
    if apenas_alta_confianca and is_pure_info_query:
        return []

    has_procedural_trigger = any(trig in norm_q for trig in PROCEDURAL_REQ_TRIGGERS)

    q_words = [w for w in norm_q.split() if len(w) > 2 and w not in STOP_WORDS]
    q_tokens = set(q_words)
    if not q_tokens and not has_procedural_trigger:
        return []

    GENERIC_TAG_PENALTY = {"academicos", "servicos", "financeiros", "solicitar", "aluno", "curso", "disciplinas", "provas", "horarios", "notas"}

    reqs = carregar_requerimentos_raw()
    scored = []

    for r in reqs:
        score = 0
        norm_tit = normalizar_texto(r.get("titulo", ""))
        tags = [normalizar_texto(t) for t in r.get("tags", [])]

        if norm_tit and norm_tit in norm_q:
            score += 250
        else:
            tit_words = [w for w in norm_tit.split() if len(w) > 2 and w not in STOP_WORDS]
            common_tit = set(tit_words).intersection(q_tokens)
            if len(common_tit) >= 2:
                score += len(common_tit) * 65
            elif len(common_tit) == 1:
                matched_w = list(common_tit)[0]
                if matched_w not in GENERIC_TAG_PENALTY:
                    score += 45

        for t in tags:
            if t in q_tokens and t not in GENERIC_TAG_PENALTY:
                score += 30

        # Casamentos diretos de alta precisão
        if "sptrans" in norm_q and "sptrans" in norm_tit:
            score += 250
        elif "emtu" in norm_q and "emtu" in norm_tit:
            score += 250
        elif any(k in norm_q for k in ["trancamento", "trancar"]) and "trancamento" in norm_tit:
            score += 220
        elif any(k in norm_q for k in ["assistencia financeira", "desemprego", "perda de renda", "pafe"]) and "assistencia financeira" in norm_tit:
            score += 220
        elif any(k in norm_q for k in ["aproveitamento", "dispensa", "equivalencia"]) and "dispensa de disciplina" in norm_tit:
            score += 240
        elif any(k in norm_q for k in ["conflito de prova", "duas provas no mesmo", "remarcar prova"]) and "alteracao de horario de provas" in norm_tit:
            score += 220
        elif any(k in norm_q for k in ["atestado medico", "abono de falta", "justificar falta"]) and ("abono" in norm_tit or "regime domiciliar" in norm_tit):
            score += 220
        elif any(k in norm_q for k in ["contrato de estagio", "assinar estagio", "tce", "termo de compromisso"]) and "estagio" in norm_tit:
            score += 200

        min_score = 90 if not has_procedural_trigger else 65
        if score >= min_score:
            scored.append((score, r))

    scored.sort(key=lambda x: x[0], reverse=True)

    limpos = []
    for item in scored[:top_k]:
        r = item[1]
        limpos.append({
            "id": r.get("id"),
            "titulo": r.get("titulo"),
            "tipo_de_requerimento": r.get("tipo_de_requerimento"),
            "grupo_de_atendimento": r.get("grupo_de_atendimento"),
            "valor": r.get("valor"),
            "caminho_sistema": r.get("caminho_sistema"),
            "descricao": r.get("descricao", "")[:350],
            "procedimentos": r.get("procedimentos", "")[:250],
        })
    return limpos


def filtrar_contexto_relevante(
    query: str = "",
    contexto_conversa: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Constrói o contexto fundamentado no Grafo de Conhecimento em Markdown (knowledge_graph/),
    combinando as seções Markdown mais relevantes com dados estruturados complementares quando pertinente,
    sem cascata rígida que oculte documentos.
    """
    if not query:
        return "Nenhuma consulta fornecida."

    ctx = contexto_conversa or assimilar_contexto_conversa(query)
    busca_q = ctx.get("query_contextualizada") or query

    blocos: List[str] = []

    # 1. Busca principal no Grafo de Conhecimento em Markdown (documentos/ e entidades/)
    secoes_grafo = knowledge_engine.buscar_secoes(busca_q, top_k=3, contexto_conversa=ctx)
    if secoes_grafo:
        blocos.append(
            f"=== DOCUMENTOS OFICIAIS EM MARKDOWN (KNOWLEDGE GRAPH) ===\n"
            f"{knowledge_engine.formatar_contexto_para_prompt(secoes_grafo)}"
        )

    # 2. Se envolver horário/sala de aula regular ou informações de turma, anexa também a entrada exata de horarios.json
    intencao = ctx.get("intencao")
    if intencao in ("horario_aula", None) or ctx.get("codigo_turma"):
        horarios = buscar_horarios_relevantes(busca_q, top_k=2, contexto_conversa=ctx)
        if horarios and intencao != "data_prova":
            blocos.append(
                f"=== GRADE ESTRUTURADA DE AULAS REGULARES (JSON) ===\n"
                f"{json.dumps(horarios, ensure_ascii=False, indent=2)}"
            )

    # 3. Se envolver DP / Adaptação aos sábados, inclui detalhes de cronograma de encontros aos sábados
    if ctx.get("is_dp_sabado") or "calculo" in (ctx.get("disciplina_detectada") or ""):
        dp_results = buscar_dp_sabado_relevantes(busca_q, top_k=2)
        if dp_results and ctx.get("is_dp_sabado"):
            blocos.append(
                f"=== CATÁLOGO DE DP E ADAPTAÇÃO AOS SÁBADOS ===\n"
                f"{json.dumps(dp_results, ensure_ascii=False, indent=2)}"
            )

    # 4. Requerimentos Acadêmicos — SOMENTE quando houver alta confiança / intenção procedimental
    reqs = buscar_requerimentos_relevantes(query, top_k=2, apenas_alta_confianca=True)
    if reqs:
        blocos.append(
            f"=== REQUERIMENTOS ACADÊMICOS PERTINENTES (PORTAL SISA) ===\n"
            f"{json.dumps(reqs, ensure_ascii=False, indent=2)}"
        )

    if not blocos:
        registrar_lacuna(query, motivo="nenhum_documento_encontrado")
        return "Nenhuma seção específica encontrada para os termos exatos; utilize o contexto geral e solicite esclarecimento se necessário."

    return "\n\n".join(blocos)


def gerar_system_prompt(
    query: str = "",
    contexto_conversa: Optional[Dict[str, Any]] = None,
) -> str:
    ctx = contexto_conversa or assimilar_contexto_conversa(query)
    ultima_pergunta = ctx.get("ultima_pergunta") or query
    contexto_docs = filtrar_contexto_relevante(ultima_pergunta, contexto_conversa=ctx)
    humor_info = detectar_humor_estudante(ultima_pergunta)
    ambiguidade_info = knowledge_engine.detectar_ambiguidade(ultima_pergunta, contexto_conversa=ctx)

    # Resumo explícito do estado da conversa para o LLM manter continuidade perfeita
    estado_linhas = []
    if ctx.get("curso_label"):
        estado_linhas.append(f"- **Curso Identificado na Conversa**: {ctx['curso_label']} (`{ctx['curso_canonico']}`)")
    if ctx.get("codigo_turma"):
        estado_linhas.append(f"- **Turma / Série Ativa**: `{ctx['codigo_turma'].upper()}`")
    if ctx.get("semestre"):
        estado_linhas.append(f"- **Semestre Ativo**: {ctx['semestre']}º semestre")
    if ctx.get("intencao"):
        estado_linhas.append(f"- **Intenção Ativa**: `{ctx['intencao']}`")
    if ctx.get("disciplina_detectada"):
        estado_linhas.append(f"- **Disciplina Consultada Agora**: `{ctx['disciplina_detectada']}`")
    if ctx.get("disciplina_anterior"):
        estado_linhas.append(f"- **Disciplina do Turno Anterior**: `{ctx['disciplina_anterior']}`")

    bloco_estado = "\n".join(estado_linhas) if estado_linhas else "- Primeiro turno ou curso/turma ainda não informados pelo estudante."

    bloco_ambiguidade = ""
    if ambiguidade_info.get("ambigua"):
        bloco_ambiguidade = f"""
=== ALERTA DE AMBIGUIDADE / CONTEXTO FALTANTE ===
- **Diagnóstico**: {ambiguidade_info['motivo']}
- **Como Agir**:
  1. Se os documentos acima já trouxerem as opções principais (por exemplo: um aluno do `5NA Economia` perguntou *"e a de cálculo?"* — explique com naturalidade que a grade regular do `5NA - CE` não tem Cálculo, mas informe já as datas oficiais de **Cálculo I** do 1º semestre Eixo Comum, **Cálculo II** do 2º semestre Eixo Comum e **Cálculo I/II de DP aos Sábados em 28/11/2026**, perguntando ao final qual dessas opções é o caso dele).
  2. Se a pergunta for totalmente genérica sem curso/turma (ex.: *"qual a data da minha prova?"* ou *"qual a minha sala?"*), faça uma pergunta esclarecedora direta e amigável: "{ambiguidade_info['pergunta_sugerida']}"
=================================================
"""

    return f"""Você é o **SISA (Sistema Inteligente do Sucesso Alvarista)**, o agente acadêmico autônomo oficial da **FECAP (Fundação Escola de Comércio Álvares Penteado)**.
Sua missão é compreender profundamente a necessidade do estudante, manter o fio condutor de toda a conversa e responder com autonomia, precisão e empatia, fundamentado exclusivamente na Base de Conhecimento em Markdown abaixo.

=== ESTADO ACUMULADO DA CONVERSA (MULTI-TURNO) ===
{bloco_estado}

=== TOM E HUMOR DETECTADOS DO ESTUDANTE ===
- **Estado Emocional / Estilo**: `{humor_info['humor']}`
- **Diretriz de Adaptação**: {humor_info['instrucao_tom']}
{bloco_ambiguidade}
=== BASE DE CONHECIMENTO OFICIAL EM MARKDOWN ===
{contexto_docs}
================================================

DIRETRIZES FUNDAMENTAIS DE RACIOCÍNIO E AUTONOMIA:
1. **CONTINUIDADE MULTI-TURNO (ASSIMILAÇÃO DE CONTEXTO)**:
   - Quando o estudante fizer perguntas curtas de continuação (ex.: *"e a de cálculo?"*, *"e na quarta?"*, *"qual o horário dela?"*, *"e para o matutino?"*), mantenha automaticamente o **Curso**, a **Turma/Semestre** e a **Intenção** (ex.: consultar data da Prova Oficial PO ou sala de aula) estabelecidos nas mensagens anteriores.
   - Se a nova disciplina perguntada não fizer parte daquela turma específica (por exemplo, o estudante é do `5NA Economia` e pergunta *"e a de cálculo?"*), explique de forma clara quais disciplinas compõem o `5NA - CE` e apresente imediatamente as datas de **Cálculo I** (1º semestre Eixo Comum), **Cálculo II** (2º semestre Eixo Comum) e **Cálculo em DP aos Sábados (`28/11/2026`)**, perguntando qual delas ele está cursando.

2. **COMPREENSÃO DE GÍRIAS, ABREVIAÇÕES E LINGUAGEM UNIVERSITÁRIA**:
   - Compreenda naturalmente siglas e apelidos estudantis: `econo`/`ce` (Ciências Econômicas), `ccomp`/`ccpt`/`comp` (Ciência da Computação), `ads` (Análise e Desenvolvimento de Sistemas), `adm` (Administração), `cont`/`cc` (Ciências Contábeis), `ccg` (Contábeis para Graduados), `ri` (Relações Internacionais), `pp` (Publicidade e Propaganda), `rp` (Relações Públicas), `sec` (Secretariado Executivo), `po` (Prova Oficial), `ni` (Nota Intermediária), `pedp` (Programa de Educação Dinâmica e Progressiva), `dp` (Dependência), `adapt` (Adaptação).

3. **RESPOSTAS DE PROVAS OFICIAIS (PO) E GRADES DE AULA**:
   - Sempre que informar uma **Prova Oficial (PO)**, cite: **Data exata**, **Horário** (indicando se há divisão por matrícula `Par`, `Ímpar` ou `Todos`), **Sala/Laboratório** e **Professor(a)**.
   - Lembre que em caso de **conflito de horário entre duas Provas Oficiais**, o prazo para abrir chamado no Portal do Aluno é até **09/11/2026**.

4. **RECOMENDAÇÃO DE REQUERIMENTOS SEM FALSOS POSITIVOS**:
   - **NUNCA** recomende abrir requerimento quando o estudante estiver apenas tirando uma dúvida informativa de data de prova, horário de aula, sala, professor ou funcionamento de regra acadêmica.
   - Só mencione um requerimento se o estudante precisar realizar uma ação administrativa formal (como atestado, trancamento, revisão de nota, abono de faltas, contrato de estágio, auxílio financeiro ou conflito de provas).

5. **FIDELIDADE AOS DADOS OFICIAIS**:
   - Nunca invente datas, salas, nomes de professores ou regras que não estejam na Base de Conhecimento Oficial acima.
"""


class AgenteAcademico:
    def __init__(self, model: str = None):
        self.model = model or os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")

    def _verificar_e_registrar_gap(self, entrada: Union[str, List[Dict[str, str]]], resposta: str):
        try:
            user_txt = entrada if isinstance(entrada, str) else (entrada[-1].get("content", "") if entrada else "")
            norm_resp = normalizar_texto(resposta)
            gap_signals = [
                "nao possuo essa informacao",
                "nao consta no acervo",
                "nao encontrei no catalogo",
                "nao foi possivel localizar",
            ]
            if any(sig in norm_resp for sig in gap_signals):
                registrar_lacuna(user_txt, resposta_gerada=resposta, motivo="informacao_nao_consta_no_acervo")
        except Exception as e:
            print(f"[!] Erro ao registrar gap: {e}")

    def _preparar_mensagens(
        self,
        entrada: Union[str, List[Dict[str, str]]],
        perfil_aluno: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, str]]:
        """
        Prepara a lista de mensagens para o LLM assimilando todo o histórico multi-turno
        e injetando o System Prompt com os documentos Markdown relevantes ao contexto acumulado.
        """
        ctx_conversa = assimilar_contexto_conversa(entrada, perfil_aluno=perfil_aluno)
        prompt = gerar_system_prompt(
            query=ctx_conversa.get("ultima_pergunta", ""),
            contexto_conversa=ctx_conversa,
        )
        mensagens = [{"role": "system", "content": prompt}]

        if isinstance(entrada, str):
            mensagens.append({"role": "user", "content": entrada})
        elif isinstance(entrada, list):
            # Preserva até as últimas 8 mensagens da conversa para manter o histórico completo de perguntas e respostas
            recent_history = entrada[-8:]
            for msg in recent_history:
                if isinstance(msg, dict) and "role" in msg and "content" in msg:
                    if msg["role"] != "system":
                        conteudo = str(msg["content"])
                        if msg["role"] == "assistant" and len(conteudo) > 900:
                            conteudo = conteudo[:900] + "... [resposta anterior resumida]"
                        mensagens.append({"role": msg["role"], "content": conteudo})

        return mensagens

    def _sintetizar_resposta_markdown_fallback(
        self,
        entrada: Union[str, List[Dict[str, str]]],
        perfil_aluno: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Síntese determinística fundamentada diretamente nas seções recuperadas do Grafo de Conhecimento em Markdown
        caso todos os modelos da Groq atinjam temporariamente o limite de taxa (429 Rate Limit) em rajadas de requisições.
        """
        ctx = assimilar_contexto_conversa(entrada, perfil_aluno=perfil_aluno)
        query_busca = ctx.get("query_contextualizada") or ctx.get("ultima_pergunta", "")
        if is_greeting_message(query_busca):
            nome = ""
            if perfil_aluno and isinstance(perfil_aluno, dict):
                nome_c = str(perfil_aluno.get("name") or perfil_aluno.get("nome") or "").strip()
                if nome_c:
                    nome = f", **{nome_c.split()[0]}**"
            return (
                f"Olá{nome}! 👋 Sou o **SISA (Assistente de Inteligência Artificial)** da FECAP.\n\n"
                "Como posso ajudar você hoje?\n\n"
                "• 📅 **Horários e Salas de Aula** da sua turma\n"
                "• 📝 **Datas e Locais de Provas Oficiais (PO)**\n"
                "• 📋 **Requerimentos Acadêmicos** (abertura, taxas e prazos)\n"
                "• 💰 **Bolsas de Estudo & Financeiro** (PAFE, Restituível, Mérito)\n"
                "• 📖 **Regulamentos, Estágio Supervisionado e Manuais de PEDP**"
            )
        secoes = knowledge_engine.buscar_secoes(query_busca, top_k=3, contexto_conversa=ctx)
        amb = knowledge_engine.detectar_ambiguidade(ctx)

        partes = ["### Orientação Acadêmica SISA FECAP\n"]
        if amb and amb.get("ambigua"):
            partes.append(f"**Nota Contextual**: {amb.get('motivo', '')}\n\n{amb.get('pergunta_sugerida', '')}\n")
        for s in secoes:
            partes.append(f"#### {s.get('titulo_nota', 'Documento Oficial')} — {s.get('header', '')}\n{s.get('content', '')}\n")
        return "\n".join(partes).strip()

    def run(
        self,
        entrada: Union[str, List[Dict[str, str]]],
        perfil_aluno: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Executa o agente de forma autônoma com fallback resiliente entre modelos."""
        mensagens = self._preparar_mensagens(entrada, perfil_aluno=perfil_aluno)
        if not os.getenv("GROQ_API_KEY") or not getattr(client, "api_key", None):
            return self._sintetizar_resposta_markdown_fallback(entrada, perfil_aluno=perfil_aluno)

        modelos = [
            self.model,
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
        ]
        modelos_unicos = list(dict.fromkeys(modelos))
        ultimo_erro = None

        for mod in modelos_unicos:
            try:
                max_tok = 650 if "qwen" in mod else 900
                completion = client.chat.completions.create(
                    model=mod,
                    messages=mensagens,
                    temperature=0.2,
                    max_tokens=max_tok,
                )
                resp = completion.choices[0].message.content or ""
                # Remove blocos <think>...</think> caso algum modelo raciocine em tags
                resp = re.sub(r"<think>.*?</think>", "", resp, flags=re.DOTALL).strip()
                if not resp:
                    continue
                self._verificar_e_registrar_gap(entrada, resp)
                return resp
            except Exception as e:
                ultimo_erro = e
                err_str = str(e).lower()
                if any(k in err_str for k in ["429", "413", "503", "500", "502", "capacity", "rate_limit", "tokens", "model_not_found", "overloaded", "tier", "internal_server_error", "timeout"]):
                    print(f"[!] Groq aviso no modelo {mod}: {e}. Tentando fallback...")
                    continue
                raise e

        return self._sintetizar_resposta_markdown_fallback(entrada, perfil_aluno=perfil_aluno)

    def run_stream(
        self,
        entrada: Union[str, List[Dict[str, str]]],
        perfil_aluno: Optional[Dict[str, Any]] = None,
    ) -> Generator[str, None, None]:
        """Gera a resposta em streaming token por token."""
        mensagens = self._preparar_mensagens(entrada, perfil_aluno=perfil_aluno)
        modelos = [
            self.model,
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
        ]
        modelos_unicos = list(dict.fromkeys(modelos))

        if not os.getenv("GROQ_API_KEY") or not getattr(client, "api_key", None):
            yield self._sintetizar_resposta_markdown_fallback(entrada, perfil_aluno=perfil_aluno)
            return

        for mod in modelos_unicos:
            try:
                response_stream = client.chat.completions.create(
                    model=mod,
                    messages=mensagens,
                    temperature=0.2,
                    max_tokens=850,
                    stream=True,
                )
                for chunk in response_stream:
                    if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
                return
            except Exception as e:
                err_str = str(e).lower()
                if any(k in err_str for k in ["429", "413", "503", "500", "502", "capacity", "rate_limit", "tokens", "model_not_found", "overloaded", "tier", "internal_server_error"]):
                    continue
                raise e

    def get_requerimentos(self) -> List[Dict[str, Any]]:
        return carregar_requerimentos_raw()

    def get_horarios(self) -> List[Dict[str, Any]]:
        return carregar_horarios_raw()

    def get_documentos(self) -> List[Dict[str, Any]]:
        caminho = os.path.join(os.path.dirname(__file__), "documentosASA.json")
        try:
            with open(caminho, "r", encoding="utf-8") as file:
                data = json.load(file)
                return data.get("documentos", [])
        except Exception:
            return []

    def get_sugestoes(self) -> List[str]:
        return [
            "Qual a data da prova de Macroeconomia do 5NA Econo?",
            "Quando é a prova oficial de DP aos sábados?",
            "Qual o horário das provas oficiais de Ciência da Computação?",
            "Como funciona o cálculo de média (NI, PO e PEDP)?",
            "Quais as bolsas de estudo disponíveis na FECAP?",
            "Como solicitar auxílio financeiro em caso de desemprego (PAFE)?",
        ]


agente_academico = AgenteAcademico()
