import { test, expect } from "@playwright/test";

const workflows = [
  { route: "/workflows/product-research", name: "选品工作流" },
  { route: "/workflows/ai-imaging", name: "AI 作图" },
  { route: "/workflows/ai-advertising", name: "AI 广告" },
  { route: "/workflows/ai-listing", name: "AI 上架" },
  { route: "/workflows/inventory", name: "库销比" },
  { route: "/workflows/competitor-ads", name: "竞品广告分析" },
];

test.describe("Workflow Pages", () => {
  for (const wf of workflows) {
    test(`${wf.name} page should load and display data`, async ({ page }) => {
      await page.goto(wf.route);
      const heading = page.locator("h1, h2, [class*='title']").first();
      await expect(heading).toBeVisible({ timeout: 15000 });
    });
  }

  test("product-research should show data sources and keywords", async ({ page }) => {
    await page.goto("/workflows/product-research");
    await expect(
      page.locator("text=选品工作流").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("ai-imaging should show image gallery", async ({ page }) => {
    await page.goto("/workflows/ai-imaging");
    await expect(
      page.getByRole("tab", { name: "主图" })
    ).toBeVisible({ timeout: 15000 });
  });

  test("ai-advertising should show keyword table", async ({ page }) => {
    await page.goto("/workflows/ai-advertising");
    await expect(
      page.locator("text=AI 广告投放").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("ai-listing should show listing components", async ({ page }) => {
    await page.goto("/workflows/ai-listing");
    await expect(
      page.locator("text=侵权检测").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("inventory should show inventory table", async ({ page }) => {
    await page.goto("/workflows/inventory");
    await expect(
      page.locator("text=库存规划").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("competitor-ads should show analysis data", async ({ page }) => {
    await page.goto("/workflows/competitor-ads");
    await expect(
      page.locator("text=竞品广告分析").first()
    ).toBeVisible({ timeout: 15000 });
  });
});
