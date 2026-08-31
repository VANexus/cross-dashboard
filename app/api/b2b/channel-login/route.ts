import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, b2bChannelLoginSchema } from "@/lib/api-validation";
import { ContentMCPClient } from "@/lib/content/mcp-client";
import { B2BSettingsService } from "@/lib/services";

/**
 * 渠道站内登录：调 MCP b2b_channel_login 弹出本机有头浏览器 → 用户手动登录 →
 * 捕获会话 cookie → 存入设置（ai_config）。登录态功能（全量榜单 / IG 搜索）随即可用。
 * 注意：登录窗口在 MCP 进程所在机器弹出（当前本地部署即用户电脑）。
 */
export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(b2bChannelLoginSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  const mcp = new ContentMCPClient();
  try {
    // 登录窗口最长等待 5 分钟：覆盖默认 30s 超时；noRetry 防止重复弹窗
    const result = await mcp.call<{ platform: string; ok: boolean; cookie: string; message: string }>(
      "b2b_channel_login",
      { platform: parsed.data.platform, timeout_s: 300 },
      { timeoutMs: 320_000, noRetry: true },
    );

    if (!result.ok || !result.cookie) {
      return success({ platform: parsed.data.platform, ok: false, message: result.message || "登录未完成" });
    }

    const settingsService = new B2BSettingsService();
    await settingsService.updateSettings(
      parsed.data.platform === "tiktok"
        ? { tiktokSessionCookie: result.cookie }
        : { instagramSessionCookie: result.cookie },
    );
    return success({
      platform: parsed.data.platform,
      ok: true,
      message: "登录成功，会话已保存",
    });
  } catch (err) {
    return badRequest(
      err instanceof Error ? `登录失败：${err.message}` : "登录失败：未知错误",
    );
  }
});

export { methodNotAllowed as PUT };
export { methodNotAllowed as GET };
export { methodNotAllowed as DELETE };
