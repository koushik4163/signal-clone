from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE messages ADD COLUMN edited_at DATETIME"))
        conn.commit()
        print("edited_at column added successfully")
    except Exception as e:
        if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
            print("edited_at column already exists, skipping")
        else:
            raise
