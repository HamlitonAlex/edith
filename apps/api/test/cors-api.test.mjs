import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApiServer } from "../server.mjs";

test("API permits the configured web origin and does not reflect unrelated origins", async () => {
  const directory = await mkdtemp(join(tmpdir(), "xuecheng-api-cors-"));
  const server = createApiServer({ dataDirectory: directory, allowedOrigin: "http://localhost:4173" });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  try {
    const allowed = await fetch(`${origin}/api/v1/profile`, { method: "OPTIONS", headers: { origin: "http://localhost:4173" } });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:4173");
    assert.match(allowed.headers.get("access-control-allow-headers"), /authorization/i);
    assert.doesNotMatch(allowed.headers.get("access-control-allow-headers"), /x-xuecheng-user-id/i);
    const rejected = await fetch(`${origin}/api/v1/profile`, { method: "OPTIONS", headers: { origin: "https://untrusted.example" } });
    assert.equal(rejected.status, 204);
    assert.equal(rejected.headers.get("access-control-allow-origin"), null);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
