"""
config.py — Central configuration for the ActuAI backend.

This is the single source of truth for runtime settings. It keeps the rich
configuration surface of the original ActuAI backend (JWT, multi-provider LLMs,
CORS, polling) but aligns the *names* of the infrastructure variables with the
team convention used in the rest of the workspace:

    DATABASE_URL_BACKEND   -> sync PostgreSQL DSN of the relational datalake
    QDRANT_URL             -> URL of the Qdrant vector database

Everything reads from the global ``.env`` at the repository root (uv workspace).
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Locate the workspace-root .env no matter where the process is started from
# (e.g. `cd actuai_backend/src && uvicorn main:app`). This file lives at
# actuai_backend/src/config.py, so the repo root is three parents up.
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    # Read from the workspace .env and ignore unknown extra keys (the workspace
    # .env also holds variables for the mock_data member).
    model_config = SettingsConfigDict(
        env_file=(str(_ENV_FILE), ".env"), extra="ignore"
    )

    # ---- Runtime ----------------------------------------------------------
    ENV: Literal["dev", "staging", "prod"] = "dev"
    LOG_LEVEL: str = "INFO"

    # ---- Database (the local datalake — PostgreSQL, SYNC driver) ----------
    # psycopg2 (sync) is the workspace's chosen driver. The variable name
    # matches the team's database/connection.py contract.
    DATABASE_URL_BACKEND: str = (
        "postgresql://actuai_user:actuai_password@localhost:5432/actuai_db"
    )

    # ---- Vector database (Qdrant) — used by the RAG / Investigative agent --
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION: str = "technical_documentation"

    # ---- Mock SAP / BAPI --------------------------------------------------
    # The simulated SAP ERP (actuai_mock_data) serves the BAPI under
    # "<base>/api/bapi/...". The ETL connector adapts to this base URL.
    BAPI_BASE_URL: str = "http://localhost:8080"
    BAPI_POLL_SECONDS: int = 60          # ETL sync frequency
    ETL_AUTO_START: bool = False         # start the background ETL poller on boot?

    # ---- Authentication (JWT) --------------------------------------------
    # In v1 we sign our own JWTs. In v2 these come from an external IdP (OIDC).
    # The secret MUST be overridden in prod via the environment.
    JWT_SECRET: str = Field(default="CHANGE_ME_IN_PROD", min_length=8)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 30       # short-lived access token
    REFRESH_TOKEN_HOURS: int = 8         # matches the report's 8h MFA window

    # ---- LLM providers ----------------------------------------------------
    # Local router model (Supervisor) served by Ollama on the edge server.
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    SUPERVISOR_MODEL: str = "llama3.1:8b"

    # Cloud models for the heavy agents. Keys are injected via env, never code.
    CLOUD_LLM_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    CLOUD_LLM_API_KEY: str = ""
    TRANSACTIONAL_MODEL: str = "mistralai/mistral-nemo-12b-instruct"
    INVESTIGATIVE_MODEL: str = "meta/llama-3.1-70b-instruct"
    RESPONDER_MODEL: str = "mistralai/mistral-nemo-12b-instruct"

    # Master switch: when True, agents use deterministic stub LLMs instead of
    # real ones. Handy for CI and for running with zero external dependencies.
    USE_MOCK_LLM: bool = False

    # ---- CORS -------------------------------------------------------------
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached accessor so we build the Settings object only once per process."""
    return Settings()


# Importable singleton used across the codebase.
settings = get_settings()
