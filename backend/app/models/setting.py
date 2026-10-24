from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Setting(Base):
    """
    Setting model representing user preferences and notification schedules.
    Each user has exactly one settings row.
    """
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    timezone = Column(String(100), default="UTC", nullable=False)
    plan_reminder_time = Column(String(10), default="08:00", nullable=False)    # 24-hr format "HH:MM"
    journal_reminder_time = Column(String(10), default="21:00", nullable=False) # 24-hr format "HH:MM"
    allow_ai_journal_review = Column(Boolean, default=False, nullable=False)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    owner = relationship("User", back_populates="settings")
