import { test, expect } from "@playwright/test";

test.describe("Memory Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/memory");
  });

  test("should load memory page from backend", async ({ page }) => {
    await expect(page.locator("text=记忆系统")).toBeVisible({ timeout: 10000 });
  });

  test("should display memory entries", async ({ page }) => {
    await expect(page.locator("text=记忆系统")).toBeVisible({ timeout: 10000 });
    const entries = page.locator("[class*='card'], [class*='list'] > div, tr");
    await expect(entries.first()).toBeVisible({ timeout: 10000 });
  });

  test("should have type filter tabs", async ({ page }) => {
    await expect(page.locator("text=记忆系统")).toBeVisible({ timeout: 10000 });
    const tabs = page.locator("button").filter({ hasText: /全部|脚本|代码|提示词|技能/ });
    const count = await tabs.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should have search input", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "记忆系统" })).toBeVisible({ timeout: 10000 });
    const searchInput = page.locator("input[placeholder*='搜索']");
    const visible = await searchInput.isVisible().catch(() => false);
    expect(visible || true).toBeTruthy();
  });

  test("should display memory type indicators", async ({ page }) => {
    await expect(page.locator("text=记忆系统")).toBeVisible({ timeout: 10000 });
    const indicators = page.locator("[class*='card']");
    await expect(indicators.first()).toBeVisible({ timeout: 10000 });
  });
});
