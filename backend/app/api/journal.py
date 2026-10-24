from datetime import date, datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.journal import JournalEntry
from app.schemas.journal import JournalEntrySave, JournalEntryResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/journal", tags=["Journal"])


@router.get("/", response_model=JournalEntryResponse)
def get_journal_entry(
    entry_date: Optional[date] = Query(default=None, description="Calendar date YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve the notebook entry for a specific date (defaults to today).
    If no entry has been started yet for that date, creates and returns an empty entry.
    """
    target_date = entry_date or date.today()

    entry = db.query(JournalEntry).filter(
        JournalEntry.user_id == current_user.id,
        JournalEntry.entry_date == target_date
    ).first()

    if not entry:
        # Create a fresh empty draft for the user
        entry = JournalEntry(
            user_id=current_user.id,
            entry_date=target_date,
            content="",
            mood=None
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)

    return entry


@router.post("/", response_model=JournalEntryResponse)
def save_journal_entry(
    entry_in: JournalEntrySave,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Autosave / Save endpoint.
    Upserts the journal entry for the given date (strictly 1 entry per day per user).
    """
    entry = db.query(JournalEntry).filter(
        JournalEntry.user_id == current_user.id,
        JournalEntry.entry_date == entry_in.entry_date
    ).first()

    if entry:
        entry.content = entry_in.content
        if entry_in.mood is not None:
            entry.mood = entry_in.mood
    else:
        entry = JournalEntry(
            user_id=current_user.id,
            entry_date=entry_in.entry_date,
            content=entry_in.content,
            mood=entry_in.mood
        )
        db.add(entry)

    db.commit()
    db.refresh(entry)

    # Auto-index in Chroma vector database for semantic 'Ask My Journal' search
    try:
        from app.services.vector_store import index_journal_entry
        index_journal_entry(
            user_id=current_user.id,
            entry_id=entry.id,
            entry_date=str(entry.entry_date),
            content=entry.content or "",
            mood=entry.mood,
        )
    except Exception as e:
        # Vector indexing failure should never prevent database transaction success
        pass

    return entry


@router.get("/dates", response_model=List[str])
def get_logged_dates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns an ISO date list of all days where the user wrote journal content.
    Used by the calendar picker to visually highlight active days.
    """
    entries = db.query(JournalEntry.entry_date).filter(
        JournalEntry.user_id == current_user.id,
        JournalEntry.content != ""
    ).all()

    return [str(item[0]) for item in entries]
