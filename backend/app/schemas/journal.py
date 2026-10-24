from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class JournalEntrySave(BaseModel):
    entry_date: date
    content: str = Field(default="", description="Notebook reflection content")
    mood: Optional[str] = Field(default=None, max_length=50)


class JournalEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    entry_date: date
    content: str
    mood: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_insights_json: Optional[str] = None
    created_at: datetime
    updated_at: datetime
