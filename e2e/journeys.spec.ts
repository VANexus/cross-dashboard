import { test, expect } from "@playwright/test";

/**
 * 流程编排中心（/journeys）+ 旅程执行 + Agent 旅程动作闭环：
 * 经 window.__agentUI 测试钩子直驱 startJourney/advanceJourney（跳过 LLM），
 * 验证 registry 驱动的编排层与旅程运行态（zustand persist）跨页流转。
 */

const run = (page: import("@playwright/test").Page, id: string, params?: Record<string, unknown>) =>
  page.evaluate(({ id, params }) => (window as unknown as { __agentUI: { execute: (i: string, p?: Record<string, unknown>) => Promise<string> } }).__agentUI.execute(id, params), { id, params });

async function ready(page: import("@playwright/test").Page, path = "/journeys"): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => Boolean((window as unknown as Record<string, unknown>).__agentUI), null, { timeout: 15000 });
}

test.describe("流程编排中心", () => {
  test("编排中心渲染 registry 驱动的旅程卡片", async ({ page }) => {
    await ready(page);
    await expect(page.getByRole("heading", { name: "流程编排中心" }).first()).toBeVisible({ timeout: 10000 });
    // J1/J2 由 journey registry 派生
    await expect(page.getByText("内容发布旅程").first()).toBeVisible();
    await expect(page.getByText("TikTok·国际站铺货旅程").first()).toBeVisible();
  });

  test("root redirect 到 /journeys", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/journeys$/, { timeout: 10000 });
  });

  test("topbar「发起流程」下拉含 registry 旅程并可进入", async ({ page }) => {
    await ready(page);
    await page.locator('[data-agent-action="start-journey"]').click();
    await expect(page.getByRole("menuitem", { name: /内容发布旅程/ })).toBeVisible({ timeout: 5000 });
    await page.getByRole("menuitem", { name: /内容发布旅程/ }).click();
    await expect(page).toHaveURL(/\/journeys\/content-publish$/, { timeout: 10000 });
  });

  test("⌘K 面板索引含旅程与页面（registry 派生）", async ({ page }) => {
    await ready(page);
    await page.keyboard.press("Control+k");
    const input = page.locator('[data-slot="command-input"]');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill("内容发布");
    await expect(page.locator('[data-slot="command-item"]', { hasText: "内容发布旅程" })).toBeVisible({ timeout: 5000 });
  });
});

test.describe("旅程执行 + Agent 动作", () => {
  test("startJourney 发起 J1 并进入执行视图", async ({ page }) => {
    await ready(page);
    const summary = await run(page, "startJourney", { id: "content-publish" });
    expect(summary).toContain("已发起旅程「内容发布旅程」");
    await expect(page).toHaveURL(/\/journeys\/content-publish$/, { timeout: 10000 });
    await expect(page.getByText(/进行中 · 第 1\/4 步/).first()).toBeVisible({ timeout: 10000 });
  });

  test("advanceJourney 推进步骤且运行态跨页持久", async ({ page }) => {
    await ready(page);
    await run(page, "startJourney", { id: "content-publish" });
    await expect(page).toHaveURL(/\/journeys\/content-publish$/, { timeout: 10000 });
    const summary = await run(page, "advanceJourney");
    expect(summary).toContain("前往下一步「选题创作」");
    // advanceJourney 直接跳到第 2 步页面（步骤 href 带 journey query）
    await expect(page).toHaveURL(/\/content-studio/, { timeout: 10000 });
  });

  test("骨架旅程不可发起（返回说明而非跳转）", async ({ page }) => {
    await ready(page);
    const summary = await run(page, "startJourney", { id: "competitor-ads" }).catch(() => "骨架旅程");
    expect(summary).toMatch(/骨架旅程|未登记/);
    await expect(page).toHaveURL(/\/journeys$/, { timeout: 5000 });
  });

  test("旅程执行视图渲染 xyflow 管线图与步骤列表", async ({ page }) => {
    await ready(page, "/journeys/content-publish");
    await expect(page.getByText("旅程管线")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("洞察趋势").first()).toBeVisible();
    await expect(page.locator('[data-agent-action="journey-start-content-publish"]')).toBeVisible();
  });
});

test.describe("M2 内容工坊 · 4 步 stepper 与旅程条", () => {
  test("content-studio 渲染 4 步 stepper 且洞察步热榜引擎在第一屏", async ({ page }) => {
    await page.goto("/content-studio");
    await expect(page.getByRole("heading", { name: "内容创作中心" }).first()).toBeVisible({ timeout: 15000 });
    for (const label of ["洞察趋势", "选题创作", "审计配图", "发布"]) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 10000 });
    }
    await expect(page.getByText("热榜引擎").first()).toBeVisible();
    // 默认落在第 1 步：平台/主题输入可见
    await expect(page.getByPlaceholder(/输入产品 \/ 主题/).first()).toBeVisible();
  });

  test("?step=n 深链直接落到对应步骤", async ({ page }) => {
    await page.goto("/content-studio?step=3");
    await expect(page.getByText("平台规则审计").first()).toBeVisible({ timeout: 15000 });
    await page.goto("/content-studio?step=4");
    await expect(page.getByText("打开公众号发布工作台").or(page.getByText(/暂无站内发布通道/)).first()).toBeVisible({ timeout: 15000 });
  });

  test("JourneyBar 随旅程出现且 journey-next 推进到审计步", async ({ page }) => {
    await ready(page);
    await run(page, "startJourney", { id: "content-publish" });
    await expect(page).toHaveURL(/\/journeys\/content-publish$/, { timeout: 10000 });
    await run(page, "advanceJourney");
    // advanceJourney → 第 2 步 /content-studio?journey=content-publish&step=2
    await expect(page).toHaveURL(/\/content-studio\?journey=content-publish&step=2$/, { timeout: 10000 });
    const bar = page.locator('[data-journey-bar="content-publish"]');
    await expect(bar).toBeVisible({ timeout: 10000 });
    await expect(bar.getByText(/进行中|第 2\/4 步|选题创作/).first()).toBeVisible();
    await bar.locator('[data-agent-action="journey-next"]').click();
    // 推进到第 3 步（审计步），初渲直接落在审计配图
    await expect(page).toHaveURL(/\/content-studio\?journey=content-publish&step=3$/, { timeout: 10000 });
    await expect(page.getByText("平台规则审计").first()).toBeVisible({ timeout: 15000 });
  });

  test("wechat 发布页挂 JourneyBar（第 4 步）且向导把手齐全", async ({ page }) => {
    await ready(page, "/journeys/content-publish");
    // 直接以运行态落到第 4 步
    await page.evaluate(() => {
      const s = (window as unknown as { __agentUI: { execute: (i: string, p?: Record<string, unknown>) => Promise<string> } }).__agentUI;
      return s.execute("startJourney", { id: "content-publish" });
    });
    await page.goto("/content-studio/wechat?journey=content-publish&step=4");
    const bar = page.locator('[data-journey-bar="content-publish"]');
    await expect(bar).toBeVisible({ timeout: 15000 });
    await expect(bar.locator('[data-agent-action="journey-next"]')).toBeVisible();
    await expect(bar.getByText(/第 4\/4 步|发布/).first()).toBeVisible();
    // 发布向导核心把手（Agent 可驱动）
    await expect(page.getByText("发布工作台")).toBeVisible();
  });
});

test.describe("M3 上架运营 · J2 全步走通", () => {
  test("J2 四页依序流转：趋势 → Listing → 生图 → 渠道", async ({ page }) => {
    await ready(page);
    // 客户端导航进入 async SSR island 时，Next dev 可能残留一个 hidden 旧子树，
    // 故旅程条一律只取「可见」的那一个（生产构建无此现象）。
    const jbar = page.locator('[data-journey-bar="listing-launch"] >> visible=true');
    expect(await run(page, "startJourney", { id: "listing-launch" })).toContain("已发起旅程「TikTok·国际站铺货旅程」");
    await expect(page).toHaveURL(/\/journeys\/listing-launch$/, { timeout: 10000 });

    // 第 1 步：关键词趋势（直达步页面，旅程条出现）
    await page.goto("/b2b/keyword-trends?journey=listing-launch&step=1");
    // 整页导航会重置 window，等待测试钩子在新页面重新挂载
    await page.waitForFunction(() => Boolean((window as unknown as Record<string, unknown>).__agentUI), null, { timeout: 15000 });
    await expect(jbar).toBeVisible({ timeout: 15000 });

    // 推进到第 2 步：Listing 生成
    await run(page, "advanceJourney");
    await expect(page).toHaveURL(/\/b2b\/listing\?journey=listing-launch&step=2$/, { timeout: 10000 });
    await expect(jbar).toBeVisible({ timeout: 15000 });
    await jbar.locator('[data-agent-action="journey-next"]').click();

    // 第 3 步：生图素材
    await expect(page).toHaveURL(/\/b2b\/image-skills\?journey=listing-launch&step=3$/, { timeout: 10000 });
    await expect(jbar).toBeVisible({ timeout: 15000 });
    await jbar.locator('[data-agent-action="journey-next"]').click();

    // 第 4 步：渠道上架（最后一步）
    await expect(page).toHaveURL(/\/b2b\/channels\?journey=listing-launch&step=4$/, { timeout: 10000 });
    await expect(jbar).toBeVisible({ timeout: 15000 });
    await expect(jbar.getByRole("button", { name: "标记完成 · 结束旅程" })).toBeVisible();
  });

  test("无 journey query 时 b2b 页不渲染旅程条（零侵入）", async ({ page }) => {
    await page.goto("/b2b/keyword-trends");
    await expect(page.locator("text=行业关键词热力榜").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("[data-journey-bar]")).toHaveCount(0);
  });
});
