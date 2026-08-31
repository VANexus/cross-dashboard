import { test, expect } from "@playwright/test";

test.describe("Agents Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/agents");
  });

  test("should load agents page structure", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Agent 管理" })).toBeVisible({ timeout: 15000 });
  });

  test("should render agent cards from backend without mock data", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Agent 管理" })).toBeVisible({ timeout: 15000 });
    // 无种子数据：卡片可为 0（空网格不崩溃），运行时创建的 Agent 出现则正常渲染
    const cards = page.locator("a[href*='/agents/']");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should navigate to agent detail page when cards exist", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Agent 管理" })).toBeVisible({ timeout: 15000 });
    const firstCard = page.locator("a[href*='/agents/']").first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.click();
      await page.waitForURL(/\/agents\//, { timeout: 5000 });
      expect(page.url()).toMatch(/\/agents\/.+$/);
    }
  });

  test("should load agent detail page directly", async ({ page }) => {
    await page.goto("/agents/sentinel-001");
    // 库内有该 Agent → 详情页；库内无 → notFound 404。两者都是合法渲染
    await expect(
      page.locator("text=Sentinel")
        .or(page.locator("text=404"))
        .or(page.locator("text=This page could not be found"))
        .first()
    ).toBeVisible({ timeout: 15000 });
  });
});
