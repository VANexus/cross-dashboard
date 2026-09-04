import { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";
import { getKernel } from "@/src/kernel";

/**
 * Agent 动态工作流状态（真实数据，无预设）：
 * 只展示主 Agent 在对话中 plan_workflow 规划的 SOP（wf_workflow_specs）
 * + run_workflow 产生的真实运行记录（wf_workflow_runs）。
 */
export const GET = withDb(async (_request: NextRequest) => {
  const kernel = await getKernel();
  let specs: Array<{
    id: string;
    title: string;
    goal: string;
    updated_at: string;
    stepCount: number;
  }> = [];
  try {
    const list = await kernel.specs.listWorkflowSpecs(30);
    specs = [];
    for (const item of list) {
      const spec = await kernel.specs.getWorkflowSpec(item.id);
      if (!spec) continue;
      specs.push({
        id: spec.id,
        title: spec.title,
        goal: spec.goal,
        updated_at: spec.updated_at,
        stepCount: (spec.spec.steps ?? []).length,
      });
    }
  } catch (e) {
    console.error("[dashboard/workflow-status] specs", e);
  }

  let runs: Array<{
    id: string;
    workflow_id: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    summary: string;
  }> = [];
  try {
    const rows = await prisma.wf_workflow_runs.findMany({
      orderBy: { started_at: "desc" },
      take: 100,
    });
    runs = rows.map((r) => ({
      id: r.id,
      workflow_id: r.workflow_id,
      status: r.status,
      started_at: r.started_at,
      completed_at: r.completed_at,
      summary: r.summary,
    }));
  } catch (e) {
    console.error("[dashboard/workflow-status] runs", e);
  }

  // 每份 SOP 的运行统计
  const runByWf = new Map<string, typeof runs>();
  for (const r of runs) {
    const arr = runByWf.get(r.workflow_id) ?? [];
    arr.push(r);
    runByWf.set(r.workflow_id, arr);
  }

  const items = specs.map((s) => {
    const rs = runByWf.get(s.id) ?? [];
    const lastRun = rs[0] ?? null;
    return {
      ...s,
      runCount: rs.length,
      lastRunStatus: lastRun?.status ?? null,
      lastRunAt: lastRun?.started_at ?? null,
      lastRunSummary: lastRun?.summary ?? "",
    };
  });

  const totalRuns = runs.length;
  return success({
    workflows: items,
    totals: {
      specCount: items.length,
      runCount: totalRuns,
      running: runs.filter((r) => r.status === "running").length,
      success: runs.filter((r) => r.status === "success").length,
      failed: runs.filter((r) => r.status === "failed" || r.status === "error").length,
    },
  });
});
