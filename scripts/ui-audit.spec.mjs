import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, colorScheme: "light", launchOptions: { channel: "msedge" } });

async function enterFirstRunOnboarding(page) {
  await page.goto("http://127.0.0.1:4173/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Splash is its own short-lived state; it must not be a hidden first slide of onboarding.
  await expect(page.locator("#splash")).toBeVisible();
  await expect(page.locator("#onboarding")).toBeHidden();
  await expect(page.locator("#splash")).toBeHidden();
  await expect(page.locator('[data-onboarding-step="partner"]')).toBeVisible();
}

async function waitForActiveScreen(page, name) {
  const screen = page.locator(`[data-screen="${name}"]`);
  await expect(screen).toBeVisible();
  await page.waitForFunction(screenName => {
    const candidate = document.querySelector(`[data-screen="${screenName}"]`);
    return candidate?.classList.contains("active")
      && !candidate.hidden
      && Number.parseFloat(getComputedStyle(candidate).opacity) > .99;
  }, name);
}

async function openTab(page, name) {
  await page.locator(`[data-nav="${name}"]`).click();
  await waitForActiveScreen(page, name);
}

test("all visible controls have a real response", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await enterFirstRunOnboarding(page);
  await page.locator('[data-onboarding-next]:visible').click();
  await expect(page.locator('[data-onboarding-step="relationship"]')).toBeVisible();
  await page.locator('[data-onboarding-role="guide"]').click();
  await page.locator('[data-onboarding-next]:visible').click();
  await expect(page.locator('[data-onboarding-step="boundary"]')).toBeVisible();
  await page.locator('[data-onboarding-finish]').click();
  await expect(page.locator("#splash")).toBeHidden();
  await expect(page.locator("#onboarding")).toBeHidden();
  await waitForActiveScreen(page, "home");
  await openTab(page, "chat");
  await expect(page.locator("#empty-conversation")).toBeVisible();
  await expect(page.locator("#agent-proposal")).toBeHidden();
  await page.locator("#attachment-trigger").click();
  await expect(page.locator("#attachment-dialog")).toBeVisible();
  await page.locator('[data-attachment-source="paste"]').click();
  await expect(page.locator("#paste-dialog")).toBeVisible();
  await page.locator("#pasted-text").fill("这是一段临时笔记");
  await page.locator("#confirm-paste").click();
  await expect(page.locator("#attachment-preview")).toContainText("粘贴的文字");
  await page.locator("[data-remove-attachment]").click();
  await expect(page.locator("#attachment-preview")).toBeHidden();
  await openTab(page, "today");
  await expect(page.locator("#today-empty")).toBeVisible();
  await openTab(page, "chat");

  await page.locator("#chat-input").fill("我希望以后能独立做出真正有人用的产品");
  await page.locator("#chat-form").evaluate(form => form.requestSubmit());
  await expect(page.locator("#dynamic-messages")).toContainText("这个理解准确吗");
  await page.locator("#chat-input").fill("对，这就是我现在最想走的方向");
  await page.locator("#chat-form").evaluate(form => form.requestSubmit());
  await expect(page.locator("#dynamic-messages")).toContainText("长期方向记下了");
  await page.locator("#chat-input").fill("我现在有20分钟，帮我判断下一步");
  await page.locator("#chat-form").evaluate(form => form.requestSubmit());
  await expect(page.locator("#agent-proposal")).toBeVisible();
  await page.locator("#discuss-action").click();
  await expect(page.locator("#agent-proposal")).toHaveClass(/discussing/);
  await page.evaluate(() => { const button = document.createElement("button"); button.dataset.externalUrl = "https://example.com"; button.id = "audit-external"; document.body.append(button); });
  await page.locator("#audit-external").evaluate(button => button.click());
  await expect(page.locator("#external-action-dialog")).toBeVisible();
  await page.locator('#external-action-dialog button[value="cancel"]').click();

  await openTab(page, "us");
  await page.locator("details.companion-preferences > summary").click();
  const maleGender = page.locator('[data-gender="male"]');
  await maleGender.scrollIntoViewIfNeeded();
  await maleGender.click();
  await expect(page.locator("#relationship-copy")).toContainText("他会");
  const friendRole = page.locator('[data-role="friend"]');
  await friendRole.scrollIntoViewIfNeeded();
  await friendRole.click();
  await expect(page.locator("#relationship-copy")).toContainText("朋友");
  await page.locator('[data-open-screen="settings"]').click();
  await waitForActiveScreen(page, "settings");
  await page.locator('[data-theme-option="night"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expect(page.locator("#dynamic-messages")).toContainText("独立做出真正有人用的产品");
  await expect(page.locator(".conversation-day-divider")).toContainText("今天");
  await openTab(page, "us");
  await page.locator("details.companion-preferences > summary").click();
  const settingsEntry = page.locator('[data-open-screen="settings"]');
  await settingsEntry.scrollIntoViewIfNeeded();
  await settingsEntry.click();
  await waitForActiveScreen(page, "settings");
  await page.locator("#provider-select").selectOption("deepseek");
  await expect(page.locator("#api-endpoint")).toHaveValue(/api\.deepseek\.com/);
  await page.locator("#settings-cloud-consent").check();
  await page.locator("#api-key").fill("temporary-test-key");
  await page.route("https://api.deepseek.com/models", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ id: "deepseek-chat" }] }) }));
  await page.locator("#test-model-connection").click();
  await expect(page.locator("#model-select")).toHaveValue("deepseek-chat");
  await page.locator("#save-model-config").click();
  await expect(page.locator("#model-summary")).toContainText("deepseek-chat");
  await page.locator("#calendar-file").setInputFiles({ name: "today.ics", mimeType: "text/calendar", buffer: Buffer.from("BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260911T180000\nSUMMARY:学校拍摄\nEND:VEVENT\nEND:VCALENDAR") });
  await expect(page.locator("#calendar-summary")).toContainText("1 项");
  await page.locator('[data-open-screen="us"]').first().click();
  await waitForActiveScreen(page, "us");
  await openTab(page, "chat");
  await page.locator("#conversation-model").click();
  await expect(page.locator("#model-dialog")).toBeVisible();
  await page.locator('#model-dialog button[value="cancel"]').click();
  expect(errors).toEqual([]);
});

test("short Space types while long press starts and stops voice input", async ({ page }) => {
  await page.addInitScript(() => {
    window.__voiceStarts = 0;
    window.__voiceStops = 0;
    window.SpeechRecognition = class {
      start() {
        window.__voiceStarts += 1;
        this.onstart?.();
      }
      stop() {
        window.__voiceStops += 1;
        this.onend?.();
      }
    };
  });
  await enterFirstRunOnboarding(page);
  await page.locator('[data-onboarding-skip-all]').click();
  await waitForActiveScreen(page, "home");
  await openTab(page, "chat");

  const input = page.locator("#chat-input");
  await input.focus();
  await page.keyboard.down("Space");
  await page.waitForTimeout(80);
  await page.keyboard.up("Space");
  await expect(input).toHaveValue(" ");
  expect(await page.evaluate(() => window.__voiceStarts)).toBe(0);

  await page.keyboard.down("Space");
  await page.waitForTimeout(420);
  await expect(page.locator("#chat-form")).toHaveClass(/listening/);
  await page.keyboard.up("Space");
  await expect(page.locator("#chat-form")).not.toHaveClass(/listening/);
  expect(await page.evaluate(() => [window.__voiceStarts, window.__voiceStops])).toEqual([1, 1]);

  const voiceButton = page.locator("#chat-form .send-button");
  await voiceButton.dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 2, isPrimary: true });
  await page.waitForTimeout(420);
  await expect(page.locator("#chat-form")).toHaveClass(/listening/);
  await voiceButton.dispatchEvent("pointerup", { pointerType: "touch", pointerId: 2, isPrimary: true });
  await expect(page.locator("#chat-form")).not.toHaveClass(/listening/);
  expect(await page.evaluate(() => [window.__voiceStarts, window.__voiceStops])).toEqual([2, 2]);
});
