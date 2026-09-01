import uuid
import datetime
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    phone_number = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=True, index=True)
    email = Column(String, unique=True, nullable=True, index=True)
    password_hash = Column(String, nullable=True)
    display_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    about = Column(String, nullable=True, default="Hey there! I am using Signal Clone.")
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    sent_messages = relationship("Message", back_populates="sender", cascade="all, delete-orphan")
