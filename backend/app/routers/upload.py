import datetime
import os
import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session as DBSession

from app.core.security import get_current_user
from app.core.storage import get_storage_backend
from app.core.ws_manager import manager
from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserOut

router = APIRouter(prefix="/api/upload", tags=["upload"])

storage = get_storage_backend()


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


@router.post("/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    ext = os.path.splitext(file.filename or "avatar.png")[1] or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    contents = await file.read()
    avatar_url = storage.save_file(filename, contents)

    current_user.avatar_url = avatar_url
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(_serialize(current_user))


@router.post("/file")
async def upload_file(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename or "file.bin")[1] or ".bin"
    filename = f"{uuid.uuid4().hex}{ext}"
    contents = await file.read()
    url = storage.save_file(filename, contents)
    return {
        "filename": file.filename or filename,
        "content_type": file.content_type or "application/octet-stream",
        "url": url,
    }


@router.get("/files/{filename}")
async def serve_file(filename: str):
    return storage.serve_file(filename)
