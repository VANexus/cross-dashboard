/**
 * 团队 SOP（M4 动态工作流）—— /api/agent/workflows
 *
 * GET：列出已保存的团队 SOP（id/title/goal/updated_at），表缺失时降级为空清单。
 * POST：把一次可复用打法保存为 SOP spec（落 wf_workflow_specs）。
 *   body: { id(slug), title, goal, steps: [{id,tool,args?,dependsOn?}] }
 *   保存前做 zod 校验 + 拓扑校验（引用存在、无环），与 chat 的 plan_workflow 同一契约。
 * 说明：SOP 只编排可自动执行的分析/草稿/生图工具；渠道上架等 L2 对外动作不进自动 SOP，仍须人确认。
 */
import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, methodNotAllowed } from "@/lib/api-response";
import { getKernel } from "@/src/kernel";
import { workflowSpecSchema } from "@/src/kernel/plugins/spec-store";
import { topoSortSpecSteps } from "@/src/kernel/plugins/mastra-engine";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

export const GET = withDb(async () => {
  const kernel = await getKernel();
  try {
    const data = await kernel.specs.listWorkflowSpecs(50);
    return success(data);
  } catch (err) {
    // wf_workflow_specs 未建（迁移未执行）：增量能力，降级为空清单
    console.error("[agent/workflows] list", err);
    return success([]);
  }
});

export const POST = withDb(async (req: NextRequest) => {
  const kernel = await getKernel();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("请求体不是合法 JSON", 400);
  }
  const b = (body ?? {}) as { id?: string; title?: string; goal?: string; steps?: unknown };

  if (!b.id || !SLUG_RE.test(b.id)) return error("id 必须为 2-63 位小写字母/数字/连字符 slug", 400);
  if (!b.title || b.title.length > 80) return error("title 必填且不超过 80 字", 400);
  if (!b.goal) return error("goal（SOP 目标）必填", 400);

  const parsed = workflowSpecSchema.safeParse({ steps: b.steps });
  if (!parsed.success) {
    return error("SOP 步骤不合法：" + parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("；"), 400);
  }
  // 工具白名单：不允许引用不存在的工具
  const available = Object.keys(kernel.tools.mastra);
  const badTool = parsed.data.steps.find((s) => !available.includes(s.tool));
  if (badTool) return error(`步骤 ${badTool.id} 引用了不存在的工具：${badTool.tool}`, 400);

  try {
    topoSortSpecSteps(parsed.data.steps); // 引用存在 + 无环
    await kernel.specs.saveWorkflowSpec(b.id, b.title, b.goal, parsed.data);
    return success({ ok: true, id: b.id, stepCount: parsed.data.steps.length });
  } catch (err) {
    console.error("[agent/workflows] save", err);
    return error(err instanceof Error ? err.message : "SOP 保存失败", 400);
  }
});

export { methodNotAllowed as PUT, methodNotAllowed as DELETE, methodNotAllowed as PATCH };
