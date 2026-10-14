# ============================================================
# SISA – Dockerfile para a API de Previsão de Evasão
# ============================================================
FROM python:3.13-slim

# Evitar prompts interativos e buffering
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Instalar dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código e modelo
COPY models/ ./models/
COPY app/    ./app/
COPY data/   ./data/

# Porta da API
EXPOSE 8000

# Iniciar o servidor
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
