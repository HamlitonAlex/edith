CREATE TABLE memories (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('long_term', 'stage', 'recent_event')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  source_type TEXT NOT NULL CHECK (length(source_type) BETWEEN 1 AND 40),
  source_id TEXT,
  topic TEXT,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'confirmed', 'archived')),
  confirmed_by_user INTEGER NOT NULL DEFAULT 0 CHECK (confirmed_by_user IN (0, 1)),
  confidence REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  importance REAL NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX memories_by_user_status_updated
  ON memories(user_id, status, updated_at DESC, id);

CREATE INDEX memories_by_user_type_topic
  ON memories(user_id, type, topic, updated_at DESC);

CREATE TABLE daily_logs (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "date" TEXT NOT NULL,
  completed TEXT NOT NULL DEFAULT '[]',
  problems TEXT NOT NULL DEFAULT '[]',
  learned TEXT NOT NULL DEFAULT '[]',
  tomorrow_plan TEXT NOT NULL DEFAULT '',
  ai_summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'proposed', 'confirmed')),
  confirmed_by_user INTEGER NOT NULL DEFAULT 0 CHECK (confirmed_by_user IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, "date")
);

CREATE INDEX daily_logs_by_user_date
  ON daily_logs(user_id, "date" DESC, id);

CREATE TABLE learning_evidence (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  skill TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK (length(evidence_type) BETWEEN 1 AND 48),
  result TEXT NOT NULL CHECK (length(result) BETWEEN 1 AND 2000),
  score REAL,
  source_type TEXT NOT NULL CHECK (length(source_type) BETWEEN 1 AND 40),
  source_id TEXT,
  confidence REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  CHECK (score IS NULL OR (score >= 0 AND score <= 100))
);

CREATE INDEX learning_evidence_by_user_topic_created
  ON learning_evidence(user_id, topic, skill, created_at DESC, id);

CREATE UNIQUE INDEX learning_evidence_source_once
  ON learning_evidence(user_id, source_type, source_id, evidence_type, topic, skill)
  WHERE source_id IS NOT NULL;
