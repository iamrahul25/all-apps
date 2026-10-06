-- Cloudflare D1 schema for rahuls_digital_shelf
-- Apply with: wrangler d1 execute rahuls_digital_shelf --file=worker/schema.sql

CREATE TABLE IF NOT EXISTS problems (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT,
  description TEXT NOT NULL,
  email       TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS demands (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT,
  requirements TEXT NOT NULL,
  product_type TEXT,
  email        TEXT,
  created_at   TEXT NOT NULL
);

-- Feedback board (/suggest/<app-slug>)
CREATE TABLE IF NOT EXISTS feedback (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  app_slug       TEXT NOT NULL,
  type           TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  author_name    TEXT,
  author_email   TEXT,
  owner_key_hash TEXT NOT NULL,
  ip_hash        TEXT,
  status         TEXT NOT NULL DEFAULT 'new',
  priority       TEXT,
  assignee       TEXT,
  tags           TEXT NOT NULL DEFAULT '[]',
  upvotes        INTEGER NOT NULL DEFAULT 0,
  comment_count  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_app ON feedback (app_slug, created_at);

CREATE TABLE IF NOT EXISTS feedback_comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_id INTEGER NOT NULL,
  author_role TEXT NOT NULL,
  author_name TEXT,
  body        TEXT NOT NULL,
  ip_hash     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_item ON feedback_comments (feedback_id);

CREATE TABLE IF NOT EXISTS feedback_activity (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_id INTEGER NOT NULL,
  actor       TEXT NOT NULL,
  field       TEXT NOT NULL,
  from_value  TEXT,
  to_value    TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_activity_item ON feedback_activity (feedback_id);

CREATE TABLE IF NOT EXISTS feedback_votes (
  feedback_id INTEGER NOT NULL,
  voter_id    TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (feedback_id, voter_id)
);
