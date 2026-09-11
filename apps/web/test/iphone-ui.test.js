import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, refinementCss, js] = await Promise.all([
  readFile(new URL("../iphone.html", import.meta.url), "utf8"),
  readFile(new URL("../iphone.css", import.meta.url), "utf8"),
  readFile(new URL("../iphone-refinement.css", import.meta.url), "utf8"),
  readFile(new URL("../iphone.js", import.meta.url), "utf8")
]);

test("iPhone UI offers only a manual day and night atmosphere", () => {
  for (const theme of ["day", "night"]) {
    assert.match(html, new RegExp(`data-theme-option="${theme}"`));
    assert.match(css, new RegExp(`data-theme="${theme}"`));
  }
  for (const retiredTheme of ["citrus", "meadow", "berry", "dusk", "elegant", "silver"]) {
    assert.doesNotMatch(html, new RegExp(`data-theme-option="${retiredTheme}"`));
  }
  assert.match(html, /日间/);
  assert.match(html, /夜间/);
});

test("daily work names the platform, action, content and completion", () => {
  assert.match(html, /id="today-agenda"/);
  assert.match(html, /id="today-empty"/);
  assert.match(js, /renderToday/);
  assert.match(js, /做到什么算完成/);
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

test("appearance control is compact and keeps theme choice low effort", () => {
  assert.match(html, /class="appearance-switch"/);
  assert.doesNotMatch(html, /class="theme-preview"/);
  assert.ok(html.indexOf('class="appearance-switch"') > html.indexOf('data-screen="settings"'));
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
  assert.equal(themeBlocks.length, 2);
  for (const [, block] of themeBlocks) {
    const canvas = block.match(/--canvas:(#[0-9a-f]{6})/i)?.[1];
    const muted = block.match(/--muted:(#[0-9a-f]{6})/i)?.[1];
    const faint = block.match(/--faint:(#[0-9a-f]{6})/i)?.[1];
    assert.ok(canvas && muted && faint);
    assert.ok(contrast(muted, canvas) >= 4.5);
    assert.ok(contrast(faint, canvas) >= 4.5);
  }
});

test("shared brand actions keep readable text in both atmospheres", () => {
  assert.match(css, /--on-action:#fff9f0/);
  assert.match(css, /\.role-options button\.active\{[^}]*color:var\(--on-action\)/);
});

test("text entry avoids iOS focus zoom and tracks the visual keyboard viewport", () => {
  assert.match(css, /\.composer textarea\{[^}]*font-size:16px/);
  assert.match(css, /--app-height:100dvh/);
  assert.match(js, /window\.visualViewport/);
  assert.match(js, /keyboard-open/);
  assert.match(html, /interactive-widget=resizes-content/);
  assert.doesNotMatch(html, /maximum-scale=1/);
  assert.doesNotMatch(html, /user-scalable=no/);
});

test("the active iPhone interface uses SVG marks instead of emoji or status glyphs", () => {
  assert.match(html, /class="status-icons"[^>]*>[\s\S]*?<svg/);
  assert.match(html, /class="platform-mark"[^>]*>[\s\S]*?<svg/);
  assert.doesNotMatch(html, /●●●|⌁|▰|>程<|[\p{Extended_Pictographic}]/u);
});

test("bottom navigation is a floating rounded control layer over a quiet canvas", () => {
  assert.match(refinementCss, /\.bottom-nav\s*\{[^}]*right:\s*12px[^}]*left:\s*12px[^}]*border-radius:\s*24px/s);
  assert.match(refinementCss, /\.phone::after,[\s\S]*\.plan-proposal::after\s*\{\s*display:\s*none/);
  assert.match(refinementCss, /\.chat-screen\s*\{\s*background:\s*transparent/);
});

test("warm themes stay muted and the main proposal presents one primary decision", () => {
  assert.doesNotMatch(css, /--canvas:#e1b4bc|--canvas:#c8b8d3|--action:#a63755|--action:#744c85/);
  assert.match(html, /id="start-action"/);
  assert.match(html, /id="discuss-action"/);
  assert.doesNotMatch(html, /id="adopt-plan"|接受这个安排/);
  assert.match(refinementCss, /\.plan-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/s);
  assert.match(refinementCss, /button:focus-visible/);
});

test("navigation and new messages use purposeful reduced-motion-safe transitions", () => {
  assert.match(css, /@keyframes message-enter/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(js, /nextScreen\.animate/);
  assert.match(js, /Promise\.allSettled/);
  assert.match(js, /reduceMotion\.matches/);
});

test("settings exposes real BYOK and backup controls", () => {
  assert.match(html, /data-screen="settings"/);
  assert.match(html, /本地个人版/);
  assert.match(html, /id="export-backup"/);
  assert.match(html, /id="import-backup"/);
  assert.match(html, /id="provider-select"/);
  assert.match(html, /id="api-key"[^>]*type="password"/);
  assert.match(html, /id="test-model-connection"/);
  assert.match(html, /id="fetch-models"/);
  assert.match(html, /id="save-model-config"/);
  assert.match(html, /id="quiet-start"/);
  assert.match(html, /id="agent-proposal"/);
  assert.match(js, /name === "settings" \? "us" : name/);
});

test("the companion identity is quiet, personal and gender configurable", () => {
  assert.match(html, /class="companion-mark"/);
  assert.doesNotMatch(html, /class="avatar-button"|class="quiet-action"/);
  for (const gender of ["female", "male", "neutral"]) assert.match(html, new RegExp(`data-gender="${gender}"`));
  assert.match(js, /gender: "female"/);
  assert.match(js, /pronounFor/);
});

test("task interaction is concrete, negotiable and confirms external jumps", () => {
  assert.match(html, /id="external-action-dialog"/);
  assert.match(html, /id="confirm-external-action"/);
  assert.match(js, /growth-trace/);
  assert.doesNotMatch(html, />已完成<|>待开始</);
  assert.match(js, /openExternalConfirmation/);
  assert.match(js, /discussCurrentAction/);
});

test("the entire composer supports hold to talk", () => {
  assert.match(js, /bindHoldToTalk\(\$\("#chat-form"\)\)/);
  assert.match(js, /holdTimer/);
  assert.match(js, /confidence/);
});

test("new users begin without fabricated personal history", () => {
  assert.doesNotMatch(html, /早上好。我把你最近说的|可以，不过晚上如果太累/);
  assert.doesNotMatch(js, /请根据你已经知道的信息，判断我现在最值得做的下一件事/);
});

test("first run is a skippable three-step conversation-led setup", () => {
  assert.match(html, /id="onboarding"/);
  for (const step of ["partner", "relationship", "boundary"]) assert.match(html, new RegExp(`data-onboarding-step="${step}"`));
  assert.match(html, /data-onboarding-skip/);
  assert.match(html, /id="cloud-consent"/);
  assert.doesNotMatch(html, /哔哩哔哩 · 通识|农业革命|42 个来自/);
});

test("composer owns attachment capture and preview", () => {
  assert.match(html, /id="attachment-trigger"/);
  assert.match(html, /id="attachment-input"[^>]*accept="image\/\*,text\/\*,application\/pdf"/);
  assert.match(html, /id="attachment-preview"/);
  assert.match(html, /拍照|选择照片|选择文件|粘贴文字/);
});

test("assistant messages do not repeat an avatar", () => {
  assert.doesNotMatch(js, /companion-message"><img/);
});

test("source permissions are real settings rather than development placeholders", () => {
  assert.match(html, /资料与授权/);
  assert.match(html, /id="calendar-file"/);
  assert.doesNotMatch(html, /功能开发中|尚未接入/);
});
