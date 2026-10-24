from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import Base, engine
from app.core.logging_config import setup_logging, logger
from app.core.scheduler import setup_scheduler, scheduler

# Import all models so Base.metadata knows about all tables
import app.models  # noqa

# Import API Routers
from app.api import auth, tasks, journal, memories, settings as settings_api, notifications, analytics


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager replacing deprecated startup/shutdown events.
    Initializes tables, logging, and background schedulers cleanly.
    """
    # 1. Setup logging
    setup_logging()
    logger.info("Initializing Productive application...")

    # 2. Ensure upload directory exists
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

    # 3. Create database tables if they do not exist
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified and ready.")

    # 4. Start background scheduler for reminders & overdue alerts
    setup_scheduler()
    scheduler.start()
    logger.info("APScheduler background tasks running.")

    yield

    # Shutdown
    logger.info("Shutting down background scheduler...")
    scheduler.shutdown()
    logger.info("Productive application shutdown complete.")


app = FastAPI(
    title=settings.APP_NAME,
    description="Full-stack personal productivity system API",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure Cross-Origin Resource Sharing (CORS)
# allow_credentials=True is required for HttpOnly cookies across ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded pictures and videos
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Register API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(journal.router, prefix="/api")
app.include_router(memories.router, prefix="/api")
app.include_router(settings_api.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "status": "online",
        "docs_url": "/docs",
        "health_check": "/health"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
