# Feedback Page — Plan

A public feedback board for every app and website on the shelf. Users submit feedback, suggestions, bugs and questions; anyone can read and upvote them; the submitter and the admin can talk in comments; the admin moves items through statuses.

## Decisions

| Topic | Decision |
|-------|----------|
| URL format | Path style: `/suggest/<app-slug>` |
| Which apps | Only apps and websites listed in `src/data/projects.json` |
| Visibility | Public board — everyone sees all feedback for an app |
| User identity | No login. Optional name and email, plus a tracking ID (`#FB-0042`) and a private tracking link saved in the browser |
| Comments | Two-way: the admin and the original submitter |
| Attachments | Not in version 1 (can be added later with Cloudflare R2) |
| Extra fields | Tags, Assignee, Activity history, Upvotes |

---

## User Roles

### Visitor

- Opens `/suggest/habit-app` and sees the public board for that app.
- Can search, filter, sort, open any item and read its comments.
- Can upvote items (one vote per browser).
- Cannot comment.

### Submitter

- Clicks **New Feedback** and fills in Type, Title, Description, Name (optional, shown as "Anonymous" when empty) and Email (optional, never public).
- Receives a tracking ID such as `#FB-0042` and a private link such as `/suggest/habit-app/42?key=…`.
- The key is also saved in `localStorage`, so the **My feedback** tab lists their items and they can reply to the admin.
- If browser data is cleared, the saved link still restores access.

### Admin

- Logs in with the existing `/admin` password (same token as Problem/Demand).
- On any item: changes Status, Type, Priority, Assignee and Tags.
- Replies as "Developer", deletes items and comments.
- Sees submitter emails.
- Every change is recorded in the Activity tab.

---

## URLs

| URL | Shows |
|-----|-------|
| `/suggest` | Picker of all apps and websites with feedback counts |
| `/suggest/habit-app` | Board for one app |
| `/suggest/habit-app/42` | Board with item #42 open in the side panel (shareable) |
| `/suggest/habit-app/42?key=…` | Same, and grants the submitter reply access |
| `/suggest/unknown-name` | "App not found" plus the picker |

Add a `slug` to every entry in `src/data/projects.json`:

| Name | Slug |
|------|------|
| Use-it | `use-it` |
| Habit-app | `habit-app` |
| Connect The Dots | `connect-the-dots` |
| Pin-it | `pin-it` |
| Any Connect | `any-connect` |
| FOF - Find Old Friend | `fof` |
| Habit Maker | `habit-maker` |
| Task Prioritizer | `task-prioritizer` |

The Android apps and websites can then link directly to their own feedback page. `vercel.json` already rewrites every path to `index.html`, so no deploy config change is needed.

---

## Fields

| Field | Values | Set by |
|-------|--------|--------|
| Type | Bug, Suggestion, Improvement, Feedback, Question | Submitter; admin can change |
| Title | Up to 160 characters | Submitter |
| Description | Up to 4000 characters | Submitter |
| Name | Optional, up to 80 characters | Submitter |
| Email | Optional, private | Submitter |
| Status | New, To Do, In Progress, Done, Closed | Admin (starts as New) |
| Priority | Low, Medium, High, Urgent | Admin (empty until triaged) |
| Assignee | Free text, e.g. "Rahul Kumar" | Admin |
| Tags | e.g. `Android`, `v1.0.0` | Auto-added from the app's platform and version; admin can edit |
| Upvotes | Count, one per browser | Anyone |

Differences from the reference image:

- "Feature" is named **Suggestion**.
- A **Closed** status is added for duplicates and requests that won't be built.

---

## Database (Cloudflare D1)

Four new tables, created in `worker/schema.sql` and in `initDb()` with `CREATE TABLE IF NOT EXISTS`.

### `feedback`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Shown as `#FB-0042` |
| `app_slug` | TEXT NOT NULL | Indexed |
| `type` | TEXT NOT NULL | `bug`, `suggestion`, `improvement`, `feedback`, `question` |
| `title` | TEXT NOT NULL | |
| `description` | TEXT NOT NULL | |
| `author_name` | TEXT | |
| `author_email` | TEXT | Admin only |
| `owner_key_hash` | TEXT NOT NULL | SHA-256 of the tracking key; the raw key is never stored |
| `status` | TEXT NOT NULL DEFAULT `'new'` | `new`, `todo`, `in_progress`, `done`, `closed` |
| `priority` | TEXT | `low`, `medium`, `high`, `urgent` |
| `assignee` | TEXT | |
| `tags` | TEXT NOT NULL DEFAULT `'[]'` | JSON array |
| `upvotes` | INTEGER NOT NULL DEFAULT 0 | Cached for sorting |
| `comment_count` | INTEGER NOT NULL DEFAULT 0 | Cached for the list |
| `created_at` | TEXT NOT NULL | ISO timestamp |
| `updated_at` | TEXT NOT NULL | ISO timestamp |

### `feedback_comments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | |
| `feedback_id` | INTEGER NOT NULL | Indexed |
| `author_role` | TEXT NOT NULL | `admin` or `submitter` |
| `author_name` | TEXT | "Developer" for admin, submitter's name otherwise |
| `body` | TEXT NOT NULL | Up to 2000 characters |
| `created_at` | TEXT NOT NULL | |

### `feedback_activity`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | |
| `feedback_id` | INTEGER NOT NULL | Indexed |
| `actor` | TEXT NOT NULL | `admin` or `submitter` |
| `field` | TEXT NOT NULL | `created`, `status`, `type`, `priority`, `assignee`, `tags` |
| `from_value` | TEXT | |
| `to_value` | TEXT | |
| `created_at` | TEXT NOT NULL | |

### `feedback_votes`

| Column | Type | Notes |
|--------|------|-------|
| `feedback_id` | INTEGER NOT NULL | |
| `voter_id` | TEXT NOT NULL | Random ID stored in the browser |
| `created_at` | TEXT NOT NULL | |

Primary key `(feedback_id, voter_id)` prevents double votes from the same browser.

---

## API

All endpoints live in `worker/src/index.ts`.

| Method | Endpoint | Who | Description |
|--------|----------|-----|-------------|
| `GET` | `/api/feedback?app=&type=&status=&sort=&q=` | Anyone | List for one app, plus per-type counts for the filter chips. `sort` is `newest`, `oldest`, `votes` or `comments` |
| `POST` | `/api/feedback` | Anyone | Create an item. Returns the item and the tracking key (shown only once) |
| `GET` | `/api/feedback/:id` | Anyone | Item with comments and activity |
| `PATCH` | `/api/feedback/:id` | Admin | Change status, type, priority, assignee or tags; logs each change in activity |
| `DELETE` | `/api/feedback/:id` | Admin | Delete an item with its comments, activity and votes |
| `POST` | `/api/feedback/:id/comments` | Admin, or submitter with `X-Feedback-Key` header | Add a comment |
| `DELETE` | `/api/feedback/:id/comments/:commentId` | Admin | Delete a comment |
| `POST` | `/api/feedback/:id/vote` | Anyone | Add an upvote (`{ voterId }`) |
| `DELETE` | `/api/feedback/:id/vote` | Anyone | Remove an upvote (`{ voterId }`) |
| `GET` | `/api/feedback/summary` | Anyone | Feedback counts per app, for the `/suggest` picker |

Rules:

- `author_email` is returned only with a valid admin token.
- `app` must match a known slug; the Worker keeps a list of valid slugs (or the frontend sends only slugs from `projects.json` and the Worker validates the format).
- The tracking key is 32 random bytes, base64url-encoded. The Worker compares SHA-256 hashes.

Backend changes outside the new endpoints:

- Replace the single regex router with a small route table.
- CORS: allow `PATCH` and the `X-Feedback-Key` header.

### Spam protection (version 1)

- Length limits on every field.
- A hidden honeypot form field; submissions that fill it are silently dropped.
- A basic per-IP limit on new submissions and comments.
- Cloudflare Turnstile can be added later if spam becomes a problem.

---

## Frontend

New files keep `App.tsx` from growing:

- `src/pages/FeedbackPage.tsx` — picker, board, side panel, submit form.
- `src/lib/feedback.ts` — API calls, tracking-key and voter-ID storage in `localStorage`.

### Layout (matches the reference image)

- **Header:** app icon and "Habit-app Feedback", search box (press `/` to focus), **New Feedback** button that opens the form in a modal.
- **Filter row:** chips with counts — All, Bug, Suggestion, Improvement, Question, Feedback, My feedback — plus Type, Status and Sort dropdowns.
- **Table columns:** Title with a one-line snippet, Type badge, Status badge, Author initials and name, Upvotes, Comments, Created (relative time, reusing `formatTimeAgo`).
- **Side panel** (opens on row click, updates the URL to `/suggest/<slug>/<id>`):
  - ID with copy button, title, status badge, description, tags, author, date.
  - Status, Type, Assignee and Priority: dropdowns for the admin, read-only badges for everyone else.
  - **Comments** and **Activity** tabs.
  - Comment box only for the admin and the submitter; others see "Only the submitter and the developer can reply."

### Responsive and theme

- Mobile: the table becomes a card list and the side panel opens full-screen.
- Light and dark themes use the existing `theme.css` variables.

### Navigation

- Sidebar and mobile menu: new **Feedback** item linking to `/suggest`.
- Every app and website card: **Give feedback** link to `/suggest/<slug>`.
- Admin page: **Manage feedback** link.
- Home page: optional new `// feedback` link card.

---

## Build Order

1. **Backend**
   - Add the four tables to `schema.sql` and `initDb()`.
   - Replace the router with a route table; update CORS.
   - Implement all endpoints.
   - Test locally with `npm run dev:backend` and curl.
2. **Board**
   - Add slugs to `projects.json`.
   - Build the `/suggest` picker, the list with filters, search and sort.
   - Build the submit form and tracking-key storage.
3. **Side panel**
   - Item details, comments thread for admin and submitter, My feedback tab.
4. **Admin controls**
   - Status, Type, Priority, Assignee and Tags dropdowns; Activity tab.
5. **Finishing**
   - Upvotes, nav and card links, mobile layout.
   - Update `README.md` (API reference, admin panel section).
   - Deploy: `npm run deploy:backend`, then `npx vercel deploy --prod`.

---

## Known Limits

- Upvotes are per browser, so a determined person can vote more than once. This is normal for anonymous boards.
- A submitter who loses both their browser data and the tracking link can no longer reply. They can still read their item because the board is public.
- No emails are sent in version 1. Emails are stored so the admin can follow up manually.

## Later Ideas

- File and screenshot attachments (Cloudflare R2).
- Email notifications when the admin replies or changes status (e.g. Resend).
- Cloudflare Turnstile captcha.
- Submitter can edit their own item.
