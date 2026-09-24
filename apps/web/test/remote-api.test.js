import assert from "node:assert/strict";
import test from "node:test";
import { createRemoteApi } from "../lib/remote-api.js";

function successfulResponse(data, version) {
  return {
    ok: true,
    headers: { get: name => name.toLowerCase() === "etag" ? `W/\"${version}\"` : null },
    json: async () => ({ data, meta: { data_version: version } }),
  };
}

test("memory foundation creates bind Idempotency-Key to the stable local record id", async () => {
  const requests = [];
  const api = createRemoteApi({
    baseUrl: "https://sync.example",
    auth: { accessToken: () => "access-token" },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return successfulResponse({}, 7);
    },
  });

  await api.createMemory({ id: "memory-1", content: "记忆" }, 4);
  await api.createDailyLog({ id: "log-1", date: "2030-01-01" }, 5);
  await api.createLearningEvidence({ id: "evidence-1", topic: "递归" }, 6);

  assert.deepEqual(requests.map(request => request.options.headers["idempotency-key"]), ["memory-1", "log-1", "evidence-1"]);
  assert.deepEqual(requests.map(request => request.options.headers["if-match"]), ['W/"4"', 'W/"5"', 'W/"6"']);
  assert.deepEqual(requests.map(request => request.options.headers.authorization), ["Bearer access-token", "Bearer access-token", "Bearer access-token"]);
});
