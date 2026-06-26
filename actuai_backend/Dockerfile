# ---- ActuAI backend image (light) ----------------------------------------
# Installs ONLY the runtime deps needed to serve the API (see
# requirements-docker.txt). The heavy RAG stack (torch/CUDA/langchain/qdrant)
# is intentionally left out so the image builds in seconds on any laptop; the
# Investigative agent uses its in-memory fallback when those aren't present.

FROM python:3.13-slim

# uv: fast installer (copied from the official image).
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# curl for the healthcheck only; all wheels are prebuilt (no compiler needed).
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install the light runtime deps (cached unless this file changes).
COPY requirements-docker.txt ./
RUN uv pip install --system --no-cache -r requirements-docker.txt

# App source. Run from src/ (the import root).
COPY src ./src
WORKDIR /app/src

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://localhost:8000/healthz || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
