CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS stats (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  number   TEXT NOT NULL,
  label    TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tag         TEXT NOT NULL DEFAULT '',
  tag_style   TEXT NOT NULL DEFAULT 'default',
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  items       TEXT NOT NULL DEFAULT '[]',
  image_url   TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  published   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  sid       TEXT PRIMARY KEY,
  data      TEXT NOT NULL,
  expires   INTEGER NOT NULL
);
