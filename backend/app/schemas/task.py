from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    planned_start_time: datetime
    planned_end_time: datetime


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    planned_start_time: Optional[datetime] = None
    planned_end_time: Optional[datetime] = None
    status: Optional[str] = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    status: str
    planned_start_time: datetime
    planned_end_time: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    is_overdue: bool
    created_at: datetime
