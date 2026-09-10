import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createEncryptedBackup, readEncryptedBackup } from "../local-backup.js";

test("local backup round-trips without exposing its content", async () => {
  const payload = { preferences: { gender: "male" }, agent: { memory: ["喜欢先看例子"] } };
  const backup = await createEncryptedBackup(payload, "correct horse", webcrypto);
  assert.doesNotMatch(backup, /喜欢先看例子|male/);
  assert.deepEqual(await readEncryptedBackup(backup, "correct horse", webcrypto), payload);
});

test("local backup rejects a wrong password", async () => {
  const backup = await createEncryptedBackup({ private: true }, "right", webcrypto);
  await assert.rejects(() => readEncryptedBackup(backup, "wrong", webcrypto), /密码不正确或文件已损坏/);
});
