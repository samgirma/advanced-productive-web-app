import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application configuration loaded from backend/.env or system environment variables.
    Pydantic automatically validates types and reads environment variables.
    """
    APP_NAME: str = "Productive API"
    SECRET_KEY: str = "super_secret_development_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    DATABASE_URL: str = "sqlite:///./productive.db"

    UPLOAD_DIR: str = "./uploads"
    MAX_IMAGE_SIZE_MB: int = 10
    MAX_VIDEO_SIZE_MB: int = 50

    # Frontend URLs allowed to call our API with credentials (cookies)
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # AI Configuration (Stage 2 & 3)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"

    # Webhook Secret (Stage 3)
    N8N_WEBHOOK_SECRET: str = "dev_n8n_secret_token_12345"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = {
        "env_file": ".env",
        "extra": "ignore",
    }


settings = Settings()
