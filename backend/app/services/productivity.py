from datetime import datetime, timezone
from typing import List, Optional
from app.models.task import Task
from app.schemas.analytics import MetricBreakdown


def to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Safely normalizes any datetime (offset-naive or offset-aware) to UTC.
    Prevents TypeError: can't compare offset-naive and offset-aware datetimes.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def calculate_metrics_for_tasks(tasks: List[Task]) -> MetricBreakdown:
    """
    Computes performance metrics and composite productivity score for a list of tasks.
    
    Formula:
    Productivity Score (0-100) =
        (0.40 * Completion Rate)
      + (0.40 * On-Time Rate)
      + (0.20 * Time Efficiency)
      - (0.15 * Overdue Rate)
    """
    total_tasks = len(tasks)
    if total_tasks == 0:
        return MetricBreakdown(
            total_tasks=0,
            completed_tasks=0,
            completion_rate=0.0,
            on_time_tasks=0,
            on_time_rate=0.0,
            overdue_count=0,
            overdue_penalty_rate=0.0,
            planned_minutes=0.0,
            actual_minutes=0.0,
            time_efficiency_rate=0.0,
            productivity_score=0.0,
        )

    completed_tasks = 0
    on_time_tasks = 0
    overdue_count = 0
    total_planned_minutes = 0.0
    total_actual_minutes = 0.0
    now_utc = datetime.now(timezone.utc)

    for task in tasks:
        start_time = to_utc(task.planned_start_time)
        end_time = to_utc(task.planned_end_time)
        completed_at = to_utc(task.completed_at)
        started_at = to_utc(task.started_at)

        # Planned duration in minutes
        if end_time and start_time:
            planned_duration = max(1.0, (end_time - start_time).total_seconds() / 60.0)
        else:
            planned_duration = 60.0
        total_planned_minutes += planned_duration

        # Overdue check: marked overdue or completed after planned_end_time
        is_overdue = bool(task.is_overdue)
        if task.status == "completed" and completed_at and end_time and completed_at > end_time:
            is_overdue = True
        elif task.status != "completed" and end_time and end_time < now_utc:
            is_overdue = True

        if is_overdue:
            overdue_count += 1

        if task.status == "completed":
            completed_tasks += 1
            # Check if completed on or before planned_end_time
            if completed_at and end_time and completed_at <= end_time:
                on_time_tasks += 1

            # Actual minutes spent (if started_at and completed_at exist)
            if started_at and completed_at and completed_at >= started_at:
                actual_duration = max(1.0, (completed_at - started_at).total_seconds() / 60.0)
                total_actual_minutes += actual_duration
            else:
                # If started_at wasn't manually clicked, assume planned duration as neutral baseline
                total_actual_minutes += planned_duration

    # 1. Completion Rate (0-100)
    completion_rate = (completed_tasks / total_tasks) * 100.0

    # 2. On-Time Rate (0-100) - evaluated against total tasks planned
    on_time_rate = (on_time_tasks / total_tasks) * 100.0

    # 3. Overdue Penalty Rate (0-100)
    overdue_rate = (overdue_count / total_tasks) * 100.0

    # 4. Time Efficiency (0-100)
    if total_actual_minutes > 0 and total_planned_minutes > 0 and completed_tasks > 0:
        raw_eff = (total_planned_minutes / total_actual_minutes) * 100.0
        time_efficiency_rate = min(100.0, raw_eff)
    else:
        time_efficiency_rate = 100.0 if completed_tasks > 0 else 0.0

    # 5. Composite Productivity Score (0-100)
    # Weights sum to 100 (40% Completion + 40% On-Time + 20% Efficiency) minus overdue deduction
    raw_score = (
        (0.40 * completion_rate)
        + (0.40 * on_time_rate)
        + (0.20 * time_efficiency_rate)
        - (0.15 * overdue_rate)
    )
    final_score = round(max(0.0, min(100.0, raw_score)), 1)

    return MetricBreakdown(
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        completion_rate=round(completion_rate, 1),
        on_time_tasks=on_time_tasks,
        on_time_rate=round(on_time_rate, 1),
        overdue_count=overdue_count,
        overdue_penalty_rate=round(overdue_rate, 1),
        planned_minutes=round(total_planned_minutes, 1),
        actual_minutes=round(total_actual_minutes, 1),
        time_efficiency_rate=round(time_efficiency_rate, 1),
        productivity_score=final_score,
    )
