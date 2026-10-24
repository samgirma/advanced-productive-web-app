from typing import List, Optional
from pydantic import BaseModel


class MetricBreakdown(BaseModel):
    total_tasks: int
    completed_tasks: int
    completion_rate: float        # 0.0 - 100.0 %
    on_time_tasks: int
    on_time_rate: float           # 0.0 - 100.0 %
    overdue_count: int
    overdue_penalty_rate: float   # 0.0 - 100.0 %
    planned_minutes: float
    actual_minutes: float
    time_efficiency_rate: float   # 0.0 - 100.0 %
    productivity_score: float     # 0.0 - 100.0 composite


class ComparisonData(BaseModel):
    score_difference: float       # e.g., +12.5 or -5.0
    completion_rate_diff: float
    on_time_rate_diff: float
    improved: bool


class ChartDataPoint(BaseModel):
    label: str                    # e.g., "Mon", "Tue" or "Week 1" or "Jan"
    date_key: str
    productivity_score: float
    completed_count: int
    total_count: int


class PeriodAnalyticsResponse(BaseModel):
    period: str                   # "daily", "weekly", "monthly", "annual"
    start_date: str
    end_date: str
    current_metrics: MetricBreakdown
    previous_metrics: Optional[MetricBreakdown] = None
    comparison: Optional[ComparisonData] = None
    chart_data: List[ChartDataPoint]
    formula_explanation: str
