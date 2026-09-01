from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import asc
import datetime
from typing import Optional
from pydantic import BaseModel

from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.conversation import Conversation, ConversationParticipant
from app.models.message import Message, MessageStatus
from app.models.reaction import MessageReaction, MessageDeletedFor
from app.models.pin import MessagePin
from app.core.security import get_current_user
from app.core.ws_manager import manager
from app.schemas.message import MessageOut

router = APIRouter(prefix="/api/conversations", tags=["messages"])


# ─── Pydantic payloads ───────────────────────────────────────────────────────

class EditPayload(BaseModel):
    content: str

class ReactionPayload(BaseModel):
    emoji: str


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _serialize(msg: Message, deleted_for_ids: set[str] | None = None, pinned: bool = False) -> dict:
    reactions: dict[str, list[str]] = {}
    for r in (msg.reactions or []):
        reactions.setdefault(r.emoji, [])
        reactions[r.emoji].append(r.user_id)
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "content": msg.content if not msg.is_deleted else "",
        "status": msg.status.value if hasattr(msg.status, "value") else msg.status,
        "reply_to_id": msg.reply_to_id,
        "created_at": msg.created_at.isoformat(),
        "edited_at": msg.edited_at.isoformat() if msg.edited_at else None,
        "is_deleted": msg.is_deleted,
        "reactions": reactions,
        "client_temp_id": None,
        "is_pinned": pinned,
    }


def _assert_member(db: DBSession, conversation_id: str, user_id: str):
    is_member = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == conversation_id,
        ConversationParticipant.user_id == user_id,
    ).first()
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a participant of this conversation")


def _get_other_participant_ids(db: DBSession, conversation_id: str, exclude_user_id: str) -> list[str]:
    rows = (
        db.query(ConversationParticipant.user_id)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id != exclude_user_id,
        )
        .all()
    )
    return [r.user_id for r in rows]


def _get_all_participant_ids(db: DBSession, conversation_id: str) -> list[str]:
    rows = (
        db.query(ConversationParticipant.user_id)
        .filter(ConversationParticipant.conversation_id == conversation_id)
        .all()
    )
    return [r.user_id for r in rows]


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/{conversation_id}/messages")
def get_messages(
    conversation_id: str,
    before: str | None = Query(default=None, description="ISO timestamp cursor for pagination"),
    limit: int = Query(default=50, le=200),
    q: str | None = Query(default=None, description="Search query"),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    _assert_member(db, conversation_id, current_user.id)

    # Find messages deleted for this user
    deleted_for_me = {
        r.message_id
        for r in db.query(MessageDeletedFor.message_id)
        .filter(MessageDeletedFor.user_id == current_user.id)
        .all()
    }

    query = db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.id.notin_(deleted_for_me),
    )

    if q:
        query = query.filter(Message.content.ilike(f"%{q}%"))

    if before:
        try:
            cutoff = datetime.datetime.fromisoformat(before)
            query = query.filter(Message.created_at < cutoff)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid 'before' timestamp")

    messages = query.order_by(Message.created_at.desc()).limit(limit).all()
    messages.reverse()
    pinned_ids = {
        message_id for (message_id,) in db.query(MessagePin.message_id).filter(
            MessagePin.user_id == current_user.id,
            MessagePin.message_id.in_([m.id for m in messages]),
        ).all()
    }
    return [_serialize(m, pinned=m.id in pinned_ids) for m in messages]


@router.post("/{conversation_id}/messages/{message_id}/pin")
def toggle_pin(
    conversation_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    _assert_member(db, conversation_id, current_user.id)
    message = db.query(Message).filter(Message.id == message_id, Message.conversation_id == conversation_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    pin = db.query(MessagePin).filter(
        MessagePin.message_id == message_id,
        MessagePin.user_id == current_user.id,
    ).first()
    if pin:
        db.delete(pin)
        pinned = False
    else:
        db.add(MessagePin(message_id=message_id, user_id=current_user.id))
        pinned = True
    db.commit()
    return {"pinned": pinned}


@router.delete("/{conversation_id}/messages")
def clear_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    _assert_member(db, conversation_id, current_user.id)
    message_ids = [message_id for (message_id,) in db.query(Message.id).filter(
        Message.conversation_id == conversation_id,
    ).all()]
    existing_ids = {
        message_id
        for (message_id,) in db.query(MessageDeletedFor.message_id).filter(
            MessageDeletedFor.user_id == current_user.id,
            MessageDeletedFor.message_id.in_(message_ids),
        ).all()
    }
    db.add_all(
        MessageDeletedFor(message_id=message_id, user_id=current_user.id)
        for message_id in message_ids
        if message_id not in existing_ids
    )
    db.commit()
    return {"ok": True}


@router.patch("/{conversation_id}/messages/{message_id}")
async def edit_message(
    conversation_id: str,
    message_id: str,
    payload: EditPayload,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    _assert_member(db, conversation_id, current_user.id)
    msg = db.query(Message).filter(
        Message.id == message_id,
        Message.conversation_id == conversation_id,
        Message.sender_id == current_user.id,
        Message.is_deleted == False,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found or not yours")
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    msg.content = content
    msg.edited_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(msg)

    serialized = _serialize(msg)
    all_ids = _get_all_participant_ids(db, conversation_id)
    await manager.broadcast_to_users(all_ids, {
        "type": "message_edited",
        "message": serialized,
    })
    return serialized


@router.delete("/{conversation_id}/messages/{message_id}")
async def delete_message(
    conversation_id: str,
    message_id: str,
    for_everyone: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    _assert_member(db, conversation_id, current_user.id)
    msg = db.query(Message).filter(
        Message.id == message_id,
        Message.conversation_id == conversation_id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if for_everyone:
        # Only sender can delete for everyone
        if msg.sender_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the sender can delete for everyone")
        msg.is_deleted = True
        msg.content = ""
        db.commit()
        all_ids = _get_all_participant_ids(db, conversation_id)
        await manager.broadcast_to_users(all_ids, {
            "type": "message_deleted",
            "message_id": message_id,
            "conversation_id": conversation_id,
            "for_everyone": True,
        })
    else:
        # Delete for me only
        existing = db.query(MessageDeletedFor).filter(
            MessageDeletedFor.message_id == message_id,
            MessageDeletedFor.user_id == current_user.id,
        ).first()
        if not existing:
            db.add(MessageDeletedFor(message_id=message_id, user_id=current_user.id))
            db.commit()
        await manager.send_to_user(current_user.id, {
            "type": "message_deleted",
            "message_id": message_id,
            "conversation_id": conversation_id,
            "for_everyone": False,
        })

    return {"ok": True}


@router.post("/{conversation_id}/messages/{message_id}/react")
async def toggle_reaction(
    conversation_id: str,
    message_id: str,
    payload: ReactionPayload,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    _assert_member(db, conversation_id, current_user.id)
    msg = db.query(Message).filter(
        Message.id == message_id,
        Message.conversation_id == conversation_id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    emoji = payload.emoji.strip()
    if not emoji:
        raise HTTPException(status_code=400, detail="Emoji required")

    existing = db.query(MessageReaction).filter(
        MessageReaction.message_id == message_id,
        MessageReaction.user_id == current_user.id,
        MessageReaction.emoji == emoji,
    ).first()

    if existing:
        db.delete(existing)
        added = False
    else:
        db.add(MessageReaction(
            message_id=message_id,
            user_id=current_user.id,
            emoji=emoji,
        ))
        added = True
    db.commit()

    # Re-query to get updated reactions
    db.refresh(msg)
    reactions: dict[str, list[str]] = {}
    for r in msg.reactions:
        reactions.setdefault(r.emoji, [])
        reactions[r.emoji].append(r.user_id)

    all_ids = _get_all_participant_ids(db, conversation_id)
    await manager.broadcast_to_users(all_ids, {
        "type": "reaction_update",
        "message_id": message_id,
        "conversation_id": conversation_id,
        "reactions": reactions,
        "user_id": current_user.id,
        "emoji": emoji,
        "added": added,
    })
    return {"reactions": reactions, "added": added}
