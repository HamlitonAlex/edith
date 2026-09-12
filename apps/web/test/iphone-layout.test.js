import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cssPath = new URL("../iphone.css", import.meta.url);
const jsPath = new URL("../iphone.js", import.meta.url);

test("chat composer stays outside the scrolling message surface", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.chat-screen\{[^}]*overflow:hidden/);
  assert.match(css, /\.chat-screen \.conversation\{[^}]*overflow-y:auto/);
});

test("new replies scroll the conversation container past the floating composer", async () => {
  const js = await readFile(jsPath, "utf8");

  assert.match(js, /conversation\.scrollTo\(\{ top: conversation\.scrollHeight/);
  assert.doesNotMatch(js, /\$\("#dynamic-messages"\)\.scrollIntoView/);
});
