/**
 * 团队 SOP 重跑 —— POST /api/agent/workflows/[id]/run
 *
 * 按 slug 取出已保存 SOP spec，经 mastra.runSpec 拓扑执行，
 * 单步失败记录并继续、整体标 failed（与 chat 的 run_workflow 工具同一执行内核）。
 */
import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, methodNotAllowed } from "@/lib/api-response";
import { getKernel } from "@/src/kernel";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withDb(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const kernel = await getKernel();
  try {
    const row = await kernel.specs.getWorkflowSpec(id);
    if (!row) {
      const list = await kernel.specs.listWorkflowSpecs(50);
      return error(`未找到 SOP「${id}」。已保存：${list.map((w) => w.id).join("、") || "（无）"}`, 404);
    }
    const result = await kernel.mastra.runSpec(row.spec);
    return success({ ok: result.status === "success", id, title: row.title, status: result.status, steps: result.steps });
  } catch (err) {
    console.error("[agent/workflows/run]", err);
    return error(err instanceof Error ? err.message : "SOP 执行失败", 400);
  }
});

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as DELETE };
