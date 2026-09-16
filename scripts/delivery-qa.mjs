import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createStaticServer } from "./serve.mjs";

const storageKey = "xuecheng:iphone:v2";
let checks = 0;

function verify(condition, message) {
  checks += 1;
  assert.ok(condition, message);
}

function equal(actual, expected, message) {
  checks += 1;
  assert.equal(actual, expected, message);
}

function deeplyEqual(actual, expected, message) {
  checks += 1;
  assert.deepEqual(actual, expected, message);
}

function initialState(overrides = {}) {
  return {
    name: "小程",
    theme: "day",
    role: "guide",
    gender: "female",
    initiative: 0.65,
    directness: 0.55,
    avatar: "./assets/xuecheng-mark.svg",
    messages: [],
    currentConversationModel: "local",
    modelConfig: null,
    cloudConsent: false,
    onboardingComplete: true,
    sources: [],
    calendarEvents: [],
    quietStart: "23:00",
    quietEnd: "07:30",
    urgentOverride: true,
    dailyAtmosphere: null,
    ...overrides,
  };
}

async function listen(server) {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function createMobilePage(browser, state, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true,
    colorScheme: state.theme === "night" ? "dark" : "light",
  });
  const page = await context.newPage();
  const faults = [];
  page.on("pageerror", error => faults.push(error.message));
  await page.addInitScript(({ value, native, voice }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("xuecheng:iphone:v2", JSON.stringify(value));
    if (native) window.Capacitor = { isNativePlatform: () => true };
    if (voice) {
      window.__voiceStarts = 0;
      window.__voiceStops = 0;
      window.SpeechRecognition = class {
        start() { window.__voiceStarts += 1; }
        stop() {
          window.__voiceStops += 1;
          this.onend?.();
        }
      };
    }
  }, { value: state, native: Boolean(options.native), voice: Boolean(options.voice) });
  return { context, page, faults };
}

async function readLayout(page) {
  return page.evaluate(() => {
    const rectangle = element => {
      const { top, right, bottom, left, width, height } = element.getBoundingClientRect();
      return { top, right, bottom, left, width, height };
    };
    const labelFor = element => {
      if (element.getAttribute("aria-label") || element.getAttribute("title")) return true;
      if (element.labels?.length) return [...element.labels].some(label => label.textContent.trim());
      return Boolean(element.textContent.trim() || element.value || element.getAttribute("placeholder"));
    };
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const controls = [...document.querySelectorAll("button, input:not([type=hidden]), select, textarea")]
      .filter(element => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return !element.disabled && style.display !== "none" && style.visibility !== "hidden" && bounds.width > 0 && bounds.height > 0;
      });
    return {
      activeScreen: document.querySelector(".screen.active")?.dataset.screen,
      horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewportWidth,
      phone: rectangle(document.querySelector(".phone")),
      nav: rectangle(document.querySelector(".bottom-nav")),
      viewport: { width: viewportWidth, height: viewportHeight },
      fakeStatusbar: getComputedStyle(document.querySelector(".statusbar")).display,
      unnamedControls: controls.filter(element => !labelFor(element)).map(element => element.id || element.className || element.tagName),
      sidewaysControls: controls.filter(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > viewportWidth + 1;
      }).map(element => element.id || element.className || element.tagName),
    };
  });
}

function assertLayout(report, expectedScreen, label) {
  equal(report.activeScreen, expectedScreen, `${label}: wrong active screen`);
  verify(report.horizontalOverflow <= 1, `${label}: horizontal overflow (${report.horizontalOverflow}px)`);
  verify(report.phone.left >= -1 && report.phone.right <= report.viewport.width + 1, `${label}: app frame is outside the viewport`);
  verify(report.nav.left >= -1 && report.nav.right <= report.viewport.width + 1 && report.nav.bottom <= report.viewport.height + 1, `${label}: tab bar is outside the viewport`);
  equal(report.fakeStatusbar, "none", `${label}: native shell must not draw a second status bar`);
  deeplyEqual(report.unnamedControls, [], `${label}: controls need accessible names`);
  deeplyEqual(report.sidewaysControls, [], `${label}: controls are clipped horizontally`);
}

async function runServerSmoke(origin) {
  const resources = [
    ["/", /text\/html/],
    ["/iphone.css", /text\/css/],
    ["/iphone-refinement.css", /text\/css/],
    ["/iphone.js", /javascript/],
    ["/assets/xuecheng-mark.svg", /image\/svg/],
    ["/assets/onboarding-morning-v2.png", /image\/png/],
    ["/assets/phosphor/regular.woff2", /font\/woff2/],
    ["/manifest.webmanifest", /manifest/],
  ];
  for (const [path, type] of resources) {
    const response = await fetch(`${origin}${path}`);
    equal(response.status, 200, `smoke: ${path} is unavailable`);
    verify(type.test(response.headers.get("content-type") || ""), `smoke: ${path} has the wrong content type`);
  }
  const traversal = await fetch(`${origin}/%2e%2e%2fpackage.json`);
  equal(traversal.status, 403, "smoke: static server must block path traversal");
}

async function runUserJourney(browser, origin) {
  const { context, page, faults } = await createMobilePage(browser, initialState({ onboardingComplete: false }), { native: true, voice: true });
  page.on("dialog", async dialog => {
    if (dialog.type() === "prompt") await dialog.accept("delivery-test-password");
    else await dialog.accept();
  });
  try {
    await page.goto(origin, { waitUntil: "networkidle" });
    await page.locator('[data-onboarding-step="partner"]').waitFor({ state: "visible" });
    for (let step = 0; step < 3; step += 1) await page.locator('[data-onboarding-skip]:visible').click();
    await page.locator("#empty-conversation").waitFor({ state: "visible" });

    await page.locator("#attachment-trigger").click();
    await page.locator("#attachment-dialog").waitFor({ state: "visible" });
    await page.locator('[data-attachment-source="paste"]').click();
    await page.locator("#paste-dialog").waitFor({ state: "visible" });
    await page.locator("#pasted-text").fill("这是一段交付验收用的临时笔记");
    await page.locator("#confirm-paste").click();
    await page.locator("#attachment-preview").waitFor({ state: "visible" });
    verify((await page.locator("#attachment-preview").textContent()).includes("粘贴的文字"), "black-box: pasted attachment was not added");
    await page.locator("[data-remove-attachment]").click();
    await page.locator("#attachment-preview").waitFor({ state: "hidden" });

    const send = async text => {
      await page.locator("#chat-input").fill(text);
      await page.locator("#chat-form").evaluate(form => form.requestSubmit());
    };
    await send("我希望以后能独立做出真正有人用的产品");
    await page.waitForFunction(() => document.querySelector("#dynamic-messages")?.textContent.includes("这个理解准确吗"));
    await send("对，这就是我现在最想走的方向");
    await page.waitForFunction(() => document.querySelector("#dynamic-messages")?.textContent.includes("长期方向记下了"));
    await send("我现在有20分钟，帮我判断下一步");
    await page.locator("#agent-proposal").waitFor({ state: "visible" });
    await page.locator("#discuss-action").click();
    verify(await page.locator("#agent-proposal").evaluate(node => node.classList.contains("discussing")), "black-box: discussion action has no visible state change");
    await page.waitForFunction(() => document.querySelector("#dynamic-messages")?.textContent.includes("先不急着执行"));
    verify((await page.locator("#chat-input").inputValue()).includes("这个安排有些地方不适合我"), "black-box: discussion must give the user an editable starting point");
    await page.locator("#start-action").click();
    await page.waitForFunction(() => document.querySelector("#start-action")?.disabled);
    equal(await page.locator("#start-action").textContent(), "进行中", "black-box: starting a task must change the primary action to its in-progress state");
    equal(await page.locator("[data-start-current]").textContent(), "进行中", "black-box: the today surface must mirror the in-progress task state");
    verify(await page.locator("[data-start-current]").isDisabled(), "black-box: today must not offer a second start action for an active task");
    await page.locator('[data-nav="path"]').click();
    await page.locator("#current-direction").waitFor({ state: "visible" });

    await page.evaluate(() => {
      const trigger = document.createElement("button");
      trigger.dataset.externalUrl = "https://example.com";
      trigger.id = "delivery-external-action";
      document.body.append(trigger);
      trigger.click();
    });
    await page.locator("#external-action-dialog").waitFor({ state: "visible" });
    await page.locator('#external-action-dialog button[value="cancel"]').click();

    await page.locator('[data-nav="today"]').click();
    await page.waitForFunction(() => !document.querySelector("#today-empty")?.hidden || document.querySelectorAll("#today-agenda li").length > 0);
    verify(
      await page.evaluate(() => !document.querySelector("#today-empty")?.hidden || document.querySelectorAll("#today-agenda li").length > 0),
      "black-box: today screen must show either the empty state or the current dynamic recommendation"
    );
    await page.locator('[data-nav="us"]').click();
    await page.locator('details.companion-preferences > summary').click();
    await page.locator('[data-gender="male"]').click();
    verify((await page.locator("#relationship-copy").textContent()).includes("他会"), "black-box: companion presentation did not update");
    await page.locator('[data-open-screen="settings"]').click();
    await page.locator('[data-screen="settings"]').waitFor({ state: "visible" });
    await page.locator('[data-theme-option="night"]').click();
    equal(await page.locator("html").getAttribute("data-theme"), "night", "black-box: night atmosphere was not applied");

    await page.route("https://api.deepseek.com/models", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [{ id: "deepseek-chat" }] }),
    }));
    await page.locator("#provider-select").selectOption("deepseek");
    await page.locator("#settings-cloud-consent").check();
    await page.locator("#api-key").fill("delivery-temporary-key");
    await page.locator("#test-model-connection").click();
    await page.waitForFunction(() => document.querySelector("#model-select")?.value === "deepseek-chat");
    await page.locator("#fetch-models").click();
    await page.waitForFunction(() => document.querySelector("#model-select")?.value === "deepseek-chat");
    await page.locator("#save-model-config").click();
    verify((await page.locator("#model-summary").textContent()).includes("deepseek-chat"), "black-box: configured model was not saved");
    equal(await page.evaluate(() => localStorage.getItem("xuecheng:iphone:v2")?.includes("delivery-temporary-key") || false), false, "security: API Key must not enter persistent local storage");
    await page.locator('[data-nav="chat"]').click();
    await page.locator("#conversation-model").click();
    await page.locator("#model-dialog").waitFor({ state: "visible" });
    verify((await page.locator("#conversation-model-options").textContent()).includes("deepseek-chat"), "black-box: current-chat model picker omits the configured model");
    await page.locator('[data-conversation-model="local"]').click();
    await page.locator("#model-dialog").waitFor({ state: "hidden" });
    verify((await page.locator("#conversation-model").textContent()).includes("本地"), "black-box: current-chat model selection did not apply locally");
    await page.locator("#conversation-model").click();
    await page.locator("#manage-models").click();
    await page.locator('[data-screen="settings"]').waitFor({ state: "visible" });

    await page.locator("#calendar-file").setInputFiles({
      name: "today.ics",
      mimeType: "text/calendar",
      buffer: Buffer.from("BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260911T180000\nSUMMARY:学校拍摄\nEND:VEVENT\nEND:VCALENDAR"),
    });
    await page.waitForFunction(() => document.querySelector("#calendar-summary")?.textContent.includes("1 项"));

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#export-backup").click();
    const download = await downloadPromise;
    const backupStream = await download.createReadStream();
    let backup = "";
    for await (const chunk of backupStream) backup += chunk.toString();
    const envelope = JSON.parse(backup);
    equal(envelope.format, "xuecheng-local-backup", "black-box: exported backup has the wrong envelope");
    equal(envelope.version, 1, "black-box: exported backup has the wrong version");
    await page.locator("#backup-file").setInputFiles({ name: "delivery-backup.json", mimeType: "application/json", buffer: Buffer.from(backup) });
    await page.waitForFunction(() => document.querySelector("#app-toast")?.textContent.includes("本地记忆已经恢复"));

    await page.locator('[data-nav="chat"]').click();
    const input = page.locator("#chat-input");
    await input.focus();
    await page.keyboard.down("Space");
    await page.waitForTimeout(80);
    await page.keyboard.up("Space");
    verify((await input.inputValue()).includes(" "), "black-box: a short Space press must keep its typing behavior");
    await page.keyboard.down("Space");
    await page.waitForTimeout(420);
    await page.keyboard.up("Space");
    equal(await page.evaluate(() => window.__voiceStarts), 1, "black-box: long Space press did not start voice input");
    equal(await page.evaluate(() => window.__voiceStops), 1, "black-box: long Space press did not stop voice input");
    verify(faults.length === 0, `black-box: runtime errors: ${faults.join(" | ")}`);
  } finally {
    await context.close();
  }
}

async function runLayoutSweep(browser, origin) {
  const devices = [
    { name: "iPhone narrow", viewport: { width: 320, height: 568 } },
    { name: "iPhone 11/13 mini", viewport: { width: 375, height: 812 } },
    { name: "iPhone 14", viewport: { width: 390, height: 844 } },
    { name: "iPhone 15", viewport: { width: 393, height: 852 } },
    { name: "iPhone Plus", viewport: { width: 430, height: 932 } },
  ];
  const screens = ["chat", "today", "path", "us", "settings"];
  const themes = ["day", "night"];
  for (const device of devices) {
    for (const theme of themes) {
      for (const screen of screens) {
        const { context, page, faults } = await createMobilePage(browser, initialState({ theme }), { native: true, viewport: device.viewport });
        try {
          await page.goto(`${origin}/?screen=${screen}`, { waitUntil: "networkidle" });
          await page.locator(`.screen[data-screen="${screen}"]`).waitFor({ state: "visible" });
          assertLayout(await readLayout(page), screen, `${device.name}/${theme}/${screen}`);
          verify(faults.length === 0, `${device.name}/${theme}/${screen}: runtime errors: ${faults.join(" | ")}`);
        } finally {
          await context.close();
        }
      }
    }
  }
}

async function runNativeKeyboardCase(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const faults = [];
  page.on("pageerror", error => faults.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("xuecheng:iphone:v2", JSON.stringify({ onboardingComplete: true }));
    window.Capacitor = { isNativePlatform: () => true };
    window.__deliveryLayoutHeight = 852;
    const viewport = { height: 852, addEventListener() {}, removeEventListener() {} };
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    Object.defineProperty(window, "innerHeight", { configurable: true, get: () => window.__deliveryLayoutHeight });
    window.__setDeliveryViewport = height => {
      window.__deliveryLayoutHeight = height;
      viewport.height = height;
      window.dispatchEvent(new Event("resize"));
    };
  });
  const state = () => page.evaluate(() => ({
    appHeight: getComputedStyle(document.documentElement).getPropertyValue("--app-height").trim(),
    keyboardInset: getComputedStyle(document.documentElement).getPropertyValue("--keyboard-inset").trim(),
    keyboardOpen: document.body.classList.contains("keyboard-open"),
    fakeStatusbar: getComputedStyle(document.querySelector(".statusbar")).display,
    navOpacity: Number(getComputedStyle(document.querySelector(".bottom-nav")).opacity),
    composerBottom: document.querySelector(".composer").getBoundingClientRect().bottom,
  }));
  try {
    await page.goto(`${origin}/?screen=settings`, { waitUntil: "networkidle" });
    const initial = await state();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("xuecheng:native-keyboard", { detail: { visible: true, inset: 336 } })));
    await page.waitForFunction(() => {
      const inset = getComputedStyle(document.documentElement).getPropertyValue("--keyboard-inset").trim();
      const navOpacity = Number(getComputedStyle(document.querySelector(".bottom-nav")).opacity);
      return document.body.classList.contains("keyboard-open") && inset === "336px" && navOpacity < 0.01;
    });
    const nativeOverlay = await state();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("xuecheng:native-keyboard", { detail: { visible: false, inset: 0 } })));
    await page.waitForFunction(() => !document.body.classList.contains("keyboard-open") && Number(getComputedStyle(document.querySelector(".bottom-nav")).opacity) > 0.99);
    const afterNativeOverlay = await state();
    await page.evaluate(() => window.__setDeliveryViewport(486));
    await page.waitForTimeout(300);
    const beforeFocus = await state();
    await page.locator("#api-key").focus();
    await page.waitForTimeout(300);
    const focused = await state();
    await page.evaluate(() => { document.activeElement.blur(); window.__setDeliveryViewport(852); });
    await page.waitForTimeout(300);
    const recovered = await state();
    equal(initial.fakeStatusbar, "none", "native keyboard: fake status bar must stay hidden");
    equal(initial.appHeight, "852px", "native keyboard: initial app height is wrong");
    verify(nativeOverlay.keyboardOpen && nativeOverlay.appHeight === "852px" && nativeOverlay.keyboardInset === "336px" && nativeOverlay.navOpacity < 0.01 && nativeOverlay.composerBottom <= 518, "native keyboard: a real native overlay must hide navigation and lift the composer above the keyboard");
    verify(!afterNativeOverlay.keyboardOpen && afterNativeOverlay.keyboardInset === "0px" && afterNativeOverlay.navOpacity > 0.99, "native keyboard: closing an overlay keyboard must restore the normal shell");
    verify(beforeFocus.keyboardOpen && beforeFocus.appHeight === "486px" && beforeFocus.navOpacity < 0.01, "native keyboard: resize-before-focus must hide the tab bar");
    verify(focused.keyboardOpen && focused.navOpacity < 0.01, "native keyboard: focused field must keep the tab bar hidden");
    verify(!recovered.keyboardOpen && recovered.appHeight === "852px" && recovered.navOpacity > 0.99, "native keyboard: page must recover after the keyboard closes");
    verify(faults.length === 0, `native keyboard: runtime errors: ${faults.join(" | ")}`);
  } finally {
    await context.close();
  }
}

async function runModalKeyboardCase(browser, origin) {
  const { context, page, faults } = await createMobilePage(browser, initialState(), { native: true, viewport: { width: 393, height: 852 } });
  const readSurfaces = () => page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const { top, right, bottom, left, width, height } = element.getBoundingClientRect();
      return { top, right, bottom, left, width, height };
    };
    return {
      viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
      horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
      visibleHeight: getComputedStyle(document.documentElement).getPropertyValue("--visible-viewport-height").trim(),
      dialog: rect("#paste-dialog"),
      focused: rect("#pasted-text"),
      conversation: rect("#conversation"),
      composer: rect(".composer"),
    };
  });
  try {
    await page.goto(`${origin}/?screen=chat`, { waitUntil: "networkidle" });
    await page.locator("#attachment-trigger").click();
    await page.locator('[data-attachment-source="paste"]').click();
    await page.locator("#paste-dialog").waitFor({ state: "visible" });
    await page.locator("#pasted-text").focus();
    const before = await readSurfaces();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("xuecheng:native-keyboard", { detail: { visible: true, inset: 336 } })));
    await page.waitForFunction(() => document.body.classList.contains("keyboard-open") && getComputedStyle(document.documentElement).getPropertyValue("--visible-viewport-height").trim() === "516px");
    const during = await readSurfaces();
    verify(before.dialog && before.focused, "modal keyboard: paste dialog and field must open before keyboard simulation");
    verify(during.visibleHeight === "516px", "modal keyboard: visible viewport height must subtract the native keyboard inset");
    verify(during.dialog.top >= -1 && during.dialog.bottom <= 517, "modal keyboard: dialog must stay inside the visible viewport");
    verify(during.focused.top >= -1 && during.focused.bottom <= 517, "modal keyboard: focused field must stay visible above the keyboard");
    verify(during.conversation.bottom <= 517 && during.composer.bottom <= 517, "modal keyboard: chat surface and composer must end above the keyboard");
    verify(during.horizontalOverflow <= 1, "modal keyboard: keyboard mode must not introduce horizontal overflow");
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("xuecheng:native-keyboard", { detail: { visible: false, inset: 0 } })));
    await page.waitForFunction(() => !document.body.classList.contains("keyboard-open") && getComputedStyle(document.documentElement).getPropertyValue("--visible-viewport-height").trim() === "852px");
    const after = await readSurfaces();
    verify(after.dialog.bottom > 517 && after.dialog.bottom <= 853, "modal keyboard: dialog must restore after the keyboard closes");
    verify(after.composer.bottom > 517 && after.conversation.bottom <= 853, "modal keyboard: chat surfaces must restore after the keyboard closes");
    await page.locator('#paste-dialog button[value="cancel"]').click();
    verify(faults.length === 0, `modal keyboard: runtime errors: ${faults.join(" | ")}`);
  } finally {
    await context.close();
  }
}

async function runConversationStateCase(browser, origin) {
  const fresh = await createMobilePage(browser, initialState(), { native: true, viewport: { width: 393, height: 852 } });
  try {
    await fresh.page.goto(`${origin}/?screen=chat`, { waitUntil: "networkidle" });
    const empty = await fresh.page.evaluate(() => ({
      status: document.querySelector("#conversation")?.dataset.conversationState,
      emptyHidden: document.querySelector("#empty-conversation")?.hidden,
      messages: document.querySelector("#dynamic-messages")?.textContent || "",
    }));
    equal(empty.status, "idle_empty", "conversation state: a fresh install must start empty");
    equal(empty.emptyHidden, false, "conversation state: the fresh welcome must be visible");
    verify(!empty.messages.includes("刚才"), "conversation state: an empty conversation must not imply prior user speech");
    await fresh.page.locator("#chat-input").fill("我想聊聊今天的状态");
    await fresh.page.locator("#chat-form").evaluate(form => form.requestSubmit());
    await fresh.page.waitForFunction(() => document.querySelector("#conversation")?.dataset.conversationState === "conversation_active");
    verify(await fresh.page.locator("#dynamic-messages .message").count() >= 2, "conversation state: a sent message must produce an active exchange");
    verify(fresh.faults.length === 0, `conversation state: fresh flow runtime errors: ${fresh.faults.join(" | ")}`);
  } finally {
    await fresh.context.close();
  }

  const restored = await createMobilePage(browser, initialState({
    messages: [{ role: "assistant", text: "上一轮留下的真实记录", kind: "conversation", createdAt: "2026-09-16T08:00:00.000Z" }],
  }), { native: true, viewport: { width: 393, height: 852 } });
  try {
    await restored.page.goto(`${origin}/?screen=chat`, { waitUntil: "networkidle" });
    const history = await restored.page.evaluate(() => ({
      status: document.querySelector("#conversation")?.dataset.conversationState,
      emptyHidden: document.querySelector("#empty-conversation")?.hidden,
      text: document.querySelector("#dynamic-messages")?.textContent || "",
    }));
    equal(history.status, "conversation_restored", "conversation state: stored history must be marked as restored");
    equal(history.emptyHidden, true, "conversation state: restored history must hide the empty welcome");
    verify(history.text.includes("上一轮留下的真实记录"), "conversation state: restored history must remain visible");
    verify(!history.text.includes("正在整理你的想法"), "conversation state: restored history must not show a generating placeholder");
    verify(restored.faults.length === 0, `conversation state: restored flow runtime errors: ${restored.faults.join(" | ")}`);
  } finally {
    await restored.context.close();
  }

  let releaseRequest;
  let releaseCloud;
  const cloud = await createMobilePage(browser, initialState({
    cloudConsent: true,
    currentConversationModel: "gpt-delivery-test",
    modelConfig: { providerId: "openai", endpoint: "https://api.openai.com/v1", model: "gpt-delivery-test" },
  }), { native: true, viewport: { width: 393, height: 852 } });
  try {
    await cloud.page.route("**/chat/completions", async route => {
      releaseRequest = true;
      await new Promise(resolve => { releaseCloud = resolve; });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: "云端回复已返回" } }] }) });
    });
    await cloud.page.goto(`${origin}/?screen=chat`, { waitUntil: "networkidle" });
    await cloud.page.locator("#chat-input").fill("请暂时停在生成状态");
    await cloud.page.locator("#chat-form").evaluate(form => form.requestSubmit());
    await cloud.page.waitForFunction(() => document.querySelector("#conversation")?.dataset.conversationState === "generating" && document.querySelector("#dynamic-messages .work-state"));
    verify(releaseRequest === true, "conversation state: cloud request must enter the generating state");
    verify((await cloud.page.locator("#dynamic-messages .work-state").textContent()).includes("正在整理你的想法"), "conversation state: generating copy must describe the current send");
    releaseCloud?.();
    await cloud.page.waitForFunction(() => document.querySelector("#conversation")?.dataset.conversationState === "conversation_active");
    verify(cloud.faults.length === 0, `conversation state: generating flow runtime errors: ${cloud.faults.join(" | ")}`);
  } finally {
    releaseCloud?.();
    await cloud.context.close();
  }
}

const server = createStaticServer();
const origin = await listen(server);
let browser;
try {
  await runServerSmoke(origin);
  browser = await chromium.launch({ headless: true });
  await runUserJourney(browser, origin);
  await runLayoutSweep(browser, origin);
  await runNativeKeyboardCase(browser, origin);
  await runModalKeyboardCase(browser, origin);
  await runConversationStateCase(browser, origin);
  console.log(`delivery QA passed: ${checks} assertions across smoke, black-box, responsive, native keyboard, modal keyboard, conversation state, backup, and BYOK flows`);
} finally {
  await browser?.close();
  await close(server);
}
