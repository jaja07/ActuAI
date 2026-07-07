from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl
from pathlib import Path

_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    mock_network_drive_dir: Path
    mock_excel_dir: Path
    database_url: str
    webhook_target_url: AnyHttpUrl
    google_api_key: str = ""

    # Secret partagé envoyé dans l'en-tête X-Webhook-Token vers le backend.
    # Vide = en-tête omis (le backend désactive alors aussi sa vérification).
    webhook_shared_secret: str = ""

    # Cadence de l'envoi automatique d'emails fournisseurs (secondes).
    email_send_enabled: bool = True
    email_send_min_seconds: int = 90
    email_send_max_seconds: int = 240

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()  # type: ignore