CREATE TABLE sync_audit (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  resource TEXT NOT NULL,
  data_version INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX sync_audit_by_user_created
  ON sync_audit(user_id, created_at DESC);
