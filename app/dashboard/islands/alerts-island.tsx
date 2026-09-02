import { DashboardAlerts } from "../dashboard-alerts";
import { getDashboardDataShared } from "@/lib/services/dashboard.service";
import { getDbAsync } from "@/lib/db";
import type { Alert } from "@/lib/types";

export async function AlertsIsland() {
  await getDbAsync();
  const dashboard = await getDashboardDataShared();
  const alerts: Alert[] = dashboard.alerts ?? [];
  return <DashboardAlerts alerts={alerts} />;
}
