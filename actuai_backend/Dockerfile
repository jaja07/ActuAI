# actuai_backend/Dockerfile — container image for the ActuAI backend.
#
# Build context is the BACKEND folder:
#     docker build -t actuai-backend ./actuai_backend
#
# We use uv (fast, reproducible) to install the dependencies declared in
# pyproject.toml, then run uvicorn from the src/ directory (the import root).

FROM python:3.13-slim

# uv: a fast drop-in replacement for pip/venv (copied from the official image).
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# psycopg2-binary ships wheels, but keep build-essential for any source builds.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Install dependencies first (better layer caching).
COPY pyproject.toml ./
RUN uv pip install --system --no-cache -r pyproject.toml

# 2) Copy the source.
COPY src ./src

# Run from the import root so `import main`, `import agents...` resolve.
WORKDIR /app/src

EXPOSE 8000

# Liveness probe matches the /healthz route exposed by the API.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://localhost:8000/healthz || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
