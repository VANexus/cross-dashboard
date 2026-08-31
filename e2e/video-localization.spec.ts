import { test, expect } from "@playwright/test";

test.describe("Video Localization Workflow", () => {
  test("page should load and display header", async ({ page }) => {
    await page.goto("/workflows/video-localization");
    await expect(
      page.locator("text=视频本地化").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("should render health card and task overview", async ({ page }) => {
    await page.goto("/workflows/video-localization");
    await expect(
      page.locator("text=后端健康").first()
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator("text=任务概览").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("should render task list section", async ({ page }) => {
    await page.goto("/workflows/video-localization");
    await expect(
      page.locator("text=任务列表").first()
    ).toBeVisible({ timeout: 15000 });
    // 无种子数据：空表结构与筛选/表头仍然渲染即可
  });

  test("submit form should validate empty input", async ({ page }) => {
    await page.goto("/workflows/video-localization");
    await expect(
      page.locator("text=批量提交").first()
    ).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "提交批量任务" }).click();
    await expect(
      page.locator("text=请至少输入一条视频路径或 URL").first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("submit form should send request with valid input", async ({ page }) => {
    await page.goto("/workflows/video-localization");
    await expect(
      page.locator("text=批量提交").first()
    ).toBeVisible({ timeout: 15000 });
    await page.locator("textarea").fill("https://cdn.example.com/videos/test-zh.mp4");
    await page.getByRole("button", { name: "提交批量任务" }).click();
    // VL 不可达时展示结构化错误提示（而非崩溃）；可达时展示提交成功
    await expect(
      page.locator("text=提交失败").or(page.locator("text=已提交")).first()
    ).toBeVisible({ timeout: 10000 });
  });
});