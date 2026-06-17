from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import DirectoryPath, AnyHttpUrl

class Settings(BaseSettings):
    mock_network_drive_dir: DirectoryPath
    mock_excel_dir: DirectoryPath
    database_url: str
    webhook_target_url: AnyHttpUrl

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        extra="ignore"
    )

settings = Settings() # type: ignore