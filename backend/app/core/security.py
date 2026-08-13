import secrets
import datetime
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models.session import Session as SessionModel
from app.models.user import User

# --- Dynamic OTP store (in-memory) ---
FIXED_OTP = "123456"
_otp_requests: dict[str, str] = {}


def issue_otp(phone_number: str) -> str:
    key = phone_number.strip().lower()
    otp = f"{secrets.randbelow(900000) + 100000:06d}"
    _otp_requests[key] = otp
    return otp


def check_otp(phone_number: str, otp: str) -> bool:
    key = phone_number.strip().lower()
    # Accept dynamic OTP issued for this number/username OR standard fallback 123456
    stored = _otp_requests.get(key)
    if stored and otp.strip() == stored:
        return True
    return otp.strip() == FIXED_OTP


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
