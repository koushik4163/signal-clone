"""
Seeds the database with sample users, contacts, direct + group conversations,
and messages so the app is immediately usable for demo/evaluation.

Run with: python -m app.seed
"""
import datetime
from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.contact import Contact
from app.models.conversation import Conversation, ConversationParticipant, ConversationType, ParticipantRole
from app.models.message import Message, MessageStatus

SAMPLE_USERS = []


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("Database already seeded. Skipping.")
            return

        users = {}
        for u in SAMPLE_USERS:
            user = User(**u)
            db.add(user)
            db.flush()
            users[u["username"]] = user
        db.commit()

        print("Seed complete with users only. No contacts, conversations, or messages were created.")
        print("Login with any of these phone numbers + fixed OTP 123456:")
        for u in SAMPLE_USERS:
            print(f"  {u['display_name']:<15} {u['phone_number']}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
