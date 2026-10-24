import time
from collections import defaultdict
from threading import Lock
from fastapi import Request, HTTPException, status

# In-memory storage for sliding window rate limiter: client_ip -> list of timestamps
_login_attempts = defaultdict(list)
_lock = Lock()


def check_login_rate_limit(request: Request, max_requests: int = 5, window_seconds: int = 60):
    """
    Sliding-window rate limiter for sensitive authentication endpoints (/api/auth/login).
    Restricts failed/repeated attempts to prevent brute-force attacks.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()

    with _lock:
        timestamps = _login_attempts[client_ip]
        # Purge timestamps outside the active sliding window
        valid_timestamps = [t for t in timestamps if now - t < window_seconds]
        _login_attempts[client_ip] = valid_timestamps

        if len(valid_timestamps) >= max_requests:
            retry_after = int(window_seconds - (now - valid_timestamps[0]))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many login attempts. Please wait {max(1, retry_after)} seconds before trying again.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        _login_attempts[client_ip].append(now)

    return True
