import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FileStore } from "./lib/file-store.mjs";
import { ApiError, applyCors, error, json, readJson, requestId, userIdFrom } from "./lib/http.mjs";
import { appendMessage, listMessages, normalizeConversationId, normalizeMessageInput } from "./services/conversation-service.mjs";
import { buildHomeResponse, mergeHomeSnapshot, normalizeHomeSnapshot } from "./services/home-service.mjs";
import { applyProfilePatch, normalizeProfilePatch, profileResponse } from "./services/profile-service.mjs";
import { addManualEvent, buildScheduleResponse, confirmSuggestion, normalizeDateKey, normalizeEventId, normalizeManualEventInput, normalizeSuggestionId, reviseManualEvent } from "./services/schedule-service.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const defaultDataDirectory = resolve(appRoot, "data", "api");

export function createApiServer({ dataDirectory = process.env.XUECHENG_DATA_DIR || defaultDataDirectory, allowedOrigin = process.env.XUECHENG_WEB_ORIGIN || "http://localhost:4173", now = () => new Date() } = {}) {
  const store = new FileStore(dataDirectory);
  return createServer(async (request, response) => {
    const id = requestId();
    applyCors(request, response, allowedOrigin);
    try {
      const url = new URL(request.url || "/", "http://localhost");
      if (request.method === "OPTIONS") {
        response.writeHead(204, { "x-request-id": id });
        response.end();
        return;
      }
      if (request.method === "GET" && url.pathname === "/health") {
        return json(response, 200, { status: "ok", service: "xuecheng-api", version: "v1" }, id);
      }
      if (url.pathname === "/api/v1/home") {
        const userId = userIdFrom(request);
        if (request.method === "GET") {
          const snapshot = await store.get(userId);
          if (!snapshot?.preferences || !snapshot?.agent_state) throw new ApiError(404, "home_not_initialized", "还没有同步首页数据。请先从设备提交一次首页快照。");
          return json(response, 200, { data: buildHomeResponse(snapshot, now()) }, id);
        }
        if (request.method === "PUT") {
          const snapshot = normalizeHomeSnapshot(await readJson(request));
          const record = await store.update(userId, current => mergeHomeSnapshot(current, snapshot));
          return json(response, 200, { data: buildHomeResponse(record, now()) }, id);
        }
      }
      if (url.pathname === "/api/v1/profile") {
        const userId = userIdFrom(request);
        if (request.method === "GET") {
          return json(response, 200, { data: profileResponse(await store.get(userId)) }, id);
        }
        if (request.method === "PATCH") {
          const patch = normalizeProfilePatch(await readJson(request));
          const record = await store.update(userId, current => applyProfilePatch(current, patch));
          return json(response, 200, { data: profileResponse(record) }, id);
        }
      }
      if (url.pathname === "/api/v1/schedule") {
        const userId = userIdFrom(request);
        if (request.method !== "GET") throw new ApiError(405, "method_not_allowed", "该接口只支持 GET。 ");
        const record = await store.get(userId);
        if (!record?.preferences || !record?.agent_state) throw new ApiError(404, "schedule_not_initialized", "还没有同步日程所需的数据。请先从设备提交一次首页快照。");
        const date = normalizeDateKey(url.searchParams.get("date") || "", now());
        return json(response, 200, { data: buildScheduleResponse(record, date, now()) }, id);
      }
      if (url.pathname === "/api/v1/schedule/events" && request.method === "POST") {
        const userId = userIdFrom(request);
        const input = normalizeManualEventInput(await readJson(request));
        let event;
        await store.update(userId, record => {
          if (!record?.preferences || !record?.agent_state) throw new ApiError(404, "schedule_not_initialized", "还没有同步日程所需的数据。请先从设备提交一次首页快照。");
          ({ record, event } = addManualEvent(record, input, now()));
          return record;
        });
        return json(response, 201, { data: { event } }, id);
      }
      const eventMatch = url.pathname.match(/^\/api\/v1\/schedule\/events\/([^/]+)$/);
      if (eventMatch && request.method === "PUT") {
        const userId = userIdFrom(request);
        const eventId = normalizeEventId(eventMatch[1]);
        const input = normalizeManualEventInput(await readJson(request), { partial: true });
        let event;
        await store.update(userId, record => {
          if (!record?.preferences || !record?.agent_state) throw new ApiError(404, "schedule_not_initialized", "还没有同步日程所需的数据。请先从设备提交一次首页快照。");
          ({ record, event } = reviseManualEvent(record, eventId, input, now()));
          return record;
        });
        return json(response, 200, { data: { event } }, id);
      }
      const suggestionMatch = url.pathname.match(/^\/api\/v1\/schedule\/suggestions\/([^/]+)\/confirm$/);
      if (suggestionMatch && request.method === "POST") {
        const userId = userIdFrom(request);
        const suggestionId = normalizeSuggestionId(suggestionMatch[1]);
        const input = await readJson(request);
        let outcome;
        await store.update(userId, record => {
          if (!record?.preferences || !record?.agent_state) throw new ApiError(404, "schedule_not_initialized", "还没有同步日程所需的数据。请先从设备提交一次首页快照。");
          outcome = confirmSuggestion(record, suggestionId, input, now());
          return outcome.record;
        });
        return json(response, outcome.created ? 201 : 200, { data: outcome.response }, id);
      }
      const conversationMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)\/messages$/);
      if (conversationMatch) {
        const userId = userIdFrom(request);
        const conversationId = normalizeConversationId(conversationMatch[1]);
        if (request.method === "GET") {
          const limit = url.searchParams.get("limit");
          const before = url.searchParams.get("before");
          const record = await store.get(userId);
          return json(response, 200, { data: listMessages(record, conversationId, { limit, before }) }, id);
        }
        if (request.method === "POST") {
          const input = normalizeMessageInput(await readJson(request));
          let outcome;
          await store.update(userId, record => {
            outcome = appendMessage(record, conversationId, input, now());
            return outcome.record;
          });
          return json(response, outcome.created ? 201 : 200, { data: outcome.response }, id);
        }
      }
      throw new ApiError(404, "not_found", "未找到该接口。");
    } catch (cause) {
      return error(response, cause, id);
    }
  });
}

const invokedDirectly = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  const port = Number.parseInt(process.env.PORT || "8787", 10);
  const server = createApiServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`学程 API 已启动：http://localhost:${port}`);
  });
}
