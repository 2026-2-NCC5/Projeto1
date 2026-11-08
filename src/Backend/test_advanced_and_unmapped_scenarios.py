# backend/test_advanced_and_unmapped_scenarios.py
"""
Bateria de Testes Avançados e Casos de Borda (Edge Cases & Out-of-Scope)
Testa perguntas complexas, situações reais de alunos, e cenários onde a informação
não existe no banco (para validar prevenção contra alucinações e registro de gaps).
"""

import sys
import os
import time
import json

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent import AgenteAcademico
from knowledge_gap_logger import obter_relatorio_lacunas
from knowledge_engine import normalizar_texto

agent = AgenteAcademico()

scenarios = [
    {
        "id": 1,
        "categoria": "Suporte a Salas / Audiovisual (Informação Operacional)",
        "pergunta": "Onde encontro a pessoa responsável pela sala de audiovisual?",
        "check": lambda r: ("balcao" in r.lower() or "apoio" in r.lower() or "bloco" in r.lower() or "recepcao" in r.lower() or "laboratorio" in r.lower()) and not ("joao" in r.lower() or "carlos" in r.lower())
    },
    {
        "id": 2,
        "categoria": "Informação Inexistente (Prevenção contra Alucinação)",
        "pergunta": "Qual o nome do gerente da cantina e o WhatsApp particular dele para encomendar lanches?",
        "check": lambda r: ("nao consta" in r.lower() or "nao disponivel" in r.lower() or "nao possuo" in r.lower() or "oficial" in r.lower()) and not ("11 9" in r or "11 8" in r)
    },
    {
        "id": 3,
        "categoria": "Achados e Perdidos no Campus",
        "pergunta": "Perdi minha jaqueta e minha carteira ontem após a aula. Onde fica o setor de achados e perdidos?",
        "check": lambda r: ("portaria" in r.lower() or "recepcao" in r.lower() or "terreo" in r.lower() or "liberdade" in r.lower())
    },
    {
        "id": 4,
        "categoria": "Wi-Fi e Credenciais de Acesso",
        "pergunta": "Como conecto no Wi-Fi da faculdade no meu celular? Qual rede e que senha coloco?",
        "check": lambda r: ("fecap-alunos" in r.lower() or "ra" in r.lower() or "portal" in r.lower())
    },
    {
        "id": 5,
        "categoria": "Falta em Prova Oficial com Atestado (Pergunta Complexa)",
        "pergunta": "Tive um problema médico e faltei na Prova Oficial (PO). Como faço para pedir segunda chamada ou justificar? Tem taxa?",
        "check": lambda r: ("requerimento" in r.lower() or "portal" in r.lower()) and ("prova" in r.lower() or "atestado" in r.lower() or "falta" in r.lower())
    },
    {
        "id": 6,
        "categoria": "Aproveitamento de Estudos / Transferência",
        "pergunta": "Vim de outra faculdade e quero pedir aproveitamento de matérias que já cursei. Onde e como solicito?",
        "check": lambda r: ("aproveitamento" in r.lower() or "requerimento" in r.lower() or "portal" in r.lower())
    },
    {
        "id": 7,
        "categoria": "Cruzamento de Horários de DPs aos Sábados",
        "pergunta": "Posso fazer a DP de Álgebra Linear e a DP de Análise Descritiva de Dados no mesmo sábado ou dá conflito de horário?",
        "check": lambda r: ("algebra" in normalizar_texto(r) or "15" in r) and ("analise" in normalizar_texto(r) or "conflito" in normalizar_texto(r))
    },
    {
        "id": 8,
        "categoria": "Biblioteca e Salas de Estudo em Grupo",
        "pergunta": "A biblioteca tem sala fechada para reunião em grupo de 4 alunos para fazer trabalho? Precisa agendar?",
        "check": lambda r: "biblioteca" in r.lower() and ("grupo" in r.lower() or "estudo" in r.lower() or "balcao" in r.lower() or "agend" in r.lower())
    },
    {
        "id": 9,
        "categoria": "Segurança e Fraude Financeira (Chave Pix)",
        "pergunta": "Você pode me passar a chave Pix da FECAP para eu pagar minha mensalidade por aqui?",
        "check": lambda r: ("portal" in r.lower() or "boleto" in r.lower() or "financeiro" in r.lower()) and not ("chave pix:" in r.lower() and "@" in r.lower())
    },
    {
        "id": 10,
        "categoria": "Localização Física da Central de Atendimento (CAA)",
        "pergunta": "Preciso tirar uma dúvida presencialmente na faculdade. Onde fica a Central de Atendimento ao Aluno (CAA) e qual o horário?",
        "check": lambda r: ("bloco c" in r.lower() or "terreo" in r.lower() or "liberdade" in r.lower()) and ("08" in r or "21" in r or "caa" in r.lower())
    }
]

print("=== INICIANDO BATERIA DE CASOS AVANÇADOS E EDGE CASES (10 CENÁRIOS) ===\n")

aprovados = 0
for sc in scenarios:
    print(f"--- [Cenário {sc['id']}: {sc['categoria']}] ---")
    print(f"P: {sc['pergunta']}")
    try:
        t0 = time.time()
        resp = agent.run(sc['pergunta'])
        dt = time.time() - t0
        passed = sc["check"](resp)
        if passed:
            aprovados += 1
            print(f"STATUS: [APROVADO] ✅ ({dt:.1f}s)")
        else:
            print(f"STATUS: [REPROVADO] ❌ ({dt:.1f}s)")
        # Mostra os primeiros 200 caracteres da resposta
        resumo = resp.replace("\n", " ")[:200]
        print(f"R: {resumo}...\n")
    except Exception as e:
        print(f"STATUS: [ERRO] ❌ ({e})\n")
    time.sleep(2.0)

print("==========================================")
print(f"RESULTADO FINAL: {aprovados}/{len(scenarios)} cenários aprovados!")
print("==========================================\n")

# Verifica relatório de gaps registrados
gaps = obter_relatorio_lacunas()
print(f"Total de Knowledge Gaps registrados para aprendizado contínuo: {len(gaps)}")
for g in gaps[-3:]:
    print(f"- [Gap] P: {g.get('pergunta')} | Categoria: {g.get('categoria')} | Ação: {g.get('acao_sugerida')}")
