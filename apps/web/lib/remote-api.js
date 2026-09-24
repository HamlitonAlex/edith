export class RemoteApiError extends Error {
  constructor({ status = 0, code = "network_error", message = "暂时无法连接同步服务。", meta = null } = {}) {
    super(message);
    this.name = "RemoteApiError";
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

function parseVersion(response) {
  const match = /^W\/"(\d+)"$/.exec(String(response.headers.get("etag") || ""));
  return match ? Number(match[1]) : null;
}

export function apiBaseFromWindow(windowRef = window) {
  const configured = String(windowRef.__XUECHENG_API_BASE__ || windowRef.document?.querySelector('meta[name="xuecheng-api-base"]')?.content || "").trim();
  return configured.replace(/\/$/, "");
}

export function createRemoteApi({ baseUrl, auth, fetchImpl = globalThis.fetch } = {}) {
  const normalizedBase = String(baseUrl || "").replace(/\/$/, "");

  async function request(path, { method = "GET", body, version, headers = {} } = {}) {
    const token = auth?.accessToken?.();
    if (!token) throw new RemoteApiError({ status: 401, code: "not_authenticated", message: "请先登录后再同步。" });
    if (!normalizedBase) throw new RemoteApiError({ status: 503, code: "api_not_configured", message: "同步服务地址尚未配置。" });
    let response;
    try {
      response = await fetchImpl(`${normalizedBase}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(version == null ? {} : { "if-match": `W/\"${version}\"` }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new RemoteApiError();
    }
    let payload = {};
    try { payload = await response.json(); } catch { /* response is handled as an error below */ }
    if (!response.ok) {
      auth?.handleRemoteStatus?.(response.status);
      throw new RemoteApiError({ status: response.status, code: payload?.error?.code || "remote_error", message: payload?.error?.message || "同步服务暂时无法处理这次请求。", meta: payload?.meta || null });
    }
    return { data: payload.data, meta: payload.meta || {}, version: parseVersion(response) };
  }

  return {
    getHome: () => request("/api/v1/home"),
    putHome: (snapshot, version) => request("/api/v1/home", { method: "PUT", body: snapshot, version }),
    getProfile: () => request("/api/v1/profile"),
    patchProfile: (patch, version) => request("/api/v1/profile", { method: "PATCH", body: patch, version }),
    getSchedule: date => request(`/api/v1/schedule?date=${encodeURIComponent(date)}`),
    createScheduleEvent: (event, version) => request("/api/v1/schedule/events", { method: "POST", body: event, version }),
    updateScheduleEvent: (id, event, version) => request(`/api/v1/schedule/events/${encodeURIComponent(id)}`, { method: "PUT", body: event, version }),
    confirmScheduleSuggestion: (id, input, version) => request(`/api/v1/schedule/suggestions/${encodeURIComponent(id)}/confirm`, { method: "POST", body: input, version }),
    listMessages: (conversationId, { limit = 50, before = null } = {}) => request(`/api/v1/conversations/${encodeURIComponent(conversationId)}/messages?${new URLSearchParams({ limit: String(limit), ...(before ? { before } : {}) })}`),
    appendMessage: (conversationId, message) => request(`/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body: message, headers: { "idempotency-key": message.client_message_id } }),
    getSyncPolicy: () => request("/api/v1/sync/policy"),
    listMemories: (filters = {}) => request(`/api/v1/memories?${new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, value]) => value != null && value !== "")))}`),
    getMemory: id => request(`/api/v1/memories/${encodeURIComponent(id)}`),
    createMemory: (memory, version) => request("/api/v1/memories", { method: "POST", body: memory, version, headers: { "idempotency-key": memory.id } }),
    confirmMemory: (id, version) => request(`/api/v1/memories/${encodeURIComponent(id)}/confirm`, { method: "POST", version }),
    archiveMemory: (id, version) => request(`/api/v1/memories/${encodeURIComponent(id)}/archive`, { method: "POST", version }),
    deleteMemory: (id, version) => request(`/api/v1/memories/${encodeURIComponent(id)}`, { method: "DELETE", version }),
    listDailyLogs: (filters = {}) => request(`/api/v1/daily-logs?${new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, value]) => value != null && value !== "")))}`),
    getDailyLog: id => request(`/api/v1/daily-logs/${encodeURIComponent(id)}`),
    createDailyLog: (log, version) => request("/api/v1/daily-logs", { method: "POST", body: log, version, headers: { "idempotency-key": log.id } }),
    updateDailyLog: (id, patch, version) => request(`/api/v1/daily-logs/${encodeURIComponent(id)}`, { method: "PATCH", body: patch, version }),
    confirmDailyLog: (id, version) => request(`/api/v1/daily-logs/${encodeURIComponent(id)}/confirm`, { method: "POST", version }),
    deleteDailyLog: (id, version) => request(`/api/v1/daily-logs/${encodeURIComponent(id)}`, { method: "DELETE", version }),
    listLearningEvidence: (filters = {}) => request(`/api/v1/learning-evidence?${new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, value]) => value != null && value !== "")))}`),
    getLearningEvidence: id => request(`/api/v1/learning-evidence/${encodeURIComponent(id)}`),
    createLearningEvidence: (evidence, version) => request("/api/v1/learning-evidence", { method: "POST", body: evidence, version, headers: { "idempotency-key": evidence.id } }),
    deleteLearningEvidence: (id, version) => request(`/api/v1/learning-evidence/${encodeURIComponent(id)}`, { method: "DELETE", version }),
    previewContext: payload => request("/api/v1/context/preview", { method: "POST", body: payload }),
  };
}
