import { DashboardWorkflows } from "../dashboard-workflows";

/** Agent 动态工作流：只展示对话中 plan_workflow 规划的 SOP + run_workflow 真实运行记录（无预设）。 */
export async function WorkflowsIsland() {
  return <DashboardWorkflows />;
}
