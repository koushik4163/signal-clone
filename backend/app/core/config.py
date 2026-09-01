import os


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


DATABASE_URL = os.getenv("DATABASE_URL")
DB_ECHO = _as_bool(os.getenv("DB_ECHO"), False)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
ENABLE_REDIS = _as_bool(os.getenv("ENABLE_REDIS"), False)
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")
STORAGE_BUCKET = os.getenv("STORAGE_BUCKET", "signal-clone-uploads")
UPLOAD_DIR = os.getenv(
    "UPLOAD_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads"),
)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


def get_database_url() -> str:
    if DATABASE_URL:
        return DATABASE_URL
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(base_dir, "signal_clone.db")
    return f"sqlite:///{db_path}"
