from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from app.models.task import Task
from app.models.setting import Setting
from app.models.notification import Notification
from app.services.reminder_service import (
    check_and_process_daily_reminders,
    check_and_process_overdue_tasks,
)


def _get_auth_headers(client, email="taskuser@example.com"):
    res = client.post("/api/auth/register", json={
        "email": email,
        "password": "password123"
    })
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_task_status_lifecycle(client):
    """
    Validates task status progression:
    not_started -> started -> completed,
    and checks that started_at and completed_at timestamps are recorded accurately.
    """
    headers = _get_auth_headers(client, "lifecycle@example.com")
    now = datetime.now(timezone.utc)

    # 1. Create task
    create_res = client.post("/api/tasks/", json={
        "title": "Build integration pipeline",
        "planned_start_time": now.isoformat(),
        "planned_end_time": (now + timedelta(hours=2)).isoformat(),
    }, headers=headers)
    assert create_res.status_code == 201
    task = create_res.json()
    task_id = task["id"]
    assert task["status"] == "not_started"
    assert task["started_at"] is None
    assert task["completed_at"] is None
    assert task["is_overdue"] is False

    # 2. Transition: not_started -> started
    start_res = client.post(f"/api/tasks/{task_id}/start", headers=headers)
    assert start_res.status_code == 200
    started_task = start_res.json()
    assert started_task["status"] == "started"
    assert started_task["started_at"] is not None
    assert started_task["completed_at"] is None

    # 3. Transition: started -> completed
    complete_res = client.post(f"/api/tasks/{task_id}/complete", headers=headers)
    assert complete_res.status_code == 200
    completed_task = complete_res.json()
    assert completed_task["status"] == "completed"
    assert completed_task["completed_at"] is not None


def test_overdue_detection_and_completion_removes_overdue_flag(client):
    """
    Validates that:
    1. A task whose deadline has passed is marked overdue.
    2. Completing an overdue task clears/removes the overdue flag (is_overdue = False).
    """
    headers = _get_auth_headers(client, "overdue@example.com")
    now = datetime.now(timezone.utc)

    # 1. Create a task whose planned_end_time was 1 hour ago
    past_start = (now - timedelta(hours=2)).isoformat()
    past_end = (now - timedelta(hours=1)).isoformat()

    create_res = client.post("/api/tasks/", json={
        "title": "Past due maintenance task",
        "planned_start_time": past_start,
        "planned_end_time": past_end,
    }, headers=headers)
    assert create_res.status_code == 201
    task_id = create_res.json()["id"]

    # 2. Fetch tasks list: endpoint evaluates deadline and marks overdue
    get_res = client.get("/api/tasks/", headers=headers)
    assert get_res.status_code == 200
    tasks = get_res.json()
    target_task = next(t for t in tasks if t["id"] == task_id)
    assert target_task["is_overdue"] is True

    # 3. Completing the task must remove the overdue flag
    comp_res = client.post(f"/api/tasks/{task_id}/complete", headers=headers)
    assert comp_res.status_code == 200
    updated_task = comp_res.json()
    assert updated_task["status"] == "completed"
    assert updated_task["is_overdue"] is False


def test_timezone_aware_reminders_and_alerts(client, db_session):
    """
    Validates timezone handling:
    1. Times are stored in UTC.
    2. Daily reminders fire at the user's LOCAL timezone time, not UTC.
    """
    headers = _get_auth_headers(client, "timezone_user@example.com")

    # Set user timezone to 'America/New_York' (EDT / UTC-4) and plan_reminder_time to 08:00
    update_res = client.put("/api/settings/", json={
        "timezone": "America/New_York",
        "plan_reminder_time": "08:00",
        "journal_reminder_time": "21:00",
    }, headers=headers)
    assert update_res.status_code == 200
    settings_data = update_res.json()
    assert settings_data["timezone"] == "America/New_York"
    assert settings_data["plan_reminder_time"] == "08:00"

    user_id = settings_data["user_id"]

    # Test A: At 08:00 UTC, it is only 04:00 AM in New York!
    # The reminder should NOT fire.
    utc_at_0800 = datetime(2026, 10, 24, 8, 0, 0, tzinfo=timezone.utc)
    check_and_process_daily_reminders(db_session, current_utc=utc_at_0800)

    notifs_at_0800_utc = db_session.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.notification_type == "reminder_plan"
    ).all()
    assert len(notifs_at_0800_utc) == 0

    # Test B: In New York, 08:00 AM corresponds to 12:00 UTC (during EDT UTC-4).
    # When UTC is 12:00, New York is 08:00 AM -> Reminder MUST fire!
    ny_tz = ZoneInfo("America/New_York")
    ny_0800_local = datetime(2026, 10, 24, 8, 0, 0, tzinfo=ny_tz)
    ny_0800_in_utc = ny_0800_local.astimezone(timezone.utc)

    check_and_process_daily_reminders(db_session, current_utc=ny_0800_in_utc)

    notifs_at_ny_0800 = db_session.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.notification_type == "reminder_plan"
    ).all()
    assert len(notifs_at_ny_0800) == 1
    assert notifs_at_ny_0800[0].title == "Plan Your Day"
    assert "Please take a moment to plan your tasks" in notifs_at_ny_0800[0].message
