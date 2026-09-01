import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, b2bChannelCaptureSchema } from "@/lib/api-validation";
import { B2BSettingsService } from "@/lib/services/b2b-settings.service";
import { ContentMCPClient } from "@/lib/content/mcp-client";
import { insertChannelAccount, listChannelAccounts } from "@/lib/repositories/channel-accounts.repository";
import { encryptSecret } from "@/lib/vault";

/**
 * 内嵌登录捕获：页面点「站内登录」→ 用户自己的浏览器打开平台登录页正常登录 →
 * 前端轮询本路由 → flowmind 经 CDP 读取浏览器内平台会话 → 有 sessionid 即捕获 →
 * AES-256-GCM 加密落 channel_accounts（保险库，多账号）。
 * pending=true 表示尚未检测到登录，前端继续轮询；无账密参与，会话只从用户浏览器读出一次。
 */
export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(b2bChannelCaptureSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const { platform, label } = parsed.data;

  const cdp = ((await new B2BSettingsService().getSettings()).browserDebugUrl || "").trim();

  const mcp = new ContentMCPClient();
  try {
    const result = await mcp.call<{
      platform: string; ok: boolean; cookie: string; message: string; status: string;
    }>(
      "b2b_channel_login",
      { platform, cdp_url: cdp },
      { timeoutMs: 60_000, noRetry: true },
    );

    if (result.status === "pending") {
      return success({ ok: false, pending: true, message: result.message || "尚未检测到登录会话" });
    }
    if (result.status !== "ok" || !result.cookie) {
      return success({ ok: false, message: result.message || "会话捕获失败" });
    }

    const existing = await listChannelAccounts(platform);
    const finalLabel = label || `账号 ${existing.length + 1}`;
    const account = await insertChannelAccount({ platform, label: finalLabel, sessionEnc: encryptSecret(result.cookie) });

    return success({ ok: true, id: account.id, label: finalLabel, message: "登录成功，会话已加密入库" });
  } catch (err) {
    return badRequest(err instanceof Error ? `捕获失败：${err.message}` : "捕获失败：未知错误");
  }
});

export { methodNotAllowed as GET };
export { methodNotAllowed as PUT };
export { methodNotAllowed as DELETE };
