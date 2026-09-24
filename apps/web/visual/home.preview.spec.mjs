import { expect, test } from "@playwright/test";

const taskState = {
  schema_version: 1,
  long_term_goals: [{ text: "成为能独立完成产品的人" }],
  skills: { python: { label: "Python", confidence: .45, evidence: ["完成过基础练习"] } },
  next_recommended_action: { id: "next-python", title: "理解 Python 递归", why_now: "你已经完成了基础函数练习，现在适合把这一步连起来。", duration_minutes: 20, platform: "本地", status: "pending", skill_id: "python" },
};

async function openHome(page, agent = {}) {
  await page.addInitScript(({ agent }) => {
    localStorage.setItem("xuecheng:iphone:v2", JSON.stringify({ onboardingComplete: true, name: "小程", calendarEvents: [{ id: "calendar-1", summary: "编程练习", start: "20260922T140000", status: "confirmed" }] }));
    localStorage.setItem("xuecheng:agent:v1", JSON.stringify(agent));
  }, { agent });
  await page.goto("/react.html?preview=home");
  await expect(page.getByLabel("首页")).toBeVisible();
}

test("390pt Home renders the real local empty state", async ({ page }) => {
  await openHome(page);
  await expect(page.getByText("还不急着替你安排。", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/phase-3/home-empty.png" });
});

test("390pt Home renders a persisted Next Step", async ({ page }) => {
  await openHome(page, taskState);
  await expect(page.getByText("理解 Python 递归", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/phase-3/home-task.png" });
});
