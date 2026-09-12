import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, refinementCss, js, markSvg, webIcon, iosIcon, manifest, planner, tutor, evaluator, infoPlist, buildScript] = await Promise.all([
  readFile(new URL("../iphone.html", import.meta.url), "utf8"),
  readFile(new URL("../iphone.css", import.meta.url), "utf8"),
  readFile(new URL("../iphone-refinement.css", import.meta.url), "utf8"),
  readFile(new URL("../iphone.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/xuecheng-mark.svg", import.meta.url), "utf8"),
  readFile(new URL("../assets/xuecheng-mark.png", import.meta.url)),
  readFile(new URL("../../../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", import.meta.url)),
  readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"),
  readFile(new URL("../agent/planner.js", import.meta.url), "utf8"),
  readFile(new URL("../agent/tutor.js", import.meta.url), "utf8"),
  readFile(new URL("../agent/evaluator.js", import.meta.url), "utf8"),
  readFile(new URL("../../../ios/App/App/Info.plist", import.meta.url), "utf8"),
  readFile(new URL("../../../scripts/build-mobile.mjs", import.meta.url), "utf8")
]);

test("web and iOS ship one font-independent 学程 brand mark", () => {
  assert.doesNotMatch(markSvg, /<text\b|font-family=/i);
  assert.match(markSvg, /data-mark="path-companion"/);
  assert.doesNotMatch(markSvg, /data-mark="cheng"/);
  assert.deepEqual(webIcon, iosIcon);
  assert.match(manifest, /"sizes": "1024x1024"/);
  assert.match(manifest, /"background_color": "#eceeeb"/);
});

test("the visual system uses quiet neutrals with directional accent colors", () => {
  for (const token of ["accent-general", "accent-growth", "accent-wellbeing", "accent-reflection"]) {
    assert.match(css, new RegExp(`--${token}:`));
  }
  assert.match(html, /class="onboarding-visual"/);
  assert.match(html, /assets\/onboarding-morning-v2\.png/);
  assert.match(html, /onboarding-morning-v2\.png[^>]*as="image"/);
  assert.match(html, /onboarding-morning-v2\.png[^>]*fetchpriority="high"/);
  assert.match(refinementCss, /onboarding-visual:before/);
  assert.match(refinementCss, /onboarding-visual figcaption\{[^}]*backdrop-filter:blur\(16px\)/);
  assert.doesNotMatch(css, /--canvas:#11110f|--canvas-soft:#171614/);
  assert.match(js, /day: "#f5f6f3", night: "#202522"/);
  assert.match(html, /name="theme-color" content="#f5f6f3"/);
});

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
  assert.match(js, /完成标准/);
});

test("the primary recommendation reveals detail progressively", () => {
  assert.match(html, /<details class="proposal-details"/);
  assert.match(html, /<summary>查看怎么做和完成标准<\/summary>/);
  assert.match(html, /id="proposal-why"/);
  assert.ok(html.indexOf('id="proposal-why"') < html.indexOf('class="proposal-details"'));
  assert.ok(html.indexOf('id="dynamic-messages"') < html.indexOf('id="agent-proposal"'));
});

test("settings read like a finished product instead of a numbered design spec", () => {
  assert.doesNotMatch(html, /<small>0[1-9]<\/small>/);
  assert.match(html, /id="appearance-title">界面氛围/);
  assert.match(html, /id="model-title">模型与智能/);
});

test("the refined visual system uses forest neutrals and one radius scale", () => {
  for (const token of ["radius-control", "radius-card", "radius-floating"]) {
    assert.match(css, new RegExp(`--${token}:`));
  }
  assert.match(css, /--canvas:#191d1b/);
  assert.match(css, /--canvas-soft:#202522/);
  assert.doesNotMatch(css, /--canvas:#211d1c|--canvas-soft:#282321/);
  assert.match(js, /day: "#f5f6f3", night: "#202522"/);
});

test("visible product copy avoids typographic dash decoration", () => {
  assert.doesNotMatch(html, /[–—]/u);
  assert.doesNotMatch(js, /[–—]/u);
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
  assert.match(css, /--on-action:#f8fbf7/);
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
  assert.match(refinementCss, /\.composer textarea:focus-visible\{outline:0\}/);
  assert.match(refinementCss, /\.composer textarea::-webkit-scrollbar\{display:none\}/);
});

test("the active iPhone interface uses SVG marks instead of emoji or status glyphs", () => {
  assert.match(html, /class="status-icons"[^>]*>[\s\S]*?<svg/);
  assert.match(html, /class="platform-mark"[^>]*>[\s\S]*?ph-television-simple/);
  assert.doesNotMatch(html, /●●●|⌁|▰|>程<|[\p{Extended_Pictographic}]/u);
});

test("functional controls use one local Phosphor icon family", () => {
  assert.match(html, /phosphor-icons\.css/);
  for (const icon of ["ph-plus", "ph-arrow-up", "ph-chat-circle", "ph-calendar-blank", "ph-path", "ph-user-circle", "ph-gear"]) {
    assert.match(html, new RegExp(icon));
  }
  assert.match(buildScript, /phosphor-icons\.css/);
});

test("bottom navigation is a floating rounded control layer over a quiet canvas", () => {
  assert.match(refinementCss, /\.bottom-nav\s*\{[^}]*right:\s*12px[^}]*left:\s*12px[^}]*border-radius:\s*24px/s);
  assert.match(refinementCss, /\.phone::after,[\s\S]*\.plan-proposal::after\s*\{\s*display:\s*none/);
  assert.match(refinementCss, /\.chat-screen\s*\{\s*background:\s*transparent/);
  assert.match(refinementCss, /\.bottom-nav button span\{[^}]*clip-path:inset\(50%\)/s);
});

test("dynamic recommendations do not ship a fixed daily resource or cover", () => {
  assert.doesNotMatch(html, /id="proposal-media"/);
  assert.doesNotMatch(js, /proposalImage|resource\?\.image/);
  for (const source of [planner, tutor, evaluator]) assert.doesNotMatch(source, /农业革命|世界历史速成课|BV1fSr7YoEJ7|build-xuecheng/);
  assert.doesNotMatch(buildScript, /cp\(resolve\(web, "lib"\), resolve\(dist, "lib"\)/);
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
  assert.match(js, /bindDesktopSpaceToTalk/);
  assert.match(js, /event\.code !== "Space"/);
  assert.match(js, /document\.activeElement !== chatInput/);
  assert.match(js, /holdTimer/);
  assert.match(js, /confidence/);
  assert.match(infoPlist, /NSSpeechRecognitionUsageDescription/);
  assert.match(infoPlist, /NSMicrophoneUsageDescription/);
});

test("selected controls use botanical green and the tab bar has restrained depth", () => {
  assert.match(css, /--action:#4f6d5b/);
  assert.match(css, /--action-strong:#365342/);
  assert.match(refinementCss, /\.bottom-nav\{[^}]*background:color-mix\(in srgb,var\(--surface\) 78%,transparent\)/s);
  assert.match(refinementCss, /\.bottom-nav button\.active\{[^}]*background:var\(--action\)/s);
});

test("the shared canvas carries quiet daytime and nighttime atmosphere without extra content", () => {
  assert.match(refinementCss, /Ambient atmosphere: two quiet fields of brand light/);
  assert.match(refinementCss, /\.phone\{[\s\S]*?var\(--accent-growth\)[\s\S]*?var\(--action\)[\s\S]*?linear-gradient\(165deg/s);
  assert.match(refinementCss, /:root\[data-theme="night"\] \.phone\{[\s\S]*?var\(--accent-reflection\)[\s\S]*?var\(--action\)/s);
  assert.match(refinementCss, /\.settings-screen\{background:linear-gradient\(180deg,[^}]*transparent/);
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
