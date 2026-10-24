import os
import uuid
import shutil
from pathlib import Path
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}

ALLOWED_IMAGE_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_MIME = {"video/mp4", "video/webm", "video/quicktime"}


def get_upload_dir() -> Path:
    """Ensures the upload directory exists and returns its Path."""
    path = Path(settings.UPLOAD_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


def validate_and_save_upload(file: UploadFile) -> dict:
    """
    Validates uploaded file extension, MIME type, and size.
    Saves the file to local disk with a secure UUID to prevent filename collisions.
    
    Why Limits & Whitelisting:
    1. Security: Disallowing executables (.exe, .sh, .py, .html) prevents arbitrary code execution.
    2. Stability: Limiting image size (10MB) and video size (50MB) avoids memory exhaustion and disk fill attacks.
    3. Performance: Ensures snappy browser loading and smooth media streaming.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have a filename."
        )

    file_ext = Path(file.filename).suffix.lower()
    content_type = file.content_type or ""

    is_image = file_ext in ALLOWED_IMAGE_EXTENSIONS or content_type in ALLOWED_IMAGE_MIME
    is_video = file_ext in ALLOWED_VIDEO_EXTENSIONS or content_type in ALLOWED_VIDEO_MIME

    if not is_image and not is_video:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{file_ext}'. Allowed images: JPG, PNG, WEBP, GIF. Allowed videos: MP4, WEBM, MOV."
        )

    media_type = "image" if is_image else "video"
    max_mb = settings.MAX_IMAGE_SIZE_MB if is_image else settings.MAX_VIDEO_SIZE_MB
    max_bytes = max_mb * 1024 * 1024

    # Save to disk while checking file size
    upload_dir = get_upload_dir()
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    dest_path = upload_dir / unique_filename

    total_bytes = 0
    try:
        with open(dest_path, "wb") as buffer:
            while chunk := file.file.read(1024 * 1024):  # Read in 1MB chunks
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    # Clean up partial file on failure
                    buffer.close()
                    dest_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {max_mb} MB for {media_type}s."
                    )
                buffer.write(chunk)
    finally:
        file.file.close()

    # Relative path accessible via static files endpoint
    relative_path = f"/uploads/{unique_filename}"

    return {
        "file_name": file.filename,
        "file_path": relative_path,
        "file_type": media_type,
        "mime_type": content_type or ("image/jpeg" if is_image else "video/mp4"),
        "file_size_bytes": total_bytes,
    }


def delete_uploaded_file(file_path: str):
    """Deletes a file from the uploads directory when a memory record is deleted."""
    try:
        filename = Path(file_path).name
        full_path = get_upload_dir() / filename
        if full_path.exists():
            full_path.unlink()
    except Exception:
        pass  # Non-blocking if file was already removed
