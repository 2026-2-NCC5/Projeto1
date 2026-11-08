# test_student_scenarios.py
import sys
import os
import time

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent import agente_academico

scenarios = [
    {
        "id": 1,
        "categoria": "Provas CCOMP 3º Semestre",
        "pergunta": "Qual a data da prova oficial de Ciência da Computação do 3º semestre?",
        "check": lambda r: "26/11" in r or "30/11" in r or "28/11" in r or "02/12" in r or "04/12" in r
    },
    {
        "id": 2,
        "categoria": "Calendário Acadêmico",
        "pergunta": "Quando começam as aulas do 2º semestre de 2026?",
        "check": lambda r: "29 de julho" in r.lower() or "29/07" in r
    },
    {
        "id": 3,
        "categoria": "Bolsa Restituível",
        "pergunta": "A FECAP tem bolsa restituível? Como funciona?",
        "check": lambda r: "possui" in r.lower() and ("restitu" in r.lower() or "pagamento" in r.lower())
    },
    {
        "id": 4,
        "categoria": "Auxílio Desemprego / PAFE",
        "pergunta": "Perdi meu emprego, tem algum auxílio financeiro da faculdade?",
        "check": lambda r: "pafe" in r.lower() or "assistência financeira" in r.lower()
    },
    {
        "id": 5,
        "categoria": "Requerimento SPTrans",
        "pergunta": "Como peço passe escolar da SPTrans ou EMTU?",
        "check": lambda r: ("sptrans" in r.lower() or "emtu" in r.lower()) and "portal" in r.lower()
    },
    {
        "id": 6,
        "categoria": "Grade Regular 3NA CCOMP",
        "pergunta": "Qual o horário e sala da aula de Análise Descritiva de Dados da turma 3NA de Computação?",
        "check": lambda r: "segunda" in r.lower() and ("504" in r or "marco aurelio" in r.lower())
    },
    {
        "id": 7,
        "categoria": "Conflito de Provas",
        "pergunta": "O que acontece se eu tiver duas provas oficiais no mesmo dia e horário?",
        "check": lambda r: "chamado" in r.lower() and "portal" in r.lower() and ("09/11" in r or "portal do aluno" in r.lower())
    },
    {
        "id": 8,
        "categoria": "DP Sábado Formandos",
        "pergunta": "Até quando formandos podem solicitar a inclusão de DP aos sábados?",
        "check": lambda r: "16 de agosto" in r or "16/08" in r
    },
    {
        "id": 9,
        "categoria": "DP Sábado Álgebra Linear",
        "pergunta": "Quem dá aula de Álgebra Linear no sábado e qual o horário?",
        "check": lambda r: "antonio noguero" in r.lower() and ("15:00" in r or "15h" in r.lower())
    },
    {
        "id": 10,
        "categoria": "Trancamento de Matrícula",
        "pergunta": "Como funciona o trancamento de matrícula e onde peço?",
        "check": lambda r: "trancamento" in r.lower() or "portal" in r.lower() or "caa" in r.lower()
    }
]

print("=== INICIANDO BATERIA DE AUDITORIA DO AGENTE (10 CENÁRIOS DE ALUNO) ===")
pass_count = 0
for s in scenarios:
    print(f"\n--- [Cenário {s['id']}: {s['categoria']}] ---")
    print(f"P: {s['pergunta']}")
    try:
        resp = agente_academico.run(s['pergunta'])
        time.sleep(1.5)
        ok = s["check"](resp)
        if ok:
            print(f"STATUS: [APROVADO] ✅")
            pass_count += 1
        else:
            print(f"STATUS: [FALHOU NO CRITÉRIO] ❌")
        print("R:", resp[:300].replace("\n", " ") + "...")
    except Exception as e:
        print(f"STATUS: [ERRO/EXCEÇÃO] ❌: {e}")

print(f"\n==========================================")
print(f"RESULTADO FINAL: {pass_count}/{len(scenarios)} cenários aprovados!")
print(f"==========================================")
