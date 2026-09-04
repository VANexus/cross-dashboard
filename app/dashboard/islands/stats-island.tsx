import { DashboardStatsCards } from "../dashboard-stats";
import { DashboardService, getDashboardDataShared } from "@/lib/server/services/dashboard.service";
import { getDbAsync } from "@/lib/server/db";

export async function StatsIsland({ compact = false }: { compact?: boolean }) {
  await getDbAsync();
  const service = new DashboardService();
  const [dashboard, wfTotals] = await Promise.all([
    getDashboardDataShared(),
    service.getAgentWorkflowTotals(),
  ]);
  const runningCount = wfTotals.running;
  const warningCount = wfTotals.failed;

  return (
    <DashboardStatsCards
      compact={compact}
      stats={dashboard.stats ?? { totalAgents: 0, onlineAgents: 0, busyAgents: 0, errorAgents: 0, offlineAgents: 0, totalTasks: 0, runningTasks: 0, completedTasks: 0, failedTasks: 0, riskEvents24h: 0, activeCircuitBreakers: 0 }}
      workflowCount={wfTotals.specCount}
      runningCount={runningCount}
      warningCount={warningCount}
    />
  );
}
