import assert from "node:assert/strict";
import test from "node:test";
import { versionFrom, withApi } from "./test-oidc.mjs";

const snapshot = {
  preferences: {
    name: "小程", avatar: "./assets/xuecheng-mark.svg", role: "guide", gender: "female", initiative: .65, directness: .55,
    calendar_events: [{ id: "manual-1", summary: "英语听力练习", start: "20300101T090000", duration_minutes: 25, source: "manual" }],
  },
  agent_state: {
    current_stage: "基础巩固",
    long_term_goals: [{ id: "goal-1", text: "建立稳定而自主的学习节奏", status: "confirmed", confidence: .9 }],
    skills: { computer_basics: { label: "编程基础", confidence: .45, evidence: ["完成过基础练习"] } },
    next_recommended_action: { id: "action-1", title: "理解 Python 递归", why_now: "继续理解返回值的传递。", duration_minutes: 20, platform: "学程", skill_id: "computer_basics", status: "proposed" },
  },
};

const jsonHeaders = (headersFor, subject, extra = {}) => headersFor(subject, { "content-type": "application/json", ...extra });
async function writeHome(origin, headersFor, subject = "user-a", extra = {}) {
  const response = await fetch(`${origin}/api/v1/home`, { method: "PUT", headers: jsonHeaders(headersFor, subject, extra), body: JSON.stringify(snapshot) });
  assert.equal(response.status, 200);
  return versionFrom(response);
}

test("schedule keeps an AI suggestion pending until the user confirms it", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const version = await writeHome(origin, headersFor);
    const before = await (await fetch(`${origin}/api/v1/schedule?date=2030-01-01`, { headers: headersFor("user-a") })).json();
    assert.equal(before.data.events.length, 1);
    assert.equal(before.data.pending_suggestion.id, "action-1");

    const confirmation = await fetch(`${origin}/api/v1/schedule/suggestions/action-1/confirm`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "if-match": String(version) }), body: JSON.stringify({ start: "20300101T140000" }),
    });
    assert.equal(confirmation.status, 201);
    const confirmed = await confirmation.json();
    assert.equal(confirmed.data.event.source, "confirmed-ai-suggestion");

    const after = await (await fetch(`${origin}/api/v1/schedule?date=2030-01-01`, { headers: headersFor("user-a") })).json();
    assert.equal(after.data.events.length, 2);
    assert.equal(after.data.pending_suggestion, null);
  });
});

test("schedule confirmation is atomic, idempotent and cannot confirm a stale suggestion", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const version = await writeHome(origin, headersFor);
    const request = id => fetch(`${origin}/api/v1/schedule/suggestions/${id}/confirm`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "if-match": String(version) }), body: JSON.stringify({ start: "20300101T140000" }),
    });
    assert.equal((await request("action-1")).status, 201);
    const replay = await request("action-1");
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).data.idempotent_replay, true);
    assert.equal((await request("unknown-action")).status, 404);
  });
});

test("schedule lets users add and adjust manual events without mutating AI-confirmed events", async () => {
  await withApi(async ({ origin, headersFor }) => {
    let version = await writeHome(origin, headersFor);
    const created = await fetch(`${origin}/api/v1/schedule/events`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "if-match": String(version) }), body: JSON.stringify({ summary: "整理错题", start: "20300101T190000", duration_minutes: 20 }),
    });
    assert.equal(created.status, 201);
    version = versionFrom(created);
    const manual = (await created.json()).data.event;
    const revised = await fetch(`${origin}/api/v1/schedule/events/${manual.id}`, {
      method: "PUT", headers: jsonHeaders(headersFor, "user-a", { "if-match": String(version) }), body: JSON.stringify({ duration_minutes: 30 }),
    });
    assert.equal(revised.status, 200);
    version = versionFrom(revised);
    assert.equal((await revised.json()).data.event.duration_minutes, 30);
    const confirmed = await fetch(`${origin}/api/v1/schedule/suggestions/action-1/confirm`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "if-match": String(version) }), body: JSON.stringify({ start: "20300101T140000" }),
    });
    const confirmedEvent = (await confirmed.json()).data.event;
    const suggestedEdit = await fetch(`${origin}/api/v1/schedule/events/${confirmedEvent.id}`, {
      method: "PUT", headers: jsonHeaders(headersFor, "user-a", { "if-match": String(version + 1) }), body: JSON.stringify({ summary: "已调整英语听力" }),
    });
    assert.equal(suggestedEdit.status, 409);
    assert.equal((await suggestedEdit.json()).error.code, "suggested_event_requires_reconsideration");
  });
});

test("a later stale home snapshot cannot overwrite server-owned confirmed calendar events", async () => {
  await withApi(async ({ origin, headersFor }) => {
    let version = await writeHome(origin, headersFor);
    const created = await fetch(`${origin}/api/v1/schedule/events`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "if-match": String(version) }), body: JSON.stringify({ summary: "服务端新增安排", start: "20300101T190000", duration_minutes: 20 }),
    });
    assert.equal(created.status, 201);
    version = versionFrom(created);
    const staleHome = structuredClone(snapshot);
    staleHome.preferences.calendar_events = [];
    assert.equal((await fetch(`${origin}/api/v1/home`, { method: "PUT", headers: jsonHeaders(headersFor, "user-a", { "if-match": String(version) }), body: JSON.stringify(staleHome) })).status, 200);
    const schedule = await (await fetch(`${origin}/api/v1/schedule?date=2030-01-01`, { headers: headersFor("user-a") })).json();
    assert.equal(schedule.data.events.some(event => event.summary === "服务端新增安排"), true);
  });
});
