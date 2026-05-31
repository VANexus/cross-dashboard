import { DashboardStatsCards } from "../dashboard-stats";
import { DashboardService, WorkflowService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";

export async function StatsIsland() {
  await getDbAsync();
  const dashboardService = new DashboardService();
  const workflowService = new WorkflowService();
  const dashboard = dashboardService.getDashboardData();
  const workflows = workflowService.getWorkflowStatuses();
  const runningCount = workflows.filter((w) => w.status === "running").length;
  const warningCount = workflows.filter((w) => w.status === "warning").length;

  return (
    <DashboardStatsCards
      stats={dashboard.stats}
      workflowCount={workflows.length}
      runningCount={runningCount}
      warningCount={warningCount}
    />
  );
}
