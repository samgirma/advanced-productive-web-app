import logging
import os
import re
import sys
from contextvars import ContextVar
from logging.handlers import RotatingFileHandler
from pathlib import Path

# ContextVar storing the current HTTP request ID for the active execution context
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

SENSITIVE_PATTERNS = [
    re.compile(r"(password['\"]?\s*[:=]\s*['\"])[^'\"]+(['\"])", re.IGNORECASE),
    re.compile(r"(access_token['\"]?\s*[:=]\s*['\"])[^'\"]+(['\"])", re.IGNORECASE),
    re.compile(r"(Bearer\s+)[a-zA-Z0-9\-_.]+", re.IGNORECASE),
    re.compile(r"(secret['\"]?\s*[:=]\s*['\"])[^'\"]+(['\"])", re.IGNORECASE),
]


def _redact_match(match: re.Match) -> str:
    groups = match.groups()
    if len(groups) >= 2:
        return f"{groups[0]}***REDACTED***{groups[1]}"
    elif len(groups) == 1:
        return f"{groups[0]}***REDACTED***"
    return "***REDACTED***"


class RedactingFormatter(logging.Formatter):
    """
    Log formatter that injects the current Request ID and strictly redacts
    passwords, tokens, secrets, and private payload data.
    """
    def format(self, record: logging.LogRecord) -> str:
        # Inject request_id into record
        record.request_id = request_id_ctx.get()
        original_msg = super().format(record)

        # Redact sensitive patterns cleanly regardless of capture group count
        redacted = original_msg
        for pattern in SENSITIVE_PATTERNS:
            redacted = pattern.sub(_redact_match, redacted)
        return redacted


def setup_logging():
    """
    Configures structured, redacting, rotating logging for Productive:
    1. Console output (stdout) with request ID.
    2. Rotating file handler (productive.log) when on persistent writable disks.
    """
    formatter = RedactingFormatter(
        "%(asctime)s [%(levelname)s] [req:%(request_id)s] %(name)s: %(message)s"
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.handlers.clear()
    root_logger.addHandler(console_handler)

    # Attach file handler only if not in serverless / read-only Vercel environment
    is_vercel = os.getenv("VERCEL") == "1"
    if not is_vercel:
        try:
            log_dir = Path("./logs")
            log_dir.mkdir(parents=True, exist_ok=True)
            log_file = log_dir / "productive.log"
            file_handler = RotatingFileHandler(
                log_file,
                maxBytes=5 * 1024 * 1024,  # 5 MB per file
                backupCount=5,
                encoding="utf-8",
            )
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
        except Exception:
            pass  # Fall back strictly to console logging if disk is unwritable

    # Clean up third-party noise
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
    logging.getLogger("chromadb").setLevel(logging.WARNING)


logger = logging.getLogger("productive")
