from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve user notifications ordered by unread status and timestamp.
    """
    from app.services.reminder_service import check_and_process_daily_reminders, check_and_process_overdue_tasks
    try:
        check_and_process_overdue_tasks(db)
        check_and_process_daily_reminders(db)
    except Exception:
        pass

    return db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(
        Notification.is_read.asc(),
        Notification.created_at.desc()
    ).limit(50).all()


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark a single notification as read.
    """
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")

    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.post("/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Dismiss all unread notifications for the current user.
    """
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read.is_(False)
    ).update({"is_read": True})

    db.commit()
    return {"message": "All notifications marked as read."}


@router.post("/test-alert", response_model=NotificationResponse)
def trigger_test_alert(
    alert_type: str = "reminder_plan",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Triggers an immediate test alert for testing Planning, Journal, or Overdue notifications.
    """
    if alert_type == "reminder_plan":
        title = "Plan Your Day"
        message = "Good morning! Please plan your day and schedule your daily tasks."
    elif alert_type == "reminder_journal":
        title = "Journal Your Day"
        message = "How was your day? Take a quiet moment to write your journal reflection."
    else:
        title = "Task Overdue Alert"
        message = "Attention: You have a task past its scheduled 24-hour deadline."

    notif = Notification(
        user_id=current_user.id,
        title=title,
        message=message,
        notification_type=alert_type,
        is_read=False
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif
