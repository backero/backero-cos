from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Get the path to the root .env (parent of the 'app' folder)
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR.parent / ".env" if BASE_DIR.name == "app" else BASE_DIR / ".env"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", str(ENV_FILE)), 
        env_file_encoding="utf-8", 
        extra="ignore"
    )

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/backero_cos"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # MSG91
    MSG91_AUTH_KEY: str = ""
    MSG91_TEMPLATE_ID: str = ""
    MSG91_SENDER_ID: str = "BACKRO"

    # Interakt (WhatsApp)
    INTERAKT_API_KEY: str = ""

    # Bootstrap admin
    ADMIN_PHONE: str = "9999999999"
    ADMIN_NAME: str = "Admin User"

    # App
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


settings = Settings()
