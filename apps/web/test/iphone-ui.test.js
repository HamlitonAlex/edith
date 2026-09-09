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

test("the product mark is the default and the user can replace it locally", () => {
  assert.match(html, /xuecheng-mark\.svg/);
  assert.match(html, /id="avatar-input"[^>]*accept="image\/\*"/);
  assert.match(js, /addEventListener\("click"/);
  assert.match(js, /avatar: defaultAvatar/);
  assert.match(js, /new FileReader\(\)/);
  assert.match(js, /node\.src = state\.avatar/);
  assert.match(css, /touch-action:manipulation/);
});

test("theme choices preview complete palettes instead of generic dot icons", () => {
  assert.match(html, /class="theme-preview"/);
  assert.match(html, /明亮温暖/);
  assert.match(html, /安静自然/);
  assert.doesNotMatch(html, /<i><\/i>/);
});

test("small supporting text keeps AA contrast on every theme canvas", () => {
  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(value => Number.parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const contrast = (foreground, background) => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  const themeBlocks = [...css.matchAll(/(?::root|:root\[data-theme="[^"]+"\])\{([^}]+)\}/g)];
  assert.equal(themeBlocks.length, 4);
  for (const [, block] of themeBlocks) {
    const canvas = block.match(/--canvas:(#[0-9a-f]{6})/i)?.[1];
    const muted = block.match(/--muted:(#[0-9a-f]{6})/i)?.[1];
    const faint = block.match(/--faint:(#[0-9a-f]{6})/i)?.[1];
    assert.ok(canvas && muted && faint);
    assert.ok(contrast(muted, canvas) >= 4.5);
    assert.ok(contrast(faint, canvas) >= 4.5);
  }
});

test("text entry avoids iOS focus zoom and tracks the visual keyboard viewport", () => {
  assert.match(css, /\.composer textarea\{[^}]*font-size:16px/);
  assert.match(css, /--app-height:100dvh/);
  assert.match(js, /window\.visualViewport/);
  assert.match(js, /keyboard-open/);
  assert.match(html, /interactive-widget=resizes-content/);
  assert.match(html, /maximum-scale=1/);
  assert.match(html, /user-scalable=no/);
});

test("navigation and new messages use purposeful reduced-motion-safe transitions", () => {
  assert.match(css, /@keyframes message-enter/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(js, /nextScreen\.animate/);
  assert.match(js, /Promise\.allSettled/);
  assert.match(js, /reduceMotion\.matches/);
});

test("settings separates plans, model choice, sync and quiet hours", () => {
  assert.match(html, /data-screen="settings"/);
  assert.match(html, /data-plan-option="community"/);
  assert.match(html, /id="model-mode"/);
  assert.match(html, /id="model-provider"/);
  assert.match(html, /id="sync-enabled"/);
  assert.match(html, /id="quiet-start"/);
  assert.match(html, /id="agent-proposal"/);
  assert.match(js, /modelMode: "managed"/);
  assert.match(js, /name === "settings" \? "us" : name/);
  assert.doesNotMatch(html, /type="password"/);
});
