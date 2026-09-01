import { test, expect } from "@playwright/test";

test.describe("B端运营工作台", () => {
  test("侧边栏包含 B端运营 四个入口", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("text=B端运营").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("a[href='/b2b/keyword-trends']").first()).toBeVisible();
    await expect(page.locator("a[href='/b2b/listing']").first()).toBeVisible();
    await expect(page.locator("a[href='/b2b/image-skills']").first()).toBeVisible();
    await expect(page.locator("a[href='/b2b/channels']").first()).toBeVisible();
  });

  test("渠道账号页加载并展示 TikHub 数据源说明与粘贴导入", async ({ page }) => {
    await page.goto("/b2b/channels");
    await expect(page.locator("text=B端运营工作台").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=数据源：TikHub API（免登录）").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "粘贴导入" }).first()).toBeVisible();
    await expect(page.locator("text=暂无保存的账号会话").or(page.locator("text=账号保险库")).first()).toBeVisible({ timeout: 15000 });
  });

  test("关键词趋势页加载并展示真实数据或空态引导（无演示数据）", async ({ page }) => {
    await page.goto("/b2b/keyword-trends");
    await expect(page.locator("text=B端运营工作台").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=行业关键词热力榜").first()).toBeVisible({ timeout: 15000 });
    // 已有真实缓存数据（榜单行：等宽字体排名徽标）或空态引导（未配置时）均可
    await expect(
      page.locator("text=暂无榜单数据").or(page.locator("span.font-mono").first())
    ).toBeVisible({ timeout: 15000 });
    // 绝不出现演示/种子词
    await expect(page.locator("text=skincare routine")).toHaveCount(0);
  });

  test("切换到阿里国际站展示配置引导而非崩溃", async ({ page }) => {
    await page.goto("/b2b/keyword-trends");
    await page.locator("button:has-text('阿里国际站')").first().click();
    await expect(page.locator("text=行业关键词热力榜").first()).toBeVisible({ timeout: 15000 });
    // 未授权 / MCP 不可达 → 空态或结构化提示，不崩溃且无演示词
    await expect(
      page.locator("text=暂无榜单数据").or(page.locator("text=更新榜单")).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=skincare packaging")).toHaveCount(0);
  });

  test("趋势页展示每日推送与定时更新卡片", async ({ page }) => {
    await page.goto("/b2b/keyword-trends");
    await expect(
      page.locator("text=每日推送与定时更新").first()
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("button", { name: "触发每日任务" })
    ).toBeVisible({ timeout: 5000 });
    // 未配置 webhook 时给出引导
    await expect(
      page.locator("text=未配置 webhook").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("长尾词生成为空行业时展示校验提示", async ({ page }) => {
    await page.goto("/b2b/keyword-trends");
    await page.getByRole("button", { name: "生成长尾词" }).click();
    await expect(page.locator("text=请输入行业名称").first()).toBeVisible({ timeout: 5000 });
  });

  test("关键词趋势 MCP 不可达时展示结构化错误而非崩溃", async ({ page }) => {
    await page.route("**/api/b2b/keyword-trends", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "连接 flowmind MCP 失败", code: 503 }),
      }),
    );
    await page.goto("/b2b/keyword-trends");
    await page.getByRole("button", { name: "更新榜单" }).click();
    await expect(
      page.locator("text=连接 flowmind MCP 失败").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("一键上架页加载并展示推荐与草稿库区块", async ({ page }) => {
    await page.goto("/b2b/listing");
    await expect(page.locator("text=B端运营工作台").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=今日推荐上架 TOP5").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Listing 草稿库").first()).toBeVisible({ timeout: 15000 });
  });

  test("推荐 MCP 不可达时展示结构化错误而非崩溃", async ({ page }) => {
    await page.route("**/api/b2b/recommend", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "推荐服务暂不可用", code: 503 }),
      }),
    );
    await page.goto("/b2b/listing");
    await page.getByRole("button", { name: "今日推荐 TOP5" }).click();
    await expect(
      page.locator("text=推荐服务暂不可用").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("生图 Skill 库加载并展示空态引导（无演示数据）", async ({ page }) => {
    await page.goto("/b2b/image-skills");
    await expect(page.locator("text=B端运营工作台").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=生图 Skill 库").first()).toBeVisible({ timeout: 15000 });
    // 无种子 Skill → 空态上传引导可见
    await expect(
      page.locator("text=暂无 Skill").first()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=白底商摄")).toHaveCount(0);
  });

  test("反推提示词为空 URL 时展示校验提示", async ({ page }) => {
    await page.goto("/b2b/image-skills");
    await page.getByRole("button", { name: "反推提示词" }).click();
    await expect(
      page.locator("text=请先粘贴效果好的封面图 URL").first()
    ).toBeVisible({ timeout: 5000 });
  });
});
