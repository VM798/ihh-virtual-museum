"""Application settings, read from environment variables."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env")


class Settings(BaseModel):
    app_name: str = "IHH Virtual Museum API"
    version: str = "1.0.0"
    data_dir: Path = BACKEND_DIR / "data"
    frontend_dist: Path = REPO_DIR / "frontend" / "dist"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    docent_model: str = "gpt-5.4-mini"
    annotation_model: str = "gpt-5.4"
    docent_enabled: bool = True


@lru_cache
def get_settings() -> Settings:
    overrides: dict = {}
    if os.getenv("IHH_DATA_DIR"):
        overrides["data_dir"] = Path(os.environ["IHH_DATA_DIR"])
    if os.getenv("IHH_FRONTEND_DIST"):
        overrides["frontend_dist"] = Path(os.environ["IHH_FRONTEND_DIST"])
    if os.getenv("IHH_CORS_ORIGINS"):
        overrides["cors_origins"] = [o.strip() for o in os.environ["IHH_CORS_ORIGINS"].split(",") if o.strip()]
    if os.getenv("IHH_DOCENT_MODEL"):
        overrides["docent_model"] = os.environ["IHH_DOCENT_MODEL"]
    if os.getenv("IHH_ANNOTATION_MODEL"):
        overrides["annotation_model"] = os.environ["IHH_ANNOTATION_MODEL"]
    if os.getenv("IHH_DOCENT_ENABLED"):
        overrides["docent_enabled"] = os.environ["IHH_DOCENT_ENABLED"].lower() in {"1", "true", "yes"}
    return Settings(**overrides)
