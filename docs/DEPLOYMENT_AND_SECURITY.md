# Deployment, DevOps & Security Architecture Guide

Comprehensive documentation on containerization, managed cloud deployment, ephemeral storage solutions, CI/CD, and security protocols.

---

## 1. Docker Fundamentals in Plain English

| Concept | Plain-English Explanation | Real-World Analogy |
| :--- | :--- | :--- |
| **Image** | A frozen, read-only blueprint containing the OS, Python runtime, system libraries, and application code. | A cake recipe or a CD-ROM. It never changes once baked. |
| **Container** | A live, running instance created from an Image. You can start, stop, and destroy containers without affecting the image. | The actual cake baked from the recipe, or a running program in memory. |
| **Volume** | A dedicated storage folder located on the host machine's hard drive that stays intact even if containers are destroyed or restarted. | An external hard drive plugged into your laptop so your personal files survive reboots. |
| **Environment Variables (`.env`)** | Configuration parameters passed into containers at runtime to alter behavior without changing code (e.g. database URLs, API keys). | Dial settings on an amplifier (volume, bass) that adjust how it plays without rewiring the circuits. |

---

## 2. Cloud Deployment: Render vs. Railway

### Comparative Evaluation (Current Docs & Pricing)

| Criteria | **Render (Selected - Simpler)** | **Railway** |
| :--- | :--- | :--- |
| **Free Tier / Trial** | **Individual Free Tier**: Free Web Services (spins down after 15 min inactivity), Free PostgreSQL database (lasts 30 days before requiring upgrade or recreate). | **Trial Tier**: \$5 one-time credit or requires \$5/mo Hobby plan. No permanent free tier. |
| **Managed Postgres** | **One-Click Managed Postgres**: Built-in automated connection strings (`DATABASE_URL`), visual dashboard. | Managed Postgres available, charges based on vCPU/RAM usage. |
| **Ease of Deployment** | **Highest**: Direct Git repo connection, native `render.yaml` or UI configuration, deploy hooks for GitHub Actions. | Very good, but project canvas interface and dynamic consumption billing can be slightly more complex. |
| **Deploy Hooks** | Native one-click Deploy Hook URL for GitHub Actions. | Requires Railway CLI or GitHub app integration. |

### Why Ephemeral Disks Require External Storage
> [!CRITICAL]
> Modern cloud container platforms (Render, Railway, Heroku) use **ephemeral (temporary) disks**.
> Every time your app deploys, restarts, or wakes from sleep, the container filesystem is reset to the original Docker image. Any files saved to `./uploads/` on the local disk are permanently deleted!
> 
> **Solution**:
> 1. **Structured Data**: Store in a **Managed PostgreSQL** instance (data survives container restarts).
> 2. **Media Files (Photos & Videos)**: Store uploaded pictures and videos in external object storage:
>    * **Cloudinary** (Generous free tier: 25GB storage, 25 credits/month, automatic thumbnail transformations).
>    * **AWS S3 / Cloudflare R2** (Zero egress fees on R2, 10GB free).

---

## 3. Step-by-Step Render Deployment Guide

### Step 1: Create a Managed PostgreSQL Database
1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click **New + > PostgreSQL**.
3. Name it `productive-db`, choose region closest to you, select **Free** tier.
4. Click **Create Database**.
5. Once created, copy the **Internal Database URL** (e.g. `postgres://productive_user:...@dpg-...-a/productive_db`).

### Step 2: Deploy the Backend Web Service
1. Click **New + > Web Service** and connect your GitHub repository `Hawi-T/prodactive-`.
2. Configure settings:
   * **Name**: `productive-backend`
   * **Root Directory**: `backend`
   * **Runtime**: `Python 3`
   * **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt`
   * **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add **Environment Variables**:
   * `DATABASE_URL`: *(Paste Internal Database URL from Step 1)*
   * `SECRET_KEY`: *(Generate a secure random string: `openssl rand -hex 32`)*
   * `GEMINI_API_KEY`: *(Your Google AI Studio API key)*
   * `GEMINI_MODEL`: `gemini-3.8-flash`
   * `GEMINI_EMBEDDING_MODEL`: `gemini-embedding-001`
   * `N8N_WEBHOOK_SECRET`: *(Secret token matching your n8n workflow)*
   * `CORS_ORIGINS`: `https://your-frontend-subdomain.onrender.com`
4. Click **Create Web Service**.

### Step 3: Deploy the React Frontend as a Static Site
1. Click **New + > Static Site** and connect your GitHub repository.
2. Configure settings:
   * **Name**: `productive-frontend`
   * **Root Directory**: `frontend`
   * **Build Command**: `npm install && npm run build`
   * **Publish Directory**: `dist`
3. Add Rewrites/Redirects in Render dashboard:
   * Source: `/*` -> Destination: `/index.html` (Action: `Rewrite` for React client router).
4. Note your public URL (e.g., `https://productive-frontend.onrender.com`) and ensure it is listed in the backend's `CORS_ORIGINS`.

### Step 4: Configure Continuous Deployment via GitHub Actions
1. In your Render backend service, scroll to **Deploy Hook** and copy the URL.
2. In your GitHub repository, navigate to **Settings > Secrets and variables > Actions**.
3. Add a repository secret named `RENDER_DEPLOY_HOOK_URL` containing the hook URL.
4. Every push to `main` will now automatically run tests and trigger the production deployment!

---

## 4. Security Check & Privacy Policy

### Security Verification Checklist:
* [x] **CORS Configuration**: Restricts API access exclusively to trusted origins listed in `CORS_ORIGINS` with `allow_credentials=True`.
* [x] **HttpOnly & SameSite Cookies**: JWT access tokens are stored in `HttpOnly; SameSite=Lax` cookies, preventing JavaScript XSS token theft.
* [x] **File Upload Validation**: Enforces MIME types (`image/jpeg`, `image/png`, `video/mp4`, etc.) and strict file size boundaries (10MB for photos, 50MB for video).
* [x] **Rate Limiting**: Sliding-window rate limiter on `/api/auth/login` throttles repeated brute-force authentication attacks.
* [x] **Secret Scanning & Redacting Logger**: Custom log formatter redacts all passwords, auth tokens, and Bearer headers from console and rotating disk logs.

### Privacy Note (Mindful Journal & Personal Data)
> **Your Mindful Journal is strictly confidential.**
> - **Zero AI Scraping**: Your private journal text is **never** sent to external AI services unless you explicitly toggle `allow_ai_journal_review` in your user settings.
> - **Isolated Embeddings**: Semantic vector embeddings in Chroma are partitioned into user-isolated collections (`user_<id>_journals`) ensuring cross-account data isolation.
> - **Encrypted Transit**: All communications are transmitted over TLS/HTTPS with Bcrypt-salted password hashing.
