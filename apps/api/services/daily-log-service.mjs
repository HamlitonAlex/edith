import { ApiError } from "../lib/http.mjs";

const LOG_STATUSES = new Set(["draft", "proposed", "confirmed"]);
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,127}$/;
const isObject = value => value && typeof value === "object" && !Array.isArray(value);

function text(value, maximum, field, { required = false } = {}) {
  if (value == null && !required) return "";
  if (typeof value !== "string" || (required && !value.trim()) || value.trim().length > maximum) {
    throw new ApiError(422, "invalid_daily_log", `${field} 格式不正确。`);
  }
  return value.trim();
}

function list(value, field) {
  if (value == null) return [];
  const values = Array.isArray(value) ? value : [value];
  if (values.length > 50 || values.some(item => typeof item !== "string" || !item.trim() || item.trim().length > 240)) {
    throw new ApiError(422, "invalid_daily_log", `${field} 必须是最多 50 条短文本。`);
  }
  return values.map(item => item.trim());
}

export function normalizeLogId(value, field = "daily_log_id") {
  const id = decodeURIComponent(String(value || ""));
  if (!ID_PATTERN.test(id)) throw new ApiError(422, "invalid_daily_log_identifier", `${field} 格式不正确。`);
  return id;
}

export function normalizeLogDate(value, now = new Date()) {
  const supplied = String(value || "").trim();
  const date = supplied || now.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
    throw new ApiError(422, "invalid_daily_log_date", "date 必须是 YYYY-MM-DD。 ");
  }
  return date;
}

export function normalizeDailyLogInput(payload, { partial = false, now = new Date() } = {}) {
  if (!isObject(payload)) throw new ApiError(422, "invalid_daily_log", "成长日志必须是对象。 ");
  const fields = ["date", "completed", "problems", "learned", "tomorrow_plan", "ai_summary", "status"];
  if (partial && !fields.some(field => Object.hasOwn(payload, field))) {
    throw new ApiError(422, "invalid_daily_log", "至少提供一项要调整的日志内容。 ");
  }
  const status = String(payload.status || (partial ? "" : "draft")).trim();
  if (status && !LOG_STATUSES.has(status)) throw new ApiError(422, "invalid_daily_log", "status 无效。 ");
  const confirmedByUser = payload.confirmed_by_user === true;
  if (status === "confirmed") {
    throw new ApiError(422, "daily_log_confirmation_required", "AI 总结必须经过用户明确确认。 ");
  }
  if (confirmedByUser) throw new ApiError(422, "daily_log_confirmation_required", "确认请使用独立的 confirm 接口。 ");
  if (!partial && payload.id == null) throw new ApiError(422, "daily_log_id_required", "创建成长日志需要稳定的客户端标识。 ");
  const result = {
    ...(Object.hasOwn(payload, "date") || !partial ? { date: normalizeLogDate(payload.date, now) } : {}),
    ...(Object.hasOwn(payload, "completed") || !partial ? { completed: list(payload.completed, "completed") } : {}),
    ...(Object.hasOwn(payload, "problems") || !partial ? { problems: list(payload.problems, "problems") } : {}),
    ...(Object.hasOwn(payload, "learned") || !partial ? { learned: list(payload.learned, "learned") } : {}),
    ...(Object.hasOwn(payload, "tomorrow_plan") || !partial ? { tomorrow_plan: text(payload.tomorrow_plan, 2000, "tomorrow_plan") } : {}),
    ...(Object.hasOwn(payload, "ai_summary") || !partial ? { ai_summary: text(payload.ai_summary, 4000, "ai_summary") } : {}),
    ...(status ? { status } : {}),
  };
  if (payload.id != null) result.id = normalizeLogId(payload.id);
  if (!partial && !result.status) result.status = "draft";
  return result;
}

export function normalizeLogFilters(searchParams, now = new Date()) {
  const date = searchParams.get("date");
  const status = String(searchParams.get("status") || "").trim();
  if (status && !LOG_STATUSES.has(status)) throw new ApiError(422, "invalid_daily_log_filter", "status 无效。 ");
  const limit = Number(searchParams.get("limit") || 31);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(422, "invalid_page", "limit 必须是 1 到 100 的整数。 ");
  return { date: date ? normalizeLogDate(date, now) : null, status: status || null, limit };
}

function parseList(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function dailyLogResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    date: row.date,
    completed: parseList(row.completed),
    problems: parseList(row.problems),
    learned: parseList(row.learned),
    tomorrow_plan: row.tomorrow_plan || "",
    ai_summary: row.ai_summary || "",
    status: row.status,
    confirmed_by_user: Boolean(row.confirmed_by_user),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export { LOG_STATUSES };
