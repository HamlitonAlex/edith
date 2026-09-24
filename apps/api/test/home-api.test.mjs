import assert from "node:assert/strict";
import test from "node:test";
import { versionFrom, withApi } from "./test-oidc.mjs";

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

const jsonHeaders = (headersFor, subject, extra = {}) => headersFor(subject, { "content-type": "application/json", ...extra });

test("home backend persists a minimal home snapshot and derives the real home summary", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const write = await fetch(`${origin}/api/v1/home`, { method: "PUT", headers: jsonHeaders(headersFor, "user-a"), body: JSON.stringify(validSnapshot) });
    assert.equal(write.status, 200);
    assert.equal(versionFrom(write), 1);
    const first = await write.json();
    assert.equal(first.data.next_step.title, "理解 Python 递归");
    assert.equal(first.data.next_step.is_confirmed_in_schedule, true);
    assert.equal(first.data.path_summary.current_skill.label, "编程基础");
    assert.equal(first.meta.api_version, "v1");

    const read = await fetch(`${origin}/api/v1/home`, { headers: headersFor("user-a") });
    assert.equal(read.status, 200);
    assert.equal(versionFrom(read), 1);
    const second = await read.json();
    assert.equal(second.data.next_calendar_event.summary, "编程练习");
    assert.equal(second.data.path_summary.direction.text, "建立稳定而自主的学习节奏");
    assert.equal(second.data.sync_snapshot.preferences.name, "小程");
    assert.equal("avatar" in second.data.sync_snapshot.preferences, false);
    assert.equal(JSON.stringify(second.data.sync_snapshot).includes("modelConfig"), false);
  });
});

test("home backend rejects missing identity, identity overrides and unrelated local-only fields", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const noIdentity = await fetch(`${origin}/api/v1/home`);
    assert.equal(noIdentity.status, 401);
    assert.equal((await noIdentity.json()).error.code, "identity_required");
    const spoofed = await fetch(`${origin}/api/v1/home`, { headers: { ...headersFor("user-a"), "x-xuecheng-user-id": "user-b" } });
    assert.equal(spoofed.status, 403);
    assert.equal((await spoofed.json()).error.code, "identity_override_forbidden");
    const payload = structuredClone(validSnapshot);
    payload.preferences.messages = [{ text: "不应上传的聊天全文" }];
    payload.preferences.modelConfig = { apiKey: "not-accepted" };
    const response = await fetch(`${origin}/api/v1/home`, { method: "PUT", headers: jsonHeaders(headersFor, "user-a"), body: JSON.stringify(payload) });
    assert.equal(response.status, 200);
    const saved = await (await fetch(`${origin}/api/v1/home`, { headers: headersFor("user-a") })).json();
    assert.equal("messages" in saved.data.companion, false);
    assert.equal(JSON.stringify(saved).includes("not-accepted"), false);
    assert.equal(JSON.stringify(saved).includes("不应上传的聊天全文"), false);
  });
});

test("home backend returns bounded validation and version-conflict errors", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const invalid = structuredClone(validSnapshot);
    invalid.agent_state.next_recommended_action.duration_minutes = 0;
    const response = await fetch(`${origin}/api/v1/home`, { method: "PUT", headers: jsonHeaders(headersFor, "user-a"), body: JSON.stringify(invalid) });
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.error.code, "invalid_snapshot");
    assert.match(body.error.message, /duration_minutes/);

    const initial = await fetch(`${origin}/api/v1/home`, { method: "PUT", headers: jsonHeaders(headersFor, "user-a"), body: JSON.stringify(validSnapshot) });
    assert.equal(initial.status, 200);
    const noPrecondition = await fetch(`${origin}/api/v1/home`, { method: "PUT", headers: jsonHeaders(headersFor, "user-a"), body: JSON.stringify(validSnapshot) });
    assert.equal(noPrecondition.status, 428);
    const conflict = await fetch(`${origin}/api/v1/home`, { method: "PUT", headers: jsonHeaders(headersFor, "user-a", { "if-match": "0" }), body: JSON.stringify(validSnapshot) });
    assert.equal(conflict.status, 409);
    const payload = await conflict.json();
    assert.equal(payload.error.code, "sync_conflict");
    assert.equal(payload.meta.data_version, 1);
  });
});
