# =============================================================================
# Multi-stage Dockerfile para Deploy do SISA FECAP no Railway
# =============================================================================

# Estágio 1: Build do Frontend (Expo / React Native Web)
FROM node:20-slim AS frontend-builder
WORKDIR /app/Frontend

COPY Frontend/package*.json ./
RUN npm install

COPY Frontend/ ./
RUN npx expo export --platform web

# Estágio 2: Runtime do Backend (Python / FastAPI)
FROM python:3.11-slim AS runner
WORKDIR /app

# Instala dependências de compilação mínimas para pacotes C/C++ se necessário
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instala dependências do Python
COPY Backend/requirements.txt ./Backend/requirements.txt
RUN pip install --no-cache-dir -r ./Backend/requirements.txt

# Copia o código-fonte do Backend
COPY Backend/ ./Backend/

# Copia os arquivos compilados do Frontend (Expo Web dist)
COPY --from=frontend-builder /app/Frontend/dist ./Frontend/dist

# Variáveis padrão de ambiente (sobrescritas pelo Railway dinamicamente)
ENV PORT=8000 \
    HOST=0.0.0.0 \
    FASTAPI_ENV=production \
    PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["python", "Backend/server.py"]
