import { test, expect } from "@playwright/test";

test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("should render Suspense skeleton then load real data", async ({ page }) => {
    const skeleton = page.locator(".skeleton");
    await expect(skeleton.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    await expect(page.locator("text=工作流状态").first()).toBeVisible({ timeout: 10000 });
    await expect(skeleton).toHaveCount(0);
  });

  test("should display KPI stats cards with data from backend", async ({ page }) => {
    await expect(page.locator("text=运行中工作流").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=在线 Agent").first()).toBeVisible();
    await expect(page.locator("text=已完成任务").first()).toBeVisible();
    await expect(page.locator("text=风险事件").first()).toBeVisible();
  });

  test("should display workflow status list with content workflows", async ({ page }) => {
    await expect(page.locator("text=工作流状态").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=视频本地化").first()).toBeVisible();
    await expect(page.locator("text=文案创作").first()).toBeVisible();
    await expect(page.locator("text=合规审计").first()).toBeVisible();
  });

  test("should display Agent heartbeat panel", async ({ page }) => {
    await expect(page.locator("text=Agent 心跳").first()).toBeVisible({ timeout: 10000 });
  });

  test("should display alerts list", async ({ page }) => {
    await expect(page.locator("text=最近告警").first()).toBeVisible({ timeout: 10000 });
  });

  test("should display sales trend area chart", async ({ page }) => {
    await expect(page.locator("text=销售额").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("svg path").first()).toBeVisible();
  });

  test("should render AI live panel with real task stream", async ({ page }) => {
    // AiLivePanel 已重写为真实数据（GET /api/tasks），不再有 mock 打字动画
    await expect(page.locator("text=AI 编排 · 实时任务流").first()).toBeVisible({ timeout: 10000 });
    // 有任务则显示任务行，无任务则显示引导空态（不依赖种子数据）
    const empty = page.locator("text=暂无任务");
    const rows = page.locator(".dash-stream a.ln");
    await expect(empty.or(rows.first())).toBeVisible({ timeout: 10000 });
  });

  test("发起编排 button opens agent drawer", async ({ page }) => {
    await expect(page.locator("text=AI 编排 · 实时任务流").first()).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "发起编排" }).click();
    // 打开的是 Agent 抽屉（全站唯一 Agent 入口，旧编排面板已删除）
    await expect(page.locator("text=Agent 视域").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel("就当前上下文提问")).toBeVisible();
  });
});
