import { test, expect } from "@playwright/test";

test.describe("Content Studio", () => {
  test("page should load and display 4-step stepper header", async ({ page }) => {
    await page.goto("/content-studio");
    await expect(
      page.locator("text=内容创作中心").first()
    ).toBeVisible({ timeout: 15000 });
    // 4 步 stepper（洞察 → 创作 → 审计配图 → 发布）+ 热点雷达在洞察第一屏
    await expect(
      page.locator("text=洞察趋势").first()
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator("text=选题创作").first()
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator("text=热点雷达").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("platform selector switches to 抖音", async ({ page }) => {
    await page.goto("/content-studio");
    await page.locator("button:has-text('抖音')").first().click();
    await expect(
      page.locator("text=短视频 · 9:16 口播").first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("hot topics radar renders empty state without mock data", async ({ page }) => {
    await page.goto("/content-studio");
    // 热点雷达区块可见；无 seed 演示词
    await expect(
      page.locator("text=热点雷达").first()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=通勤好物")).toHaveCount(0);
  });

  test("一键生成 with empty subject shows validation hint", async ({ page }) => {
    await page.goto("/content-studio?step=2");
    await page.getByRole("button", { name: "一键生成" }).click();
    await expect(
      page.locator("text=请先输入产品 / 主题").first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("成果库 tab shows drafts and localized videos", async ({ page }) => {
    await page.goto("/content-studio");
    await page.getByRole("button", { name: "成果库" }).click();
    await expect(
      page.locator("text=最近成果").first()
    ).toBeVisible({ timeout: 15000 });
    // 成果库区块结构可见（真实数据为空时展示空态）
    await expect(
      page.locator("text=本地化视频").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("MCP 不可达时展示结构化错误而非崩溃", async ({ page }) => {
    await page.route("**/api/content-studio/copywriting", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "连接 flowmind MCP 失败", code: 503 }),
      }),
    );
    await page.goto("/content-studio?step=2");
    await page.locator("input[placeholder*='输入产品 / 主题']").first().fill("保温杯");
    await page.getByRole("button", { name: "一键生成" }).click();
    await expect(
      page.locator("text=连接 flowmind MCP 失败").first()
    ).toBeVisible({ timeout: 10000 });
  });
});
