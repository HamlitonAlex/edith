import assert from "node:assert/strict";
import test from "node:test";
import { accountScopeFor, createAppRepository, mergeRemoteHome, mergeRemoteMessages, profilePatchFromLocal } from "../lib/app-repository.js";

const preferences = {
  name: "小程", role: "guide", gender: "female", initiative: .65, directness: .55, theme: "day", cloudConsent: false,
  quietStart: "23:00", quietEnd: "07:30", urgentOverride: true, avatar: "data:image/png;base64,private", modelConfig: { apiKey: "private" }, calendarEvents: [],
};
const agentState = { current_stage: "基础", long_term_goals: [], skills: {}, next_recommended_action: null };

test("repository never starts an upload for an unsigned local session", async () => {
  let called = false;
  const repository = createAppRepository({
    auth: { getState: () => ({ authenticated: false }) },
    api: { putHome: async () => { called = true; } },
  });
  const result = await repository.syncAll({ preferences, agentState, messages: [] });
  assert.equal(called, false);
  assert.equal(result.syncStatus, "needs_login");
});

test("explicit sync sends only the approved home projection and idempotent text messages", async () => {
  const requests = [];
  const repository = createAppRepository({
    auth: { getState: () => ({ authenticated: true }) },
    api: {
      getHome: async () => { const error = new Error("missing"); error.status = 404; throw error; },
      putHome: async (body, version) => { requests.push({ kind: "home", body, version }); return { version: 1, data: {}, meta: {} }; },
      patchProfile: async (body, version) => { requests.push({ kind: "profile", body, version }); return { version: 2, data: {}, meta: {} }; },
      appendMessage: async (_conversation, body) => { requests.push({ kind: "message", body }); return { version: 3, data: {}, meta: {} }; },
    },
  });
  await repository.syncAll({
    preferences,
    agentState,
    messages: [{ role: "user", text: "只同步这句确认发送的文字", createdAt: "2030-01-01T08:00:00.000Z", attachments: [{ name: "private.pdf" }] }],
  });
  assert.equal(JSON.stringify(requests).includes("private"), false);
  assert.equal(requests.find(request => request.kind === "message").body.client_message_id.startsWith("msg_"), true);
  assert.equal(requests.find(request => request.kind === "message").body.source, "typing");
});

test("remote merge preserves device-only fields while applying the current account projection", () => {
  const merged = mergeRemoteHome({ preferences, agentState }, {
    data: {
      sync_snapshot: {
        preferences: { name: "远端小程", role: "friend", gender: "neutral", initiative: .4, directness: .3, theme: "night", cloud_consent: true, quiet_start: "22:00", quiet_end: "07:00", urgent_override: false, calendar_events: [{ id: "event-a", summary: "远端日程", start: "20300101T090000" }] },
        agent_state: { current_stage: "迁移", long_term_goals: [], skills: {}, next_recommended_action: null },
      },
    },
  });
  assert.equal(merged.preferences.name, "远端小程");
  assert.equal(merged.preferences.modelConfig.apiKey, "private");
  assert.equal(merged.preferences.avatar, "data:image/png;base64,private");
  assert.equal(merged.preferences.calendarEvents[0].summary, "远端日程");
});

test("messages merge by a stable transport identifier and account scopes do not overlap", async () => {
  const messages = mergeRemoteMessages([{ role: "user", text: "一条旧消息", createdAt: "2030-01-01T08:00:00.000Z" }], [{ id: "server-message", role: "assistant", text: "一条远端回复", occurred_at: "2030-01-01T08:01:00.000Z" }]);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].clientMessageId.startsWith("msg_"), true);
  assert.equal(messages[1].clientMessageId, "server-message");
  const a = await accountScopeFor({ issuer: "https://issuer.example", subject: "user-a" });
  const b = await accountScopeFor({ issuer: "https://issuer.example", subject: "user-b" });
  assert.notEqual(a, b);
});

test("profile projection excludes local-only model and attachment fields", () => {
  const payload = profilePatchFromLocal(preferences);
  assert.equal(Object.hasOwn(payload, "modelConfig"), false);
  assert.equal(Object.hasOwn(payload, "avatar"), false);
  assert.equal(payload.quiet_start, "23:00");
});
