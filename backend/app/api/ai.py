from datetime import datetime, timezone, timedelta, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.task import Task
from app.models.journal import JournalEntry
from app.api.deps import get_current_user
from app.schemas.task import TaskResponse
from app.schemas.ai import (
    NaturalLanguageTaskInput,
    NaturalLanguageTaskResponse,
    BatchCreateTasksInput,
    JournalInsightsSchema,
    AICoachReviewResponse,
    AskJournalRequest,
    AskJournalResponse,
)
from app.services.gemini_service import (
    parse_natural_language_tasks,
    generate_journal_insights,
    generate_ai_coach_review,
)
from app.services.vector_store import search_journal_entries
from app.services.langchain_journal import ask_journal_with_langchain
from app.services.productivity import calculate_metrics_for_tasks

router = APIRouter(prefix="/ai", tags=["Artificial Intelligence"])


@router.post("/parse-tasks", response_model=NaturalLanguageTaskResponse)
def parse_tasks_endpoint(
    payload: NaturalLanguageTaskInput,
    current_user: User = Depends(get_current_user),
):
    """
    Function Calling Endpoint:
    Parses unstructured text (e.g. 'gym tomorrow 6 to 7pm and study 8 to 10')
    into candidate task proposals using Gemini function calling.
    Candidate tasks are returned to the user for explicit confirmation before saving.
    """
    user_tz = payload.timezone_str or current_user.timezone or "UTC"
    return parse_natural_language_tasks(
        query=payload.query,
        user_timezone_str=user_tz,
    )


@router.post("/confirm-tasks", response_model=List[TaskResponse], status_code=status.HTTP_201_CREATED)
def confirm_tasks_endpoint(
    payload: BatchCreateTasksInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Persists confirmed candidate tasks into the database following user verification.
    """
    created_tasks = []
    now_utc = datetime.now(timezone.utc)

    for item in payload.tasks:
        try:
            start_dt = datetime.fromisoformat(item.planned_start_time.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(item.planned_end_time.replace("Z", "+00:00"))
        except Exception:
            start_dt = now_utc + timedelta(hours=1)
            end_dt = start_dt + timedelta(hours=1)

        task = Task(
            user_id=current_user.id,
            title=item.title,
            planned_start_time=start_dt,
            planned_end_time=end_dt,
            status="not_started",
            is_overdue=False,
        )
        db.add(task)
        created_tasks.append(task)

    db.commit()
    for t in created_tasks:
        db.refresh(t)

    return created_tasks


@router.get("/journal-insights", response_model=JournalInsightsSchema)
def get_journal_insights_endpoint(
    entry_date: date = Query(default_factory=date.today),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Structured Output Endpoint:
    Analyzes the specified day's journal entry and returns a validated JSON schema
    containing mood, key activities, wins, problems, and one actionable recommendation for tomorrow.
    """
    entry = db.query(JournalEntry).filter(
        JournalEntry.user_id == current_user.id,
        JournalEntry.entry_date == entry_date,
    ).first()

    content = entry.content if entry else ""
    return generate_journal_insights(content, str(entry_date))


@router.get("/coach-review", response_model=AICoachReviewResponse)
def get_coach_review_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    AI Performance Coach Endpoint:
    Audits the user's weekly metrics (completion rate, punctuality, efficiency, overdue count).
    Strict Privacy Rule: Journal reflections are completely omitted unless user explicitly
    enabled 'allow_ai_journal_review' in settings.
    """
    now_utc = datetime.now(timezone.utc)
    week_ago = now_utc - timedelta(days=7)

    # 1. Fetch past 7 days of tasks
    tasks = db.query(Task).filter(
        Task.user_id == current_user.id,
        Task.created_at >= week_ago,
    ).all()

    metrics = calculate_metrics_for_tasks(tasks).model_dump()

    # 2. Check user's privacy preference
    allow_journal = False
    journal_snippets = []
    if current_user.settings and current_user.settings.allow_ai_journal_review:
        allow_journal = True
        entries = db.query(JournalEntry).filter(
            JournalEntry.user_id == current_user.id,
            JournalEntry.entry_date >= (week_ago.date()),
        ).all()
        journal_snippets = [e.content for e in entries if e.content]

    return generate_ai_coach_review(
        metrics_summary=metrics,
        optional_journal_snippets=journal_snippets,
        allow_journal_text=allow_journal,
    )


@router.post("/ask-journal", response_model=AskJournalResponse)
def ask_journal_endpoint(
    payload: AskJournalRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Vector Search & RAG Endpoint ('Ask My Journal'):
    Uses ChromaDB cosine similarity search over embedded journal entries,
    then executes the LangChain question-answering chain to synthesize an answer
    with exact citation dates.
    """
    # 1. Vector similarity search in user's isolated Chroma collection
    retrieved_entries = search_journal_entries(
        user_id=current_user.id,
        query=payload.query,
        top_k=4,
    )

    # 2. Synthesize answer using LangChain RAG pipeline
    result = ask_journal_with_langchain(payload.query, retrieved_entries)

    return AskJournalResponse(
        query=payload.query,
        answer=result.answer,
        source_dates=result.source_dates,
        used_fallback=(result.confidence == "insufficient_data"),
    )
