import { DashboardStatsCards } from "../dashboard-stats";
import { getDashboardDataShared } from "@/lib/services/dashboard.service";
import { getDbAsync } from "@/lib/db";

export async function StatsIsland() {
  await getDbAsync();
  const dashboard = await getDashboardDataShared();
  const workflows = dashboard.workflows;
  const runningCount = workflows.filter((w) => w.status === "running").length;
  const warningCount = workflows.filter((w) => w.status === "warning").length;

  return (
    <DashboardStatsCards
      stats={dashboard.stats ?? { totalAgents: 0, onlineAgents: 0, busyAgents: 0, errorAgents: 0, offlineAgents: 0, totalTasks: 0, runningTasks: 0, completedTasks: 0, failedTasks: 0, riskEvents24h: 0, activeCircuitBreakers: 0 }}
      workflowCount={workflows.length}
      runningCount={runningCount}
      warningCount={warningCount}
    />
  );
}
