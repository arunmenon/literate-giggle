"""Application configuration."""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "ExamIQ"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./examiq.db"

    # JWT Auth
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # AI Evaluation (optional - works without it using rubric-based scoring)
    ANTHROPIC_API_KEY: Optional[str] = None

    # Boards and classes config
    SUPPORTED_BOARDS: list[str] = ["CBSE", "ICSE", "State Board"]
    SUPPORTED_CLASSES: list[int] = [7, 8, 9, 10, 11, 12]

    # Exam settings
    MAX_EXAM_DURATION_MINUTES: int = 180
    AUTO_SAVE_INTERVAL_SECONDS: int = 30

    class Config:
        env_file = ".env"


settings = Settings()
