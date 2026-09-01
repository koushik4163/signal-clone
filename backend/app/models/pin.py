import uuid
import datetime
from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint

from app.database import Base


class MessagePin(Base):
    __tablename__ = "message_pins"
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="uq_message_pin_user"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
