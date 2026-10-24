from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.schemas.ai import (
    CandidateTask,
    JournalInsightsSchema,
    AICoachReviewResponse,
)
from app.services.gemini_service import (
    parse_natural_language_tasks,
    generate_journal_insights,
    generate_ai_coach_review,
)
from app.services.langchain_journal import ask_journal_with_langchain


def test_natural_language_task_parsing():
    """
    Tests function calling task extraction for queries like:
    'gym tomorrow 6 to 7pm and study 8 to 10'
    """
    ref_dt = datetime(2026, 10, 24, 14, 0, tzinfo=ZoneInfo("UTC"))
    res = parse_natural_language_tasks(
        query="gym tomorrow 6 to 7pm and study 8 to 10",
        user_timezone_str="UTC",
        reference_dt=ref_dt,
    )

    assert len(res.candidate_tasks) >= 2
    titles = [t.title.lower() for t in res.candidate_tasks]
    assert any("gym" in t for t in titles)
    assert any("study" in t for t in titles)

    for task in res.candidate_tasks:
        assert isinstance(task, CandidateTask)
        assert task.planned_start_time.endswith("Z") or "+00:00" in task.planned_start_time
        assert task.planned_end_time.endswith("Z") or "+00:00" in task.planned_end_time


def test_structured_journal_insights():
    """
    Tests structured JSON output extraction conforming strictly to JournalInsightsSchema.
    """
    sample_entry = (
        "Today was an intense day. I finished the entire authentication module before lunch! "
        "Felt energized in the morning, but hit a wall around 4pm with database migration errors. "
        "Grateful for quiet time in the evening."
    )

    insights = generate_journal_insights(sample_entry, "2026-10-24")
    assert isinstance(insights, JournalInsightsSchema)
    assert insights.mood is not None
    assert len(insights.wins) >= 1
    assert len(insights.problems) >= 1
    assert isinstance(insights.suggestion_for_tomorrow, str)
    assert len(insights.suggestion_for_tomorrow) > 5


def test_ai_coach_review_and_privacy_guardrail():
    """
    Tests AI coach evaluation and verifies strict privacy:
    Private journal text must be omitted when allow_journal_text=False.
    Must always return exactly 3 actionable items.
    """
    metrics = {
        "total_tasks": 10,
        "completed_tasks": 8,
        "completion_rate": 80.0,
        "on_time_tasks": 7,
        "on_time_rate": 70.0,
        "overdue_count": 1,
        "time_efficiency_rate": 85.0,
        "productivity_score": 78.5,
    }

    # 1. Privacy with journal text disallowed
    review_private = generate_ai_coach_review(
        metrics_summary=metrics,
        optional_journal_snippets=["Private diary confession"],
        allow_journal_text=False,
    )
    assert isinstance(review_private, AICoachReviewResponse)
    assert review_private.includes_journal_text is False
    assert len(review_private.action_items) == 3
    assert len(review_private.strengths) >= 1

    # 2. Privacy with journal text explicitly allowed
    review_with_journal = generate_ai_coach_review(
        metrics_summary=metrics,
        optional_journal_snippets=["Reflected on deep work rhythm"],
        allow_journal_text=True,
    )
    assert review_with_journal.includes_journal_text is True
    assert len(review_with_journal.action_items) == 3


def test_langchain_ask_journal_chain():
    """
    Tests LangChain RAG synthesis over retrieved journal entries.
    """
    retrieved = [
        {
            "date": "2026-10-20",
            "content": "Completed 6 tasks early and felt on top of the world. Peak productivity day.",
            "mood": "Energized",
        },
        {
            "date": "2026-10-22",
            "content": "Low energy day, procrastinated on email.",
            "mood": "Tired",
        }
    ]

    answer_schema = ask_journal_with_langchain("when did I feel most productive?", retrieved)
    assert answer_schema.answer is not None
    assert "2026-10-20" in answer_schema.source_dates
