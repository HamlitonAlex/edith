import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../sw.js", import.meta.url), "utf8");

test("offline cache never intercepts model-provider or other cross-origin requests", () => {
  assert.match(source, /new URL\(event\.request\.url\)\.origin !== self\.location\.origin/);
});

test("offline cache includes the conversation history module", () => {
  assert.match(source, /\.\/lib\/conversation-history\.js/);
  assert.match(source, /\.\/assets\/onboarding-path\.webp/);
  assert.match(source, /\.\/assets\/resource-agriculture\.webp/);
  assert.match(source, /xuecheng-iphone-v13/);
});
