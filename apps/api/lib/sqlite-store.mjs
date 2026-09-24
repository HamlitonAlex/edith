import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "./http.mjs";

const migrationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const isObject = value => value && typeof value === "object" && !Array.isArray(value);

function timestamp(now) {
  return now().toISOString();
}

function parseStoredSnapshot(value) {
  try {
    const parsed = JSON.parse(value);
    if (!isObject(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new ApiError(500, "stored_data_invalid", "服务端已保存的数据无法读取，请联系服务维护者。");
  }
}

function blankRecord() {
  return { version: 1, preferences: { calendar_events: [] }, agent_state: {}, conversations: [] };
}

function databaseError(cause) {
  if (cause instanceof ApiError) return cause;
  if (String(cause?.code || "").startsWith("ERR_SQLITE") || /constraint/i.test(String(cause?.message || ""))) {
    return new ApiError(409, "persistence_conflict", "保存时检测到数据冲突，请先刷新后再试。");
  }
  return cause;
}

function eventFromRow(row) {
  return {
    id: row.id,
    summary: row.summary,
    start: row.start_at,
    duration_minutes: row.duration_minutes,
    source: row.source,
    sourceActionId: row.source_action_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function messageFromRow(row) {
  return {
    id: row.client_message_id,
    role: row.role,
    text: row.text,
    source: row.source,
    occurred_at: row.occurred_at,
    received_at: row.received_at,
  };
}

function memoryFromRow(row) {
  return row ? {
    id: row.id,
    type: row.type,
    content: row.content,
    source_type: row.source_type,
    source_id: row.source_id,
    topic: row.topic,
    status: row.status,
    confirmed_by_user: Boolean(row.confirmed_by_user),
    confidence: Number(row.confidence),
    importance: Number(row.importance),
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  } : null;
}

function dailyLogFromRow(row) {
  return row ? {
    id: row.id,
    date: row.date,
    completed: parseJsonList(row.completed),
    problems: parseJsonList(row.problems),
    learned: parseJsonList(row.learned),
    tomorrow_plan: row.tomorrow_plan || "",
    ai_summary: row.ai_summary || "",
    status: row.status,
    confirmed_by_user: Boolean(row.confirmed_by_user),
    created_at: row.created_at,
    updated_at: row.updated_at,
  } : null;
}

function evidenceFromRow(row) {
  return row ? {
    id: row.id,
    topic: row.topic,
    skill: row.skill,
    evidence_type: row.evidence_type,
    result: row.result,
    score: row.score == null ? null : Number(row.score),
    source_type: row.source_type,
    source_id: row.source_id,
    confidence: Number(row.confidence),
    created_at: row.created_at,
    updated_at: row.updated_at,
  } : null;
}

function parseJsonList(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function jsonList(value) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

function sameMemoryContent(left, right) {
  return left && right && left.type === right.type && left.content === right.content
    && left.source_type === right.source_type && (left.source_id || null) === (right.source_id || null)
    && (left.topic || null) === (right.topic || null)
    && Number(left.confidence) === Number(right.confidence) && Number(left.importance) === Number(right.importance);
}

function sameMemory(left, right) {
  return sameMemoryContent(left, right) && left.status === right.status
    && Boolean(left.confirmed_by_user) === Boolean(right.confirmed_by_user);
}

function sameMemoryCreateReplay(left, right) {
  if (sameMemory(left, right)) return true;
  return right?.status === "proposed" && !right.confirmed_by_user
    && ["confirmed", "archived"].includes(left?.status) && sameMemoryContent(left, right);
}

function sameEvidence(left, right) {
  return left && right && left.topic === right.topic && left.skill === right.skill
    && left.evidence_type === right.evidence_type && left.result === right.result
    && (left.score == null ? null : Number(left.score)) === (right.score == null ? null : Number(right.score))
    && left.source_type === right.source_type && (left.source_id || null) === (right.source_id || null)
    && Number(left.confidence) === Number(right.confidence);
}

function sameDailyLogContent(left, right) {
  return left && right && left.date === right.date
    && JSON.stringify(left.completed) === JSON.stringify(right.completed)
    && JSON.stringify(left.problems) === JSON.stringify(right.problems)
    && JSON.stringify(left.learned) === JSON.stringify(right.learned)
    && left.tomorrow_plan === right.tomorrow_plan && left.ai_summary === right.ai_summary;
}

function sameDailyLog(left, right) {
  return sameDailyLogContent(left, right)
    && left.status === right.status && Boolean(left.confirmed_by_user) === Boolean(right.confirmed_by_user);
}

function sameDailyLogCreateReplay(left, right) {
  if (sameDailyLog(left, right)) return true;
  return right?.status === "proposed" && !right.confirmed_by_user
    && left?.status === "confirmed" && left.confirmed_by_user
    && sameDailyLogContent(left, right);
}

export class SqliteStore {
  #db;
  #now;

  constructor({ databasePath, now = () => new Date() }) {
    const path = resolve(databasePath);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.#db = new DatabaseSync(path, { enableForeignKeyConstraints: true });
    try { chmodSync(path, 0o600); } catch { /* Windows ACLs and managed volumes may own permissions. */ }
    this.#db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    this.#now = now;
    this.#migrate();
  }

  close() {
    this.#db.close();
  }

  #migrate() {
    this.#db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
    const applied = new Set(this.#db.prepare("SELECT version FROM schema_migrations").all().map(row => row.version));
    const migrations = readdirSync(migrationDirectory).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
    for (const version of migrations) {
      if (applied.has(version)) continue;
      this.#db.exec("BEGIN IMMEDIATE");
      try {
        this.#db.exec(readFileSync(resolve(migrationDirectory, version), "utf8"));
        this.#db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(version, timestamp(this.#now));
        this.#db.exec("COMMIT");
      } catch (cause) {
        this.#db.exec("ROLLBACK");
        throw cause;
      }
    }
  }

  #transaction(run) {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const value = run();
      this.#db.exec("COMMIT");
      return value;
    } catch (cause) {
      this.#db.exec("ROLLBACK");
      throw databaseError(cause);
    }
  }

  #userFor(identity) {
    const existing = this.#db.prepare("SELECT * FROM users WHERE oidc_issuer = ? AND oidc_subject = ?").get(identity.issuer, identity.subject);
    if (existing) return existing;
    const now = timestamp(this.#now);
    const id = crypto.randomUUID();
    this.#db.prepare("INSERT INTO users (id, oidc_issuer, oidc_subject, data_version, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)")
      .run(id, identity.issuer, identity.subject, now, now);
    return this.#db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  }

  #eventsFor(userId) {
    return this.#db.prepare("SELECT * FROM calendar_events WHERE user_id = ? ORDER BY start_at ASC, id ASC").all(userId).map(eventFromRow);
  }

  #recordFor(userId) {
    const row = this.#db.prepare("SELECT snapshot_json FROM home_snapshots WHERE user_id = ?").get(userId);
    if (!row) return null;
    const record = parseStoredSnapshot(row.snapshot_json);
    const preferences = isObject(record.preferences) ? record.preferences : {};
    return {
      ...record,
      preferences: { ...preferences, calendar_events: this.#eventsFor(userId) },
      conversations: [],
    };
  }

  #persistRecord(userId, record, prior) {
    const stored = {
      ...record,
      preferences: { ...(isObject(record?.preferences) ? record.preferences : {}), calendar_events: [] },
      conversations: [],
    };
    const now = timestamp(this.#now);
    this.#db.prepare(`
      INSERT INTO home_snapshots (user_id, snapshot_json, version, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET snapshot_json = excluded.snapshot_json,
        version = home_snapshots.version + 1, updated_at = excluded.updated_at
    `).run(userId, JSON.stringify(stored), now, now);
    const events = Array.isArray(record?.preferences?.calendar_events) ? record.preferences.calendar_events : [];
    const eventIds = new Set();
    const actionIds = new Set();
    for (const event of events) {
      if (!event?.id || eventIds.has(event.id)) throw new ApiError(422, "invalid_schedule", "日程标识不能重复。");
      eventIds.add(event.id);
      if (event.sourceActionId && actionIds.has(event.sourceActionId)) throw new ApiError(409, "schedule_confirmation_conflict", "同一建议不能生成多个正式日程。");
      if (event.sourceActionId) actionIds.add(event.sourceActionId);
    }
    this.#db.prepare("DELETE FROM calendar_events WHERE user_id = ?").run(userId);
    const insert = this.#db.prepare(`
      INSERT INTO calendar_events (id, user_id, summary, start_at, duration_minutes, source, source_action_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const event of events) {
      insert.run(event.id, userId, event.summary, event.start, event.duration_minutes || null, event.source || "manual", event.sourceActionId || null, event.status || "confirmed", event.created_at || prior?.created_at || now, event.updated_at || now);
    }
  }

  #bumpVersion(user, operation, resource) {
    const now = timestamp(this.#now);
    const version = Number(user.data_version) + 1;
    this.#db.prepare("UPDATE users SET data_version = ?, updated_at = ? WHERE id = ?").run(version, now, user.id);
    this.#db.prepare("INSERT INTO sync_audit (id, user_id, operation, resource, data_version, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(crypto.randomUUID(), user.id, operation, resource, version, now);
    return { data_version: version, updated_at: now };
  }

  #assertVersion(user, expectedVersion) {
    if (Number(user.data_version) === 0) return;
    if (expectedVersion == null) {
      throw new ApiError(428, "sync_precondition_required", "此数据已有远端版本，请先读取最新版本后再提交。", { data_version: user.data_version, updated_at: user.updated_at });
    }
    if (expectedVersion !== Number(user.data_version)) {
      throw new ApiError(409, "sync_conflict", "数据已在其他设备或会话中更新，请先读取最新版本后再处理。", { data_version: user.data_version, updated_at: user.updated_at });
    }
  }

  metadata(identity) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      return { data_version: Number(user.data_version), updated_at: user.updated_at };
    });
  }

  readRecord(identity) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      return { record: this.#recordFor(user.id), meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
    });
  }

  mutateRecord(identity, { expectedVersion, operation, resource }, mutate) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      this.#assertVersion(user, expectedVersion);
      const prior = this.#recordFor(user.id);
      const result = mutate(prior);
      const record = result?.record || result;
      if (!isObject(record)) throw new ApiError(500, "invalid_persistence_result", "服务端未能保存此操作。");
      this.#persistRecord(user.id, record, prior);
      return { result, record, meta: this.#bumpVersion(user, operation, resource) };
    });
  }

  appendMessage(identity, conversationId, input) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const existing = this.#db.prepare(`
        SELECT * FROM conversation_messages
        WHERE user_id = ? AND conversation_id = ? AND client_message_id = ?
      `).get(user.id, conversationId, input.id);
      if (existing) {
        if (existing.role !== input.role || existing.text !== input.text || existing.source !== input.source || existing.occurred_at !== input.occurred_at) {
          throw new ApiError(409, "message_id_conflict", "同一消息标识不能对应不同内容。");
        }
        return { response: { message: messageFromRow(existing), idempotent_replay: true }, meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
      }
      const now = timestamp(this.#now);
      this.#db.prepare(`
        INSERT INTO conversations (user_id, conversation_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, conversation_id) DO UPDATE SET updated_at = excluded.updated_at
      `).run(user.id, conversationId, now, now);
      this.#db.prepare(`
        INSERT INTO conversation_messages (user_id, conversation_id, client_message_id, role, text, source, occurred_at, received_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(user.id, conversationId, input.id, input.role, input.text, input.source, input.occurred_at, now, now);
      this.#db.prepare(`
        DELETE FROM conversation_messages
        WHERE rowid IN (
          SELECT rowid FROM conversation_messages
          WHERE user_id = ? AND conversation_id = ?
          ORDER BY occurred_at DESC, client_message_id DESC
          LIMIT -1 OFFSET 500
        )
      `).run(user.id, conversationId);
      const message = this.#db.prepare(`
        SELECT * FROM conversation_messages
        WHERE user_id = ? AND conversation_id = ? AND client_message_id = ?
      `).get(user.id, conversationId, input.id);
      return {
        response: { message: messageFromRow(message), idempotent_replay: false },
        meta: this.#bumpVersion(user, "append", "conversation_message"),
      };
    });
  }

  listMessages(identity, conversationId, { limit, before } = {}) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const count = this.#db.prepare("SELECT COUNT(*) AS count FROM conversation_messages WHERE user_id = ? AND conversation_id = ?").get(user.id, conversationId).count;
      const suppliedLimit = limit == null ? 50 : Number(limit);
      if (!Number.isInteger(suppliedLimit) || suppliedLimit < 1 || suppliedLimit > 100) {
        throw new ApiError(422, "invalid_page", "limit 必须是 1 到 100 的整数。");
      }
      let query;
      let params;
      if (before != null) {
        const marker = this.#db.prepare(`
          SELECT occurred_at, client_message_id FROM conversation_messages
          WHERE user_id = ? AND conversation_id = ? AND client_message_id = ?
        `).get(user.id, conversationId, before);
        if (!marker) throw new ApiError(404, "message_not_found", "分页消息标识不存在。");
        query = `
          SELECT * FROM conversation_messages
          WHERE user_id = ? AND conversation_id = ?
            AND (occurred_at < ? OR (occurred_at = ? AND client_message_id < ?))
          ORDER BY occurred_at DESC, client_message_id DESC LIMIT ?
        `;
        params = [user.id, conversationId, marker.occurred_at, marker.occurred_at, marker.client_message_id, suppliedLimit];
      } else {
        query = `SELECT * FROM conversation_messages WHERE user_id = ? AND conversation_id = ? ORDER BY occurred_at DESC, client_message_id DESC LIMIT ?`;
        params = [user.id, conversationId, suppliedLimit];
      }
      const descending = this.#db.prepare(query).all(...params);
      const messages = descending.reverse().map(messageFromRow);
      const conversation = this.#db.prepare("SELECT * FROM conversations WHERE user_id = ? AND conversation_id = ?").get(user.id, conversationId);
      return {
        data: {
          conversation: { id: conversationId, created_at: conversation?.created_at || null, updated_at: conversation?.updated_at || null, message_count: Number(count) },
          messages,
          next_before: Number(count) > messages.length && messages.length ? messages[0].id : null,
        },
        meta: { data_version: Number(user.data_version), updated_at: user.updated_at },
      };
    });
  }

  listMemories(identity, { type = null, status = null, source_type: sourceType = null, topic = null, limit = 50 } = {}) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const clauses = ["user_id = ?"];
      const params = [user.id];
      if (type) { clauses.push("type = ?"); params.push(type); }
      if (status) { clauses.push("status = ?"); params.push(status); }
      if (sourceType) { clauses.push("source_type = ?"); params.push(sourceType); }
      if (topic) { clauses.push("topic = ?"); params.push(topic); }
      params.push(limit);
      const rows = this.#db.prepare(`
        SELECT * FROM memories
        WHERE ${clauses.join(" AND ")}
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
      `).all(...params);
      return {
        data: { memories: rows.map(memoryFromRow) },
        meta: { data_version: Number(user.data_version), updated_at: user.updated_at },
      };
    });
  }

  getMemory(identity, id) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const row = this.#db.prepare("SELECT * FROM memories WHERE user_id = ? AND id = ?").get(user.id, id);
      if (!row) throw new ApiError(404, "memory_not_found", "这条记忆不存在。 ");
      return { memory: memoryFromRow(row), meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
    });
  }

  createMemory(identity, { input, expectedVersion }) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const existing = this.#db.prepare("SELECT * FROM memories WHERE user_id = ? AND id = ?").get(user.id, input.id);
      if (existing) {
        if (!sameMemoryCreateReplay(memoryFromRow(existing), input)) throw new ApiError(409, "memory_id_conflict", "同一记忆标识不能对应不同内容。 ");
        return { memory: memoryFromRow(existing), created: false, meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
      }
      this.#assertVersion(user, expectedVersion);
      const now = timestamp(this.#now);
      this.#db.prepare(`
        INSERT INTO memories
          (id, user_id, type, content, source_type, source_id, topic, status, confirmed_by_user, confidence, importance, created_at, updated_at, archived_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `).run(input.id, user.id, input.type, input.content, input.source_type, input.source_id || null, input.topic || null, input.status, input.confirmed_by_user ? 1 : 0, input.confidence, input.importance, now, now);
      const row = this.#db.prepare("SELECT * FROM memories WHERE user_id = ? AND id = ?").get(user.id, input.id);
      return { memory: memoryFromRow(row), created: true, meta: this.#bumpVersion(user, "create", "memory") };
    });
  }

  transitionMemory(identity, { id, expectedVersion, transition }) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const existing = this.#db.prepare("SELECT * FROM memories WHERE user_id = ? AND id = ?").get(user.id, id);
      if (!existing) throw new ApiError(404, "memory_not_found", "这条记忆不存在。 ");
      if (transition === "confirm" && existing.status === "confirmed" && existing.confirmed_by_user) {
        return { memory: memoryFromRow(existing), changed: false, meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
      }
      if (transition === "archive" && existing.status === "archived") {
        return { memory: memoryFromRow(existing), changed: false, meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
      }
      if (transition === "confirm" && existing.status === "archived") throw new ApiError(409, "memory_archived", "已归档的记忆不能直接确认。 ");
      this.#assertVersion(user, expectedVersion);
      const now = timestamp(this.#now);
      if (transition === "confirm") {
        this.#db.prepare(`UPDATE memories SET status = 'confirmed', confirmed_by_user = 1, updated_at = ?, archived_at = NULL WHERE user_id = ? AND id = ?`).run(now, user.id, id);
      } else if (transition === "archive") {
        this.#db.prepare(`UPDATE memories SET status = 'archived', confirmed_by_user = 0, updated_at = ?, archived_at = ? WHERE user_id = ? AND id = ?`).run(now, now, user.id, id);
      } else {
        throw new ApiError(422, "invalid_memory_transition", "不支持的记忆状态变更。 ");
      }
      const row = this.#db.prepare("SELECT * FROM memories WHERE user_id = ? AND id = ?").get(user.id, id);
      return { memory: memoryFromRow(row), changed: true, meta: this.#bumpVersion(user, transition, "memory") };
    });
  }

  deleteMemory(identity, { id, expectedVersion }) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const existing = this.#db.prepare("SELECT * FROM memories WHERE user_id = ? AND id = ?").get(user.id, id);
      if (!existing) throw new ApiError(404, "memory_not_found", "这条记忆不存在。 ");
      this.#assertVersion(user, expectedVersion);
      this.#db.prepare("DELETE FROM memories WHERE user_id = ? AND id = ?").run(user.id, id);
      return { deleted: true, meta: this.#bumpVersion(user, "delete", "memory") };
    });
  }

  listDailyLogs(identity, { date = null, status = null, limit = 31 } = {}) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const clauses = ["user_id = ?"];
      const params = [user.id];
      if (date) { clauses.push('"date" = ?'); params.push(date); }
      if (status) { clauses.push("status = ?"); params.push(status); }
      params.push(limit);
      const rows = this.#db.prepare(`SELECT * FROM daily_logs WHERE ${clauses.join(" AND ")} ORDER BY "date" DESC, updated_at DESC, id DESC LIMIT ?`).all(...params);
      return { data: { daily_logs: rows.map(dailyLogFromRow) }, meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
    });
  }

  getDailyLog(identity, id) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const row = this.#db.prepare("SELECT * FROM daily_logs WHERE user_id = ? AND id = ?").get(user.id, id);
      if (!row) throw new ApiError(404, "daily_log_not_found", "这份成长日志不存在。 ");
      return { daily_log: dailyLogFromRow(row), meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
    });
  }

  createDailyLog(identity, { input, expectedVersion }) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const existingById = this.#db.prepare("SELECT * FROM daily_logs WHERE user_id = ? AND id = ?").get(user.id, input.id);
      if (existingById) {
        const existing = dailyLogFromRow(existingById);
        if (!sameDailyLogCreateReplay(existing, input)) throw new ApiError(409, "daily_log_id_conflict", "同一日志标识不能对应不同内容。 ");
        return { daily_log: existing, created: false, meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
      }
      this.#assertVersion(user, expectedVersion);
      const existingDate = this.#db.prepare('SELECT * FROM daily_logs WHERE user_id = ? AND "date" = ?').get(user.id, input.date);
      if (existingDate) throw new ApiError(409, "daily_log_date_conflict", "同一天只能保留一份成长日志，请更新已有草稿。 ");
      const now = timestamp(this.#now);
      this.#db.prepare(`
        INSERT INTO daily_logs
          (id, user_id, "date", completed, problems, learned, tomorrow_plan, ai_summary, status, confirmed_by_user, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(input.id, user.id, input.date, jsonList(input.completed), jsonList(input.problems), jsonList(input.learned), input.tomorrow_plan || "", input.ai_summary || "", input.status || "draft", input.confirmed_by_user ? 1 : 0, now, now);
      const row = this.#db.prepare("SELECT * FROM daily_logs WHERE user_id = ? AND id = ?").get(user.id, input.id);
      return { daily_log: dailyLogFromRow(row), created: true, meta: this.#bumpVersion(user, "create", "daily_log") };
    });
  }

  updateDailyLog(identity, { id, expectedVersion, patch }) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const existingRow = this.#db.prepare("SELECT * FROM daily_logs WHERE user_id = ? AND id = ?").get(user.id, id);
      if (!existingRow) throw new ApiError(404, "daily_log_not_found", "这份成长日志不存在。 ");
      const existing = dailyLogFromRow(existingRow);
      if (existing.status === "confirmed") throw new ApiError(409, "daily_log_confirmed", "已确认的成长日志不能直接修改。 ");
      if (patch.status === "confirmed") throw new ApiError(422, "daily_log_confirmation_required", "确认请使用独立的 confirm 接口。 ");
      this.#assertVersion(user, expectedVersion);
      const next = { ...existing, ...patch, id: existing.id, confirmed_by_user: false };
      const now = timestamp(this.#now);
      this.#db.prepare(`
        UPDATE daily_logs
        SET "date" = ?, completed = ?, problems = ?, learned = ?, tomorrow_plan = ?, ai_summary = ?, status = ?, confirmed_by_user = 0, updated_at = ?
        WHERE user_id = ? AND id = ?
      `).run(next.date, jsonList(next.completed), jsonList(next.problems), jsonList(next.learned), next.tomorrow_plan || "", next.ai_summary || "", next.status || existing.status, now, user.id, id);
      const row = this.#db.prepare("SELECT * FROM daily_logs WHERE user_id = ? AND id = ?").get(user.id, id);
      return { daily_log: dailyLogFromRow(row), meta: this.#bumpVersion(user, "update", "daily_log") };
    });
  }

  confirmDailyLog(identity, { id, expectedVersion }) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const existing = this.#db.prepare("SELECT * FROM daily_logs WHERE user_id = ? AND id = ?").get(user.id, id);
      if (!existing) throw new ApiError(404, "daily_log_not_found", "这份成长日志不存在。 ");
      if (existing.status === "confirmed" && existing.confirmed_by_user) {
        return { daily_log: dailyLogFromRow(existing), changed: false, meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
      }
      this.#assertVersion(user, expectedVersion);
      const now = timestamp(this.#now);
      this.#db.prepare("UPDATE daily_logs SET status = 'confirmed', confirmed_by_user = 1, updated_at = ? WHERE user_id = ? AND id = ?").run(now, user.id, id);
      const row = this.#db.prepare("SELECT * FROM daily_logs WHERE user_id = ? AND id = ?").get(user.id, id);
      return { daily_log: dailyLogFromRow(row), changed: true, meta: this.#bumpVersion(user, "confirm", "daily_log") };
    });
  }

  deleteDailyLog(identity, { id, expectedVersion }) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const existing = this.#db.prepare("SELECT id FROM daily_logs WHERE user_id = ? AND id = ?").get(user.id, id);
      if (!existing) throw new ApiError(404, "daily_log_not_found", "这份成长日志不存在。 ");
      this.#assertVersion(user, expectedVersion);
      this.#db.prepare("DELETE FROM daily_logs WHERE user_id = ? AND id = ?").run(user.id, id);
      return { deleted: true, meta: this.#bumpVersion(user, "delete", "daily_log") };
    });
  }

  listLearningEvidence(identity, { topic = null, skill = null, evidence_type: evidenceType = null, source_type: sourceType = null, limit = 50 } = {}) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const clauses = ["user_id = ?"];
      const params = [user.id];
      if (topic) { clauses.push("topic = ?"); params.push(topic); }
      if (skill) { clauses.push("skill = ?"); params.push(skill); }
      if (evidenceType) { clauses.push("evidence_type = ?"); params.push(evidenceType); }
      if (sourceType) { clauses.push("source_type = ?"); params.push(sourceType); }
      params.push(limit);
      const rows = this.#db.prepare(`SELECT * FROM learning_evidence WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`).all(...params);
      return { data: { learning_evidence: rows.map(evidenceFromRow) }, meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
    });
  }

  getLearningEvidence(identity, id) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const row = this.#db.prepare("SELECT * FROM learning_evidence WHERE user_id = ? AND id = ?").get(user.id, id);
      if (!row) throw new ApiError(404, "learning_evidence_not_found", "这条学习证据不存在。 ");
      return { learning_evidence: evidenceFromRow(row), meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
    });
  }

  createLearningEvidence(identity, { input, expectedVersion }) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const existing = this.#db.prepare("SELECT * FROM learning_evidence WHERE user_id = ? AND id = ?").get(user.id, input.id);
      if (existing) {
        if (!sameEvidence(evidenceFromRow(existing), input)) throw new ApiError(409, "learning_evidence_id_conflict", "同一证据标识不能对应不同内容。 ");
        return { learning_evidence: evidenceFromRow(existing), created: false, meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
      }
      this.#assertVersion(user, expectedVersion);
      if (input.source_id) {
        const source = this.#db.prepare(`SELECT * FROM learning_evidence WHERE user_id = ? AND source_type = ? AND source_id = ? AND evidence_type = ? AND topic = ? AND skill = ?`).get(user.id, input.source_type, input.source_id, input.evidence_type, input.topic, input.skill);
        if (source) {
          if (!sameEvidence(evidenceFromRow(source), input)) throw new ApiError(409, "learning_evidence_source_conflict", "同一来源不能重复写入不同学习证据。 ");
          return { learning_evidence: evidenceFromRow(source), created: false, meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
        }
      }
      const now = timestamp(this.#now);
      this.#db.prepare(`
        INSERT INTO learning_evidence
          (id, user_id, topic, skill, evidence_type, result, score, source_type, source_id, confidence, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(input.id, user.id, input.topic, input.skill, input.evidence_type, input.result, input.score, input.source_type, input.source_id || null, input.confidence, now, now);
      const row = this.#db.prepare("SELECT * FROM learning_evidence WHERE user_id = ? AND id = ?").get(user.id, input.id);
      return { learning_evidence: evidenceFromRow(row), created: true, meta: this.#bumpVersion(user, "create", "learning_evidence") };
    });
  }

  deleteLearningEvidence(identity, { id, expectedVersion }) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const existing = this.#db.prepare("SELECT id FROM learning_evidence WHERE user_id = ? AND id = ?").get(user.id, id);
      if (!existing) throw new ApiError(404, "learning_evidence_not_found", "这条学习证据不存在。 ");
      this.#assertVersion(user, expectedVersion);
      this.#db.prepare("DELETE FROM learning_evidence WHERE user_id = ? AND id = ?").run(user.id, id);
      return { deleted: true, meta: this.#bumpVersion(user, "delete", "learning_evidence") };
    });
  }

  contextInputs(identity, { conversationId = "main", date = null, memoryLimit = 100, evidenceLimit = 100 } = {}) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const record = this.#recordFor(user.id);
      const memoryRows = this.#db.prepare("SELECT * FROM memories WHERE user_id = ? AND status IN ('confirmed', 'proposed') ORDER BY updated_at DESC, id DESC LIMIT ?").all(user.id, memoryLimit);
      const evidenceRows = this.#db.prepare("SELECT * FROM learning_evidence WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?").all(user.id, evidenceLimit);
      const todayLog = date ? this.#db.prepare('SELECT * FROM daily_logs WHERE user_id = ? AND "date" = ?').get(user.id, date) : null;
      const messages = this.#db.prepare(`
        SELECT * FROM conversation_messages
        WHERE user_id = ? AND conversation_id = ?
        ORDER BY occurred_at DESC, client_message_id DESC
        LIMIT 12
      `).all(user.id, conversationId).reverse().map(messageFromRow);
      return {
        // The Context Builder uses this internal owner marker only to reject
        // any mismatched rows before projecting them. It is not emitted in
        // the model-facing current_user projection.
        profile: { ...(record?.preferences || {}), user_id: user.id },
        agent_state: record?.agent_state || {},
        current_task: record?.agent_state?.next_recommended_action || null,
        today_state: { user_id: user.id, current_state: record?.agent_state?.current_state || {}, daily_log: dailyLogFromRow(todayLog) },
        memories: memoryRows.filter(row => row.status === "confirmed").map(memoryFromRow),
        proposed_memories: memoryRows.filter(row => row.status === "proposed").map(memoryFromRow),
        learning_evidence: evidenceRows.map(evidenceFromRow),
        recent_conversation: messages,
        meta: { data_version: Number(user.data_version), updated_at: user.updated_at },
      };
    });
  }

  confirmSuggestion(identity, { expectedVersion, suggestionId, payload, confirm }) {
    return this.#transaction(() => {
      const user = this.#userFor(identity);
      const prior = this.#recordFor(user.id);
      const alreadyConfirmed = prior?.preferences?.calendar_events?.find(event => event.sourceActionId === suggestionId);
      if (alreadyConfirmed) {
        return { response: { event: alreadyConfirmed, idempotent_replay: true }, created: false, meta: { data_version: Number(user.data_version), updated_at: user.updated_at } };
      }
      if (prior?.agent_state?.next_recommended_action?.id !== suggestionId) {
        throw new ApiError(404, "suggestion_not_found", "这条建议已不再是当前可确认的安排。");
      }
      this.#assertVersion(user, expectedVersion);
      const outcome = confirm(prior);
      this.#persistRecord(user.id, outcome.record, prior);
      return { response: outcome.response, created: outcome.created, meta: this.#bumpVersion(user, "confirm", "schedule_suggestion") };
    });
  }
}
