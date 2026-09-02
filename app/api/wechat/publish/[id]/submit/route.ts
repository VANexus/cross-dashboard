import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, wechatJobSubmitSchema } from "@/lib/api-validation";
import { WechatService, WechatMCPError } from "@/lib/services";

const service = new WechatService();

/** POST /api/wechat/publish/[id]/submit — 最终确认后提交发布/群发 */
export const POST = withDb(async (request: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const parsed = parseBody(wechatJobSubmitSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const result = await service.submitJob(id, parsed.data);
    return success(result);
  } catch (err) {
    if (err instanceof WechatMCPError) {
      return error(err.message, err.category === "skill" ? 422 : 503);
    }
    return error(err instanceof Error ? err.message : "发布失败", 500);
  }
});

export { methodNotAllowed as GET };
