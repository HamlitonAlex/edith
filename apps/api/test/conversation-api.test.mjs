import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApiServer } from "../server.mjs";

async function withApi(run) {
  const directory = await mkdtemp(join(tmpdir(), "xuecheng-api-conversation-"));
  const server = createApiServer({ dataDirectory: directory, now: () => new Date("2030-01-01T08:00:00.000Z") });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

const identity = { "x-xuecheng-user-id": "local-demo-user" };
const message = (id, role, text, source = role === "assistant" ? "local_agent" : "typing") => ({
  client_message_id: id, role, text, source, occurred_at: "2030-01-01T08:00:00.000Z",
});

test("conversation backend records chronological text messages and preserves voice as text only", async () => {
  await withApi(async origin => {
    const send = async payload => fetch(`${origin}/api/v1/conversations/main/messages`, {
      method: "POST", headers: { ...identity, "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    assert.equal((await send(message("m-1", "user", "我想练习 Python。", "voice_transcript"))).status, 201);
    assert.equal((await send(message("m-2", "assistant", "可以，先从一道小题开始。"))).status, 201);

    const response = await fetch(`${origin}/api/v1/conversations/main/messages`, { headers: identity });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.messages.map(item => item.id), ["m-1", "m-2"]);
    assert.equal(body.data.messages[0].source, "voice_transcript");
    assert.equal(body.data.conversation.message_count, 2);
  });
});

test("conversation backend is idempotent for a retried send and rejects conflicting replays", async () => {
  await withApi(async origin => {
    const request = payload => fetch(`${origin}/api/v1/conversations/main/messages`, {
      method: "POST", headers: { ...identity, "content-type": "application/json" }, body: JSON.stringify(payload),
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

test("conversation backend refuses raw audio and attachment uploads in the text-sync module", async () => {
  await withApi(async origin => {
    const response = await fetch(`${origin}/api/v1/conversations/main/messages`, {
      method: "POST", headers: { ...identity, "content-type": "application/json" },
      body: JSON.stringify({ ...message("m-1", "user", "不上传音频"), audio: "base64-data" }),
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, "unsupported_message_content");
  });
});
