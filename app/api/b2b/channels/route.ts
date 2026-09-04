import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, b2bChannelCreateSchema } from "@/lib/server/api-validation";
import {
  insertChannelAccount, listChannelAccounts,
} from "@/lib/server/repositories/channel-accounts.repository";
import { encryptSecret } from "@/lib/server/vault";

/**
 * 渠道账号保险库（M2）列表与创建。
 * 会话密文永不返回前端——列表返回 masked 摘要；明文只在校验/趋势调用时服务端解密。
 */
export const GET = withDb(async (request: NextRequest) => {
  const platform = new URL(request.url).searchParams.get("platform");
  try {
    const accounts = await listChannelAccounts(
      platform === "tiktok" || platform === "instagram" || platform === "alibaba" ? platform : undefined,
    );
    return success(
      accounts.map(({ sessionEnc: _enc, ...rest }) => ({
        ...rest,
        hasSession: true,
      })),
    );
  } catch (err) {
    // 表未建（迁移未执行）等场景：返回空列表而非 500，前端展示空态引导
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("channel_accounts")) {
      console.warn("[channels] 保险库表未创建：请在 Supabase 执行 supabase/migrations/00008_channel_accounts.sql");
      return success([]);
    }
    throw err;
  }
});

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(b2bChannelCreateSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const { platform, label, session } = parsed.data;
  if (!session) return badRequest("缺少会话内容（session）");

  try {
    const account = await insertChannelAccount({
      platform,
      label,
      sessionEnc: encryptSecret(session),
    });
    const { sessionEnc: _enc, ...safe } = account;
    return success(safe);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "创建账号失败");
  }
});

export { methodNotAllowed as PUT };
export { methodNotAllowed as DELETE };
