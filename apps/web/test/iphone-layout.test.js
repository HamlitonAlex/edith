import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cssPath = new URL("../iphone.css", import.meta.url);
const refinementCssPath = new URL("../iphone-refinement.css", import.meta.url);
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

test("native immersive hero screens are not pushed below the safe-area by the screen inset", async () => {
  const css = await readFile(refinementCssPath, "utf8");

  assert.match(css, /:root\.native-shell \.us-screen,\s*:root\.native-shell \.settings-screen\s*\{\s*padding-top:\s*0\s*;?/);
  assert.match(css, /:root\.native-shell \.settings-header\s*\{[^}]*padding-top:\s*calc\(19px \+ env\(safe-area-inset-top\)\)/);
});

test("dialogs and chat use the visible keyboard viewport instead of the stale shell height", async () => {
  const [css, js] = await Promise.all([readFile(refinementCssPath, "utf8"), readFile(jsPath, "utf8")]);

  assert.match(js, /--visible-viewport-height/);
  assert.match(css, /\.action-dialog:not\(#model-dialog\)\s*\{/);
  assert.match(css, /top:calc\(var\(--visible-viewport-height,100dvh\) \/ 2\)/);
  assert.match(css, /max-height:calc\(var\(--visible-viewport-height,100dvh\) - 24px\)/);
  assert.match(css, /\.keyboard-open \.composer\s*\{[^}]*bottom:max\(8px,var\(--safe-bottom\)/);
  assert.match(css, /\.keyboard-open \.chat-screen\s*\{[^}]*height:var\(--visible-viewport-height,var\(--app-height\)\)/);
});

test("bottom chrome shares one safe-area contract so composer and tab bar cannot intersect", async () => {
  const css = await readFile(refinementCssPath, "utf8");

  assert.match(css, /--bottom-nav-offset:max\(10px,var\(--safe-bottom\)\)/);
  assert.match(css, /\.composer\{[^}]*bottom:calc\(var\(--bottom-nav-offset\) \+ var\(--bottom-nav-height\) \+ var\(--composer-nav-gap\)\)/s);
  assert.match(css, /\.bottom-nav\{[^}]*bottom:var\(--bottom-nav-offset\)[^}]*height:var\(--bottom-nav-height\)/s);
});

test("native chat header starts at the real safe-area edge without extra top padding", async () => {
  const css = await readFile(refinementCssPath, "utf8");

  assert.match(css, /:root\.native-shell \.chat-screen\{[^}]*padding-top:var\(--safe-top\)/s);
  assert.match(css, /:root\.native-shell \.companion-header\{[^}]*top:var\(--safe-top\)[^}]*height:64px/s);
});

test("model picker keeps its close action reachable inside the visible viewport", async () => {
  const css = await readFile(refinementCssPath, "utf8");

  assert.match(css, /#model-dialog\{[^}]*overflow:hidden/s);
  assert.match(css, /#model-dialog form\{[^}]*overflow-y:auto/s);
  assert.match(css, /#model-dialog form>button\[value="cancel"\]\{[^}]*position:sticky/s);
});

test("conversation state distinguishes an empty start, a restored history, and an in-flight reply", async () => {
  const [html, js] = await Promise.all([readFile(new URL("../iphone.html", import.meta.url), "utf8"), readFile(jsPath, "utf8")]);

  assert.match(html, /id="conversation"[^>]*data-conversation-state/);
  assert.match(html, /Hi，今天想从哪里开始/);
  assert.match(js, /idle_empty/);
  assert.match(js, /conversation_restored/);
  assert.match(js, /conversation_active/);
  assert.match(js, /generating/);
  assert.match(js, /setConversationStatus\("generating"\)/);
  assert.match(js, /正在整理你的想法/);
  assert.doesNotMatch(js, /正在结合你刚才说的内容/);
});
