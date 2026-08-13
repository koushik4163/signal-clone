import datetime
import re
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models.user import User
from app.core.security import issue_otp, check_otp, create_session, get_current_user
from app.core.ws_manager import manager
from app.schemas.auth import (
    SendOtpRequest,
    SendOtpResponse,
    VerifyOtpRequest,
    AuthResponse,
    UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _touch_presence(user: User):
    user.is_online = True
    user.last_seen = datetime.datetime.now(datetime.timezone.utc)


def _normalize_identifier(raw: str) -> str:
    return raw.strip().lstrip("@")


def _looks_like_phone(identifier: str) -> bool:
    cleaned = identifier.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if cleaned.startswith("+"):
        cleaned = cleaned[1:]
    return cleaned.isdigit() and len(cleaned) >= 7


@router.post("/send-otp", response_model=SendOtpResponse)
def send_otp(payload: SendOtpRequest, db: DBSession = Depends(get_db)):
    identifier = _normalize_identifier(payload.identifier)
    if not identifier:
        raise HTTPException(status_code=400, detail="Identifier is required")

    otp = issue_otp(identifier)
    normalized = identifier.lower()
    user = db.query(User).filter(
        (func.lower(User.phone_number) == normalized) |
        (func.lower(User.username) == normalized)
    ).first()

    return SendOtpResponse(
        message=f"OTP sent to {identifier}",
        mocked_otp=otp,
        is_new_user=(user is None),
    )


@router.post("/verify-otp", response_model=AuthResponse)
def verify_otp(payload: VerifyOtpRequest, db: DBSession = Depends(get_db)):
    identifier = _normalize_identifier(payload.identifier)
    if not identifier:
        raise HTTPException(status_code=400, detail="Identifier is required")

    if not check_otp(identifier, payload.otp):
        raise HTTPException(status_code=400, detail="Invalid OTP code. Please enter the verification code sent to your account.")

    normalized_identifier = identifier.lower()
    user = db.query(User).filter(
        (func.lower(User.phone_number) == normalized_identifier) |
        (func.lower(User.username) == normalized_identifier)
    ).first()

    if user is None:
        if not payload.display_name or not payload.display_name.strip():
            raise HTTPException(status_code=400, detail="Display name is required for new accounts.")

        requested_username = (payload.username or "").strip().lstrip("@")
        derived_username = identifier if not _looks_like_phone(identifier) and not requested_username else requested_username
        
        normalized_username = derived_username.lower() if derived_username else None
        if normalized_username:
            existing = db.query(User).filter(func.lower(User.username) == normalized_username).first()
            if existing:
                raise HTTPException(status_code=400, detail="Username is already taken by another account.")

        phone_number = identifier if _looks_like_phone(identifier) else identifier

        user = User(
            phone_number=phone_number,
            display_name=payload.display_name.strip(),
            username=normalized_username or None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    _touch_presence(user)
    db.commit()
    token = create_session(db, user.id)
    return AuthResponse(token=token, user=UserOut.model_validate(_serialize(user)))


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    _touch_presence(current_user)
    db.commit()
    return UserOut.model_validate(_serialize(current_user))


@router.post("/logout")
def logout(
    authorization: str | None = Header(default=None),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        from app.models.session import Session as SessionModel
        db.query(SessionModel).filter(SessionModel.token == token).delete()
        db.commit()
    return {"message": "Logged out"}


def _presence_is_online(user: User) -> bool:
    if manager.is_online(user.id):
        return True
    if not user.is_online or not user.last_seen:
        return False
    last_seen = user.last_seen
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=datetime.timezone.utc)
    age_seconds = (datetime.datetime.now(datetime.timezone.utc) - last_seen).total_seconds()
    return age_seconds <= 60


def _serialize(user: User):
    return {
        "id": user.id,
        "phone_number": user.phone_number,
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "about": user.about,
        "is_online": _presence_is_online(user),
        "last_seen": user.last_seen.isoformat() if user.last_seen else None,
    }
