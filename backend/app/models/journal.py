from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class JournalEntry(Base):
    """
    JournalEntry model representing one notebook reflection page per day.
    Enforces exactly one entry per user per calendar date.
    """
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    entry_date = Column(Date, nullable=False, index=True)
    
    content = Column(Text, default="", nullable=False)
    mood = Column(String(50), nullable=True)  # e.g., 'calm', 'energized', 'reflective', 'tired'

    # Populated in Stage 2 by Gemini
    ai_summary = Column(Text, nullable=True)
    ai_insights_json = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "entry_date", name="uq_user_journal_entry_date"),
    )

    owner = relationship("User", back_populates="journal_entries")
