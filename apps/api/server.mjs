import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FileStore } from "./lib/file-store.mjs";
import { ApiError, applyCors, error, json, readJson, requestId, userIdFrom } from "./lib/http.mjs";
import { buildHomeResponse, normalizeHomeSnapshot } from "./services/home-service.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const defaultDataDirectory = resolve(appRoot, "data", "api");

export function createApiServer({ dataDirectory = process.env.XUECHENG_DATA_DIR || defaultDataDirectory, allowedOrigin = process.env.XUECHENG_WEB_ORIGIN || "http://localhost:4173", now = () => new Date() } = {}) {
  const store = new FileStore(dataDirectory);
  return createServer(async (request, response) => {
    const id = requestId();
    applyCors(request, response, allowedOrigin);
    try {
      const url = new URL(request.url || "/", "http://localhost");
      if (request.method === "OPTIONS") return json(response, 204, {}, id);
      if (request.method === "GET" && url.pathname === "/health") {
        return json(response, 200, { status: "ok", service: "xuecheng-api", version: "v1" }, id);
      }
      if (url.pathname === "/api/v1/home") {
        const userId = userIdFrom(request);
        if (request.method === "GET") {
          const snapshot = await store.get(userId);
          if (!snapshot) throw new ApiError(404, "home_not_initialized", "还没有同步首页数据。请先从设备提交一次首页快照。");
          return json(response, 200, { data: buildHomeResponse(snapshot, now()) }, id);
        }
        if (request.method === "PUT") {
          const snapshot = normalizeHomeSnapshot(await readJson(request));
          await store.put(userId, snapshot);
          return json(response, 200, { data: buildHomeResponse(snapshot, now()) }, id);
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
