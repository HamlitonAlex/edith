import { ApiError } from "../lib/http.mjs";

const ROLES = new Set(["user", "assistant"]);
const SOURCES = new Set(["typing", "voice_transcript", "local_agent"]);
const MAX_MESSAGES_PER_CONVERSATION = 500;

const isObject = value => value && typeof value === "object" && !Array.isArray(value);
const text = (value, maximum, field) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new ApiError(422, "invalid_message", `${field} 格式不正确。`);
  }
  return value.trim();
};

export function normalizeConversationId(value) {
  const id = decodeURIComponent(String(value || ""));
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,79}$/.test(id)) {
    throw new ApiError(422, "invalid_conversation", "会话标识格式不正确。 ");
  }
  return id;
}

export function normalizeMessageInput(payload) {
  if (!isObject(payload)) throw new ApiError(422, "invalid_message", "消息必须是对象。 ");
  if (Object.hasOwn(payload, "attachments") || Object.hasOwn(payload, "audio") || Object.hasOwn(payload, "audio_url")) {
    throw new ApiError(422, "unsupported_message_content", "当前对话同步不接收附件或录音；设备端只应发送用户确认后的文字。 ");
  }
  const role = text(payload.role, 16, "role");
  const source = text(payload.source || (role === "assistant" ? "local_agent" : "typing"), 32, "source");
  if (!ROLES.has(role) || !SOURCES.has(source)) {
    throw new ApiError(422, "invalid_message", "消息角色或来源无效。 ");
  }
  if (role === "user" && source === "local_agent") {
    throw new ApiError(422, "invalid_message", "用户消息不能标记为本地 Agent 输出。 ");
  }
  const occurredAt = text(payload.occurred_at, 64, "occurred_at");
  if (Number.isNaN(Date.parse(occurredAt))) {
    throw new ApiError(422, "invalid_message", "occurred_at 必须是 ISO-8601 时间。 ");
  }
  return {
    id: text(payload.client_message_id, 100, "client_message_id"),
    role,
    text: text(payload.text, 8000, "text"),
    source,
    occurred_at: occurredAt,
  };
}

function recordsFrom(record) {
  return Array.isArray(record?.conversations) ? record.conversations.filter(isObject) : [];
}

function recordFor(conversations, conversationId, now) {
  const existing = conversations.find(item => item.id === conversationId);
  if (existing) return existing;
  const created = { id: conversationId, created_at: now.toISOString(), updated_at: now.toISOString(), messages: [] };
  conversations.push(created);
  return created;
}

function publicMessage(message) {
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    source: message.source,
    occurred_at: message.occurred_at,
    received_at: message.received_at,
  };
}

export function appendMessage(record, conversationId, input, now = new Date()) {
  const conversations = recordsFrom(record);
  const conversation = recordFor(conversations, conversationId, now);
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  const duplicate = messages.find(message => message.id === input.id);
  if (duplicate) {
    if (duplicate.role !== input.role || duplicate.text !== input.text || duplicate.source !== input.source || duplicate.occurred_at !== input.occurred_at) {
      throw new ApiError(409, "message_id_conflict", "同一消息标识不能对应不同内容。 ");
    }
    return {
      created: false,
      record: { ...(record || {}), conversations },
      response: { message: publicMessage(duplicate), idempotent_replay: true },
    };
  }
  const message = { ...input, received_at: now.toISOString() };
  messages.push(message);
  conversation.messages = messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
  conversation.updated_at = now.toISOString();
  return {
    created: true,
    record: { ...(record || {}), version: record?.version || 1, conversations },
    response: { message: publicMessage(message), idempotent_replay: false },
  };
}

export function listMessages(record, conversationId, { limit: suppliedLimit, before } = {}) {
  const limitNumber = suppliedLimit == null ? 50 : Number(suppliedLimit);
  if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) {
    throw new ApiError(422, "invalid_page", "limit 必须是 1 到 100 的整数。 ");
  }
  const conversation = recordsFrom(record).find(item => item.id === conversationId);
  const allMessages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  let end = allMessages.length;
  if (before != null) {
    const index = allMessages.findIndex(message => message.id === before);
    if (index === -1) throw new ApiError(404, "message_not_found", "分页消息标识不存在。 ");
    end = index;
  }
  const start = Math.max(0, end - limitNumber);
  const messages = allMessages.slice(start, end).map(publicMessage);
  return {
    conversation: {
      id: conversationId,
      created_at: conversation?.created_at || null,
      updated_at: conversation?.updated_at || null,
      message_count: allMessages.length,
    },
    messages,
    next_before: start > 0 ? allMessages[start].id : null,
  };
}
