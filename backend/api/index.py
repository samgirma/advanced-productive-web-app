import os
import sys
from pathlib import Path

# Add backend directory to Python system path so 'app.*' imports resolve cleanly
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    # Import the FastAPI application instance
    from app.main import app
except Exception as e:
    import traceback
    err_trace = traceback.format_exc()
    print("FATAL ERROR ON STARTUP:\n", err_trace)
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    app = FastAPI(title="Diagnostics App")
    @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    def error_catcher(path_name: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Backend failed to initialize on Vercel",
                "details": str(e),
                "traceback": err_trace
            }
        )

