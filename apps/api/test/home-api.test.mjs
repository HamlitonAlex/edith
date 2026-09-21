import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApiServer } from "../server.mjs";

const validSnapshot = {
  preferences: {
    name: "小程", avatar: "./assets/xuecheng-mark.svg", role: "guide", gender: "female", initiative: .65, directness: .55,
    calendar_events: [{ id: "calendar-1", summary: "编程练习", start: "20300101T140000", source: "confirmed-ai-suggestion", sourceActionId: "action-1" }],
  },
  agent_state: {
    current_stage: "基础巩固",
    long_term_goals: [{ id: "goal-1", text: "建立稳定而自主的学习节奏", status: "confirmed", confidence: .9 }],
    skills: { computer_basics: { label: "编程基础", confidence: .45, evidence: ["完成过基础练习"] } },
    next_recommended_action: { id: "action-1", title: "理解 Python 递归", why_now: "继续理解返回值的传递。", duration_minutes: 20, platform: "学程", skill_id: "computer_basics", status: "proposed" },
  },
};

async function withApi(run) {
  const directory = await mkdtemp(join(tmpdir(), "xuecheng-api-"));
  const server = createApiServer({ dataDirectory: directory, now: () => new Date("2030-01-01T08:00:00.000Z") });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await run(`http://127.0.0.1:${port}`, directory);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

const headers = { "content-type": "application/json", "x-xuecheng-user-id": "local-demo-user" };

test("home backend persists a minimal home snapshot and derives the real home summary", async () => {
  await withApi(async origin => {
    const write = await fetch(`${origin}/api/v1/home`, { method: "PUT", headers, body: JSON.stringify(validSnapshot) });
    assert.equal(write.status, 200);
    const first = await write.json();
    assert.equal(first.data.next_step.title, "理解 Python 递归");
    assert.equal(first.data.next_step.is_confirmed_in_schedule, true);
    assert.equal(first.data.path_summary.current_skill.label, "编程基础");

    const read = await fetch(`${origin}/api/v1/home`, { headers: { "x-xuecheng-user-id": "local-demo-user" } });
    assert.equal(read.status, 200);
    const second = await read.json();
    assert.equal(second.data.next_calendar_event.summary, "编程练习");
    assert.equal(second.data.path_summary.direction.text, "建立稳定而自主的学习节奏");
  });
});

test("home backend rejects missing identity and never persists unrelated local-only fields", async () => {
  await withApi(async (origin, directory) => {
    const noIdentity = await fetch(`${origin}/api/v1/home`);
    assert.equal(noIdentity.status, 401);
    const payload = structuredClone(validSnapshot);
    payload.preferences.messages = [{ text: "不应上传的聊天全文" }];
    payload.preferences.modelConfig = { apiKey: "not-accepted" };
    const response = await fetch(`${origin}/api/v1/home`, { method: "PUT", headers, body: JSON.stringify(payload) });
    assert.equal(response.status, 200);
    const saved = await (await fetch(`${origin}/api/v1/home`, { headers: { "x-xuecheng-user-id": "local-demo-user" } })).json();
    assert.equal("messages" in saved.data.companion, false);
    assert.equal(JSON.stringify(saved).includes("not-accepted"), false);
    const persisted = JSON.parse(await readFile(join(directory, "local-demo-user.json"), "utf8"));
    assert.equal(JSON.stringify(persisted).includes("不应上传的聊天全文"), false);
    assert.equal(JSON.stringify(persisted).includes("not-accepted"), false);
  });
});

test("home backend returns bounded validation errors without exposing internals", async () => {
  await withApi(async origin => {
    const invalid = structuredClone(validSnapshot);
    invalid.agent_state.next_recommended_action.duration_minutes = 0;
    const response = await fetch(`${origin}/api/v1/home`, { method: "PUT", headers, body: JSON.stringify(invalid) });
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.error.code, "invalid_snapshot");
    assert.match(body.error.message, /duration_minutes/);
  });
});
