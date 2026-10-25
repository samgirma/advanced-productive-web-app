import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import Base, engine
from app.core.logging_config import setup_logging, logger, request_id_ctx
from app.core.scheduler import setup_scheduler, scheduler

# Import all models so Base.metadata knows about all tables
import app.models  # noqa

# Import API Routers
from app.api import (
    auth,
    tasks,
    journal,
    memories,
    settings as settings_api,
    notifications,
    analytics,
    ai,
    webhooks,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager replacing deprecated startup/shutdown events.
    Initializes tables, logging, vector storage, and background schedulers cleanly.
    """
    # 1. Setup structured rotating logging
    setup_logging()
    logger.info("Initializing Productive application...")

    # 2. Ensure upload and persistent chroma directories exist
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)

    # 3. Create database tables if they do not exist
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified and ready.")

    # 4. Start background scheduler for reminders & overdue alerts (only if not on serverless Vercel)
    if not settings.VERCEL:
        try:
            setup_scheduler()
            scheduler.start()
            logger.info("APScheduler background tasks running.")
        except Exception as e:
            logger.warning(f"Could not start APScheduler: {e}")
    else:
        logger.info("Running on Vercel serverless environment; skipping background scheduler thread.")

    yield

    # Shutdown
    if not settings.VERCEL and scheduler.running:
        logger.info("Shutting down background scheduler...")
        scheduler.shutdown()
    logger.info("Productive application shutdown complete.")


app = FastAPI(
    title=settings.APP_NAME,
    description="Full-stack personal productivity system API with Gemini AI, Vector Search, and Automation Webhooks",
    version="2.0.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Request ID Tracking & Structured Logging Middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def request_id_logging_middleware(request: Request, call_next):
    # Retrieve incoming X-Request-ID or generate a fresh UUID4
    req_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
    token = request_id_ctx.set(req_id)

    logger.info(f"Incoming {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = req_id
        return response
    finally:
        request_id_ctx.reset(token)


# ---------------------------------------------------------------------------
# Global Exception Handler
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    req_id = request_id_ctx.get()
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred. Please contact support or check logs.",
            "request_id": req_id,
            "status": "error",
        },
        headers={"X-Request-ID": req_id},
    )


# Configure Cross-Origin Resource Sharing (CORS)
cors_origins = settings.cors_origins_list
cors_origin_regex = None
# If CORS_ORIGINS includes vercel wildcard or localhost, allow vercel preview deployments
if any(".vercel.app" in o for o in cors_origins) or "*" in cors_origins:
    cors_origin_regex = r"^https://.*\.vercel\.app$"
    if "*" in cors_origins:
        cors_origins = [o for o in cors_origins if o != "*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins else ["*"],
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
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
app.include_router(ai.router, prefix="/api")
app.include_router(webhooks.router, prefix="/api")


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "status": "online",
        "docs_url": "/docs",
        "health_check": "/health",
        "gemini_model": settings.GEMINI_MODEL,
        "embedding_model": settings.GEMINI_EMBEDDING_MODEL,
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "database": "connected",
        "scheduler": "active" if scheduler.running else "inactive",
    }
