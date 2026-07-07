# actuai_backend/Dockerfile — container image for the ActuAI backend.
#
# Build context is the BACKEND folder:
#     docker build -t actuai-backend ./actuai_backend
#
# We use plain pip (no uv) to install the dependencies declared in
# requirements.txt, then run uvicorn from the src/ directory (the import root) —
# same approach as actuai_mock_data's Dockerfile, to keep the image lightweight
# and not depend on the workspace's uv tooling at runtime.

FROM python:3.13-slim

# psycopg[binary] ships wheels, but keep build-essential for any source builds.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Install dependencies first (better layer caching).
COPY requirements.txt ./
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 2) Copy the source.
COPY src ./src

# Run from the import root so `import main`, `import agents...` resolve.
WORKDIR /app/src

EXPOSE 8000

# Liveness probe matches the /healthz route exposed by the API.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://localhost:8000/healthz || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
