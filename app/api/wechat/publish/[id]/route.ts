import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, badRequest, notFound } from "@/lib/api-response";
import { parseBody, wechatJobUpdateSchema } from "@/lib/api-validation";
import { WechatService } from "@/lib/services";

const service = new WechatService();

/** GET /api/wechat/publish/[id] */
export const GET = withDb(async (_request: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  try {
    const job = await service.getJob(id);
    return job ? success(job) : notFound("发布任务");
  } catch (err) {
    return error(err instanceof Error ? err.message : "读取发布任务失败", 500);
  }
});

/** PATCH /api/wechat/publish/[id] */
export const PATCH = withDb(async (request: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const parsed = parseBody(wechatJobUpdateSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    await service.updateJob(id, parsed.data as Record<string, unknown>);
    return success({ id });
  } catch (err) {
    return error(err instanceof Error ? err.message : "更新发布任务失败", 500);
  }
});

/** DELETE /api/wechat/publish/[id] */
export const DELETE = withDb(async (_request: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  try {
    const ok = await service.removeJob(id);
    return ok ? success({ id }) : notFound("发布任务");
  } catch (err) {
    return error(err instanceof Error ? err.message : "删除发布任务失败", 500);
  }
});
