# backend/knowledge_gap_logger.py
"""
Módulo de Auditoria e Aprendizado Ativo (Active Learning / Gap Detection)
Detecta e registra perguntas de alunos cujas respostas não constam no acervo
institucional ou que demandam novos documentos / procedimentos operacionais.
"""

import os
import json
import re
from datetime import datetime
from typing import Dict, Any, List, Optional

GAPS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge_gaps.json")

def _classificar_categoria_gap(pergunta: str) -> str:
    """Classifica a pergunta em uma categoria temática de gap de conhecimento."""
    p = pergunta.lower()
    if any(k in p for k in ["audiovisual", "projetor", "datashow", "microfone", "cabo", "som", "multimidia"]):
        return "Infraestrutura / Audiovisual e Suporte a Salas"
    if any(k in p for k in ["achados e perdidos", "perdi", "esqueci", "perdeu", "encontrei"]):
        return "Campus / Achados e Perdidos"
    if any(k in p for k in ["wifi", "wi-fi", "internet", "senha", "rede"]):
        return "Tecnologia / Conectividade e Wi-Fi"
    if any(k in p for k in ["estacionamento", "carro", "moto", "parar", "vaga"]):
        return "Campus / Estacionamento e Acesso"
    if any(k in p for k in ["cantina", "restaurante", "almoco", "comida", "cafe"]):
        return "Campus / Alimentação e Serviços de Terceiros"
    if any(k in p for k in ["atletica", "festa", "trote", "bateria", "jogos"]):
        return "Vida Universitária / Entidades Estudantis"
    if any(k in p for k in ["biblioteca", "cabine", "estudo", "livro", "acervo"]):
        return "Acadêmico / Biblioteca e Recursos de Estudo"
    if any(k in p for k in ["estagio", "empresa", "convenio", "vaga de emprego"]):
        return "Carreiras / Estágio e Empregabilidade"
    return "Geral / Procedimento Não Documentado"

def registrar_lacuna(pergunta: str, resposta_gerada: str = "", contexto_utilizado: str = "", motivo: str = "contexto_insuficiente") -> Dict[str, Any]:
    """
    Registra uma dúvida do aluno não atendida ou parcialmente atendida no arquivo de auditoria.
    """
    categoria = _classificar_categoria_gap(pergunta)
    now = datetime.now().isoformat()

    registro = {
        "timestamp": now,
        "pergunta": pergunta.strip(),
        "categoria": categoria,
        "motivo": motivo,
        "resposta_resumo": resposta_gerada[:250] if resposta_gerada else "",
        "status": "pendente_de_documentacao",
        "acao_sugerida": f"Verificar necessidade de incluir FAQ ou instrução formal sobre '{categoria}' no acervo."
    }

    gaps: List[Dict[str, Any]] = []
    if os.path.exists(GAPS_FILE):
        try:
            with open(GAPS_FILE, "r", encoding="utf-8") as f:
                gaps = json.load(f)
        except Exception:
            gaps = []

    # Evita duplicação exata recente
    duplicado = False
    for item in gaps[-20:]:
        if item.get("pergunta", "").lower() == pergunta.strip().lower():
            duplicado = True
            break

    if not duplicado:
        gaps.append(registro)
        try:
            with open(GAPS_FILE, "w", encoding="utf-8") as f:
                json.dump(gaps, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[!] Erro ao salvar knowledge gap: {e}")

    return registro

def obter_relatorio_lacunas() -> List[Dict[str, Any]]:
    """Lê todas as lacunas registradas."""
    if not os.path.exists(GAPS_FILE):
        return []
    try:
        with open(GAPS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []
