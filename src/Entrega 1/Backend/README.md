# 🎓 SISA FECAP - Backend (Assistente Acadêmico Inteligente)

Módulo Backend de Inteligência Artificial e RAG (Retrieval-Augmented Generation) para o aplicativo ASA FECAP.

## 📁 Estrutura de Arquivos

* `server.py`: API FastAPI com endpoints REST e Streaming Server-Sent Events (SSE).
* `agent.py`: Agente de IA com regras de negócio, prompts da FECAP e ferramentas.
* `rag_engine.py`: Motor de busca vetorial semântica e cálculo de similaridade por cosseno.
* `embeddings.py`: Geração de vetores densos usando modelos rápidos e otimizados (`fastembed`).
* `chunker.py`: Processamento, limpeza e fatiamento semântico dos PDFs oficiais.
* `ingest_docs.py`: Pipeline de ingestão que lê a pasta `DocumentosASA/`, extrai textos e sincroniza bases.
* `generate_embeddings.py`: Gera os vetores e salva em `vector_store.json` (backend e frontend).
* `main.py`: Ponto de entrada CLI e servidor web.
* `notebook_algebra_linear_arregasa.ipynb`: Caderno Jupyter demonstrando a matemática vetorial e álgebra linear aplicada.
* `DocumentosASA/`: Coleção dos PDFs e regulamentos oficiais da instituição.
* `frontend_examples/`: Exemplos de integração para frontends web (React, Fetch, SSE).
* `static/`: Interface Web rápida para testes locais do backend (`http://localhost:8000`).

## 🚀 Como Executar

### 1. Instalar Dependências
```bash
pip install -r requirements.txt
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` e configure sua chave da Groq:
```bash
cp .env.example .env
```

### 3. Iniciar o Servidor
```bash
python server.py
# ou
python main.py
```
Acesse a documentação Swagger interativa em: `http://localhost:8000/docs`

### 4. Reindexar Documentos (opcional)
```bash
python ingest_docs.py
```
