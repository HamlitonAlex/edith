import { expect, test } from "@playwright/test";

test("onboarding default and selected preview screenshots use the 390 by 844 device canvas", async ({ page }) => {
  await page.goto("/react.html?preview=onboarding");
  await page.waitForTimeout(1000);

  const frame = page.getByLabel("iPhone 学程预览");
  await expect(frame).toBeVisible();
  await expect(frame).toHaveCSS("width", "390px");
  await expect(frame).toHaveCSS("height", "844px");
  await page.screenshot({ path: "test-results/phase-2.1/onboarding-default.png" });

  await page.getByRole("radio", { name: "准备考试或升学 把复习和节奏安排得更清楚" }).click();
  await expect(page.getByRole("radio", { name: "准备考试或升学 把复习和节奏安排得更清楚" })).toHaveAttribute("aria-checked", "true");
  await page.screenshot({ path: "test-results/phase-2.1/onboarding-selected.png" });
});
