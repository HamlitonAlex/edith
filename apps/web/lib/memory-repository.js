import { buildAiContext } from "../agent/context-builder.js";

const SCHEMA_VERSION = 1;
const DEFAULT_SCOPE = "anonymous";
const ANONYMOUS_SCOPE_KEY = `xuecheng:memory-foundation:v${SCHEMA_VERSION}:anonymous-session`;
const SYNC_COLLECTIONS = ["memories", "daily_logs", "learning_evidence"];
const memoryFallback = new Map();
const asObject = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const asArray = value => Array.isArray(value) ? value : [];

function keyFor(scope) {
  return `xuecheng:memory-foundation:v${SCHEMA_VERSION}:${encodeURIComponent(String(scope || DEFAULT_SCOPE))}`;
}

function normalizedScope(scope) {
  return String(scope == null ? "" : scope).trim() || DEFAULT_SCOPE;
}

function plainStorageRead(storage, key) {
  try {
    return storage?.getItem?.(key) ?? memoryFallback.get(key) ?? null;
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

function plainStorageWrite(storage, key, value) {
  try {
    if (storage?.setItem) storage.setItem(key, value);
    else memoryFallback.set(key, value);
  } catch {
    memoryFallback.set(key, value);
  }
}

function anonymousScope(storage, { rotate = false } = {}) {
  const prior = rotate ? null : plainStorageRead(storage, ANONYMOUS_SCOPE_KEY);
  if (typeof prior === "string" && /^anonymous_[a-zA-Z0-9_-]{8,}$/.test(prior)) return prior;
  const created = `anonymous_${generatedId("session").replace(/^session_/, "")}`;
  plainStorageWrite(storage, ANONYMOUS_SCOPE_KEY, created);
  return created;
}

function resolveScope(storage, scope, { rotateAnonymous = false } = {}) {
  const normalized = normalizedScope(scope);
  return normalized === DEFAULT_SCOPE ? anonymousScope(storage, { rotate: rotateAnonymous }) : normalized;
}

function isAnonymousScope(scope) {
  return /^anonymous_[a-zA-Z0-9_-]{8,}$/.test(String(scope || ""));
}

export function memoryScopeForIdentity({ issuer, subject } = {}) {
  const safeIssuer = String(issuer || "").trim();
  const safeSubject = String(subject || "").trim();
  if (!safeIssuer || !safeSubject) throw localError("memory_scope_required", "登录后的记忆必须使用已验证的身份作用域。", 401);
  return `oidc:${encodeURIComponent(safeIssuer)}:${encodeURIComponent(safeSubject)}`;
}

function clone(value) {
  return structuredClone(value);
}

function nowIso(now) {
  return now().toISOString();
}

function localError(code, message, status = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function generatedId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function emptyState() {
  return {
    schema_version: SCHEMA_VERSION,
    memories: [],
    daily_logs: [],
    learning_evidence: [],
    tombstones: [],
    sync_baseline: { memories: {}, daily_logs: {}, learning_evidence: {} },
    remote_version: null,
    updated_at: null,
  };
}

function safeText(value, maximum) {
  return String(value ?? "").trim().slice(0, maximum);
}

function storedMemory(value) {
  const source = asObject(value);
  const id = safeText(source.id, 128);
  const content = safeText(source.content, 4000);
  if (!id || !content) return null;
  const sourceType = safeText(source.source_type || "manual", 40) || "manual";
  const requestedStatus = safeText(source.status || "proposed", 24);
  const confirmed = requestedStatus === "confirmed" && source.confirmed_by_user === true;
  return {
    id,
    type: ["long_term", "stage", "recent_event"].includes(source.type) ? source.type : "recent_event",
    content,
    source_type: sourceType,
    source_id: source.source_id == null ? null : safeText(source.source_id, 160) || null,
    topic: source.topic == null ? null : safeText(source.topic, 160) || null,
    status: requestedStatus === "archived" ? "archived" : confirmed ? "confirmed" : "proposed",
    confirmed_by_user: confirmed,
    confidence: Math.max(0, Math.min(1, Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : 0.5)),
    importance: Math.max(0, Math.min(1, Number.isFinite(Number(source.importance)) ? Number(source.importance) : 0.5)),
    created_at: safeText(source.created_at, 64) || null,
    updated_at: safeText(source.updated_at, 64) || null,
    archived_at: source.archived_at == null ? null : safeText(source.archived_at, 64) || null,
  };
}

function storedDailyLog(value) {
  const source = asObject(value);
  const id = safeText(source.id, 128);
  const date = safeText(source.date, 16);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const list = input => asArray(input).map(item => safeText(item, 240)).filter(Boolean).slice(0, 50);
  const requestedStatus = safeText(source.status || "draft", 24);
  const confirmed = requestedStatus === "confirmed" && source.confirmed_by_user === true;
  return {
    id,
    date,
    completed: list(source.completed),
    problems: list(source.problems),
    learned: list(source.learned),
    tomorrow_plan: safeText(source.tomorrow_plan, 2000),
    ai_summary: safeText(source.ai_summary, 4000),
    status: confirmed ? "confirmed" : ["draft", "proposed"].includes(requestedStatus) ? requestedStatus : "draft",
    confirmed_by_user: confirmed,
    created_at: safeText(source.created_at, 64) || null,
    updated_at: safeText(source.updated_at, 64) || null,
  };
}

function storedEvidence(value) {
  const source = asObject(value);
  const id = safeText(source.id, 128);
  const topic = safeText(source.topic, 180);
  const skill = safeText(source.skill, 180);
  const result = safeText(source.result, 2000);
  const evidenceType = safeText(source.evidence_type, 48);
  const sourceType = safeText(source.source_type, 40);
  const allowedEvidence = ["exercise_completed", "correct_answer", "wrong_answer", "incorrect_answer", "practice_completed", "tutor_verification", "tutor_observation", "self_assessment", "user_self_report", "project_completed", "exam_result", "assessment", "explanation", "independent_solution", "transfer", "correction"];
  const allowedSources = ["exercise", "tutor", "project", "exam", "user", "manual"];
  if (!id || !topic || !skill || !result || !allowedEvidence.includes(evidenceType) || !allowedSources.includes(sourceType) || (sourceType === "user" && !["self_assessment", "user_self_report"].includes(evidenceType))) return null;
  const score = source.score == null ? null : Number(source.score);
  if (score != null && (!Number.isFinite(score) || score < 0 || score > 100)) return null;
  return {
    id, topic, skill, evidence_type: evidenceType, result, score, source_type: sourceType,
    source_id: source.source_id == null ? null : safeText(source.source_id, 160) || null,
    confidence: Math.max(0, Math.min(1, Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : 0.5)),
    created_at: safeText(source.created_at, 64) || null,
    updated_at: safeText(source.updated_at, 64) || null,
  };
}

function normalizedBaselines(value) {
  const source = asObject(value);
  const projections = { memories: storedMemory, daily_logs: storedDailyLog, learning_evidence: storedEvidence };
  return Object.fromEntries(SYNC_COLLECTIONS.map(collection => [collection, Object.fromEntries(
    Object.entries(asObject(source[collection])).map(([, record]) => projections[collection](record)).filter(Boolean).map(record => [record.id, record]),
  )]));
}

function normalizeState(value) {
  const source = asObject(value);
  return {
    ...emptyState(),
    ...source,
    schema_version: SCHEMA_VERSION,
    memories: asArray(source.memories).map(storedMemory).filter(Boolean),
    daily_logs: asArray(source.daily_logs).map(storedDailyLog).filter(Boolean),
    learning_evidence: asArray(source.learning_evidence).map(storedEvidence).filter(Boolean),
    tombstones: asArray(source.tombstones).map(item => {
      const candidate = asObject(item);
      const collection = SYNC_COLLECTIONS.includes(candidate.collection) ? candidate.collection : null;
      const id = safeText(candidate.id, 128);
      return collection && id ? { collection, id, deleted_at: safeText(candidate.deleted_at, 64) || null } : null;
    }).filter(Boolean),
    sync_baseline: normalizedBaselines(source.sync_baseline),
  };
}

function readStorage(storage, key) {
  try {
    const raw = storage?.getItem?.(key) ?? memoryFallback.get(key);
    return raw ? normalizeState(JSON.parse(raw)) : emptyState();
  } catch {
    return emptyState();
  }
}

function writeStorage(storage, key, state) {
  const value = JSON.stringify(state);
  try {
    if (storage?.setItem) storage.setItem(key, value);
    else memoryFallback.set(key, value);
  } catch (error) {
    throw localError("local_persistence_failed", "设备端记忆暂时无法保存，请检查本地存储空间。", 507, error);
  }
}

function defaultStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

function normalizeMemory(input, now) {
  const source = asObject(input);
  const type = ["long_term", "stage", "recent_event"].includes(source.type) ? source.type : "recent_event";
  const status = source.status || "proposed";
  const confirmed = source.confirmed_by_user === true;
  if (!String(source.content || "").trim()) throw localError("invalid_memory", "记忆内容不能为空.", 422);
  // Creation is intentionally proposal-only. A caller cannot turn a model
  // inference into a user fact by labelling it as manual; explicit local
  // confirmation is represented by confirmMemory(id) after the proposal.
  if (status !== "proposed" || confirmed) {
    throw localError("memory_confirmation_required", "长期事实必须经过用户确认。", 422);
  }
  const at = source.created_at || nowIso(now);
  return {
    id: String(source.id || generatedId("memory")),
    type,
    content: String(source.content).trim().slice(0, 4000),
    source_type: String(source.source_type || "manual").trim().slice(0, 40),
    source_id: source.source_id == null ? null : String(source.source_id).slice(0, 160),
    topic: source.topic == null ? null : String(source.topic).slice(0, 160),
    status: "proposed",
    confirmed_by_user: false,
    confidence: Math.max(0, Math.min(1, Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : 0.5)),
    importance: Math.max(0, Math.min(1, Number.isFinite(Number(source.importance)) ? Number(source.importance) : 0.5)),
    created_at: at,
    updated_at: source.updated_at || at,
    archived_at: source.archived_at || null,
  };
}

function normalizeLog(input, now) {
  const source = asObject(input);
  const date = String(source.date || now().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw localError("invalid_daily_log_date", "成长日志日期格式不正确。", 422);
  const list = value => (Array.isArray(value) ? value : value == null || value === "" ? [] : [value]).map(item => String(item).trim()).filter(Boolean).slice(0, 50);
  const at = source.created_at || nowIso(now);
  const status = ["draft", "proposed", "confirmed"].includes(source.status) ? source.status : "draft";
  const confirmed = source.confirmed_by_user === true;
  if (status === "confirmed" || confirmed) {
    throw localError("daily_log_confirmation_required", "AI 总结必须经过用户明确确认。", 422);
  }
  return {
    id: String(source.id || generatedId("log")),
    date,
    completed: list(source.completed),
    problems: list(source.problems),
    learned: list(source.learned),
    tomorrow_plan: String(source.tomorrow_plan || "").trim().slice(0, 2000),
    ai_summary: String(source.ai_summary || "").trim().slice(0, 4000),
    status,
    confirmed_by_user: confirmed,
    created_at: at,
    updated_at: source.updated_at || at,
  };
}

function normalizeEvidence(input, now) {
  const source = asObject(input);
  const id = String(source.id || generatedId("evidence"));
  if (!String(source.topic || "").trim() || !String(source.skill || "").trim() || !String(source.result || "").trim()) {
    throw localError("invalid_learning_evidence", "学习证据需要 topic、skill 和 result。", 422);
  }
  const evidenceType = String(source.evidence_type || "").trim().slice(0, 48);
  const sourceType = String(source.source_type || "manual").trim().slice(0, 40);
  const evidenceTypes = new Set(["exercise_completed", "correct_answer", "wrong_answer", "incorrect_answer", "practice_completed", "tutor_verification", "tutor_observation", "self_assessment", "user_self_report", "project_completed", "exam_result", "assessment", "explanation", "independent_solution", "transfer", "correction"]);
  const sourceTypes = new Set(["exercise", "tutor", "project", "exam", "user", "manual"]);
  if (!evidenceTypes.has(evidenceType) || !sourceTypes.has(sourceType) || (sourceType === "user" && !["self_assessment", "user_self_report"].includes(evidenceType))) {
    throw localError("invalid_learning_evidence", "学习证据必须来自有效的练习、辅导、项目、考试或用户自评。", 422);
  }
  const score = source.score == null ? null : Number(source.score);
  if (score != null && (!Number.isFinite(score) || score < 0 || score > 100)) {
    throw localError("invalid_learning_evidence", "学习证据分数必须在 0 到 100 之间。", 422);
  }
  const at = source.created_at || nowIso(now);
  return {
    id,
    topic: String(source.topic).trim().slice(0, 180),
    skill: String(source.skill).trim().slice(0, 180),
    evidence_type: evidenceType,
    result: String(source.result).trim().slice(0, 2000),
    score,
    source_type: sourceType,
    source_id: source.source_id == null ? null : String(source.source_id).slice(0, 160),
    confidence: Math.max(0, Math.min(1, Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : 0.5)),
    created_at: at,
    updated_at: source.updated_at || at,
  };
}

function same(left, right) {
  const withoutTimestamps = value => {
    const { created_at, updated_at, archived_at, ...stable } = value;
    return stable;
  };
  return JSON.stringify(withoutTimestamps(left)) === JSON.stringify(withoutTimestamps(right));
}

/**
 * Local-first repository for the four Memory Foundation records. It never
 * calls the remote API on its own; sync is explicit and account-scoped.
 */
export function createMemoryRepository({ storage = defaultStorage(), scope = DEFAULT_SCOPE, remote = null, now = () => new Date() } = {}) {
  let accountScope = resolveScope(storage, scope);
  let state = readStorage(storage, keyFor(accountScope));
  let syncStatus = "local";
  let lastError = null;
  let scopeGeneration = 0;

  const refreshState = () => {
    state = readStorage(storage, keyFor(accountScope));
    return state;
  };
  const save = () => {
    state.updated_at = nowIso(now);
    writeStorage(storage, keyFor(accountScope), state);
  };
  const snapshot = () => ({
    scope: accountScope,
    sync_status: syncStatus,
    last_error: lastError,
    remote_version: state.remote_version,
    updated_at: state.updated_at,
  });
  const result = (data, created = true) => ({ ...data, created, local_only: true, state: snapshot() });

  const versionFrom = (response, fallback) => response?.version ?? response?.meta?.data_version ?? fallback;
  const payloadFrom = (response, key) => response?.data?.[key] ?? response?.[key] ?? null;
  const equalFields = (left, right, fields) => fields.every(field => {
    const a = Array.isArray(left?.[field]) ? JSON.stringify(left[field]) : left?.[field] ?? null;
    const b = Array.isArray(right?.[field]) ? JSON.stringify(right[field]) : right?.[field] ?? null;
    return a === b;
  });
  const sameMemoryContent = (left, right) => equalFields(left, right, ["id", "type", "content", "source_type", "source_id", "topic", "confidence", "importance"]);
  const sameMemoryRecord = (left, right) => sameMemoryContent(left, right) && equalFields(left, right, ["status", "confirmed_by_user"]);
  const sameDailyLogContent = (left, right) => equalFields(left, right, ["id", "date", "completed", "problems", "learned", "tomorrow_plan", "ai_summary"]);
  const sameDailyLogRecord = (left, right) => sameDailyLogContent(left, right) && equalFields(left, right, ["status", "confirmed_by_user"]);
  const sameEvidenceRecord = (left, right) => equalFields(left, right, ["id", "topic", "skill", "evidence_type", "result", "score", "source_type", "source_id", "confidence"]);
  const sameByCollection = { memories: sameMemoryRecord, daily_logs: sameDailyLogRecord, learning_evidence: sameEvidenceRecord };

  const baselineFor = (target, collection, id) => target.sync_baseline?.[collection]?.[id] || null;
  const setBaseline = (target, collection, record) => {
    target.sync_baseline ||= {};
    target.sync_baseline[collection] ||= {};
    target.sync_baseline[collection][record.id] = clone(record);
  };
  const clearBaseline = (target, collection, id) => {
    if (target.sync_baseline?.[collection]) delete target.sync_baseline[collection][id];
  };

  function clearTombstone(collection, id) {
    state.tombstones = state.tombstones.filter(item => item.collection !== collection || item.id !== id);
  }

  function addTombstone(collection, id) {
    clearTombstone(collection, id);
    state.tombstones.push({ collection, id, deleted_at: nowIso(now) });
  }

  function createIn(collection, item, label) {
    refreshState();
    const existing = state[collection].find(candidate => candidate.id === item.id);
    if (existing) {
      if (!same(existing, item)) throw localError(`${label}_id_conflict`, `同一${label}标识不能对应不同内容。`);
      return result({ [label]: clone(existing) }, false);
    }
    if (collection === "daily_logs" && state.daily_logs.some(candidate => candidate.date === item.date)) {
      throw localError("daily_log_date_conflict", "同一天只能保留一份成长日志。", 409);
    }
    state[collection].push(clone(item));
    clearTombstone(collection, item.id);
    save();
    return result({ [label]: clone(item) }, true);
  }

  function setScope(nextScope = DEFAULT_SCOPE) {
    scopeGeneration += 1;
    accountScope = resolveScope(storage, nextScope, { rotateAnonymous: normalizedScope(nextScope) === DEFAULT_SCOPE });
    state = readStorage(storage, keyFor(accountScope));
    syncStatus = "local";
    lastError = null;
    return snapshot();
  }

  function deleteIn(collection, id, label) {
    refreshState();
    const index = state[collection].findIndex(candidate => candidate.id === id);
    if (index === -1) throw localError(`${label}_not_found`, `这${label === "memory" ? "条记忆" : label === "daily_log" ? "份成长日志" : "条学习证据"}不存在。`, 404);
    const syncedRecord = baselineFor(state, collection, id);
    state[collection].splice(index, 1);
    if (syncedRecord) addTombstone(collection, id);
    else clearTombstone(collection, id);
    save();
    return result({ deleted: true });
  }

  const syncCancelled = runScope => ({
    scope: runScope,
    sync_status: "cancelled",
    last_error: "sync_cancelled",
    synced: false,
  });

  async function sync() {
    if (!remote) return { ...snapshot(), sync_status: "local", synced: false };
    refreshState();
    if (isAnonymousScope(accountScope)) {
      syncStatus = "requires_login";
      lastError = "sync_scope_required";
      return { ...snapshot(), synced: false };
    }
    const runScope = accountScope;
    const runState = clone(state);
    const runRemote = remote;
    const runGeneration = scopeGeneration;
    const active = () => accountScope === runScope && scopeGeneration === runGeneration;
    const assertActive = () => {
      if (!active()) throw localError("sync_cancelled", "账号已切换，本次同步已取消。", 409);
    };
    syncStatus = "syncing";
    lastError = null;
    try {
      let version = runState.remote_version;
      let remoteVersionAdvanced = false;
      const completedBaselines = [];
      const completedTombstones = [];

      // Explicit sync is not a bulk export. Pending AI proposals and unconfirmed
      // daily-log drafts stay on this device. An archived memory is eligible
      // only when it had already been synchronised, so an offline proposal
      // that was later dismissed is never sent merely to be archived.
      const syncableMemories = runState.memories.filter(memory => (
        (memory.status === "confirmed" && memory.confirmed_by_user)
        || (memory.status === "archived" && Boolean(baselineFor(runState, "memories", memory.id)))
      ));
      const syncableDailyLogs = runState.daily_logs.filter(log => log.status === "confirmed" && log.confirmed_by_user);
      const syncableEvidence = runState.learning_evidence;
      const selectedCollections = SYNC_COLLECTIONS.filter(collection => {
        const recordCount = collection === "memories" ? syncableMemories.length
          : collection === "daily_logs" ? syncableDailyLogs.length : syncableEvidence.length;
        return recordCount || runState.tombstones.some(item => item.collection === collection);
      });
      if (selectedCollections.length) {
        if (typeof runRemote.getSyncPolicy !== "function") {
          throw localError("sync_policy_unavailable", "同步服务未提供数据范围声明，本次未上传任何私人记录。", 503);
        }
        const policy = await runRemote.getSyncPolicy();
        assertActive();
        const policyVersion = versionFrom(policy, null);
        if (version == null) version = policyVersion;
        else if (policyVersion != null && policyVersion !== version) remoteVersionAdvanced = true;
        const allowed = new Set(asArray(policy?.data?.allowed ?? policy?.allowed));
        const denied = selectedCollections.filter(collection => !allowed.has(collection));
        if (denied.length) throw localError("sync_policy_denied", `同步服务未允许同步：${denied.join("、")}。`, 403);
      }

      const findRemote = async ({ get, list, field, listField = field, id, originalError }) => {
        let response;
        if (typeof get === "function") response = await get(id);
        else if (typeof list === "function") response = await list({ limit: 100 });
        else throw originalError;
        assertActive();
        version = versionFrom(response, version);
        const direct = payloadFrom(response, field);
        const records = Array.isArray(direct)
          ? direct
          : direct ? [direct] : asArray(response?.data?.[listField] ?? response?.[listField]);
        const existing = records.find(candidate => candidate?.id === id);
        if (!existing) throw originalError;
        return existing;
      };

      const markBaseline = (collection, record) => completedBaselines.push({ collection, record: clone(record) });

      for (const tombstone of runState.tombstones) {
        let remove;
        try {
          const method = tombstone.collection === "memories" ? runRemote.deleteMemory
            : tombstone.collection === "daily_logs" ? runRemote.deleteDailyLog : runRemote.deleteLearningEvidence;
          if (typeof method !== "function") throw localError("sync_policy_unavailable", "同步服务不支持删除这类记录，本次未覆盖远端数据。", 503);
          const deleted = await method(tombstone.id, version);
          assertActive();
          version = versionFrom(deleted, version);
          remove = true;
        } catch (error) {
          if (error?.code === "memory_not_found" || error?.code === "daily_log_not_found" || error?.code === "learning_evidence_not_found") remove = true;
          else throw error;
        }
        if (remove) completedTombstones.push(tombstone);
      }

      for (const memory of syncableMemories) {
        const baseline = baselineFor(runState, "memories", memory.id);
        if (remoteVersionAdvanced && baseline && !sameMemoryRecord(memory, baseline)) {
          throw localError("sync_conflict", "远端账户已变化，本地记忆状态未被静默覆盖。", 409);
        }
        const mustBeginAsProposal = memory.status === "archived" || memory.status === "confirmed";
        const initial = mustBeginAsProposal
          ? { ...memory, status: "proposed", confirmed_by_user: false, archived_at: null }
          : { ...memory, archived_at: null };
        let remoteMemory;
        try {
          const created = await runRemote.createMemory(initial, version);
          assertActive();
          version = versionFrom(created, version);
          remoteMemory = payloadFrom(created, "memory") || initial;
        } catch (error) {
          if (error?.code !== "memory_id_conflict") throw error;
          remoteMemory = await findRemote({ get: runRemote.getMemory, list: runRemote.listMemories, field: "memory", listField: "memories", id: memory.id, originalError: error });
        }
        if (!sameMemoryContent(remoteMemory, memory)) {
          throw localError("sync_conflict", "远端存在同一标识但内容不同的记忆，未覆盖任一端数据。", 409);
        }
        if (!sameMemoryRecord(remoteMemory, memory)) {
          const advancesProposal = (memory.status === "confirmed" || memory.status === "archived")
            && remoteMemory.status === "proposed";
          const appliesKnownTransition = Boolean(baseline
            && sameMemoryRecord(remoteMemory, baseline)
            && ((baseline.status === "proposed" && (memory.status === "confirmed" || memory.status === "archived"))
              || (baseline.status === "confirmed" && memory.status === "archived")));
          if (!advancesProposal && !appliesKnownTransition) {
            throw localError("sync_conflict", "远端记忆状态已变化，需要先由用户决定如何处理。", 409);
          }
        }
        if (memory.status === "confirmed" && (remoteMemory.status !== "confirmed" || !remoteMemory.confirmed_by_user)) {
          const confirmed = await runRemote.confirmMemory(memory.id, version);
          assertActive();
          version = versionFrom(confirmed, version);
        } else if (memory.status === "archived" && remoteMemory.status !== "archived") {
          const archived = await runRemote.archiveMemory(memory.id, version);
          assertActive();
          version = versionFrom(archived, version);
        }
        markBaseline("memories", memory);
      }
      for (const log of syncableDailyLogs) {
        const baseline = baselineFor(runState, "daily_logs", log.id);
        if (remoteVersionAdvanced && baseline && !sameDailyLogRecord(log, baseline)) {
          throw localError("sync_conflict", "远端账户已变化，本地成长日志未被静默覆盖。", 409);
        }
        // The server accepts new AI summaries only as draft/proposed. A log
        // already confirmed by the user is therefore replayed as a proposal
        // and then advanced through the explicit confirmation transition.
        const initialLog = log.status === "confirmed"
          ? { ...log, status: "proposed", confirmed_by_user: false }
          : log;
        let remoteLog;
        try {
          const created = await runRemote.createDailyLog(initialLog, version);
          assertActive();
          version = versionFrom(created, version);
          remoteLog = payloadFrom(created, "daily_log") || log;
        } catch (error) {
          if (error?.code !== "daily_log_id_conflict") throw error;
          remoteLog = await findRemote({ get: runRemote.getDailyLog, list: runRemote.listDailyLogs, field: "daily_log", listField: "daily_logs", id: log.id, originalError: error });
        }
        if (!sameDailyLogContent(remoteLog, log) && (!baseline || !sameDailyLogRecord(remoteLog, baseline))) {
          throw localError("sync_conflict", "远端存在同一标识但内容不同的成长日志，未覆盖任一端数据。", 409);
        }
        if (!sameDailyLogContent(remoteLog, log)) {
          if (remoteLog.status === "confirmed") throw localError("sync_conflict", "远端成长日志已确认，不能被本地草稿覆盖。", 409);
          const patch = {
            completed: log.completed, problems: log.problems, learned: log.learned,
            tomorrow_plan: log.tomorrow_plan, ai_summary: log.ai_summary,
            status: log.status === "confirmed" ? "proposed" : log.status,
          };
          const updated = await runRemote.updateDailyLog(log.id, patch, version);
          assertActive();
          version = versionFrom(updated, version);
          remoteLog = payloadFrom(updated, "daily_log") || { ...remoteLog, ...patch, confirmed_by_user: false };
        }
        if (log.status === "confirmed" && (remoteLog.status !== "confirmed" || !remoteLog.confirmed_by_user)) {
          const confirmed = await runRemote.confirmDailyLog(log.id, version);
          assertActive();
          version = versionFrom(confirmed, version);
        } else if (log.status !== "confirmed" && remoteLog.status !== log.status) {
          throw localError("sync_conflict", "远端成长日志状态已变化，需要先由用户决定如何处理。", 409);
        }
        markBaseline("daily_logs", log);
      }
      for (const evidence of syncableEvidence) {
        let remoteEvidence;
        try {
          const created = await runRemote.createLearningEvidence(evidence, version);
          assertActive();
          version = versionFrom(created, version);
          remoteEvidence = payloadFrom(created, "learning_evidence") || evidence;
        } catch (error) {
          if (error?.code !== "learning_evidence_id_conflict" && error?.code !== "learning_evidence_source_conflict") throw error;
          remoteEvidence = await findRemote({ get: runRemote.getLearningEvidence, list: runRemote.listLearningEvidence, field: "learning_evidence", listField: "learning_evidence", id: evidence.id, originalError: error });
        }
        const baseline = baselineFor(runState, "learning_evidence", evidence.id);
        if (!sameEvidenceRecord(remoteEvidence, evidence) && baseline && !sameEvidenceRecord(remoteEvidence, baseline)) {
          throw localError("sync_conflict", "远端存在同一标识但内容不同的学习证据，未覆盖任一端数据。", 409);
        }
        if (!sameEvidenceRecord(remoteEvidence, evidence)) {
          throw localError("sync_conflict", "远端存在同一标识但内容不同的学习证据，未覆盖任一端数据。", 409);
        }
        markBaseline("learning_evidence", evidence);
      }
      assertActive();
      refreshState();
      if (!active()) return syncCancelled(runScope);
      for (const { collection, record } of completedBaselines) {
        const current = state[collection].find(item => item.id === record.id);
        if (current && sameByCollection[collection](current, record)) setBaseline(state, collection, record);
      }
      for (const tombstone of completedTombstones) {
        clearTombstone(tombstone.collection, tombstone.id);
        clearBaseline(state, tombstone.collection, tombstone.id);
      }
      state.remote_version = version;
      save();
      syncStatus = "synced";
      return { ...snapshot(), synced: true };
    } catch (error) {
      if (error?.code === "sync_cancelled") return syncCancelled(runScope);
      if (!active()) return syncCancelled(runScope);
      syncStatus = error?.status === 409 || error?.status === 428 ? "conflict" : "failed";
      lastError = error?.code || "sync_failed";
      return { ...snapshot(), synced: false };
    }
  }

  return {
    getState: () => { refreshState(); return clone({ ...state, ...snapshot() }); },
    scope: () => accountScope,
    setScope,
    listMemories: () => { refreshState(); return clone(state.memories); },
    createMemory: input => createIn("memories", normalizeMemory(input, now), "memory"),
    confirmMemory(id) {
      refreshState();
      const item = state.memories.find(candidate => candidate.id === id);
      if (!item) throw localError("memory_not_found", "这条记忆不存在。", 404);
      if (item.status === "confirmed" && item.confirmed_by_user) return result({ memory: clone(item) }, false);
      if (item.status === "archived") throw localError("memory_archived", "已归档的记忆不能直接确认。", 409);
      item.status = "confirmed"; item.confirmed_by_user = true; item.updated_at = nowIso(now); save();
      return result({ memory: clone(item) });
    },
    archiveMemory(id) {
      refreshState();
      const item = state.memories.find(candidate => candidate.id === id);
      if (!item) throw localError("memory_not_found", "这条记忆不存在。", 404);
      if (item.status === "archived") return result({ memory: clone(item) }, false);
      item.status = "archived"; item.confirmed_by_user = false; item.archived_at = nowIso(now); item.updated_at = item.archived_at; save();
      return result({ memory: clone(item) });
    },
    deleteMemory: id => deleteIn("memories", id, "memory"),
    listDailyLogs: () => { refreshState(); return clone(state.daily_logs); },
    createDailyLog: input => createIn("daily_logs", normalizeLog(input, now), "daily_log"),
    updateDailyLog(id, patch) {
      refreshState();
      const item = state.daily_logs.find(candidate => candidate.id === id);
      if (!item) throw localError("daily_log_not_found", "这份成长日志不存在。", 404);
      if (item.status === "confirmed") throw localError("daily_log_confirmed", "已确认的成长日志不能直接修改。", 409);
      const next = normalizeLog({ ...item, ...patch, id: item.id, status: patch.status || item.status }, now);
      Object.assign(item, next, { updated_at: nowIso(now) }); save(); return result({ daily_log: clone(item) });
    },
    confirmDailyLog(id) {
      refreshState();
      const item = state.daily_logs.find(candidate => candidate.id === id);
      if (!item) throw localError("daily_log_not_found", "这份成长日志不存在。", 404);
      if (item.status === "confirmed" && item.confirmed_by_user) return result({ daily_log: clone(item) }, false);
      item.status = "confirmed"; item.confirmed_by_user = true; item.updated_at = nowIso(now); save();
      return result({ daily_log: clone(item) });
    },
    deleteDailyLog: id => deleteIn("daily_logs", id, "daily_log"),
    listLearningEvidence: () => { refreshState(); return clone(state.learning_evidence); },
    createLearningEvidence: input => createIn("learning_evidence", normalizeEvidence(input, now), "learning_evidence"),
    deleteLearningEvidence: id => deleteIn("learning_evidence", id, "learning_evidence"),
    buildContext(input = {}) {
      refreshState();
      const currentDate = input.current_date || now().toISOString().slice(0, 10);
      const dailyLog = input.daily_log ?? state.daily_logs.find(log => log.date === currentDate) ?? null;
      return buildAiContext({
        current_user: input.current_user,
        current_conversation: input.current_conversation,
        current_task: input.current_task,
        current_date: currentDate,
        today_state: input.today_state,
        daily_log: dailyLog,
        memories: state.memories,
        learning_evidence: [...state.learning_evidence, ...asArray(input.learning_evidence)],
        max_chars: input.max_chars,
      });
    },
    sync,
  };
}
