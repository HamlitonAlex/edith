import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { OidcAuthenticator } from "./lib/oidc-auth.mjs";
import { SqliteStore } from "./lib/sqlite-store.mjs";
import { ApiError, applyCors, error, expectedVersionFrom, json, noIdentityOverride, readJson, requestId } from "./lib/http.mjs";
import { normalizeConversationId, normalizeMessageInput } from "./services/conversation-service.mjs";
import { buildHomeResponse, buildHomeSyncSnapshot, mergeHomeSnapshot, normalizeHomeSnapshot } from "./services/home-service.mjs";
import { applyProfilePatch, normalizeProfilePatch, profileResponse } from "./services/profile-service.mjs";
import { addManualEvent, buildScheduleResponse, confirmSuggestion, normalizeDateKey, normalizeEventId, normalizeManualEventInput, normalizeSuggestionId, reviseManualEvent } from "./services/schedule-service.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const defaultDataDirectory = resolve(appRoot, "data", "api");
const defaultDatabasePath = resolve(defaultDataDirectory, "xuecheng.sqlite");
const apiVersion = "v1";

function responsePayload(data, meta) {
  return { data, meta: { api_version: apiVersion, ...meta } };
}

function responseHeaders(meta) {
  return { etag: `W/"${meta.data_version}"` };
}

function initialized(record, module) {
  if (!record?.preferences || !record?.agent_state || !Object.keys(record.agent_state).length) {
    throw new ApiError(404, `${module}_not_initialized`, `还没有同步${module === "home" ? "首页" : "日程"}所需的数据。请先由用户明确触发一次首页同步。`);
  }
}

const syncPolicy = Object.freeze({
  sync_mode: "explicit_only",
  allowed: ["home_snapshot", "profile_settings", "calendar_events", "conversation_text_messages"],
  never_automatic: ["model_api_keys", "raw_audio", "attachments", "avatar_binary", "source_materials", "diagnostic_logs"],
  local_migration: "requires_user_confirmation",
});

export function createApiServer({
  dataDirectory = process.env.XUECHENG_DATA_DIR || defaultDataDirectory,
  databasePath = process.env.XUECHENG_DATABASE_PATH || join(dataDirectory, "xuecheng.sqlite"),
  allowedOrigin = process.env.XUECHENG_WEB_ORIGIN || "http://localhost:4173",
  now = () => new Date(),
  authenticator = new OidcAuthenticator({ now }),
} = {}) {
  const store = new SqliteStore({ databasePath: databasePath || defaultDatabasePath, now });
  const server = createServer(async (request, response) => {
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
        return json(response, 200, { status: "ok", service: "xuecheng-api", version: apiVersion, authentication: authenticator.configured ? "configured" : "not_configured" }, id);
      }
      const identityFor = async () => {
        noIdentityOverride(request);
        return authenticator.authenticate(request);
      };
      if (url.pathname === "/api/v1/sync/policy") {
        const identity = await identityFor();
        const meta = store.metadata(identity);
        if (request.method !== "GET") throw new ApiError(405, "method_not_allowed", "该接口只支持 GET。");
        return json(response, 200, responsePayload(syncPolicy, meta), id, responseHeaders(meta));
      }
      if (url.pathname === "/api/v1/home") {
        const identity = await identityFor();
        if (request.method === "GET") {
          const { record, meta } = store.readRecord(identity);
          initialized(record, "home");
          // The UI reads this bounded projection to merge an explicitly selected account.
          // It is not a general export and intentionally excludes local-only sensitive fields.
          return json(response, 200, responsePayload({ ...buildHomeResponse(record, now()), sync_snapshot: buildHomeSyncSnapshot(record) }, meta), id, responseHeaders(meta));
        }
        if (request.method === "PUT") {
          const snapshot = normalizeHomeSnapshot(await readJson(request));
          const outcome = store.mutateRecord(identity, { expectedVersion: expectedVersionFrom(request), operation: "replace", resource: "home_snapshot" }, current => ({ record: mergeHomeSnapshot(current, snapshot) }));
          return json(response, 200, responsePayload(buildHomeResponse(outcome.record, now()), outcome.meta), id, responseHeaders(outcome.meta));
        }
        throw new ApiError(405, "method_not_allowed", "该接口只支持 GET 和 PUT。");
      }
      if (url.pathname === "/api/v1/profile") {
        const identity = await identityFor();
        if (request.method === "GET") {
          const { record, meta } = store.readRecord(identity);
          return json(response, 200, responsePayload(profileResponse(record), meta), id, responseHeaders(meta));
        }
        if (request.method === "PATCH") {
          const patch = normalizeProfilePatch(await readJson(request));
          const outcome = store.mutateRecord(identity, { expectedVersion: expectedVersionFrom(request), operation: "patch", resource: "profile" }, current => ({ record: applyProfilePatch(current, patch) }));
          return json(response, 200, responsePayload(profileResponse(outcome.record), outcome.meta), id, responseHeaders(outcome.meta));
        }
        throw new ApiError(405, "method_not_allowed", "该接口只支持 GET 和 PATCH。");
      }
      if (url.pathname === "/api/v1/schedule") {
        const identity = await identityFor();
        if (request.method !== "GET") throw new ApiError(405, "method_not_allowed", "该接口只支持 GET。 ");
        const { record, meta } = store.readRecord(identity);
        initialized(record, "schedule");
        const date = normalizeDateKey(url.searchParams.get("date") || "", now());
        return json(response, 200, responsePayload(buildScheduleResponse(record, date, now()), meta), id, responseHeaders(meta));
      }
      if (url.pathname === "/api/v1/schedule/events" && request.method === "POST") {
        const identity = await identityFor();
        const input = normalizeManualEventInput(await readJson(request));
        const outcome = store.mutateRecord(identity, { expectedVersion: expectedVersionFrom(request), operation: "create", resource: "schedule_event" }, record => {
          initialized(record, "schedule");
          return addManualEvent(record, input, now());
        });
        return json(response, 201, responsePayload({ event: outcome.result.event }, outcome.meta), id, responseHeaders(outcome.meta));
      }
      const eventMatch = url.pathname.match(/^\/api\/v1\/schedule\/events\/([^/]+)$/);
      if (eventMatch && request.method === "PUT") {
        const identity = await identityFor();
        const eventId = normalizeEventId(eventMatch[1]);
        const input = normalizeManualEventInput(await readJson(request), { partial: true });
        const outcome = store.mutateRecord(identity, { expectedVersion: expectedVersionFrom(request), operation: "update", resource: "schedule_event" }, record => {
          initialized(record, "schedule");
          return reviseManualEvent(record, eventId, input, now());
        });
        return json(response, 200, responsePayload({ event: outcome.result.event }, outcome.meta), id, responseHeaders(outcome.meta));
      }
      const suggestionMatch = url.pathname.match(/^\/api\/v1\/schedule\/suggestions\/([^/]+)\/confirm$/);
      if (suggestionMatch && request.method === "POST") {
        const identity = await identityFor();
        const suggestionId = normalizeSuggestionId(suggestionMatch[1]);
        const input = await readJson(request);
        const outcome = store.confirmSuggestion(identity, {
          expectedVersion: expectedVersionFrom(request),
          suggestionId,
          payload: input,
          confirm: record => {
            initialized(record, "schedule");
            return confirmSuggestion(record, suggestionId, input, now());
          },
        });
        return json(response, outcome.created ? 201 : 200, responsePayload(outcome.response, outcome.meta), id, responseHeaders(outcome.meta));
      }
      const conversationMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)\/messages$/);
      if (conversationMatch) {
        const identity = await identityFor();
        const conversationId = normalizeConversationId(conversationMatch[1]);
        if (request.method === "GET") {
          const limit = url.searchParams.get("limit");
          const before = url.searchParams.get("before");
          const outcome = store.listMessages(identity, conversationId, { limit, before });
          return json(response, 200, responsePayload(outcome.data, outcome.meta), id, responseHeaders(outcome.meta));
        }
        if (request.method === "POST") {
          const input = normalizeMessageInput(await readJson(request));
          const idempotencyKey = String(request.headers["idempotency-key"] || "").trim();
          if (idempotencyKey && idempotencyKey !== input.id) throw new ApiError(422, "idempotency_key_mismatch", "Idempotency-Key 必须与 client_message_id 一致。");
          const outcome = store.appendMessage(identity, conversationId, input);
          return json(response, outcome.response.idempotent_replay ? 200 : 201, responsePayload(outcome.response, outcome.meta), id, responseHeaders(outcome.meta));
        }
        throw new ApiError(405, "method_not_allowed", "该接口只支持 GET 和 POST。");
      }
      throw new ApiError(404, "not_found", "未找到该接口。");
    } catch (cause) {
      return error(response, cause, id);
    }
  });
  server.on("close", () => store.close());
  return server;
}

const invokedDirectly = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  const port = Number.parseInt(process.env.PORT || "8787", 10);
  const server = createApiServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`学程 API 已启动：http://localhost:${port}`);
  });
}
