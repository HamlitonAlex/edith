import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryRepository } from "../../web/lib/memory-repository.js";
import { createRemoteApi } from "../../web/lib/remote-api.js";
import { withApi } from "./test-oidc.mjs";

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

function remoteFor(origin, headersFor, subject) {
  const auth = { accessToken: () => headersFor(subject).authorization.replace(/^Bearer\s+/i, "") };
  return createRemoteApi({ baseUrl: origin, auth });
}

test("explicit local-first memory sync reaches the authenticated API without duplicate records", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const deviceStorage = storage();
    const remote = remoteFor(origin, headersFor, "user-a");
    const repository = createMemoryRepository({ storage: deviceStorage, scope: "oidc-user-a", remote, now: () => new Date("2030-01-01T08:00:00.000Z") });
    repository.createMemory({
      id: "memory-web-e2e", type: "recent_event", content: "用户希望继续练 Python 递归。",
      source_type: "conversation", source_id: "conversation-web-e2e", topic: "Python", status: "proposed",
    });
    repository.confirmMemory("memory-web-e2e");

    assert.equal((await repository.sync()).synced, true);
    assert.equal((await repository.sync()).synced, true);

    const a = await remote.listMemories();
    assert.equal(a.data.memories.length, 1);
    assert.equal(a.data.memories[0].status, "confirmed");
    assert.equal(a.data.memories[0].confirmed_by_user, true);
    assert.equal(JSON.stringify(a.data).includes("raw_audio"), false);

    const b = await remoteFor(origin, headersFor, "user-b").listMemories();
    assert.deepEqual(b.data.memories, []);
  });
});

test("explicit sync sends only a confirmed Daily Log and replays it once", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const remote = remoteFor(origin, headersFor, "user-a");
    const repository = createMemoryRepository({
      storage: storage(), scope: "oidc-user-a", remote,
      now: () => new Date("2030-01-01T08:00:00.000Z"),
    });
    repository.createDailyLog({
      id: "log-web-e2e", date: "2030-01-01", status: "proposed",
      completed: ["完成递归练习"], ai_summary: "今天练习了递归。",
    });
    assert.equal((await repository.sync()).synced, true);
    assert.deepEqual((await remote.listDailyLogs()).data.daily_logs, []);

    repository.confirmDailyLog("log-web-e2e");
    assert.equal((await repository.sync()).synced, true);
    assert.equal((await repository.sync()).synced, true);

    const logs = (await remote.listDailyLogs()).data.daily_logs;
    assert.equal(logs.length, 1);
    assert.equal(logs[0].status, "confirmed");
    assert.equal(logs[0].confirmed_by_user, true);
    assert.deepEqual(logs[0].completed, ["完成递归练习"]);
    assert.deepEqual((await remoteFor(origin, headersFor, "user-b").listDailyLogs()).data.daily_logs, []);
  });
});
