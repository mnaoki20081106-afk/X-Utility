CREATE TABLE IF NOT EXISTS search_credentials (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  session_enc TEXT NOT NULL,
  csrf_enc TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
