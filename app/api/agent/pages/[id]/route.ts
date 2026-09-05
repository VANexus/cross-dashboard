import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { getKernel } from "@/src/kernel";
import { pageSpecComponentSchema } from "@/src/kernel/plugins/spec-store";

/**
 * 动态页面增量（M5 update_page 的 HTTP 版）—— PATCH /api/agent/pages/[id]
 * body: { op: 'append'|'insert'|'replace'|'remove'|'move', component?: {id,component,props}, index?: number, to?: number }
 * 与对话中的 update_page 工具共用 SpecStoreService.updatePageSpec（RSC 渲染即时反映）。
 */
export const PATCH = withDb(async (request: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(id)) return badRequest("slug 只能是小写字母/数字/连字符");

  let body: { op?: string; component?: unknown; index?: number; to?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("body 必须是 JSON");
  }
  const op = body.op;
  if (op !== "append" && op !== "insert" && op !== "replace" && op !== "remove" && op !== "move") {
    return badRequest("op 仅支持 append / insert / replace / remove / move");
  }
  const comp = op === "remove" || op === "move" ? undefined : pageSpecComponentSchema.safeParse(body.component);
  if ((op === "append" || op === "insert" || op === "replace") && (!comp || !comp.success)) {
    return badRequest("component 不合法（需 { id, component, props? }）：" + (comp?.error?.message ?? "缺失"));
  }
  const index = body.index;
  const to = body.to;

  try {
    const kernel = await getKernel();
    const r = await kernel.specs.updatePageSpec(id, {
      op,
      component: op === "remove" || op === "move" ? undefined : comp!.data,
      index,
      to,
    });
    return success({ ...r, url: `/p/${id}` });
  } catch (e) {
    return error(e instanceof Error ? e.message : "页面增量失败", 400);
  }
});

export { methodNotAllowed as GET, methodNotAllowed as POST, methodNotAllowed as DELETE };