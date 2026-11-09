# 🚀 SISA FECAP - Estrutura Raiz para Deploy no Railway

Este diretório (`/src`) é a **Raiz Principal (Root Directory)** do projeto para deploy na plataforma Railway.

A arquitetura unifica o ecossistema fullstack:
- **Frontend**: Aplicativo React Native / Expo Web (`/src/Frontend`) compilado estaticamente em `/src/Frontend/dist`.
- **Backend**: API REST e Inteligência Artificial com FastAPI/Uvicorn (`/src/Backend`), que fornece os endpoints analíticos e serve a aplicação Web compilada na porta designada (`$PORT`).

---

## 📂 Estrutura de Diretórios em `/src`

```text
/src
  ├── package.json          # Orquestrador npm raiz (scripts de install, build e start)
  ├── railway.json          # Configuração de build e deploy da Railway
  ├── nixpacks.toml         # Configuração do builder Nixpacks (Node 20 + Python 3.11)
  ├── Dockerfile            # Multi-stage Dockerfile alternativo para build em container
  ├── .dockerignore         # Exclusões para build de container Docker
  ├── .env.example          # Variáveis de ambiente consolidadas para o Railway
  ├── .gitignore            # Regras de exclusão Git específicas da raiz /src
  ├── README.md             # Esta documentação
  │
  ├── Backend/              # Módulo Python (FastAPI, Groq LLM, RAG Markdown, Analytics)
  │   ├── server.py         # Servidor principal FastAPI + SPA Static Host
  │   ├── agent.py          # Agente acadêmico discente com assimilação multi-turno
  │   ├── requirements.txt  # Dependências Python
  │   ├── static/           # Interface estática legada de contingência
  │   └── ...
  │
  └── Frontend/             # Módulo React Native / Expo Web (TypeScript)
      ├── package.json      # Dependências do cliente Expo
      ├── app.json          # Metadados e manifesto Expo
      ├── src/              # Telas, rotas, componentes e serviços do app
      └── ...
```

---

## ⚙️ Configuração no Painel do Railway

Ao configurar o serviço no Railway:

1. **Root Directory**:
   Defina o valor como:
   ```text
   /src
   ```
2. **Build Type**:
   - Padrão (Recomendado): **Nixpacks** (detecta automaticamente `railway.json` e `nixpacks.toml`).
   - Alternativo: **Dockerfile** (utiliza o `Dockerfile` multi-stage presente em `/src`).

3. **Variáveis de Ambiente (Railway Variables)**:
   Preencha as variáveis baseando-se em `src/.env.example`:
   - `GROQ_API_KEY`: Chave da API Groq.
   - `GROQ_MODEL`: `qwen/qwen3.8-27b` (ou modelo homologado).
   - `SUPABASE_URL`: URL do projeto Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: Chave de serviço do Supabase.
   - `EXPO_PUBLIC_SUPABASE_URL`: Mesma URL pública do Supabase.
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Chave anônima (pública) do Supabase.
   - `EXPO_PUBLIC_GROQ_API_KEY`: Chave da Groq utilizada pelo cliente Expo.
   - `EXPO_PUBLIC_GROQ_MODEL`: `qwen/qwen3.8-27b`.
   - `FASTAPI_ENV`: `production`.

---

## 🛠️ Scripts Principais a partir de `/src`

| Comando | Descrição |
| :--- | :--- |
| `npm run build` | Compila o frontend Expo Web para a pasta `Frontend/dist` |
| `npm start` | Inicializa o servidor FastAPI servindo os endpoints `/api` e o frontend |
| `npm run install:all` | Instala dependências do Frontend (npm) e Backend (pip) |
| `npm run test:backend` | Executa os testes automatizados do backend |
