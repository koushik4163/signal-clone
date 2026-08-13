import os
import uuid
import datetime
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models.user import User
from app.core.security import get_current_user
from app.core.ws_manager import manager
from app.schemas.auth import UserOut

router = APIRouter(prefix="/api/upload", tags=["upload"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


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
    filepath = os.path.join(UPLOAD_DIR, filename)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    current_user.avatar_url = f"/api/upload/files/{filename}"
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(_serialize(current_user))


@router.get("/files/{filename}")
async def serve_file(filename: str):
    from fastapi.responses import FileResponse
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)
