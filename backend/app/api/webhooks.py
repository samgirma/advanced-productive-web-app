from datetime import datetime, timezone, date, timedelta
from typing import List, Optional, Dict, Any
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.setting import Setting
from app.models.task import Task
from app.models.journal import JournalEntry
from app.models.notification import Notification

router = APIRouter(prefix="/webhooks", tags=["Webhooks & Automations (n8n, Make, Zapier)"])


def verify_webhook_secret(
    x_n8n_secret: Optional[str] = Header(None, alias="X-N8N-Secret"),
    secret: Optional[str] = Query(None),
):
    """
    Enforces secret token verification for external automated webhook triggers.
    Accepts the token via `X-N8N-Secret` header or `secret` query param.
    """
    incoming = x_n8n_secret or secret
    if not incoming or incoming != settings.N8N_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing webhook secret token. Check your n8n Credentials or .env."
        )
    return True


class ExternalIngestPayload(BaseModel):
    user_email: str = Field(..., description="Target user email registered in Productive")
    type: str = Field(..., description="'task' or 'journal'")
    title: Optional[str] = Field(None, description="Task title (if type='task')")
    content: Optional[str] = Field("", description="Journal body or task description")
    start_time: Optional[str] = Field(None, description="Planned start time (ISO 8601 UTC)")
    end_time: Optional[str] = Field(None, description="Planned end time (ISO 8601 UTC)")
    entry_date: Optional[str] = Field(None, description="Journal date YYYY-MM-DD (defaults to today)")
    mood: Optional[str] = Field(None, description="Optional mood tag for journal entries")


@router.get("/due-notifications")
def get_due_notifications_endpoint(
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_webhook_secret),
):
    """
    Workflow (a) Dispatch Endpoint:
    Polled every minute by n8n cron Schedule Trigger.
    Identifies users due for:
      1. Morning 'Plan your day' reminder (matched to their local timezone schedule).
      2. Evening 'Journal your day' reflection prompt.
      3. Overdue task alerts triggered within the recent cycle.
    Returns clean notification payloads ready for n8n Gmail / SMTP dispatch.
    """
    now_utc = datetime.now(timezone.utc)
    due_items: List[Dict[str, Any]] = []

    # 1. Check user schedule preferences
    settings_records = db.query(Setting).all()
    for s in settings_records:
        user = db.query(User).filter(User.id == s.user_id).first()
        if not user:
            continue

        try:
            user_tz = ZoneInfo(s.timezone or "UTC")
        except Exception:
            user_tz = ZoneInfo("UTC")

        user_local_time = now_utc.astimezone(user_tz)
        current_hm = user_local_time.strftime("%H:%M")

        # Plan reminder check (matches user's configured HH:MM)
        if s.plan_reminder_time == current_hm:
            due_items.append({
                "user_id": user.id,
                "email": user.email,
                "type": "plan_reminder",
                "subject": "🌅 Time to plan your day with Productive",
                "message": f"Good morning! It is {current_hm}. Take 5 minutes to outline your tasks and set yourself up for a productive day.",
                "scheduled_time_24h": current_hm,
            })

        # Journal reminder check
        if s.journal_reminder_time == current_hm:
            due_items.append({
                "user_id": user.id,
                "email": user.email,
                "type": "journal_reminder",
                "subject": "🌙 Evening reflection reminder",
                "message": f"Good evening! It is {current_hm}. Record today's wins, struggles, and mood in your mindful journal.",
                "scheduled_time_24h": current_hm,
            })

    # 2. Check unread overdue notifications generated in the last 2 minutes
    recent_window = now_utc - timedelta(minutes=2)
    unread_alerts = db.query(Notification).filter(
        Notification.notification_type == "overdue_task",
        Notification.is_read.is_(False),
        Notification.created_at >= recent_window,
    ).all()

    for alert in unread_alerts:
        user = db.query(User).filter(User.id == alert.user_id).first()
        if user:
            due_items.append({
                "user_id": user.id,
                "email": user.email,
                "type": "overdue_alert",
                "subject": "⚠️ Productive: Task Overdue Alert",
                "message": alert.message,
                "notification_id": alert.id,
            })

    return {
        "status": "success",
        "timestamp_utc": now_utc.isoformat(),
        "total_due": len(due_items),
        "notifications": due_items,
    }


@router.post("/external-ingest", status_code=status.HTTP_201_CREATED)
def external_ingest_endpoint(
    payload: ExternalIngestPayload,
    db: Session = Depends(get_db),
    authorized: bool = Depends(verify_webhook_secret),
):
    """
    Workflow (b) External Ingestion Endpoint:
    Accepts tasks or journal reflections from outside automation clients (n8n, Make, Zapier, iOS Shortcuts).
    """
    user = db.query(User).filter(User.email == payload.user_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email '{payload.user_email}' does not exist in Productive.",
        )

    now_utc = datetime.now(timezone.utc)

    if payload.type.lower() == "task":
        title = (payload.title or payload.content or "Quick Captured Task").strip()
        try:
            start_dt = datetime.fromisoformat(payload.start_time.replace("Z", "+00:00")) if payload.start_time else now_utc
            end_dt = datetime.fromisoformat(payload.end_time.replace("Z", "+00:00")) if payload.end_time else (start_dt + timedelta(hours=1))
        except Exception:
            start_dt = now_utc
            end_dt = now_utc + timedelta(hours=1)

        task = Task(
            user_id=user.id,
            title=title,
            planned_start_time=start_dt,
            planned_end_time=end_dt,
            status="not_started",
            is_overdue=False,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return {
            "status": "created",
            "type": "task",
            "task_id": task.id,
            "title": task.title,
            "planned_start_time": task.planned_start_time.isoformat(),
        }

    elif payload.type.lower() == "journal":
        target_date_str = payload.entry_date or str(date.today())
        try:
            target_date = date.fromisoformat(target_date_str)
        except Exception:
            target_date = date.today()

        entry = db.query(JournalEntry).filter(
            JournalEntry.user_id == user.id,
            JournalEntry.entry_date == target_date,
        ).first()

        new_text = payload.content.strip()
        if entry:
            entry.content = f"{entry.content}\n\n[Captured]: {new_text}" if entry.content else new_text
            if payload.mood:
                entry.mood = payload.mood
        else:
            entry = JournalEntry(
                user_id=user.id,
                entry_date=target_date,
                content=new_text,
                mood=payload.mood,
            )
            db.add(entry)

        db.commit()
        db.refresh(entry)

        # Index in Chroma
        try:
            from app.services.vector_store import index_journal_entry
            index_journal_entry(
                user_id=user.id,
                entry_id=entry.id,
                entry_date=str(entry.entry_date),
                content=entry.content,
                mood=entry.mood,
            )
        except Exception:
            pass

        return {
            "status": "updated" if entry else "created",
            "type": "journal",
            "entry_id": entry.id,
            "entry_date": str(entry.entry_date),
        }

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown ingest type '{payload.type}'. Must be 'task' or 'journal'.",
        )
