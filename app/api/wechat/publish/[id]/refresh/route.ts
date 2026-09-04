import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, notFound, methodNotAllowed } from "@/lib/server/api-response";
import { WechatService } from "@/lib/server/services";

const service = new WechatService();

/** POST /api/wechat/publish/[id]/refresh — 轮询发布/群发状态并回写 */
export const POST = withDb(async (_request: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  try {
    const job = await service.refreshJobStatus(id);
    return job ? success(job) : notFound("发布任务");
  } catch (err) {
    return error(err instanceof Error ? err.message : "刷新状态失败", 500);
  }
});

export { methodNotAllowed as GET };
