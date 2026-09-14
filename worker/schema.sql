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
