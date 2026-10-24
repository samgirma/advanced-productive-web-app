from datetime import datetime, timezone, date
from typing import Optional
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session

from app.models.task import Task
from app.models.setting import Setting
from app.models.notification import Notification
from app.core.logging_config import logger


def get_user_timezone(db: Session, user_id: int) -> ZoneInfo:
    """Helper to fetch a user's configured timezone safely, defaulting to UTC."""
    setting = db.query(Setting).filter(Setting.user_id == user_id).first()
    tz_str = setting.timezone if setting and setting.timezone else "UTC"
    try:
        return ZoneInfo(tz_str)
    except Exception:
        return ZoneInfo("UTC")


def check_and_process_overdue_tasks(db: Session, current_utc: Optional[datetime] = None):
    """
    Scans for tasks whose planned_end_time has passed without completion.
    Marks them overdue and creates an in-app alert notification converted to the user's local timezone.
    """
    now_utc = current_utc or datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=timezone.utc)
    
    tasks = db.query(Task).filter(
        Task.status.in_(["not_started", "started"]),
        Task.is_overdue.is_(False)
    ).all()

    for task in tasks:
        task_end = task.planned_end_time
        if task_end.tzinfo is None:
            task_end = task_end.replace(tzinfo=timezone.utc)
        else:
            task_end = task_end.astimezone(timezone.utc)

        if task_end < now_utc:
            task.is_overdue = True
            logger.info(f"Task ID {task.id} ('{task.title}') marked overdue for user {task.user_id}")

            # Format the alert using the user's local timezone
            user_tz = get_user_timezone(db, task.user_id)
            local_end_time = task_end.astimezone(user_tz)
            time_display = local_end_time.strftime("%H:%M")

            notification = Notification(
                user_id=task.user_id,
                title="Task Overdue Alert",
                message=f"Task '{task.title}' was scheduled to end at {time_display} and is now overdue.",
                notification_type="overdue_task",
                is_read=False
            )
            db.add(notification)

    db.commit()


def check_and_process_daily_reminders(db: Session, current_utc: Optional[datetime] = None):
    """
    Checks user settings to trigger 'Plan your day' and 'Journal your day' alerts.
    Converts current UTC time to the user's local timezone to evaluate trigger times accurately.
    Ensures each notification is only sent once per local calendar day.
    """
    now_utc = current_utc or datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=timezone.utc)

    settings_list = db.query(Setting).all()

    for setting in settings_list:
        user_id = setting.user_id
        tz_str = setting.timezone or "UTC"
        try:
            user_tz = ZoneInfo(tz_str)
        except Exception:
            user_tz = ZoneInfo("UTC")

        # Convert UTC to user's local timezone
        now_local = now_utc.astimezone(user_tz)
        local_time_str = now_local.strftime("%H:%M")
        local_date = now_local.date()

        # Beginning of user's local day in UTC
        start_of_local_day_local = datetime.combine(local_date, datetime.min.time(), tzinfo=user_tz)
        start_of_local_day_utc = start_of_local_day_local.astimezone(timezone.utc)

        # 1. "Plan your day" reminder
        if setting.plan_reminder_time == local_time_str:
            existing = db.query(Notification).filter(
                Notification.user_id == user_id,
                Notification.notification_type == "reminder_plan",
                Notification.created_at >= start_of_local_day_utc
            ).first()

            if not existing:
                db.add(Notification(
                    user_id=user_id,
                    title="Plan Your Day",
                    message="Good morning! Please take a moment to plan your tasks for today.",
                    notification_type="reminder_plan",
                    is_read=False
                ))
                logger.info(f"Triggered 'plan your day' reminder for user {user_id} at {local_time_str} ({tz_str})")

        # 2. "Journal your day" reminder
        if setting.journal_reminder_time == local_time_str:
            existing = db.query(Notification).filter(
                Notification.user_id == user_id,
                Notification.notification_type == "reminder_journal",
                Notification.created_at >= start_of_local_day_utc
            ).first()

            if not existing:
                db.add(Notification(
                    user_id=user_id,
                    title="Journal Your Day",
                    message="How was your day? Take a quiet moment to write your journal reflection.",
                    notification_type="reminder_journal",
                    is_read=False
                ))
                logger.info(f"Triggered 'journal your day' reminder for user {user_id} at {local_time_str} ({tz_str})")

    db.commit()
