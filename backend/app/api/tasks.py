from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.task import Task
from app.models.notification import Notification
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("/", response_model=List[TaskResponse])
def get_user_tasks(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve all tasks belonging to the authenticated user.
    Auto-evaluates overdue status on fetch so client is always up to date.
    """
    query = db.query(Task).filter(Task.user_id == current_user.id)
    if status_filter:
        query = query.filter(Task.status == status_filter)

    tasks = query.order_by(Task.planned_start_time.asc()).all()

    # Check for freshly overdue tasks
    now_utc = datetime.now(timezone.utc)
    updated = False
    for task in tasks:
        task_end = task.planned_end_time
        if task_end.tzinfo is None:
            task_end = task_end.replace(tzinfo=timezone.utc)

        if task.status != "completed" and not task.is_overdue and task_end < now_utc:
            task.is_overdue = True
            updated = True
            # Create in-app notification
            db.add(Notification(
                user_id=current_user.id,
                title="Task Overdue!",
                message=f"Task '{task.title}' passed its scheduled end time ({task.planned_end_time.strftime('%H:%M')}).",
                notification_type="overdue_task",
                is_read=False
            ))

    if updated:
        db.commit()

    return tasks


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new scheduled task for the authenticated user.
    """
    if task_in.planned_end_time <= task_in.planned_start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Planned end time must be after planned start time."
        )

    task = Task(
        user_id=current_user.id,
        title=task_in.title,
        planned_start_time=task_in.planned_start_time,
        planned_end_time=task_in.planned_end_time,
        status="not_started",
        is_overdue=False
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_in: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a task's title or scheduled times.
    Strictly prevents modifying tasks owned by other users.
    """
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    if task_in.title is not None:
        task.title = task_in.title
    if task_in.planned_start_time is not None:
        task.planned_start_time = task_in.planned_start_time
    if task_in.planned_end_time is not None:
        task.planned_end_time = task_in.planned_end_time
    if task_in.status is not None:
        task.status = task_in.status

    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/start", response_model=TaskResponse)
def start_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Marks a task as 'started' and records the real started_at timestamp.
    """
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    task.status = "started"
    task.started_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/complete", response_model=TaskResponse)
def complete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Marks a task as 'completed' and records the real completed_at timestamp.
    Evaluates whether the completion was on time or overdue.
    """
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    now_utc = datetime.now(timezone.utc)
    task.status = "completed"
    task.completed_at = now_utc
    task.is_overdue = False  # Completing a task resolves and removes the overdue flag

    # If the user completed it without pressing start first, default started_at
    if not task.started_at:
        task.started_at = task.planned_start_time

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes a task belonging to the authenticated user.
    """
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully"}
