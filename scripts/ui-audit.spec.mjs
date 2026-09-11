import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, colorScheme: "light", launchOptions: { channel: "msedge" } });

test("all visible controls have a real response", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:4173/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('[data-onboarding-step="partner"]')).toBeVisible();
  await page.locator('[data-onboarding-next]:visible').click();
  await expect(page.locator('[data-onboarding-step="relationship"]')).toBeVisible();
  await page.locator('[data-onboarding-role="guide"]').click();
  await page.locator('[data-onboarding-next]:visible').click();
  await expect(page.locator('[data-onboarding-step="boundary"]')).toBeVisible();
  await page.locator('[data-onboarding-finish]').click();
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
  await page.locator('[data-nav="today"]').click();
  await expect(page.locator("#today-empty")).toBeVisible();
  await page.locator('[data-nav="chat"]').click();

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

  await page.locator('[data-nav="us"]').click();
  await page.locator('[data-gender="male"]').click();
  await expect(page.locator("#relationship-copy")).toContainText("他会");
  await page.locator('[data-role="friend"]').click();
  await expect(page.locator("#relationship-copy")).toContainText("朋友");
  await page.locator('[data-open-screen="settings"]').click();
  await page.locator('[data-theme-option="night"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expect(page.locator("#dynamic-messages")).toContainText("独立做出真正有人用的产品");
  await expect(page.locator(".conversation-day-divider")).toContainText("今天");
  await page.locator('[data-nav="us"]').click();
  await page.locator('[data-open-screen="settings"]').click();
  await expect(page.locator('[data-screen="settings"]')).toBeVisible();
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
  await page.locator('[data-nav="chat"]').click();
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
      start() { window.__voiceStarts += 1; }
      stop() {
        window.__voiceStops += 1;
        this.onend?.();
      }
    };
  });
  await page.goto("http://127.0.0.1:4173/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-onboarding-skip]:visible').click();
  await page.locator('[data-onboarding-skip]:visible').click();
  await page.locator('[data-onboarding-skip]:visible').click();

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

  await input.dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 2, isPrimary: true });
  await page.waitForTimeout(420);
  await expect(page.locator("#chat-form")).toHaveClass(/listening/);
  await input.dispatchEvent("pointerup", { pointerType: "touch", pointerId: 2, isPrimary: true });
  await expect(page.locator("#chat-form")).not.toHaveClass(/listening/);
  expect(await page.evaluate(() => [window.__voiceStarts, window.__voiceStops])).toEqual([2, 2]);
});
