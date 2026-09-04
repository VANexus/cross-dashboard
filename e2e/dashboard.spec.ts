import { test, expect } from "@playwright/test";

/**
 * Dashboard（Agent 动态画布）E2E。
 * 注：页首标题等 locator 统一用 .first()——Next 16 RSC 水合瞬间可能短暂出现重复标题节点，
 * 稳定后收敛为单节点；.first() 使断言对该瞬态健壮。
 */
test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("should render skeleton then load KPI status bar", async ({ page }) => {
    await expect(page.locator("text=运行中工作流").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=在线 Agent").first()).toBeVisible();
    await expect(page.locator("text=已完成任务").first()).toBeVisible();
    await expect(page.locator("text=风险事件").first()).toBeVisible();
  });

  test("should show empty canvas with guidance", async ({ page }) => {
    // 未 pin 任何组件时，画布空态引导可见
    await expect(page.locator("text=画布为空").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=打开助手").first()).toBeVisible();
  });

  test("画布从 localStorage 恢复已 pin 组件，且可移除", async ({ page }) => {
    // 直接注入画布持久化数据（等价于 Agent 曾 panel.pin），验证刷新后渲染 + 可移除
    await page.evaluate(() => {
      const items = [{
        id: "pin-test-1", component: "stat-card",
        props: { title: "测试指标", value: 42, delta: "+5%" },
        title: "测试面板", pinnedAt: Date.now(),
      }];
      window.localStorage.setItem("flowmind.dashboardCanvas", JSON.stringify(items));
    });
    await page.reload();
    // 画布渲染出该指标卡（含标题与数值）
    await expect(page.locator("text=测试指标").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=测试面板").first()).toBeVisible();
    // 点 X 可移除
    await page.locator('button[aria-label^="移除 测试面板"]').click();
    await expect(page.locator("text=测试指标").first()).toBeHidden({ timeout: 5000 });
  });

  test("打开助手 button opens agent drawer", async ({ page }) => {
    await page.getByRole("button", { name: "打开助手" }).first().click();
    await expect(page.locator("text=Agent 助手").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel("就当前上下文提问")).toBeVisible();
  });
});
