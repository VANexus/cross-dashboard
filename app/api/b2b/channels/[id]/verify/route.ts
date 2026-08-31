import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { ContentMCPClient } from "@/lib/content/mcp-client";
import {
  decryptAccountSession, getChannelAccount, updateChannelAccount,
} from "@/lib/repositories/channel-accounts.repository";
import type { ChannelAccountStatus } from "@/lib/types";

/**
 * 会话探活：解密该账号会话 → MCP b2b_channel_verify 只读探活 → 回写 status / last_checked_at。
 * 平台风控分类：active / expired / risk_control。
 */
export const POST = withDb(async (_request: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const account = await getChannelAccount(id);
  if (!account) return badRequest("账号不存在");
  if (account.platform === "alibaba") {
    return badRequest("阿里国际站走 TOP 官方 API，无需会话探活");
  }

  let cookie: string;
  try {
    cookie = decryptAccountSession(account);
  } catch (err) {
    await updateChannelAccount(id, { status: "expired", lastCheckedAt: new Date().toISOString() });
    return badRequest(`会话解密失败（密钥不匹配或密文损坏），已标记过期：${err instanceof Error ? err.message : err}`);
  }

  const mcp = new ContentMCPClient();
  try {
    const result = await mcp.call<{ platform: string; ok: boolean; status: string; account: string; message: string }>(
      "b2b_channel_verify",
      { platform: account.platform, cookie },
      { timeoutMs: 25_000, noRetry: true },
    );

    const status = (["active", "expired", "risk_control"].includes(result.status)
      ? result.status
      : "risk_control") as ChannelAccountStatus;
    const patch: { status: ChannelAccountStatus; lastCheckedAt: string; label?: string } = {
      status,
      lastCheckedAt: new Date().toISOString(),
    };
    // 账号还没起名时，用探活拿到的账号标识自动补
    if (result.account && !account.label) patch.label = result.account;
    await updateChannelAccount(id, patch);

    return success({ id, status, account: result.account, message: result.message });
  } catch (err) {
    return badRequest(err instanceof Error ? `探活失败：${err.message}` : "探活失败：未知错误");
  }
});

export { methodNotAllowed as GET };
export { methodNotAllowed as PUT };
export { methodNotAllowed as DELETE };
