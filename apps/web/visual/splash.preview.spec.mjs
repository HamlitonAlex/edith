import { expect, test } from "@playwright/test";

test("splash preview is a 390 by 844 brand launch screen", async ({ page }) => {
  await page.goto("/react.html?preview=splash");
  await page.waitForTimeout(500);
  const frame = page.getByLabel("iPhone 学程预览");
  const brand = page.getByLabel("学程，安静地陪你走好下一步");
  await expect(frame).toBeVisible();
  await expect(frame).toHaveCSS("width", "390px");
  await expect(frame).toHaveCSS("height", "844px");
  await expect(page.getByRole("heading", { name: "学程" })).toBeVisible();
  await expect(brand).toHaveCSS("opacity", "1");
  await expect(page.getByText("陪你，走更远的路")).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);
  await page.screenshot({ path: "test-results/phase-2.2/splash-default.png" });
});
