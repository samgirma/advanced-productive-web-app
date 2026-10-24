# Productive Automation Guide: n8n, Make, & Zapier

Comprehensive guide covering webhook triggers, scheduled polling, error handling, rebuilding workflows in Make and Zapier, and a comparative evaluation across platforms.

---

## 1. Cron Expressions Explained

A cron expression is a string of 5 space-delimited fields defining automated execution schedules:

```text
┌───────────── Minute (0 - 59)
│ ┌───────────── Hour (0 - 23)
│ │ ┌───────────── Day of the Month (1 - 31)
│ │ │ ┌───────────── Month of the Year (1 - 12 or JAN - DEC)
│ │ │ │ ┌───────────── Day of the Week (0 - 6 or SUN - SAT, 0 = Sunday)
│ │ │ │ │
* * * * *
```

### Three Real-World Examples:

1. **`* * * * *` (Every Minute)**:
   * **Use Case**: Used by `due_notifications_workflow.json` to poll `/api/webhooks/due-notifications`.
   * **Behavior**: Fires at second `:00` of every single minute (24/7) to match users' local reminder schedules and detect overdue tasks instantly.

2. **`0 8 * * 1-5` (Weekdays at 8:00 AM)**:
   * **Use Case**: Workday Morning Planning prompt.
   * **Behavior**: Fires once a day at 08:00 AM, strictly on Monday through Friday (`1-5`), skipping weekends.

3. **`30 21 * * 0` (Every Sunday Night at 9:30 PM)**:
   * **Use Case**: Weekly Performance Audit & Executive AI Review.
   * **Behavior**: Fires at 21:30 (9:30 PM) only on Sundays (`0`) to generate weekly productivity summaries.

---

## 2. Test vs. Production Webhook URLs in n8n

| Property | Test Webhook URL | Production Webhook URL |
| :--- | :--- | :--- |
| **URL Pattern** | `http://<host>:5678/webhook-test/<id>` | `http://<host>:5678/webhook/<id>` |
| **Activation** | Active **only** while clicking *"Listen for Test Event"* in the n8n UI canvas. | Active **permanently** once the workflow toggle is set to `Active: ON`. |
| **Execution Limit** | Consumes exactly **one** inbound request, populates node input schema, and closes. | Handles unlimited concurrent production requests in the background. |
| **Error Handling** | Throws errors directly into the interactive visual editor for inspection. | Logs failures to executions log and triggers `Error Trigger` node. |

> [!WARNING]
> Never configure iOS Shortcuts, external webhooks, or third-party webhooks with the `-test` URL. Use the production URL and activate the workflow.

---

## 3. Rebuilding Workflow (b) in Make (Integromat)

**Objective**: Accept incoming tasks or notes and save them to Productive API via Make.

### Step-by-Step Blueprint:
1. **Module 1 — Custom Webhook**:
   * Add a **Webhooks > Custom Webhook** module.
   * Click **Create a webhook**, name it `Productive Ingest`, copy the generated URL.
   * Send a test payload from curl or Postman:
     ```bash
     curl -X POST https://hook.eu1.make.com/<your-webhook-id> \
       -H "Content-Type: application/json" \
       -d '{"user_email":"test@example.com","type":"task","title":"Gym workout","start_time":"2026-10-25T18:00:00Z","end_time":"2026-10-25T19:00:00Z"}'
     ```
2. **Module 2 — HTTP Make a Request**:
   * Connect an **HTTP > Make a request** module.
   * **URL**: `https://your-productive-api.com/api/webhooks/external-ingest`
   * **Method**: `POST`
   * **Headers**:
     * `X-N8N-Secret`: Enter your secret token (store in Make Scenario Variables or Keychain).
     * `Content-Type`: `application/json`
   * **Body type**: `Raw`, Content type: `JSON (application/json)`.
   * **Request content**: Map the input fields from Module 1 (`user_email`, `type`, `title`, `content`, `start_time`, `end_time`).
3. **Module 3 — Webhook Response**:
   * Connect a **Webhooks > Webhook response** module.
   * **Status**: `200`
   * **Body**: `{{2.data}}` (passes the JSON response from Productive back to caller).

---

## 4. Rebuilding Workflow (b) in Zapier

**Objective**: Accept tasks from iOS Shortcuts or external apps and post to Productive.

### Step-by-Step Blueprint:
1. **Trigger — Webhooks by Zapier**:
   * Event: **Catch Hook**.
   * Copy the webhook URL and send a sample request to populate test data.
2. **Action — Webhooks by Zapier**:
   * Event: **Custom Request** (or POST).
   * **Method**: `POST`.
   * **URL**: `https://your-productive-api.com/api/webhooks/external-ingest`.
   * **Data**:
     ```json
     {
       "user_email": "{{1.user_email}}",
       "type": "{{1.type}}",
       "title": "{{1.title}}",
       "content": "{{1.content}}",
       "start_time": "{{1.start_time}}",
       "end_time": "{{1.end_time}}"
     }
     ```
   * **Headers**:
     * `X-N8N-Secret`: `your_secret_token_here`
     * `Content-Type`: `application/json`
3. **Test & Publish**: Test the action and turn the Zap **ON**.

---

## 5. Comparison: n8n vs. Make vs. Zapier

| Feature / Criteria | **n8n** | **Make (Integromat)** | **Zapier** |
| :--- | :--- | :--- | :--- |
| **Pricing Model** | **Fair-Code / Free Self-Hosted**. Paid cloud starts at €20/mo for 2.5k executions. | **Per-operation pricing**. Free tier: 1,000 ops/mo. Core starts at \$9/mo for 10k ops. | **Per-task pricing**. Free tier: 100 tasks/mo. Starter starts at \$19.99/mo for 750 tasks. |
| **Self-Hosting** | **Native Docker image (`n8nio/n8n`)**. Can run on your own VPS for \$0 software cost with unlimited executions. | Proprietary SaaS only. No self-hosting. | Proprietary SaaS only. No self-hosting. |
| **Flexibility & Custom Code** | **Superior**. Native JavaScript and Python code nodes with full npm/pip library access. | **Moderate**. Excellent visual mapping and built-in formulas, but limited custom scripts. | **Limited**. Basic Code by Zapier (JS/Python with strict 1-second timeout and memory caps). |
| **Ease of Use** | Moderate (developer-friendly, node-based canvas, git version control). | High (intuitive visual bubble interface, interactive flow testing). | Very High (linear step-by-step wizard tailored for non-technical users). |
| **Vector Database & AI Support** | **Built-in First-Class AI Nodes**: Native Chroma, Pinecone, Qdrant, LangChain nodes, and local Ollama integrations. | Basic OpenAI / AI modules; requires custom HTTP requests to interact with vector databases. | Basic ChatGPT actions; vector DB operations require complex multi-step webhooks. |
| **Security & Privacy** | **High**. Self-hosted ensures personal journal data and secrets never leave your infrastructure. | Data resides on Make cloud servers (US/EU regions available). | Data resides on Zapier cloud servers. |
