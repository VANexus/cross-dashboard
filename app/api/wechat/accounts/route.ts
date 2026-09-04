import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, wechatAccountCreateSchema } from "@/lib/server/api-validation";
import { WechatService } from "@/lib/server/services";

const service = new WechatService();

/** GET /api/wechat/accounts — 公众号账号列表（仅掩码） */
export const GET = withDb(async () => {
  try {
    return success(await service.getAccounts());
  } catch (err) {
    return error(err instanceof Error ? err.message : "读取公众号账号失败", 500);
  }
});

/** POST /api/wechat/accounts — 新增公众号账号（AppID/AppSecret 加密入库） */
export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(wechatAccountCreateSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    return success(await service.createAccount(parsed.data), undefined, 201);
  } catch (err) {
    return error(err instanceof Error ? err.message : "新增公众号账号失败", 500);
  }
});

export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
