import { test, expect, type Page } from "@playwright/test";

/**
 * P0 落地 E2E：TikTok+国际站铺货「选品上架 Agent 闭环」+ 人在环中三级权限 L0/L1/L2。
 * 全部经 window.__agentUI 测试钩子驱动，跳过真实 LLM，保证确定性：
 *  - 铺货 4 页面都就地注册了 Agent 动作，且风险分级正确（L2=上传国际站/导入凭证）；
 *  - L2 动作不自动执行，必须在确认卡上当次批准；取消不执行、批准恰好执行一次；
 *  - L0/L1 动作照常自动执行，不被确认门拦截；
 *  - 趋势页数据来源/平台口径对用户可见（数据诚实标注）。
 */

type Hook = {
  list: () => { id: string; riskLevel: "L0" | "L1" | "L2" }[];
  execute: (id: string, params?: Record<string, unknown>) => Promise<string>;
  riskOf: (id: string) => "L0" | "L1" | "L2" | null;
  registerTestAction: (def: Record<string, unknown>) => void;
  enqueueL2ForTest: (id: string, params?: Record<string, unknown>) => string | null;
  listPendingL2: () => { toolCallId: string; actionId: string }[];
  resolveL2ForTest: (callId: string, approve: boolean) => void;
};

async function waitHook(page: Page, url: string) {
  await page.goto(url);
  await page.waitForFunction(() => Boolean((window as unknown as Record<string, unknown>).__agentUI), null, { timeout: 20000 });
}
const listIds = (page: Page) =>
  page.evaluate(() => (window as unknown as { __agentUI: Hook }).__agentUI.list().map((a) => a.id));
const riskOf = (page: Page, id: string) =>
  page.evaluate((i) => (window as unknown as { __agentUI: Hook }).__agentUI.riskOf(i), id);

test.describe("铺货链路 4 页面就地接入 Agent", () => {
  test("趋势页：注册选品动作 + 全局动作分级正确", async ({ page }) => {
    await waitHook(page, "/b2b/keyword-trends");
    await expect.poll(() => listIds(page), { timeout: 15000 }).toEqual(
      expect.arrayContaining(["searchKeyword", "switchPlatform", "generateLongTails", "openListingFlow"]),
    );
    expect(await riskOf(page, "navigate")).toBe("L0");
    expect(await riskOf(page, "refresh")).toBe("L0");
    expect(await riskOf(page, "fill")).toBe("L1");
    // 平台口径可见：TikTok + 阿里国际站
    await expect(page.getByRole("button", { name: "TikTok" })).toBeVisible();
    await expect(page.getByText("阿里国际站").first()).toBeVisible();
  });

  test("上架页：上传国际站是 L2，其余为 L1", async ({ page }) => {
    await waitHook(page, "/b2b/listing");
    await expect.poll(() => listIds(page), { timeout: 15000 }).toEqual(
      expect.arrayContaining([
        "setListingPreference", "syncProductPool", "recommendToday",
        "generateListingDraft", "publishListingToAlibaba",
      ]),
    );
    expect(await riskOf(page, "publishListingToAlibaba")).toBe("L2");
    expect(await riskOf(page, "recommendToday")).toBe("L1");
    expect(await riskOf(page, "generateListingDraft")).toBe("L1");
  });

  test("生图页：反推/固化/出图均为本地可逆 L1", async ({ page }) => {
    await waitHook(page, "/b2b/image-skills");
    await expect.poll(() => listIds(page), { timeout: 15000 }).toEqual(
      expect.arrayContaining(["reverseCoverPrompt", "createSkillFromCover", "generateWithSkillAction"]),
    );
    expect(await riskOf(page, "reverseCoverPrompt")).toBe("L1");
    expect(await riskOf(page, "generateWithSkillAction")).toBe("L1");
  });

  test("渠道页：只读 L0 / 校验 L1 / 导入凭证 L2", async ({ page }) => {
    await waitHook(page, "/b2b/channels");
    await expect.poll(() => listIds(page), { timeout: 15000 }).toEqual(
      expect.arrayContaining(["listChannelAccounts", "verifyChannelAccount", "importChannelSession"]),
    );
    expect(await riskOf(page, "listChannelAccounts")).toBe("L0");
    expect(await riskOf(page, "verifyChannelAccount")).toBe("L1");
    expect(await riskOf(page, "importChannelSession")).toBe("L2");
  });
});

test.describe("人在环中：L2 确认门", () => {
  test.beforeEach(async ({ page }) => {
    await waitHook(page, "/dashboard");
    // 打开抽屉，确认卡才在视口内可见
    await page.evaluate(() => (window as unknown as { __agentUI: Hook }).__agentUI.execute("openDrawer"));
    await expect(page.getByLabel("就当前上下文提问")).toBeVisible({ timeout: 8000 });
  });

  test("L2 不自动执行；取消后不执行；批准后恰好执行一次", async ({ page }) => {
    // 回归守卫：addToolResult/任何 TypeError 都不得变成页面未捕获异常
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    // 在浏览器内注册一个 L2 测试动作（函数对象不能跨上下文，故整段在 evaluate 内定义）
    await page.evaluate(() => {
      const w = window as unknown as {
        __agentUI: Hook;
        __l2Count?: number;
      };
      w.__l2Count = 0;
      w.__agentUI.registerTestAction({
        id: "__test_l2_publish",
        description: "测试用 L2 对外动作",
        riskLevel: "L2",
        confirmText: "测试：这是对外不可逆动作，确认执行？",
        execute: () => {
          (window as unknown as { __l2Count: number }).__l2Count += 1;
          return "已执行";
        },
      });
    });
    expect(await riskOf(page, "__test_l2_publish")).toBe("L2");

    // 第一次挂起 → 出现确认卡，但动作未执行
    const callId = await page.evaluate(() =>
      (window as unknown as { __agentUI: Hook }).__agentUI.enqueueL2ForTest("__test_l2_publish"),
    );
    expect(callId).toBeTruthy();
    const card = page.getByTestId("l2-confirm-card");
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("l2-approve")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __l2Count: number }).__l2Count)).toBe(0);
    expect(
      await page.evaluate(() => (window as unknown as { __agentUI: Hook }).__agentUI.listPendingL2().length),
    ).toBe(1);

    // 取消 → 卡消失、仍未执行
    await page.getByTestId("l2-reject").click();
    await expect(card).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __l2Count: number }).__l2Count)).toBe(0);

    // 再次挂起 → 批准 → 卡消失、恰好执行一次
    await page.evaluate(() => (window as unknown as { __agentUI: Hook }).__agentUI.enqueueL2ForTest("__test_l2_publish"));
    await expect(page.getByTestId("l2-confirm-card")).toBeVisible();
    await page.getByTestId("l2-approve").click();
    await expect(page.getByTestId("l2-confirm-card")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __l2Count: number }).__l2Count), { timeout: 5000 })
      .toBe(1);
    // 批准/取消全程不得产生未捕获异常（addToolResult 已兜底）
    expect(pageErrors.filter((m) => /parts|addToolResult|TypeError|unhandled/i.test(m))).toEqual([]);
  });

  test("L1 动作自动执行，不弹确认门", async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as { __agentUI: Hook; __l1Count?: number };
      w.__l1Count = 0;
      w.__agentUI.registerTestAction({
        id: "__test_l1_draft",
        description: "测试用 L1 本地可逆动作",
        riskLevel: "L1",
        execute: () => {
          (window as unknown as { __l1Count: number }).__l1Count += 1;
          return "草稿已生成";
        },
      });
    });
    const summary = await page.evaluate(() =>
      (window as unknown as { __agentUI: Hook }).__agentUI.execute("__test_l1_draft"),
    );
    expect(summary).toBe("草稿已生成");
    expect(await page.evaluate(() => (window as unknown as { __l1Count: number }).__l1Count)).toBe(1);
    await expect(page.getByTestId("l2-confirm-card")).toHaveCount(0);
  });
});
