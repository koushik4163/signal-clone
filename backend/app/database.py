from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import get_database_url

SQLALCHEMY_DATABASE_URL = get_database_url()

engine_kwargs = {"pool_pre_ping": True}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, connection_record):
    if not str(engine.url).startswith("sqlite"):
        return
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
