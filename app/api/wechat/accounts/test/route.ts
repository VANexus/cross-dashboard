import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, wechatTestSchema } from "@/lib/api-validation";
import { WechatService, WechatMCPError } from "@/lib/services";

const service = new WechatService();

/**
 * POST /api/wechat/accounts/test — 测试公众号连接
 * body: { id }           → 解密库内该账号凭证
 *       { appId, appSecret } → 直接测（保存前先验证）
 *       {}               → 走 flowmind 环境变量 WECHAT_APP_ID/WECHAT_APP_SECRET
 */
export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(wechatTestSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const result = await service.testAccount(parsed.data);
    return success(result);
  } catch (err) {
    if (err instanceof WechatMCPError) {
      return error(err.message, err.category === "skill" ? 422 : 503);
    }
    return error(err instanceof Error ? err.message : "测试连接失败", 500);
  }
});

export { methodNotAllowed as GET };
