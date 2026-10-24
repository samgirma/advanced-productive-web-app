from datetime import datetime, timezone
from typing import List
from app.models.task import Task
from app.schemas.analytics import MetricBreakdown


def calculate_metrics_for_tasks(tasks: List[Task]) -> MetricBreakdown:
    """
    Computes performance metrics and composite productivity score for a list of tasks.
    
    Formula:
    Productivity Score (0-100) =
        (0.35 * Completion Rate)
      + (0.35 * On-Time Rate)
      + (0.20 * Time Efficiency)
      - (0.10 * Overdue Rate)
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
    completed_with_duration = 0

    for task in tasks:
        # Planned duration in minutes
        planned_duration = max(1.0, (task.planned_end_time - task.planned_start_time).total_seconds() / 60.0)
        total_planned_minutes += planned_duration

        # Overdue check: marked overdue or completed after planned_end_time
        is_overdue = task.is_overdue
        if task.status == "completed" and task.completed_at and task.completed_at > task.planned_end_time:
            is_overdue = True
        elif task.status != "completed" and task.planned_end_time < datetime.now(task.planned_end_time.tzinfo or timezone.utc):
            is_overdue = True

        if is_overdue:
            overdue_count += 1

        if task.status == "completed":
            completed_tasks += 1
            # Check if completed on or before planned_end_time
            if task.completed_at and task.completed_at <= task.planned_end_time:
                on_time_tasks += 1

            # Actual minutes spent (if started_at and completed_at exist)
            if task.started_at and task.completed_at and task.completed_at >= task.started_at:
                actual_duration = max(1.0, (task.completed_at - task.started_at).total_seconds() / 60.0)
                total_actual_minutes += actual_duration
                completed_with_duration += 1
            else:
                # If started_at wasn't manually clicked, assume planned duration as neutral baseline
                total_actual_minutes += planned_duration
                completed_with_duration += 1

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
