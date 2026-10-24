from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.task import Task
from app.schemas.analytics import (
    PeriodAnalyticsResponse,
    ComparisonData,
    ChartDataPoint,
    MetricBreakdown,
)
from app.services.productivity import calculate_metrics_for_tasks
from app.api.deps import get_current_user

router = APIRouter(prefix="/analytics", tags=["Performance Tracking"])

FORMULA_EXPLANATION = (
    "Productivity Score = (40% × Completion Rate) + (40% × On-Time Rate) + "
    "(20% × Time Efficiency) - (15% × Overdue Penalty). "
    "Designed to reward both finishing what you started and keeping promises on your schedule."
)


@router.get("/", response_model=PeriodAnalyticsResponse)
def get_analytics(
    period: str = Query("weekly", pattern=r"^(daily|weekly|monthly|annual)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Computes performance metrics and historical charts for daily, weekly, monthly, or annual intervals.
    Includes comparison against the immediately preceding period.
    """
    now_utc = datetime.now(timezone.utc)

    # 1. Determine date boundaries for Current vs Previous period
    if period == "daily":
        start_curr = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        end_curr = now_utc
        start_prev = start_curr - timedelta(days=1)
        end_prev = start_curr
    elif period == "weekly":
        start_curr = now_utc - timedelta(days=7)
        end_curr = now_utc
        start_prev = start_curr - timedelta(days=7)
        end_prev = start_curr
    elif period == "monthly":
        start_curr = now_utc - timedelta(days=30)
        end_curr = now_utc
        start_prev = start_curr - timedelta(days=30)
        end_prev = start_curr
    else:  # annual
        start_curr = now_utc - timedelta(days=365)
        end_curr = now_utc
        start_prev = start_curr - timedelta(days=365)
        end_prev = start_curr

    # 2. Fetch tasks for Current and Previous periods
    curr_tasks = db.query(Task).filter(
        Task.user_id == current_user.id,
        Task.planned_start_time >= start_curr,
        Task.planned_start_time <= end_curr
    ).all()

    prev_tasks = db.query(Task).filter(
        Task.user_id == current_user.id,
        Task.planned_start_time >= start_prev,
        Task.planned_start_time < end_prev
    ).all()

    # 3. Calculate metrics
    curr_metrics = calculate_metrics_for_tasks(curr_tasks)
    prev_metrics = calculate_metrics_for_tasks(prev_tasks)

    # 4. Compute Period-over-Period comparisons
    score_diff = round(curr_metrics.productivity_score - prev_metrics.productivity_score, 1)
    comp_diff = round(curr_metrics.completion_rate - prev_metrics.completion_rate, 1)
    ontime_diff = round(curr_metrics.on_time_rate - prev_metrics.on_time_rate, 1)
    improved = score_diff >= 0

    comparison = ComparisonData(
        score_difference=score_diff,
        completion_rate_diff=comp_diff,
        on_time_rate_diff=ontime_diff,
        improved=improved
    )

    # 5. Build dynamic chart data points
    chart_data: List[ChartDataPoint] = []
    if period == "daily":
        # Group by 4-hour intervals
        for hour in range(0, 24, 4):
            slot_start = start_curr + timedelta(hours=hour)
            slot_end = slot_start + timedelta(hours=4)
            slot_tasks = [t for t in curr_tasks if slot_start <= t.planned_start_time.replace(tzinfo=timezone.utc if t.planned_start_time.tzinfo is None else t.planned_start_time.tzinfo) < slot_end]
            m = calculate_metrics_for_tasks(slot_tasks)
            chart_data.append(ChartDataPoint(
                label=f"{hour:02d}:00",
                date_key=slot_start.strftime("%Y-%m-%d %H:00"),
                productivity_score=m.productivity_score,
                completed_count=m.completed_tasks,
                total_count=m.total_tasks
            ))
    elif period == "weekly":
        # 7 Days breakdown
        for day_offset in range(7):
            day_date = (start_curr + timedelta(days=day_offset)).date()
            day_tasks = [t for t in curr_tasks if t.planned_start_time.date() == day_date]
            m = calculate_metrics_for_tasks(day_tasks)
            chart_data.append(ChartDataPoint(
                label=day_date.strftime("%a"),
                date_key=str(day_date),
                productivity_score=m.productivity_score,
                completed_count=m.completed_tasks,
                total_count=m.total_tasks
            ))
    elif period == "monthly":
        # 5 6-day intervals
        for i in range(5):
            slot_start = start_curr + timedelta(days=i * 6)
            slot_end = slot_start + timedelta(days=6)
            slot_tasks = [t for t in curr_tasks if slot_start <= t.planned_start_time.replace(tzinfo=timezone.utc if t.planned_start_time.tzinfo is None else t.planned_start_time.tzinfo) < slot_end]
            m = calculate_metrics_for_tasks(slot_tasks)
            chart_data.append(ChartDataPoint(
                label=f"W{i+1}",
                date_key=f"Days {i*6+1}-{(i+1)*6}",
                productivity_score=m.productivity_score,
                completed_count=m.completed_tasks,
                total_count=m.total_tasks
            ))
    else:  # annual
        # 12 Months
        for m_idx in range(12):
            slot_start = start_curr + timedelta(days=m_idx * 30)
            slot_end = slot_start + timedelta(days=30)
            slot_tasks = [t for t in curr_tasks if slot_start <= t.planned_start_time.replace(tzinfo=timezone.utc if t.planned_start_time.tzinfo is None else t.planned_start_time.tzinfo) < slot_end]
            m = calculate_metrics_for_tasks(slot_tasks)
            chart_data.append(ChartDataPoint(
                label=slot_start.strftime("%b"),
                date_key=slot_start.strftime("%Y-%m"),
                productivity_score=m.productivity_score,
                completed_count=m.completed_tasks,
                total_count=m.total_tasks
            ))

    return PeriodAnalyticsResponse(
        period=period,
        start_date=start_curr.strftime("%Y-%m-%d"),
        end_date=end_curr.strftime("%Y-%m-%d"),
        current_metrics=curr_metrics,
        previous_metrics=prev_metrics,
        comparison=comparison,
        chart_data=chart_data,
        formula_explanation=FORMULA_EXPLANATION
    )
