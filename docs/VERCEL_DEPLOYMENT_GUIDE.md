# Independent Vercel Deployment Guide

This guide explains how to deploy the **Frontend** (Vite + React SPA) and **Backend** (FastAPI Serverless ASGI) to Vercel as **two completely independent projects**.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │            Frontend Vercel             │
                      │  https://prodactive-web.vercel.app     │
                      └──────────────────┬─────────────────────┘
                                         │ HTTPS Requests (Bearer + Cookies)
                                         ▼
                      ┌────────────────────────────────────────┐
                      │            Backend Vercel              │
                      │  https://prodactive-api.vercel.app     │
                      └────────────────────────────────────────┘
```

---

## 1. Deploying the Backend (FastAPI)

### Step 1: Create Backend Project on Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** $\rightarrow$ **Project**.
3. Import your GitHub repository (`samgirma/advanced-productive-web-app`).
4. In the configuration screen:
   - **Project Name**: `prodactive-api` (or your choice)
   - **Framework Preset**: **Other**
   - **Root Directory**: Click *Edit* and select **`backend`**
5. **Environment Variables**:
   Add the following variables in the Vercel dashboard:
   | Variable | Value | Description |
   |---|---|---|
   | `SECRET_KEY` | *(Random 32-character string)* | JWT encryption key |
   | `CORS_ORIGINS` | `*` or `https://prodactive-web.vercel.app,http://localhost:5173` | Allowed frontend domains |
   | `DATABASE_URL` | *(Optional, PostgreSQL URL)* | E.g. Neon, Supabase, or Railway. If empty, uses `/tmp/productive.db`. |
   | `GEMINI_API_KEY` | *(Your Gemini API key)* | Optional for Stage 2 AI features |
   | `N8N_WEBHOOK_SECRET`| *(Random secret)* | Protection key for `/api/webhooks/` |

6. Click **Deploy**.
7. Once deployed, note your backend URL (e.g., `https://prodactive-api.vercel.app`).
8. Verify by opening `https://prodactive-api.vercel.app/docs` or `/health`.

---

## 2. Deploying the Frontend (React + Vite)

### Step 1: Create Frontend Project on Vercel
1. Go to the [Vercel Dashboard](https://vercel.com) and click **Add New...** $\rightarrow$ **Project**.
2. Select the same repository (`samgirma/advanced-productive-web-app`).
3. In the configuration screen:
   - **Project Name**: `prodactive-web` (or your choice)
   - **Framework Preset**: **Vite** (auto-detected)
   - **Root Directory**: Click *Edit* and select **`frontend`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Environment Variables**:
   Add the backend URL you acquired in Step 1:
   | Variable | Value | Description |
   |---|---|---|
   | `VITE_API_URL` | `https://prodactive-api.vercel.app` | URL of your deployed backend (no trailing slash) |

5. Click **Deploy**.
6. When the deployment finishes, open your frontend URL (e.g. `https://prodactive-web.vercel.app`).

---

## 3. Link Backend CORS to Frontend URL

Now that you have your live frontend URL (`https://prodactive-web.vercel.app`):
1. Go back to your **Backend Project Settings** $\rightarrow$ **Environment Variables**.
2. Update `CORS_ORIGINS` to include your exact frontend URL:
   ```
   https://prodactive-web.vercel.app,http://localhost:5173
   ```
3. Trigger a redeploy of the backend project (or click **Redeploy** on the latest deployment).

---

## 4. Alternative: Deploying via Vercel CLI

If you have the `vercel` CLI installed (`npm i -g vercel`):

### Deploy Backend:
```bash
cd backend
vercel
# Follow prompts:
# - Link to existing project? No
# - Project name? prodactive-api
# - In which directory is your code located? ./
vercel --prod
```

### Deploy Frontend:
```bash
cd ../frontend
vercel
# Follow prompts:
# - Link to existing project? No
# - Project name? prodactive-web
# - In which directory is your code located? ./
vercel env add VITE_API_URL production
# Enter: https://prodactive-api.vercel.app
vercel --prod
```

---

## 5. Important Notes on Persistence & Serverless Limits

1. **Database Persistence**:
   - Vercel functions have an ephemeral filesystem. Any changes written to SQLite `/tmp/productive.db` will disappear when the function cold-starts.
   - For long-term data persistence, connect a managed cloud PostgreSQL database by setting `DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require`.
2. **File & Media Storage**:
   - Uploaded memories saved to `/tmp/uploads` will also reset on cold starts. For permanent media storage, configure AWS S3, Cloudinary, or Supabase Storage.
3. **Background Schedulers**:
   - Vercel functions terminate when an HTTP request finishes. Scheduled background jobs (APScheduler) are safely skipped on Vercel. For scheduled tasks (like daily/weekly reminder triggers), trigger the backend webhooks using Vercel Cron Jobs (`vercel.json` crons) or n8n cron nodes.
