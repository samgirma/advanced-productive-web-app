# Productive 🚀

A secure, login-based personal productivity and mindful daily life web application built with **FastAPI** (Python 3) and **React** (Vite), powered by the **Google Gemini API**.

---

## Architecture Overview

```
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│        React 19 Frontend        │  HTTP / JSON    │      FastAPI Backend (Python)   │
│  • Ruled Notebook Journal       │ ──────────────► │  • SQLAlchemy ORM (SQLite / PG) │
│  • Task Scheduling & Execution  │ ◄────────────── │  • Bcrypt & HttpOnly JWT Auth   │
│  • Daily Memories Media Gallery │  Credentials /  │  • APScheduler Background Jobs  │
│  • Performance Tracking (0-100) │  HttpOnly Cookie│  • Timezone-Aware Reminders     │
└─────────────────────────────────┘                 └────────────────┬────────────────┘
                                                                     │
                                                   Official SDK      │
                                              ┌──────────────────────┴────────────────┐
                                              ▼                                       ▼
                                   ┌──────────────────────┐               ┌──────────────────────┐
                                   │   gemini-3.8-flash   │               │ gemini-embedding-001 │
                                   │  Function Calling &  │               │   Semantic Vector    │
                                   │  Structured Outputs  │               │    Journal Search    │
                                   └──────────────────────┘               └──────────────────────┘
```

---

## AI Configuration (Google Gemini API)

The system uses the official `google-genai` SDK with models fully configurable in `.env`:

* **`GEMINI_MODEL`**: `gemini-3.8-flash` (Generative model used for Function Calling task creation, structured journal analysis, and AI coach reviews).
* **`GEMINI_EMBEDDING_MODEL`**: `gemini-embedding-001` (Official Google text embedding model for semantic vector search over journal entries).

---

## Productivity Score Formula (0 - 100)

$$\text{Productivity Score} = \max\Big(0, \min\big(100, (0.40 \times C) + (0.40 \times T) + (0.20 \times E) - (0.15 \times O)\big)\Big)$$

* **40% Completion Rate ($C$)**: Ratio of completed tasks to total planned tasks.
* **40% On-Time Discipline ($T$)**: Ratio of tasks completed on or before their planned deadline to total tasks.
* **20% Time Efficiency ($E$)**: Ratio of planned minutes to actual minutes spent (capped at 100%).
* **15% Overdue Penalty ($O$)**: Deductions applied for neglected overdue deadlines.
* **Result**: Perfectly calibrated between **0 and 100** (a flawless day achieves exactly 100.0).

---

## Quickstart Guide

### 1. Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate      # On Windows
pip install -r requirements.txt
python -m pytest tests -v     # Run test suite
python -m uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
