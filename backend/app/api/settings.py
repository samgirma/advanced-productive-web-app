from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.setting import Setting
from app.schemas.setting import SettingUpdate, SettingResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/", response_model=SettingResponse)
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve notification schedules and timezone preferences for the current user.
    """
    setting = db.query(Setting).filter(Setting.user_id == current_user.id).first()
    if not setting:
        setting = Setting(
            user_id=current_user.id,
            timezone="UTC",
            plan_reminder_time="08:00",
            journal_reminder_time="21:00",
            allow_ai_journal_review=False
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)

    return setting


@router.put("/", response_model=SettingResponse)
def update_settings(
    setting_in: SettingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update reminder times, timezone, and AI permission.
    """
    setting = db.query(Setting).filter(Setting.user_id == current_user.id).first()
    if not setting:
        setting = Setting(user_id=current_user.id)
        db.add(setting)

    if setting_in.timezone is not None:
        setting.timezone = setting_in.timezone
    if setting_in.plan_reminder_time is not None:
        setting.plan_reminder_time = setting_in.plan_reminder_time
    if setting_in.journal_reminder_time is not None:
        setting.journal_reminder_time = setting_in.journal_reminder_time
    if setting_in.allow_ai_journal_review is not None:
        setting.allow_ai_journal_review = setting_in.allow_ai_journal_review

    db.commit()
    db.refresh(setting)
    return setting
