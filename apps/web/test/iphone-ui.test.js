import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, js] = await Promise.all([
  readFile(new URL("../iphone.html", import.meta.url), "utf8"),
  readFile(new URL("../iphone.css", import.meta.url), "utf8"),
  readFile(new URL("../iphone.js", import.meta.url), "utf8")
]);

test("iPhone UI offers four whole-surface themes", () => {
  for (const theme of ["citrus", "meadow", "berry", "dusk"]) {
    assert.match(html, new RegExp(`data-theme-option="${theme}"`));
    if (theme !== "citrus") assert.match(css, new RegExp(`data-theme="${theme}"`));
  }
});

test("daily work names the platform, action, content and completion", () => {
  assert.match(html, /哔哩哔哩 · BV1fSr7YoEJ7/);
  assert.match(html, /<b>动作：<\/b>/);
  assert.match(html, /<b>完成：<\/b>/);
  assert.match(html, /data-task-chat=/);
});

test("controls are wired and the avatar remains the default", () => {
  assert.doesNotMatch(html, /avatar-input/);
  assert.match(js, /addEventListener\("click"/);
  assert.match(js, /avatar: defaultAvatar/);
  assert.match(css, /touch-action:manipulation/);
});
