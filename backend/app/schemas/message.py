from pydantic import BaseModel
from typing import Optional
from app.schemas.auth import UserOut


class MessageCreate(BaseModel):
    content: str
    reply_to_id: Optional[str] = None
    client_temp_id: Optional[str] = None  # for optimistic UI reconciliation


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    content: str
    status: str
    reply_to_id: Optional[str] = None
    created_at: str
    client_temp_id: Optional[str] = None
    is_pinned: bool = False

    class Config:
        from_attributes = True


class TypingEvent(BaseModel):
    is_typing: bool
