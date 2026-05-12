import { test, expect } from "@playwright/test";

test.describe("Risk Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/risk");
  });

  test("should load risk page from backend", async ({ page }) => {
    await expect(page.locator("text=风控中心")).toBeVisible({ timeout: 10000 });
  });

  test("should display health score ring", async ({ page }) => {
    await expect(page.locator("text=风控中心")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=健康评分").first()).toBeVisible({ timeout: 10000 });
  });

  test("should display risk events list", async ({ page }) => {
    await expect(page.locator("text=风控中心")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=风险事件").first()).toBeVisible({ timeout: 10000 });
  });

  test("should display risk indicators", async ({ page }) => {
    await expect(page.locator("text=风控中心")).toBeVisible({ timeout: 10000 });
    const indicators = page.locator("[class*='card']");
    const count = await indicators.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should have isolation checklist section", async ({ page }) => {
    await expect(page.locator("text=风控中心")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=店铺隔离检查").first()).toBeVisible({ timeout: 10000 });
  });
});
