from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.memory import Memory
from app.schemas.memory import MemoryResponse
from app.api.deps import get_current_user
from app.services.storage import validate_and_save_upload, delete_uploaded_file

router = APIRouter(prefix="/memories", tags=["Memories"])


@router.post("/upload", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def upload_memory(
    file: UploadFile = File(...),
    entry_date: date = Form(...),
    caption: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a picture or video memory for a specific calendar date.
    Strictly enforces file extension, MIME type, and size limits (10MB image, 50MB video).
    """
    upload_info = validate_and_save_upload(file)

    memory = Memory(
        user_id=current_user.id,
        entry_date=entry_date,
        file_name=upload_info["file_name"],
        file_path=upload_info["file_path"],
        file_type=upload_info["file_type"],
        mime_type=upload_info["mime_type"],
        file_size_bytes=upload_info["file_size_bytes"],
        caption=caption
    )
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory


@router.get("/", response_model=List[MemoryResponse])
def get_memories(
    entry_date: Optional[date] = Query(default=None, description="Filter by calendar date YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve memories belonging to the authenticated user.
    Optionally filter by date, sorted chronologically.
    """
    query = db.query(Memory).filter(Memory.user_id == current_user.id)
    if entry_date:
        query = query.filter(Memory.entry_date == entry_date)

    return query.order_by(Memory.entry_date.desc(), Memory.created_at.desc()).all()


@router.delete("/{memory_id}")
def delete_memory(
    memory_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a memory record and clean up the media file from disk.
    Ensures users can only delete their own uploads.
    """
    memory = db.query(Memory).filter(
        Memory.id == memory_id,
        Memory.user_id == current_user.id
    ).first()

    if not memory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found.")

    delete_uploaded_file(memory.file_path)
    db.delete(memory)
    db.commit()

    return {"message": "Memory deleted successfully"}
