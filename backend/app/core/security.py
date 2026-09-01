import secrets
import datetime
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models.session import Session as SessionModel
from app.models.user import User

import hashlib
import hmac

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000,
    ).hex()
    return f"{salt}${pwd_hash}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password or "$" not in hashed_password:
        return False
    salt, stored_hash = hashed_password.split("$", 1)
    computed_hash = hashlib.pbkdf2_hmac(
        "sha256",
        plain_password.encode("utf-8"),
        salt.encode("utf-8"),
        100000,
    ).hex()
    return hmac.compare_digest(computed_hash, stored_hash)


SESSION_TTL_DAYS = 30


def _normalize_utc(dt: datetime.datetime) -> datetime.datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc)


def create_session(db: DBSession, user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    session = SessionModel(
        user_id=user_id,
        token=token,
        expires_at=_normalize_utc(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=SESSION_TTL_DAYS)),
    )
    db.add(session)
    db.commit()
    return token


def get_current_user(
    authorization: str | None = Header(default=None),
    db: DBSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    session = db.query(SessionModel).filter(SessionModel.token == token).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token")
    if _normalize_utc(session.expires_at) < datetime.datetime.now(datetime.timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_user_from_token(db: DBSession, token: str) -> User | None:
    session = db.query(SessionModel).filter(SessionModel.token == token).first()
    if not session or _normalize_utc(session.expires_at) < datetime.datetime.now(datetime.timezone.utc):
        return None
    return db.query(User).filter(User.id == session.user_id).first()
