from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.database import SessionLocal
from app.core.logging_config import logger
from app.services.reminder_service import (
    check_and_process_overdue_tasks,
    check_and_process_daily_reminders,
)

scheduler = AsyncIOScheduler()


async def evaluate_tasks_and_reminders_job():
    """
    Periodic background job running every 60 seconds.
    Evaluates overdue tasks and generates daily morning/evening reminder notifications.
    """
    db = SessionLocal()
    try:
        check_and_process_overdue_tasks(db)
        check_and_process_daily_reminders(db)
    except Exception as exc:
        logger.error(f"Error executing scheduled reminder job: {exc}", exc_info=True)
    finally:
        db.close()


def setup_scheduler():
    """Configures scheduled background intervals."""
    scheduler.add_job(
        evaluate_tasks_and_reminders_job,
        trigger=IntervalTrigger(seconds=60),
        id="overdue_and_reminders_checker",
        replace_existing=True,
    )
    return scheduler
