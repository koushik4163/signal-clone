from pydantic import BaseModel
from typing import Optional, List
from app.schemas.auth import UserOut


class ContactCreate(BaseModel):
    phone_number: Optional[str] = None
    username: Optional[str] = None
    nickname: Optional[str] = None


class ContactOut(BaseModel):
    id: str
    nickname: Optional[str] = None
    user: UserOut

    class Config:
        from_attributes = True


class ConversationCreateDirect(BaseModel):
    user_id: str


class ConversationCreateGroup(BaseModel):
    name: str
    member_ids: List[str]
    avatar_url: Optional[str] = None


class ParticipantOut(BaseModel):
    user: UserOut
    role: str

    class Config:
        from_attributes = True


class LastMessagePreview(BaseModel):
    content: Optional[str] = None
    sender_id: Optional[str] = None
    created_at: Optional[str] = None
    status: Optional[str] = None


class ConversationOut(BaseModel):
    id: str
    type: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    last_message_at: str
    participants: List[ParticipantOut]
    last_message: Optional[LastMessagePreview] = None
    unread_count: int = 0

    class Config:
        from_attributes = True


class GroupMemberAction(BaseModel):
    user_id: str
