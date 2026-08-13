import uuid
import datetime
import enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class ConversationType(str, enum.Enum):
    direct = "direct"
    group = "group"


class ParticipantRole(str, enum.Enum):
    member = "member"
    admin = "admin"


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    type = Column(Enum(ConversationType), nullable=False, default=ConversationType.direct)
    name = Column(String, nullable=True)  # group name, null for direct
    avatar_url = Column(String, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    last_message_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)

    participants = relationship("ConversationParticipant", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id", name="uq_conv_user"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(ParticipantRole), default=ParticipantRole.member)
    joined_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    last_read_message_id = Column(String, nullable=True)

    conversation = relationship("Conversation", back_populates="participants")
    user = relationship("User")
