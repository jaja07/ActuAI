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

_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_ENV_FILE), ".env"), extra="ignore"
    )

    # ---- Runtime ----------------------------------------------------------
    ENV: Literal["dev", "staging", "prod"] = "dev"
    LOG_LEVEL: str = "INFO"

    DATABASE_URL_BACKEND: str = (
        "postgresql+psycopg://actuai_user:actuai_password@localhost:5432/actuai_db"
    )
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION: str = "technical_documentation"

    MOCK_DOCS_DIR: str = "./actuai_mock_data/output/network_drives/Fournisseurs_Archives"

    BAPI_BASE_URL: str = "http://localhost:8080"
    BAPI_POLL_SECONDS: int = 60
    ETL_AUTO_START: bool = False

    JWT_SECRET: str = Field(default="CHANGE_ME_IN_PROD", min_length=8)

    CLOUD_LLM_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_API_KEY: str = ""
    SUPERVISOR_MODEL: str = "meta/llama-3.1-8b-instruct"
    TRANSACTIONAL_MODEL: str = "mistralai/mistral-nemotron"
    INVESTIGATIVE_MODEL: str = "meta/llama-3.1-70b-instruct"
    RESPONDER_MODEL: str = "mistralai/mistral-nemotron"

    USE_MOCK_LLM: bool = False

    # Shared secret expected in the X-Webhook-Token header of machine-to-machine
    # email ingestion calls. Empty string disables the check (dev/tests).
    WEBHOOK_SHARED_SECRET: str = ""

    # Proactive Mission-2 scan: compare open PO ETAs against assembly-line
    # drop-dead dates on every ETL tick and raise AOG alerts.
    AOG_SCAN_ENABLED: bool = True

    # Index the mock technical PDFs into Qdrant at startup (daemon thread).
    INDEX_DOCS_ON_START: bool = False

    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached accessor so we build the Settings object only once per process."""
    return Settings()

settings = get_settings()
