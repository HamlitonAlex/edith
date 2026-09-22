import assert from "node:assert/strict";
import test from "node:test";
import { EXPLICIT_SYNC_POLICY, createExplicitHomeSyncPayload, syncHomeExplicitly } from "../lib/explicit-sync.js";

test("explicit sync only projects approved local fields and never includes keys or raw media", () => {
  const payload = createExplicitHomeSyncPayload({
    preferences: { name: "小程", role: "guide", gender: "female", initiative: .6, directness: .5, modelConfig: { apiKey: "private" }, messages: [{ text: "private chat" }], avatar: "data:image/png;base64,raw", calendarEvents: [] },
    agentState: { current_stage: "基础巩固", long_term_goals: [], skills: {}, next_recommended_action: null, tutor_sessions: [{ raw_audio: "private" }] },
  });
  assert.equal(JSON.stringify(payload).includes("private"), false);
  assert.equal(payload.preferences.avatar, "");
  assert.equal(EXPLICIT_SYNC_POLICY.mode, "explicit_only");
});

test("a failed explicit sync never mutates device-local state", async () => {
  const local = { messages: [{ text: "仍留在设备上" }], modelConfig: { apiKey: "private" } };
  const before = structuredClone(local);
  const result = await syncHomeExplicitly({
    apiBase: "https://api.example.test", accessToken: "token", snapshot: {},
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.deepEqual(local, before);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "network_error");
  assert.equal(result.local_mutated, false);
});

test("an unsigned session does not initiate an upload", async () => {
  let called = false;
  const result = await syncHomeExplicitly({ apiBase: "https://api.example.test", snapshot: {}, fetchImpl: async () => { called = true; } });
  assert.equal(called, false);
  assert.equal(result.reason, "not_authenticated");
});
