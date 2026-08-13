import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models.user import User
from app.models.contact import Contact
from app.core.security import get_current_user
from app.core.ws_manager import manager
from app.schemas.conversation import ContactCreate, ContactOut
from app.schemas.auth import UserOut

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


def _presence_is_online(user: User) -> bool:
    if manager.is_online(user.id):
        return True
    if not user.is_online or not user.last_seen:
        return False
    age_seconds = (datetime.datetime.now(datetime.timezone.utc) - user.last_seen).total_seconds()
    return age_seconds <= 60


def _user_out(user: User):
    return UserOut.model_validate({
        "id": user.id,
        "phone_number": user.phone_number,
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "about": user.about,
        "is_online": _presence_is_online(user),
        "last_seen": user.last_seen.isoformat() if user.last_seen else None,
    })


@router.get("", response_model=list[ContactOut])
def list_contacts(current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    contacts = db.query(Contact).filter(Contact.owner_id == current_user.id).all()
    return [
        ContactOut(id=c.id, nickname=c.nickname, user=_user_out(c.contact_user))
        for c in contacts
    ]


@router.post("", response_model=ContactOut)
def add_contact(payload: ContactCreate, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    if not payload.phone_number and not payload.username:
        raise HTTPException(status_code=400, detail="Provide phone_number or username")

    query = db.query(User)
    if payload.phone_number:
        target = query.filter(User.phone_number == payload.phone_number).first()
    else:
        target = query.filter(User.username == payload.username).first()

    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself as a contact")

    existing = (
        db.query(Contact)
        .filter(Contact.owner_id == current_user.id, Contact.contact_user_id == target.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Contact already added")

    contact = Contact(owner_id=current_user.id, contact_user_id=target.id, nickname=payload.nickname)
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return ContactOut(id=contact.id, nickname=contact.nickname, user=_user_out(target))


@router.delete("/{contact_id}")
def remove_contact(contact_id: str, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == contact_id, Contact.owner_id == current_user.id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
    return {"message": "Contact removed"}
