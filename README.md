# Productive 🚀

A secure, login-based personal productivity and mindful daily life web application built with **FastAPI** (Python 3) and **React 19** (Vite), powered by **Google Gemini AI**, **LangChain**, and **ChromaDB**.

---

## Architecture Overview

```text
┌──────────────────────────────────────────────┐                 ┌────────────────────────────────────────────────────────┐
│              React 19 Frontend               │  HTTP / JSON    │                FastAPI Backend (Python)                │
│  • AI Quick Schedule (Gemini Tool Call)      │ ──────────────► │  • SQLAlchemy ORM (SQLite / PostgreSQL)                │
│  • Ruled Notebook Journal + Mood Selector    │ ◄────────────── │  • Bcrypt & HttpOnly Cookie JWT Authentication         │
│  • "Ask My Journal" Semantic Search          │  Credentials /  │  • APScheduler + Timezone-Aware Overdue System         │
│  • AI Journal Insights (Structured JSON)     │  HttpOnly Cookie│  • Structured Redacting Rotating Logger (req-id)       │
│  • Weekly AI Performance Coach Review        │                 │  • In-Memory Sliding-Window Login Rate Limiter         │
│  • Media Vault (Image / Video Lightbox)      │                 │  • Protected Webhooks for n8n / Make / Zapier          │
└──────────────────────┬───────────────────────┘                 └───────────┬────────────────────────────────┬───────────┘
                       │                                                     │                                │
                       │                                        Official SDK │                   Embeddings   │
                       │                                  ┌──────────────────┴─────────────┐    ┌─────────────┴─────────────┐
                       ▼                                  ▼                                ▼    ▼                           ▼
            ┌──────────────────────┐           ┌──────────────────────┐         ┌─────────────────────┐   ┌───────────────────┐
            │ Nginx Reverse Proxy  │           │   gemini-3.8-flash   │         │gemini-embedding-001 │   │ Chroma Vector DB  │
            │ Port 80 / Port 5173  │           │  Function Calling &  │         │  Dense Vector Math  │   │ Persistent Cosine │
            └──────────────────────┘           │  Structured Outputs  │         └─────────────────────┘   │   Journal Index   │
                                               └──────────────────────┘                                   └───────────────────┘
```

---

## Key Features

1. **Natural-Language Task Creation with Function Calling**:
   * Type naturally: *"gym tomorrow 6 to 7pm and study 8 to 10"*.
   * Gemini executes `create_task(title, start_time, end_time)` tool calls converted to your local timezone.
   * Review and confirm candidates in an interactive preview modal before scheduling.
2. **Mindful Ruled Journal & Daily Reflections**:
   * Autosaving notebook with mood tracking (*Energized, Calm, Focused, Reflective, Tired*).
3. **Structured AI Journal Insights**:
   * Analyzes daily reflections into validated JSON: detected emotional state, key activities, wins, obstacles, and one actionable recommendation for tomorrow.
4. **"Ask My Journal" Vector Search (RAG)**:
   * ChromaDB vector database embedding your reflections with `gemini-embedding-001`.
   * Ask questions like *"when did I feel most productive?"* or *"what did I do on my birthday last year?"*, answered with direct source date citations.
5. **Weekly Executive AI Performance Coach**:
   * Evaluates completion discipline, on-time percentage, time efficiency, and overdue drag.
   * **Strict Privacy Mode**: Analyzes numerical score trends only—private journal text is never sent unless explicitly enabled in user settings.
   * Outputs strengths, improvement areas, and exactly 3 high-impact action recommendations.
6. **Productivity Scoring Formula (0 - 100)**:
   $$\text{Score} = \max\Big(0, \min\big(100, (0.40 \times C) + (0.40 \times T) + (0.20 \times E) - (0.15 \times O)\big)\Big)$$
7. **n8n / Make / Zapier Webhook Automations**:
   * Pre-built importable workflows for scheduled email reminders, external task ingestion (e.g. iOS Shortcuts), and failure alerting.

---

## How to Get Required API Keys

### 1. Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com).
2. Sign in with your Google account.
3. Click **Get API key** > **Create API key in new project**.
4. Copy the generated key and set it as `GEMINI_API_KEY` in your `.env` or deployment variables.

### 2. n8n Webhook Secret Token
* Create any random high-entropy token (e.g. `openssl rand -hex 24`).
* Set `N8N_WEBHOOK_SECRET` in `backend/.env` and enter the identical value into your n8n Credentials header (`X-N8N-Secret`).

---

## Quickstart Guide

### Option A: Run Locally

#### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate       # On Linux/macOS
# .\venv\Scripts\activate     # On Windows

pip install -r requirements.txt
python -m pytest tests -v      # Run full test suite (18/18 tests)
uvicorn app.main:app --reload --port 8000
```
Backend API will be running at [http://localhost:8000](http://localhost:8000).
Swagger Docs: [http://localhost:8000/docs](http://localhost:8000/docs).

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### Option B: Run with Docker Compose (Recommended)

Orchestrates PostgreSQL 16, FastAPI backend, and compiled React Nginx frontend:

```bash
# From project root
docker compose up --build -d
```

* **Frontend**: [http://localhost:5173](http://localhost:5173) or [http://localhost](http://localhost)
* **Backend API**: [http://localhost:8000](http://localhost:8000)
* **Database**: PostgreSQL 16 on `localhost:5432` with persistent volumes.

To shut down:
```bash
docker compose down
```

---

## Importing n8n Workflows

Pre-configured, importable workflow JSON files reside in `./n8n/`:

1. Open your n8n instance (e.g. [http://localhost:5678](http://localhost:5678)).
2. Click **Workflows > Import from File** (or top-right three dots > **Import from File**).
3. Import the workflows:
   * **`n8n/due_notifications_workflow.json`**: Scheduled minute cron trigger polling `/api/webhooks/due-notifications` and dispatching emails.
   * **`n8n/external_ingest_workflow.json`**: Inbound webhook receiving tasks or journal notes from external devices/shortcuts.
   * **`n8n/error_handler_workflow.json`**: Global error handling alert trigger.
4. Set up an n8n Header Auth Credential with:
   * **Header Name**: `X-N8N-Secret`
   * **Value**: Match `N8N_WEBHOOK_SECRET` in your backend `.env`.

*For detailed cron explanations, Make blueprints, and Zapier setup, see [`docs/AUTOMATION_GUIDE.md`](file:///home/sami/Projects/prodactive-/docs/AUTOMATION_GUIDE.md).*

---

## Production Deployment (Render)

1. **Database**: Create a **PostgreSQL** instance on [Render](https://render.com). Copy the Internal Database URL.
2. **Backend**:
   * Create a **Web Service** connecting this repo.
   * Root Directory: `backend`
   * Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   * Add Environment Variables: `DATABASE_URL`, `SECRET_KEY`, `GEMINI_API_KEY`, `CORS_ORIGINS`.
3. **Frontend**:
   * Create a **Static Site** on Render.
   * Root Directory: `frontend`
   * Build Command: `npm install && npm run build`
   * Publish Directory: `dist`
   * Add rewrite rule: `/*` -> `/index.html`.
4. **Continuous Deployment**: Add your Render Deploy Hook as a GitHub Secret (`RENDER_DEPLOY_HOOK_URL`) to enable automatic deploys on every push to `main`.

*For ephemeral storage details, Cloudinary/S3 integration, and security checklists, see [`docs/DEPLOYMENT_AND_SECURITY.md`](file:///home/sami/Projects/prodactive-/docs/DEPLOYMENT_AND_SECURITY.md).*

---

## Automated Testing

Run the full backend test suite:
```bash
cd backend
./venv/bin/python -m pytest tests -v
```

Tests cover:
* Authentication isolation and JWT verification.
* Productivity score formula calibrations (perfect score, overdue penalties, duration efficiency).
* Natural language Function Calling parsing with Gemini.
* Structured Pydantic JSON journal insights.
* Weekly AI Coach evaluations and strict privacy guardrails.
* ChromaDB vector storage and semantic search.
* Webhook secret security and external ingestion pipelines.
