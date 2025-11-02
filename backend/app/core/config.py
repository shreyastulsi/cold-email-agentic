"""Configuration settings loaded from environment variables."""
from dataclasses import dataclass
from typing import Optional
import os
from pathlib import Path
from dotenv import load_dotenv

# Get the backend directory (parent of app directory)
BACKEND_DIR = Path(__file__).parent.parent.parent
ENV_FILE = BACKEND_DIR / ".env"

# Load .env file from backend directory
load_dotenv(dotenv_path=ENV_FILE)


@dataclass
class Settings:
    """Application settings."""
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://app:app@db:5432/app")
    
    # Supabase
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    supabase_jwt_secret: str = os.getenv("SUPABASE_JWT_SECRET", "")
    
    # Unipile
    base_url: str = os.getenv("BASE_URL", "")
    unipile_api_key: str = os.getenv("UNIPILE_API_KEY", "")
    unipile_account_id: str = os.getenv("UNIPILE_ACCOUNT_ID", "")
    
    # Apollo
    apollo_api_key: str = os.getenv("APOLLO_API_KEY", "")
    
    # SMTP
    smtp_server: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_username: str = os.getenv("SMTP_USERNAME", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    from_email: str = os.getenv("FROM_EMAIL", "")
    
    # OpenAI (for ResumeMessageGenerator)
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    
    # API
    api_v1_prefix: str = "/api/v1"
    cors_origins: list = None
    
    def __post_init__(self):
        if self.cors_origins is None:
            cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173")
            # Split by comma and strip whitespace
            self.cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]
            # Ensure localhost:5173 is always included
            if "http://localhost:5173" not in self.cors_origins:
                self.cors_origins.append("http://localhost:5173")


settings = Settings()

