import { ApiError } from "../lib/http.mjs";

const MEMORY_TYPES = new Set(["long_term", "stage", "recent_event"]);
const MEMORY_STATUSES = new Set(["proposed", "confirmed", "archived"]);
const SOURCE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,39}$/;
const SOURCE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,127}$/;
const SOURCE_LABELS = Object.freeze({
  conversation: "与小程的对话",
  daily_log: "成长日志",
  learning_evidence: "学习证据",
  manual: "你手动添加的内容",
  user: "你确认的内容",
});
const isObject = value => value && typeof value === "object" && !Array.isArray(value);

function text(value, maximum, field, { required = true } = {}) {
  if (value == null && !required) return null;
  if (typeof value !== "string" || (required && !value.trim()) || value.trim().length > maximum) {
    throw new ApiError(422, "invalid_memory", `${field} 格式不正确。`);
  }
  return value.trim();
}

function ratio(value, field, fallback = 0.5) {
  if (value == null && fallback != null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new ApiError(422, "invalid_memory", `${field} 必须是 0 到 1 之间的数值。`);
  }
  return number;
}

function opaqueSourceId(value) {
  const sourceId = text(value, 160, "source_id", { required: false });
  if (sourceId == null || !sourceId) return null;
  if (!SOURCE_ID_PATTERN.test(sourceId)) {
    throw new ApiError(422, "invalid_memory_source", "source_id 必须是来源记录的短标识，不能包含原始聊天内容。 ");
  }
  return sourceId;
}

export function normalizeMemoryId(value, field = "memory_id") {
  const id = decodeURIComponent(String(value || ""));
  if (!ID_PATTERN.test(id)) throw new ApiError(422, "invalid_memory_identifier", `${field} 格式不正确。`);
  return id;
}

export function normalizeMemoryInput(payload) {
  if (!isObject(payload)) throw new ApiError(422, "invalid_memory", "记忆必须是对象。 ");
  if (payload.id == null) throw new ApiError(422, "memory_id_required", "创建记忆需要稳定的客户端标识。 ");
  const id = normalizeMemoryId(payload.id);
  const type = String(payload.type || "recent_event").trim();
  if (!MEMORY_TYPES.has(type)) throw new ApiError(422, "invalid_memory", "记忆类型无效。 ");
  const content = text(payload.content, 4000, "content");
  const sourceType = String(payload.source_type || "manual").trim();
  if (!SOURCE_PATTERN.test(sourceType)) throw new ApiError(422, "invalid_memory", "source_type 格式不正确。 ");
  const sourceId = opaqueSourceId(payload.source_id);
  const topic = text(payload.topic, 160, "topic", { required: false });
  const status = String(payload.status || "proposed").trim();
  const confirmedByUser = payload.confirmed_by_user === true;
  if (!MEMORY_STATUSES.has(status) || status === "archived") {
    throw new ApiError(422, "invalid_memory", "新建记忆只能是 proposed。 ");
  }
  if (status === "confirmed" || confirmedByUser) {
    throw new ApiError(422, "memory_confirmation_required", "新记忆必须先由用户确认流程处理。 ");
  }
  return {
    id,
    type,
    content,
    source_type: sourceType,
    source_id: sourceId,
    topic,
    status,
    confirmed_by_user: confirmedByUser,
    confidence: ratio(payload.confidence, "confidence"),
    importance: ratio(payload.importance, "importance"),
  };
}

export function normalizeMemoryFilters(searchParams) {
  const type = String(searchParams.get("type") || "").trim();
  if (type && !MEMORY_TYPES.has(type)) throw new ApiError(422, "invalid_memory_filter", "type 无效。 ");
  const status = String(searchParams.get("status") || "").trim();
  if (status && !MEMORY_STATUSES.has(status)) throw new ApiError(422, "invalid_memory_filter", "status 无效。 ");
  const sourceType = String(searchParams.get("source_type") || "").trim();
  if (sourceType && !SOURCE_PATTERN.test(sourceType)) throw new ApiError(422, "invalid_memory_filter", "source_type 无效。 ");
  const topic = text(searchParams.get("topic"), 160, "topic", { required: false });
  const limit = Number(searchParams.get("limit") || 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(422, "invalid_page", "limit 必须是 1 到 100 的整数。 ");
  return { type: type || null, status: status || null, source_type: sourceType || null, topic, limit };
}

export function memoryResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    source_type: row.source_type,
    source_id: row.source_id || null,
    topic: row.topic || null,
    status: row.status,
    confirmed_by_user: Boolean(row.confirmed_by_user),
    confidence: Number(row.confidence),
    importance: Number(row.importance),
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at || null,
  };
}

export function memorySourceResponse(row) {
  if (!row) return null;
  return {
    type: row.source_type,
    id: row.source_id || null,
    label: SOURCE_LABELS[row.source_type] || "已保存的来源",
    created_at: row.created_at,
  };
}

export { MEMORY_TYPES, MEMORY_STATUSES };
