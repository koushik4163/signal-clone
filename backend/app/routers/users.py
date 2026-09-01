import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import or_
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.core.security import get_current_user
from app.core.ws_manager import manager
from app.schemas.auth import UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    about: Optional[str] = None


def _presence_is_online(user: User) -> bool:
    if manager.is_online(user.id):
        return True
    if not user.is_online or not user.last_seen:
        return False
    age_seconds = (datetime.datetime.now(datetime.timezone.utc) - user.last_seen).total_seconds()
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


@router.put("/me", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if payload.display_name is not None:
        current_user.display_name = payload.display_name
    if payload.username is not None:
        if payload.username != current_user.username:
            existing = db.query(User).filter(User.username == payload.username, User.id != current_user.id).first()
            if existing:
                raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = payload.username
    if "avatar_url" in payload.model_fields_set:
        current_user.avatar_url = payload.avatar_url
    if payload.about is not None:
        current_user.about = payload.about
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(_serialize(current_user))


@router.get("/search", response_model=list[UserOut])
def search_users(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    results = (
        db.query(User)
        .filter(
            User.id != current_user.id,
            or_(
                User.phone_number.ilike(f"%{q}%"),
                User.username.ilike(f"%{q}%"),
                User.display_name.ilike(f"%{q}%"),
            ),
        )
        .limit(20)
        .all()
    )
    return [UserOut.model_validate(_serialize(u)) for u in results]
