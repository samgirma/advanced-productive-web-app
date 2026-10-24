from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Task(Base):
    """
    Task model representing daily to-do items.
    Tracks scheduled interval, execution state, and overdue status.
    """
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    
    # Status can be: 'not_started', 'started', or 'completed'
    status = Column(String(50), default="not_started", nullable=False)

    planned_start_time = Column(DateTime(timezone=True), nullable=False)
    planned_end_time = Column(DateTime(timezone=True), nullable=False)

    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    is_overdue = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    owner = relationship("User", back_populates="tasks")
