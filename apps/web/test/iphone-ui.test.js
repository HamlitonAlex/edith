import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";

const [html, css, refinementCss, js, markSvg, webIcon, iosIcon, manifest, planner, tutor, evaluator, infoPlist, buildScript, projectFile] = await Promise.all([
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
  readFile(new URL("../../../scripts/build-mobile.mjs", import.meta.url), "utf8"),
  readFile(new URL("../../../ios/App/App.xcodeproj/project.pbxproj", import.meta.url), "utf8")
]);

test("web and iOS ship one font-independent 学程 brand mark", () => {
  assert.doesNotMatch(markSvg, /<text\b|font-family=/i);
  assert.match(markSvg, /data-mark="path-companion"/);
  assert.doesNotMatch(markSvg, /data-mark="cheng"/);
  assert.deepEqual(webIcon, iosIcon);
  assert.match(manifest, /"sizes": "1024x1024"/);
  assert.match(manifest, /"background_color": "#eceeeb"/);
});

test("the V3.1 visual system uses a quiet morning palette with restrained directional accents", () => {
  for (const token of ["accent-general", "accent-growth", "accent-wellbeing", "accent-reflection"]) {
    assert.match(css, new RegExp(`--${token}:`));
  }
  assert.match(html, /class="onboarding-visual"/);
  assert.match(html, /assets\/brand\/xuecheng-launch-mist\.png/);
  assert.match(html, /xuecheng-launch-mist\.png[^>]*as="image"/);
  assert.match(html, /xuecheng-launch-mist\.png[^>]*fetchpriority="high"/);
  assert.match(refinementCss, /学程 V3\.1/);
  assert.match(refinementCss, /\.onboarding-visual\s*>\s*img\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /--canvas:#11110f|--canvas-soft:#171614/);
  assert.match(refinementCss, /--xc-green:\s*#304b3d/);
  assert.match(refinementCss, /--xc-green-soft:\s*#6f8c7d/);
  assert.match(refinementCss, /--xc-orange:\s*#c88d77/);
  assert.match(js, /day: "#fcfcfb", night: "#1f2a25"/);
  assert.match(html, /name="theme-color" content="#fcfcfb"/);
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
  assert.match(html, /<summary>为什么<\/summary>/);
  assert.match(html, /id="proposal-why"/);
  assert.match(html, /id="proposal-observation"/);
  assert.match(html, /id="proposal-alternatives"/);
  assert.ok(html.indexOf('id="proposal-why"') < html.indexOf('class="proposal-details"'));
  assert.ok(html.indexOf('id="dynamic-messages"') < html.indexOf('id="agent-proposal"'));
});

test("settings read like a finished product instead of a numbered design spec", () => {
  assert.doesNotMatch(html, /<small>0[1-9]<\/small>/);
  assert.match(html, /id="appearance-title">界面氛围/);
  assert.match(html, /id="model-title">模型与智能/);
});

test("the refined visual system uses morning neutrals and one radius scale", () => {
  for (const token of ["radius-control", "radius-card", "radius-floating"]) {
    assert.match(css, new RegExp(`--${token}:`));
  }
  assert.match(refinementCss, /--xc-bg:\s*#fcfcfb/);
  assert.match(refinementCss, /--xc-mist:\s*#f4f6f3/);
  assert.doesNotMatch(css, /--canvas:#191d1b/);
  assert.match(js, /day: "#fcfcfb", night: "#1f2a25"/);
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
  assert.match(css, /--on-action:#fdfcf8/);
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
  assert.match(refinementCss, /\.composer textarea:focus-visible\s*\{\s*outline:\s*0/);
  assert.match(refinementCss, /\.composer textarea::-webkit-scrollbar\s*\{\s*display:\s*none/);
});

test("model configuration controls avoid iOS focus zoom", () => {
  assert.match(refinementCss, /\.settings-screen \.model-field input[\s\S]*font-size:\s*16px/);
});

test("the native shell uses the real iOS status bar and keeps the focused control in view", () => {
  assert.match(js, /native-shell/);
  assert.match(css, /:root\.native-shell \.statusbar\{display:none\}/);
  assert.match(css, /:root\.native-shell \.screen\{padding-top:calc\(14px \+ env\(safe-area-inset-top\)\)\}/);
  assert.match(js, /function keepFocusedControlVisible\(\)/);
  assert.doesNotMatch(js, /chatInput\.scrollIntoView/);
  assert.doesNotMatch(js, /window\.scrollTo\(0, 0\)/);
});

test("the iOS wrapper explicitly marks the native shell and reports keyboard overlap", () => {
  const nativeBootstrap = new URL("../native-bootstrap.js", import.meta.url);
  const nativeController = new URL("../../../ios/App/App/XuechengBridgeViewController.swift", import.meta.url);
  assert.ok(existsSync(nativeBootstrap));
  assert.ok(existsSync(nativeController));
  assert.match(buildScript, /native-bootstrap\.js/);
  assert.match(js, /__XUECHENG_NATIVE_SHELL__/);
  const controller = readFileSync(nativeController, "utf8");
  assert.match(controller, /WKUserScript/);
  assert.match(controller, /atDocumentStart/);
  assert.doesNotMatch(controller, /injectScriptBeforeLoad/);
  assert.match(controller, /UIResponder\.keyboardWillChangeFrameNotification/);
  assert.match(controller, /xuecheng:native-keyboard/);
  assert.match(projectFile, /XuechengBridgeViewController\.swift in Sources/);
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
  assert.match(refinementCss, /\.bottom-nav\s*\{[\s\S]*right:\s*12px[\s\S]*left:\s*12px[\s\S]*border-radius:\s*27px/s);
  assert.match(refinementCss, /\.phone::after,[\s\S]*\.plan-proposal::after\s*\{\s*display:\s*none/);
  assert.match(refinementCss, /\.chat-screen\s*\{[\s\S]*background:/);
  assert.match(refinementCss, /\.bottom-nav button\s*\{[\s\S]*min-height:\s*54px/s);
});

test("dynamic recommendations keep content covers optional while atmosphere stays generic", () => {
  assert.match(html, /class="proposal-atmosphere"[^>]*id="proposal-atmosphere"/);
  assert.match(html, /xuecheng-morning-mist-vector\.svg/);
  assert.match(html, /id="proposal-media"[^>]*hidden/);
  assert.match(html, /id="proposal-media-image"[^>]*referrerpolicy="no-referrer"/);
  assert.doesNotMatch(html, /id="proposal-media-image"[^>]*src=/);
  assert.match(js, /safeImageUrl/);
  assert.match(js, /action\.resource\?\.image_url/);
  for (const source of [planner, tutor, evaluator]) assert.doesNotMatch(source, /农业革命|世界历史速成课|BV1fSr7YoEJ7|build-xuecheng/);
  assert.doesNotMatch(buildScript, /cp\(resolve\(web, "lib"\), resolve\(dist, "lib"\)/);
});

test("the recommendation opens as atmosphere and settles after starting", () => {
  assert.match(js, /classList\.toggle\("started", action\?\.status === "accepted"\)/);
  assert.match(refinementCss, /\.plan-proposal\s*\{[\s\S]*border:\s*1px[\s\S]*background:/);
  assert.match(refinementCss, /\.proposal-atmosphere\s*\{[\s\S]*height:\s*72px/);
  assert.match(refinementCss, /\.plan-actions #start-action\s*\{[\s\S]*background:\s*var\(--xc-green\)/);
});

test("warm themes stay muted and the main proposal presents one primary decision", () => {
  assert.doesNotMatch(css, /--canvas:#e1b4bc|--canvas:#c8b8d3|--action:#a63755|--action:#744c85/);
  assert.match(html, /id="start-action"/);
  assert.match(html, /id="discuss-action"/);
  assert.doesNotMatch(html, /id="adopt-plan"|接受这个安排/);
  assert.match(refinementCss, /\.plan-actions\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(0,\s*1fr\) auto/s);
  assert.match(refinementCss, /button:focus-visible/);
});

test("the next-step layer speaks like a judgment and gives three human exits", () => {
  assert.match(html, /我觉得现在值得做/);
  assert.match(html, /id="start-action"[^>]*>就这样做/);
  assert.match(html, /id="discuss-action"[^>]*>和她聊聊/);
  assert.match(html, /id="change-action"[^>]*>换个方向/);
  assert.match(js, /change-action/);
  assert.doesNotMatch(html, /今天的任务/);
});

test("the us page surfaces the companion's understanding before configuration", () => {
  assert.match(html, /她现在知道的我/);
  assert.match(html, /id="understanding-list"/);
  assert.match(html, /这里有理解错的吗？/);
  assert.match(js, /function renderUnderstanding\(\)/);
});

test("an accepted next step clearly becomes an in-progress state everywhere it appears", () => {
  assert.match(js, /const started = action\?\.status === "accepted"/);
  assert.match(js, /started \? "进行中" : "开始学习"/);
  assert.match(js, /data-start-current \$\{started \? "disabled" : ""\}/);
  assert.match(js, /start\.textContent = started \? "进行中"/);
  assert.match(js, /#home-next-card \[data-start-current\]/);
  assert.match(refinementCss, /\.plan-actions #start-action/);
  assert.match(refinementCss, /\.agenda li\.next/);
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
  assert.match(js, /name === "settings" \? "us" : name === "path" \? "home" : name/);
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

test("iOS voice input uses a real native Speech framework bridge", () => {
  const controller = readFileSync(new URL("../../../ios/App/App/XuechengBridgeViewController.swift", import.meta.url), "utf8");

  assert.match(controller, /import Speech/);
  assert.match(controller, /import AVFoundation/);
  assert.match(controller, /SFSpeechRecognizer/);
  assert.match(controller, /AVAudioEngine/);
  assert.match(controller, /xuechengSpeech/);
  assert.match(controller, /requiresOnDeviceRecognition/);
  assert.match(controller, /xuecheng:speech/);
  assert.match(js, /window\.webkit\?\.messageHandlers\?\.xuechengSpeech/);
  assert.match(js, /data-voice-state/);
  assert.doesNotMatch(js, /confidence\s*>=\s*\.72\)\s*surface\.requestSubmit/);
});

test("short greetings stay local and assistant markdown is rendered safely", () => {
  assert.match(js, /function isSimpleGreeting/);
  assert.match(js, /&& !simpleGreeting/);
  assert.match(js, /function formatMessageHtml/);
  assert.match(js, /<strong>\$1<\/strong>/);
  assert.match(js, /formatMessageHtml\(message\.text\)/);
});

test("selected controls use forest green and the tab bar has restrained depth", () => {
  assert.match(refinementCss, /--xc-green:\s*#304b3d/);
  assert.match(refinementCss, /--xc-glass:\s*rgba\(255, 255, 255, \.72\)/);
  assert.match(refinementCss, /\.bottom-nav\s*\{[\s\S]*background:\s*rgba\(255, 255, 255, \.76\)/s);
  assert.match(refinementCss, /\.bottom-nav button\.active\s*\{[\s\S]*background:\s*rgba\(48, 75, 61, \.12\)/s);
});

test("the chosen production direction leads with morning mist and editorial clarity", () => {
  assert.match(refinementCss, /reference-aligned surface/);
  assert.match(refinementCss, /--xc-bg:\s*#fcfcfb/);
  assert.match(refinementCss, /--xc-green:\s*#304b3d/);
  assert.match(refinementCss, /--radius-card:\s*24px/);
  assert.match(refinementCss, /\.plan-proposal\s*\{[\s\S]*background:/);
  assert.match(refinementCss, /\.chat-atmosphere\s*\{[\s\S]*display:\s*block/);
  assert.match(refinementCss, /\.bottom-nav\s*\{[\s\S]*border-radius:\s*27px/);
});

test("the V3.1 home is the active work surface and chat stays abstract", () => {
  assert.match(html, /class="screen active home-screen" id="home-screen"/);
  assert.match(html, /class="screen chat-screen" id="chat-screen" data-screen="chat" hidden/);
  assert.match(html, /id="home-next-card"/);
  assert.match(html, /id="home-schedule-content"/);
  assert.match(html, /class="home-path-summary"[^>]*data-open-screen="path"/);
  assert.match(html, /class="chat-atmosphere"[^>]*aria-hidden="true"/);
  assert.match(html, /class="chat-atmosphere"[^>]*aria-hidden="true">\s*<\/div>/);
  assert.match(js, /classList\.toggle\("has-proposal", Boolean\(action\)\)/);
  assert.match(refinementCss, /\.chat-atmosphere img/);
});

test("V3.1 keeps four primary tabs, a unified composer, and bounded voice feedback", () => {
  assert.match(html, /data-nav="home"/);
  assert.match(html, /data-nav="chat"/);
  assert.match(html, /data-nav="today"/);
  assert.match(html, /data-nav="us"/);
  assert.equal((html.match(/data-nav="/g) || []).length, 4);
  assert.match(html, /class="voice-gesture"/);
  assert.match(refinementCss, /\.composer\s*\{[\s\S]*grid-template-columns:\s*40px minmax\(0, 1fr\) 40px/s);
  assert.match(refinementCss, /\.composer\[data-voice-state="recording"\] \.voice-gesture/);
  assert.match(js, /event\.clientY >= startY - 54/);
});

test("the production surfaces place the three supplied mist images only in their intended roles", () => {
  assert.match(html, /class="onboarding-visual"[\s\S]*?xuecheng-launch-mist\.png/);
  assert.match(html, /class="proposal-atmosphere"[\s\S]*?xuecheng-task-mist\.png/);
  assert.match(refinementCss, /\.onboarding\s*\{[\s\S]*xuecheng-launch-mist\.png/);
  assert.match(refinementCss, /home-next-card::after[\s\S]*xuecheng-task-mist\.png/);
  assert.match(refinementCss, /\.plan-proposal::before[\s\S]*xuecheng-task-mist\.png/);
  assert.match(refinementCss, /\.composer\[data-voice-state="recording"\] \.voice-gesture[\s\S]*xuecheng-voice-mist\.png/);
  assert.doesNotMatch(html, /assets\/brand-mist\.svg/);
  assert.doesNotMatch(js, /assets\/brand-mist\.svg/);
  assert.match(refinementCss, /\.chat-atmosphere img[\s\S]*display: none !important/);
  assert.match(refinementCss, /\.proposal-atmosphere img[\s\S]*display: block !important/);
  assert.match(js, /event\.target\.closest\("button,input,textarea,select,a"\)/);
  assert.match(js, /if \(chatInput\.value\.trim\(\) \|\| pendingAttachments\.length\) return/);
  assert.match(js, /surface\.addEventListener\("pointermove"/);
  assert.match(js, /if \(holding \|\| voiceController\.isListening\(\)\) voiceController\.cancel\(\)/);
  assert.doesNotMatch(refinementCss, /voice-volume/);
});

test("the supplied mist images are packaged as local PNG assets", () => {
  for (const asset of ["xuecheng-launch-mist.png", "xuecheng-task-mist.png", "xuecheng-voice-mist.png"]) {
    const path = new URL(`../assets/brand/${asset}`, import.meta.url);
    assert.equal(existsSync(path), true);
    const source = readFileSync(path);
    assert.equal(source.subarray(1, 4).toString(), "PNG");
    assert.ok(source.length > 1_000_000);
  }
});

test("secondary screens share one hierarchy grammar while keeping their own density", () => {
  assert.match(refinementCss, /Today, path and settings use the same cards/);
  assert.match(refinementCss, /\.page-header\s*\{[\s\S]*padding:/);
  assert.match(refinementCss, /\.agenda li\s*\{/);
  assert.match(refinementCss, /\.settings-section\s*\{[\s\S]*background:/);
  assert.match(refinementCss, /\.model-field input,[\s\S]*\.model-field select/);
  assert.match(refinementCss, /\.talk-about-path/);
});

test("companion and settings pages preserve safe-area content boundaries", () => {
  assert.match(html, /class="profile-atmosphere"[^>]*aria-hidden="true"/);
  assert.match(html, /class="settings-atmosphere"[^>]*aria-hidden="true"/);
  assert.match(refinementCss, /\.us-screen,[\s\S]*\.settings-screen\s*\{[\s\S]*padding-right:\s*20px[\s\S]*padding-left:\s*20px/);
  assert.match(refinementCss, /\.profile-atmosphere\s*\{[\s\S]*display:\s*none/);
  assert.match(refinementCss, /\.settings-header\s*\{[\s\S]*padding-top:/);
  assert.match(refinementCss, /\.settings-section\s*\{[\s\S]*border-radius:\s*22px/);
  assert.match(refinementCss, /native-shell \.settings-screen\s*\{\s*padding-top:\s*0/);
});

test("the conversation model stays understandable without becoming a large selector", () => {
  assert.match(js, /selectedModelLabel = state\.currentConversationModel === "local" \? "本地"/);
  assert.match(js, /class="model-status-dot"/);
  assert.match(refinementCss, /\.conversation-model\s*\{/);
  assert.match(refinementCss, /#model-dialog\s*\{[\s\S]*max-height:/);
  assert.match(refinementCss, /#model-dialog form\s*\{/);
});

test("today and path screens use abstract surfaces without photo backgrounds", () => {
  assert.match(refinementCss, /\.agenda-atmosphere/);
  assert.match(refinementCss, /\.direction-atmosphere/);
  assert.match(refinementCss, /\.agenda li\.next\s*\{[\s\S]*border-radius:\s*22px/);
  assert.match(refinementCss, /\.current-direction\s*\{[\s\S]*border-radius:\s*22px/);
});

test("the current mobile release fixes full bleed and stays portrait-first", () => {
  assert.match(html, /学程 1\.0\.2 · 本地个人版/);
  assert.match(refinementCss, /@media \(max-width: 600px\)/);
  assert.match(refinementCss, /\.phone\s*\{[\s\S]*width:\s*100%/);
  assert.match(refinementCss, /\.bottom-nav\s*\{/);
  const phoneOrientations = infoPlist.match(/<key>UISupportedInterfaceOrientations<\/key>[\s\S]*?<\/array>/)?.[0] || "";
  assert.match(phoneOrientations, /UIInterfaceOrientationPortrait/);
  assert.doesNotMatch(phoneOrientations, /Landscape/);
});

test("selected decision layers use CSS atmosphere without making every surface a card", () => {
  assert.match(js, /safeImageUrl\(action\.resource\?\.image_url\)/);
  assert.match(refinementCss, /\.phone\s*\{[\s\S]*radial-gradient/s);
  assert.match(refinementCss, /\.chat-atmosphere img/);
  assert.match(refinementCss, /\.direction-atmosphere/);
  assert.match(refinementCss, /backdrop-filter:\s*blur/);
});

test("the shared canvas stays white-led with restrained daytime and nighttime atmosphere", () => {
  assert.match(refinementCss, /radial-gradient\(ellipse 52% 24%/);
  assert.match(refinementCss, /linear-gradient\(145deg, var\(--xc-bg\)/s);
  assert.match(refinementCss, /:root\[data-theme="night"\]/);
  assert.match(refinementCss, /\.settings-screen\s*\{/);
});

test("the next-step card uses a branded route and a single dominant action", () => {
  assert.match(html, /class="proposal-route"[^>]*aria-hidden="true"/);
  assert.match(html, /class="route-now"/);
  assert.match(refinementCss, /\.plan-actions #start-action\s*\{[\s\S]*background:\s*var\(--xc-green\)/s);
  assert.match(refinementCss, /\.plan-actions\s*\{[\s\S]*grid-template-columns:/s);
  assert.match(refinementCss, /\.bottom-nav button\.active\s*\{/s);
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
