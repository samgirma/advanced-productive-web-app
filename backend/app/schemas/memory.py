from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class MemoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    entry_date: date
    file_name: str
    file_path: str
    file_type: str
    mime_type: str
    file_size_bytes: int
    caption: Optional[str] = None
    created_at: datetime
