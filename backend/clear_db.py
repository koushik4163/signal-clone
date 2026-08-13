import sqlite3
import os

def clear_db():
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "signal_clone.db")
    if not os.path.exists(db_path):
        print("Database file does not exist.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    tables = [
        "message_receipts",
        "messages",
        "conversation_participants",
        "conversations",
        "contacts",
        "sessions",
        "users"
    ]

    for table in tables:
        try:
            cursor.execute(f"DELETE FROM {table};")
            print(f"Cleared table {table}")
        except Exception as e:
            print(f"Could not clear table {table}: {e}")

    conn.commit()
    conn.close()
    print("Database cleared successfully.")

if __name__ == "__main__":
    clear_db()
