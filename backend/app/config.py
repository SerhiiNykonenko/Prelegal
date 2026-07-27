from dataclasses import dataclass
import os
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_path: Path
    frontend_origin: str
    reset_database_on_startup: bool
    session_days: int
    secure_cookies: bool


def get_settings() -> Settings:
    root_dir = Path(__file__).resolve().parents[1]
    default_database_path = root_dir / "data" / "prelegal.db"

    return Settings(
        database_path=Path(os.getenv("DATABASE_PATH", default_database_path)),
        frontend_origin=os.getenv("FRONTEND_ORIGIN", "http://localhost:3000"),
        reset_database_on_startup=os.getenv("RESET_DATABASE_ON_STARTUP", "false").lower() == "true",
        session_days=int(os.getenv("SESSION_DAYS", "7")),
        secure_cookies=os.getenv("SECURE_COOKIES", "false").lower() == "true",
    )
