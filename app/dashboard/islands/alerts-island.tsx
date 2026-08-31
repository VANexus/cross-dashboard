import { DashboardAlerts } from "../dashboard-alerts";
import { DashboardService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";
import type { Alert } from "@/lib/types";

export async function AlertsIsland() {
  await getDbAsync();
  const service = new DashboardService();
  const dashboard = await service.getDashboardData();
  const alerts: Alert[] = dashboard.alerts ?? [];
  return <DashboardAlerts alerts={alerts} />;
}
