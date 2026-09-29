CREATE TABLE IF NOT EXISTS bridge_nonces (
  nonce TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bridge_nonces_expires_at
  ON bridge_nonces(expires_at);
