import assert from "node:assert/strict";
import test from "node:test";
import { versionFrom, withApi } from "./test-oidc.mjs";

const jsonHeaders = (headersFor, subject, extra = {}) => headersFor(subject, { "content-type": "application/json", ...extra });

async function json(response) {
  return { response, body: await response.json() };
}

test("Memory stays isolated, requires confirmation, and enters context only after confirmation", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const unsigned = await fetch(`${origin}/api/v1/memories`);
    assert.equal(unsigned.status, 401);
    const spoofed = await fetch(`${origin}/api/v1/memories`, { headers: { ...headersFor("user-a"), "x-xuecheng-user-id": "user-b" } });
    assert.equal(spoofed.status, 403);
    const memory = {
      id: "memory-front-end", type: "long_term", content: "我最近可能想学习前端。",
      source_type: "conversation", source_id: "conversation-1", topic: "前端", status: "proposed", confidence: 0.62, importance: 0.7,
      api_key: "must-not-persist", raw_audio: "must-not-persist",
    };
    const created = await fetch(`${origin}/api/v1/memories`, { method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": memory.id }), body: JSON.stringify(memory) });
    assert.equal(created.status, 201);
    const createdVersion = versionFrom(created);
    const createdBody = await created.json();
    assert.equal(createdBody.data.memory.status, "proposed");
    assert.equal(JSON.stringify(createdBody).includes("must-not-persist"), false);

    const duplicate = await fetch(`${origin}/api/v1/memories`, { method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": memory.id }), body: JSON.stringify(memory) });
    assert.equal(duplicate.status, 200);
    assert.equal(versionFrom(duplicate), createdVersion);
    assert.equal((await duplicate.json()).data.idempotent_replay, true);

    const bMemories = await (await fetch(`${origin}/api/v1/memories`, { headers: headersFor("user-b") })).json();
    assert.deepEqual(bMemories.data.memories, []);

    const proposedPreview = await (await fetch(`${origin}/api/v1/context/preview`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": "memory-inferred" }),
      body: JSON.stringify({ current_input: "我该怎么开始学前端？", current_date: "2030-01-01" }),
    })).json();
    assert.equal(proposedPreview.data.relevant_memory.length, 0);
    assert.equal(proposedPreview.data.proposed_memories[0].id, "memory-front-end");

    const confirmed = await fetch(`${origin}/api/v1/memories/memory-front-end/confirm`, {
      method: "POST", headers: headersFor("user-a", { "if-match": String(createdVersion) }),
    });
    assert.equal(confirmed.status, 200);
    const confirmedVersion = versionFrom(confirmed);
    assert.equal((await confirmed.json()).data.memory.confirmed_by_user, true);

    const confirmedPreview = await (await fetch(`${origin}/api/v1/context/preview`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a"),
      body: JSON.stringify({ current_input: "我该怎么开始学前端？", current_date: "2030-01-01" }),
    })).json();
    assert.equal(confirmedPreview.data.relevant_memory[0].id, "memory-front-end");
    assert.equal(confirmedPreview.data.proposed_memories.length, 0);

    const archived = await fetch(`${origin}/api/v1/memories/memory-front-end/archive`, {
      method: "POST", headers: headersFor("user-a", { "if-match": String(confirmedVersion) }),
    });
    assert.equal(archived.status, 200);
    const archiveVersion = versionFrom(archived);

    const archivedPreview = await (await fetch(`${origin}/api/v1/context/preview`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a"),
      body: JSON.stringify({ current_input: "我该怎么开始学前端？", current_date: "2030-01-01" }),
    })).json();
    assert.equal(archivedPreview.data.relevant_memory.length, 0);

    const removed = await fetch(`${origin}/api/v1/memories/memory-front-end`, {
      method: "DELETE", headers: headersFor("user-a", { "if-match": String(archiveVersion) }),
    });
    assert.equal(removed.status, 200);
    assert.equal((await removed.json()).data.deleted, true);
  });
});

test("a model inference cannot create a confirmed long-term fact without user confirmation", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const response = await fetch(`${origin}/api/v1/memories`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a"),
      body: JSON.stringify({
        id: "memory-inferred", type: "long_term", content: "用户长期目标是前端。",
        source_type: "conversation", status: "confirmed", confirmed_by_user: true,
      }),
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, "memory_confirmation_required");
  });
});

test("Memory creation always starts as a proposal before the user confirms it", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const response = await fetch(`${origin}/api/v1/memories`, {
      method: "POST",
      headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": "memory-manual-confirmed" }),
      body: JSON.stringify({
        id: "memory-manual-confirmed", type: "long_term", content: "我想转向人工智能方向。",
        source_type: "manual", status: "confirmed", confirmed_by_user: true,
      }),
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, "memory_confirmation_required");

    const listed = await (await fetch(`${origin}/api/v1/memories`, { headers: headersFor("user-a") })).json();
    assert.deepEqual(listed.data.memories, []);
  });
});

test("Memory source references reject copied private conversation text", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const response = await fetch(`${origin}/api/v1/memories`, {
      method: "POST",
      headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": "memory-private-source" }),
      body: JSON.stringify({
        id: "memory-private-source", type: "recent_event", content: "用户想继续学习。",
        source_type: "conversation", source_id: "这里不能复制一整段私密聊天原文", status: "proposed",
      }),
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, "invalid_memory_source");
  });
});

test("Memory source inspection returns a safe descriptor instead of copied chat text", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const memory = {
      id: "memory-source-inspection", type: "recent_event", content: "用户希望之后继续练递归。",
      source_type: "conversation", source_id: "conversation-opaque-1", status: "proposed",
    };
    const created = await fetch(`${origin}/api/v1/memories`, {
      method: "POST",
      headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": memory.id }),
      body: JSON.stringify(memory),
    });
    assert.equal(created.status, 201);

    const inspected = await fetch(`${origin}/api/v1/memories/${memory.id}/source`, { headers: headersFor("user-a") });
    assert.equal(inspected.status, 200);
    const body = await inspected.json();
    assert.deepEqual(body.data.source, {
      type: "conversation",
      id: "conversation-opaque-1",
      label: "与小程的对话",
      created_at: "2030-01-01T08:00:00.000Z",
    });
    assert.equal(JSON.stringify(body).includes(memory.content), false);

    const otherUser = await fetch(`${origin}/api/v1/memories/${memory.id}/source`, { headers: headersFor("user-b") });
    assert.equal(otherUser.status, 404);
  });
});

test("Daily Log cannot be created directly as a confirmed record", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const response = await fetch(`${origin}/api/v1/daily-logs`, {
      method: "POST",
      headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": "log-direct-confirm" }),
      body: JSON.stringify({
        id: "log-direct-confirm", date: "2030-01-01", status: "confirmed", confirmed_by_user: true,
        ai_summary: "不应绕过确认流程。",
      }),
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, "daily_log_confirmation_required");

    const listed = await (await fetch(`${origin}/api/v1/daily-logs`, { headers: headersFor("user-a") })).json();
    assert.deepEqual(listed.data.daily_logs, []);
  });
});

test("Create retries are idempotent but stale creates cannot resurrect deleted records", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const scenarios = [
      {
        name: "memory", path: "/api/v1/memories", listKey: "memories", id: "memory-stale-create",
        payload: { id: "memory-stale-create", type: "recent_event", content: "需要继续复习。", source_type: "manual", status: "proposed" },
      },
      {
        name: "daily log", path: "/api/v1/daily-logs", listKey: "daily_logs", id: "log-stale-create",
        payload: { id: "log-stale-create", date: "2030-01-02", status: "draft" },
      },
      {
        name: "learning evidence", path: "/api/v1/learning-evidence", listKey: "learning_evidence", id: "evidence-stale-create",
        payload: { id: "evidence-stale-create", topic: "递归", skill: "programming", evidence_type: "correct_answer", result: "完成一题。", source_type: "manual" },
      },
    ];

    for (const scenario of scenarios) {
      const initial = await fetch(`${origin}${scenario.path}`, { headers: headersFor("user-a") });
      const initialVersion = versionFrom(initial);
      const created = await fetch(`${origin}${scenario.path}`, {
        method: "POST",
        headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": scenario.id, "if-match": String(initialVersion) }),
        body: JSON.stringify(scenario.payload),
      });
      assert.equal(created.status, 201, scenario.name);
      const createVersion = versionFrom(created);

      const replay = await fetch(`${origin}${scenario.path}`, {
        method: "POST",
        headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": scenario.id }),
        body: JSON.stringify(scenario.payload),
      });
      assert.equal(replay.status, 200, `${scenario.name} replay`);
      assert.equal(versionFrom(replay), createVersion);
      assert.equal((await replay.json()).data.idempotent_replay, true);

      const removed = await fetch(`${origin}${scenario.path}/${scenario.id}`, {
        method: "DELETE",
        headers: headersFor("user-a", { "if-match": String(createVersion) }),
      });
      assert.equal(removed.status, 200, `${scenario.name} delete`);
      const deleteVersion = versionFrom(removed);

      const withoutVersion = await fetch(`${origin}${scenario.path}`, {
        method: "POST",
        headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": scenario.id }),
        body: JSON.stringify(scenario.payload),
      });
      assert.equal(withoutVersion.status, 428, `${scenario.name} missing version`);

      const stale = await fetch(`${origin}${scenario.path}`, {
        method: "POST",
        headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": scenario.id, "if-match": String(createVersion) }),
        body: JSON.stringify(scenario.payload),
      });
      assert.equal(stale.status, 409, `${scenario.name} stale recreate`);

      const listed = await fetch(`${origin}${scenario.path}`, { headers: headersFor("user-a") });
      assert.equal(versionFrom(listed), deleteVersion);
      assert.deepEqual((await listed.json()).data[scenario.listKey], []);
    }
  });
});

test("A retried proposal remains idempotent after its confirm or archive response is lost", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const proposal = {
      id: "memory-terminal-retry", type: "recent_event", content: "用户想继续练习递归。", source_type: "conversation", source_id: "conversation-terminal-retry", status: "proposed",
    };
    const created = await fetch(`${origin}/api/v1/memories`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": proposal.id }), body: JSON.stringify(proposal),
    });
    assert.equal(created.status, 201);
    const createdVersion = versionFrom(created);

    const confirmed = await fetch(`${origin}/api/v1/memories/${proposal.id}/confirm`, {
      method: "POST", headers: headersFor("user-a", { "if-match": String(createdVersion) }),
    });
    assert.equal(confirmed.status, 200);
    const confirmedVersion = versionFrom(confirmed);

    const afterConfirmRetry = await fetch(`${origin}/api/v1/memories`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": proposal.id }), body: JSON.stringify(proposal),
    });
    assert.equal(afterConfirmRetry.status, 200);
    assert.equal(versionFrom(afterConfirmRetry), confirmedVersion);
    const confirmedReplay = await afterConfirmRetry.json();
    assert.equal(confirmedReplay.data.idempotent_replay, true);
    assert.equal(confirmedReplay.data.memory.status, "confirmed");

    const archived = await fetch(`${origin}/api/v1/memories/${proposal.id}/archive`, {
      method: "POST", headers: headersFor("user-a", { "if-match": String(confirmedVersion) }),
    });
    assert.equal(archived.status, 200);
    const archivedVersion = versionFrom(archived);

    const afterArchiveRetry = await fetch(`${origin}/api/v1/memories`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": proposal.id }), body: JSON.stringify(proposal),
    });
    assert.equal(afterArchiveRetry.status, 200);
    assert.equal(versionFrom(afterArchiveRetry), archivedVersion);
    const archivedReplay = await afterArchiveRetry.json();
    assert.equal(archivedReplay.data.idempotent_replay, true);
    assert.equal(archivedReplay.data.memory.status, "archived");
  });
});

test("A retried Daily Log proposal remains idempotent after its confirm response is lost", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const proposal = {
      id: "log-terminal-retry", date: "2030-01-06", completed: ["完成练习"], ai_summary: "用户完成了递归练习。", status: "proposed",
    };
    const created = await fetch(`${origin}/api/v1/daily-logs`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": proposal.id }), body: JSON.stringify(proposal),
    });
    assert.equal(created.status, 201);
    const createdVersion = versionFrom(created);

    const confirmed = await fetch(`${origin}/api/v1/daily-logs/${proposal.id}/confirm`, {
      method: "POST", headers: headersFor("user-a", { "if-match": String(createdVersion) }),
    });
    assert.equal(confirmed.status, 200);
    const confirmedVersion = versionFrom(confirmed);

    const replay = await fetch(`${origin}/api/v1/daily-logs`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": proposal.id }), body: JSON.stringify(proposal),
    });
    assert.equal(replay.status, 200);
    assert.equal(versionFrom(replay), confirmedVersion);
    const body = await replay.json();
    assert.equal(body.data.idempotent_replay, true);
    assert.equal(body.data.daily_log.status, "confirmed");
    assert.equal(body.data.daily_log.confirmed_by_user, true);
  });
});

test("Every create endpoint requires a stable client id and matching Idempotency-Key", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const scenarios = [
      {
        path: "/api/v1/memories", id: "memory-required-id",
        payload: { id: "memory-required-id", type: "recent_event", content: "继续学习。", source_type: "manual", status: "proposed" },
        missingIdCode: "memory_id_required",
      },
      {
        path: "/api/v1/daily-logs", id: "log-required-id",
        payload: { id: "log-required-id", date: "2030-01-03", status: "draft" },
        missingIdCode: "daily_log_id_required",
      },
      {
        path: "/api/v1/learning-evidence", id: "evidence-required-id",
        payload: { id: "evidence-required-id", topic: "递归", skill: "programming", evidence_type: "correct_answer", result: "完成一题。", source_type: "manual" },
        missingIdCode: "learning_evidence_id_required",
      },
    ];

    for (const scenario of scenarios) {
      const missingKey = await fetch(`${origin}${scenario.path}`, {
        method: "POST", headers: jsonHeaders(headersFor, "user-a"), body: JSON.stringify(scenario.payload),
      });
      assert.equal(missingKey.status, 422);
      assert.equal((await missingKey.json()).error.code, "idempotency_key_required");

      const mismatchedKey = await fetch(`${origin}${scenario.path}`, {
        method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": "different-client-id" }), body: JSON.stringify(scenario.payload),
      });
      assert.equal(mismatchedKey.status, 422);
      assert.equal((await mismatchedKey.json()).error.code, "idempotency_key_mismatch");

      const withoutId = { ...scenario.payload };
      delete withoutId.id;
      const missingId = await fetch(`${origin}${scenario.path}`, {
        method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": scenario.id }), body: JSON.stringify(withoutId),
      });
      assert.equal(missingId.status, 422);
      assert.equal((await missingId.json()).error.code, scenario.missingIdCode);
    }
  });
});

test("A rejected Daily Log write rolls back without changing the existing log or version", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const first = {
      id: "log-rollback-first", date: "2030-01-04", completed: ["完成第一份草稿"], status: "draft",
    };
    const created = await fetch(`${origin}/api/v1/daily-logs`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": first.id }), body: JSON.stringify(first),
    });
    assert.equal(created.status, 201);
    const version = versionFrom(created);

    const rejected = await fetch(`${origin}/api/v1/daily-logs`, {
      method: "POST",
      headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": "log-rollback-second", "if-match": String(version) }),
      body: JSON.stringify({ id: "log-rollback-second", date: first.date, completed: ["不应部分写入"], status: "draft" }),
    });
    assert.equal(rejected.status, 409);
    assert.equal((await rejected.json()).error.code, "daily_log_date_conflict");

    const listed = await fetch(`${origin}/api/v1/daily-logs`, { headers: headersFor("user-a") });
    assert.equal(versionFrom(listed), version);
    assert.deepEqual((await listed.json()).data.daily_logs.map(log => ({ id: log.id, completed: log.completed })), [{ id: first.id, completed: first.completed }]);
  });
});

test("Learning Evidence source references reject copied private conversation text", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const response = await fetch(`${origin}/api/v1/learning-evidence`, {
      method: "POST",
      headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": "evidence-private-source" }),
      body: JSON.stringify({
        id: "evidence-private-source", topic: "递归", skill: "programming", evidence_type: "tutor_verification",
        result: "完成练习。", source_type: "tutor", source_id: "这里不能复制一整段私密聊天原文",
      }),
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, "invalid_learning_evidence_source");
  });
});

test("Memory and Daily Log transitions require a current version and retain state on conflict", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const memory = {
      id: "memory-transition-version", type: "recent_event", content: "用户希望持续练习。", source_type: "manual", status: "proposed",
    };
    const createdMemory = await fetch(`${origin}/api/v1/memories`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": memory.id }), body: JSON.stringify(memory),
    });
    assert.equal(createdMemory.status, 201);
    const memoryVersion = versionFrom(createdMemory);

    const missingMemoryVersion = await fetch(`${origin}/api/v1/memories/${memory.id}/confirm`, {
      method: "POST", headers: headersFor("user-a"),
    });
    assert.equal(missingMemoryVersion.status, 428);
    const stillProposed = await fetch(`${origin}/api/v1/memories/${memory.id}`, { headers: headersFor("user-a") });
    assert.equal(versionFrom(stillProposed), memoryVersion);
    assert.equal((await stillProposed.json()).data.memory.status, "proposed");

    const confirmedMemory = await fetch(`${origin}/api/v1/memories/${memory.id}/confirm`, {
      method: "POST", headers: headersFor("user-a", { "if-match": String(memoryVersion) }),
    });
    assert.equal(confirmedMemory.status, 200);
    const confirmedMemoryVersion = versionFrom(confirmedMemory);
    const staleArchive = await fetch(`${origin}/api/v1/memories/${memory.id}/archive`, {
      method: "POST", headers: headersFor("user-a", { "if-match": String(memoryVersion) }),
    });
    assert.equal(staleArchive.status, 409);
    const stillConfirmed = await fetch(`${origin}/api/v1/memories/${memory.id}`, { headers: headersFor("user-a") });
    assert.equal(versionFrom(stillConfirmed), confirmedMemoryVersion);
    assert.equal((await stillConfirmed.json()).data.memory.status, "confirmed");

    const log = { id: "log-transition-version", date: "2030-01-05", status: "proposed", ai_summary: "用户完成了练习。" };
    const createdLog = await fetch(`${origin}/api/v1/daily-logs`, {
      method: "POST",
      headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": log.id, "if-match": String(confirmedMemoryVersion) }),
      body: JSON.stringify(log),
    });
    assert.equal(createdLog.status, 201);
    const logVersion = versionFrom(createdLog);

    const missingLogVersion = await fetch(`${origin}/api/v1/daily-logs/${log.id}/confirm`, {
      method: "POST", headers: headersFor("user-a"),
    });
    assert.equal(missingLogVersion.status, 428);
    const stillDraft = await fetch(`${origin}/api/v1/daily-logs/${log.id}`, { headers: headersFor("user-a") });
    assert.equal(versionFrom(stillDraft), logVersion);
    assert.equal((await stillDraft.json()).data.daily_log.status, "proposed");

    const confirmedLog = await fetch(`${origin}/api/v1/daily-logs/${log.id}/confirm`, {
      method: "POST", headers: headersFor("user-a", { "if-match": String(logVersion) }),
    });
    assert.equal(confirmedLog.status, 200);
  });
});

test("Sync policy names the confirmation and projection boundaries for Memory Foundation data", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const response = await fetch(`${origin}/api/v1/sync/policy`, { headers: headersFor("user-a") });
    assert.equal(response.status, 200);
    const policy = (await response.json()).data;
    assert.ok(policy.allowed.includes("memories"));
    assert.ok(policy.allowed.includes("daily_logs"));
    assert.ok(policy.allowed.includes("learning_evidence"));
    assert.deepEqual(policy.sync_conditions, {
      memories: "confirmed_by_user_only",
      daily_logs: "confirmed_by_user_only",
      learning_evidence: "structured_summary_only",
      conversation_text_messages: "explicit_user_selected_text_only",
    });
  });
});

test("Daily Log remains a draft or proposal until the user confirms the AI summary", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const log = {
      id: "log-20300101", date: "2030-01-01", completed: ["完成递归练习"], problems: ["返回值含义不稳定"],
      learned: ["递归调用先处理终止条件"], tomorrow_plan: "明天做一题迁移练习", ai_summary: "今天完成了递归基础练习。", status: "proposed",
    };
    const created = await fetch(`${origin}/api/v1/daily-logs`, { method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": log.id }), body: JSON.stringify(log) });
    assert.equal(created.status, 201);
    const version = versionFrom(created);

    const otherUserLogs = await (await fetch(`${origin}/api/v1/daily-logs`, { headers: headersFor("user-b") })).json();
    assert.deepEqual(otherUserLogs.data.daily_logs, []);

    const retry = await fetch(`${origin}/api/v1/daily-logs`, { method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": log.id }), body: JSON.stringify(log) });
    assert.equal(retry.status, 200);
    assert.equal(versionFrom(retry), version);

    const before = await (await fetch(`${origin}/api/v1/context/preview`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a"), body: JSON.stringify({ current_date: "2030-01-01", current_input: "我今天学了递归" }),
    })).json();
    assert.equal(before.data.today_state.daily_log, null);

    const confirmed = await fetch(`${origin}/api/v1/daily-logs/log-20300101/confirm`, {
      method: "POST", headers: headersFor("user-a", { "if-match": String(version) }),
    });
    assert.equal(confirmed.status, 200);

    const after = await (await fetch(`${origin}/api/v1/context/preview`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a"), body: JSON.stringify({ current_date: "2030-01-01", current_input: "我今天学了递归" }),
    })).json();
    assert.equal(after.data.today_state.daily_log.status, "confirmed");
    assert.match(after.data.today_state.daily_log.ai_summary, /递归/);
  });
});

test("Learning Evidence requires a real evidence type and normal chat cannot fabricate mastery", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const message = await fetch(`${origin}/api/v1/conversations/main/messages`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": "memory-chat-1" }),
      body: JSON.stringify({ client_message_id: "memory-chat-1", role: "user", text: "我问过 Python 递归。", source: "typing", occurred_at: "2030-01-01T08:00:00.000Z" }),
    });
    assert.equal(message.status, 201);
    const messageVersion = versionFrom(message);
    const empty = await (await fetch(`${origin}/api/v1/learning-evidence`, { headers: headersFor("user-a") })).json();
    assert.deepEqual(empty.data.learning_evidence, []);

    const invalid = await fetch(`${origin}/api/v1/learning-evidence`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": "evidence-invalid" }),
      body: JSON.stringify({ id: "evidence-invalid", topic: "Python 递归", skill: "programming", evidence_type: "chat", result: "用户提问", source_type: "manual" }),
    });
    assert.equal(invalid.status, 422);

    const evidence = {
      id: "evidence-recursion-1", topic: "Python 递归", skill: "programming", evidence_type: "tutor_verification",
      result: "能独立解释终止条件并完成一题迁移练习。", score: 88, source_type: "tutor", source_id: "tutor-session-1", confidence: 0.86,
    };
    const created = await fetch(`${origin}/api/v1/learning-evidence`, { method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": evidence.id, "if-match": String(messageVersion) }), body: JSON.stringify(evidence) });
    assert.equal(created.status, 201);
    const selfReport = {
      id: "evidence-recursion-self-report", topic: "Python 递归", skill: "programming", evidence_type: "user_self_report",
      result: "用户认为还需要复习终止条件。", source_type: "user", source_id: "self-report-1", confidence: 0.5,
    };
    const selfReportCreated = await fetch(`${origin}/api/v1/learning-evidence`, {
      method: "POST",
      headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": selfReport.id, "if-match": String(versionFrom(created)) }),
      body: JSON.stringify(selfReport),
    });
    assert.equal(selfReportCreated.status, 201);
    const duplicate = await fetch(`${origin}/api/v1/learning-evidence`, { method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": evidence.id }), body: JSON.stringify(evidence) });
    assert.equal(duplicate.status, 200);

    const preview = await (await fetch(`${origin}/api/v1/context/preview`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a"), body: JSON.stringify({ current_input: "继续练递归", current_date: "2030-01-01" }),
    })).json();
    assert.equal(preview.data.relevant_learning_evidence[0].id, "evidence-recursion-1");

    const bEvidence = await (await fetch(`${origin}/api/v1/learning-evidence`, { headers: headersFor("user-b") })).json();
    assert.deepEqual(bEvidence.data.learning_evidence, []);
  });
});

test("context preview observes the character budget instead of sending every message or memory", async () => {
  await withApi(async ({ origin, headersFor }) => {
    for (let index = 0; index < 20; index += 1) {
      const message = await fetch(`${origin}/api/v1/conversations/main/messages`, {
        method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": `context-message-${index}` }),
        body: JSON.stringify({ client_message_id: `context-message-${index}`, role: "user", text: `第 ${index} 条很长的聊天内容 ${"学习计划 ".repeat(20)}`, source: "typing", occurred_at: `2030-01-01T08:${String(index).padStart(2, "0")}:00.000Z` }),
      });
      assert.equal(message.status, 201);
    }
    const preview = await (await fetch(`${origin}/api/v1/context/preview`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a"),
      body: JSON.stringify({ current_input: "当前这句必须优先保留", current_date: "2030-01-01", max_chars: 1600 }),
    })).json();
    assert.equal(preview.data.current_input, "当前这句必须优先保留");
    assert.ok(preview.data.recent_conversation.length <= 12);
    assert.ok(JSON.stringify(preview.data).length <= 1900);
    assert.ok(preview.data.truncation.omitted_messages > 0);
  });
});
