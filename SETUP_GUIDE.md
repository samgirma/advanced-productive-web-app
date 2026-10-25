# Productive - Complete Setup & Installation Guide

A comprehensive, step-by-step setup guide for running **Productive** locally, with Docker, or deploying to Vercel.

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Project Architecture Overview](#2-project-architecture-overview)
3. [Local Development Setup](#3-local-development-setup)
   - [Step A: Backend Setup (FastAPI)](#step-a-backend-setup-fastapi)
   - [Step B: Frontend Setup (React + Vite)](#step-b-frontend-setup-react--vite)
4. [Docker Setup (One-Command Run)](#4-docker-setup-one-command-run)
5. [Environment Variables Reference](#5-environment-variables-reference)
6. [Testing & Verification](#6-testing--verification)
7. [Automations & AI Configuration (Optional)](#7-automations--ai-configuration-optional)
8. [Vercel Deployment Guide](#8-vercel-deployment-guide)
9. [Troubleshooting & Common Issues](#9-troubleshooting--common-issues)

---

## 1. Prerequisites

Before starting, ensure you have the following installed on your machine:

- **Python**: Version `3.11` to `3.14`
- **Node.js**: Version `18.x` or higher (with `npm`)
- **Git**: Installed and configured
- **Docker & Docker Compose** *(Optional, only if running via containers)*

---

## 2. Project Architecture Overview

```
productive/
├── backend/                  # FastAPI Application
│   ├── app/                  # Application core, models, schemas, and routes
│   │   ├── api/              # Endpoints: auth, tasks, journal, memories, ai, webhooks
│   │   ├── core/             # Database, config, security, logging, scheduler
│   │   ├── models/           # SQLAlchemy DB models (User, Task, Journal, Memory, etc.)
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   └── services/         # Gemini AI, LangChain, ChromaDB, productivity metrics
│   ├── api/index.py          # Vercel Serverless entrypoint
│   ├── tests/                # Automated pytest suite (18 unit & integration tests)
│   ├── requirements.txt      # Python dependencies
│   └── vercel.json           # Backend Vercel serverless configuration
├── frontend/                 # React 19 + Vite Single Page Application
│   ├── src/                  # Components, pages, contexts, services
│   │   ├── pages/            # Dashboard, Journal, Analytics, Memories, Settings, Login
│   │   ├── services/api.js   # Centralized API fetch wrapper with Bearer + Cookie auth
│   │   └── utils/dateUtils.js# Timezone & date calculation utilities
│   ├── package.json          # Node dependencies
│   └── vercel.json           # Frontend Vercel SPA routing configuration
├── n8n/                      # Pre-built automation workflow JSON files
├── docs/                     # Guides for Deployment, Vercel, and Automation
├── docker-compose.yml        # Multi-container orchestration (FastAPI + React/Nginx)
└── SETUP_GUIDE.md            # This step-by-step document
```

---

## 3. Local Development Setup

To run both services side-by-side on your local machine:

### Step A: Backend Setup (FastAPI)

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a Python virtual environment**:
   ```bash
   # Linux / macOS:
   python3 -m venv venv
   source venv/bin/activate

   # Windows (Command Prompt):
   python -m venv venv
   venv\Scripts\activate.bat

   # Windows (PowerShell):
   python -m venv venv
   venv\Scripts\Activate.ps1
   ```

3. **Install backend dependencies**:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   Create a `.env` file inside the `backend/` directory:
   ```bash
   cp .env.example .env
   ```
   *(Or edit `backend/.env` with your preferred text editor)*:
   ```ini
   APP_NAME=Productive API
   SECRET_KEY=super_secret_development_key_change_in_production
   ACCESS_TOKEN_EXPIRE_MINUTES=10080
   DATABASE_URL=sqlite:///./productive.db
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   N8N_WEBHOOK_SECRET=dev_n8n_secret_token_12345

   # Optional: Add your Google Gemini API Key from https://aistudio.google.com
   GEMINI_API_KEY=
   GEMINI_MODEL=gemini-3.8-flash
   GEMINI_EMBEDDING_MODEL=gemini-embedding-001
   ```

5. **Run the backend development server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   - **Interactive API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Health Check Endpoint**: [http://localhost:8000/health](http://localhost:8000/health)

---

### Step B: Frontend Setup (React + Vite)

Open a new terminal window:

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables (Optional for local dev)**:
   In local development, the Vite dev server already proxies `/api` and `/uploads` to `http://127.0.0.1:8000`.
   If you wish to point explicitly to another backend host, create a `.env` file inside `frontend/`:
   ```bash
   cp .env.example .env
   ```
   And set:
   ```ini
   VITE_API_URL=http://localhost:8000
   ```

4. **Start the frontend development server**:
   ```bash
   npm run dev
   ```
   - Open your browser to: **[http://localhost:5173](http://localhost:5173)**

---

## 4. Docker Setup (One-Command Run)

If you prefer running everything using Docker without installing Python or Node locally:

1. **Ensure Docker and Docker Compose are running**.
2. **From the root directory**, execute:
   ```bash
   docker compose up --build -d
   ```
3. **Services launched**:
   - **Frontend**: [http://localhost:80](http://localhost:80)
   - **Backend API**: [http://localhost:8000](http://localhost:8000)
   - **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
4. **To view logs**:
   ```bash
   docker compose logs -f
   ```
5. **To stop containers**:
   ```bash
   docker compose down
   ```

---

## 5. Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SECRET_KEY` | **Yes** | `super_secret_development_key...` | Cryptographic secret for signing JWT tokens. |
| `DATABASE_URL` | No | `sqlite:///./productive.db` | SQLAlchemy connection string (SQLite, PostgreSQL, etc.). |
| `CORS_ORIGINS` | No | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of allowed frontend origins (or `*`). |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `10080` (7 days) | Session duration for authentication. |
| `GEMINI_API_KEY` | No | `""` | Google Gemini API key. Required for AI task parsing, journal insights, and vector search embeddings. |
| `GEMINI_MODEL` | No | `gemini-3.8-flash` | Gemini model name used for task parsing and journal insights. |
| `GEMINI_EMBEDDING_MODEL` | No | `gemini-embedding-001` | Model name for vector embeddings. |
| `N8N_WEBHOOK_SECRET` | No | `dev_n8n_secret_token_12345` | Secret header required on `/api/webhooks/` routes (`X-N8N-Secret`). |
| `UPLOAD_DIR` | No | `./uploads` | Local storage folder for pictures and videos. |
| `CHROMA_PERSIST_DIR` | No | `./chroma_db` | Persistent folder for local vector database. |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `""` (relative `/api`) | Base URL of the backend API (e.g. `https://your-api.vercel.app`). Leave empty for local Vite proxy. |

---

## 6. Testing & Verification

### Running Backend Automated Tests
All 18 automated tests cover authentication, task state transitions, productivity scoring formulas, Gemini AI mock fallbacks, ChromaDB vector indexing, and webhook security.

```bash
cd backend
./venv/bin/python -m pytest tests -v
```

### Building Frontend for Production
```bash
cd frontend
npm run build
```
Build output is saved to `frontend/dist/`.

---

## 7. Automations & AI Configuration (Optional)

### Enabling Gemini AI Features
1. Get a free API key at [Google AI Studio](https://aistudio.google.com).
2. Add your key to `backend/.env`:
   ```ini
   GEMINI_API_KEY=your_actual_api_key_here
   ```
3. Restart the backend.
4. **Features unlocked**:
   - **Natural Language Task Creation**: Type *"gym tomorrow from 6 to 7pm and study 8 to 10"* in Dashboard.
   - **AI Journal Insights**: Structured breakdown of mood, wins, and next-day suggestions in Journal.
   - **AI Coach Review**: Weekly performance review with strengths and actionable advice in Analytics.
   - **Semantic Journal Search**: Query past journals using natural questions like *"when did I feel productive?"*

### Importing n8n / Automation Workflows
Workflow templates are ready in the `n8n/` folder:
- `n8n/due_notifications_workflow.json`: Polls overdue/upcoming tasks and sends alerts.
- `n8n/external_ingest_workflow.json`: Ingests tasks and journals from external sources (Slack, Telegram, iOS Shortcuts).
- `n8n/error_handler_workflow.json`: Handles retries and alerts on automation failures.

Refer to [`docs/AUTOMATION_GUIDE.md`](docs/AUTOMATION_GUIDE.md) for full setup instructions.

---

## 8. Vercel Deployment Guide

Both frontend and backend are configured to deploy to Vercel as **independent projects**.

### Step 1: Deploy Backend (FastAPI Serverless)
1. In the [Vercel Dashboard](https://vercel.com), click **Add New Project** $\rightarrow$ Select this repo.
2. Set **Root Directory** to `backend`.
3. Set **Framework Preset** to **Other**.
4. Add environment variables:
   - `SECRET_KEY`: Random 32-character string.
   - `CORS_ORIGINS`: `*` (or your frontend Vercel URL once created).
   - `DATABASE_URL`: *(Optional cloud Postgres URL like Neon/Supabase; defaults to `/tmp/productive.db`)*.
   - `GEMINI_API_KEY`: *(Optional Gemini key)*.
5. Click **Deploy**. Note your live backend URL (e.g., `https://productive-api.vercel.app`).

### Step 2: Deploy Frontend (Vite SPA)
1. In Vercel, click **Add New Project** $\rightarrow$ Select the same repo.
2. Set **Root Directory** to `frontend`.
3. Set **Framework Preset** to **Vite**.
4. Add environment variable:
   - `VITE_API_URL`: `https://productive-api.vercel.app` *(the backend URL from Step 1)*.
5. Click **Deploy**.

For detailed Vercel deployment options and CLI instructions, see [`docs/VERCEL_DEPLOYMENT_GUIDE.md`](docs/VERCEL_DEPLOYMENT_GUIDE.md).

---

## 9. Troubleshooting & Common Issues

- **Database Locked / SQLite Issues**:
  - In local development, SQLite automatically handles multi-threading via `check_same_thread=False`.
  - Ensure the backend process has write permissions to create `productive.db` in `backend/`.
- **CORS Errors in Browser Console**:
  - Ensure `CORS_ORIGINS` in `backend/.env` contains the exact URL and port of your frontend (e.g. `http://localhost:5173`).
- **ModuleNotFoundError when running pytest**:
  - Always execute pytest from inside the `backend` directory:
    ```bash
    cd backend && ./venv/bin/python -m pytest tests -v
    ```
- **Port 8000 or 5173 already in use**:
  - Backend: Change port with `uvicorn app.main:app --port 8001 --reload`
  - Frontend: Change port with `npm run dev -- --port 5174`
