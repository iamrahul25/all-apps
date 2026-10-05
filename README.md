# Rahul's Digital Shelf

React/Vite frontend with a Cloudflare Worker API and **Cloudflare D1** (SQLite) storage for public problem and product-demand submissions.

## Live

| Part | Host | URL |
|------|------|-----|
| Frontend | Vercel (project `all-apps`) | https://all-apps-murex.vercel.app |
| Backend API | Cloudflare Workers (`rahuls-digital-shelf-api`) | https://rahuls-digital-shelf-api.iamrahul25.workers.dev/api |
| Database | Cloudflare D1 (`rahuls_digital_shelf`) | Bound to the Worker as `DB` |

Vercel serves the static React app. The browser calls the Worker API, which reads and writes D1.

## Prerequisites

- Node.js 20+
- A Cloudflare account
- Wrangler authenticated (`npx wrangler login`)
- A Vercel account and the Vercel CLI authenticated (`npx vercel login`)

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

The `.env` file contains `VITE_API_URL`, `FRONTEND_ORIGIN` and a local `ADMIN_PASSWORD` — no database secrets are needed since D1 is wired via `wrangler.toml`. `npm run dev:backend` passes `--env-file ../.env` to Wrangler (the path is relative to `worker/wrangler.toml`, not the project root), so `FRONTEND_ORIGIN` and `ADMIN_PASSWORD` apply to the local Worker.

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
| `POST` | `/api/admin/login` | Body `{ "password": "..." }`. Returns `{ token, expiresAt }`, valid for 7 days |
| `DELETE` | `/api/problems/:id` | Admin only — delete a problem |
| `DELETE` | `/api/demands/:id` | Admin only — delete a demand |

Email addresses are stored for follow-up but are **never** returned by the public `GET` endpoints. They are included only when the request carries a valid admin token (`Authorization: Bearer <token>`).

---

## Admin Panel

Open `/admin` (it is not linked in the navigation) and log in with the admin password. Once logged in:

- An **Admin** label appears in the sidebar (and in the mobile menu), linking back to `/admin`, where you can log out.
- The Problem and Demand pages show each submitter's email and a **Delete** button on every entry.
- The login lasts 7 days on that browser, then asks for the password again.

The password is checked by the Worker, never by the frontend. It is stored as the Worker secret `ADMIN_PASSWORD`, and login tokens are signed with it, so **changing the password logs out every admin session**. Failed logins are delayed by one second to slow down guessing; use a long password.

Set or change the production password:

```bash
npx wrangler secret put ADMIN_PASSWORD --config worker/wrangler.toml
```

If `ADMIN_PASSWORD` is not set, `/admin` shows *"Admin login is not configured."* and deleting is impossible. For local development, set `ADMIN_PASSWORD` in `.env` and restart `npm run dev:backend`.

---

## Validate (Build Check)

```bash
npm run build
npm run build:worker
```

---

## Deploy

The frontend is hosted on **Vercel** and the backend on **Cloudflare Workers**. Both are already set up, so day-to-day updates are a single command each:

| What changed | Command |
|--------------|---------|
| Frontend (`src/`) | `npx vercel deploy --prod` |
| Backend (`worker/`) | `npm run deploy:backend` |

### Backend: Cloudflare Worker

#### Deploy the backend

1. Make sure Wrangler is logged in to the right Cloudflare account:

   ```bash
   npx wrangler whoami      # if not logged in: npx wrangler login
   ```

2. Deploy:

   ```bash
   npm run deploy:backend
   ```

   This type-checks the Worker (`npm run build:worker`) and then runs `wrangler deploy --config worker/wrangler.toml`, which uploads `worker/src/index.ts` to https://rahuls-digital-shelf-api.iamrahul25.workers.dev. The new version is live as soon as the command finishes.

3. Check that the API responds:

   ```bash
   curl https://rahuls-digital-shelf-api.iamrahul25.workers.dev/api/problems
   ```

   Watch live requests and errors while testing:

   ```bash
   npx wrangler tail --config worker/wrangler.toml
   ```

D1 is bound through `wrangler.toml`, so the database needs no secret. The Worker runs `CREATE TABLE IF NOT EXISTS` on each request, so tables are created on first use.

The Cloudflare account uses the `iamrahul25.workers.dev` subdomain. On a new account, register a `workers.dev` subdomain once in the Cloudflare dashboard (**Workers & Pages**) before the first deploy, otherwise Wrangler stops with *"You need to register a workers.dev subdomain"*. A brand-new subdomain can take a few minutes to get its SSL certificate.

#### Worker secrets (environment variables)

The deployed Worker does **not** read `.env`. Production values are stored in Cloudflare as encrypted secrets:

| Secret | Required | Purpose | Current value |
|--------|----------|---------|---------------|
| `ADMIN_PASSWORD` | Yes, for `/admin` | Admin login password; also signs admin tokens | Private |
| `FRONTEND_ORIGIN` | Recommended | Allowed CORS origin; defaults to `*` if unset | `https://all-apps-murex.vercel.app` |

Add a new secret or change an existing one (Wrangler prompts for the value, so it never lands in shell history):

```bash
npx wrangler secret put ADMIN_PASSWORD --config worker/wrangler.toml
npx wrangler secret put FRONTEND_ORIGIN --config worker/wrangler.toml
```

List the secret names (values are never shown) and delete one:

```bash
npx wrangler secret list --config worker/wrangler.toml
npx wrangler secret delete SECRET_NAME --config worker/wrangler.toml
```

Things to know:

- `secret put` applies to the live Worker immediately; no redeploy is needed. Secrets also persist across later `npm run deploy:backend` runs.
- Secrets can also be managed in the Cloudflare dashboard under **Workers & Pages → rahuls-digital-shelf-api → Settings → Variables and Secrets**.
- Changing `ADMIN_PASSWORD` logs out every admin session, because admin tokens are signed with it.
- To add a **new** variable, set it with `secret put`, add it to the `Env` interface in [`worker/src/index.ts`](worker/src/index.ts), read it as `env.YOUR_NAME`, and run `npm run deploy:backend`. Add it to `.env` / `.env.example` too, so the local Worker gets it.
- Locally, `npm run dev:backend` loads the same names from the root `.env`. Check that its startup output lists them under *"Your Worker has access to the following bindings"*.

> Because CORS only allows the production URL, forms will not work on Vercel preview deployment URLs. Update `FRONTEND_ORIGIN` if the frontend domain changes (for example, after adding a custom domain).

### Frontend: Vercel

The Vercel project is `all-apps`. Vercel detects Vite automatically, runs `npm run build` and serves `dist/`.

`VITE_API_URL` is stored as a Vercel environment variable (Production and Preview) and is baked into the bundle at build time:

```
VITE_API_URL=https://rahuls-digital-shelf-api.iamrahul25.workers.dev/api
```

To change it, update the variable and redeploy:

```bash
npx vercel env rm VITE_API_URL production
npx vercel env add VITE_API_URL production
npx vercel deploy --prod
```

Two files support the Vercel deployment:

- [`vercel.json`](vercel.json) rewrites every path to `index.html`, so refreshing client-side routes such as `/apps` or `/about` does not return a 404.
- [`.vercelignore`](.vercelignore) keeps `node_modules`, `dist`, `UI-design` and local `.env` files out of the upload, so the localhost `VITE_API_URL` from `.env` never reaches the production build.

To deploy automatically on every push, connect the GitHub repo `iamrahul25/all-apps` in the Vercel dashboard under **Project → Settings → Git**.

### First-time setup (reference)

These are the commands used to put the project live for the first time:

```bash
# Logins
npx wrangler login
npx vercel login

# Backend (after registering the workers.dev subdomain)
npm run deploy:backend
npx wrangler secret put FRONTEND_ORIGIN --config worker/wrangler.toml   # https://all-apps-murex.vercel.app
npx wrangler secret put ADMIN_PASSWORD --config worker/wrangler.toml    # your admin password

# Frontend
npx vercel deploy --prod --yes                 # creates the "all-apps" project
npx vercel env add VITE_API_URL production     # https://rahuls-digital-shelf-api.iamrahul25.workers.dev/api
npx vercel env add VITE_API_URL preview
npx vercel deploy --prod --yes                 # rebuild with the API URL

# Verify
curl https://rahuls-digital-shelf-api.iamrahul25.workers.dev/api/problems
```

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
├── vercel.json            # Vercel SPA rewrite config
├── .vercelignore          # Files excluded from Vercel uploads
└── package.json
```