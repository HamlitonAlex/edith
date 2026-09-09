import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cssPath = new URL("../iphone.css", import.meta.url);

test("chat composer stays outside the scrolling message surface", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.chat-screen\{[^}]*overflow:hidden/);
  assert.match(css, /\.chat-screen \.conversation\{[^}]*overflow-y:auto/);
});
