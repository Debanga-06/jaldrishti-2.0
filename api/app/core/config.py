"""Application Settings and Environment Configuration for JALDRISHTI."""

import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env" if os.path.exists(".env") else None,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # General Project
    PROJECT_NAME: str = "JALDRISHTI"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "India's Real-Time Urban Flood Digital Twin & Safe Mobility Intelligence Platform"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Security
    SECRET_KEY: str = "temporary_secret_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Database Configuration (MongoDB Atlas & Fallbacks)
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "jaldrishti"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/jaldrishti"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/jaldrishti"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    # Redis Cache & Message Broker
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS Origins
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://localhost:3000",
        "https://localhost:5173",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return []

    # Domain Geographic Metadata (Barasat Municipality)
    MUNICIPALITY_NAME: str = "Barasat Municipality"
    MUNICIPALITY_CODE: str = "BARASAT_WB"
    DEFAULT_LATITUDE: float = 22.7214
    DEFAULT_LONGITUDE: float = 88.4821
    CRS_DEFAULT: str = "EPSG:4326"
    CRS_PROJECTED: str = "EPSG:32645"

    # Default Mode
    DEFAULT_OPERATION_MODE: str = "LIVE"

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "JSON"


settings = Settings()
