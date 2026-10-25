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

    # Environment detection
    VERCEL: bool = os.getenv("VERCEL") == "1"

    DATABASE_URL: str = "/tmp/productive.db" if os.getenv("VERCEL") == "1" else "sqlite:///./productive.db"

    UPLOAD_DIR: str = "/tmp/uploads" if os.getenv("VERCEL") == "1" else "./uploads"
    MAX_IMAGE_SIZE_MB: int = 10
    MAX_VIDEO_SIZE_MB: int = 50

    # Frontend URLs allowed to call our API with credentials (cookies)
    # Accepts comma-separated list or "*"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Cookie settings for cross-site deployments
    COOKIE_SECURE: bool = os.getenv("VERCEL") == "1"
    COOKIE_SAMESITE: str = "none" if os.getenv("VERCEL") == "1" else "lax"

    # AI Configuration (Stage 2 & 3)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"

    # Webhook Secret (Stage 3)
    N8N_WEBHOOK_SECRET: str = "dev_n8n_secret_token_12345"
    CHROMA_PERSIST_DIR: str = "/tmp/chroma_db" if os.getenv("VERCEL") == "1" else "./chroma_db"

    @property
    def cors_origins_list(self) -> List[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = {
        "env_file": ".env",
        "extra": "ignore",
    }


settings = Settings()
if settings.VERCEL:
    # On Vercel, guarantee writable /tmp directories even if .env is bundled
    if settings.DATABASE_URL == "sqlite:///./productive.db":
        settings.DATABASE_URL = "sqlite:////tmp/productive.db"
    if settings.UPLOAD_DIR == "./uploads":
        settings.UPLOAD_DIR = "/tmp/uploads"
    if settings.CHROMA_PERSIST_DIR == "./chroma_db":
        settings.CHROMA_PERSIST_DIR = "/tmp/chroma_db"

if settings.DATABASE_URL.startswith("/"):
    # Convert bare path to sqlite URL format
    settings.DATABASE_URL = f"sqlite:///{settings.DATABASE_URL}"

