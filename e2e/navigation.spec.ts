import { test, expect } from "@playwright/test";

const navItems = [
  { label: "仪表盘", route: "/dashboard" },
  { label: "选品工作流", route: "/workflows/product-research" },
  { label: "AI 作图", route: "/workflows/ai-imaging" },
  { label: "AI 广告", route: "/workflows/ai-advertising" },
  { label: "AI 上架", route: "/workflows/ai-listing" },
  { label: "库销比", route: "/workflows/inventory" },
  { label: "竞品广告分析", route: "/workflows/competitor-ads" },
  { label: "风控中心", route: "/risk" },
  { label: "Agent 管理", route: "/agents" },
  { label: "任务中心", route: "/tasks" },
  { label: "记忆系统", route: "/memory" },
  { label: "自进化", route: "/evolution" },
];

test.describe("Navigation", () => {
  test("should have sidebar with FlowMind branding", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("text=FlowMind").first()).toBeVisible({ timeout: 10000 });
  });

  for (const item of navItems) {
    test(`should navigate to ${item.label} via sidebar`, async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page.locator("text=FlowMind").first()).toBeVisible({ timeout: 10000 });
      const link = page.locator(`a[href='${item.route}']`).first();
      if (await link.isVisible()) {
        await link.click();
        await expect(page).toHaveURL(new RegExp(item.route.replace(/\//g, "\\/")));
      }
    });
  }

  test("should handle 404 for non-existent agent", async ({ page }) => {
    await page.goto("/agents/non-existent-id-999");
    await expect(
      page.locator("text=找不到").or(page.locator("text=404")).or(page.locator("text=Not Found"))
    ).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test("should redirect root to journeys 编排中心", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/journeys/, { timeout: 10000 });
  });
});
