const asArray = value => Array.isArray(value) ? value : [];

const messageKey = message => JSON.stringify([
  message?.role || "",
  message?.text || "",
  asArray(message?.attachments).map(item => [item?.name || "", item?.type || ""]),
]);

export function normalizeConversation(messages) {
  return asArray(messages)
    .filter(message => message && typeof message.text === "string")
    .map(message => ({ ...message, createdAt: typeof message.createdAt === "string" ? message.createdAt : null }));
}

export function mergeStoredConversation(legacyMessages, currentMessages) {
  const legacy = normalizeConversation(legacyMessages);
  const current = normalizeConversation(currentMessages);
  if (!legacy.length) return current;
  if (!current.length) return legacy;

  const largestPossibleOverlap = Math.min(legacy.length, current.length);
  let overlap = 0;
  for (let size = largestPossibleOverlap; size > 0; size -= 1) {
    const legacyTail = legacy.slice(-size).map(messageKey);
    const currentHead = current.slice(0, size).map(messageKey);
    if (legacyTail.every((key, index) => key === currentHead[index])) {
      overlap = size;
      break;
    }
  }
  return [...legacy, ...current.slice(overlap)];
}

export function formatConversationTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "此前";
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

const localDateKey = value => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

export function conversationDayLabel(value, now = new Date()) {
  const key = localDateKey(value);
  if (!key) return "较早的对话";
  const todayKey = localDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === todayKey) return "今天";
  if (key === localDateKey(yesterday)) return "昨天";
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date(value));
}
