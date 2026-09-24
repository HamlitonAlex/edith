import { ApiError } from "../lib/http.mjs";

const isObject = value => value && typeof value === "object" && !Array.isArray(value);
const safeId = (value, field) => {
  const id = decodeURIComponent(String(value || ""));
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,79}$/.test(id)) {
    throw new ApiError(422, "invalid_schedule_identifier", `${field} 格式不正确。`);
  }
  return id;
};
const text = (value, maximum, field) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new ApiError(422, "invalid_schedule", `${field} 格式不正确。`);
  }
  return value.trim();
};
const positiveInteger = (value, field, fallback) => {
  if (value == null && fallback != null) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 720) {
    throw new ApiError(422, "invalid_schedule", `${field} 必须是 1 到 720 的整数。`);
  }
  return number;
};

export const normalizeEventId = value => safeId(value, "日程标识");
export const normalizeSuggestionId = value => safeId(value, "建议标识");

export function normalizeDateKey(value, now = new Date()) {
  const supplied = String(value || "").trim();
  if (!supplied) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(supplied) || Number.isNaN(Date.parse(`${supplied}T12:00:00`))) {
    throw new ApiError(422, "invalid_schedule_date", "date 必须是 YYYY-MM-DD。 ");
  }
  return supplied;
}

function normalizeStart(value, field = "start") {
  const start = text(value, 64, field);
  const compact = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/.exec(start);
  if (compact) {
    const normalized = `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6] || "00"}`;
    if (!Number.isNaN(Date.parse(normalized))) return { value: start, date: `${compact[1]}-${compact[2]}-${compact[3]}` };
  }
  const iso = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})?$/.exec(start);
  if (iso && !Number.isNaN(Date.parse(start))) return { value: start, date: iso[1] };
  throw new ApiError(422, "invalid_schedule", `${field} 必须是有效的 ISO-8601 或 iCalendar 时间。`);
}

function eventDate(event) {
  try { return normalizeStart(event.start).date; }
  catch { return ""; }
}

function eventResponse(event) {
  return {
    id: event.id,
    summary: event.summary,
    start: event.start,
    duration_minutes: event.duration_minutes || null,
    source: event.source || "manual",
    source_action_id: event.sourceActionId || null,
    status: event.status || "confirmed",
    updated_at: event.updated_at || null,
  };
}

function eventsFrom(record) {
  return Array.isArray(record?.preferences?.calendar_events) ? record.preferences.calendar_events : [];
}

export function normalizeManualEventInput(payload, { partial = false } = {}) {
  if (!isObject(payload)) throw new ApiError(422, "invalid_schedule", "日程必须是对象。 ");
  const fields = ["summary", "start", "duration_minutes"];
  if (partial && !fields.some(field => Object.hasOwn(payload, field))) {
    throw new ApiError(422, "invalid_schedule", "至少提供一个可调整的日程字段。 ");
  }
  return {
    ...(Object.hasOwn(payload, "summary") ? { summary: text(payload.summary, 140, "summary") } : {}),
    ...(Object.hasOwn(payload, "start") ? { start: normalizeStart(payload.start).value } : {}),
    ...(Object.hasOwn(payload, "duration_minutes") ? { duration_minutes: positiveInteger(payload.duration_minutes, "duration_minutes") } : {}),
    ...(partial ? {} : {
      summary: text(payload.summary, 140, "summary"),
      start: normalizeStart(payload.start).value,
      duration_minutes: positiveInteger(payload.duration_minutes, "duration_minutes"),
    }),
  };
}

export function buildScheduleResponse(record, date, now = new Date()) {
  const events = eventsFrom(record)
    .filter(event => eventDate(event) === date)
    .sort((left, right) => String(left.start).localeCompare(String(right.start)))
    .map(eventResponse);
  const action = record.agent_state.next_recommended_action;
  const today = normalizeDateKey("", now);
  const alreadyConfirmed = Boolean(action?.id) && eventsFrom(record).some(event => event.sourceActionId === action.id);
  const pendingSuggestion = date === today && action && !alreadyConfirmed ? {
    id: action.id,
    title: action.title,
    why_now: action.why_now,
    duration_minutes: action.duration_minutes,
    platform: action.platform || null,
    skill_id: action.skill_id || null,
    status: "pending_confirmation",
  } : null;
  return { date, events, pending_suggestion: pendingSuggestion };
}

export function addManualEvent(record, input, now = new Date()) {
  const event = {
    id: `event_${crypto.randomUUID()}`,
    ...input,
    source: "manual",
    status: "confirmed",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  return {
    record: { ...record, preferences: { ...record.preferences, calendar_events: [...eventsFrom(record), event], calendar_events_authority: "server" } },
    event: eventResponse(event),
  };
}

export function reviseManualEvent(record, eventId, input, now = new Date()) {
  const events = eventsFrom(record);
  const index = events.findIndex(event => event.id === eventId);
  if (index === -1) throw new ApiError(404, "schedule_event_not_found", "要调整的日程不存在。 ");
  if (events[index].source === "confirmed-ai-suggestion") {
    throw new ApiError(409, "suggested_event_requires_reconsideration", "AI 建议生成的日程请先在对话中协商或重新安排。 ");
  }
  const event = { ...events[index], ...input, updated_at: now.toISOString() };
  const nextEvents = [...events];
  nextEvents[index] = event;
  return {
    record: { ...record, preferences: { ...record.preferences, calendar_events: nextEvents, calendar_events_authority: "server" } },
    event: eventResponse(event),
  };
}

export function confirmSuggestion(record, suggestionId, payload, now = new Date()) {
  if (!isObject(payload)) throw new ApiError(422, "invalid_schedule", "确认建议需要日程对象。 ");
  const action = record.agent_state?.next_recommended_action;
  if (!action || action.id !== suggestionId) {
    throw new ApiError(404, "suggestion_not_found", "这条建议已不再是当前可确认的安排。 ");
  }
  const existing = eventsFrom(record).find(event => event.sourceActionId === action.id);
  if (existing) {
    return { created: false, record, response: { event: eventResponse(existing), idempotent_replay: true } };
  }
  const start = normalizeStart(payload.start).value;
  const event = {
    id: `event_${crypto.randomUUID()}`,
    summary: action.title,
    start,
    duration_minutes: positiveInteger(payload.duration_minutes, "duration_minutes", action.duration_minutes),
    source: "confirmed-ai-suggestion",
    sourceActionId: action.id,
    status: "confirmed",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  return {
    created: true,
    record: { ...record, preferences: { ...record.preferences, calendar_events: [...eventsFrom(record), event], calendar_events_authority: "server" } },
    response: { event: eventResponse(event), idempotent_replay: false },
  };
}
