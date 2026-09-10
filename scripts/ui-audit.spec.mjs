import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, colorScheme: "light", launchOptions: { channel: "msedge" } });

test("all visible controls have a real response", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:4173/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#empty-conversation")).toBeVisible();
  await expect(page.locator("#agent-proposal")).toBeHidden();
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
  await page.locator('[data-theme-option="elegant"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "elegant");

  await page.locator('[data-open-screen="settings"]').click();
  await expect(page.locator('[data-screen="settings"]')).toBeVisible();
  await page.locator('[data-open-screen="us"]').first().click();
  await page.locator('[data-nav="chat"]').click();
  await page.locator("#conversation-model").click();
  await expect(page.locator("#model-dialog")).toBeVisible();
  await page.locator('#model-dialog button[value="cancel"]').click();
  expect(errors).toEqual([]);
});
