from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class SettingUpdate(BaseModel):
    timezone: Optional[str] = Field(default=None, max_length=100)
    plan_reminder_time: Optional[str] = Field(default=None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    journal_reminder_time: Optional[str] = Field(default=None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    allow_ai_journal_review: Optional[bool] = None


class SettingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    timezone: str
    plan_reminder_time: str
    journal_reminder_time: str
    allow_ai_journal_review: bool
    updated_at: datetime
