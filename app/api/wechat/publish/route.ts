import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, wechatJobCreateSchema } from "@/lib/server/api-validation";
import { WechatService } from "@/lib/server/services";

const service = new WechatService();

/** GET /api/wechat/publish — 发布历史 */
export const GET = withDb(async () => {
  try {
    return success(await service.listJobs());
  } catch (err) {
    return error(err instanceof Error ? err.message : "读取发布历史失败", 500);
  }
});

/** POST /api/wechat/publish — 创建发布任务（进入分步确认状态机） */
export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(wechatJobCreateSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    return success(await service.createJob(parsed.data), undefined, 201);
  } catch (err) {
    return error(err instanceof Error ? err.message : "创建发布任务失败", 500);
  }
});

export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
