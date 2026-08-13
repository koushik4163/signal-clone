import os
import sqlite3

def reset():
    db_files = ["signal_clone.db", "signal_clone.db-shm", "signal_clone.db-wal"]
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    for f in db_files:
        path = os.path.join(backend_dir, f)
        if os.path.exists(path):
            try:
                os.remove(path)
                print(f"Removed {path}")
            except Exception as e:
                print(f"Error removing {path}: {e}")
    print("Database reset complete. Restart the FastAPI server to re-initialize schema.")

if __name__ == "__main__":
    reset()
