import { buildAiContext } from "../../web/agent/context-builder.js";
import { ApiError } from "../lib/http.mjs";
import { normalizeConversationId } from "./conversation-service.mjs";
import { normalizeLogDate } from "./daily-log-service.mjs";

const isObject = value => value && typeof value === "object" && !Array.isArray(value);

function text(value, maximum, field, { required = false } = {}) {
  if (value == null && !required) return "";
  if (typeof value !== "string" || (required && !value.trim()) || value.trim().length > maximum) {
    throw new ApiError(422, "invalid_context", `${field} 格式不正确。`);
  }
  return value.trim();
}

function boundedInteger(value, field, fallback, min, max) {
  if (value == null) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new ApiError(422, "invalid_context", `${field} 必须是 ${min} 到 ${max} 的整数。`);
  return number;
}

export function normalizeContextRequest(payload, now = new Date()) {
  if (!isObject(payload)) throw new ApiError(422, "invalid_context", "Context 请求必须是对象。 ");
  const conversationId = payload.conversation_id == null ? "main" : normalizeConversationId(payload.conversation_id);
  const currentInput = text(payload.current_input, 4000, "current_input");
  const currentDate = normalizeLogDate(payload.current_date, now);
  const maxChars = boundedInteger(payload.max_chars, "max_chars", 12000, 1200, 30000);
  const memoryLimit = boundedInteger(payload.memory_limit, "memory_limit", 100, 1, 100);
  const evidenceLimit = boundedInteger(payload.evidence_limit, "evidence_limit", 100, 1, 100);
  const currentTask = isObject(payload.current_task) ? payload.current_task : null;
  const todayState = isObject(payload.today_state) ? payload.today_state : null;
  return { conversationId, currentInput, currentDate, maxChars, memoryLimit, evidenceLimit, currentTask, todayState };
}

export function buildContextPreview({ source, request, now = Date.now() }) {
  const data = source || {};
  return buildAiContext({
    current_user: data.profile,
    current_conversation: { messages: data.recent_conversation, current_input: request.currentInput },
    current_task: request.currentTask || data.current_task,
    current_date: request.currentDate,
    today_state: request.todayState || data.today_state,
    memories: data.memories,
    proposed_memories: data.proposed_memories,
    learning_evidence: data.learning_evidence,
    max_chars: request.maxChars,
    now,
  });
}
