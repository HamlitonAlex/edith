CREATE TABLE users (
  id TEXT PRIMARY KEY,
  oidc_issuer TEXT NOT NULL,
  oidc_subject TEXT NOT NULL,
  data_version INTEGER NOT NULL DEFAULT 0 CHECK (data_version >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (oidc_issuer, oidc_subject)
);

CREATE TABLE home_snapshots (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  snapshot_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE calendar_events (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  start_at TEXT NOT NULL,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 720),
  source TEXT NOT NULL,
  source_action_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE UNIQUE INDEX calendar_events_one_confirmation_per_action
  ON calendar_events(user_id, source_action_id)
  WHERE source_action_id IS NOT NULL;

CREATE INDEX calendar_events_by_user_start
  ON calendar_events(user_id, start_at, id);

CREATE TABLE conversations (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, conversation_id)
);

CREATE TABLE conversation_messages (
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  client_message_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('typing', 'voice_transcript', 'local_agent')),
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, conversation_id, client_message_id),
  FOREIGN KEY (user_id, conversation_id)
    REFERENCES conversations(user_id, conversation_id)
    ON DELETE CASCADE
);

CREATE INDEX conversation_messages_page
  ON conversation_messages(user_id, conversation_id, occurred_at, client_message_id);
