import uuid
import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class MessageReaction(Base):
    __tablename__ = "message_reactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    emoji = Column(String(16), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    message = relationship("Message", back_populates="reactions")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("message_id", "user_id", "emoji", name="uq_reaction_per_user_emoji"),
    )


class MessageDeletedFor(Base):
    """Tracks 'delete for me' per user per message."""
    __tablename__ = "message_deleted_for"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="uq_deleted_for_user"),
    )
