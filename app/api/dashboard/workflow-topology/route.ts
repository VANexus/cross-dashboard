import { withDb } from "@/lib/server/api-helpers";
import { success } from "@/lib/server/api-response";
import { getKernel } from "@/src/kernel";

/**
 * 动态工作流可视化数据源：返回全部 wf_workflow_specs 的完整 DAG（含 steps）。
 * 供仪表盘「动态工作流可视化」面板渲染步骤流水线。
 */
export const GET = withDb(async () => {
  const kernel = await getKernel();
  try {
    const list = await kernel.specs.listWorkflowSpecs(30);
    const full: Array<{
      id: string;
      title: string;
      goal: string;
      updated_at: string;
      steps: Array<{ id: string; tool: string; dependsOn?: string[] }>;
    }> = [];
    for (const item of list) {
      const spec = await kernel.specs.getWorkflowSpec(item.id);
      if (!spec) continue;
      full.push({
        id: spec.id,
        title: spec.title,
        goal: spec.goal,
        updated_at: spec.updated_at,
        steps: (spec.spec.steps ?? []).map((s) => ({
          id: s.id,
          tool: s.tool,
          dependsOn: s.dependsOn,
        })),
      });
    }
    return success(full);
  } catch (e) {
    console.error("[dashboard/workflow-topology] list", e);
    return success([]);
  }
});
