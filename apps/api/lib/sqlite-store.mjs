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
