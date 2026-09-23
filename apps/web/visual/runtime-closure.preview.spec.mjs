import { expect, test } from "@playwright/test";

test("React runtime sends messages through the local-first store and restores them after reload", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("xuecheng:iphone:v2")) localStorage.setItem("xuecheng:iphone:v2", JSON.stringify({ onboardingComplete: true, messages: [] }));
    if (!localStorage.getItem("xuecheng:agent:v1")) localStorage.setItem("xuecheng:agent:v1", JSON.stringify({ schema_version: 1 }));
  });
  await page.goto("/react.html?preview=conversation");
  const input = page.getByLabel("和小程说说现在的想法");
  await input.fill("我想继续练习函数");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("我想继续练习函数", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("xuecheng:iphone:v2"))).toContain("我想继续练习函数");
  await page.reload();
  await expect(page.getByText("我想继续练习函数", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/phase-6/conversation-persisted.png" });
});

test("conversation retains the existing attachment sources, paste flow and safe Markdown rendering", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("xuecheng:iphone:v2", JSON.stringify({ onboardingComplete: true, messages: [{ role: "assistant", text: "**重点**\n用小步说明。", createdAt: new Date().toISOString() }] }));
    localStorage.setItem("xuecheng:agent:v1", JSON.stringify({ schema_version: 1 }));
  });
  await page.goto("/react.html?preview=conversation");
  await expect(page.locator("strong").getByText("重点", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "添加照片、文件或文字" }).click();
  for (const label of ["拍照", "选择照片", "选择文件", "粘贴文字"]) await expect(page.getByRole("button", { name: label })).toBeVisible();
  await page.getByRole("button", { name: "粘贴文字" }).click();
  await page.getByLabel("粘贴的文字").fill("只用于这次对话的资料");
  await page.getByRole("button", { name: "加入对话" }).click();
  await expect(page.getByText("粘贴的文字", { exact: true })).toBeVisible();
});

test("React pages fit supported iPhone widths and hide navigation for a native keyboard frame", async ({ page }) => {
  for (const width of [320, 375, 390, 393, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/react.html?preview=conversation");
    await expect(page.getByRole("main", { name: "对话" })).toBeVisible();
    const measurements = await page.evaluate(() => {
      const main = document.querySelector("main");
      const frame = document.querySelector("[class*=frame]");
      const nav = document.querySelector("nav");
      const composer = document.querySelector("form[aria-label='发送消息']");
      const bounds = element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      return { documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, frame: bounds(frame), main: bounds(main), nav: bounds(nav), composer: bounds(composer) };
    });
    expect(measurements.documentWidth, `horizontal page overflow at ${width}px`).toBeLessThanOrEqual(width);
    expect(measurements.frame.width).toBeLessThanOrEqual(width);
    expect(measurements.composer.right).toBeLessThanOrEqual(measurements.main.right + 1);
    expect(measurements.nav.top).toBeGreaterThanOrEqual(measurements.composer.bottom - 1);

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("xuecheng:native-keyboard", { detail: { visible: true, inset: 310 } })));
    await expect(page.getByRole("navigation", { name: "主导航" })).toBeHidden();
    await expect(page.getByLabel("和小程说说现在的想法")).toBeVisible();
  }
});
