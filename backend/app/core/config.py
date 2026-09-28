from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "Tracker API"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/tracker_db"

    # Supabase Auth
    SUPABASE_URL: str = "https://example.supabase.co"
    SUPABASE_KEY: str = "example-anon-key"
    SUPABASE_JWT_SECRET: str = "example-jwt-secret"

    # CORS
    BACKEND_CORS_ORIGINS: list[str] | str = [
        "http://localhost:3100",
        "http://127.0.0.1:3100",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)


settings = Settings()
