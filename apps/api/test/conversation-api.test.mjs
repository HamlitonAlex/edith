import assert from "node:assert/strict";
import test from "node:test";
import { withApi } from "./test-oidc.mjs";

const message = (id, role, text, source = role === "assistant" ? "local_agent" : "typing") => ({
  client_message_id: id, role, text, source, occurred_at: "2030-01-01T08:00:00.000Z",
});

test("conversation backend records chronological text messages and preserves voice as text only", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const send = payload => fetch(`${origin}/api/v1/conversations/main/messages`, {
      method: "POST", headers: headersFor("user-a", { "content-type": "application/json", "idempotency-key": payload.client_message_id }), body: JSON.stringify(payload),
    });
    assert.equal((await send(message("m-1", "user", "我想练习 Python。", "voice_transcript"))).status, 201);
    assert.equal((await send(message("m-2", "assistant", "可以，先从一道小题开始。"))).status, 201);

    const response = await fetch(`${origin}/api/v1/conversations/main/messages`, { headers: headersFor("user-a") });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.messages.map(item => item.id), ["m-1", "m-2"]);
    assert.equal(body.data.messages[0].source, "voice_transcript");
    assert.equal(body.data.conversation.message_count, 2);
  });
});

test("conversation backend is idempotent for a retried send and rejects conflicting replays", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const request = payload => fetch(`${origin}/api/v1/conversations/main/messages`, {
      method: "POST", headers: headersFor("user-a", { "content-type": "application/json", "idempotency-key": payload.client_message_id }), body: JSON.stringify(payload),
    });
    const original = message("m-1", "user", "今天先从十分钟开始。 ");
    assert.equal((await request(original)).status, 201);
    const replay = await request(original);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).data.idempotent_replay, true);
    const conflict = await request(message("m-1", "user", "同一个 ID 的另一段内容。"));
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).error.code, "message_id_conflict");
  });
});

test("conversation backend refuses raw audio, attachments and mismatched idempotency keys", async () => {
  await withApi(async ({ origin, headersFor }) => {
    const response = await fetch(`${origin}/api/v1/conversations/main/messages`, {
      method: "POST", headers: headersFor("user-a", { "content-type": "application/json" }),
      body: JSON.stringify({ ...message("m-1", "user", "不上传音频"), audio: "base64-data" }),
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, "unsupported_message_content");
    const keyMismatch = await fetch(`${origin}/api/v1/conversations/main/messages`, {
      method: "POST", headers: headersFor("user-a", { "content-type": "application/json", "idempotency-key": "other" }), body: JSON.stringify(message("m-1", "user", "一条文字")),
    });
    assert.equal(keyMismatch.status, 422);
    assert.equal((await keyMismatch.json()).error.code, "idempotency_key_mismatch");
  });
});
