import os
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse

from app.core.config import STORAGE_BACKEND, STORAGE_BUCKET, UPLOAD_DIR


class LocalStorage:
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save_file(self, filename: str, content: bytes) -> str:
        target = self.base_dir / filename
        target.write_bytes(content)
        return f"/api/upload/files/{filename}"

    def get_path(self, filename: str) -> Path:
        return self.base_dir / filename

    def serve_file(self, filename: str) -> FileResponse:
        filepath = self.get_path(filename)
        if not filepath.exists():
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(filepath)


class S3Storage:
    def __init__(self, bucket_name: str):
        self.bucket_name = bucket_name
        self._boto3 = None
        try:
            import boto3

            self._boto3 = boto3
        except ImportError:  # pragma: no cover - optional dependency
            pass

    def save_file(self, filename: str, content: bytes) -> str:
        if self._boto3 is None:
            raise RuntimeError("boto3 is required for S3 storage support")
        s3 = self._boto3.client("s3")
        s3.put_object(Bucket=self.bucket_name, Key=filename, Body=content)
        return f"https://{self.bucket_name}.s3.amazonaws.com/{filename}"

    def get_path(self, filename: str):
        return f"s3://{self.bucket_name}/{filename}"

    def serve_file(self, filename: str):
        raise RuntimeError("S3 object storage requires a signed URL flow; local file serving is not used here.")


def get_storage_backend():
    backend = str(STORAGE_BACKEND).lower()
    if backend == "s3":
        return S3Storage(STORAGE_BUCKET)
    return LocalStorage(UPLOAD_DIR)
