import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApiServer } from "../server.mjs";

async function withApi(run) {
  const directory = await mkdtemp(join(tmpdir(), "xuecheng-api-profile-"));
  const server = createApiServer({ dataDirectory: directory });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { return await run(`http://127.0.0.1:${port}`); }
  finally { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
}

const identity = { "x-xuecheng-user-id": "local-demo-user" };
const jsonHeaders = { ...identity, "content-type": "application/json" };

test("profile exposes safe local-first defaults and persists companion and quiet-hour changes", async () => {
  await withApi(async origin => {
    const initial = await (await fetch(`${origin}/api/v1/profile`, { headers: identity })).json();
    assert.equal(initial.data.companion.name, "小程");
    assert.equal(initial.data.privacy.cloud_consent, false);
    const update = await fetch(`${origin}/api/v1/profile`, {
      method: "PATCH", headers: jsonHeaders,
      body: JSON.stringify({ name: "学程", role: "friend", initiative: .4, quiet_start: "22:30", quiet_end: "07:00", urgent_override: false }),
    });
    assert.equal(update.status, 200);
    const profile = (await update.json()).data;
    assert.equal(profile.companion.name, "学程");
    assert.equal(profile.companion.role, "friend");
    assert.equal(profile.notifications.quiet_start, "22:30");
    assert.equal(profile.notifications.urgent_override, false);
  });
});

test("profile settings survive a later home snapshot without becoming a second user model", async () => {
  await withApi(async origin => {
    await fetch(`${origin}/api/v1/profile`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ theme: "night", quiet_start: "22:00" }) });
    const home = {
      preferences: { name: "小程", avatar: "./assets/xuecheng-mark.svg", role: "guide", gender: "female", initiative: .65, directness: .55, calendar_events: [] },
      agent_state: { current_stage: "基础巩固", long_term_goals: [], skills: {}, next_recommended_action: null },
    };
    const synced = await fetch(`${origin}/api/v1/home`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(home) });
    assert.equal(synced.status, 200);
    const profile = await (await fetch(`${origin}/api/v1/profile`, { headers: identity })).json();
    assert.equal(profile.data.appearance.theme, "night");
    assert.equal(profile.data.notifications.quiet_start, "22:00");
  });
});

test("profile rejects BYOK keys, raw avatars and unrelated client-only content", async () => {
  await withApi(async origin => {
    for (const payload of [{ apiKey: "secret" }, { modelConfig: { apiKey: "secret" } }, { avatar: "data:image/png;base64,raw" }, { messages: [{ text: "private" }] }]) {
      const response = await fetch(`${origin}/api/v1/profile`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(payload) });
      assert.equal(response.status, 422);
      assert.ok(["local_only_setting", "invalid_profile"].includes((await response.json()).error.code));
    }
  });
});
