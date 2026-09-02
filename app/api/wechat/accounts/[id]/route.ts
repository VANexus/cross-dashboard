import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, badRequest, notFound, methodNotAllowed } from "@/lib/api-response";
import { parseBody, wechatAccountUpdateSchema } from "@/lib/api-validation";
import { WechatService } from "@/lib/services";

const service = new WechatService();

/** PATCH /api/wechat/accounts/[id] — 更新账号（标签/凭证/状态） */
export const PATCH = withDb(async (request: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const parsed = parseBody(wechatAccountUpdateSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    await service.updateAccount(id, parsed.data);
    return success({ id });
  } catch (err) {
    return error(err instanceof Error ? err.message : "更新公众号账号失败", 500);
  }
});

/** DELETE /api/wechat/accounts/[id] */
export const DELETE = withDb(async (_request: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  try {
    const ok = await service.removeAccount(id);
    return ok ? success({ id }) : notFound("公众号账号");
  } catch (err) {
    return error(err instanceof Error ? err.message : "删除公众号账号失败", 500);
  }
});

export { methodNotAllowed as GET };
