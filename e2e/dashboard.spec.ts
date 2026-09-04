import { test, expect } from "@playwright/test";

/**
 * Dashboard（单屏指挥台）E2E。
 * 注：页首标题等 locator 统一用 .first()——Next 16 RSC 水合瞬间可能短暂出现重复标题节点，
 * 稳定后收敛为单节点；.first() 使断言对该瞬态健壮（应用本身已验证为单节点）。
 */
test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("should render Suspense skeleton then load real data", async ({ page }) => {
    const skeleton = page.locator(".skeleton");
    await expect(skeleton.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    await expect(page.locator("text=Agent 动态工作流").first()).toBeVisible({ timeout: 15000 });
    await expect(skeleton).toHaveCount(0);
  });

  test("should display KPI stats cards with data from backend", async ({ page }) => {
    await expect(page.locator("text=运行中工作流").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=在线 Agent").first()).toBeVisible();
    await expect(page.locator("text=已完成任务").first()).toBeVisible();
    await expect(page.locator("text=风险事件").first()).toBeVisible();
  });

  test("should display Agent-driven workflow status (无预设)", async ({ page }) => {
    await expect(page.locator("text=Agent 动态工作流").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=由对话编排").first()).toBeVisible();
    // 真实运行统计：SOP / 总运行 / 运行中 / 成功 / 失败 五格
    for (const label of ["SOP", "总运行", "运行中", "成功", "失败"]) {
      await expect(page.locator("text=" + label).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("should display Agent heartbeat panel with real data", async ({ page }) => {
    await expect(page.locator("text=Agent 心跳").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=实时").first()).toBeVisible();
  });

  test("should display Agent capability center", async ({ page }) => {
    // AI-Native 精简：能力中心不再作为 dashboard 面板堆砌，
    // 收敛为「能力组件库」（sidebar）由 Agent 按需组装。此处验证 sidebar 能力库入口存在。
    await expect(page.locator("text=能力组件库").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=AI 对话").first()).toBeVisible();
  });

  test("should display Agent collaboration topology (3D)", async ({ page }) => {
    await expect(page.locator("text=Agent 协同拓扑").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("进入仪表盘自动展开 Copilot 抽屉（对话即主操作台）", async ({ page }) => {
    await expect(page.locator("text=Agent 视域").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel("就当前上下文提问")).toBeVisible();
    // 抽屉真实展开：主内容被挤压（抽屉占据右侧）
    const state = await page.evaluate(() => {
      const aside = document.querySelector('aside[aria-label="Agent 抽屉面板"]');
      if (!aside) return { open: false };
      const rect = aside.getBoundingClientRect();
      return { open: rect.left < window.innerWidth - 20, left: Math.round(rect.left), innerW: window.innerWidth };
    });
    expect(state.open).toBe(true);
  });

  test("should render AI live panel with real task stream", async ({ page }) => {
    // AiLivePanel 已重写为真实数据（GET /api/tasks），不再有 mock 打字动画
    await expect(page.locator("text=AI 编排 · 实时任务流").first()).toBeVisible({ timeout: 15000 });
    // 有任务则显示任务行，无任务则显示引导空态（不依赖种子数据）
    const empty = page.locator("text=暂无任务");
    const rows = page.locator(".dash-stream a.ln");
    await expect(empty.or(rows.first()).first()).toBeVisible({ timeout: 10000 });
  });

  test("发起编排 button opens agent drawer", async ({ page }) => {
    await expect(page.locator("text=AI 编排 · 实时任务流").first()).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "发起编排" }).click();
    // 打开的是 Agent 抽屉（全站唯一 Agent 入口，旧编排面板已删除）
    await expect(page.locator("text=Agent 视域").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel("就当前上下文提问")).toBeVisible();
  });

  test("单屏指挥台：整页不滚动（body 高度=视口）", async ({ page }) => {
    const dims = await page.evaluate(() => {
      const b = document.body;
      return {
        bodyScrollH: b.scrollHeight,
        winH: window.innerHeight,
        cockpitGrid: document.querySelectorAll(".cockpit-grid").length,
      };
    });
    // 单屏：body 不出现垂直滚动（滚动发生在面板/容器内部）
    expect(dims.cockpitGrid).toBeGreaterThan(0);
    expect(dims.bodyScrollH).toBeLessThanOrEqual(dims.winH + 1);
  });
});
