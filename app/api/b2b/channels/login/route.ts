import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, b2bChannelLoginAccountSchema } from "@/lib/api-validation";
import { ContentMCPClient } from "@/lib/content/mcp-client";
import { insertChannelAccount, listChannelAccounts } from "@/lib/repositories/channel-accounts.repository";
import { encryptSecret } from "@/lib/vault";

/**
 * 多账号站内登录：弹本机有头浏览器 → 用户手动登录 → 捕获会话 →
 * AES-256-GCM 加密落 channel_accounts（保险库，多账号）。
 * 与 settings 单账号登录（/api/b2b/channel-login）并存：保险库账号优先被业务取用。
 */
export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(b2bChannelLoginAccountSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const { platform, label } = parsed.data;

  const mcp = new ContentMCPClient();
  try {
    // 登录窗口最长等 5 分钟：覆盖默认超时；noRetry 防止重复弹窗
    const result = await mcp.call<{ platform: string; ok: boolean; cookie: string; message: string }>(
      "b2b_channel_login",
      { platform, timeout_s: 300 },
      { timeoutMs: 320_000, noRetry: true },
    );
    if (!result.ok || !result.cookie) {
      return success({ ok: false, message: result.message || "登录未完成" });
    }

    const existing = await listChannelAccounts(platform);
    const finalLabel = label || `账号 ${existing.length + 1}`;
    const account = await insertChannelAccount({ platform, label: finalLabel, sessionEnc: encryptSecret(result.cookie) });

    return success({ ok: true, id: account.id, label: finalLabel, message: "登录成功，会话已加密入库（建议立即「校验会话」确认账号可用）" });
  } catch (err) {
    return badRequest(err instanceof Error ? `登录失败：${err.message}` : "登录失败：未知错误");
  }
});

export { methodNotAllowed as GET };
export { methodNotAllowed as PUT };
export { methodNotAllowed as DELETE };
