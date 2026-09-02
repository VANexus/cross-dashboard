import { test, expect } from "@playwright/test";

/**
 * M4「保存为团队 SOP」最小版 —— 真实浏览器验证 TeamSopPanel 的用户可见契约：
 * 面板渲染、保存当前铺货旅程为 SOP、已保存 SOP 列表、重跑并展示每步成败。
 * 远端 Supabase 尚未应用 00012/00013（wf_workflow_specs 缺表），用 page.route 打桩，
 * 只验证前端契约，不依赖远端库；迁移执行后可另加真实落库集成测试。
 */
test.describe("M4 团队 SOP 最小版", () => {
  test("铺货旅程页可保存/列出/重跑 SOP", async ({ page }) => {
    const sopId = "tiktok-alibaba-listing-sop";

    await page.route("**/api/agent/workflows", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { ok: true, id: sopId, stepCount: 5 } }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [{ id: sopId, title: "TikTok·国际站铺货 SOP", goal: "热词→长尾→Listing→侵权→主图", updated_at: "2026-09-02T00:00:00Z" }] }),
      });
    });
    await page.route(`**/api/agent/workflows/${sopId}/run`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            ok: false,
            id: sopId,
            status: "failed",
            steps: [
              { id: "fetch-tiktok-trends", tool: "b2b_trends", ok: true, summary: "{}" },
              { id: "listing-draft", tool: "listing_generate", ok: false, summary: "降级示例" },
            ],
          },
        }),
      });
    });

    await page.goto("/journeys/listing-launch");
    const panel = page.getByTestId("team-sop-panel");
    await expect(panel).toBeVisible({ timeout: 15000 });

    // 保存当前旅程为 SOP（模板 5 步）
    await page.getByTestId("save-sop").click();
    await expect(page.getByText("已保存为团队 SOP")).toBeVisible({ timeout: 5000 });

    // 列表渲染已保存 SOP
    const row = page.getByTestId(`sop-row-${sopId}`);
    await expect(row).toBeVisible({ timeout: 5000 });
    await expect(row).toContainText("TikTok·国际站铺货 SOP");

    // 重跑并展示每步成败（1 成功 1 失败）
    await page.getByTestId(`rerun-sop-${sopId}`).click();
    const result = page.getByTestId(`sop-result-${sopId}`);
    await expect(result).toBeVisible({ timeout: 5000 });
    await expect(result).toContainText("fetch-tiktok-trends");
    await expect(result).toContainText("listing-draft");
    await expect(result.locator(".text-success")).toHaveCount(1);
    await expect(result.locator(".text-destructive")).toHaveCount(1);
  });

  test("无 SOP 时显示空态且不报错", async ({ page }) => {
    await page.route("**/api/agent/workflows", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] }) }),
    );
    await page.goto("/journeys/content-publish");
    await expect(page.getByTestId("team-sop-panel")).toBeVisible({ timeout: 15000 });
    // content-publish 暂无内置 SOP 模板 → 不显示保存按钮，显示空态
    await expect(page.getByTestId("save-sop")).toHaveCount(0);
    await expect(page.getByTestId("sop-empty")).toBeVisible();
  });
});
