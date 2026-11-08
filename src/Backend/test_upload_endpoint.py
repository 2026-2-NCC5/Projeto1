import io
import sys
sys.stdout.reconfigure(encoding='utf-8')
from fastapi.testclient import TestClient
from server import app
from pypdf import PdfWriter

client = TestClient(app)

print("=== TESTANDO ENDPOINT ADMINISTRATIVO DE UPLOAD RAG ===")

# Cria um PDF em memória
writer = PdfWriter()
page = writer.add_blank_page(width=200, height=200)

# Para ter texto extraível, podemos usar um PDF existente da pasta DocumentosASA para teste
import os
existing_pdf = os.path.join("backend", "DocumentosASA", "Programa_de_Assistencia_Financeira_Educacional.pdf")

if os.path.exists(existing_pdf):
    with open(existing_pdf, "rb") as f:
        file_bytes = f.read()

    files = {
        "file": ("Regulamento_Teste_Admin_2026.pdf", file_bytes, "application/pdf")
    }
    data = {
        "title": "Regulamento Teste Administrativo 2026",
        "category": "Regulamentos e Normas",
        "role_target": "Todos",
        "description": "Documento de teste para validação de upload e indexação dinâmica."
    }

    res = client.post("/api/admin/documents/upload", files=files, data=data)
    print("Status code:", res.status_code)
    print("Response:", res.json())
    assert res.status_code == 200, f"Erro status: {res.status_code}"
    res_data = res.json()
    assert res_data["status"] == "success"
    assert res_data["chunks_indexados"] > 0
    print(f"\n[OK] Documento enviado e indexado com sucesso! Chunks novos: {res_data['chunks_indexados']}, Total no RAG: {res_data['total_chunks_rag']}")

    # Testa listagem
    res_list = client.get("/api/documentos")
    print(f"[OK] Listagem de documentos retornou {res_list.json()['total']} documentos via {res_list.json()['source']}.")
else:
    print("PDF de teste não encontrado para simulação.")
