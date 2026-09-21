const MAX_BODY_BYTES = 200 * 1024;

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function requestId() {
  return crypto.randomUUID();
}

export function json(response, status, payload, requestId) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-request-id": requestId,
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

export function error(response, error, requestId) {
  const known = error instanceof ApiError;
  return json(response, known ? error.status : 500, {
    error: {
      code: known ? error.code : "internal_error",
      message: known ? error.message : "服务暂时不可用，请稍后重试。",
    },
  }, requestId);
}

export async function readJson(request) {
  const contentType = String(request.headers["content-type"] || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "请求需要 application/json 内容。");
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new ApiError(413, "payload_too_large", "请求内容超过当前模块允许的大小。");
    }
    chunks.push(chunk);
  }
  if (!size) throw new ApiError(400, "invalid_json", "请求内容不能为空。");
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ApiError(400, "invalid_json", "请求内容必须是 JSON 对象。");
    }
    return value;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw new ApiError(400, "invalid_json", "请求内容不是有效 JSON。");
  }
}

export function userIdFrom(request) {
  const id = String(request.headers["x-xuecheng-user-id"] || "").trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/.test(id)) {
    throw new ApiError(401, "identity_required", "需要有效的 X-Xuecheng-User-Id 才能访问个人数据。");
  }
  return id;
}

export function applyCors(request, response, allowedOrigin) {
  const origin = String(request.headers.origin || "");
  if (origin && origin === allowedOrigin) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "Origin");
    response.setHeader("access-control-allow-headers", "content-type, x-xuecheng-user-id");
    response.setHeader("access-control-allow-methods", "GET, PUT, OPTIONS");
  }
}
