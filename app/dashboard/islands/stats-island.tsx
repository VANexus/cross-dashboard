import { backendGet } from "@/lib/backend-client";
import { DashboardStatsCards } from "../dashboard-stats";

export async function StatsIsland() {
  const [statsRes, wfRes] = await Promise.all([
    backendGet("/api/dashboard"),
    backendGet("/api/workflows/status"),
  ]);
  const stats = statsRes.data.stats;
  const workflows: { status: string }[] = wfRes.data ?? [];
  const runningCount = workflows.filter((w) => w.status === "running").length;
  const warningCount = workflows.filter((w) => w.status === "warning").length;

  return (
    <DashboardStatsCards
      stats={stats}
      workflowCount={workflows.length}
      runningCount={runningCount}
      warningCount={warningCount}
    />
  );
}
