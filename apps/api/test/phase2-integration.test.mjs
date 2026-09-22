import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApiServer } from "../server.mjs";
import { createTestOidc, fixedNow, versionFrom, withApi } from "./test-oidc.mjs";

const snapshot = {
  preferences: { name: "小程", avatar: "./assets/xuecheng-mark.svg", role: "guide", gender: "female", initiative: .65, directness: .55, calendar_events: [] },
  agent_state: {
    current_stage: "基础巩固", long_term_goals: [], skills: {},
    next_recommended_action: { id: "action-1", title: "Python 练习", why_now: "复习基础", duration_minutes: 20, platform: "学程", skill_id: "computer_basics", status: "proposed" },
  },
};

const jsonHeaders = (headersFor, subject, extra = {}) => headersFor(subject, { "content-type": "application/json", ...extra });

test("private APIs deny unsigned traffic and an unconfigured deployment refuses bearer data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "xuecheng-api-auth-config-"));
  const server = createApiServer({ dataDirectory: directory, now: fixedNow });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const unsigned = await fetch(`http://127.0.0.1:${port}/api/v1/profile`);
    assert.equal(unsigned.status, 401);
    const configuredMissing = await fetch(`http://127.0.0.1:${port}/api/v1/profile`, { headers: { authorization: "Bearer not-a-valid-token" } });
    assert.equal(configuredMissing.status, 503);
    assert.equal((await configuredMissing.json()).error.code, "auth_not_configured");
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("verified identities are isolated across home, conversation, schedule and profile", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const aSnapshot = structuredClone(snapshot);
    aSnapshot.preferences.calendar_events = [{ id: "same-client-event", summary: "只属于 A 的日程", start: "20300101T090000", source: "manual" }];
    const home = await fetch(`${origin}/api/v1/home`, { method: "PUT", headers: jsonHeaders(headersFor, "user-a"), body: JSON.stringify(aSnapshot) });
    assert.equal(home.status, 200);
    const post = await fetch(`${origin}/api/v1/conversations/main/messages`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "idempotency-key": "a-message-1" }),
      body: JSON.stringify({ client_message_id: "a-message-1", role: "user", text: "只属于 A 的文字", source: "typing", occurred_at: "2030-01-01T08:00:00.000Z" }),
    });
    assert.equal(post.status, 201);
    const bSnapshot = structuredClone(snapshot);
    bSnapshot.preferences.calendar_events = [{ id: "same-client-event", summary: "只属于 B 的日程", start: "20300101T100000", source: "manual" }];
    assert.equal((await fetch(`${origin}/api/v1/home`, { method: "PUT", headers: jsonHeaders(headersFor, "user-b"), body: JSON.stringify(bSnapshot) })).status, 200);
    const bMessages = await (await fetch(`${origin}/api/v1/conversations/main/messages`, { headers: headersFor("user-b") })).json();
    assert.equal(bMessages.data.conversation.message_count, 0);
    const bSchedule = await (await fetch(`${origin}/api/v1/schedule?date=2030-01-01`, { headers: headersFor("user-b") })).json();
    assert.equal(bSchedule.data.events[0].summary, "只属于 B 的日程");
    const bProfile = await (await fetch(`${origin}/api/v1/profile`, { headers: headersFor("user-b") })).json();
    assert.equal(bProfile.data.companion.name, "小程");
    const aMessages = await (await fetch(`${origin}/api/v1/conversations/main/messages`, { headers: headersFor("user-a") })).json();
    assert.equal(aMessages.data.messages[0].text, "只属于 A 的文字");
    const aSchedule = await (await fetch(`${origin}/api/v1/schedule?date=2030-01-01`, { headers: headersFor("user-a") })).json();
    assert.equal(aSchedule.data.events[0].summary, "只属于 A 的日程");
  });
});

test("failed schedule confirmation rolls back without creating an event or changing the version", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const home = await fetch(`${origin}/api/v1/home`, { method: "PUT", headers: jsonHeaders(headersFor, "user-a"), body: JSON.stringify(snapshot) });
    const version = versionFrom(home);
    const invalidConfirmation = await fetch(`${origin}/api/v1/schedule/suggestions/action-1/confirm`, {
      method: "POST", headers: jsonHeaders(headersFor, "user-a", { "if-match": String(version) }), body: JSON.stringify({ start: "20300101T140000", duration_minutes: 0 }),
    });
    assert.equal(invalidConfirmation.status, 422);
    const schedule = await fetch(`${origin}/api/v1/schedule?date=2030-01-01`, { headers: headersFor("user-a") });
    assert.equal(versionFrom(schedule), version);
    const body = await schedule.json();
    assert.equal(body.data.events.length, 0);
    assert.equal(body.data.pending_suggestion.id, "action-1");
  });
});

test("SQLite migrations and user data survive a server restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "xuecheng-api-restart-"));
  const oidc = createTestOidc(fixedNow);
  const start = () => createApiServer({ dataDirectory: directory, now: fixedNow, authenticator: oidc.authenticator });
  let server = start();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const write = await fetch(`http://127.0.0.1:${port}/api/v1/home`, { method: "PUT", headers: jsonHeaders(oidc.headersFor, "user-a"), body: JSON.stringify(snapshot) });
    assert.equal(write.status, 200);
    await new Promise(resolve => server.close(resolve));
    server = start();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const restartedPort = server.address().port;
    const read = await fetch(`http://127.0.0.1:${restartedPort}/api/v1/home`, { headers: oidc.headersFor("user-a") });
    assert.equal(read.status, 200);
    assert.equal((await read.json()).data.next_step.title, "Python 练习");
    await new Promise(resolve => server.close(resolve));
    const database = new DatabaseSync(join(directory, "xuecheng.sqlite"));
    const migrations = database.prepare("SELECT version FROM schema_migrations ORDER BY version").all().map(row => row.version);
    database.close();
    assert.deepEqual(migrations, ["001_initial_schema.sql", "002_sync_metadata.sql"]);
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("the authenticated sync policy is explicit and refuses automatic private categories", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const response = await fetch(`${origin}/api/v1/sync/policy`, { headers: headersFor("user-a") });
    assert.equal(response.status, 200);
    const policy = (await response.json()).data;
    assert.equal(policy.sync_mode, "explicit_only");
    assert.ok(policy.allowed.includes("conversation_text_messages"));
    assert.ok(policy.never_automatic.includes("model_api_keys"));
    assert.ok(policy.never_automatic.includes("raw_audio"));
  });
});
