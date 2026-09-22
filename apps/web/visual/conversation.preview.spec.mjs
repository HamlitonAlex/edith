import { expect, test } from "@playwright/test";

async function openConversation(page, messages = [], action = null) {
  await page.addInitScript(({ messages, action }) => {
    localStorage.setItem("xuecheng:iphone:v2", JSON.stringify({ onboardingComplete: true, messages }));
    localStorage.setItem("xuecheng:agent:v1", JSON.stringify({ next_recommended_action: action }));
  }, { messages, action });
  await page.goto("/react.html?preview=conversation");
  await expect(page.getByRole("main", { name: "对话" })).toBeVisible();
}

test("390pt conversation keeps a real empty state", async ({ page }) => {
  await openConversation(page);
  await expect(page.getByText("Hi，今天想从哪里开始？", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/phase-4/conversation-empty.png" });
});

test("390pt conversation renders persisted messages and task card", async ({ page }) => {
  await openConversation(page, [{ id: "message-1", role: "user", text: "我想练习 Python", createdAt: "2026-09-22T14:00:00.000Z" }, { id: "message-2", role: "assistant", text: "好，我们从你已经会的地方开始。", createdAt: "2026-09-22T14:01:00.000Z" }], { title: "完成一轮 Python 练习", why_now: "这是你刚才主动提起的方向。", duration_minutes: 20, status: "pending" });
  await expect(page.getByText("完成一轮 Python 练习", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/phase-4/conversation-message.png" });
});

test("390pt conversation input remains visible while typing", async ({ page }) => {
  await openConversation(page);
  const input = page.getByLabel("和小程说说现在的想法");
  await input.fill("我现在想从函数开始");
  await expect(page.getByRole("button", { name: "发送" })).toBeVisible();
  await page.screenshot({ path: "test-results/phase-4/conversation-keyboard.png" });
});
