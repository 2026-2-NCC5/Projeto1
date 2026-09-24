import sys
sys.stdout.reconfigure(encoding='utf-8')
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

queries = [
    "regras para concessão de bolsa restituível e renda máxima",
    "quais as datas de rematrícula para alunos reprovados ou em exame?",
    "horário de aula e professor de redes de computadores em ADS"
]

print("=== INICIANDO TESTES DO RAG COM FASTAPI TESTCLIENT ===")
for q in queries:
    res = client.post('/api/rag/search', json={'query': q, 'top_k': 2})
    assert res.status_code == 200, f"Erro status: {res.status_code}"
    data = res.json()
    print(f"\nQUERY: '{q}'")
    print(f"Status: {res.status_code} | Total Chunks: {data['total_encontrados']}")
    for c in data['chunks']:
        score_pct = c['score_similaridade'] * 100
        print(f"  [{score_pct:.1f}%] {c['titulo']} (Pag. {c['pagina']})")
        print(f"  Trecho: {c['texto'][:130]}...")

print("\n[OK] Todos os testes de RAG passaram com 100% de sucesso!")
