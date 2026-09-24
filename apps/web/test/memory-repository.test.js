import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryRepository, memoryScopeForIdentity } from "../lib/memory-repository.js";

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

const fixedNow = () => new Date("2030-01-01T08:00:00.000Z");

function memoryInput(overrides = {}) {
  return {
    id: "memory-conversation-1", type: "recent_event", content: "用户想继续练 Python 递归。",
    source_type: "conversation", source_id: "conversation-1", topic: "Python", status: "proposed",
    confidence: .7, importance: .8, ...overrides,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise(next => { resolve = next; });
  return { promise, resolve };
}

test("memory repository persists locally, requires confirmation, and isolates account scopes", () => {
  const deviceStorage = storage();
  const userA = createMemoryRepository({ storage: deviceStorage, scope: "user-a", now: fixedNow });
  userA.createMemory(memoryInput({ raw_audio: "never persist", api_key: "never persist" }));
  assert.equal(userA.buildContext({ current_conversation: { current_input: "继续练递归" } }).relevant_memory.length, 0);

  userA.confirmMemory("memory-conversation-1");
  const afterConfirm = userA.buildContext({ current_conversation: { current_input: "继续练递归" } });
  assert.equal(afterConfirm.relevant_memory[0].id, "memory-conversation-1");

  const reopened = createMemoryRepository({ storage: deviceStorage, scope: "user-a", now: fixedNow });
  assert.equal(reopened.listMemories()[0].status, "confirmed");
  const userB = createMemoryRepository({ storage: deviceStorage, scope: "user-b", now: fixedNow });
  assert.deepEqual(userB.listMemories(), []);
  assert.equal(JSON.stringify(reopened.getState()).includes("never persist"), false);
});

test("verified OIDC scope keeps issuer and subject boundaries collision-free", () => {
  const firstScope = memoryScopeForIdentity({ issuer: "https://login.example/tenant:one", subject: "person" });
  const secondScope = memoryScopeForIdentity({ issuer: "https://login.example/tenant", subject: "one:person" });
  assert.notEqual(firstScope, secondScope);

  const deviceStorage = storage();
  const first = createMemoryRepository({ storage: deviceStorage, scope: firstScope, now: fixedNow });
  first.createMemory(memoryInput());
  const second = createMemoryRepository({ storage: deviceStorage, scope: secondScope, now: fixedNow });
  assert.deepEqual(second.listMemories(), []);
});

test("anonymous local scope persists for one guest session and rotates on logout", async () => {
  const deviceStorage = storage();
  const remote = { async createMemory() { throw new Error("anonymous data must not upload"); } };
  const guest = createMemoryRepository({ storage: deviceStorage, remote, now: fixedNow });
  guest.createMemory(memoryInput({ id: "guest-memory" }));
  const firstScope = guest.scope();
  assert.match(firstScope, /^anonymous_/);
  assert.equal(createMemoryRepository({ storage: deviceStorage, now: fixedNow }).listMemories()[0].id, "guest-memory");

  const offline = await guest.sync();
  assert.equal(offline.sync_status, "requires_login");
  guest.setScope();
  assert.notEqual(guest.scope(), firstScope);
  assert.deepEqual(guest.listMemories(), []);
  assert.deepEqual(createMemoryRepository({ storage: deviceStorage, now: fixedNow }).listMemories(), []);
});

test("new local memories begin proposed and use an explicit confirmation transition", () => {
  const repository = createMemoryRepository({ storage: storage(), now: fixedNow });
  assert.throws(
    () => repository.createMemory(memoryInput({ id: "memory-direct-confirm", source_type: "manual", status: "confirmed", confirmed_by_user: true })),
    error => error?.code === "memory_confirmation_required",
  );
  assert.throws(
    () => repository.createMemory(memoryInput({ id: "memory-direct-archive", status: "archived" })),
    error => error?.code === "memory_confirmation_required",
  );

  repository.createMemory(memoryInput({ id: "memory-explicit-confirm" }));
  repository.confirmMemory("memory-explicit-confirm");
  assert.equal(repository.listMemories()[0].status, "confirmed");
});

test("daily logs and learning evidence have explicit confirmation and evidence boundaries", () => {
  const repository = createMemoryRepository({ storage: storage(), now: fixedNow });
  repository.createDailyLog({ id: "log-20300101", date: "2030-01-01", ai_summary: "小程整理的总结", status: "proposed" });
  assert.equal(repository.buildContext({ current_date: "2030-01-01" }).today_state.daily_log, null);
  repository.confirmDailyLog("log-20300101");
  assert.equal(repository.buildContext({ current_date: "2030-01-01" }).today_state.daily_log.ai_summary, "小程整理的总结");

  assert.throws(() => repository.createLearningEvidence({ id: "not-evidence", topic: "Python", skill: "编程", evidence_type: "chat", result: "只是普通聊天", source_type: "manual" }), /学习证据/);
  repository.createLearningEvidence({ id: "evidence-1", topic: "Python 递归", skill: "编程", evidence_type: "tutor_verification", result: "独立解释终止条件", source_type: "tutor", source_id: "session-1", score: 90 });
  assert.equal(repository.listLearningEvidence().length, 1);
});

test("explicit sync retries safely and leaves local records intact on a network failure", async () => {
  const deviceStorage = storage();
  const records = new Map();
  let version = 0;
  let creates = 0;
  const remote = {
    async getSyncPolicy() { return { data: { allowed: ["memories", "daily_logs", "learning_evidence"] }, version }; },
    async createMemory(memory) {
      creates += 1;
      const existing = records.get(memory.id);
      if (existing && existing.status !== memory.status) {
        const error = new Error("different lifecycle state");
        error.code = "memory_id_conflict";
        error.status = 409;
        throw error;
      }
      if (!existing) { records.set(memory.id, structuredClone(memory)); version += 1; }
      return { data: { memory: structuredClone(records.get(memory.id)) }, version };
    },
    async listMemories() { return { data: { memories: [...records.values()].map(item => structuredClone(item)) }, version }; },
    async confirmMemory(id) { records.get(id).status = "confirmed"; records.get(id).confirmed_by_user = true; version += 1; return { data: { memory: structuredClone(records.get(id)) }, version }; },
    async archiveMemory(id) { records.get(id).status = "archived"; version += 1; return { data: { memory: structuredClone(records.get(id)) }, version }; },
    async createDailyLog(log) { return { data: { daily_log: log }, version }; },
    async createLearningEvidence(evidence) { return { data: { learning_evidence: evidence }, version }; },
  };
  const repository = createMemoryRepository({ storage: deviceStorage, scope: "user-a", remote, now: fixedNow });
  repository.createMemory(memoryInput());
  repository.confirmMemory("memory-conversation-1");

  const first = await repository.sync();
  const retry = await repository.sync();
  assert.equal(first.synced, true);
  assert.equal(retry.synced, true);
  assert.equal(records.size, 1);
  assert.equal(records.get("memory-conversation-1").status, "confirmed");
  assert.equal(creates, 2);

  const offline = createMemoryRepository({
    storage: deviceStorage,
    scope: "user-offline",
    remote: {
      getSyncPolicy: async () => ({ data: { allowed: ["memories", "daily_logs", "learning_evidence"] }, version: 0 }),
      createMemory: async () => { const error = new Error("offline"); error.code = "network_error"; throw error; },
    },
    now: fixedNow,
  });
  offline.createMemory(memoryInput({ id: "memory-offline" }));
  offline.confirmMemory("memory-offline");
  const result = await offline.sync();
  assert.equal(result.synced, false);
  assert.equal(result.sync_status, "failed");
  assert.equal(offline.listMemories()[0].id, "memory-offline");
});

test("an outdated local tombstone never adopts a newer policy version to delete remote data", async () => {
  const remoteRecords = new Map();
  let remoteVersion = 0;
  const deleteVersions = [];
  const conflictIfStale = expectedVersion => {
    if (expectedVersion !== remoteVersion) {
      const error = new Error("stale version");
      error.code = "sync_conflict";
      error.status = 409;
      throw error;
    }
  };
  const remote = {
    async getSyncPolicy() { return { data: { allowed: ["memories", "daily_logs", "learning_evidence"] }, version: remoteVersion }; },
    async createMemory(memory, expectedVersion) {
      conflictIfStale(expectedVersion);
      remoteRecords.set(memory.id, structuredClone(memory));
      remoteVersion += 1;
      return { data: { memory: structuredClone(memory) }, version: remoteVersion };
    },
    async confirmMemory(id, expectedVersion) {
      conflictIfStale(expectedVersion);
      const memory = remoteRecords.get(id);
      memory.status = "confirmed";
      memory.confirmed_by_user = true;
      remoteVersion += 1;
      return { data: { memory: structuredClone(memory) }, version: remoteVersion };
    },
    async deleteMemory(id, expectedVersion) {
      deleteVersions.push(expectedVersion);
      conflictIfStale(expectedVersion);
      remoteRecords.delete(id);
      remoteVersion += 1;
      return { data: { deleted: true }, version: remoteVersion };
    },
  };
  const repository = createMemoryRepository({ storage: storage(), scope: "user-a", remote, now: fixedNow });
  repository.createMemory(memoryInput());
  repository.confirmMemory("memory-conversation-1");
  assert.equal((await repository.sync()).synced, true);
  assert.equal(repository.getState().remote_version, 2);

  remoteVersion = 3; // A different device changed the account after this repository last synced.
  repository.deleteMemory("memory-conversation-1");
  const result = await repository.sync();

  assert.equal(deleteVersions.at(-1), 2);
  assert.equal(result.synced, false);
  assert.equal(result.sync_status, "conflict");
  assert.equal(remoteRecords.has("memory-conversation-1"), true);
  assert.equal(repository.getState().tombstones.length, 1);
});

test("a locally confirmed memory is created remotely as a proposal before its confirmation transition", async () => {
  let version = 0;
  let createPayload = null;
  const remote = {
    async getSyncPolicy() { return { data: { allowed: ["memories", "daily_logs", "learning_evidence"] }, version }; },
    async createMemory(memory) {
      createPayload = structuredClone(memory);
      version += 1;
      return { data: { memory: structuredClone(memory) }, version };
    },
    async confirmMemory(id) {
      version += 1;
      return { data: { memory: { id, status: "confirmed", confirmed_by_user: true } }, version };
    },
  };
  const repository = createMemoryRepository({ storage: storage(), scope: "user-a", remote, now: fixedNow });
  repository.createMemory(memoryInput({ id: "manual-confirmed", source_type: "manual" }));
  repository.confirmMemory("manual-confirmed");

  const result = await repository.sync();

  assert.equal(result.synced, true);
  assert.equal(createPayload.status, "proposed");
  assert.equal(createPayload.confirmed_by_user, false);
});

test("switching accounts while policy is pending cancels the captured sync without crossing scopes", async () => {
  const policyStarted = deferred();
  const releasePolicy = deferred();
  const sent = [];
  const remote = {
    async getSyncPolicy() {
      policyStarted.resolve();
      return releasePolicy.promise;
    },
    async createMemory(memory) {
      sent.push(memory);
      return { data: { memory }, version: 1 };
    },
  };
  const repository = createMemoryRepository({ storage: storage(), scope: "account-a", remote, now: fixedNow });
  repository.createMemory(memoryInput({ id: "memory-account-a" }));
  repository.confirmMemory("memory-account-a");
  const pending = repository.sync();
  await policyStarted.promise;

  repository.setScope("account-b");
  repository.createDailyLog({ id: "log-account-b", date: "2030-01-01", status: "draft" });
  releasePolicy.resolve({ data: { allowed: ["memories", "daily_logs", "learning_evidence"] }, version: 0 });

  const result = await pending;
  assert.equal(result.sync_status, "cancelled");
  assert.equal(sent.length, 0);
  assert.equal(repository.scope(), "account-b");
  assert.equal(repository.getState().remote_version, null);
  assert.equal(repository.listDailyLogs()[0].id, "log-account-b");
  repository.setScope("account-a");
  assert.equal(repository.getState().remote_version, null);
  assert.equal(repository.listMemories()[0].id, "memory-account-a");
});

test("a policy denial leaves the blocked collection local and does not call its remote endpoint", async () => {
  let sent = false;
  const remote = {
    async getSyncPolicy() { return { data: { allowed: ["memories"] }, version: 0 }; },
    async createDailyLog() { sent = true; return { data: {}, version: 1 }; },
  };
  const repository = createMemoryRepository({ storage: storage(), scope: "user-a", remote, now: fixedNow });
  repository.createDailyLog({ id: "log-policy-denied", date: "2030-01-01", status: "draft" });
  repository.confirmDailyLog("log-policy-denied");

  const result = await repository.sync();

  assert.equal(result.synced, false);
  assert.equal(result.last_error, "sync_policy_denied");
  assert.equal(sent, false);
  assert.equal(repository.listDailyLogs()[0].id, "log-policy-denied");
});

test("memory sync projection omits raw media, keys, attachments, and diagnostics", async () => {
  let payload = null;
  let version = 0;
  const remote = {
    async getSyncPolicy() { return { data: { allowed: ["memories", "daily_logs", "learning_evidence"] }, version }; },
    async createMemory(memory) {
      payload = structuredClone(memory);
      version += 1;
      return { data: { memory: payload }, version };
    },
    async confirmMemory(id) { payload.status = "confirmed"; payload.confirmed_by_user = true; version += 1; return { data: { memory: { id, ...payload } }, version }; },
  };
  const repository = createMemoryRepository({ storage: storage(), scope: "user-a", remote, now: fixedNow });
  repository.createMemory(memoryInput({
    id: "memory-safe-projection",
    raw_audio: "private recording",
    api_key: "private key",
    attachments: ["private file"],
    diagnostic_logs: "private log",
  }));
  repository.confirmMemory("memory-safe-projection");

  assert.equal((await repository.sync()).synced, true);
  assert.equal(payload.raw_audio, undefined);
  assert.equal(payload.api_key, undefined);
  assert.equal(payload.attachments, undefined);
  assert.equal(payload.diagnostic_logs, undefined);
});

test("a synced local delete emits one tombstone and removes the corresponding remote memory", async () => {
  const records = new Map();
  let version = 0;
  let deletes = 0;
  const remote = {
    async getSyncPolicy() { return { data: { allowed: ["memories", "daily_logs", "learning_evidence"] }, version }; },
    async createMemory(memory, expectedVersion) {
      assert.equal(expectedVersion, version);
      records.set(memory.id, structuredClone(memory));
      version += 1;
      return { data: { memory }, version };
    },
    async confirmMemory(id, expectedVersion) {
      assert.equal(expectedVersion, version);
      const record = records.get(id);
      record.status = "confirmed";
      record.confirmed_by_user = true;
      version += 1;
      return { data: { memory: structuredClone(record) }, version };
    },
    async deleteMemory(id, expectedVersion) {
      assert.equal(expectedVersion, version);
      deletes += 1;
      records.delete(id);
      version += 1;
      return { data: { deleted: true }, version };
    },
  };
  const repository = createMemoryRepository({ storage: storage(), scope: "user-a", remote, now: fixedNow });
  repository.createMemory(memoryInput({ id: "memory-delete" }));
  repository.confirmMemory("memory-delete");
  assert.equal((await repository.sync()).synced, true);
  repository.deleteMemory("memory-delete");

  const result = await repository.sync();

  assert.equal(result.synced, true);
  assert.equal(deletes, 1);
  assert.equal(records.has("memory-delete"), false);
  assert.equal(repository.getState().tombstones.length, 0);
});

test("unconfirmed Memory and Daily Log records remain local during explicit sync", async () => {
  let policyCalls = 0;
  let creates = 0;
  let updates = 0;
  const remote = {
    async getSyncPolicy() { policyCalls += 1; return { data: { allowed: ["memories", "daily_logs", "learning_evidence"] }, version: 0 }; },
    async createMemory() { creates += 1; throw new Error("unconfirmed memory must not upload"); },
    async createDailyLog() { creates += 1; throw new Error("draft log must not upload"); },
    async updateDailyLog() { updates += 1; throw new Error("draft log must not update remotely"); },
  };
  const repository = createMemoryRepository({ storage: storage(), scope: "user-a", remote, now: fixedNow });
  repository.createMemory(memoryInput({ id: "memory-local-proposal" }));
  repository.createDailyLog({ id: "log-update", date: "2030-01-01", ai_summary: "first draft", status: "draft" });
  repository.updateDailyLog("log-update", { completed: ["完成一道递归题"], ai_summary: "revised draft" });

  const result = await repository.sync();

  assert.equal(result.synced, true);
  assert.equal(policyCalls, 0);
  assert.equal(creates, 0);
  assert.equal(updates, 0);
  assert.equal(repository.listMemories()[0].status, "proposed");
  assert.deepEqual(repository.listDailyLogs()[0].completed, ["完成一道递归题"]);
  assert.equal(repository.listDailyLogs()[0].ai_summary, "revised draft");
});

test("a remote confirmation conflicts with a stale local archive instead of archiving the confirmed memory", async () => {
  const records = new Map();
  let version = 0;
  let archives = 0;
  const remote = {
    async getSyncPolicy() { return { data: { allowed: ["memories", "daily_logs", "learning_evidence"] }, version }; },
    async createMemory(memory, expectedVersion) {
      const existing = records.get(memory.id);
      if (existing) {
        const error = new Error("same id, new lifecycle state");
        error.code = "memory_id_conflict";
        error.status = 409;
        throw error;
      }
      assert.equal(expectedVersion, version);
      records.set(memory.id, structuredClone(memory));
      version += 1;
      return { data: { memory: structuredClone(memory) }, version };
    },
    async confirmMemory(id, expectedVersion) {
      assert.equal(expectedVersion, version);
      const record = records.get(id);
      record.status = "confirmed";
      record.confirmed_by_user = true;
      version += 1;
      return { data: { memory: structuredClone(record) }, version };
    },
    async getMemory(id) { return { data: { memory: structuredClone(records.get(id)) }, version }; },
    async archiveMemory(id, expectedVersion) {
      assert.equal(expectedVersion, version);
      archives += 1;
      records.get(id).status = "archived";
      records.get(id).confirmed_by_user = false;
      version += 1;
      return { data: { memory: structuredClone(records.get(id)) }, version };
    },
  };
  const repository = createMemoryRepository({ storage: storage(), scope: "user-a", remote, now: fixedNow });
  repository.createMemory(memoryInput({ id: "memory-archive-conflict" }));
  repository.confirmMemory("memory-archive-conflict");
  assert.equal((await repository.sync()).synced, true);
  repository.archiveMemory("memory-archive-conflict");
  records.get("memory-archive-conflict").status = "confirmed";
  records.get("memory-archive-conflict").confirmed_by_user = true;
  version += 1;

  const result = await repository.sync();

  assert.equal(result.synced, false);
  assert.equal(result.sync_status, "conflict");
  assert.equal(archives, 0);
  assert.equal(records.get("memory-archive-conflict").status, "confirmed");
});

test("same-account repository instances retain both locally created records", () => {
  const deviceStorage = storage();
  const first = createMemoryRepository({ storage: deviceStorage, scope: "user-a", now: fixedNow });
  const second = createMemoryRepository({ storage: deviceStorage, scope: "user-a", now: fixedNow });

  first.createMemory(memoryInput({ id: "memory-tab-a" }));
  second.createMemory(memoryInput({ id: "memory-tab-b" }));

  const reopened = createMemoryRepository({ storage: deviceStorage, scope: "user-a", now: fixedNow });
  assert.deepEqual(reopened.listMemories().map(memory => memory.id).sort(), ["memory-tab-a", "memory-tab-b"]);
});
