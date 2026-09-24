import { ApiError } from "../lib/http.mjs";

const ROLES = new Set(["guide", "friend", "family", "partner"]);
const GENDERS = new Set(["female", "male", "neutral"]);
const THEMES = new Set(["day", "night"]);
const allowed = new Set(["name", "role", "gender", "initiative", "directness", "theme", "cloud_consent", "quiet_start", "quiet_end", "urgent_override"]);
const forbidden = new Set(["apiKey", "api_key", "modelConfig", "model_config", "messages", "sources", "attachments", "avatar", "avatar_data"]);

const isObject = value => value && typeof value === "object" && !Array.isArray(value);
const optionalText = (value, maximum, field) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new ApiError(422, "invalid_profile", `${field} 格式不正确。`);
  }
  return value.trim();
};
const ratio = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new ApiError(422, "invalid_profile", `${field} 必须在 0 到 1 之间。`);
  }
  return number;
};
const timeOfDay = (value, field) => {
  const time = optionalText(value, 5, field);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new ApiError(422, "invalid_profile", `${field} 必须是 HH:mm。`);
  }
  return time;
};

const defaults = Object.freeze({
  name: "小程",
  role: "guide",
  gender: "female",
  initiative: .65,
  directness: .55,
  theme: "day",
  cloud_consent: false,
  quiet_start: "23:00",
  quiet_end: "07:30",
  urgent_override: true,
});

export function profileResponse(record) {
  const preferences = isObject(record?.preferences) ? record.preferences : {};
  const value = { ...defaults, ...preferences };
  return {
    companion: {
      name: value.name,
      avatar: typeof value.avatar === "string" && !value.avatar.startsWith("data:") ? value.avatar : null,
      role: value.role,
      gender: value.gender,
      initiative: value.initiative,
      directness: value.directness,
    },
    appearance: { theme: value.theme },
    privacy: { cloud_consent: Boolean(value.cloud_consent) },
    notifications: {
      quiet_start: value.quiet_start,
      quiet_end: value.quiet_end,
      urgent_override: value.urgent_override !== false,
    },
  };
}

export function normalizeProfilePatch(payload) {
  if (!isObject(payload)) throw new ApiError(422, "invalid_profile", "个人设置必须是对象。 ");
  const keys = Object.keys(payload);
  if (!keys.length) throw new ApiError(422, "invalid_profile", "至少提供一项要调整的设置。 ");
  if (keys.some(key => forbidden.has(key))) {
    throw new ApiError(422, "local_only_setting", "模型密钥、聊天、附件和原始头像只能保留在设备端。 ");
  }
  if (keys.some(key => !allowed.has(key))) {
    throw new ApiError(422, "invalid_profile", "包含当前模块不支持的设置字段。 ");
  }
  const update = {};
  if (Object.hasOwn(payload, "name")) update.name = optionalText(payload.name, 24, "name");
  if (Object.hasOwn(payload, "role")) {
    update.role = optionalText(payload.role, 32, "role");
    if (!ROLES.has(update.role)) throw new ApiError(422, "invalid_profile", "role 无效。 ");
  }
  if (Object.hasOwn(payload, "gender")) {
    update.gender = optionalText(payload.gender, 32, "gender");
    if (!GENDERS.has(update.gender)) throw new ApiError(422, "invalid_profile", "gender 无效。 ");
  }
  if (Object.hasOwn(payload, "initiative")) update.initiative = ratio(payload.initiative, "initiative");
  if (Object.hasOwn(payload, "directness")) update.directness = ratio(payload.directness, "directness");
  if (Object.hasOwn(payload, "theme")) {
    update.theme = optionalText(payload.theme, 16, "theme");
    if (!THEMES.has(update.theme)) throw new ApiError(422, "invalid_profile", "theme 无效。 ");
  }
  if (Object.hasOwn(payload, "cloud_consent")) {
    if (typeof payload.cloud_consent !== "boolean") throw new ApiError(422, "invalid_profile", "cloud_consent 必须是布尔值。 ");
    update.cloud_consent = payload.cloud_consent;
  }
  if (Object.hasOwn(payload, "quiet_start")) update.quiet_start = timeOfDay(payload.quiet_start, "quiet_start");
  if (Object.hasOwn(payload, "quiet_end")) update.quiet_end = timeOfDay(payload.quiet_end, "quiet_end");
  if (Object.hasOwn(payload, "urgent_override")) {
    if (typeof payload.urgent_override !== "boolean") throw new ApiError(422, "invalid_profile", "urgent_override 必须是布尔值。 ");
    update.urgent_override = payload.urgent_override;
  }
  return update;
}

export function applyProfilePatch(record, patch) {
  return {
    ...(record || {}),
    version: record?.version || 1,
    preferences: { ...(isObject(record?.preferences) ? record.preferences : {}), ...patch },
    conversations: Array.isArray(record?.conversations) ? record.conversations : [],
  };
}
