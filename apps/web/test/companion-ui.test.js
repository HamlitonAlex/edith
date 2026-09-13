import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, js, build] = await Promise.all([
  readFile(new URL("../companion-v3.html", import.meta.url), "utf8"),
  readFile(new URL("../companion-v3.css", import.meta.url), "utf8"),
  readFile(new URL("../companion.js", import.meta.url), "utf8"),
  readFile(new URL("../../../scripts/build-mobile.mjs", import.meta.url), "utf8"),
]);
const [iphoneHtml, iphoneCss, iphoneJs] = await Promise.all([
  readFile(new URL("../iphone.html", import.meta.url), "utf8"),
  readFile(new URL("../iphone-refinement.css", import.meta.url), "utf8"),
  readFile(new URL("../iphone.js", import.meta.url), "utf8"),
]);

test("desktop companion preview has an intentional empty state instead of a blank stream", () => {
  assert.match(js, /life-empty/);
  assert.match(js, /从一句话开始，今天的下一步会在这里形成/);
  assert.match(css, /\.life-empty\s*\{/);
  assert.match(css, /onboarding-path\.webp/);
});

test("desktop companion preview uses the same atmosphere without breaking project-page paths", () => {
  assert.match(css, /Desktop polish/);
  assert.match(css, /@media \(min-width: 821px\)/);
  assert.match(css, /--primary: #2f5c46/);
  assert.match(html, /<b>森林<\/b><small>绿色主调<\/small>/);
  assert.match(css, /backdrop-filter: blur\(18px\)/);
  assert.match(html, /href="\.\/companion-v3\.css"/);
  assert.match(html, /src="\.\/companion\.js"/);
  assert.match(js, /from "\.\/lib\/companion-state\.js"/);
  assert.doesNotMatch(css, /url\("\/assets\//);
  assert.match(build, /web-preview\.html/);
  assert.match(build, /companion-v3\.css/);
});

test("mobile chat keeps a clear daily atmosphere tied to the current topic", () => {
  assert.match(iphoneJs, /dailyAtmosphere/);
  assert.match(iphoneJs, /chooseDailyAtmosphere/);
  assert.match(iphoneJs, /renderChatAtmosphere\(action\)/);
  assert.match(iphoneCss, /filter:saturate\(\.82\) contrast\(1\.05\) brightness\(1\.03\)/);
  assert.match(iphoneCss, /data-atmosphere="path"/);
  assert.match(iphoneHtml, /chat-atmosphere/);
});
