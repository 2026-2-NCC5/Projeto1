# 🎓 SISA FECAP - Backend (Assistente Acadêmico Inteligente & Analytics)

Módulo Backend de Inteligência Artificial, Knowledge Graph (Markdown-First) e API REST/Streaming (FastAPI) para o ecossistema SISA / ASA FECAP.

## 📁 Estrutura de Arquivos

* `server.py`: API FastAPI principal com endpoints REST, SSE (Server-Sent Events), upload e integração com Supabase.
* `agent.py`: Agente conversacional do discente com assimilação multi-turno de contexto, detecção de humor, extração de entidades e regras institucionais.
* `student_risk_agent.py`: Agente analítico de evasão estudantil (Score 4D) para coordenadores e atendentes do ASA.
* `knowledge_engine.py`: Motor de busca semântica em grafo sobre os 40+ documentos e regulamentos institucionais em Markdown.
* `knowledge_manager.py`: Pipeline dinâmico de ingestão de novos documentos e atualização contínua da base de conhecimento.
* `knowledge_gap_logger.py`: Registro persistente de lacunas de conhecimento e dúvidas não resolvidas (*knowledge gaps*).
* `ml_student_risk.py`: Treinamento e cálculo do modelo preditivo de retenção discente (Score 4D).
* `migrate_to_supabase.py`: Script de carga, sincronização e seeding das tabelas acadêmicas no Supabase PostgreSQL.
* `setup_storage_buckets.py`: Criação e configuração de políticas dos buckets no Supabase Storage.
* `main.py`: Ponto de entrada CLI alternativo para execução do servidor.
* `horarios.json` & `horarios_dp_sabado.json`: Catálogo completo de turmas, disciplinas, salas e horários regulares e de DPs da FECAP.
* `requerimentos.json`: Catálogo oficial de requerimentos acadêmicos, prazos de SLA e instruções de abertura.
* `documentosASA.json`: Catálogo indexado de regulamentos, manuais PEDP e resoluções institucionais.
* `knowledge_graph/`: Base de conhecimento em Markdown estruturada por documentos, normas e entidades.
* `dados_ficticios/`: Planilhas sintéticas (Contato, Financeiro, Histórico, Matrículas, Relacionamentos) para testes e treinamento.
* `DocumentosASA/`: Coleção dos PDFs institucionais oficiais da FECAP.
* `frontend_examples/`: Exemplos de integração para interfaces Web (React, SSE, Fetch).
* `static/`: Interface Web de teste local (`http://localhost:8000`).

## 🚀 Como Executar

### 1. Instalar Dependências
```bash
pip install -r requirements.txt
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` e preencha suas variáveis:
```bash
cp .env.example .env
```

### 3. Iniciar o Servidor
```bash
python server.py
```
O servidor iniciará em `http://127.0.0.1:8000`. Acesse a documentação Swagger interativa em `http://127.0.0.1:8000/docs`.

### 4. Executar os Testes Automatizados
```bash
python -m unittest test_full_validation_suite.py
```
