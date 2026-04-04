-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Sessions
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Feeds
CREATE TABLE feeds (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  site_url TEXT,
  etag TEXT,
  last_modified TEXT,
  last_fetched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Subscriptions
CREATE TABLE subscriptions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  category TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (user_id, feed_id)
);

CREATE INDEX idx_subscriptions_feed_id ON subscriptions(feed_id);

-- Entries
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  url TEXT,
  title TEXT,
  content TEXT,
  summary TEXT,
  author TEXT,
  published_at TEXT,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ai_summary TEXT,
  ai_translation TEXT,
  translation_lang TEXT,
  UNIQUE(feed_id, guid)
);

CREATE INDEX idx_entries_feed_published ON entries(feed_id, published_at DESC);
CREATE INDEX idx_entries_published ON entries(published_at DESC);

-- Entry states (per-user read/star)
CREATE TABLE entry_states (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_starred INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (user_id, entry_id)
);

CREATE INDEX idx_entry_states_read ON entry_states(user_id, is_read);
CREATE INDEX idx_entry_states_starred ON entry_states(user_id, is_starred);

-- FTS (full-text search)
CREATE VIRTUAL TABLE entries_fts USING fts5(title, summary, content=entries, content_rowid=rowid);

-- FTS triggers to keep index in sync
CREATE TRIGGER entries_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts(rowid, title, summary) VALUES (new.rowid, new.title, new.summary);
END;

CREATE TRIGGER entries_ad AFTER DELETE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, summary) VALUES ('delete', old.rowid, old.title, old.summary);
END;

CREATE TRIGGER entries_au AFTER UPDATE OF title, summary ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, summary) VALUES ('delete', old.rowid, old.title, old.summary);
  INSERT INTO entries_fts(rowid, title, summary) VALUES (new.rowid, new.title, new.summary);
END;
