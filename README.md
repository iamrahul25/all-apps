# Rahul's Digital Shelf

React/Vite frontend with a Cloudflare Worker API and **Cloudflare D1** (SQLite) storage for public problem and product-demand submissions.

## Prerequisites

- Node.js 20+
- A Cloudflare account
- Wrangler authenticated (`npx wrangler login`)

> **No MongoDB required.** The project previously used the MongoDB Atlas Data API, which was shut down in September 2025. The backend now uses Cloudflare D1 — a managed SQLite database natively supported by Workers with zero extra configuration.

---

## First-Time Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Copy the environment file

```powershell
# PowerShell
Copy-Item .env.example .env
```

```bash
# Git Bash / macOS / Linux
cp .env.example .env
```

The `.env` file only contains two variables — no database secrets are needed since D1 is wired via `wrangler.toml`.

### 3. Log in to Cloudflare

```bash
npx wrangler login
```

This opens a browser to authorize Wrangler with your Cloudflare account.

### 4. Create the D1 database

```bash
npx wrangler d1 create rahuls_digital_shelf --config worker/wrangler.toml
```

The output will include a `database_id`. Copy it and paste it into [`worker/wrangler.toml`](worker/wrangler.toml), replacing the `REPLACE_WITH_DATABASE_ID` placeholder:

```toml
[[d1_databases]]
binding = "DB"
database_name = "rahuls_digital_shelf"
database_id = "paste-your-id-here"   # ← replace this
```

### 5. Apply the database schema

Run against the **remote** D1 database (production):

```bash
npx wrangler d1 execute rahuls_digital_shelf --file=worker/schema.sql --config worker/wrangler.toml
```

Run against the **local** D1 database (for `wrangler dev`):

```bash
npx wrangler d1 execute rahuls_digital_shelf --file=worker/schema.sql --config worker/wrangler.toml --local
```

---

## Run Locally

Start the Worker backend in one terminal:

```bash
npm run dev:backend
```

Start the Vite frontend in a second terminal:

```bash
npm run dev:frontend
```

Open `http://localhost:5173`. The frontend sends requests to `VITE_API_URL` (default: `http://localhost:8787/api`).

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/problems` | Returns the latest 50 public problems |
| `POST` | `/api/problems` | Submit a problem — requires `description`, optional `name` and `email` |
| `GET` | `/api/demands` | Returns the latest 50 public demands |
| `POST` | `/api/demands` | Submit a demand — requires `requirements`, optional `name`, `productType`, and `email` |

Email addresses are stored for follow-up but are **never** returned by the public `GET` endpoints.

---

## Validate (Build Check)

```bash
npm run build
npm run build:worker
```

---

## Deploy

### Deploy the Worker

```bash
npm run deploy:backend
```

This runs `tsc` on the Worker and then deploys via Wrangler. D1 is automatically available — no secrets to set for the database.

Optionally, set the `FRONTEND_ORIGIN` secret to restrict CORS to your deployed frontend URL:

```bash
npx wrangler secret put FRONTEND_ORIGIN
# enter: https://your-frontend.pages.dev
```

### Deploy the Frontend

Set `VITE_API_URL` to your deployed Worker URL (e.g. `https://rahuls-digital-shelf-api.<account>.workers.dev/api`) and build:

```bash
npm run build
```

Then deploy the `dist/` folder to Cloudflare Pages (or any static host).

---

## Project Structure

```
.
├── src/                   # React/Vite frontend
├── worker/
│   ├── src/index.ts       # Cloudflare Worker (D1-backed API)
│   ├── schema.sql         # D1 table definitions (problems, demands)
│   └── wrangler.toml      # Worker config with D1 binding
├── .env.example           # Environment variable template
└── package.json
```