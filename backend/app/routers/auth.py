import datetime
import re
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models.user import User
from app.core.security import hash_password, verify_password, create_session, get_current_user
from app.core.ws_manager import manager
from app.schemas.auth import (
    SignupRequest,
    LoginRequest,
    AuthResponse,
    UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _touch_presence(user: User):
    user.is_online = True
    user.last_seen = datetime.datetime.now(datetime.timezone.utc)


@router.post("/signup", response_model=AuthResponse)
def signup(payload: SignupRequest, db: DBSession = Depends(get_db)):
    username = payload.username.strip().lstrip("@")
    email = payload.email.strip().lower()
    phone_number = payload.phone_number.strip()
    display_name = payload.display_name.strip()

    # Password complexity check: min 8 chars, uppercase, lowercase, digit, special char
    special_chars = r"!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?"
    if (
        len(payload.password) < 8
        or not re.search(r"[A-Z]", payload.password)
        or not re.search(r"[a-z]", payload.password)
        or not re.search(r"\d", payload.password)
        or not re.search(f"[{special_chars}]", payload.password)
    ):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character."
        )

    # Username format validation (3-20 chars, letters, numbers, _)
    if not re.match(r"^[a-zA-Z0-9_]{3,20}$", username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3–20 characters long and contain only letters, numbers, and underscores."
        )

    # Full name format validation (2-50 chars, letters, spaces, hyphens, apostrophes)
    if not re.match(r"^[a-zA-Z\s'-]{2,50}$", display_name):
        raise HTTPException(
            status_code=400,
            detail="Full Name must be 2–50 characters long and contain only letters, spaces, hyphens, and apostrophes."
        )

    # Unique checks
    if db.query(User).filter(func.lower(User.username) == username.lower()).first():
        raise HTTPException(status_code=400, detail="Username is already taken.")

    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    if db.query(User).filter(User.phone_number == phone_number).first():
        raise HTTPException(status_code=400, detail="An account with this phone number already exists.")

    hashed = hash_password(payload.password)

    user = User(
        username=username,
        email=email,
        phone_number=phone_number,
        display_name=display_name,
        password_hash=hashed,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _touch_presence(user)
    db.commit()

    token = create_session(db, user.id)
    return AuthResponse(token=token, user=UserOut.model_validate(_serialize(user)))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: DBSession = Depends(get_db)):
    identifier = payload.username.strip().lstrip("@").lower()
    if not identifier:
        raise HTTPException(status_code=400, detail="Username, email, or phone number is required.")

    if not payload.password:
        raise HTTPException(status_code=400, detail="Password is required.")

    user = db.query(User).filter(
        (func.lower(User.username) == identifier) |
        (func.lower(User.email) == identifier) |
        (func.lower(User.phone_number) == identifier)
    ).first()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid username/email or password.")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username/email or password.")

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
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "about": user.about,
        "is_online": _presence_is_online(user),
        "last_seen": user.last_seen.isoformat() if user.last_seen else None,
    }
