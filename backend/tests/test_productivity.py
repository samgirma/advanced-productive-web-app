from datetime import datetime, timedelta, timezone
from app.models.task import Task
from app.services.productivity import calculate_metrics_for_tasks


def test_empty_tasks_metrics():
    """Validates default 0 metrics when no tasks exist."""
    metrics = calculate_metrics_for_tasks([])
    assert metrics.total_tasks == 0
    assert metrics.productivity_score == 0.0
    assert metrics.completion_rate == 0.0


def test_perfect_productivity_score():
    """Validates 100% score when all tasks are completed on time within planned duration."""
    now = datetime.now(timezone.utc)
    t1 = Task(
        id=1,
        user_id=1,
        title="Code feature",
        status="completed",
        planned_start_time=now - timedelta(hours=2),
        planned_end_time=now - timedelta(hours=1),
        started_at=now - timedelta(hours=2),
        completed_at=now - timedelta(hours=1),  # Exactly on time
        is_overdue=False
    )
    t2 = Task(
        id=2,
        user_id=1,
        title="Review pull request",
        status="completed",
        planned_start_time=now - timedelta(minutes=45),
        planned_end_time=now,
        started_at=now - timedelta(minutes=45),
        completed_at=now - timedelta(minutes=5),  # Early / on time
        is_overdue=False
    )

    metrics = calculate_metrics_for_tasks([t1, t2])
    assert metrics.total_tasks == 2
    assert metrics.completed_tasks == 2
    assert metrics.completion_rate == 100.0
    assert metrics.on_time_rate == 100.0
    assert metrics.overdue_count == 0
    assert metrics.productivity_score == 100.0


def test_overdue_and_incomplete_penalty():
    """Validates penalties applied when tasks run overdue or remain incomplete."""
    now = datetime.now(timezone.utc)
    t1 = Task(
        id=1,
        user_id=1,
        title="Unfinished task",
        status="not_started",
        planned_start_time=now - timedelta(hours=3),
        planned_end_time=now - timedelta(hours=2),  # Past end time!
        started_at=None,
        completed_at=None,
        is_overdue=True
    )
    t2 = Task(
        id=2,
        user_id=1,
        title="Completed task",
        status="completed",
        planned_start_time=now - timedelta(hours=1),
        planned_end_time=now,
        started_at=now - timedelta(hours=1),
        completed_at=now,
        is_overdue=False
    )

    metrics = calculate_metrics_for_tasks([t1, t2])
    assert metrics.total_tasks == 2
    assert metrics.completed_tasks == 1
    assert metrics.completion_rate == 50.0
    assert metrics.overdue_count == 1
    # Score must be lower than 100 due to incomplete task and overdue penalty
    assert metrics.productivity_score < 60.0
