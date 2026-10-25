import os
import sys
from pathlib import Path

# Add backend directory to Python system path so 'app.*' imports resolve cleanly
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Import the FastAPI application instance
from app.main import app

# Vercel Serverless looks for an ASGI callable named `app`
