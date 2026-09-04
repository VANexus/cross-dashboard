import { test, expect } from "@playwright/test";

test.describe("Evolution Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/evolution");
  });

  // PageTransition 动画期间会出现进出场双节点（其一 hidden），统一取首个可见 heading
  const title = (page: import("@playwright/test").Page) =>
    page.getByRole("heading", { name: "自进化系统" }).first();

  test("should load evolution page from backend", async ({ page }) => {
    await expect(title(page)).toBeVisible({ timeout: 10000 });
  });

  test("should display evolution records", async ({ page }) => {
    await expect(title(page)).toBeVisible({ timeout: 10000 });
    const records = page.locator("[class*='card'], [class*='list'] > div, tr");
    await expect(records.first()).toBeVisible({ timeout: 10000 });
  });

  test("should display evolution stats", async ({ page }) => {
    await expect(title(page)).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=总进化次数").first()).toBeVisible({ timeout: 10000 });
  });

  test("should display trend or metrics section", async ({ page }) => {
    await expect(title(page)).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=进化成功率趋势").first()).toBeVisible({ timeout: 10000 });
  });
});
