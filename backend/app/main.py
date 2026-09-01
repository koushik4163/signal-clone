from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import ENABLE_REDIS
from app.core.logging import configure_logging
from app.database import Base, engine
from app import models  # noqa: F401 - ensures all models are registered on Base.metadata
from app.routers import auth, users, contacts, conversations, messages, ws, upload

configure_logging()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Signal Clone API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(contacts.router)
app.include_router(conversations.router)
app.include_router(messages.router)
app.include_router(ws.router)
app.include_router(upload.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
