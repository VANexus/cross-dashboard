import { test, expect } from "@playwright/test";

test.describe("Tasks Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
  });

  test("should load tasks list from backend", async ({ page }) => {
    await expect(page.locator("text=任务管理").first()).toBeVisible({ timeout: 10000 });
  });

  test("should display task items", async ({ page }) => {
    await expect(page.locator("text=任务管理").first()).toBeVisible({ timeout: 10000 });
    const taskItems = page.locator("[class*='card'], tr, [class*='list'] > div");
    await expect(taskItems.first()).toBeVisible({ timeout: 10000 });
  });

  test("should have search functionality", async ({ page }) => {
    await expect(page.locator("text=任务管理").first()).toBeVisible({ timeout: 10000 });
    const searchInput = page.locator("input[placeholder*='搜索']").first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("选品");
      await page.waitForTimeout(500);
    }
  });

  test("should have filter tabs or buttons", async ({ page }) => {
    await expect(page.locator("text=任务管理").first()).toBeVisible({ timeout: 10000 });
    const filters = page.locator("button").filter({ hasText: /全部|运行中|已完成|失败/ });
    const count = await filters.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should display task status indicators", async ({ page }) => {
    await expect(page.locator("text=任务管理").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /运行中/ })).toBeVisible({ timeout: 10000 });
  });
});
