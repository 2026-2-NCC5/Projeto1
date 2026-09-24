import os
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')
import httpx
from dotenv import load_dotenv

base_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(base_dir, ".env"))

key = os.getenv("GROQ_API_KEY", "")

# Load vector store
vector_store_path = os.path.join(base_dir, "vector_store.json")
with open(vector_store_path, "r", encoding="utf-8") as f:
    vector_store = json.load(f)

query = "Como funciona o programa de bolsas restituíveis da FECAP?"

# Let's test with rag_engine
from rag_engine import rag_engine

chunks = rag_engine.buscar_chunks(query, top_k=4)
contexto_rag = rag_engine.formatar_contexto_para_prompt(chunks)

# Let's test calling Groq with the exact prompt used by groqClient.ts / agent.py
system_prompt = f"""
Você é o SISA (Sistema Inteligente do Sucesso Alvarista) e Agente de IA do aplicativo ASA da FECAP.
Sua missão primordial é orientar estudantes, pais, professores e funcionários sobre serviços acadêmicos, procedimentos, portal do aluno, documentos oficiais, canais autorizados, setores responsáveis e etapas necessárias de cada processo.

DOCUMENTOS E REGULAMENTOS OFICIAIS RECUPERADOS VIA RAG (PASTA DocumentosASA):
{contexto_rag}

DIRETRIZES FUNDAMENTAIS DE ATENDIMENTO:
1. **Base de Conhecimento Oficial & Citação de Fontes**:
   - Responda com precisão técnica baseando-se estritamente nas normas e regulamentos da FECAP.
   - Toda resposta sobre procedimentos deve citar expressamente a fonte e a data de atualização ou página:
     *(Exemplo: 📌 **Fonte**: Regulamento do Programa de Bolsas Restituíveis FECAP | DocumentosASA).*
2. **Programas Financeiros e Bolsas (ATENÇÃO RIGOROSA)**:
   - A FECAP **POSSUI SIM** o "Programa de Bolsas Restituíveis FECAP" (arquivo: Regulamento_do_Programa_de_Bolsas_Restituíveis_FECAP.pdf). Este programa permite o pagamento parcial das mensalidades da graduação durante o curso, devendo o estudante restituir/quitar o saldo restante após a conclusão da graduação.
   - A FECAP também possui separadamente o "Programa de Assistência Financeira Educacional" (PAFE), que é um benefício emergencial para continuidade de estudos em caso de desemprego, falecimento ou invalidez do responsável financeiro.
   - **NUNCA diga que a FECAP não possui programa de bolsas restituíveis!** Trata-se de um benefício oficial com regulamento próprio.
3. **Passo a Passo Prático**:
   - Organize procedimentos em etapas numeradas (Etapa 1, Etapa 2, Etapa 3).
   - Indique claramente o setor competente (ex: Central de Atendimento ao Aluno - CAA, Secretaria Geral, Financeiro, Coordenação de Curso).
"""

client = httpx.Client(verify=False)
resp = client.post(
    "https://api.groq.com/openai/v1/chat/completions",
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    json={
        "model": "qwen/qwen3.8-27b",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ],
        "temperature": 0.2
    },
    timeout=30.0
)

data = resp.json()
if "choices" in data:
    print("--- RESPOSTA DA GROQ COM O PROMPT ATUAL ---")
    print(data["choices"][0]["message"]["content"])
else:
    print("ERRO:", data)
