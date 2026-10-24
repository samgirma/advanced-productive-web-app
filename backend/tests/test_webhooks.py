import pytest
from app.core.config import settings
from app.models.user import User
from app.models.setting import Setting
from app.models.task import Task
from app.models.journal import JournalEntry


def test_webhook_secret_security(client):
    """
    Verifies that requests without the secret token receive HTTP 401 Unauthorized.
    """
    res = client.get("/api/webhooks/due-notifications")
    assert res.status_code == 401

    res_wrong = client.get(
        "/api/webhooks/due-notifications",
        headers={"X-N8N-Secret": "invalid_wrong_secret"}
    )
    assert res_wrong.status_code == 401


def test_webhook_due_notifications_authorized(client, db_session):
    """
    Tests authorized retrieval of due notifications with secret header.
    """
    res = client.get(
        "/api/webhooks/due-notifications",
        headers={"X-N8N-Secret": settings.N8N_WEBHOOK_SECRET}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "notifications" in data
    assert isinstance(data["notifications"], list)


def test_webhook_external_task_ingest(client, db_session):
    """
    Tests Workflow (b) ingesting an external task via webhook.
    """
    # Create target user
    user = User(email="webhook_user@example.com", hashed_password="hashed_pw_dummy")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    payload = {
        "user_email": "webhook_user@example.com",
        "type": "task",
        "title": "Ingested task from iOS Shortcut",
        "start_time": "2026-10-25T14:00:00Z",
        "end_time": "2026-10-25T15:00:00Z"
    }

    res = client.post(
        "/api/webhooks/external-ingest",
        json=payload,
        headers={"X-N8N-Secret": settings.N8N_WEBHOOK_SECRET}
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "created"
    assert data["type"] == "task"

    # Verify task in database
    task = db_session.query(Task).filter(Task.user_id == user.id).first()
    assert task is not None
    assert task.title == "Ingested task from iOS Shortcut"


def test_webhook_external_journal_ingest(client, db_session):
    """
    Tests Workflow (b) ingesting an external journal note via webhook.
    """
    user = User(email="journal_webhook_user@example.com", hashed_password="hashed_pw_dummy")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    payload = {
        "user_email": "journal_webhook_user@example.com",
        "type": "journal",
        "content": "Quick captured thought while walking: ideas for Q4 project.",
        "entry_date": "2026-10-24",
        "mood": "calm"
    }

    res = client.post(
        "/api/webhooks/external-ingest",
        json=payload,
        headers={"X-N8N-Secret": settings.N8N_WEBHOOK_SECRET}
    )
    assert res.status_code == 201
    data = res.json()
    assert data["type"] == "journal"

    # Verify journal entry in database
    entry = db_session.query(JournalEntry).filter(JournalEntry.user_id == user.id).first()
    assert entry is not None
    assert "ideas for Q4 project" in entry.content
    assert entry.mood == "calm"
