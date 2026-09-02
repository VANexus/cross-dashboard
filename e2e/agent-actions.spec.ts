import { test, expect } from "@playwright/test";

/**
 * Agent UI 动作注册表（「UI 即工具」）闭环：
 * 经 window.__agentUI 测试钩子（仅非生产挂载）直接驱动动作，跳过 LLM——
 * 快速验证 agent 能操作的全部页面功能：全局 6 项 + 各页注册项。
 */

/** 打开仪表盘并等钩子挂载；后续一律经 page.evaluate 驱动（函数对象不可跨上下文序列化）。 */
async function ready(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/dashboard");
  await page.waitForFunction(() => Boolean((window as unknown as Record<string, unknown>).__agentUI), null, { timeout: 15000 });
}

const run = (page: import("@playwright/test").Page, id: string, params?: Record<string, unknown>) =>
  page.evaluate(({ id, params }) => (window as unknown as { __agentUI: { execute: (i: string, p?: Record<string, unknown>) => Promise<string> } }).__agentUI.execute(id, params), { id, params });

const ids = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { __agentUI: { list: () => { id: string }[] } }).__agentUI.list().map((a) => a.id));

test.describe("Agent UI 动作注册表", () => {
  test("仪表盘上报 全局+页面 合并动作清单", async ({ page }) => {
    await ready(page);
    expect(await ids(page)).toEqual(
      expect.arrayContaining(["navigate", "refresh", "openDrawer", "highlight", "click", "fill", "readKpi", "focusCard", "openTrends"]),
    );
  });

  test("navigate 跳转后页面动作随路由切换", async ({ page }) => {
    await ready(page);
    await run(page, "navigate", { route: "/tasks" });
    await expect(page).toHaveURL(/\/tasks$/, { timeout: 10000 });
    await expect.poll(() => ids(page), { timeout: 10000 }).toEqual(expect.arrayContaining(["filterTasks", "clearFilters"]));
  });

  test("click 动作点「发起编排」打开抽屉", async ({ page }) => {
    await ready(page);
    const summary = await run(page, "click", { selector: '[data-agent-action="orchestrate"]' });
    expect(summary).toBe("已点击 [data-agent-action=\"orchestrate\"]");
    await expect(page.getByLabel("就当前上下文提问")).toBeVisible({ timeout: 5000 });
  });

  test("fill 动作填充抽屉输入框（React 受控兼容）", async ({ page }) => {
    await ready(page);
    await run(page, "openDrawer", {});
    const input = page.getByLabel("就当前上下文提问");
    await expect(input).toBeVisible({ timeout: 5000 });
    const summary = await run(page, "fill", { selector: 'input[aria-label="就当前上下文提问"]', value: "帮我看看风险卡片" });
    expect(summary).toContain("已填充");
    await expect(input).toHaveValue("帮我看看风险卡片");
  });

  test("highlight 高亮指定元素", async ({ page }) => {
    await ready(page);
    await expect(run(page, "highlight", { selector: '[data-agent-card="workflows"]' })).resolves.toBe("已高亮 [data-agent-card=\"workflows\"]");
    await expect(run(page, "highlight", { selector: "#no-such-el" })).resolves.toContain("未找到元素");
  });

  test("页面动作 readKpi 返回 KPI 摘要", async ({ page }) => {
    await ready(page);
    await expect(run(page, "readKpi")).resolves.toMatch(/^KPI：|^KPI 读取失败/);
  });

  test("页面动作 focusCard 高亮 KPI 卡片", async ({ page }) => {
    await ready(page);
    await expect(run(page, "focusCard", { cardId: "risk" })).resolves.toBe("已高亮 [data-agent-card=\"risk\"]");
  });

  test("未注册动作返回可用清单提示", async ({ page }) => {
    await ready(page);
    await expect(run(page, "open_create_workflow_dialog")).resolves.toMatch(/未注册的 UI 动作：open_create_workflow_dialog（当前可用：.*navigate/);
  });
});
