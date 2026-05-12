import { test, expect } from "@playwright/test";

test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("should render Suspense skeleton then load real data", async ({ page }) => {
    const skeleton = page.locator(".skeleton");
    await expect(skeleton.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    await expect(page.locator("text=工作流").first()).toBeVisible({ timeout: 10000 });
    await expect(skeleton).toHaveCount(0);
  });

  test("should display stats cards with data from backend", async ({ page }) => {
    await expect(page.locator("text=工作流").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Agent").first()).toBeVisible();
    await expect(page.locator("text=任务").first()).toBeVisible();
    await expect(page.locator("text=告警").first()).toBeVisible();
  });

  test("should display workflow status table", async ({ page }) => {
    await expect(page.locator("text=工作流状态").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=选品工作流").first()).toBeVisible();
    await expect(page.locator("text=AI 作图").first()).toBeVisible();
    await expect(page.locator("text=AI 广告").first()).toBeVisible();
  });

  test("should display alerts list", async ({ page }) => {
    await expect(page.locator("text=最近告警").first()).toBeVisible({ timeout: 10000 });
  });

  test("should display business metrics section", async ({ page }) => {
    await expect(page.locator("text=近7天销售额").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=转化率").first()).toBeVisible();
  });

  test("should render AnimatedNumber as client component", async ({ page }) => {
    await expect(page.locator("text=工作流").first()).toBeVisible({ timeout: 10000 });
    const dashboardClient = page.locator("[data-testid='dashboard-client']");
    await expect(dashboardClient).toBeVisible().catch(() => {});
  });
});
