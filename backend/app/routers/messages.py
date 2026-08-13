from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import asc
import datetime

from app.database import get_db
from app.models.user import User
from app.models.conversation import Conversation, ConversationParticipant
from app.models.message import Message, MessageStatus
from app.core.security import get_current_user
from app.schemas.message import MessageOut

router = APIRouter(prefix="/api/conversations", tags=["messages"])


def _serialize(msg: Message) -> MessageOut:
    return MessageOut(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        content=msg.content,
        status=msg.status.value if hasattr(msg.status, "value") else msg.status,
        reply_to_id=msg.reply_to_id,
        created_at=msg.created_at.isoformat(),
    )


def _assert_member(db: DBSession, conversation_id: str, user_id: str):
    is_member = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == conversation_id,
        ConversationParticipant.user_id == user_id,
    ).first()
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a participant of this conversation")


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def get_messages(
    conversation_id: str,
    before: str | None = Query(default=None, description="ISO timestamp cursor for pagination"),
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    _assert_member(db, conversation_id, current_user.id)

    q = db.query(Message).filter(Message.conversation_id == conversation_id)
    q = q.filter(Message.is_deleted == False)
    if before:
        try:
            cutoff = datetime.datetime.fromisoformat(before)
            q = q.filter(Message.created_at < cutoff)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid 'before' timestamp")

    messages = q.order_by(Message.created_at.desc()).limit(limit).all()
    messages.reverse()
    return [_serialize(m) for m in messages]
