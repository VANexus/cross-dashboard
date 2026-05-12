import { test, expect } from "@playwright/test";

test.describe("Evolution Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/evolution");
  });

  test("should load evolution page from backend", async ({ page }) => {
    await expect(page.locator("text=自进化系统")).toBeVisible({ timeout: 10000 });
  });

  test("should display evolution records", async ({ page }) => {
    await expect(page.locator("text=自进化系统")).toBeVisible({ timeout: 10000 });
    const records = page.locator("[class*='card'], [class*='list'] > div, tr");
    await expect(records.first()).toBeVisible({ timeout: 10000 });
  });

  test("should display evolution stats", async ({ page }) => {
    await expect(page.locator("text=自进化系统")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=总优化次数").first()).toBeVisible({ timeout: 10000 });
  });

  test("should display trend or metrics section", async ({ page }) => {
    await expect(page.locator("text=自进化系统")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=进化趋势").first()).toBeVisible({ timeout: 10000 });
  });
});
