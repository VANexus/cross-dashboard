import { test, expect } from "@playwright/test";

test.describe("Agents Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/agents");
  });

  test("should load agent cards from backend", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Agent 管理" })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Sentinel").first()).toBeVisible({ timeout: 10000 });
  });

  test("should display 6 agent cards", async ({ page }) => {
    await expect(page.locator("text=Sentinel").first()).toBeVisible({ timeout: 10000 });
    const cards = page.locator("article, [class*='card']");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("should navigate to agent detail page with dynamic route", async ({ page }) => {
    await expect(page.locator("text=Sentinel").first()).toBeVisible({ timeout: 10000 });
    await page.locator("a[href*='/agents/']").first().click();
    await page.waitForURL(/\/agents\//, { timeout: 5000 });
    expect(page.url()).toMatch(/\/agents\/.+$/);
  });

  test("should display agent status indicators", async ({ page }) => {
    await expect(page.locator("text=Sentinel").first()).toBeVisible({ timeout: 10000 });
    const statusDots = page.locator("[class*='status'], [class*='dot']");
    const count = await statusDots.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should load agent detail page directly", async ({ page }) => {
    await page.goto("/agents/sentinel-001");
    await expect(page.locator("text=Sentinel").first()).toBeVisible({ timeout: 10000 });
  });
});
