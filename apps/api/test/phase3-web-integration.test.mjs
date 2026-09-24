import assert from "node:assert/strict";
import test from "node:test";
import { createAppRepository } from "../../web/lib/app-repository.js";
import { createRemoteApi } from "../../web/lib/remote-api.js";
import { withApi } from "./test-oidc.mjs";

const preferences = name => ({
  name, role: "guide", gender: "female", initiative: .65, directness: .55,
  theme: "day", cloudConsent: false, quietStart: "23:00", quietEnd: "07:30",
  urgentOverride: true, calendarEvents: [], modelConfig: { apiKey: "must-stay-local" },
});
const agentState = {
  current_stage: "基础巩固", long_term_goals: [], skills: {},
  next_recommended_action: { id: "action-1", title: "Python 练习", why_now: "复习基础", duration_minutes: 20, platform: "学程", skill_id: "computer_basics", status: "proposed" },
};

function browserAuth(headersFor, subject) {
  const token = headersFor(subject).authorization.replace(/^Bearer\s+/i, "");
  return {
    accessToken: () => token,
    getState: () => ({ authenticated: true, identity: { issuer: "https://identity.test.example", subject } }),
    handleRemoteStatus() {},
  };
}

function browserRepository(origin, headersFor, subject) {
  const auth = browserAuth(headersFor, subject);
  return createAppRepository({ auth, api: createRemoteApi({ baseUrl: origin, auth }) });
}

test("Phase 3 browser repository persists an explicit user sync and retains it after a fresh repository reads the API", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const repository = browserRepository(origin, headersFor, "user-a");
    const messages = [{ clientMessageId: "phase3-message-a", role: "user", text: "只同步确认发送的文字", createdAt: "2030-01-01T08:00:00.000Z", attachments: [{ name: "private.pdf" }] }];
    const synced = await repository.syncAll({ preferences: preferences("A 的小程"), agentState, messages });
    assert.equal(synced.syncStatus, "synced");

    const restarted = browserRepository(origin, headersFor, "user-a");
    const loaded = await restarted.readRemote({ preferences: preferences("本地默认"), agentState: { ...agentState, next_recommended_action: null }, messages: [] });
    assert.equal(loaded.applied, true);
    assert.equal(loaded.preferences.name, "A 的小程");
    assert.equal(loaded.messages[0].text, "只同步确认发送的文字");
    assert.equal(loaded.preferences.modelConfig.apiKey, "must-stay-local");
  });
});

test("Phase 3 repository keeps messages idempotent, isolates accounts, and reports offline failures without mutating local input", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const a = browserRepository(origin, headersFor, "user-a");
    const message = { clientMessageId: "phase3-repeat-a", role: "user", text: "重复发送也只能保存一次", createdAt: "2030-01-01T08:00:00.000Z" };
    await a.syncAll({ preferences: preferences("A"), agentState, messages: [] });
    assert.equal((await a.sendMessage(message)).syncStatus, "synced");
    assert.equal((await a.sendMessage(message)).syncStatus, "synced");
    const own = await a.readRemote({ preferences: preferences("A"), agentState, messages: [] });
    assert.equal(own.messages.filter(item => item.clientMessageId === "phase3-repeat-a").length, 1);

    const b = browserRepository(origin, headersFor, "user-b");
    const other = await b.readRemote({ preferences: preferences("B"), agentState, messages: [] });
    assert.equal(other.messages.length, 0);

    const original = preferences("离线本地");
    const offlineAuth = browserAuth(headersFor, "user-a");
    const offline = createAppRepository({
      auth: offlineAuth,
      api: createRemoteApi({ baseUrl: "http://127.0.0.1:1", auth: offlineAuth }),
    });
    const before = structuredClone(original);
    const outcome = await offline.syncAll({ preferences: original, agentState, messages: [message] });
    assert.equal(outcome.syncStatus, "failed");
    assert.deepEqual(original, before);
  });
});

test("Phase 3 repository confirms a pending suggestion once and never promotes it before the user confirms", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const repository = browserRepository(origin, headersFor, "user-a");
    const before = await repository.syncAll({ preferences: preferences("A"), agentState, messages: [] });
    assert.equal(before.syncStatus, "synced");
    const confirmed = await repository.confirmScheduleSuggestion("action-1", { start: "20300101T140000", duration_minutes: 20 });
    assert.equal(confirmed.ok, true);
    const duplicate = await repository.confirmScheduleSuggestion("action-1", { start: "20300101T140000", duration_minutes: 20 });
    assert.equal(duplicate.ok, true);

    const auth = browserAuth(headersFor, "user-a");
    const api = createRemoteApi({ baseUrl: origin, auth });
    const schedule = await api.getSchedule("2030-01-01");
    assert.equal(schedule.data.events.length, 1);
    assert.equal(schedule.data.events[0].source_action_id, "action-1");
    assert.equal(schedule.data.pending_suggestion, null);
  });
});
