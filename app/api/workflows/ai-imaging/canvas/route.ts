/**
 * 生图画布 API（T4 v1）— /api/workflows/ai-imaging/canvas
 * GET    ?root=xxx        项目全部版本节点；无 root 时返回最近项目列表
 * POST   {action:'root'|'branch', …}  建根（新项目） / 开分支（基于父版本）
 * PATCH  {id, patch…}     回填图/改名/改 prompt
 * DELETE ?id=xxx          删除叶子节点
 */
import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { ImageCanvasService } from "@/lib/server/services/imaging-canvas.service";

const svc = new ImageCanvasService();

export const GET = withDb(async (request: NextRequest) => {
  const root = request.nextUrl.searchParams.get("root");
  try {
    if (root) return success(await svc.listByRoot(root));
    return success(await svc.listProjects());
  } catch (e) {
    return error(e instanceof Error ? e.message : "读取失败", 500);
  }
});

export const POST = withDb(async (request: NextRequest) => {
  let body: {
    action?: string; title?: string; prompt?: string; negative?: string; params?: Record<string, unknown>;
    parentId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("body 必须是 JSON");
  }
  try {
    if (body.action === "branch") {
      if (!body.parentId) return badRequest("branch 需要 parentId（来源版本）");
      return success(await svc.createChild(body.parentId, { prompt: body.prompt, title: body.title, params: body.params }));
    }
    if (body.action === "root") {
      if (!body.prompt?.trim()) return badRequest("新建项目需要 prompt");
      return success(await svc.createRoot({ title: body.title, prompt: body.prompt, negative: body.negative, params: body.params }));
    }
    return badRequest("action 仅支持 root / branch");
  } catch (e) {
    return error(e instanceof Error ? e.message : "操作失败", 400);
  }
});

export const PATCH = withDb(async (request: NextRequest) => {
  let body: { id?: string; title?: string; prompt?: string; negative?: string; status?: string; imageUrl?: string; thumbnail?: string; params?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("body 必须是 JSON");
  }
  if (!body.id) return badRequest("缺少 id");
  try {
    const node = await svc.updateNode(body.id, {
      title: body.title, prompt: body.prompt, negative: body.negative,
      status: body.status, imageUrl: body.imageUrl, thumbnail: body.thumbnail, params: body.params,
    });
    return success(node);
  } catch (e) {
    return error(e instanceof Error ? e.message : "更新失败", 400);
  }
});

export const DELETE = withDb(async (request: NextRequest) => {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return badRequest("缺少 id");
  try {
    return success({ ok: await svc.removeNode(id) });
  } catch (e) {
    return error(e instanceof Error ? e.message : "删除失败", 400);
  }
});

export { methodNotAllowed as PUT };